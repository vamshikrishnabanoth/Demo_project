import { useState, useEffect, useContext, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import socket from '../utils/socket';
import DashboardLayout from '../components/DashboardLayout';
import AuthContext from '../context/AuthContext';
import WaitingRoomLoader from '../components/loaders/WaitingRoomLoader';
import { Zap, Clock, ShieldCheck, Activity, Users, ArrowRight, Trophy, Crown, Flame, Sparkles } from 'lucide-react';

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
                        <div className="flex flex-col items-center gap-8">
                            <div className="relative w-64 h-64 flex items-center justify-center">
                                {/* Ambient backdrop glow */}
                                <motion.div
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.15, 0.4, 0.15] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                                    className="absolute inset-0 bg-[var(--bg-accent)]/10 rounded-full blur-3xl pointer-events-none"
                                />

                                {/* 1. Outer Morphing Geometric Portal Ring */}
                                <motion.div
                                    animate={{ 
                                        rotate: 360,
                                        borderRadius: ["40% 60% 70% 30% / 40% 50% 60% 50%", "70% 30% 50% 50% / 50% 30% 70% 50%", "40% 60% 70% 30% / 40% 50% 60% 50%"]
                                    }}
                                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 border border-[var(--bg-accent)]/20 bg-[var(--bg-accent)]/[0.02]"
                                    style={{
                                        boxShadow: '0 0 40px var(--bg-accent-glow) inset'
                                    }}
                                />

                                {/* 2. Intermediary Orbiting Hexagonal Frame */}
                                <motion.div
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-6 rounded-[2rem] border border-dashed border-[var(--text-accent)]/30"
                                />

                                {/* 3. Inner Scanning Ring */}
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-10 rounded-full border border-white/5 border-t-[var(--bg-accent)]"
                                />

                                {/* 4. High-frequency Conic Radar Wavefront */}
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-12 rounded-full origin-center"
                                    style={{
                                        background: 'conic-gradient(from 0deg, var(--bg-accent) 0deg, transparent 180deg)',
                                        opacity: 0.15
                                    }}
                                />

                                {/* 5. Interactive Holographic Pulsing Glass Core */}
                                <motion.div
                                    animate={{ 
                                        y: [0, -8, 0],
                                        boxShadow: [
                                            '0 0 25px var(--bg-accent-glow), inset 0 0 15px rgba(255,255,255,0.1)',
                                            '0 0 50px var(--bg-accent-glow), inset 0 0 25px rgba(255,255,255,0.2)',
                                            '0 0 25px var(--bg-accent-glow), inset 0 0 15px rgba(255,255,255,0.1)'
                                        ]
                                    }}
                                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                                    className="w-24 h-24 rounded-full bg-gradient-to-tr from-[var(--bg-accent)] to-[var(--text-accent)]/80 flex items-center justify-center relative border border-white/10 z-10 hover:scale-105 active:scale-95 transition-all duration-300 group cursor-pointer"
                                >
                                    {/* Rotating Hourglass / Timer Hands */}
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                                    >
                                        <Clock className="text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)]" size={36} />
                                    </motion.div>
                                    
                                    {/* Glass reflection shine overlay */}
                                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 via-transparent to-transparent pointer-events-none" />
                                </motion.div>

                                {/* 6. Constellation Quantum Satellite Nodes */}
                                {[...Array(4)].map((_, idx) => (
                                    <motion.div
                                        key={idx}
                                        className="absolute w-2.5 h-2.5 rounded-full bg-[var(--text-accent)]"
                                        style={{ 
                                            boxShadow: '0 0 12px var(--bg-accent-glow)'
                                        }}
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 4 + idx * 2, repeat: Infinity, ease: 'linear' }}
                                        transformTemplate={({ rotate }) =>
                                            `rotate(${rotate}) translateX(${100 + idx * 8}px) rotate(-${rotate})`
                                        }
                                    />
                                ))}
                            </div>

                            <div className="space-y-6 text-center flex flex-col items-center">
                                <h3 className="text-4xl font-black text-[var(--text-primary)] uppercase italic tracking-tight">Waiting for Host...</h3>
                                
                                {/* Live Joining Count */}
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={displayCount}
                                        initial={{ scale: 0.9, opacity: 0, y: 10 }}
                                        animate={{ scale: [0.9, 1.05, 1], opacity: 1, y: 0 }}
                                        exit={{ scale: 0.9, opacity: 0, y: -10 }}
                                        transition={{ type: 'spring', stiffness: 450, damping: 15 }}
                                        className="inline-flex items-center gap-3 bg-[var(--table-row-hover)] px-8 py-4 rounded-3xl border border-[var(--bg-accent)]/20 text-[var(--text-accent)] shadow-[0_0_30px_var(--bg-accent-glow)] backdrop-blur-md"
                                    >
                                        <Users size={20} className="animate-pulse text-[var(--text-accent)]" />
                                        <span className="font-black uppercase tracking-wider text-sm">
                                            {joiningCount > 0 
                                                ? `${readyCount} students ready… ${joiningCount} more joining!` 
                                                : `${readyCount} ${readyCount === 1 ? 'student' : 'students'} ready!`}
                                        </span>
                                    </motion.div>
                                </AnimatePresence>

                                <p className="text-[var(--text-secondary)] font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2">
                                    <Activity size={16} className="text-green-500 animate-pulse" />
                                    Waiting for your teacher to start
                                </p>
                            </div>
                        </div>

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
