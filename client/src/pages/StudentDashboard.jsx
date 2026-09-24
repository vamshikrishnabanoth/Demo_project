import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
    Trophy, Play, Users, Star, ArrowRight, Target, Sparkles, 
    Zap, Rocket, Globe, Cpu, MessageSquare, Clock, BarChart3, 
    ChevronRight, Search, LayoutGrid, FileText, Upload, Lock, FilePlus, Loader2,
    Hash, Gauge, Database, Sliders, Book, FileCheck, ShieldCheck, Gift, Medal, AlertTriangle,
    Clock3, BadgeCheck, Binoculars, TimerReset
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
import PerkQRCodeModal from '../components/quiz/PerkQRCodeModal';

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
    const [activeTab, setActiveTab] = useState('link'); // 'link' | 'arena' | 'gamification'
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
    const [videoUrls, setVideoUrls] = useState(['']);
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

    // Gamification States
    const [xp, setXp] = useState(0);
    const [points, setPoints] = useState(0);
    const [streak, setStreak] = useState(0);
    const [highestStreak, setHighestStreak] = useState(0);
    const [dailyMissions, setDailyMissions] = useState([]);
    const [unlockedPerks, setUnlockedPerks] = useState([]);
    const [redeeming, setRedeeming] = useState(false);
    const [showTicket, setShowTicket] = useState(null); // holds perk object to show ticket

    // Assessments States
    const [assessments, setAssessments] = useState([]);
    const [loadingAssessments, setLoadingAssessments] = useState(false);

    const fetchAssessments = async () => {
        setLoadingAssessments(true);
        try {
            const res = await api.get('/quiz/available');
            setAssessments((res.data || []).filter(q => q.isAssessment));
        } catch (err) {
            console.error('Failed to load assessments', err);
        } finally {
            setLoadingAssessments(false);
        }
    };

    // Read-only: just hydrate UI state, no DB mutations
    const fetchGamification = async () => {
        try {
            const res = await api.get('/students/gamification');
            setXp(res.data.xp || 0);
            setPoints(res.data.points ?? 0);
            setStreak(res.data.streak || 0);
            setHighestStreak(res.data.highestStreak || 0);
            setDailyMissions(res.data.dailyMissions || []);
            setUnlockedPerks(res.data.unlockedPerks || []);
        } catch (err) {
            console.error("Failed to load gamification stats", err);
        }
    };

    // Called once per day when tab mounts — handles streak saves, resets, mission generation
    const initGamification = async () => {
        try {
            const res = await api.post('/students/gamification/init');
            setXp(res.data.xp || 0);
            setPoints(res.data.points ?? 0);
            setStreak(res.data.streak || 0);
            setHighestStreak(res.data.highestStreak || 0);
            setDailyMissions(res.data.dailyMissions || []);
            setUnlockedPerks(res.data.unlockedPerks || []);
            // Show toast if streak was auto-saved or broken
            if (res.data.actionsTaken?.length > 0) {
                res.data.actionsTaken.forEach(action => {
                    if (action.includes('saved')) {
                        toast.success(action, { duration: 5000 });
                    } else if (action.includes('reset')) {
                        toast.error(`💔 ${action}`, { duration: 5000 });
                    }
                });
            }
        } catch (err) {
            console.error("Failed to initialize gamification", err);
            fetchGamification(); // fallback to read-only
        }
    };

    useEffect(() => {
        if (user?.id) {
            socket.emit('identify', user.id);
            fetchGamification();
            fetchAssessments();
        }
    }, [user]);

    useEffect(() => {
        if (activeTab === 'gamification' && user?.id) {
            initGamification();
        }
        if (activeTab === 'assessments' && user?.id) {
            fetchAssessments();
        }
    }, [activeTab]);

    const handleRedeemPerk = async (perkId, perkName, cost) => {
        const currentPts = points ?? 0;
        if (currentPts < cost) return toast.error('Not enough points to redeem this perk!');
        setRedeeming(true);
        try {
            const res = await api.post('/students/redeem-perk', { perkId, perkName, cost });
            const remaining = res.data.remainingPoints ?? Math.max(0, currentPts - cost);
            setPoints(remaining);
            const newPerk = res.data.perk;
            setUnlockedPerks(prev => [...prev, newPerk]);
            setShowTicket(newPerk);
            toast.success(`🎉 Redeemed: ${perkName}`);
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Redemption failed');
        } finally {
            setRedeeming(false);
        }
    };

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

    const handleAddVideoUrl = () => {
        if (videoUrls.length < 2) {
            setVideoUrls([...videoUrls, '']);
        }
    };

    const handleUpdateVideoUrl = (index, value) => {
        const newUrls = [...videoUrls];
        newUrls[index] = value;
        setVideoUrls(newUrls);
    };

    const handleRemoveVideoUrl = (index) => {
        const newUrls = [...videoUrls];
        newUrls.splice(index, 1);
        if (newUrls.length === 0) newUrls.push('');
        setVideoUrls(newUrls);
    };

    const handleLaunchGame = async (e) => {
        e.preventDefault();
        const hasFile = !!file;
        const filteredUrls = videoUrls.filter(u => u.trim() !== '');
        const hasUrls = filteredUrls.length > 0;

        if (!hasFile && !hasUrls) {
            toast.error('Please upload study material or provide YouTube links!');
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            if (hasFile) {
                formData.append('file', file);
                formData.append('type', 'file');
            } else {
                formData.append('videoUrls', JSON.stringify(filteredUrls));
                formData.append('type', 'topic');
            }
            formData.append('questionCount', '10');
            formData.append('difficulty', 'Medium');

            const res = await api.post('/quiz/generate', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 30000,
            });

            const { taskId } = res.data;
            if (!taskId) throw new Error('No taskId returned from server');

            startPolling(taskId, {
                onComplete: (result) => {
                    setSubmitting(false);
                    let targetPath = '/cyber-quest';
                    if (selectedGame === 'sprint-arena') targetPath = '/sprint-arena';
                    else if (selectedGame === 'match-up') targetPath = '/match-up-arena';

                    navigate(targetPath, {
                        state: {
                            questions: result.questions,
                            title: result.title || (file ? file.name.replace(/\.[^/.]+$/, '') : 'Video Quiz')
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
                    <div className="space-y-3">
                        <h1 className="type-page-title font-black text-[var(--text-primary)] italic tracking-tight">
                            Student <span className="text-[var(--text-accent)] drop-shadow-[0_0_20px_var(--bg-accent-glow)]">Dashboard</span>
                        </h1>
                        <p className="text-[var(--text-secondary)] font-bold uppercase tracking-[0.3em] text-[10px] max-w-md mx-auto">
                            Attempt quizzes via PIN code or redeem missions & academic perks
                        </p>
                    </div>

                    {/* Tab Controls */}
                    <div className="flex justify-center gap-4 max-w-2xl mx-auto pt-2">
                        <button
                            onClick={() => { if (!isLoading) setActiveTab('link'); }}
                            className={`flex-1 py-3.5 px-6 rounded-2xl font-black uppercase tracking-wider text-xs italic transition-all duration-300 border flex items-center justify-center gap-2 cursor-pointer ${
                                activeTab === 'link'
                                    ? 'bg-[var(--bg-accent)] !text-white shadow-[0_6px_20px_rgba(234,88,12,0.25)] border-[var(--bg-accent)]'
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--bg-accent)] border-[var(--border-color)]'
                            }`}
                            style={activeTab === 'link' ? { color: '#ffffff' } : {}}
                        >
                            <Zap size={16} /> Join Quiz
                        </button>
                        <button
                            onClick={() => { if (!isLoading) setActiveTab('gamification'); }}
                            className={`flex-1 py-3.5 px-6 rounded-2xl font-black uppercase tracking-wider text-xs italic transition-all duration-300 border flex items-center justify-center gap-2 cursor-pointer ${
                                activeTab === 'gamification'
                                    ? 'bg-[var(--bg-accent)] !text-white shadow-[0_6px_20px_rgba(234,88,12,0.25)] border-[var(--bg-accent)]'
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--bg-accent)] border-[var(--border-color)]'
                            }`}
                            style={activeTab === 'gamification' ? { color: '#ffffff' } : {}}
                        >
                            <Trophy size={16} /> Missions & Perks
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
                                        className="relative flex justify-center gap-2 md:gap-4 cursor-pointer py-7 px-4 sm:px-6 bg-white rounded-3xl border border-slate-200 shadow-[0_6px_20px_rgba(15,23,42,0.06)] group"
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
                                                        borderColor: isActive ? '#111827' : isFilled ? '#64748b' : '#d1d5db',
                                                        backgroundColor: 'white',
                                                        boxShadow: isActive ? '0 0 0 3px rgba(17,24,39,0.08)' : 'none'
                                                    }}
                                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                                    className="w-10 md:w-12 h-14 md:h-[4.5rem] rounded-xl border-2 flex items-center justify-center relative overflow-hidden transition-colors hover:border-slate-500"
                                                >
                                                    <AnimatePresence mode="popLayout">
                                                        {joinCode[i] ? (
                                                            <motion.span
                                                                key={`char-${i}-${joinCode[i]}`}
                                                                initial={{ opacity: 0, scale: 2, y: 10 }}
                                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                                                className="text-xl md:text-3xl font-black text-[var(--text-primary)] italic tracking-tighter z-10"
                                                            >
                                                                {joinCode[i]}
                                                            </motion.span>
                                                        ) : (
                                                            isActive && (
                                                                <motion.div 
                                                                    animate={{ opacity: [1, 0, 1] }}
                                                                    transition={{ duration: 1, repeat: Infinity }}
                                                                    className="w-0.5 h-6 bg-[#111827] rounded-full"
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
                                                                className="absolute inset-0 bg-slate-900/[0.03] pointer-events-none"
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
                                        className={`w-full h-16 rounded-[1.4rem] font-black text-lg italic uppercase tracking-[0.18em] flex items-center justify-center text-center transition-all duration-300 border border-[#ea580c]/80 bg-[#ea580c] text-white shadow-[0_12px_28px_rgba(194,65,12,0.28)] ${
                                        joinCode.length === maxChars && !isSubmitting
                                            ? 'hover:brightness-105 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer'
                                            : 'opacity-90 cursor-not-allowed'
                                    }`}
                                >
                                    {isSubmitting ? (
                                        <div className="flex items-center justify-center gap-3 text-white">
                                            <Zap className="animate-spin text-white" size={22} />
                                            <span className="text-white font-black">CONNECTING TO ARENA...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-3 text-center w-full text-white">
                                            <Sparkles size={22} className={`text-white ${joinCode.length === maxChars ? 'animate-pulse' : ''}`} />
                                            <span className="text-white font-black tracking-[0.2em]">
                                                ATTEMPT QUIZ
                                            </span>
                                            <ArrowRight size={20} className="text-white" />
                                        </div>
                                    )}
                                </button>
                            </motion.div>
                        ) : activeTab === 'arena' ? (
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
                                        <div className="bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] p-6 relative overflow-hidden group shadow-sm">
                                            <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-4">
                                                Step 1: Upload Study Material
                                            </label>
                                            <div className="relative border-4 border-dashed border-[var(--border-color)] rounded-2xl hover:border-[var(--bg-accent)] transition-all bg-[var(--bg-primary)] group/upload">
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
                                                            <div className="w-14 h-14 rounded-2xl bg-[var(--accent-sand)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-accent)] shadow-xs">
                                                                <FileCheck size={28} className="text-[var(--text-accent)]" />
                                                            </div>
                                                            <p className="font-black text-sm text-[#0f172a] italic max-w-[200px] truncate" style={{ color: '#0f172a' }}>{file.name}</p>
                                                            <div className="px-3 py-1 rounded-full bg-[var(--accent-sand)] border border-[var(--border-color)]">
                                                                <p className="text-[9px] font-black text-[var(--text-accent)] uppercase tracking-widest">Material Locked In</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] p-4 rounded-xl text-[var(--text-secondary)] group-hover/upload:text-[var(--bg-accent)] transition-colors">
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
                                        <div className="bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] p-6 relative overflow-hidden group shadow-sm">
                                            <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-4">
                                                OR YouTube Video Links (Max 2)
                                            </label>
                                            <div className="space-y-3">
                                                {videoUrls.map((url, i) => (
                                                    <div key={i} className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={url}
                                                            onChange={(e) => handleUpdateVideoUrl(i, e.target.value)}
                                                            className="flex-1 p-4 bg-white border border-[var(--border-color)] rounded-xl focus:border-red-500 transition-all font-bold text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 outline-none"
                                                            placeholder="https://youtube.com/watch?v=..."
                                                            disabled={submitting}
                                                        />
                                                    </div>
                                                ))}
                                                {videoUrls.length < 2 && (
                                                    <button
                                                        type="button"
                                                        onClick={handleAddVideoUrl}
                                                        className="text-[10px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest flex items-center gap-1 mt-2"
                                                        disabled={submitting}
                                                    >
                                                        + Add another video
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 2: Choose Game Mode */}
                                    <div className="lg:col-span-3 space-y-6">
                                        <div className="bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] p-6 shadow-sm">
                                            <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-4">
                                                Step 2: Select Game Arena
                                            </label>
                                            
                                            <div className="flex flex-col gap-4">
                                                {/* Cyber Quest Card (Active) */}
                                                <div 
                                                    onClick={() => setSelectedGame('cyber-quest')}
                                                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 items-center relative overflow-hidden ${
                                                        selectedGame === 'cyber-quest'
                                                            ? 'border-cyan-500 bg-cyan-500/8 shadow-md'
                                                            : 'border-[var(--border-color)] bg-[#f8fafc] hover:border-cyan-400/60'
                                                    }`}
                                                >
                                                    <div className="bg-cyan-100 text-cyan-600 w-12 h-12 rounded-xl flex items-center justify-center shadow-inner">
                                                        <Sparkles size={24} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-center">
                                                            <h3 className="font-black text-[var(--text-primary)] uppercase italic text-sm tracking-wide">Cyber Quest</h3>
                                                            <span className="text-cyan-600 font-bold text-[8px] uppercase tracking-widest border border-cyan-500/30 bg-cyan-50 px-2 py-0.5 rounded">READY</span>
                                                        </div>
                                                        <p className="text-[var(--text-secondary)] text-[10px] mt-1 font-medium leading-relaxed">
                                                            Progress through 10 cyberpunk difficulty tiers. Use 50:50, Shield, and Skip lifelines to win.
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Sprint Arena Card (Unlocked!) */}
                                                <div 
                                                    onClick={() => setSelectedGame('sprint-arena')}
                                                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 items-center relative overflow-hidden ${
                                                        selectedGame === 'sprint-arena'
                                                            ? 'border-pink-500 bg-pink-500/5 shadow-md opacity-100'
                                                            : 'border-[var(--border-color)] bg-[#fff7fb] hover:border-pink-400/60 opacity-80'
                                                    }`}
                                                >
                                                    <div className="bg-pink-100 text-pink-500 w-12 h-12 rounded-xl flex items-center justify-center shadow-inner">
                                                        <TimerReset size={24} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-center">
                                                            <h3 className="font-black text-[var(--text-primary)] uppercase italic text-sm tracking-wide">Sprint Arena</h3>
                                                            <span className="text-pink-500 font-bold text-[8px] uppercase tracking-widest border border-pink-500/30 bg-pink-50 px-2 py-0.5 rounded">READY</span>
                                                        </div>
                                                        <p className="text-[var(--text-secondary)] text-[10px] mt-1 font-medium leading-relaxed">
                                                            Beat the ticking clock in rapid time-survival MCQ matches. Correct adds time, wrong subtracts.
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Match-Up Card (Unlocked!) */}
                                                <div 
                                                    onClick={() => setSelectedGame('match-up')}
                                                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 items-center relative overflow-hidden ${
                                                        selectedGame === 'match-up'
                                                            ? 'border-violet-500 bg-violet-500/5 shadow-md opacity-100'
                                                            : 'border-[var(--border-color)] bg-[#faf5ff] hover:border-violet-400/60 opacity-80'
                                                    }`}
                                                >
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-center">
                                                            <h3 className="font-black text-[var(--text-primary)] uppercase italic text-sm tracking-wide">Match-Up Match</h3>
                                                            <span className="text-violet-500 font-bold text-[8px] uppercase tracking-widest border border-violet-500/30 bg-violet-50 px-2 py-0.5 rounded">READY</span>
                                                        </div>
                                                        <p className="text-[var(--text-secondary)] text-[10px] mt-1 font-medium leading-relaxed">
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
                                        disabled={(!file && videoUrls.every(u => !u.trim())) || submitting}
                                        className={`group w-full sm:w-auto px-6 sm:px-16 py-4 sm:py-5 rounded-[1.4rem] font-black text-base sm:text-xl italic uppercase tracking-[0.18em] sm:tracking-[0.25em] flex items-center justify-center gap-3 sm:gap-4 transition-all duration-300 border border-[#ea580c]/80 bg-[#ea580c] text-white shadow-[0_12px_28px_rgba(194,65,12,0.28)] ${
                                            (!file && videoUrls.every(u => !u.trim())) || submitting
                                                ? 'opacity-90 cursor-not-allowed'
                                            : 'hover:brightness-110 hover:scale-[1.02] hover:-translate-y-1 hover:border-white/80 hover:shadow-[0_18px_38px_rgba(249,115,22,0.42)] active:scale-[0.99] active:translate-y-0 cursor-pointer'
                                        }`}
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 size={24} className="animate-spin text-white" />
                                                <span className="text-white font-black">ANALYZING MATERIAL...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Play size={24} fill="#ffffff" className="text-white transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-110" />
                                                <span className="text-white font-black">LAUNCH GAME MODE</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        ) : activeTab === 'gamification' ? (
                            <motion.div
                                key="tab-gamification"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.4 }}
                                className="space-y-8 max-w-5xl mx-auto text-left"
                            >
                                {/* Missions & Perks Progression Card */}
                                <div className="bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] p-6 shadow-sm">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
                                                <Trophy size={24} className="text-amber-500" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-black text-[var(--text-primary)] italic uppercase tracking-wide">
                                                    Missions & Perks Progression
                                                </h2>
                                                <p className="text-xs text-[var(--text-secondary)] font-medium">
                                                    Complete tasks & quizzes to unlock exclusive academic perks
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right self-end sm:self-auto">
                                            <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block">
                                                Total Points Gained
                                            </span>
                                            <span className="text-xl font-black text-amber-500 italic">
                                                {(points ?? 0)} <span className="text-xs text-[var(--text-secondary)] font-bold">/ 1300 PTS</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Golden Progress Line */}
                                    <div className="w-full bg-[var(--bg-primary)] h-4 rounded-full border border-[var(--border-color)] overflow-hidden p-0.5 relative">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(((points ?? 0) / 1300) * 100, 100)}%` }}
                                            transition={{ duration: 1, ease: "easeOut" }}
                                            className="h-full rounded-full relative overflow-hidden"
                                            style={{
                                                 background: 'linear-gradient(90deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%)',
                                                 boxShadow: '0 0 15px rgba(245, 158, 11, 0.6)'
                                             }}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
                                        </motion.div>
                                    </div>

                                    <div className="flex justify-between items-center text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-2">
                                        <span>0 PTS</span>
                                        <span className="text-amber-500 font-black">{Math.min(Math.round(((points ?? 0) / 1300) * 100), 100)}% COMPLETED</span>
                                        <span>1300 PTS (MAX MILESTONE)</span>
                                    </div>
                                </div>

                                {/* Rewards Store - Clean & Focused */}
                                <div className="bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] p-6 sm:p-8 flex flex-col gap-6 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                                    <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-2.5 text-amber-500 shadow-sm">
                                                <Gift size={24} />
                                            </div>
                                            <div>
                                                <h2 className="type-section-title font-black text-[var(--text-primary)] italic uppercase text-lg sm:text-xl">
                                                    Available Academic Perks
                                                </h2>
                                                <p className="text-xs text-[var(--text-secondary)] font-medium">
                                                    Redeem your accumulated points for verified college permissions & benefits
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Perk Store - 3 Specific Perks */}
                                    {(() => {
                                        const rewardThemes = {
                                            perk_late: {
                                                iconBg: 'bg-violet-100',
                                                icon: 'text-violet-700',
                                                border: 'border-violet-200 hover:border-violet-400',
                                                badge: 'bg-violet-50 text-violet-700 border-violet-200'
                                            },
                                            perk_half: {
                                                iconBg: 'bg-blue-100',
                                                icon: 'text-blue-700',
                                                border: 'border-blue-200 hover:border-blue-400',
                                                badge: 'bg-blue-50 text-blue-700 border-blue-200'
                                            },
                                            perk_att: {
                                                iconBg: 'bg-emerald-100',
                                                icon: 'text-emerald-700',
                                                border: 'border-emerald-200 hover:border-emerald-400',
                                                badge: 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            }
                                        };

                                        const PERK_LIST = [
                                            { 
                                                id: 'perk_late', 
                                                name: 'Late Permission', 
                                                cost: 700, 
                                                icon: FileText, 
                                                desc: 'Submit any assignment or arrive 1 hour late with official academic waiver' 
                                            },
                                            { 
                                                id: 'perk_half', 
                                                name: 'Half-Day Permission', 
                                                cost: 900, 
                                                icon: Clock3, 
                                                desc: 'Excuse yourself for a half-day session with authorized exemption' 
                                            },
                                            { 
                                                id: 'perk_att', 
                                                name: '5% Hike in Attendance', 
                                                cost: 1300, 
                                                icon: Target, 
                                                desc: 'Directly boost your official academic attendance percentage by +5%' 
                                            },
                                        ];

                                        const currentPts = points ?? 0;

                                        return (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                {PERK_LIST.map(perk => {
                                                    const canAfford = currentPts >= perk.cost;
                                                    const theme = rewardThemes[perk.id];
                                                    const IconComponent = perk.icon;

                                                    return (
                                                        <div 
                                                            key={perk.id} 
                                                            className={`p-5 rounded-3xl border bg-white flex flex-col justify-between transition-all duration-300 shadow-sm ${theme.border} bg-[var(--bg-primary)]`}
                                                        >
                                                            <div className="space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <div className={`p-3.5 rounded-2xl border ${theme.iconBg} ${theme.badge} ${theme.icon} shadow-xs`}>
                                                                        <IconComponent size={24} />
                                                                    </div>
                                                                    <span className="text-xs font-black text-amber-600 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                                                                        {perk.cost} PTS
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <h3 className="font-black text-[var(--text-primary)] text-base italic uppercase tracking-tight">
                                                                        {perk.name}
                                                                    </h3>
                                                                    <p className="text-[var(--text-secondary)] text-xs font-medium mt-1 leading-relaxed">
                                                                        {perk.desc}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="pt-5 mt-4 border-t border-[var(--border-color)] flex items-center justify-between gap-3">
                                                                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                                                    {canAfford ? 'Eligible' : `Need ${perk.cost - currentPts} more pts`}
                                                                </span>
                                                                <button
                                                                    onClick={() => canAfford && handleRedeemPerk(perk.id, perk.name, perk.cost)}
                                                                    disabled={!canAfford || redeeming}
                                                                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                                                                        canAfford
                                                                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md hover:shadow-amber-500/20 active:scale-95'
                                                                            : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-70'
                                                                    }`}
                                                                >
                                                                    {redeeming ? 'Redeeming...' : canAfford ? 'Redeem Pass' : 'Locked'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}

                                    {/* Inventory */}
                                    {unlockedPerks.length > 0 && (
                                        <div className="mt-2 pt-6 border-t border-[var(--border-color)]">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Medal size={16} className="text-amber-500" />
                                                <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest">
                                                    Your Redeemed Passes ({unlockedPerks.length})
                                                </h3>
                                            </div>
                                            <div className="flex flex-wrap gap-2.5">
                                                {unlockedPerks.map((p, idx) => (
                                                    <button 
                                                        key={idx} 
                                                        onClick={() => setShowTicket(p)}
                                                        className="text-xs bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white px-4 py-2 rounded-2xl flex items-center gap-2 transition-all font-bold shadow-sm cursor-pointer border border-white/10 active:scale-95"
                                                    >
                                                        <Trophy size={14} className="text-amber-400" /> 
                                                        <span>{p.name}</span>
                                                        <span className="text-[10px] opacity-75 font-mono">({p.uniqueId || 'PASS'})</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : null}
                    </AnimatePresence>

                    {/* Scannable QR Code Modal */}
                    <PerkQRCodeModal
                        isOpen={Boolean(showTicket)}
                        onClose={() => setShowTicket(null)}
                        perk={showTicket}
                        user={user}
                    />

                </motion.div>
            </div>
        </DashboardLayout>
    );
}
