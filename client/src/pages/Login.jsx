import React, { useState, useContext } from 'react';
import AuthContext from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, Mail, Lock, User, Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CinematicBackground from '../components/CinematicBackground';
import { PremiumButton, PremiumInput, GlassCard } from '../components/ui/Primitives';

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const { login, register } = useContext(AuthContext);
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();

    const [formData, setFormData] = useState({ username: '', email: '', password: '' });
    const { username, email, password } = formData;

    const onChange = e => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (errorMsg) setErrorMsg('');
    };

    const onSubmit = async e => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);
        setErrorMsg('');

        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await register(username, email, password);
            }
            setSubmitStatus('success');
            setTimeout(() => navigate('/'), 800);
        } catch (err) {
            setSubmitStatus('error');
            const data = err.response?.data;
            let message = 'Access Denied';
            if (data?.msg) {
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
            
            <div className="w-full max-w-md px-6 relative z-10 space-y-12 my-auto">
                
                {/* Branding Hierarchy */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center"
                >
                    <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-2xl mb-6 border border-white/20 p-3">
                        <img 
                            src="/logo.png" 
                            alt="KMIT Logo" 
                            className="w-full h-full object-contain" 
                            loading="eager"
                            decoding="async"
                        />
                    </div>
                    <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter drop-shadow-[0_0_15px_var(--bg-accent-glow)]">
                        KMIT <span className="text-[var(--text-accent)]">KAHOOT</span>
                    </h1>
                    <p className="text-[var(--text-secondary)] font-black uppercase tracking-[0.4em] text-[9px] mt-2 opacity-70">Academic Assessment Hub</p>
                </motion.div>

                {/* Authentication Card */}
                <GlassCard className="!p-8 sm:!p-10 shadow-2xl relative">
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={isLogin ? 'signin' : 'signup'}
                            initial={{ opacity: 0, x: isLogin ? -10 : 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: isLogin ? 10 : -10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-8"
                        >
                            <h2 className="text-2xl font-black text-white italic uppercase tracking-tight flex items-center gap-3">
                                {isLogin ? <LogIn className="text-[var(--text-accent)]" /> : <UserPlus className="text-[var(--text-accent)]" />}
                                {isLogin ? 'Sign In' : 'Create Account'}
                            </h2>

                            <form onSubmit={onSubmit} className="space-y-6">
                                {!isLogin && (
                                    <PremiumInput
                                        label="Username"
                                        name="username"
                                        placeholder="Username"
                                        value={username}
                                        onChange={onChange}
                                        icon={User}
                                        required
                                    />
                                )}

                                <PremiumInput
                                    label="Roll Number / Email"
                                    name="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={onChange}
                                    icon={Mail}
                                    required
                                />

                                <PremiumInput
                                    label="Password"
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
                                        className="bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest p-4 rounded-xl flex items-center gap-3"
                                    >
                                        <XCircle size={16} /> {errorMsg}
                                    </motion.div>
                                )}

                                <PremiumButton
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-5"
                                    icon={isSubmitting ? Loader2 : (submitStatus === 'success' ? CheckCircle2 : LogIn)}
                                >
                                    {isSubmitting ? 'VERIFYING...' : (isLogin ? 'SIGN IN' : 'INITIALIZE')}
                                </PremiumButton>
                            </form>

                            <div className="pt-6 border-t border-white/5 text-center">
                                <button 
                                    onClick={() => setIsLogin(!isLogin)}
                                    className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] hover:text-[var(--text-accent)] transition-all"
                                >
                                    {isLogin ? "Need new clearance? Sign up" : "Existing identity? Sign in"}
                                </button>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </GlassCard>

                {/* Infrastructure Tag */}
                <p className="text-center text-[9px] font-black uppercase tracking-[0.6em] text-white/50 italic">
                    Academic Management Infrastructure v1.0
                </p>
            </div>
        </div>
    );
}
