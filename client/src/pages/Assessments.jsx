import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { Play, Clock, BookOpen, Search, Filter, Calendar, Trophy, ChevronRight, Loader2, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useApiQuery } from '../hooks/useApiQuery';

// CountUp — requestAnimationFrame instead of setInterval
const CountUp = ({ end, duration = 1 }) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (end === 0) { setCount(0); return; }
        let startTime = null;
        const animate = (ts) => {
            if (!startTime) startTime = ts;
            const progress = Math.min((ts - startTime) / 1000 / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * end));
            if (progress < 1) requestAnimationFrame(animate);
            else setCount(end);
        };
        const id = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(id);
    }, [end, duration]);
    return <span>{count}</span>;
};

// Skeleton Loader Component
const SkeletonRow = () => (
    <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 relative overflow-hidden"
    >
        <motion.div 
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
        />
        <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/5 rounded-xl"></div>
                <div className="space-y-2">
                    <div className="w-48 h-4 bg-white/10 rounded"></div>
                    <div className="w-32 h-3 bg-white/5 rounded"></div>
                </div>
            </div>
            <div className="w-24 h-10 bg-white/5 rounded-xl"></div>
        </div>
    </motion.div>
);

export default function Assessments() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    // Integrated centralized data fetching with 30s caching
    const { data: quizzes = [], loading, error, refetch } = useApiQuery('/quiz/available', {
        errorMessage: 'Could not load intelligence dossiers'
    });

    const filteredQuizzes = quizzes.filter(q => 
        q.title.toLowerCase().includes(search.toLowerCase()) ||
        q.topic?.toLowerCase().includes(search.toLowerCase())
    );

    const stats = [
        { label: 'Available', value: quizzes.length, icon: Play, color: 'text-[var(--text-accent)]' },
        { label: 'Completed', value: 0, icon: CheckCircle, color: 'text-green-400' },
        { label: 'Avg. Score', value: 0, icon: Trophy, color: 'text-blue-400', suffix: '%' }
    ];

    return (
        <DashboardLayout role="student">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="max-w-6xl mx-auto px-4 py-12"
            >
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-2">
                            Assessment <span className="text-[var(--text-accent)]">Arena</span>
                        </h1>
                        <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Select a challenge to begin your journey</p>
                    </div>

                    {/* Animated Search Bar */}
                    <div className="relative">
                        <motion.div 
                            animate={{ width: isSearchFocused ? 320 : 240 }}
                            className="relative group transition-all"
                        >
                            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${isSearchFocused ? 'text-[var(--text-accent)]' : 'text-white/20'}`} size={18} />
                            <input
                                type="text"
                                placeholder="Search challenges..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setIsSearchFocused(false)}
                                className="w-full bg-white/[0.06] border border-white/20 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:border-[var(--bg-accent)] focus:bg-white/[0.08] transition-all font-medium"
                            />
                        </motion.div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {stats.map((stat, i) => (
                        <motion.div 
                            key={i}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-white/[0.02] border border-white/20 p-6 rounded-[2rem] flex items-center gap-5"
                        >
                            <div className={`w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center ${stat.color}`}>
                                <stat.icon size={28} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                                <p className="text-3xl font-black text-white italic">
                                    <CountUp end={stat.value} />
                                    {stat.suffix}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Quizzes List */}
                <div className="space-y-4">
                    {loading ? (
                        [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
                    ) : filteredQuizzes.length > 0 ? (
                        <AnimatePresence>
                            <div role="list" aria-label="Available quizzes" aria-live="polite">
                            {filteredQuizzes.map((quiz, i) => (
                                <motion.div
                                    key={quiz._id}
                                    role="listitem"
                                    initial={{ y: 30, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: i * 0.08 }}
                                    className="group bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-[var(--bg-accent)]/30 p-6 rounded-2xl transition-all duration-300"
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 bg-[var(--bg-accent)]/10 rounded-2xl flex items-center justify-center text-[var(--text-accent)] group-hover:scale-110 transition-transform">
                                                <BookOpen size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-white group-hover:text-[var(--text-accent)] transition-colors mb-1">{quiz.title}</h3>
                                                <div className="flex items-center gap-4 text-white/30 text-[10px] font-bold uppercase tracking-widest">
                                                    <span className="flex items-center gap-1.5"><Clock size={12} /> {quiz.questions?.length * 1} Min</span>
                                                    <span className="flex items-center gap-1.5"><Filter size={12} /> {quiz.difficulty || 'Normal'}</span>
                                                    <span className="flex items-center gap-1.5"><Trophy size={12} /> {quiz.questions?.length * 10} Pts</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => navigate(`/quiz/attempt/${quiz._id}`)}
                                            className="bg-[var(--bg-accent)] hover:bg-[var(--bg-accent-hover)] text-[var(--text-on-accent)] px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all btn-press btn-hover-scale shadow-lg shadow-[var(--bg-accent)]/10"
                                        >
                                            Start Challenge
                                            <Play size={14} fill="currentColor" />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                            </div>
                        </AnimatePresence>
                    ) : (
                        /* Empty State Illustration */
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex flex-col items-center justify-center py-24 text-center"
                        >
                            <div className="w-32 h-32 bg-white/[0.02] border-2 border-white/20 rounded-full flex items-center justify-center mb-8 relative">
                                <Search size={48} className="text-white/40" />
                                <motion.div 
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="absolute inset-0 bg-[var(--bg-accent)]/5 rounded-full"
                                />
                            </div>
                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tight mb-2">No Challenges Found</h3>
                            <p className="text-white/30 font-bold uppercase tracking-widest text-xs">The arena is currently quiet. Check back later!</p>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </DashboardLayout>
    );
}
