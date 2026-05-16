import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import toast from 'react-hot-toast';
import { 
    FileText, Type, Book, Cpu, BarChart3, Users,
    Sparkles, X, Mic, Plus, Trophy, Activity, Target, Zap, RefreshCw
} from 'lucide-react';

// CountUp — uses requestAnimationFrame instead of setInterval
// setInterval at 60fps was creating 180 state updates/second (60 × 3 cards)
const CountUp = ({ end, duration = 1 }) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (end === 0) { setCount(0); return; }
        let startTime = null;
        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = (timestamp - startTime) / 1000;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic for natural deceleration
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * end));
            if (progress < 1) requestAnimationFrame(animate);
            else setCount(end);
        };
        const frameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameId);
    }, [end, duration]);
    return <span>{count}</span>;
};

export default function TeacherDashboard() {
    const [stats,       setStats]       = useState({ totalQuizzes: 0, totalAttempts: 0, averageScore: 0 });
    const [showOptions, setShowOptions] = useState(false);
    const [loading,     setLoading]     = useState(true);
    const [refreshing,  setRefreshing]  = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [statsError,  setStatsError]  = useState(false);

    const fetchStats = async () => {
        try {
            setStatsError(false);
            const res = await api.get('/quiz/stats');
            const quizArray = res.data || [];
            const totalQuizzes   = quizArray.length;
            const totalAttempts  = quizArray.reduce((sum, q) => sum + (q.completionCount || 0), 0);
            const avg = quizArray.length > 0
                ? quizArray.reduce((sum, q) => sum + (q.averageScore || 0), 0) / quizArray.length
                : 0;
            setStats({ totalQuizzes, totalAttempts, averageScore: Math.round(avg) });
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Error fetching dashboard stats', err);
            setStatsError(true);
            toast.error('Could not load your stats. Check your connection.', {
                style: { background: '#1e293b', color: '#fff', borderRadius: '1rem' },
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchStats(); }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchStats();
    };

    const creationOptions = [
        { title: 'From Text', description: 'Write questions manually or paste content', icon: Type, path: '/create-quiz/text' },
        { title: 'From PDF', description: 'Upload a document and generate questions', icon: FileText, path: '/create-quiz/pdf' },
        { title: 'From Topic', description: 'Enter a topic and let AI build the quiz', icon: Book, path: '/create-quiz/topic' },
        { title: 'From Voice', description: 'Record yourself and convert to questions', icon: Mic, path: '/create-quiz/voice' }
    ];

    const statCards = [
        { label: 'Total Quizzes', value: stats.totalQuizzes, icon: FileText, color: 'text-[var(--text-accent)]', glow: 'var(--bg-accent-glow)' },
        { label: 'Total Attempts', value: stats.totalAttempts, icon: Users, color: 'text-blue-400', glow: 'rgba(59,130,246,0.2)' },
        { label: 'Average Score', value: stats.averageScore, icon: Target, color: 'text-green-400', suffix: '%', glow: 'rgba(34,197,94,0.2)' }
    ];

    return (
        <DashboardLayout role="teacher">
            <div className="relative min-h-[75vh] flex flex-col items-center py-10 font-inter">
                
                <div className="w-full max-w-6xl px-6 relative z-10 space-y-20">
                    
                    {/* Header System */}
                    <motion.div 
                        initial={{ opacity: 0, y: -30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="text-center space-y-6"
                    >
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white italic uppercase tracking-tighter leading-tight">
                            COMMAND <span className="text-[var(--text-accent)] drop-shadow-[0_0_20px_var(--bg-accent-glow)]">CENTER</span>
                        </h1>
                        <p className="text-[var(--text-secondary)] font-black uppercase tracking-[0.5em] text-[10px] opacity-40">Your quiz creation & management hub</p>
                    </motion.div>

                    {/* Stats Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[var(--text-secondary)] font-black uppercase tracking-[0.3em] text-[10px] opacity-50">Your Stats</p>
                            <div className="flex items-center gap-4">
                                {lastUpdated && (
                                    <p className="text-[9px] font-black text-white/10 uppercase tracking-widest italic" aria-live="polite">
                                        Last sync: {lastUpdated.toLocaleTimeString()}
                                    </p>
                                )}
                                <div className="flex gap-2">
                                    <motion.button
                                        onClick={handleRefresh}
                                        disabled={refreshing || loading}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        animate={refreshing ? { rotate: 360 } : {}}
                                        transition={refreshing ? { duration: 0.7, repeat: Infinity, ease: 'linear' } : {}}
                                        className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-accent)] hover:bg-[var(--bg-accent)]/10 border border-transparent hover:border-[var(--bg-accent)]/20 transition-all duration-300 disabled:opacity-40"
                                        aria-label="Refresh dashboard stats"
                                    >
                                        <RefreshCw size={15} />
                                    </motion.button>
                                </div>
                            </div>
                        </div>

                        {statsError ? (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="glass-panel p-8 rounded-[2rem] border border-red-500/10 bg-red-500/5 flex flex-col items-center gap-4 text-center"
                            >
                                <AlertCircle className="text-red-500" size={32} />
                                <div>
                                    <p className="text-white font-bold uppercase italic tracking-tight">Intelligence Feed Interrupted</p>
                                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-1">Check your network connection to restore sync</p>
                                </div>
                                <button 
                                    onClick={handleRefresh}
                                    className="px-6 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20"
                                >
                                    Retry Sync
                                </button>
                            </motion.div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {statCards.map((stat, i) => (
                                    <motion.div 
                                        key={i}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                        className="glass-panel p-6 md:p-10 rounded-[3rem] border border-white/5 group hover:border-white/10 transition-all duration-500 relative"
                                    >
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-white/10 transition-colors" />
                                        <div className="flex items-center gap-6 md:gap-8 relative z-10">
                                            <div 
                                                className={`w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] bg-white/[0.03] border border-white/10 flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform duration-500`}
                                                style={{ boxShadow: `inset 0 0 20px ${stat.glow}` }}
                                            >
                                                <stat.icon size={28} className="md:w-9 md:h-9" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-1 md:mb-2">{stat.label}</p>
                                                <p className="text-3xl md:text-4xl font-black text-white italic tracking-tighter">
                                                    <CountUp end={stat.value} />{stat.suffix}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Action Matrix */}
                    <div className="flex flex-col items-center">
                        <AnimatePresence mode="wait">
                            {!showOptions ? (
                                <motion.div
                                    key="main-action"
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 1.1, opacity: 0 }}
                                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                    className="w-full flex justify-center"
                                >
                                    <button
                                        onClick={() => setShowOptions(true)}
                                        className="group relative bg-[var(--bg-accent)] text-[var(--text-on-accent)] px-24 py-14 rounded-[4rem] font-black text-5xl italic tracking-tighter hover:scale-105 transition-all duration-700 shadow-[0_30px_60px_var(--bg-accent-glow)] active:scale-95 flex items-center gap-10 overflow-hidden btn-cinematic"
                                    >
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-700 blur-2xl" />
                                        <span className="relative z-10">+ Create New Quiz</span>
                                        <motion.div 
                                            className="relative z-10 bg-white/20 p-4 rounded-full"
                                            animate={{ 
                                                scale: [1, 1.1, 1],
                                                rotate: [0, 0, 0] 
                                            }}
                                            whileHover={{ rotate: 180, scale: 1.2 }}
                                            transition={{ 
                                                scale: { repeat: Infinity, duration: 2, ease: "easeInOut" },
                                                rotate: { duration: 0.7, ease: "anticipate" }
                                            }}
                                        >
                                            <Plus size={56} />
                                        </motion.div>
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="creation-grid"
                                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    className="w-full space-y-12"
                                >
                                    <div className="flex items-center justify-between max-w-5xl mx-auto w-full">
                                        <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                                            Choose <span className="text-[var(--text-accent)] drop-shadow-[0_0_10px_var(--bg-accent-glow)]">Quiz Type</span>
                                        </h2>
                                        <button
                                            onClick={() => setShowOptions(false)}
                                            className="p-5 bg-white/5 hover:bg-red-500/20 border border-white/5 hover:border-red-500/30 rounded-full text-white/20 hover:text-red-400 transition-all btn-cinematic"
                                        >
                                            <X size={32} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto w-full">
                                        {creationOptions.map((option, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, y: 30 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                            >
                                                <Link
                                                    to={option.path}
                                                    className="group h-full glass-panel rounded-[3.5rem] p-12 hover:border-[var(--bg-accent)]/50 hover:bg-white/[0.08] transition-all duration-500 flex flex-col items-center text-center relative overflow-hidden btn-cinematic"
                                                >
                                                    <div className="bg-white/5 w-24 h-24 rounded-[2rem] flex items-center justify-center text-[var(--text-accent)] mb-10 group-hover:bg-[var(--bg-accent)] group-hover:text-[var(--text-on-accent)] transition-all duration-700 shadow-2xl relative">
                                                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 blur-xl transition-opacity" />
                                                        <option.icon size={44} className="relative z-10" />
                                                    </div>
                                                    <h3 className="text-3xl font-black text-white italic tracking-tighter mb-5 group-hover:text-[var(--text-accent)] transition-colors uppercase leading-none">{option.title}</h3>
                                                    <p className="text-[var(--text-secondary)] font-black text-[11px] uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">{option.description}</p>
                                                    
                                                    <div className="mt-10 flex items-center gap-3 text-[var(--text-accent)] font-black text-[10px] uppercase tracking-[0.3em] opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                                                        Get Started <Zap size={16} fill="currentColor" className="animate-pulse" />
                                                    </div>
                                                </Link>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Navigation Sub-Matrix */}

                </div>
            </div>
        </DashboardLayout>
    );
}
