import { useState, useEffect, useContext, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
    Trophy, Play, Users, Star, ArrowRight, Target, Sparkles, 
    Zap, Rocket, Globe, Brain, Cpu, MessageSquare, Clock, BarChart3, ChevronRight, Search, LayoutGrid
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import CinematicBackground from '../components/CinematicBackground';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { showConfirm, showSuccess, showError } from '../utils/alerts';
import toast from 'react-hot-toast';
import socket from '../utils/socket';
import { uiTerminology } from '../utils/uiTerminology';

const FloatingSymbol = ({ Icon, top, left, delay, size = 32 }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ 
            opacity: [0.1, 0.3, 0.1],
            y: [0, -20, 0],
            rotate: [0, 10, -10, 0]
        }}
        transition={{ 
            duration: 8 + Math.random() * 4, 
            repeat: Infinity, 
            delay,
            ease: "easeInOut"
        }}
        className="absolute pointer-events-none text-white/5"
        style={{ top, left }}
    >
        <Icon size={size} />
    </motion.div>
);

export default function StudentDashboard() {
    const { user } = useContext(AuthContext);
    const [joinCode, setJoinCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [error, setError] = useState(false);
    const navigate = useNavigate();
    const controls = useAnimation();
    const inputRef = useRef(null);
    const isSmallScreen = useMediaQuery('(max-width: 767px)');
    
    const maxChars = 6;

    useEffect(() => {
        if (user?.id) {
            socket.emit('identify', user.id);
        }
    }, [user]);

    const handleJoin = async () => {
        if (joinCode.length !== maxChars) return;
        setIsSubmitting(true);
        try {
            const res = await api.post('/quiz/join', { code: joinCode });
            toast.success('Connection established!', {
                style: {
                    background: '#161618',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '1rem',
                    fontFamily: 'Inter'
                }
            });
            if (res.data.isLive) {
                setTimeout(() => navigate(`/live-room-student/${joinCode}`), 1000);
            } else {
                setTimeout(() => navigate(`/quiz/attempt/${res.data.quizId}`), 1000);
            }
        } catch (err) {
            setError(true);
            toast.error(err.response?.data?.msg || 'Neural link failed', {
                style: {
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '1rem',
                    fontFamily: 'Inter'
                }
            });
            controls.start({
                x: [-10, 10, -10, 10, 0],
                transition: { duration: 0.4 }
            });
            setJoinCode('');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDirectJoin = async (pin) => {
        setJoinCode(pin);
        toast.success('Direct Sync link established! Synchronizing with the Arena...', {
            style: {
                background: '#161618',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '1rem',
                fontFamily: 'Inter'
            }
        });
        
        setIsSubmitting(true);
        try {
            const res = await api.post('/quiz/join', { code: pin });
            toast.success('Connection established!', {
                style: {
                    background: '#161618',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '1rem',
                    fontFamily: 'Inter'
                }
            });
            if (res.data.isLive) {
                setTimeout(() => navigate(`/live-room-student/${pin}`), 1000);
            } else {
                setTimeout(() => navigate(`/quiz/attempt/${res.data.quizId}`), 1000);
            }
        } catch (err) {
            setError(true);
            toast.error(err.response?.data?.msg || 'Neural link failed', {
                style: {
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '1rem',
                    fontFamily: 'Inter'
                }
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DashboardLayout role="student">
            <div className="relative min-h-[75vh] flex items-center justify-center py-10 font-inter overflow-hidden">
                
                {/* ─── AMBIENT DECORATIONS ─────────────────────────────────── */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <FloatingSymbol Icon={Cpu} top="15%" left="10%" delay={0} size={isSmallScreen ? 24 : 40} />
                    <FloatingSymbol Icon={Globe} top="25%" left="85%" delay={2} size={isSmallScreen ? 20 : 32} />
                    {!isSmallScreen && (
                        <>
                            <FloatingSymbol Icon={Rocket} top="70%" left="15%" delay={4} />
                            <FloatingSymbol Icon={Brain} top="65%" left="80%" delay={1} />
                        </>
                    )}
                </div>

                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full max-w-2xl space-y-12 text-center relative z-10 px-6"
                >
                    {/* Header System */}
                    <div className="space-y-6">
                        <motion.div 
                            whileHover={{ scale: 1.1, rotate: 360 }}
                            transition={{ duration: 1, ease: "anticipate" }}
                            className="w-24 h-24 bg-[var(--bg-accent)]/10 rounded-[2rem] border-2 border-[var(--bg-accent)]/30 flex items-center justify-center text-[var(--text-accent)] mx-auto mb-6 relative shadow-[0_0_30px_var(--bg-accent-glow)] group cursor-pointer"
                        >
                            <div className="absolute inset-0 bg-[var(--bg-accent)] rounded-[2rem] blur-xl opacity-0 group-hover:opacity-40 transition-opacity" />
                            <Trophy size={48} className="relative z-10" />
                        </motion.div>
                        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white italic uppercase tracking-tighter leading-tight text-balance">
                            ENTER THE <span className="text-[var(--text-accent)] drop-shadow-[0_0_20px_var(--bg-accent-glow)]">QUIZ CODE</span>
                        </h1>
                        <p className="text-[var(--text-secondary)] font-black uppercase tracking-[0.5em] text-[10px] max-w-sm mx-auto opacity-50 text-balance">
                            Type your 6-digit quiz code to join
                        </p>
                    </div>

                    <div className="relative max-w-lg mx-auto">
                        <motion.div 
                            animate={controls}
                            className="relative flex justify-center gap-2 md:gap-4 cursor-pointer py-10 px-6 md:px-10 bg-white/[0.02] backdrop-blur-2xl rounded-[3rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] group"
                            onClick={() => inputRef.current?.focus()}
                        >
                            {/* Hidden Native Input */}
                            <input
                                ref={inputRef}
                                type="text"
                                maxLength={maxChars}
                                value={joinCode}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').toUpperCase();
                                    setJoinCode(val);
                                    if (error) setError(false);
                                }}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50"
                                autoFocus
                            />

                            {[...Array(maxChars)].map((_, i) => {
                                const isActive = i === joinCode.length && isFocused;
                                const isFilled = i < joinCode.length;
                                
                                return (
                                    <motion.div
                                        key={`box-${i}`}
                                        initial={false}
                                        animate={{
                                            scale: isActive ? 1.08 : 1,
                                            borderColor: isActive ? 'var(--bg-accent)' : isFilled ? 'var(--bg-accent)' : 'rgba(255,255,255,0.1)',
                                            backgroundColor: isActive ? 'rgba(255,255,255,0.05)' : isFilled ? 'rgba(255,255,255,0.02)' : 'transparent',
                                            boxShadow: isActive ? '0 0 25px var(--bg-accent-glow)' : 'none'
                                        }}
                                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                        className="w-10 md:w-14 h-16 md:h-22 rounded-2xl border-2 backdrop-blur-md flex items-center justify-center relative overflow-hidden transition-colors"
                                    >
                                        {/* Character Animation */}
                                        <AnimatePresence mode="popLayout">
                                            {joinCode[i] ? (
                                                <motion.span
                                                    key={`char-${i}-${joinCode[i]}`}
                                                    initial={{ opacity: 0, scale: 2, y: 10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                                    className="text-2xl md:text-4xl font-black text-white italic tracking-tighter z-10"
                                                >
                                                    {joinCode[i]}
                                                </motion.span>
                                            ) : (
                                                isActive && (
                                                    <motion.div 
                                                        animate={{ opacity: [1, 0, 1] }}
                                                        transition={{ duration: 1, repeat: Infinity }}
                                                        className="w-0.5 md:w-1 h-8 md:h-12 bg-[var(--bg-accent)] rounded-full"
                                                    />
                                                )
                                            )}
                                        </AnimatePresence>
                                        
                                        {/* Internal Highlight (Impactful) */}
                                        <AnimatePresence>
                                            {isFilled && (
                                                <motion.div 
                                                    key="fill-glow"
                                                    initial={{ opacity: 0, scale: 0 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0 }}
                                                    className="absolute inset-0 bg-gradient-to-t from-[var(--bg-accent)]/10 to-transparent pointer-events-none"
                                                />
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    </div>

                    {/* Action System */}
                    <div className="space-y-8 max-w-sm mx-auto">
                        <button
                            onClick={() => handleJoin()}
                            disabled={joinCode.length !== maxChars || isSubmitting}
                            className={`w-full h-20 rounded-[2rem] font-black text-xl italic uppercase tracking-[0.3em] flex items-center justify-center gap-4 transition-all duration-500 btn-cinematic btn-glow
                                ${joinCode.length === maxChars && !isSubmitting
                                    ? 'bg-[var(--bg-accent)] text-[var(--text-on-accent)] shadow-[0_20px_40px_var(--bg-accent-glow)]' 
                                    : 'bg-white/[0.03] text-white/10 border border-white/5 cursor-not-allowed'}`}
                        >
                            {isSubmitting ? (
                                <Zap className="animate-spin" size={24} />
                            ) : (
                                <>
                                    <Sparkles size={24} className={joinCode.length === maxChars ? 'animate-pulse' : ''} />
                                    {uiTerminology.deployToArena.toUpperCase()}
                                </>
                            )}
                        </button>
                    </div>

                </motion.div>
            </div>
        </DashboardLayout>
    );
}
