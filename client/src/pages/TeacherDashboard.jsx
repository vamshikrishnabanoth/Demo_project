import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import GlobalSearch from '../components/GlobalSearch';
import { useApiQuery } from '../hooks/useApiQuery';
import { 
    FileText, Type, Book, Cpu, BarChart3, Users,
    Sparkles, X, Mic, Plus, Trophy, Activity, Target, Zap, RefreshCw, AlertCircle, ArrowRight
} from 'lucide-react';
import SkeletonStat from '../components/loaders/SkeletonStat';
import { PremiumButton, GlassCard } from '../components/ui/Primitives';
import { uiTerminology } from '../utils/uiTerminology';

const CountUp = ({ end, duration = 1.5 }) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (end === 0) return;
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
        { title: uiTerminology.creationMethods.topic, description: 'AI builds full assessment from topic concepts', icon: Book, path: '/create-quiz/topic', badge: 'Recommended', color: 'bg-[var(--accent-sand)] text-[var(--text-accent)] border-[var(--border-color)]' },
        { title: uiTerminology.creationMethods.files, description: 'Extract questions from PDFs & Docx files', icon: FileText, path: '/create-quiz/pdf', badge: 'Document AI', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        { title: uiTerminology.creationMethods.audio, description: 'Convert live speech & lectures to questions', icon: Mic, path: '/create-quiz/voice', badge: 'Voice Engine', color: 'bg-purple-50 text-purple-700 border-purple-200' },
        { title: uiTerminology.creationMethods.text, description: 'Generate questions from raw text prompts', icon: Type, path: '/create-quiz/text', badge: 'Text Studio', color: 'bg-amber-50 text-amber-700 border-amber-200' }
    ];

    const statCards = [
        { label: 'Total Assessments', value: stats.totalQuizzes, icon: FileText, sub: 'Active Question Banks', badge: 'Synced', color: 'text-[var(--text-accent)]', bg: 'bg-[var(--accent-sand)]' },
        { label: 'Total Student Attempts', value: stats.totalAttempts, icon: Users, sub: 'Recorded Submissions', badge: '+12% this week', color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Average Accuracy', value: stats.averageScore, icon: Target, sub: 'Overall Mastery Level', suffix: '%', badge: 'Optimal Yield', color: 'text-indigo-600', bg: 'bg-indigo-50' }
    ];

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-[100rem] mx-auto px-6 py-6 space-y-10 relative">
                
                {/* MongoDB Atlas Style Hero Header Bar */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-white/90 backdrop-blur-md border-2 border-[var(--border-color)] rounded-3xl p-6 sm:p-8 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden"
                >
                    <div className="space-y-2 relative z-10">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Telemetry System
                            </span>
                            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider hidden sm:inline">v2.4 Production Engine</span>
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-black text-[var(--text-primary)] italic uppercase tracking-tight">
                            EDUCATOR <span className="text-[var(--text-accent)]">COMMAND CENTRAL</span>
                        </h1>
                        <p className="text-xs sm:text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider max-w-2xl">
                            Next-generation AI assessment generator, telemetry analytics, and interactive live quiz engine.
                        </p>
                    </div>
                </motion.div>

                {/* Real-time Telemetry Stats Cards (Stripe / MongoDB Atlas Style Grid) */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2.5">
                            <Activity className="text-[var(--text-accent)] animate-pulse" size={18} />
                            <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">Platform Analytics Telemetry</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            {lastUpdated && (
                                <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest italic hidden sm:block">
                                    Last Sync: {new Date(lastUpdated).toLocaleTimeString()}
                                </p>
                            )}
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing || loading}
                                className={`p-2 bg-white rounded-xl border border-[var(--border-color)] text-[var(--text-accent)] hover:text-[var(--bg-saffron-hover)] hover:border-[var(--bg-accent)] shadow-xs transition-all ${refreshing ? 'animate-spin' : ''}`}
                                title="Refresh System Telemetry"
                            >
                                <RefreshCw size={16} className="text-[var(--text-accent)]" />
                            </button>
                        </div>
                    </div>

                    {statsError ? (
                        <div className="bg-red-500/10 border-2 border-red-500/30 rounded-3xl p-8 text-center space-y-4 shadow-sm">
                            <AlertCircle className="text-red-500 mx-auto" size={36} />
                            <h3 className="text-lg font-black text-[var(--text-primary)] italic uppercase">Sync Disrupted</h3>
                            <p className="text-red-600 text-xs font-black uppercase tracking-wider">Reconnect to central database to restore real-time yields</p>
                            <button onClick={handleRefresh} className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-black uppercase text-xs tracking-wider">Retry Sync</button>
                        </div>
                    ) : loading ? (
                        <SkeletonStat />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {statCards.map((stat, i) => (
                                <div key={i} className="bg-white border-2 border-[var(--border-color)] rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-[var(--bg-accent)]/60 transition-all duration-300 group relative overflow-hidden">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-wider">{stat.label}</span>
                                        <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
                                            <stat.icon size={22} />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-4xl font-black text-[var(--text-primary)] italic tracking-tight">
                                            <CountUp end={stat.value} />{stat.suffix}
                                        </p>
                                        <div className="flex items-center justify-between pt-2">
                                            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">{stat.sub}</p>
                                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                                                {stat.badge}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Universal AI Creation Studio — Single Unified Input Option */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2.5 px-2">
                        <Cpu className="text-[var(--text-accent)]" size={18} />
                        <h2 className="text-xs font-black uppercase tracking-widest text-[#334155]">Universal AI Assessment Engine</h2>
                    </div>

                    {/* Informational Container Card (Non-clickable container) */}
                    <div className="bg-gradient-to-br from-white via-slate-50 to-[var(--accent-sand)]/50 border-2 border-[var(--border-color)] rounded-[2.5rem] p-8 sm:p-10 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative overflow-hidden">
                        <div className="space-y-4 max-w-2xl">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="p-3.5 rounded-2xl bg-[var(--bg-saffron)] text-white text-white-force shadow-md">
                                    <Sparkles size={26} className="!text-white text-white-force" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                                </div>
                                <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-[var(--accent-sand)] text-[var(--text-accent)] border border-[var(--border-color)]">
                                    All-In-One Multimodal Input Studio
                                </span>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-2xl sm:text-3xl font-black text-[#0f172a] italic uppercase tracking-tight" style={{ color: '#0f172a' }}>
                                    UNIVERSAL <span className="text-[var(--text-accent)]">AI QUIZ CREATOR</span>
                                </h3>
                                <p className="text-sm font-bold text-[#334155] leading-relaxed" style={{ color: '#334155' }}>
                                    Generate comprehensive assessments from any input format — Syllabus Topics, PDF Documents, Raw Text Prompts, Voice Recordings, or Video Content.
                                </p>
                            </div>

                            {/* Input Types Badges */}
                            <div className="flex flex-wrap gap-2 pt-2">
                                {[
                                    { label: 'Topics & Concepts', icon: Book },
                                    { label: 'PDFs & Documents', icon: FileText },
                                    { label: 'Raw Text & Code', icon: Type },
                                    { label: 'Voice & Lectures', icon: Mic }
                                ].map((inputItem, i) => (
                                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-white border border-slate-300 text-[#0f172a] shadow-2xs">
                                        <inputItem.icon size={14} className="text-[var(--text-accent)]" />
                                        <span>{inputItem.label}</span>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Actual Clickable Button */}
                        <Link
                            to="/create-quiz/topic"
                            className="bg-[var(--bg-saffron)] hover:bg-[var(--bg-saffron-hover)] text-white-force teacher-launch-btn flex items-center gap-3 px-8 py-5 rounded-2xl active:scale-95 shadow-lg hover:shadow-xl transition-all shrink-0 cursor-pointer group"
                            style={{ backgroundColor: 'var(--bg-accent)', color: 'var(--text-on-accent)' }}
                        >
                            <span className="font-black text-xs uppercase tracking-widest text-white-force" style={{ color: '#ffffff' }}>
                                LAUNCH AI STUDIO
                            </span>
                            <ArrowRight size={18} className="text-white-force group-hover:translate-x-1.5 transition-transform duration-200" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                        </Link>
                    </div>
                </div>

                {/* Footer Telemetry */}
                <div className="pt-8 border-t border-[var(--border-color)] flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.6em] text-[var(--text-secondary)] italic">KMIT KAHOOT ACADEMIC PLATFORM — SYSTEM OPERATIONAL</p>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">© 2026 KMIT</span>
                </div>
            </div>
        </DashboardLayout>
    );
}
