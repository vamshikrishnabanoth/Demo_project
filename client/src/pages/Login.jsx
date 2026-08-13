import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import AuthContext from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, Eye, EyeOff, Loader2, XCircle, Brain, Zap, Target, Trophy, Sparkles, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import CinematicBackground from '../components/CinematicBackground';
import { PremiumInput, GlassCard } from '../components/ui/Primitives';

/* ── Floating background icon ────────────────────────────────────────────── */
const FloatingIcon = ({ Icon, size, top, left, delay, duration }) => (
    <motion.div
        className="floating-icon text-[var(--text-accent)] opacity-40"
        style={{ top, left, fontSize: size }}
        initial={{ opacity: 0.75, y: 20 }}
        animate={{
            opacity: [0.3, 0.5, 0.75, 0.5, 0.3],
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
        <Icon size={size} strokeWidth={2.4} />
    </motion.div>
);

export default function Login() {
    const { login } = useContext(AuthContext);
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isColdStart, setIsColdStart] = useState(false);
    const [, setSubmitStatus] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const coldStartTimer = useRef(null);
    const typingTimer = useRef(null);
    const navigate = useNavigate();

    const [formData, setFormData] = useState({ email: '', password: '' });
    const { email, password } = formData;

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
    // Silently pings the /health endpoint so the backend boots before the user
    // even finishes typing credentials (free-tier cold-start mitigation).
    useEffect(() => {
        const wakeUp = async () => {
            try {
                const BACKEND = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://demoproject-production-1ef2.up.railway.app';
                await fetch(`${BACKEND}/health`, {
                    method: 'GET',
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
            await login(email, password);
            clearTimeout(coldStartTimer.current);
            setSubmitStatus('success');
            setTimeout(() => navigate('/'), 800);
        } catch (err) {
            clearTimeout(coldStartTimer.current);
            setIsColdStart(false);
            setSubmitStatus('error');
            const data = err.response?.data;
            let message = 'Access Denied';

            // Timeout / network error — Render cold start likely failed or timed out
            if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK' || err.name === 'AbortError' || !err.response) {
                message = 'Server cold-start timed out. Please refresh the page or click Sign In again!';
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
        <div className="min-h-[100dvh] bg-[var(--bg-primary)] relative overflow-y-auto py-8 sm:py-16 px-4 flex flex-col items-center justify-center">
            <CinematicBackground />
            
            {/* Floating Academic Icons */}
            {floatingIcons.map((icon, i) => (
                <FloatingIcon key={i} {...icon} />
            ))}

            <div className="w-full max-w-[440px] px-3 sm:px-4 relative z-10 space-y-6 sm:space-y-7 my-auto">
                
                {/* Branding Hierarchy */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center text-center"
                >
                    <motion.div
                        whileHover={{ scale: 1.04 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="bg-white/95 backdrop-blur-md px-5 sm:px-6 py-2.5 rounded-2xl shadow-md border border-[var(--border-color)]/80 flex items-center justify-center h-13 sm:h-14 w-auto mb-3.5"
                    >
                        <img 
                            src="/logo.png" 
                            alt="KMIT Logo" 
                            className="h-full w-auto max-h-9 sm:max-h-10 object-contain" 
                            loading="eager"
                            decoding="async"
                        />
                    </motion.div>
                    <h1 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-[var(--text-primary)]">
                        KMIT <span className="text-[var(--text-accent)]">KAHOOT</span>
                    </h1>
                    <p className="text-[var(--text-secondary)] font-bold text-xs tracking-wide mt-0.5">
                        academic assessment hub
                    </p>
                </motion.div>

                {/* Authentication Card — Professional Executive Standard */}
                <GlassCard className={`!p-6 sm:!p-9 shadow-2xl relative rounded-3xl bg-white/95 backdrop-blur-xl border border-[var(--border-color)]/80 ${isTyping ? 'is-typing' : ''}`}>
                    <div className="space-y-5 sm:space-y-6">
                        {/* Card Header with Icon & Subtitle */}
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-[var(--bg-accent)]/10 text-[var(--text-accent)] shrink-0 border border-[var(--border-color)]/40">
                                <LogIn size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
                                    Enter Your Credentials
                                </h2>
                                <p className="text-xs text-[var(--text-secondary)] font-medium">
                                    Sign in using your roll number to continue.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={onSubmit} className="space-y-4">
                            <PremiumInput
                                label="Roll Number"
                                name="email"
                                placeholder="Enter your roll number"
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
                                    className="bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-bold p-3.5 rounded-xl flex items-center gap-2.5"
                                >
                                    <XCircle size={16} className="shrink-0" /> {errorMsg}
                                </motion.div>
                            )}

                            <motion.button
                                whileHover={{ scale: 1.01, y: -1 }}
                                whileTap={{ scale: 0.99 }}
                                type="submit"
                                disabled={isSubmitting}
                                className="relative w-full py-3.5 rounded-2xl text-white font-extrabold text-sm tracking-wider shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-1"
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
                                <div className="relative z-10 flex items-center justify-center gap-2.5 text-white">
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
                                                sign in
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
                    </div>
                </GlassCard>

                {/* Infrastructure Tag */}
                <p className="text-center text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.3em] sm:tracking-[0.4em] text-[var(--text-secondary)]/70 italic">
                    Academic Management Infrastructure v1.0
                </p>
            </div>
        </div>
    );
}
