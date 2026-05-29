import { useState, useEffect, useContext, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import socket from '../utils/socket';
import DashboardLayout from '../components/DashboardLayout';
import AuthContext from '../context/AuthContext';
import WaitingRoomLoader from '../components/loaders/WaitingRoomLoader';
import LiveQuizWaitAnimation from '../components/loaders/LiveQuizWaitAnimation';
import { ShieldCheck, Users, Trophy, Crown, Flame } from 'lucide-react';

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
                socket.emit('join_room', { quizId: quizRes.data.id, user: { username: user.username, role: 'student', _id: studentId || user.id } });

            } catch (err) {
                console.error(err);
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

        const handleQuizStarted = () => {
            navigate(`/quiz/attempt/${quiz.id}`);
        };

        const handleConnect = () => {
            if (user) {
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
            console.log('Student participants_update:', participantsList);
            setParticipants(participantsList);
        };

        socket.on('quiz_started', handleQuizStarted);
        socket.on('connect', handleConnect);
        socket.on('participants_update', handleParticipantsUpdate);
        socket.on('restoreState', (state) => {
            console.log('Student restoreState:', state);
            if (state && state.participants) {
                setParticipants(state.participants);
            }
            if (!quiz) return;
            if (state.quizStatus === 'started') {
                navigate(`/quiz/attempt/${quiz.id}`);
            }
        });

        // If socket is already connected when this effect runs, re-join immediately.
        // The 'connect' event won't fire again for an existing live connection.
        if (socket.connected) {
            handleConnect();
        }

        return () => {
            socket.emit('leave_room', { quizId: quiz.id });
            socket.off('quiz_started', handleQuizStarted);
            socket.off('connect', handleConnect);
            socket.off('restoreState');
            socket.off('participants_update', handleParticipantsUpdate);
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

    // Filter online students
    const onlineStudents = useMemo(() => {
        return participants.filter(p => p.role === 'student' && p.isOnline);
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
                    <div className="bg-gradient-to-br from-indigo-900 via-[var(--bg-secondary)] to-[var(--bg-primary)] p-16 text-center relative overflow-hidden border-b border-[var(--border-color)]">
                        {/* Decorative animated rings */}
                        <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                            className="absolute -top-20 -right-20 w-80 h-80 border-2 border-[var(--bg-accent)]/10 rounded-full"
                        />
                        <motion.div 
                            animate={{ rotate: -360 }}
                            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                            className="absolute -bottom-20 -left-20 w-60 h-60 border border-[var(--bg-accent)]/10 rounded-full"
                        />

                        <motion.div
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="relative z-10 space-y-8"
                        >
                            <div 
                                className="p-4.5 rounded-[1.8rem] border-2 inline-block shadow-2xl mb-4 backdrop-blur-md transition-all duration-500 hover:scale-105 active:scale-95"
                                style={{
                                    borderColor: 'var(--border-color)',
                                    boxShadow: '0 0 35px var(--bg-accent-glow)',
                                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                    color: 'var(--text-accent)'
                                }}
                            >
                                <ThemeIcon size={48} className="animate-pulse" />
                            </div>
                            
                            <div className="space-y-4">
                                <motion.div 
                                    animate={{ 
                                        backgroundColor: ["var(--table-row-hover)", "var(--bg-accent-glow)", "var(--table-row-hover)"]
                                    }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="inline-block px-6 py-2 rounded-full text-xs font-black uppercase tracking-[0.3em] border border-[var(--bg-accent)]/30 text-[var(--text-accent)]"
                                >
                                    ● Quiz is Ready
                                </motion.div>
                                <h1 className="text-6xl font-black tracking-tighter text-[var(--text-primary)] uppercase italic leading-none">
                                    {quiz?.title}
                                </h1>
                                <p className="text-[var(--text-secondary)] max-w-lg mx-auto font-bold text-lg leading-relaxed">
                                    You're in the waiting room. The quiz will start once your teacher begins the session.
                                </p>
                            </div>
                        </motion.div>
                    </div>

                    {/* Content Body */}
                    <div className="p-16 space-y-16">
                        <LiveQuizWaitAnimation
                            variant="waiting-room"
                            readyCount={readyCount}
                            joiningCount={joiningCount}
                            detail={joiningCount > 0
                                ? `${readyCount} students ready... ${joiningCount} more joining!`
                                : `${readyCount} ${readyCount === 1 ? 'student' : 'students'} ready!`}
                        />
                        {/* Feature Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <motion.div 
                                whileHover={{ scale: 1.02 }}
                                className="bg-[var(--glass-bg)] p-8 rounded-[2rem] border border-[var(--border-color)] flex items-center gap-6 text-left"
                            >
                                <div className="bg-green-500/10 p-4 rounded-2xl text-green-400">
                                    <ShieldCheck size={32} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-1">Security</p>
                                    <p className="text-xl font-black text-[var(--text-primary)] uppercase italic">Verified</p>
                                </div>
                            </motion.div>
                            
                            <motion.div 
                                whileHover={{ scale: 1.02 }}
                                className="bg-[var(--glass-bg)] p-8 rounded-[2rem] border border-[var(--border-color)] flex items-center gap-6 text-left"
                            >
                                <div className="bg-[var(--bg-accent)]/10 p-4 rounded-2xl text-[var(--text-accent)]">
                                    <Users size={32} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-1">Status</p>
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
