import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { Zap, Loader2, Sparkles, Trophy, ShieldCheck, Cpu, Globe, Rocket } from 'lucide-react';
import toast from 'react-hot-toast';
import { showSuccess, showError } from '../utils/alerts';

export default function StudentDashboard() {
    const [joinCode, setJoinCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [error, setError] = useState(false);
    const inputRef = useRef(null);
    const controls = useAnimation();
    const navigate = useNavigate();

    const maxChars = 6;

    const handleJoin = async (codeToSubmit = joinCode) => {
        if (!codeToSubmit || codeToSubmit.length !== maxChars) return;

        setIsSubmitting(true);
        setError(false);
        const loadingToast = toast.loading('Authenticating Arena PIN...');

        try {
            const res = await api.post('/quiz/join', { code: Number(codeToSubmit) });
            toast.dismiss(loadingToast);
            
            await showSuccess('Access Granted!', 'Entering the Arena...');
            
            await controls.start({
                scale: [1, 1.05, 1],
                transition: { duration: 0.3 }
            });
            
            if (res.data.isLive) {
                navigate(`/live-room-student/${codeToSubmit}`);
            } else {
                navigate(`/quiz/attempt/${res.data.quizId}`);
            }
        } catch (err) {
            toast.dismiss(loadingToast);
            console.error(err);
            setError(true);
            const errorMsg = err.response?.data?.msg || 'Invalid Arena PIN';
            showError('Access Denied', errorMsg);
            
            controls.start({
                x: [-10, 10, -10, 10, 0],
                transition: { duration: 0.4 }
            });
            setJoinCode('');
            inputRef.current?.focus();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DashboardLayout role="student">
            <div className="relative min-h-[75vh] flex flex-col items-center justify-center font-inter py-10">
                
                {/* Floating Atmospheric Tech Elements - Theme-Synchronized Neural Depth */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <motion.div 
                        animate={{ 
                            y: [0, -20, 0],
                            rotate: [0, 10, 0],
                            opacity: [0.08, 0.18, 0.08]
                        }}
                        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute top-[10%] left-[15%] text-[var(--neural-prime)]"
                    >
                        <Cpu size={120} strokeWidth={0.5} />
                    </motion.div>
                    <motion.div 
                        animate={{ 
                            y: [0, 30, 0],
                            rotate: [0, -15, 0],
                            opacity: [0.06, 0.16, 0.06]
                        }}
                        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        className="absolute bottom-[20%] right-[10%] text-[var(--neural-sub)]"
                    >
                        <Globe size={160} strokeWidth={0.5} />
                    </motion.div>
                    <motion.div 
                        animate={{ 
                            x: [0, 20, 0],
                            opacity: [0.1, 0.2, 0.1]
                        }}
                        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                        className="absolute top-[40%] right-[20%] text-[var(--neural-neutral)]"
                    >
                        <Rocket size={80} strokeWidth={1} />
                    </motion.div>
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
                        <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-tight">
                            ENTER THE <span className="text-[var(--text-accent)] drop-shadow-[0_0_20px_var(--bg-accent-glow)]">ARENA</span>
                        </h1>
                        <p className="text-[var(--text-secondary)] font-black uppercase tracking-[0.5em] text-[10px] max-w-sm mx-auto opacity-40">
                            Neural Authentication Protocol Required
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
                                                    className="text-3xl md:text-5xl font-black text-white italic tracking-tighter z-10"
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
                                                    initial={{ opacity: 0, scale: 0 }}
                                                    animate={{ opacity: 1, scale: 1 }}
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
                            className={`w-full h-20 rounded-[2rem] font-black text-xl italic uppercase tracking-[0.3em] flex items-center justify-center gap-4 transition-all duration-500 btn-cinematic
                                ${joinCode.length === maxChars && !isSubmitting
                                    ? 'bg-[var(--bg-accent)] text-[var(--text-on-accent)] shadow-[0_20px_40px_var(--bg-accent-glow)]' 
                                    : 'bg-white/[0.03] text-white/10 border border-white/5 cursor-not-allowed'}`}
                        >
                            {isSubmitting ? (
                                <Loader2 size={28} className="animate-spin" />
                            ) : (
                                <>
                                    SYNC INTERFACE
                                    <Zap size={24} fill="currentColor" className={joinCode.length === maxChars ? 'animate-pulse' : ''} />
                                </>
                            )}
                        </button>

                        {/* Intelligence Feed */}
                        <div className="glass-panel rounded-[2rem] p-8 border border-white/5 text-left relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--bg-accent)]/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-[var(--bg-accent)]/10 transition-colors" />
                            <div className="relative z-10 flex items-start gap-4">
                                <div className="p-3 bg-[var(--bg-accent)]/10 rounded-xl text-[var(--text-accent)] shadow-inner">
                                    <ShieldCheck size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-accent)] mb-2">Protocol Verified</p>
                                    <p className="text-white/30 font-black text-[11px] uppercase tracking-wider leading-relaxed">
                                        Active session monitoring enabled. Unauthorized interface switching is strictly logged.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </DashboardLayout>
    );
}
