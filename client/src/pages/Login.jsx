import React, { useState, useContext } from 'react';
import AuthContext from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, Mail, Lock, User, Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import CinematicBackground from '../components/CinematicBackground';

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const { login, register } = useContext(AuthContext);
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null); // 'success' | 'error'
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();
    const controls = useAnimation();

    // Premium Mouse Parallax State
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const handleMouseMove = (e) => {
        const { clientX, clientY } = e;
        const x = (clientX - window.innerWidth / 2) / (window.innerWidth / 2);
        const y = (clientY - window.innerHeight / 2) / (window.innerHeight / 2);
        setMousePos({ x, y });
    };

    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: ''
    });

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
                setSubmitStatus('success');
                setTimeout(() => navigate('/'), 1000);
            } else {
                await register(username, email, password);
                setSubmitStatus('success');
                setTimeout(() => navigate('/'), 1000);
            }
        } catch (err) {
            console.error('Login/Signup error:', err);
            const msg = err.response?.data?.msg || err.message || 'An error occurred';
            setSubmitStatus('error');
            setErrorMsg(msg);
            setIsSubmitting(false);
            
            controls.start({
                x: [-10, 10, -10, 10, 0],
                transition: { duration: 0.4 }
            });
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.15 }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { 
            y: 0, 
            opacity: 1,
            transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
        }
    };

    return (
        <div 
            onMouseMove={handleMouseMove}
            className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] relative overflow-hidden transition-colors duration-500 select-none cursor-default"
        >
            {/* ─── ENVIRONMENTAL LAYER ────────────────────────────────────── */}
            <CinematicBackground />
            
            {/* Interactive Ambient Glows */}
            <motion.div 
                animate={{ 
                    x: mousePos.x * 50, 
                    y: mousePos.y * 50 
                }}
                className="absolute top-0 right-0 w-[800px] h-[800px] bg-[var(--bg-accent)]/10 rounded-full blur-[150px] -mr-96 -mt-96 pointer-events-none mix-blend-screen" 
            />
            <motion.div 
                animate={{ 
                    x: mousePos.x * -30, 
                    y: mousePos.y * -30 
                }}
                className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[var(--bg-accent)]/5 rounded-full blur-[120px] -ml-80 -mb-80 pointer-events-none mix-blend-screen" 
            />

            <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="w-full max-w-md p-8 relative z-10"
            >
                {/* ─── LOGO SECTION ────────────────────────────────────────── */}
                <motion.div variants={itemVariants} className="flex flex-col items-center mb-10">
                    <motion.div 
                        whileHover={{ scale: 1.05, rotate: 2 }}
                        animate={{ 
                            rotateY: mousePos.x * 10,
                            rotateX: mousePos.y * -10,
                            y: [0, -5, 0]
                        }}
                        transition={{ 
                            y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                        }}
                        className="w-22 h-22 bg-white/90 backdrop-blur-md rounded-[2rem] flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.3)] mb-6 overflow-hidden p-2.5 border border-white/20"
                    >
                        <img src="/logo.png" alt="KMIT Logo" className="w-full h-full object-contain" />
                    </motion.div>
                    <h1 className="text-5xl font-black text-[var(--text-primary)] italic uppercase tracking-tighter leading-none">
                        KMIT <span className="text-[var(--text-accent)] drop-shadow-[0_0_15px_var(--bg-accent-glow)]">KAHOOT</span>
                    </h1>
                    <p className="text-[var(--text-secondary)] font-black uppercase tracking-[0.4em] text-[9px] mt-3 opacity-60">Elite Assessment Infrastructure</p>
                </motion.div>

                {/* ─── LOGIN CARD ─────────────────────────────────────────── */}
                <motion.div 
                    variants={itemVariants}
                    animate={controls}
                    style={{
                        perspective: 1000
                    }}
                >
                    <motion.div
                        animate={{
                            rotateY: mousePos.x * 5,
                            rotateX: mousePos.y * -5,
                        }}
                        className="relative group"
                    >
                        {/* Animated Border Shimmer */}
                        <div className="absolute -inset-[1px] bg-gradient-to-r from-transparent via-[var(--bg-accent)]/30 to-transparent rounded-[3rem] blur-sm group-hover:blur-md transition-all duration-1000 opacity-30"></div>
                        
                        <div className="bg-[var(--bg-secondary)]/40 backdrop-blur-[32px] border border-white/10 p-10 rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-500">
                            
                            {/* Card Content Shimmer */}
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

                            {/* Top Progress Bar */}
                            <AnimatePresence>
                                {isSubmitting && (
                                    <motion.div 
                                        initial={{ x: "-100%" }}
                                        animate={{ x: "0%" }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
                                        className="absolute top-0 left-0 w-full h-[3px] bg-[var(--bg-accent)] z-50 shadow-[0_0_15px_var(--bg-accent)]"
                                    />
                                )}
                            </AnimatePresence>

                            {/* Active Tab Indicator */}
                            <div className={`absolute top-0 h-[2px] bg-[var(--bg-accent)] transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) ${isLogin ? 'left-0 w-1/2' : 'left-1/2 w-1/2'} ${isSubmitting ? 'opacity-0' : 'opacity-40'}`}></div>

                            <h2 className="text-3xl font-black text-[var(--text-primary)] mb-10 italic uppercase tracking-tight flex items-center gap-4">
                                {isLogin ? 
                                    <LogIn size={28} className="text-[var(--text-accent)]" /> : 
                                    <UserPlus size={28} className="text-[var(--text-accent)]" />
                                }
                                {isLogin ? 'Initialize' : 'Register'}
                            </h2>

                            <form onSubmit={onSubmit} className="space-y-8">
                                <AnimatePresence mode="wait">
                                    {!isLogin && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="space-y-2"
                                        >
                                            <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1 opacity-50">Identity Handle</label>
                                            <div className="relative group/input">
                                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-white/20 group-focus-within/input:text-[var(--text-accent)] transition-colors">
                                                    <User size={20} />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="username"
                                                    placeholder="Username"
                                                    value={username}
                                                    onChange={onChange}
                                                    required={!isLogin}
                                                    className="block w-full bg-white/[0.02] border border-white/5 rounded-[1.5rem] py-5 pl-14 pr-5 text-[var(--text-primary)] placeholder-white/10 focus:outline-none focus:border-[var(--bg-accent)]/30 focus:bg-white/[0.05] focus:shadow-[0_0_30px_var(--bg-accent-glow)] transition-all duration-500 font-bold tracking-tight"
                                                />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1 opacity-50">System Identifier</label>
                                    <div className="relative group/input">
                                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-white/20 group-focus-within/input:text-[var(--text-accent)] transition-colors">
                                            <Mail size={20} />
                                        </div>
                                        <input
                                            type="text"
                                            name="email"
                                            placeholder="Roll Number"
                                            value={email}
                                            onChange={onChange}
                                            required
                                            className="block w-full bg-white/[0.02] border border-white/5 rounded-[1.5rem] py-5 pl-14 pr-5 text-[var(--text-primary)] placeholder-white/10 focus:outline-none focus:border-[var(--bg-accent)]/30 focus:bg-white/[0.05] focus:shadow-[0_0_30px_var(--bg-accent-glow)] transition-all duration-500 font-bold tracking-tight"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1 opacity-50">Security Key</label>
                                    <div className="relative group/input">
                                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-white/20 group-focus-within/input:text-[var(--text-accent)] transition-colors">
                                            <Lock size={20} />
                                        </div>
                                        <motion.input
                                            animate={submitStatus === 'error' ? { x: [0, -10, 10, -10, 10, 0] } : {}}
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={onChange}
                                            required
                                            className={`block w-full bg-white/[0.02] border rounded-[1.5rem] py-5 pl-14 pr-14 text-[var(--text-primary)] placeholder-white/10 focus:outline-none transition-all duration-500 font-bold tracking-tight
                                                ${submitStatus === 'error' ? 'border-red-500/30 bg-red-500/5 focus:shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'border-white/5 focus:border-[var(--bg-accent)]/30 focus:bg-white/[0.05] focus:shadow-[0_0_30px_var(--bg-accent-glow)]'}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-5 flex items-center text-slate-500 hover:text-slate-400 transition-all cursor-pointer"
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                    <AnimatePresence>
                                        {errorMsg && (
                                            <motion.p 
                                                initial={{ opacity: 0, y: -5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="text-red-400 text-[10px] font-black uppercase tracking-widest ml-2 mt-3 flex items-center gap-2"
                                            >
                                                <XCircle size={12} /> {errorMsg}
                                            </motion.p>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <motion.button
                                    type="submit"
                                    disabled={isSubmitting}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`w-full flex justify-center items-center gap-4 py-5 px-8 rounded-[1.5rem] shadow-2xl text-base font-black italic uppercase tracking-[0.2em] transition-all duration-500 mt-6 relative overflow-hidden group/btn
                                        ${submitStatus === 'success' ? 'bg-green-600 text-white shadow-green-600/30' : 
                                          submitStatus === 'error' ? 'bg-red-600 text-white shadow-red-600/30' : 
                                          'bg-[var(--bg-accent)] text-[var(--text-on-accent)] shadow-[var(--bg-accent)]/30 hover:shadow-[var(--bg-accent)]/50'}`}
                                >
                                    {/* Button Magnetic Glow Effect */}
                                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500 blur-xl pointer-events-none translate-y-10 group-hover/btn:translate-y-0" />
                                    
                                    {isSubmitting ? (
                                        <Loader2 size={24} className="animate-spin" />
                                    ) : submitStatus === 'success' ? (
                                        <><CheckCircle2 size={24} /> Authorized</>
                                    ) : submitStatus === 'error' ? (
                                        <><XCircle size={24} /> Denied</>
                                    ) : (
                                        <>{isLogin ? 'Establish Link' : 'Register'} <LogIn size={20} /></>
                                    )}
                                </motion.button>
                            </form>

                            <div className="mt-10 pt-10 border-t border-white/5 text-center">
                                <button 
                                    onClick={() => setIsLogin(!isLogin)}
                                    className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] hover:text-[var(--text-accent)] transition-all duration-300 opacity-40 hover:opacity-100"
                                >
                                    {isLogin ? "Generate New Identity" : "Already Identified? Access"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Footer Depth Layer */}
                <motion.div 
                    variants={itemVariants} 
                    animate={{ y: mousePos.y * 10 }}
                    className="mt-12 text-center"
                >
                    <p className="text-[var(--text-secondary)] text-[10px] font-black uppercase tracking-[0.5em] opacity-20">
                        &copy; 2026 KMIT Advanced Assessment Logic
                    </p>
                </motion.div>
            </motion.div>
        </div>
    );
}
