import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import socket from '../utils/socket';
import DashboardLayout from '../components/DashboardLayout';
import AuthContext from '../context/AuthContext';
import WaitingRoomLoader from '../components/loaders/WaitingRoomLoader';
import { Zap, Clock, ShieldCheck, Activity, Users, ArrowRight } from 'lucide-react';

export default function LiveRoomStudent() {
    const { joinCode } = useParams();
    const { user } = useContext(AuthContext);
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const res = await api.post('/quiz/join', { code: joinCode });
                const quizRes = await api.get(`/quiz/${res.data.quizId}`);
                setQuiz(quizRes.data);

                if (quizRes.data.status === 'started') {
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
                alert('Error joining room');
                navigate('/student-dashboard');
            } finally {
                setTimeout(() => setLoading(false), 800); // Small delay for smooth transition
            }
        };

        fetchQuiz();

        socket.on('quiz_started', () => {
            if (quiz) {
                navigate(`/quiz/attempt/${quiz.id}`);
            }
        });

        socket.on('connect', () => {
            if (quiz && user) {
                const sessionStr = localStorage.getItem(`live_quiz_session_student_${quiz.id}`);
                if (sessionStr) {
                    try {
                        const sess = JSON.parse(sessionStr);
                        socket.emit('reconnectUser', { quizId: sess.quizId, user: { username: sess.username, role: sess.role, _id: sess.id } });
                    } catch (e) {
                        socket.emit('join_room', { quizId: quiz.id, user: { username: user.username, role: 'student', _id: user.id } });
                    }
                } else {
                    socket.emit('join_room', { quizId: quiz.id, user: { username: user.username, role: 'student', _id: user.id } });
                }
            }
        });

        return () => {
            socket.off('quiz_started');
        };
    }, [joinCode, user, navigate, quiz]);

    useEffect(() => {
        if (!quiz || !user) return;
        const heartbeatId = setInterval(() => {
            socket.emit('heartbeat', { quizId: quiz.id, userId: user.id });
        }, 5000);
        return () => clearInterval(heartbeatId);
    }, [quiz, user]);

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
                            <div className="bg-white p-3 rounded-2xl inline-block shadow-2xl mb-4">
                                <Zap className="text-[var(--bg-accent)]" size={48} fill="currentColor" />
                            </div>
                            
                            <div className="space-y-4">
                                <motion.div 
                                    animate={{ 
                                        backgroundColor: ["rgba(215, 172, 40, 0.1)", "rgba(215, 172, 40, 0.3)", "rgba(215, 172, 40, 0.1)"]
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
                            <div className="relative">
                                <motion.div 
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="absolute inset-0 bg-[var(--bg-accent)] rounded-full"
                                />
                                <div className="relative bg-[var(--bg-accent)] p-10 rounded-full shadow-2xl shadow-[var(--bg-accent)]/30">
                                    <Clock className="text-white" size={64} />
                                </div>
                            </div>

                            <div className="space-y-3 text-center">
                                <h3 className="text-4xl font-black text-[var(--text-primary)] uppercase italic tracking-tight">Waiting for Host...</h3>
                                <p className="text-[var(--text-secondary)] font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2">
                                    <Activity size={16} className="text-green-500" />
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
                                    <p className="text-xl font-black text-[var(--text-primary)] uppercase italic">Arena Active</p>
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
