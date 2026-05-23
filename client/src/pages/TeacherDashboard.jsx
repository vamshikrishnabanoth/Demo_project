import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import GlobalSearch from '../components/GlobalSearch';
import toast from 'react-hot-toast';
import { useApiQuery } from '../hooks/useApiQuery';
import { 
    FileText, Type, Book, Cpu, BarChart3, Users,
    Sparkles, X, Mic, Plus, Trophy, Activity, Target, Zap, RefreshCw, AlertCircle
} from 'lucide-react';
import SkeletonStat from '../components/loaders/SkeletonStat';
import { PremiumButton, GlassCard } from '../components/ui/Primitives';
import { uiTerminology } from '../utils/uiTerminology';

const CountUp = ({ end, duration = 1.5 }) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (end === 0) { setCount(0); return; }
        let startTime = null;
        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = (timestamp - startTime) / 1000;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
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
    const [showOptions, setShowOptions] = useState(false);
    
    const { data: quizArray, loading, refreshing, lastUpdated, error: statsError, refetch: handleRefresh } = useApiQuery('/quiz/stats', {
        errorMessage: 'Network connection failure. Sync interrupted.'
    });

    const stats = useMemo(() => {
        const arr = quizArray || [];
        const totalQuizzes   = arr.length;
        const totalAttempts  = arr.reduce((sum, q) => sum + (q.completionCount || 0), 0);
        const avg = arr.length > 0
            ? arr.reduce((sum, q) => sum + (q.averageScore || 0), 0) / arr.length
            : 0;
        
        return { totalQuizzes, totalAttempts, averageScore: Math.round(avg) };
    }, [quizArray]);

    const creationOptions = [
        { title: uiTerminology.creationMethods.text, description: 'Create questions from text', icon: Type, path: '/create-quiz/text' },
        { title: uiTerminology.creationMethods.files, description: 'Extract questions from PDFs', icon: FileText, path: '/create-quiz/pdf' },
        { title: uiTerminology.creationMethods.topic, description: 'AI Builds from topic concepts', icon: Book, path: '/create-quiz/topic' },
        { title: uiTerminology.creationMethods.audio, description: 'Convert speech to questions', icon: Mic, path: '/create-quiz/voice' }
    ];

    const statCards = [
        { label: 'Total Assessments', value: stats.totalQuizzes, icon: FileText, color: 'text-[var(--text-accent)]', glow: 'var(--bg-accent-glow)' },
        { label: 'Total Attempts', value: stats.totalAttempts, icon: Users, color: 'text-blue-400', glow: 'rgba(59,130,246,0.2)' },
        { label: 'Average Accuracy', value: stats.averageScore, icon: Target, color: 'text-green-400', suffix: '%', glow: 'rgba(34,197,94,0.2)' }
    ];

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-[100rem] mx-auto px-6 py-4 space-y-12 sm:space-y-16 relative">
                


                {/* Hero Branding with Balanced Spacing & Reduced Contrast Noise */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="text-center space-y-3 relative z-20"
                >
                    <h1 className="text-hero-fluid font-black text-white italic uppercase tracking-tighter drop-shadow-[0_0_15px_var(--bg-accent-glow)]">
                        EDUCATOR <span className="text-[var(--text-accent)]">DASHBOARD</span>
                    </h1>
                    <p className="text-[var(--text-secondary)] font-black uppercase tracking-[0.5em] text-[10px] opacity-60 text-balance">Advanced Academic Assessment Platform</p>
                </motion.div>

                {/* Real-time Telemetry Section */}
                <div className="space-y-8">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <Activity className="text-[var(--text-accent)] animate-pulse" size={16} />
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/60">System Activity Feed</p>
                        </div>
                        <div className="flex items-center gap-4">
                            {lastUpdated && (
                                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest italic">
                                    Last Sync: {new Date(lastUpdated).toLocaleTimeString()}
                                </p>
                            )}
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing || loading}
                                className={`p-2 rounded-xl text-white/20 hover:text-[var(--text-accent)] transition-all ${refreshing ? 'animate-spin' : ''}`}
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    </div>

                    {statsError ? (
                        <GlassCard className="!bg-red-500/5 border-red-500/20 text-center space-y-4">
                            <AlertCircle className="text-red-500 mx-auto" size={40} />
                            <h3 className="text-xl font-black text-white italic uppercase">Sync Disrupted</h3>
                            <p className="text-red-400/60 text-xs font-black uppercase tracking-widest">Reconnect to central database to restore data</p>
                            <PremiumButton variant="danger" onClick={handleRefresh}>Retry Handshake</PremiumButton>
                        </GlassCard>
                    ) : loading ? (
                        <SkeletonStat />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {statCards.map((stat, i) => (
                                <GlassCard key={i} className="group">
                                    <div className="flex items-center gap-8">
                                        <div 
                                            className={`w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform duration-500`}
                                            style={{ boxShadow: `inset 0 0 20px ${stat.glow}` }}
                                        >
                                            <stat.icon size={32} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                                            <p className="text-3xl font-black text-white italic tracking-tighter">
                                                <CountUp end={stat.value} />{stat.suffix}
                                            </p>
                                        </div>
                                    </div>
                                </GlassCard>
                            ))}
                        </div>
                    )}
                </div>

                {/* Primary Action Architecture */}
                <div className="flex justify-center">
                    <AnimatePresence mode="wait">
                        {!showOptions ? (
                            <motion.div
                                key="main-btn"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.05 }}
                            >
                                <button
                                    onClick={() => setShowOptions(true)}
                                    className="group relative bg-[var(--bg-accent)] text-[var(--text-on-accent)] px-12 py-8 sm:px-24 sm:py-12 rounded-[2.5rem] sm:rounded-[4rem] font-black text-2xl sm:text-5xl italic tracking-tighter hover:scale-105 transition-all duration-700 shadow-[0_30px_60px_var(--bg-accent-glow)] active:scale-95 flex items-center gap-6 sm:gap-10 overflow-hidden btn-cinematic"
                                >
                                    <span className="relative z-10 uppercase">Create New Quiz</span>
                                    <div className="relative z-10 bg-white/20 p-3 sm:p-5 rounded-full group-hover:rotate-180 transition-transform duration-700">
                                        <Plus size={40} />
                                    </div>
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="grid-options"
                                initial={{ opacity: 0, y: 40 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="w-full space-y-12"
                            >
                                <div className="flex items-center justify-between w-full max-w-6xl mx-auto">
                                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Select <span className="text-[var(--text-accent)]">Method</span></h2>
                                    <button onClick={() => setShowOptions(false)} className="p-4 bg-white/5 hover:bg-red-500/10 rounded-full text-white/20 hover:text-red-500 transition-all">
                                        <X size={28} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 max-w-7xl mx-auto w-full">
                                    {creationOptions.map((opt, i) => (
                                        <motion.div 
                                            key={i} 
                                            initial={{ opacity: 0, y: 20 }} 
                                            animate={{ opacity: 1, y: 0 }} 
                                            transition={{ delay: i * 0.1 }}
                                            className="w-full flex"
                                        >
                                            <Link 
                                                to={opt.path} 
                                                className="group glass-panel w-full p-8 sm:p-10 rounded-[2.5rem] sm:rounded-[3rem] hover:border-[var(--bg-accent)]/50 hover:bg-white/[0.06] transition-all duration-300 text-center relative overflow-hidden flex flex-col items-center"
                                            >
                                                <div className="bg-white/5 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-[var(--text-accent)] mb-6 sm:mb-8 group-hover:bg-[var(--bg-accent)] group-hover:text-white transition-all duration-500 shadow-xl flex-shrink-0">
                                                    <opt.icon size={32} />
                                                </div>
                                                <h3 className="text-xl sm:text-2xl font-black text-white italic tracking-tighter mb-2 group-hover:text-[var(--text-accent)] transition-colors uppercase leading-tight">{opt.title}</h3>
                                                <p className="text-[var(--text-secondary)] font-black text-[9px] uppercase tracking-widest opacity-30 leading-relaxed">{opt.description}</p>
                                                
                                                <div className="mt-8 flex items-center justify-center gap-2 text-[var(--text-accent)] font-black text-[9px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                                                    Create <Zap size={14} fill="currentColor" />
                                                </div>
                                            </Link>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Telemetry */}
                <div className="pt-12 border-t border-white/5 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.8em] text-white/40 italic">System Status: Operational</p>
                </div>
            </div>
        </DashboardLayout>
    );
}
