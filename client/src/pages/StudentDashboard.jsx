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
        if (xp < cost) return toast.error('Not enough XP!');
        setRedeeming(true);
        try {
            const res = await api.post('/students/redeem-perk', { perkId, perkName, cost });
            setXp(res.data.remainingXp);
            setUnlockedPerks(prev => [...prev, res.data.perk]);
            toast.success(`Redeemed: ${perkName}`);
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
                    <div className="space-y-4">
                        <h1 className="type-page-title font-black text-[var(--text-primary)] italic tracking-tight">
                            Student <span className="text-[var(--text-accent)] drop-shadow-[0_0_20px_var(--bg-accent-glow)]">Game Arena</span>
                        </h1>
                        <p className="text-[var(--text-secondary)] font-bold uppercase tracking-[0.3em] text-[10px] max-w-md mx-auto">
                            Attempt quizzes via code or launch cognitive AI games
                        </p>
                    </div>

                    {/* Gamification Quick Stats Banner */}
                    <div className="flex justify-center items-center gap-4 bg-[var(--student-surface-alt)] border border-[var(--student-border)] rounded-2xl p-4 max-w-2xl mx-auto shadow-[var(--student-shadow-soft)] backdrop-blur-md flex-wrap">
                        <div className="flex items-center gap-2">
                            <Star className="text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.45)]" size={22} fill="currentColor" />
                            <div className="text-left">
                                <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest leading-none mb-1">Total XP</p>
                                <p className="text-lg font-black text-[var(--text-primary)] italic leading-none">{xp} <span className="text-xs text-amber-400">XP</span></p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-[var(--student-border)]"></div>
                        <div className="flex items-center gap-2">
                            <Rocket className="text-cyan-500 drop-shadow-[0_0_12px_rgba(34,211,238,0.45)]" size={22} fill="currentColor" />
                            <div className="text-left">
                                <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest leading-none mb-1">Current Streak</p>
                                <p className="text-lg font-black text-[var(--text-primary)] italic leading-none">{streak} <span className="text-xs text-cyan-500">DAYS</span></p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-[var(--student-border)]"></div>
                        <div className="flex items-center gap-2">
                            <Trophy className="text-violet-500 drop-shadow-[0_0_12px_rgba(168,85,247,0.45)]" size={22} fill="currentColor" />
                            <div className="text-left">
                                <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest leading-none mb-1">Best Streak</p>
                                <p className="text-lg font-black text-[var(--text-primary)] italic leading-none">{highestStreak} <span className="text-xs text-violet-500">DAYS</span></p>
                            </div>
                        </div>
                    </div>

                    {/* XP Progress toward Next Reward */}
                    {(() => {
                        const XP_REWARDS = [
                            { name: 'Attendance Pass', cost: 1500 },
                            { name: 'Late Pass', cost: 3000 },
                        ];
                        const nextReward = XP_REWARDS.find(r => xp < r.cost);
                        if (!nextReward) return (
                            <div className="max-w-2xl mx-auto px-2">
                                <p className="text-center text-[10px] font-black text-amber-400 uppercase tracking-widest">
                                    All XP Rewards Unlocked! Maintain your streak for the Golden Perk.
                                </p>
                            </div>
                        );
                        const prevCost = XP_REWARDS[XP_REWARDS.indexOf(nextReward) - 1]?.cost || 0;
                        const progress = Math.min(((xp - prevCost) / (nextReward.cost - prevCost)) * 100, 100);
                        const xpLeft = nextReward.cost - xp;
                        return (
                            <div className="max-w-2xl mx-auto px-2 space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">
                                        Next: <span className="text-amber-700 font-extrabold">{nextReward.name}</span>
                                    </p>
                                    <p className="text-[9px] font-black text-[var(--text-primary)]">
                                        {xp.toLocaleString()} / {nextReward.cost.toLocaleString()} XP
                                        <span className="text-amber-700 font-extrabold ml-2">— {xpLeft.toLocaleString()} XP to go</span>
                                    </p>
                                </div>
                                <div className="w-full bg-[var(--border-color)]/50 h-2 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        transition={{ duration: 1, ease: 'easeOut' }}
                                        className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                                    />
                                </div>
                            </div>
                        );
                    })()}

                    {/* Tab Controls */}
                    <div className="flex flex-col sm:flex-row justify-center gap-3 max-w-2xl mx-auto">
                        <button
                            onClick={() => { if (!isLoading) setActiveTab('link'); }}
                            className={`flex-1 min-h-[50px] px-4 py-3 rounded-xl font-semibold uppercase tracking-wider text-xs transition-all duration-200 border flex items-center justify-center gap-2 cursor-pointer ${
                                activeTab === 'link'
                                    ? 'bg-[var(--bg-accent)] !text-white shadow-[0_6px_16px_rgba(234,88,12,0.22)] border-[var(--bg-accent)] hover:bg-[var(--bg-accent-hover)] hover:-translate-y-0.5'
                                    : 'bg-white text-[var(--text-primary)] hover:bg-slate-50 hover:border-slate-400 hover:-translate-y-0.5 border-slate-200 shadow-sm'
                            }`}
                            style={activeTab === 'link' ? { color: '#ffffff' } : {}}
                        >
                            Join Quiz
                        </button>
                        <button
                            onClick={() => { if (!isLoading) setActiveTab('arena'); }}
                            className={`flex-1 min-h-[50px] px-4 py-3 rounded-xl font-semibold uppercase tracking-wider text-xs transition-all duration-200 border flex items-center justify-center gap-2 cursor-pointer ${
                                activeTab === 'arena'
                                    ? 'bg-[var(--bg-accent)] !text-white shadow-[0_6px_16px_rgba(234,88,12,0.22)] border-[var(--bg-accent)] hover:bg-[var(--bg-accent-hover)] hover:-translate-y-0.5'
                                    : 'bg-white text-[var(--text-primary)] hover:bg-slate-50 hover:border-slate-400 hover:-translate-y-0.5 border-slate-200 shadow-sm'
                            }`}
                            style={activeTab === 'arena' ? { color: '#ffffff' } : {}}
                        >
                            Game Arena
                        </button>
                        <button
                            onClick={() => { if (!isLoading) setActiveTab('gamification'); }}
                            className={`flex-1 min-h-[50px] px-4 py-3 rounded-xl font-semibold uppercase tracking-wider text-xs transition-all duration-200 border flex items-center justify-center gap-2 cursor-pointer ${
                                activeTab === 'gamification'
                                    ? 'bg-[var(--bg-accent)] !text-white shadow-[0_6px_16px_rgba(234,88,12,0.22)] border-[var(--bg-accent)] hover:bg-[var(--bg-accent-hover)] hover:-translate-y-0.5'
                                    : 'bg-white text-[var(--text-primary)] hover:bg-slate-50 hover:border-slate-400 hover:-translate-y-0.5 border-slate-200 shadow-sm'
                            }`}
                            style={activeTab === 'gamification' ? { color: '#ffffff' } : {}}
                        >
                            <Trophy size={15} /> Missions & Perks
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
                                className="space-y-10 max-w-5xl mx-auto text-left"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Daily Missions */}
                                    <div className="bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] p-5 sm:p-6 flex flex-col gap-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className="rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] p-2 text-[var(--text-primary)] shadow-sm">
                                                <ShieldCheck size={20} />
                                            </div>
                                            <h2 className="type-section-title font-black text-[var(--text-primary)] italic uppercase">Daily Missions</h2>
                                        </div>

                                        {(() => {
                                            const getMissionTheme = (mission) => {
                                                const title = (mission?.title || '').toLowerCase();
                                                const isAccuracy = title.includes('accuracy') || title.includes('precise') || title.includes('correct');
                                                const isXp = title.includes('xp') || title.includes('earn') || title.includes('score');
                                                const isCyber = title.includes('cyber') || title.includes('quest');

                                                if (isAccuracy) {
                                                    return {
                                                        badge: 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200',
                                                        chip: 'bg-fuchsia-100 text-fuchsia-700',
                                                        bar: 'bg-fuchsia-500',
                                                        icon: 'text-fuchsia-600',
                                                        soft: 'bg-fuchsia-50/70 border-fuchsia-100',
                                                        progress: 'text-fuchsia-700'
                                                    };
                                                }

                                                if (isXp) {
                                                    return {
                                                        badge: 'bg-amber-50 text-amber-700 border border-amber-200',
                                                        chip: 'bg-amber-100 text-amber-700',
                                                        bar: 'bg-amber-500',
                                                        icon: 'text-amber-600',
                                                        soft: 'bg-amber-50/70 border-amber-100',
                                                        progress: 'text-amber-700'
                                                    };
                                                }

                                                if (isCyber) {
                                                    return {
                                                        badge: 'bg-violet-50 text-violet-700 border border-violet-200',
                                                        chip: 'bg-violet-100 text-violet-700',
                                                        bar: 'bg-violet-500',
                                                        icon: 'text-violet-600',
                                                        soft: 'bg-violet-50/70 border-violet-100',
                                                        progress: 'text-violet-700'
                                                    };
                                                }

                                                return {
                                                    badge: 'bg-slate-100 text-slate-700 border border-slate-200',
                                                    chip: 'bg-slate-200 text-slate-700',
                                                    bar: 'bg-slate-600',
                                                    icon: 'text-slate-600',
                                                    soft: 'bg-slate-50 border-slate-200',
                                                    progress: 'text-slate-700'
                                                };
                                            };

                                            return dailyMissions.map((m) => {
                                                const isComplete = m.current >= m.target;
                                                const theme = getMissionTheme(m);
                                                const icon = m.required ? 'MAIN' : 'BONUS';

                                                return (
                                                    <div
                                                        key={m.id}
                                                        className={`p-3.5 sm:p-4 rounded-2xl border bg-[var(--bg-primary)] transition-all duration-300 ${
                                                            isComplete ? `border-[var(--border-color)] ${theme.soft}` : 'border-[var(--border-color)] bg-[var(--bg-primary)]'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <div className={`h-2.5 w-2.5 rounded-full ${theme.chip}`} aria-hidden="true" />
                                                                    <h3 className="font-extrabold text-[var(--text-primary)] text-sm sm:text-[0.95rem] leading-snug tracking-[-0.01em]">
                                                                        {m.title}
                                                                    </h3>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className={`inline-flex items-center rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em] ${m.required ? 'bg-pink-50 text-pink-700 border border-pink-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                                                    {icon}
                                                                </span>
                                                                {isComplete && (
                                                                    <span className="inline-flex items-center justify-center rounded-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] p-1" aria-label="Completed mission">
                                                                        <ShieldCheck size={12} className={theme.icon} />
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="mt-3 flex items-center justify-between gap-3">
                                                            <div className="flex-1">
                                                                <div className="h-2 w-full rounded-full bg-[var(--border-color)]/80 overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all duration-500 ease-out ${theme.bar}`}
                                                                        style={{ width: `${Math.min((m.current / m.target) * 100, 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <span className={`min-w-[3.5rem] text-right text-[11px] font-black ${isComplete ? theme.progress : 'text-[var(--text-secondary)]'}`}>
                                                                {m.current} / {m.target}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>

                                    {/* Rewards Store */}
                                    <div className="bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] p-6 flex flex-col gap-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] p-2 text-[var(--text-primary)] shadow-sm">
                                                <Gift size={22} />
                                            </div>
                                            <h2 className="type-section-title font-black text-[var(--text-primary)] italic uppercase">Rewards Store</h2>
                                        </div>

                                        {/* Perk Store */}
                                        {(() => {
                                            const getRedemptionsThisMonth = (perkId) => {
                                                const now = new Date();
                                                const currentYear = now.getFullYear();
                                                const currentMonth = now.getMonth();
                                                return unlockedPerks.filter(p => {
                                                    if (p.id !== perkId) return false;
                                                    const d = new Date(p.redeemedAt);
                                                    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
                                                }).length;
                                            };

                                            const rewardThemes = {
                                                perk_att: {
                                                    iconBg: 'bg-amber-100',
                                                    icon: 'text-amber-700',
                                                    border: 'border-amber-200',
                                                    ring: 'ring-amber-100',
                                                    accent: 'text-amber-700',
                                                    badge: 'bg-amber-100 text-amber-700',
                                                    status: 'text-amber-700'
                                                },
                                                perk_late: {
                                                    iconBg: 'bg-violet-100',
                                                    icon: 'text-violet-700',
                                                    border: 'border-violet-200',
                                                    ring: 'ring-violet-100',
                                                    accent: 'text-violet-700',
                                                    badge: 'bg-violet-100 text-violet-700',
                                                    status: 'text-violet-700'
                                                },
                                                perk_golden: {
                                                    iconBg: 'bg-emerald-100',
                                                    icon: 'text-emerald-700',
                                                    border: 'border-emerald-200',
                                                    ring: 'ring-emerald-100',
                                                    accent: 'text-emerald-700',
                                                    badge: 'bg-emerald-100 text-emerald-700',
                                                    status: 'text-emerald-700'
                                                },
                                                default: {
                                                    iconBg: 'bg-slate-100',
                                                    icon: 'text-slate-700',
                                                    border: 'border-slate-200',
                                                    ring: 'ring-slate-100',
                                                    accent: 'text-slate-700',
                                                    badge: 'bg-slate-100 text-slate-700',
                                                    status: 'text-slate-700'
                                                }
                                            };

                                            return [
                                                { id: 'perk_att', name: '1 Hour Free Attendance', cost: 1500, icon: Clock, color: 'text-[var(--text-accent)]', border: 'border-[var(--border-color)]', desc: 'Excuse yourself from 1 hour of attendance', monthlyLimit: 1 },
                                                { id: 'perk_late', name: '1 Day Late Pass', cost: 3000, icon: FileText, color: 'text-violet-700', border: 'border-violet-200', desc: 'Submit any assignment 1 day late with no penalty', monthlyLimit: 2 },
                                                { id: 'perk_golden', name: 'Golden Perk — Free Streak Save', cost: 0, icon: Star, color: 'text-emerald-700', border: 'border-emerald-200', desc: 'One emergency streak save that costs 0 XP. Used automatically on your next missed day.', streakOnly: 30 },
                                            ].map(perk => {
                                                const isStreakLocked = perk.streakOnly && streak < perk.streakOnly;
                                                const redemptionsThisMonth = perk.monthlyLimit ? getRedemptionsThisMonth(perk.id) : 0;
                                                const limitReached = perk.monthlyLimit ? redemptionsThisMonth >= perk.monthlyLimit : false;
                                                const canAfford = !isStreakLocked && !limitReached && xp >= perk.cost;
                                                const theme = rewardThemes[perk.id] || rewardThemes.default;
                                                return (
                                                <div key={perk.id} className={`p-4 rounded-2xl border bg-white flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left justify-between ${isStreakLocked ? 'border-slate-200 opacity-80' : `${theme.border}`} ${isStreakLocked ? 'bg-slate-50' : 'bg-[var(--bg-primary)]'}`}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-3 rounded-xl border ${theme.iconBg} ${theme.border} ${theme.icon}`}>
                                                            {perk.id === 'perk_att' ? <Clock3 size={24} /> : perk.id === 'perk_late' ? <BadgeCheck size={24} /> : <Medal size={24} />}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-[var(--text-primary)] text-sm">{perk.name}</h3>
                                                            <p className="text-[var(--text-secondary)] text-[10px] mt-0.5">{perk.desc}</p>
                                                            {perk.monthlyLimit && (
                                                                <p className={`${theme.accent} text-[9px] font-black uppercase tracking-wider mt-1`}>
                                                                    <AlertTriangle size={12} aria-hidden="true" /> Only {perk.monthlyLimit} redeemable this month • {redemptionsThisMonth}/{perk.monthlyLimit} used
                                                                </p>
                                                            )}
                                                            {isStreakLocked
                                                                ? <p className="text-slate-500 text-xs font-black italic mt-1 flex items-center gap-1"><Lock size={12} aria-hidden="true" /> Requires {perk.streakOnly}-Day Streak</p>
                                                                : <p className={`${theme.status} text-xs font-black italic mt-1`}>{perk.cost} XP</p>
                                                            }
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => !isStreakLocked && !limitReached && handleRedeemPerk(perk.id, perk.name, perk.cost)}
                                                        disabled={!canAfford || redeeming}
                                                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
                                                            canAfford
                                                                ? 'bg-gradient-to-r from-[#f59e0b] to-[#f97316] text-white hover:brightness-105 shadow-md'
                                                                : 'bg-white text-[var(--text-secondary)] border border-[var(--border-color)] cursor-not-allowed'
                                                        }`}
                                                    >
                                                        {isStreakLocked ? 'Locked' : limitReached ? 'Max Limit' : 'Redeem'}
                                                    </button>
                                                </div>
                                                );
                                            });
                                        })()}

                                        {/* Inventory */}
                                        {unlockedPerks.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-white/10">
                                                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-3">Your Inventory</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {unlockedPerks.map((p, idx) => (
                                                        <button 
                                                            key={idx} 
                                                            onClick={() => setShowTicket(p)}
                                                            className="text-[10px] bg-white/10 hover:bg-[var(--bg-accent)] text-white px-3 py-1.5 rounded flex items-center gap-2 transition-colors uppercase font-bold"
                                                        >
                                                            <Trophy size={12} /> {p.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ) : null}
                    </AnimatePresence>

                    {/* Ticket Modal */}
                    <AnimatePresence>
                        {showTicket && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                                <motion.div 
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    className="bg-zinc-900 border border-white/20 p-8 rounded-3xl max-w-md w-full relative"
                                    id="perk-ticket-node"
                                >
                                    <button 
                                        onClick={() => setShowTicket(null)}
                                        className="absolute top-4 right-4 text-white/50 hover:text-white"
                                    >
                                        &times;
                                    </button>
                                    
                                    <div className="border-4 border-dashed border-[var(--bg-accent)] rounded-xl p-6 text-center space-y-4 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-16 h-16 bg-[var(--bg-accent)]/20 blur-2xl rounded-full"></div>
                                        <div className="absolute bottom-0 right-0 w-24 h-24 bg-purple-500/10 blur-3xl rounded-full"></div>
                                        
                                        <div className="w-16 h-16 mx-auto bg-[var(--bg-accent)] text-black rounded-full flex items-center justify-center shadow-[0_0_30px_var(--bg-accent-glow)]">
                                            <Star size={32} fill="currentColor" />
                                        </div>
                                        
                                        <div>
                                            <h2 className="text-2xl font-black text-white italic uppercase">OFFICIAL PASS</h2>
                                            <h3 className="text-lg text-[var(--text-accent)] font-bold mt-1">{showTicket.name}</h3>
                                        </div>

                                        {/* Status badge */}
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40">
                                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                                            <span className="text-green-400 text-[10px] font-black uppercase tracking-widest">{showTicket.status || 'UNUSED'}</span>
                                        </div>
                                        
                                        <div className="pt-4 border-t border-white/10 text-left space-y-2.5">
                                            <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Issued To: <span className="text-white">{user?.name || user?.username}</span></p>
                                            <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Roll No: <span className="text-white">{user?.username}</span></p>
                                            <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Issue Date: <span className="text-white">{new Date(showTicket.redeemedAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span></p>
                                            <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Expires On: <span className="text-red-400 font-black">{showTicket.expiryDate ? new Date(showTicket.expiryDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : 'N/A'}</span></p>
                                            <div className="bg-white/5 rounded-lg px-3 py-2 mt-1">
                                                <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-1">Verification Code</p>
                                                <p className="text-[var(--text-accent)] font-black text-sm tracking-widest">{showTicket.uniqueId || showTicket.id?.toUpperCase()}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="pt-4">
                                            <button 
                                                onClick={() => window.print()}
                                                className="w-full py-3 bg-white text-black font-black uppercase text-sm rounded-lg hover:bg-gray-200 transition-colors"
                                            >
                                                🖨 Print / Save as PDF
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                </motion.div>
            </div>
        </DashboardLayout>
    );
}
