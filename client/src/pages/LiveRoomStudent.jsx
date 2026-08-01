import { useState, useEffect, useContext, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import socket, { ensureSocketConnected } from '../utils/socket';
import DashboardLayout from '../components/DashboardLayout';
import AuthContext from '../context/AuthContext';
import WaitingRoomLoader from '../components/loaders/WaitingRoomLoader';
import LiveQuizWaitAnimation from '../components/loaders/LiveQuizWaitAnimation';
import { ShieldCheck, Users, Trophy, Crown, Flame, Ban, CameraOff, ClipboardX, Monitor, Split, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { cleanQuizTitle } from '../utils/cleanTitle';

const playPopSound = () => {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
        // Safe catch for autoplay blocks
    }
};

export default function LiveRoomStudent() {
    const { joinCode } = useParams();
    const { user, theme } = useContext(AuthContext);
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const [participants, setParticipants] = useState([]);
    const [displayCount, setDisplayCount] = useState(0);
    const [lobbySummary, setLobbySummary] = useState('');

    // Theme-based custom icons
    const getThemeIcon = () => {
        switch (theme) {
            case 'imperial':
                return Crown;
            case 'drakor':
                return Flame;
            case 'celestial':
            default:
                return Trophy;
        }
    };

    const ThemeIcon = getThemeIcon();

    // Fetch Quiz on Mount / joinCode change
    useEffect(() => {
        if (!joinCode || joinCode === 'undefined') {
            navigate('/student-dashboard');
            return;
        }

        const fetchQuiz = async () => {
            try {
                const res = await api.post('/quiz/join', { code: joinCode });
                const quizRes = await api.get(`/quiz/${res.data.quizId}`);
                setQuiz(quizRes.data);

                if (!quizRes.data.isLive || quizRes.data.status === 'started') {
                    navigate(`/quiz/attempt/${quizRes.data.id}`);
                    return;
                }

                const token = localStorage.getItem('token');
                let studentId = null;
                if (token) {
                    try { studentId = JSON.parse(atob(token.split('.')[1])).user.id; } catch (_) { }
                }
                
                const sessionData = {
                    quizId: quizRes.data.id,
                    username: user.username,
                    role: 'student',
                    _id: studentId || user.id
                };
                localStorage.setItem(`live_quiz_session_student_${quizRes.data.id}`, JSON.stringify(sessionData));
                ensureSocketConnected();
                socket.emit('join_room', { quizId: quizRes.data.id, user: { username: user.username, role: 'student', _id: studentId || user.id } });

            } catch (err) {
                console.error('[LiveRoomStudent] Error initializing quiz join:', err);
                navigate('/student-dashboard');
            } finally {
                setTimeout(() => setLoading(false), 800); // Small delay for smooth transition
            }
        };

        fetchQuiz();
    }, [joinCode, user, navigate]);

    // Socket connection listeners bound when quiz is initialized
    useEffect(() => {
        if (!quiz) return;

        ensureSocketConnected();

        const handleQuizStarted = () => {
            console.log('[LiveRoomStudent] Quiz started event received from server. Navigating to arena...');
            navigate(`/quiz/attempt/${quiz.id}`);
        };

        const handleConnect = () => {
            if (user) {
                console.log('[LiveRoomStudent] Socket connected. Emitting join_room / reconnectUser...');
                ensureSocketConnected();
                const sessionStr = localStorage.getItem(`live_quiz_session_student_${quiz.id}`);
                if (sessionStr) {
                    try {
                        const sess = JSON.parse(sessionStr);
                        socket.emit('reconnectUser', { quizId: sess.quizId, user: { username: sess.username, role: sess.role, _id: sess._id } });
                    } catch (e) {
                        socket.emit('join_room', { quizId: quiz.id, user: { username: user.username, role: 'student', _id: user.id } });
                    }
                } else {
                    socket.emit('join_room', { quizId: quiz.id, user: { username: user.username, role: 'student', _id: user.id } });
                }
            }
        };

        const handleParticipantsUpdate = (participantsList = []) => {
            console.log('[LiveRoomStudent] participants_update:', participantsList);
            setParticipants(participantsList);
        };

        const handleLobbySummaryUpdate = ({ lobbySummary }) => {
            console.log('[LiveRoomStudent] received lobby study summary update:', lobbySummary);
            setLobbySummary(lobbySummary);
        };

        const handleErrorAlert = (data) => {
            console.error('[LiveRoomStudent] Socket Error Alert:', data);
            toast.error(data?.msg || 'Socket connection issue');
        };

        const handleConnectError = (err) => {
            console.error('[LiveRoomStudent] Socket Connect Error:', err);
            toast.error('Unable to connect to live room. Retrying...');
        };

        socket.on('quiz_started', handleQuizStarted);
        socket.on('connect', handleConnect);
        socket.on('participants_update', handleParticipantsUpdate);
        socket.on('lobby_summary_update', handleLobbySummaryUpdate);
        socket.on('error_alert', handleErrorAlert);
        socket.on('connect_error', handleConnectError);
        socket.on('restoreState', (state) => {
            console.log('[LiveRoomStudent] restoreState:', state);
            if (state && state.participants) {
                setParticipants(state.participants);
            }
            if (!quiz) return;
            if (state.quizStatus === 'started') {
                navigate(`/quiz/attempt/${quiz.id}`);
            }
        });

        // If socket is already connected when this effect runs, re-join immediately.
        if (socket.connected) {
            handleConnect();
        } else {
            ensureSocketConnected();
        }

        return () => {
            socket.emit('leave_room', { quizId: quiz.id });
            socket.off('quiz_started', handleQuizStarted);
            socket.off('connect', handleConnect);
            socket.off('restoreState');
            socket.off('participants_update', handleParticipantsUpdate);
            socket.off('lobby_summary_update', handleLobbySummaryUpdate);
            socket.off('error_alert', handleErrorAlert);
            socket.off('connect_error', handleConnectError);
        };
    }, [quiz, user, navigate]);

   useEffect(() => {
    if (!quiz || !user) return;

    const sendHeartbeat = () => {
        if (socket.connected) {
            socket.emit('heartbeat', {
                quizId: quiz.id,
                userId: user.id
            });
        }
    };

    sendHeartbeat();

    const heartbeatId = setInterval(sendHeartbeat, 3000);

    return () => clearInterval(heartbeatId);
}, [quiz, user]);

    // Filter online students (case-insensitive role check)
    const onlineStudents = useMemo(() => {
        return participants.filter(p => p.role?.toLowerCase() === 'student' && p.isOnline !== false);
    }, [participants]);

    const actualCount = onlineStudents.length;

    // Smooth count increment & pop sound effect
    useEffect(() => {
        if (actualCount > displayCount) {
            const diff = actualCount - displayCount;
            const delay = diff > 3 ? 50 : 300;
            const timer = setTimeout(() => {
                setDisplayCount(prev => {
                    const next = prev + 1;
                    if (prev > 0 && diff <= 3) {
                        playPopSound();
                    }
                    return next;
                });
            }, delay);
            return () => clearTimeout(timer);
        } else if (actualCount < displayCount) {
            setDisplayCount(actualCount);
        }
    }, [actualCount, displayCount]);

    // Calculate ready and joining counts based on displayCount
    const { readyCount, joiningCount } = useMemo(() => {
        const now = Date.now();
        // Filter students who joined in the last 12 seconds
        const actualJoining = onlineStudents.filter(p => {
            const joinedTime = p.joinedAt ? new Date(p.joinedAt).getTime() : now;
            return now - joinedTime < 12000;
        }).length;

        const actualReady = Math.max(0, actualCount - actualJoining);

        // Distribute displayCount proportionally
        const ready = Math.min(displayCount, actualReady);
        const joining = displayCount - ready;

        return { readyCount: ready, joiningCount: joining };
    }, [onlineStudents, actualCount, displayCount]);

    if (loading) return <WaitingRoomLoader message="Joining Quiz..." />;

    return (
        <DashboardLayout role="student">
            <div className="max-w-4xl mx-auto py-12 relative">
                {/* Background Flair */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[var(--bg-accent)]/5 rounded-full blur-[120px] pointer-events-none -z-10" />

                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[var(--bg-secondary)] rounded-[3rem] shadow-2xl border border-[var(--border-color)] overflow-hidden"
                >
                    {/* Hero Header */}
                    <div className="bg-gradient-to-br from-slate-50 via-indigo-50/60 to-white text-[#0f172a] p-8 sm:p-14 text-center relative overflow-hidden border-b border-[var(--border-color)]">
                        {/* Decorative animated rings */}
                        <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                            className="absolute -top-20 -right-20 w-80 h-80 border-2 border-slate-300/30 rounded-full"
                        />
                        <motion.div 
                            animate={{ rotate: -360 }}
                            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                            className="absolute -bottom-20 -left-20 w-60 h-60 border border-slate-300/30 rounded-full"
                        />

                        <motion.div
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="relative z-10 space-y-6"
                        >
                            <div 
                                className="p-4 rounded-2xl border-2 inline-block shadow-lg mb-2 backdrop-blur-md transition-all duration-500 hover:scale-105"
                                style={{
                                    borderColor: 'rgba(217, 119, 6, 0.3)',
                                    boxShadow: '0 0 25px rgba(245, 158, 11, 0.2)',
                                    backgroundColor: '#ffffff',
                                    color: '#d97706'
                                }}
                            >
                                <ThemeIcon size={44} className="animate-pulse text-amber-600" />
                            </div>
                            
                            <div className="space-y-4">
                                <motion.div 
                                    animate={{ 
                                        backgroundColor: ["rgba(245, 158, 11, 0.08)", "rgba(245, 158, 11, 0.18)", "rgba(245, 158, 11, 0.08)"]
                                    }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="inline-block px-5 py-2 rounded-full text-xs font-black uppercase tracking-[0.25em] border border-amber-500/40 text-amber-600"
                                >
                                    ● Quiz Arena Active
                                </motion.div>
                                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#0f172a] uppercase italic leading-tight max-w-2xl mx-auto drop-shadow-xs">
                                    {cleanQuizTitle(quiz?.title)}
                                </h1>
                                <p className="text-slate-600 max-w-lg mx-auto font-bold text-base sm:text-lg leading-relaxed">
                                    You're in the waiting room. The quiz will start once your teacher begins the session.
                                </p>
                            </div>
                        </motion.div>
                    </div>

                    {/* Content Body */}
                    <div className="p-8 sm:p-14 space-y-12">
                        <LiveQuizWaitAnimation
                            variant="waiting-room"
                            readyCount={readyCount}
                            joiningCount={joiningCount}
                            detail={joiningCount > 0
                                ? `${readyCount} students ready... ${joiningCount} more joining!`
                                : `${readyCount} ${readyCount === 1 ? 'student' : 'students'} ready!`}
                        />
                        {/* Exam Security Settings Card (No popups during exam; rules displayed in lobby) */}
                        <motion.div 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white border-2 border-slate-200 p-6 sm:p-8 rounded-[2.5rem] text-left text-[#0f172a] shadow-lg space-y-4"
                        >
                            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-600">
                                    <ShieldCheck size={28} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-wider italic text-amber-600">
                                        Proctored Examination Security Rules
                                    </h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                        Automated Real-Time Telemetry & Environment Integrity
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold text-slate-700 pt-1">
                                <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                                    <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600 shrink-0">
                                        <Ban size={18} />
                                    </div>
                                    <span>Right-Click & Inspect Disabled</span>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                                    <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600 shrink-0">
                                        <CameraOff size={18} />
                                    </div>
                                    <span>Screenshots & Recording Blocked</span>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                                    <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600 shrink-0">
                                        <ClipboardX size={18} />
                                    </div>
                                    <span>Ctrl+C & Ctrl+V Copy/Paste Disabled</span>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                                    <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600 shrink-0">
                                        <Monitor size={18} />
                                    </div>
                                    <span>Mandatory Fullscreen Mode Only</span>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                                    <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600 shrink-0">
                                        <Split size={18} />
                                    </div>
                                    <span>No Tab Switching / Split Screen</span>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                                    <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600 shrink-0">
                                        <Lock size={18} />
                                    </div>
                                    <span>DevTools Monitoring Active</span>
                                </div>
                            </div>
                        </motion.div>

                        {lobbySummary && (
                            <motion.div 
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-[var(--bg-secondary)] p-8 rounded-[2rem] border-2 border-[var(--border-color)] text-left space-y-4 shadow-xl"
                            >
                                <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-3">
                                    <Crown className="text-[var(--text-accent)] animate-pulse" size={24} />
                                    <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-wide italic">Pre-Game RAG Study Guide</h3>
                                </div>
                                <div className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed whitespace-pre-line space-y-2">
                                    {lobbySummary}
                                </div>
                            </motion.div>
                        )}

                        {/* Feature Grid with Interactive High-Contrast Badges */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <motion.div 
                                whileHover={{ scale: 1.03, translateY: -2 }}
                                className="bg-white border-2 border-[var(--border-color)] p-6 sm:p-8 rounded-[2.5rem] flex items-center gap-6 text-left shadow-md hover:border-[var(--bg-accent)] transition-all cursor-pointer group"
                            >
                                <div className="bg-emerald-500/10 p-4 rounded-2xl text-emerald-600 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                                    <ShieldCheck size={32} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-1">Security</p>
                                    <p className="text-xl font-black text-emerald-600 uppercase italic">Verified</p>
                                </div>
                            </motion.div>
                            
                            <motion.div 
                                whileHover={{ scale: 1.03, translateY: -2 }}
                                className="bg-white border-2 border-[var(--border-color)] p-6 sm:p-8 rounded-[2.5rem] flex items-center gap-6 text-left shadow-md hover:border-[var(--bg-accent)] transition-all cursor-pointer group"
                            >
                                <div className="bg-[var(--bg-accent)]/10 p-4 rounded-2xl text-[var(--text-accent)] border border-[var(--bg-accent)]/20 group-hover:scale-110 transition-transform">
                                    <Users size={32} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-1">Status</p>
                                    <p className="text-xl font-black text-[var(--text-primary)] uppercase italic">{displayCount} Joined</p>
                                </div>
                            </motion.div>
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="bg-[var(--bg-primary)]/50 p-8 border-t border-[var(--border-color)] text-center">
                        <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.4em] italic opacity-60">
                            Don't refresh this page — you'll lose your spot!
                        </p>
                    </div>
                </motion.div>

                {/* Joining Effect overlay */}
                <AnimatePresence>
                    {loading && (
                        <motion.div 
                            initial={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-[var(--bg-primary)] z-50 flex items-center justify-center"
                        >
                            <WaitingRoomLoader message="Quiz Found!" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </DashboardLayout>
    );
}
