import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
    Trophy, Play, Users, Star, ArrowRight, Target, Sparkles, 
    Zap, Rocket, Globe, Brain, Cpu, MessageSquare, Clock, BarChart3, 
    ChevronRight, Search, LayoutGrid, FileText, Upload, Lock, FilePlus, Loader2,
    Hash, Gauge, Database, Sliders, Book, FileCheck
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
                        toast.success(`🛡️ ${action}`, { duration: 5000 });
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
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[var(--text-primary)] italic tracking-tight leading-tight">
                            Student <span className="text-[var(--text-accent)] drop-shadow-[0_0_20px_var(--bg-accent-glow)]">Game Arena</span>
                        </h1>
                        <p className="text-[var(--text-secondary)] font-bold uppercase tracking-[0.3em] text-[10px] max-w-md mx-auto">
                            Attempt quizzes via code or launch cognitive AI games
                        </p>
                    </div>

                    {/* Gamification Quick Stats Banner */}
                    <div className="flex justify-center items-center gap-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-4 max-w-2xl mx-auto shadow-lg backdrop-blur-md flex-wrap">
                        <div className="flex items-center gap-2">
                            <Star className="text-yellow-600" size={22} fill="currentColor" />
                            <div className="text-left">
                                <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest leading-none mb-1">Total XP</p>
                                <p className="text-lg font-black text-[var(--text-primary)] italic leading-none">{xp} <span className="text-xs text-yellow-600">XP</span></p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-[var(--border-color)]"></div>
                        <div className="flex items-center gap-2">
                            <Rocket className="text-orange-600" size={22} fill="currentColor" />
                            <div className="text-left">
                                <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest leading-none mb-1">Current Streak</p>
                                <p className="text-lg font-black text-[var(--text-primary)] italic leading-none">{streak} <span className="text-xs text-orange-600">DAYS</span></p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-[var(--border-color)]"></div>
                        
                            </div>
                        );
                    })()}

                    {/* Tab Controls */}
                    <div className="flex justify-center gap-4 max-w-2xl mx-auto">
                        <button
                            onClick={() => { if (!isLoading) setActiveTab('link'); }}
                            className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-wider text-xs italic transition-all duration-300 border ${
                                activeTab === 'link'
                                    ? 'bg-[var(--bg-accent)] !text-white shadow-[0_0_20px_var(--bg-accent-glow)] border-[var(--bg-accent)]'
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--bg-accent)] border-[var(--border-color)]'
                            }`}
                            style={activeTab === 'link' ? { color: '#ffffff' } : {}}
                        >
                            Join Quiz
                        </button>
                        
                        <button
                            onClick={() => { if (!isLoading) setActiveTab('gamification'); }}
                            className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-wider text-xs italic transition-all duration-300 border flex items-center justify-center gap-1.5 ${
                                activeTab === 'gamification'
                                    ? 'bg-[var(--bg-accent)] !text-white shadow-[0_0_20px_var(--bg-accent-glow)] border-[var(--bg-accent)]'
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--bg-accent)] border-[var(--border-color)]'
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
                                        className="relative flex justify-center gap-2 md:gap-4 cursor-pointer py-8 px-6 bg-[var(--bg-secondary)] rounded-[2.5rem] border-2 border-[var(--border-color)] shadow-lg group"
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
                                                        borderColor: isActive ? 'var(--bg-accent)' : isFilled ? 'var(--bg-accent)' : 'var(--border-color)',
                                                        backgroundColor: isActive ? 'rgba(19,62,135,0.06)' : isFilled ? 'rgba(19,62,135,0.04)' : 'white',
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
                                                                className="text-xl md:text-3xl font-black text-[var(--text-primary)] italic tracking-tighter z-10"
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
                                    className={`w-full h-16 rounded-2xl font-black text-lg italic uppercase tracking-[0.2em] flex items-center justify-center text-center transition-all duration-300 border border-[#133E87] bg-[#133E87] !text-white shadow-[0_10px_25px_rgba(19,62,135,0.3)] ${
                                        joinCode.length === maxChars && !isSubmitting
                                            ? 'hover:bg-[#0e2e65] hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-[0_0_25px_var(--bg-accent-glow)]' 
                                            : 'opacity-85 cursor-not-allowed'
                                    }`}
                                    style={{ backgroundColor: 'var(--bg-accent)', color: 'var(--text-on-accent)' }}
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
                                    <div className="bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] p-6 flex flex-col gap-4 shadow-sm">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Target className="text-pink-500" size={28} />
                                            <h2 className="text-2xl font-black text-[var(--text-primary)] italic uppercase">Daily Missions</h2>
                                        </div>
                                        
                                        {dailyMissions.map((m, idx) => (
                                            <div key={m.id} className={`p-4 rounded-2xl border flex flex-col gap-2 relative overflow-hidden ${m.current >= m.target ? 'border-green-500/40 bg-green-500/8' : 'border-[var(--border-color)] bg-[var(--bg-primary)]'}`}>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <h3 className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
                                                            {m.title}
                                                            {m.required && <span className="bg-pink-500 text-white text-[8px] px-2 py-0.5 rounded-full uppercase tracking-widest">Main (Streak +1)</span>}
                                                            {!m.required && <span className="bg-[var(--bg-accent)] text-white text-[8px] px-2 py-0.5 rounded-full uppercase tracking-widest">Bonus</span>}
                                                        </h3>
                                                    </div>
                                                    <span className={`text-xs font-black ${m.current >= m.target ? 'text-green-600' : 'text-[var(--text-secondary)]'}`}>
                                                        {m.current} / {m.target}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-[var(--border-color)] h-2 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${m.current >= m.target ? 'bg-green-500' : 'bg-[var(--bg-accent)]'} transition-all duration-500`}
                                                        style={{ width: `${Math.min((m.current / m.target) * 100, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Rewards Store */}
                                    <div className="bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] p-6 flex flex-col gap-4 shadow-sm">
                                        
                                                        <div>
                                                            <h3 className="font-bold text-[var(--text-primary)] text-sm">{perk.name}</h3>
                                                            <p className="text-[var(--text-secondary)] text-[10px] mt-0.5">{perk.desc}</p>
                                                            {perk.monthlyLimit && (
                                                                <p className="text-pink-400 text-[9px] font-black uppercase tracking-wider mt-1">
                                                                    ⚠️ Only {perk.monthlyLimit} redeemable this month • {redemptionsThisMonth}/{perk.monthlyLimit} used
                                                                </p>
                                                            )}
                                                            {isStreakLocked
                                                                ? <p className="text-yellow-400 text-xs font-black italic mt-1">🔒 Requires {perk.streakOnly}-Day Streak</p>
                                                                : <p className="text-yellow-400 text-xs font-black italic mt-1">{perk.cost} XP</p>
                                                            }
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => !isStreakLocked && !limitReached && handleRedeemPerk(perk.id, perk.name, perk.cost)}
                                                        disabled={!canAfford || redeeming}
                                                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
                                                            canAfford
                                                                ? 'bg-[var(--bg-accent)] text-white hover:bg-[var(--bg-accent)]/90 shadow-md' 
                                                                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-color)] cursor-not-allowed'
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
