import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import AuthContext from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, Mail, Lock, User, Eye, EyeOff, Loader2, CheckCircle2, XCircle, Brain, Zap, Target, Trophy, Sparkles, BookOpen, ArrowRight, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CinematicBackground from '../components/CinematicBackground';
import { PremiumButton, PremiumInput, GlassCard } from '../components/ui/Primitives';

/* ── Floating background icon ────────────────────────────────────────────── */
const FloatingIcon = ({ Icon, size, top, left, delay, duration }) => (
    <motion.div
        className="floating-icon text-[#0d2d65]"
        style={{ top, left, fontSize: size, color: '#0d2d65' }}
        initial={{ opacity: 0.75, y: 20 }}
        animate={{
            opacity: [0.7, 0.85, 0.95, 0.85, 0.7],
            y: [0, -30, -15, -40, 0],
            x: [0, 10, -5, 8, 0],
            rotate: [0, 8, -5, 10, 0],
        }}
        transition={{
            duration: duration || 12,
            repeat: Infinity,
            delay: delay || 0,
            ease: 'easeInOut',
        }}
    >
        <Icon size={size} strokeWidth={2.4} style={{ color: '#0d2d65', stroke: '#0d2d65' }} />
    </motion.div>
);

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const { login, register } = useContext(AuthContext);
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isColdStart, setIsColdStart] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const coldStartTimer = useRef(null);
    const typingTimer = useRef(null);
    const navigate = useNavigate();

    const [formData, setFormData] = useState({ username: '', email: '', password: '' });
    const { username, email, password } = formData;

    // Floating icons configuration — memoized so they don't re-render
    const floatingIcons = useMemo(() => [
        { Icon: Brain,    size: 36, top: '8%',  left: '8%',  delay: 0,   duration: 14 },
        { Icon: Zap,      size: 28, top: '15%', left: '85%', delay: 2,   duration: 11 },
        { Icon: Target,   size: 32, top: '70%', left: '10%', delay: 1.5, duration: 16 },
        { Icon: Trophy,   size: 30, top: '75%', left: '88%', delay: 3,   duration: 13 },
        { Icon: Sparkles, size: 24, top: '40%', left: '5%',  delay: 4,   duration: 15 },
        { Icon: BookOpen, size: 26, top: '45%', left: '92%', delay: 2.5, duration: 12 },
    ], []);

    // Cleanup cold-start timer on unmount
    useEffect(() => {
        return () => {
            if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
            if (typingTimer.current) clearTimeout(typingTimer.current);
        };
    }, []);

    // ── Wake up Render server the moment the login page loads ─────────────────
    // This silently pings the backend so it starts booting before the user
    // even finishes typing their credentials (free-tier cold-start mitigation)
    useEffect(() => {
        const wakeUp = async () => {
            try {
                const BACKEND = import.meta.env.VITE_API_URL || 'https://quiz-backend-qgro.onrender.com/api';
                await fetch(`${BACKEND}/auth/me`, {
                    method: 'GET',
                    headers: { 'x-auth-token': 'ping' },
                    signal: AbortSignal.timeout(90000),
                });
            } catch {
                // Silently ignore — this is just a warm-up ping
            }
        };
        wakeUp();
    }, []);

    const onChange = e => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (errorMsg) setErrorMsg('');

        // Typing glow effect
        setIsTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setIsTyping(false), 1500);
    };

    const onSubmit = async e => {
        e.preventDefault();
        setIsSubmitting(true);
        setIsColdStart(false);
        setSubmitStatus(null);
        setErrorMsg('');

        // After 5s of waiting, show "server waking up" message
        coldStartTimer.current = setTimeout(() => setIsColdStart(true), 5000);

        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await register(username, email, password);
            }
            clearTimeout(coldStartTimer.current);
            setSubmitStatus('success');
            setTimeout(() => navigate('/'), 800);
        } catch (err) {
            clearTimeout(coldStartTimer.current);
            setIsColdStart(false);
            setSubmitStatus('error');
            const data = err.response?.data;
            let message = 'Access Denied';

            // Timeout / network error — Render cold start likely failed
            if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK' || !err.response) {
                message = 'Server is starting up. Please wait a moment and try again.';
            } else if (data?.msg) {
                message = data.msg;
            } else if (data?.errors?.length) {
                message = data.errors.map(e => e.msg).join('. ');
            } else if (err.message) {
                message = err.message;
            }
            setErrorMsg(message);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-y-auto py-12 sm:py-20 flex flex-col items-center justify-start">
            <CinematicBackground />
            
            {/* Floating Academic Icons */}
            {floatingIcons.map((icon, i) => (
                <FloatingIcon key={i} {...icon} />
            ))}

            <div className="w-full max-w-md px-6 relative z-10 space-y-10 my-auto">
                
                {/* Branding Hierarchy */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center text-center"
                >
                    <motion.div
                        whileHover={{ scale: 1.08, rotate: [0, -2, 2, 0] }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="bg-white p-4 rounded-3xl shadow-lg mb-5 border border-[var(--border-color)] flex items-center justify-center w-20 h-20"
                    >
                        <GraduationCap size={44} className="text-[var(--text-primary)] stroke-[2.2]" />
                    </motion.div>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter text-[var(--text-primary)]">
                        KMIT <span className="text-[var(--text-accent)]">KAHOOT</span>
                    </h1>
                    <p className="text-[var(--text-secondary)] font-bold text-sm tracking-wide mt-1">
                        academic assessment hub
                    </p>
                </motion.div>

                {/* Authentication Card — with typing glow */}
                <GlassCard className={`!p-8 sm:!p-10 shadow-xl relative rounded-[2.5rem] bg-white border border-[var(--border-color)] ${isTyping ? 'is-typing' : ''}`}>
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={isLogin ? 'signin' : 'signup'}
                            initial={{ opacity: 0, x: isLogin ? -10 : 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: isLogin ? 10 : -10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            <h2 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight flex items-center gap-2.5">
                                {isLogin ? <LogIn className="text-[var(--text-primary)]" size={20} /> : <UserPlus className="text-[var(--text-primary)]" size={20} />}
                                {isLogin ? 'sign in' : 'create account'}
                            </h2>

                            <form onSubmit={onSubmit} className="space-y-5">
                                {!isLogin && (
                                    <PremiumInput
                                        label="Username"
                                        name="username"
                                        placeholder="Enter your username"
                                        value={username}
                                        onChange={onChange}
                                        icon={User}
                                        required
                                    />
                                )}

                                <PremiumInput
                                    label="roll number / email"
                                    name="email"
                                    placeholder="teacher1"
                                    value={email}
                                    onChange={onChange}
                                    icon={Mail}
                                    required
                                />

                                <PremiumInput
                                    label="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={onChange}
                                    icon={Lock}
                                    endIcon={showPassword ? EyeOff : Eye}
                                    onEndIconClick={() => setShowPassword(!showPassword)}
                                    required
                                />

                                {errorMsg && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-bold p-4 rounded-xl flex items-center gap-3"
                                    >
                                        <XCircle size={16} /> {errorMsg}
                                    </motion.div>
                                )}

                                <motion.button
                                    whileHover={{ scale: 1.02, y: -1 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="relative w-full py-4 rounded-2xl text-white font-extrabold text-sm tracking-wider shadow-lg transition-all duration-300 overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                                    style={{
                                        background: 'var(--bg-accent)',
                                        color: 'var(--text-on-accent)'
                                    }}
                                >
                                    {/* Subtle Theme Shimmer Sweep Animation */}
                                    <motion.div 
                                        animate={{ x: ['-100%', '200%'] }}
                                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 pointer-events-none"
                                    />

                                    {/* Button Content */}
                                    <div className="relative z-10 flex items-center justify-center gap-3 text-white">
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin text-white" />
                                                <span className="text-white font-bold" style={{ color: '#ffffff' }}>
                                                    {isColdStart ? 'waking up server...' : 'verifying credentials...'}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-white font-bold" style={{ color: '#ffffff' }}>
                                                    {isLogin ? 'sign in' : 'create account'}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </motion.button>

                                {isColdStart && isSubmitting && (
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-xs font-bold text-amber-700 text-center"
                                    >
                                        Free-tier server is booting up — this can take up to 60 seconds
                                    </motion.p>
                                )}
                            </form>

                            <div className="pt-5 border-t border-slate-200 text-center">
                                <button 
                                    onClick={() => setIsLogin(!isLogin)}
                                    className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-accent)] transition-all"
                                >
                                    {isLogin ? (
                                        <>don't have an account? <span className="text-[var(--text-primary)] font-extrabold">sign up</span></>
                                    ) : (
                                        <>already have an account? <span className="text-[var(--text-primary)] font-extrabold">sign in</span></>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </GlassCard>

                {/* Infrastructure Tag */}
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.5em] text-[var(--text-secondary)]/70 italic">
                    Academic Management Infrastructure v1.0
                </p>
            </div>
        </div>
    );
}
