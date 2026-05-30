import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
    Trophy, Play, Users, Star, ArrowRight, Target, Sparkles, 
    Zap, Rocket, Globe, Brain, Cpu, MessageSquare, Clock, BarChart3, 
    ChevronRight, Search, LayoutGrid, FileText, Upload, Lock, FilePlus, Loader2
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
import AgentPipelineLoader from '../components/loaders/AgentPipelineLoader';

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
    const [activeTab, setActiveTab] = useState('link'); // 'link' | 'arena'
    const [joinCode, setJoinCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [error, setError] = useState(false);
    const navigate = useNavigate();
    const controls = useAnimation();
    const inputRef = useRef(null);
    const isSmallScreen = useMediaQuery('(max-width: 767px)');
    
    const maxChars = 6;

    // Game Arena States
    const [file, setFile] = useState(null);
    const [selectedGame, setSelectedGame] = useState('cyber-quest'); // 'cyber-quest'
    const [submitting, setSubmitting] = useState(false);
    
    // Polling States
    const [polling, setPolling]       = useState(false);
    const [stage, setStage]           = useState(0);
    const [stageLabel, setStageLabel] = useState('Generating Questions');
    const [elapsed, setElapsed]       = useState(0);
    const [pollError, setPollError]   = useState(null);
    const pollIntervalRef = useRef(null);
    const startTimeRef    = useRef(null);
    const elapsedRef      = useRef(null);

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

    // ── Polling Logics ──────────────────────────────────────────────────────
    const stopPolling = useCallback(() => {
        clearInterval(pollIntervalRef.current);
        clearInterval(elapsedRef.current);
        setPolling(false);
    }, []);

    const startPolling = useCallback((taskId, { onComplete, onError } = {}) => {
        setPolling(true);
        setStage(0);
        setStageLabel('Generating Questions');
        setElapsed(0);
        setPollError(null);
        startTimeRef.current = Date.now();

        elapsedRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);

        const doPoll = async () => {
            try {
                const res = await api.get(`/quiz/generate/status/${taskId}`);
                const { status, stage: s, stageLabel: sl, result, error: e } = res.data;
                if (s !== undefined) setStage(s);
                if (sl) setStageLabel(sl);

                if (status === 'COMPLETED' && result) {
                    stopPolling();
                    if (onComplete) onComplete(result);
                } else if (status === 'FAILED' || status === 'EXPIRED' || status === 'NOT_FOUND') {
                    stopPolling();
                    const msg = e || 'Generation failed. Please try again.';
                    setPollError(msg);
                    if (onError) onError(msg);
                }
            } catch (err) {
                console.warn('[Poller] poll error:', err.message);
            }
        };

        doPoll();
        pollIntervalRef.current = setInterval(doPoll, 1500);
    }, [stopPolling]);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleLaunchGame = async (e) => {
        e.preventDefault();
        if (!file) {
            toast.error('Please upload study material first!');
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'file');
            formData.append('questionCount', '10');
            formData.append('difficulty', 'Medium'); // standard pool count and baseline

            const res = await api.post('/quiz/generate', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 30000,
            });

            const { taskId } = res.data;
            if (!taskId) throw new Error('No taskId returned from server');

            startPolling(taskId, {
                onComplete: (result) => {
                    setSubmitting(false);
                    // Navigate to the Cyber Quest page, passing generated questions and material name
                    navigate('/cyber-quest', {
                        state: {
                            questions: result.questions,
                            title: result.title || file.name.replace(/\.[^/.]+$/, '')
                        }
                    });
                },
                onError: (msg) => {
                    toast.error(msg || 'AI parser failed. Please retry.');
                    setSubmitting(false);
                }
            });
        } catch (err) {
            console.error(err);
            toast.error('Failed to parse materials. Ensure server is online.');
            setSubmitting(false);
        }
    };

    const isLoading = submitting || polling;

    return (
        <DashboardLayout role="student">
            {isLoading && (
                <AgentPipelineLoader
                    stage={stage}
                    stageLabel={stageLabel}
                    elapsed={elapsed}
                />
            )}
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
                    className="w-full max-w-4xl space-y-8 text-center relative z-10 px-6"
                >
                    {/* Header System */}
                    <div className="space-y-4">
                        <motion.div 
                            whileHover={{ scale: 1.05 }}
                            className="w-20 h-20 bg-[var(--bg-accent)]/10 rounded-[1.8rem] border-2 border-[var(--bg-accent)]/30 flex items-center justify-center text-[var(--text-accent)] mx-auto mb-4 relative shadow-[0_0_30px_var(--bg-accent-glow)] group cursor-pointer"
                        >
                            <Trophy size={40} className="relative z-10" />
                        </motion.div>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white italic uppercase tracking-tighter leading-tight">
                            STUDENT <span className="text-[var(--text-accent)] drop-shadow-[0_0_20px_var(--bg-accent-glow)]">GAME ARENA</span>
                        </h1>
                        <p className="text-[var(--text-secondary)] font-bold uppercase tracking-[0.4em] text-[10px] max-w-md mx-auto opacity-60">
                            Attempt quizzes via Code or Launch cognitive AI games
                        </p>
                    </div>

                    {/* Tab Controls */}
                    <div className="flex justify-center gap-4 max-w-md mx-auto">
                        <button
                            onClick={() => { if (!isLoading) setActiveTab('link'); }}
                            className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-wider text-xs italic transition-all duration-300 border ${
                                activeTab === 'link'
                                    ? 'bg-[var(--bg-accent)] text-[var(--text-on-accent)] shadow-[0_0_20px_var(--bg-accent-glow)] border-[var(--bg-accent)]'
                                    : 'bg-white/5 text-[var(--text-secondary)] hover:text-white border-white/5'
                            }`}
                        >
                            Neural Link
                        </button>
                        <button
                            onClick={() => { if (!isLoading) setActiveTab('arena'); }}
                            className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-wider text-xs italic transition-all duration-300 border ${
                                activeTab === 'arena'
                                    ? 'bg-[var(--bg-accent)] text-[var(--text-on-accent)] shadow-[0_0_20px_var(--bg-accent-glow)] border-[var(--bg-accent)]'
                                    : 'bg-white/5 text-[var(--text-secondary)] hover:text-white border-white/5'
                            }`}
                        >
                            Game Arena
                        </button>
                    </div>

                    {/* Tab Switch Layout */}
                    <AnimatePresence mode="wait">
                        {activeTab === 'link' ? (
                            <motion.div
                                key="tab-link"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.4 }}
                                className="space-y-8 max-w-lg mx-auto"
                            >
                                <div className="relative">
                                    <motion.div 
                                        animate={controls}
                                        className="relative flex justify-center gap-2 md:gap-4 cursor-pointer py-8 px-6 bg-white/[0.02] backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] group"
                                        onClick={() => inputRef.current?.focus()}
                                    >
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
                                                    className="w-10 md:w-12 h-14 md:h-18 rounded-xl border-2 backdrop-blur-md flex items-center justify-center relative overflow-hidden transition-colors"
                                                >
                                                    <AnimatePresence mode="popLayout">
                                                        {joinCode[i] ? (
                                                            <motion.span
                                                                key={`char-${i}-${joinCode[i]}`}
                                                                initial={{ opacity: 0, scale: 2, y: 10 }}
                                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                                                className="text-xl md:text-3xl font-black text-white italic tracking-tighter z-10"
                                                            >
                                                                {joinCode[i]}
                                                            </motion.span>
                                                        ) : (
                                                            isActive && (
                                                                <motion.div 
                                                                    animate={{ opacity: [1, 0, 1] }}
                                                                    transition={{ duration: 1, repeat: Infinity }}
                                                                    className="w-0.5 h-6 bg-[var(--bg-accent)] rounded-full"
                                                                />
                                                            )
                                                        )}
                                                    </AnimatePresence>
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

                                <button
                                    onClick={() => handleJoin()}
                                    disabled={joinCode.length !== maxChars || isSubmitting}
                                    className={`w-full h-16 rounded-2xl font-black text-lg italic uppercase tracking-[0.2em] flex items-center justify-center gap-4 transition-all duration-500 btn-cinematic btn-glow
                                        ${joinCode.length === maxChars && !isSubmitting
                                            ? 'bg-[var(--bg-accent)] text-[var(--text-on-accent)] shadow-[0_20px_40px_var(--bg-accent-glow)]' 
                                            : 'bg-white/[0.03] text-white/10 border border-white/5 cursor-not-allowed'}`}
                                >
                                    {isSubmitting ? (
                                        <Zap className="animate-spin" size={20} />
                                    ) : (
                                        <>
                                            <Sparkles size={20} className={joinCode.length === maxChars ? 'animate-pulse' : ''} />
                                            {uiTerminology.deployToArena.toUpperCase()}
                                        </>
                                    )}
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="tab-arena"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.4 }}
                                className="space-y-10 max-w-4xl mx-auto text-left"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                                    
                                    {/* Column 1: Document Uploader */}
                                    <div className="lg:col-span-2 space-y-6">
                                        <div className="bg-white/5 rounded-3xl border border-[var(--border-color)] p-6 glass-panel relative overflow-hidden group">
                                            <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-4">
                                                Step 1: Upload Study Material
                                            </label>
                                            <div className="relative border-4 border-dashed border-[var(--border-color)] rounded-2xl hover:border-[var(--bg-accent)]/50 transition-all bg-white/5 group/upload">
                                                <input
                                                    type="file"
                                                    accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png,.txt"
                                                    onChange={handleFileChange}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                                    required
                                                />
                                                <div className="p-8 flex flex-col items-center gap-4 text-center">
                                                    {file ? (
                                                        <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
                                                            <div className="bg-[var(--bg-accent)] p-4 rounded-xl text-[var(--text-on-accent)] shadow-[0_5px_20px_var(--bg-accent-glow)]">
                                                                <FilePlus size={32} />
                                                            </div>
                                                            <p className="font-black text-sm text-[var(--text-primary)] italic max-w-[180px] truncate">{file.name}</p>
                                                            <p className="text-[var(--text-secondary)] font-bold uppercase tracking-widest text-[9px]">Material Locked In</p>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="bg-white/5 p-4 rounded-xl text-[var(--text-secondary)] group-hover/upload:text-[var(--bg-accent)] transition-colors">
                                                                <Upload size={32} />
                                                            </div>
                                                            <div>
                                                                <p className="text-[var(--text-primary)] font-black text-sm italic">SELECT DOCUMENT</p>
                                                                <p className="text-[var(--text-secondary)] font-bold uppercase tracking-widest text-[8px] mt-1">PDF, DOCX, PPTX, JPG, PNG (MAX 10MB)</p>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 2: Choose Game Mode */}
                                    <div className="lg:col-span-3 space-y-6">
                                        <div className="bg-white/5 rounded-3xl border border-[var(--border-color)] p-6 glass-panel">
                                            <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-4">
                                                Step 2: Select Game Arena
                                            </label>
                                            
                                            <div className="flex flex-col gap-4">
                                                {/* Cyber Quest Card (Active) */}
                                                <div 
                                                    onClick={() => setSelectedGame('cyber-quest')}
                                                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 items-center relative overflow-hidden ${
                                                        selectedGame === 'cyber-quest'
                                                            ? 'border-[var(--bg-accent)] bg-[var(--bg-accent)]/5 shadow-[0_0_20px_rgba(0,240,255,0.15)]'
                                                            : 'border-white/5 bg-white/[0.01] hover:border-white/10'
                                                    }`}
                                                >
                                                    <div className="bg-[var(--bg-accent)]/10 text-[var(--text-accent)] w-12 h-12 rounded-xl flex items-center justify-center">
                                                        <Sparkles size={24} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-center">
                                                            <h3 className="font-black text-white uppercase italic text-sm tracking-wide">Cyber Quest</h3>
                                                            <span className="text-[var(--text-accent)] font-bold text-[8px] uppercase tracking-widest border border-[var(--text-accent)]/30 px-2 py-0.5 rounded">READY</span>
                                                        </div>
                                                        <p className="text-slate-400 text-[10px] mt-1 font-medium leading-relaxed">
                                                            Progress through 10 cyberpunk difficulty tiers. Use 50:50, Shield, and Skip lifelines to win.
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Sprint Arena Card (Locked) */}
                                                <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.01] opacity-40 select-none flex gap-4 items-center relative overflow-hidden group">
                                                    <div className="bg-pink-600/10 text-pink-400 w-12 h-12 rounded-xl flex items-center justify-center">
                                                        <Clock size={24} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-center">
                                                            <h3 className="font-black text-slate-300 uppercase italic text-sm tracking-wide">Sprint Arena</h3>
                                                            <span className="bg-pink-900/30 text-pink-400 font-black text-[8px] uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 border border-pink-500/20">
                                                                <Lock size={8} /> LOCKED
                                                            </span>
                                                        </div>
                                                        <p className="text-slate-500 text-[10px] mt-1 font-medium leading-relaxed">
                                                            Beat the ticking clock in rapid time-survival MCQ matches. Correct adds time, wrong subtracts.
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Match-Up Card (Locked) */}
                                                <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.01] opacity-40 select-none flex gap-4 items-center relative overflow-hidden group">
                                                    <div className="bg-purple-600/10 text-purple-400 w-12 h-12 rounded-xl flex items-center justify-center">
                                                        <Cpu size={24} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-center">
                                                            <h3 className="font-black text-slate-300 uppercase italic text-sm tracking-wide">Match-Up Match</h3>
                                                            <span className="bg-purple-900/30 text-purple-400 font-black text-[8px] uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 border border-purple-500/20">
                                                                <Lock size={8} /> LOCKED
                                                            </span>
                                                        </div>
                                                        <p className="text-slate-500 text-[10px] mt-1 font-medium leading-relaxed">
                                                            Visual cognitive card-matching memory board. Solve vocabulary and concepts in record times.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                </div>

                                {/* Launch Game button */}
                                <div className="flex justify-center pt-4">
                                    <button
                                        onClick={handleLaunchGame}
                                        disabled={!file || submitting}
                                        className={`px-16 py-5 rounded-2xl font-black text-xl italic uppercase tracking-[0.25em] flex items-center gap-4 transition-all duration-300 border btn-cinematic
                                            ${file && !submitting
                                                ? 'bg-[var(--bg-accent)] text-[var(--text-on-accent)] shadow-[0_15px_30px_var(--bg-accent-glow)] border-[var(--bg-accent)]'
                                                : 'bg-white/5 text-white/10 border-white/5 cursor-not-allowed'
                                            }`}
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 size={24} className="animate-spin" />
                                                ANALYZING MATERIAL...
                                            </>
                                        ) : (
                                            <>
                                                <Play size={24} fill="currentColor" />
                                                LAUNCH GAME MODE
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                </motion.div>
            </div>
        </DashboardLayout>
    );
}
