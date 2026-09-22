import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { Play, Clock, BookOpen, Search, Filter, Calendar, Trophy, ChevronRight, ChevronDown, Loader2, Sparkles, AlertCircle, CheckCircle, Lock, BarChart2, Zap, Puzzle, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useApiQuery } from '../hooks/useApiQuery';
import { ListSkeleton, ShimmerSkeleton } from '../components/ui/ShimmerSkeleton';
import { royalAlert, showError } from '../utils/alerts';
import { cleanQuizTitle } from '../utils/cleanTitle';

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

const difficultyOptions = [
    { value: 'All', label: 'ALL DIFFICULTIES' },
    { value: 'Easy', label: 'EASY' },
    { value: 'Medium', label: 'MEDIUM' },
    { value: 'Thinkable', label: 'THINKABLE' },
    { value: 'Hard', label: 'HARD' },
];

const statusOptions = [
    { value: 'All', label: 'ALL STATUSES' },
    { value: 'Attempted', label: 'ATTEMPTED' },
    { value: 'Unattempted', label: 'UNATTEMPTED' },
];

function CustomSelect({ value, onChange, options, ariaLabel }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    const selectedOption = options.find(option => option.value === value) || options[0];

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            setIsOpen(false);
            return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const currentIndex = options.findIndex(option => option.value === value);
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            const nextIndex = (currentIndex + direction + options.length) % options.length;
            onChange(options[nextIndex].value);
            setIsOpen(true);
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsOpen(prev => !prev);
        }
    };

    return (
        <div ref={containerRef} className="relative w-full">
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={ariaLabel}
                onClick={() => setIsOpen(prev => !prev)}
                onKeyDown={handleKeyDown}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#e4d6c3] bg-[#fffdfb] px-4 py-3 text-left shadow-[inset_0_1px_2px_rgba(15,23,42,0.02),0_8px_20px_rgba(15,23,42,0.02)] transition-all duration-200 ease-out hover:border-[#d7b48a] hover:shadow-[0_10px_22px_rgba(15,23,42,0.04)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
                <span className="truncate text-xs font-black uppercase tracking-[0.12em] text-[#0f172a]">
                    {selectedOption.label}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f3eee8] text-[#111111] transition-all duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </span>
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-[1.35rem] border border-[#e8dcc5] bg-[#fffdfb] shadow-[0_20px_40px_rgba(15,23,42,0.10)] ring-1 ring-[#f4ecdf] backdrop-blur-sm">
                    <ul role="listbox" aria-label={ariaLabel} className="py-2">
                        {options.map((option) => {
                            const isSelected = value === option.value;

                            return (
                                <li key={option.value} className="px-1.5">
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-black uppercase tracking-[0.12em] transition-all duration-200 ${
                                            isSelected
                                                ? 'bg-[#f5efe7] text-[#111111] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]'
                                                : 'text-[#0f172a] hover:bg-[#f4f1ec] hover:text-[#111111]'
                                        }`}
                                    >
                                        <span>{option.label}</span>
                                        {isSelected && (
                                            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-[#111111]" aria-hidden="true">
                                                <path d="M5 10.5L8.2 13.7L15 6.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default function Assessments() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    // Filters state
    const [filterDifficulty, setFilterDifficulty] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');

    // Integrated centralized data fetching with 30s caching
    const { data: quizzes, loading, error, refetch } = useApiQuery('/quiz/available', {
        errorMessage: 'Could not load assessment records'
    });

    const safeQuizzes = (quizzes || []).filter(q => q.isAssessment === true);

    const filteredQuizzes = safeQuizzes.filter(q => {
        const matchesSearch = q.title.toLowerCase().includes(search.toLowerCase()) ||
            q.topic?.toLowerCase().includes(search.toLowerCase());
            
        const matchesDifficulty = filterDifficulty === 'All' || q.difficulty === filterDifficulty;
        
        let matchesStatus = true;
        if (filterStatus === 'Attempted') matchesStatus = q.isAttempted;
        else if (filterStatus === 'Unattempted') matchesStatus = !q.isAttempted;
        
        return matchesSearch && matchesDifficulty && matchesStatus;
    });

    const handleAttemptClick = (quiz) => {
        const now = new Date();
        const startTime = quiz.startTime ? new Date(quiz.startTime) : null;
        const endTime = quiz.endTime ? new Date(quiz.endTime) : null;

        const startStr = startTime ? startTime.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';
        const endStr = endTime ? endTime.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';

        if (quiz.isAttempted) {
            return navigate(`/report/${quiz.id}`);
        }

        if (startTime && now < startTime) {
            return royalAlert.fire({
                icon: 'info',
                title: 'Assessment Not Started',
                text: `This assessment has not started yet. It will start at ${startStr}. Please check back then!`,
                confirmButtonText: 'UNDERSTOOD'
            });
        }

        if (endTime && now > endTime) {
            return royalAlert.fire({
                icon: 'error',
                title: '⏰ Assessment Expired',
                text: `The window for this assessment closed at ${endStr}. This assessment is no longer available for attempt.`,
                confirmButtonText: 'CLOSE'
            });
        }

        navigate(`/quiz/attempt/${quiz.id}`);
    };

    const completedQuizzes = safeQuizzes.filter(q => q.isAttempted);
    const avgScore = completedQuizzes.length > 0 
        ? Math.round(completedQuizzes.reduce((sum, q) => sum + q.score, 0) / completedQuizzes.length) 
        : 0;

    const stats = [
        { label: 'Available', value: safeQuizzes.filter(q => !q.isLocked && !q.isExpired && !q.isAttempted).length, icon: Play, color: 'text-indigo-600', bg: 'bg-indigo-50/80 border border-indigo-100' },
        { label: 'Completed', value: completedQuizzes.length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50/80 border border-emerald-100' },
        { label: 'Avg. Score', value: avgScore, icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50/80 border border-amber-100', suffix: '%' }
    ];

    if (loading && safeQuizzes.length === 0) return (
        <DashboardLayout role="student">
            <div className="max-w-7xl mx-auto px-4 py-12">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div className="space-y-4 w-full md:w-auto">
                        <ShimmerSkeleton className="h-16 w-64" />
                        <ShimmerSkeleton className="h-4 w-48" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {[...Array(3)].map((_, i) => <ShimmerSkeleton key={i} className="h-32 rounded-[2rem]" />)}
                </div>
                <ListSkeleton count={4} />
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout role="student">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="max-w-7xl mx-auto px-4 py-12"
            >
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-hero-fluid font-black text-[#111111] italic uppercase tracking-tighter mb-4">
                            Assessment <span className="text-[var(--text-accent)]">Arena</span>
                        </h1>
                        <p className="text-[#555555] font-bold uppercase tracking-widest text-[10px]">Select a tactical trial to initiate your progression</p>
                    </div>
                </div>

                {/* Search & Filters Controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-10 bg-[var(--student-surface)] border border-[var(--student-border)] p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-[var(--student-shadow-md)]">
                    {/* Search */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-[#334155] uppercase tracking-[0.24em]">Search</label>
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3d4b5d] transition-colors group-focus-within:text-[#f97316]" size={16} />
                            <input
                                type="text"
                                placeholder="SEARCH QUIZZES..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-[var(--student-surface-alt)] border border-[var(--student-border)] rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-[#0f172a] placeholder:text-[#475569] placeholder:font-bold transition-all duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:border-[var(--bg-accent)] focus:outline-none focus:border-[var(--bg-accent)] focus:ring-4 focus:ring-[var(--bg-accent-glow)]"
                            />
                        </div>
                    </div>

                    {/* Difficulty */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-[#334155] uppercase tracking-[0.24em]">Difficulty</label>
                        <CustomSelect value={filterDifficulty} onChange={setFilterDifficulty} options={difficultyOptions} ariaLabel="Select difficulty" />
                    </div>

                    {/* Status */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-[#334155] uppercase tracking-[0.24em]">Status</label>
                        <CustomSelect value={filterStatus} onChange={setFilterStatus} options={statusOptions} ariaLabel="Select status" />
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
                            className="bg-[var(--student-surface)] border border-[var(--student-border)] group relative p-6 rounded-[2rem] flex items-center gap-5 transition-all duration-300 shadow-[var(--student-shadow-soft)]"
                        >
                            <div className={`w-14 h-14 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color} shadow-xs shrink-0`}>
                                <stat.icon size={26} aria-hidden="true" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-[#555555] uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                                <p className="text-3xl font-black text-[#111111] italic">
                                    <CountUp end={stat.value} />
                                    {stat.suffix}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
                {/* Quizzes List */}
                <div className="space-y-6 sm:space-y-8" role="list" aria-label="Available quizzes" aria-live="polite">
                    <AnimatePresence mode="popLayout">
                        {filteredQuizzes.length > 0 ? (
                            filteredQuizzes.map((quiz, i) => {
                                const startStr = quiz.startTime 
                                    ? new Date(quiz.startTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                                    : null;
                                const endStr = quiz.endTime
                                    ? new Date(quiz.endTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                                    : null;

                                return (
                                    <motion.div
                                        key={quiz.id || quiz._id}
                                        role="listitem"
                                        layout
                                        initial={{ y: 30, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        exit={{ scale: 0.95, opacity: 0 }}
                                        transition={{ delay: i * 0.08 }}
                                        className={`group bg-[var(--student-surface)] border border-[var(--student-border)] rounded-[2rem] p-6 sm:p-8 transition-all duration-300 shadow-[var(--student-shadow-soft)] hover:shadow-[var(--student-shadow-md)] ${
                                            quiz.isLocked 
                                                ? 'border-indigo-500/30 bg-indigo-50/20' 
                                                : quiz.isExpired 
                                                ? 'border-red-500/20 bg-red-50/20'
                                                : quiz.isAttempted
                                                ? 'border-emerald-500/30 bg-emerald-50/20'
                                                : ''
                                        }`}
                                    >
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div className="flex items-start gap-5 min-w-0 flex-1">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                                                    quiz.isLocked
                                                        ? 'bg-indigo-500/10 text-indigo-600'
                                                        : quiz.isExpired
                                                        ? 'bg-red-500/10 text-red-600'
                                                        : quiz.isAttempted
                                                        ? 'bg-emerald-500/10 text-emerald-600'
                                                        : 'bg-[var(--bg-accent)]/10 text-[var(--text-accent)]'
                                                }`}>
                                                    {quiz.isLocked ? (
                                                        <Lock size={24} aria-hidden="true" />
                                                    ) : quiz.isExpired ? (
                                                        <AlertCircle size={24} aria-hidden="true" />
                                                    ) : quiz.isAttempted ? (
                                                        <CheckCircle size={24} aria-hidden="true" />
                                                    ) : (
                                                        <BookOpen size={24} aria-hidden="true" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-3 mb-1">
                                                        <h3 className="text-lg font-black text-[#111111] group-hover:text-[var(--text-accent)] transition-colors break-words">{cleanQuizTitle(quiz.title)}</h3>
                                                        {quiz.gameType === 'cyber_quest' && (
                                                            <span className="px-3 py-1 text-[8px] font-black uppercase tracking-wider rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-800 flex items-center gap-1">
                                                                <Trophy size={12} aria-hidden="true" /> CYBER QUEST
                                                            </span>
                                                        )}
                                                        {quiz.gameType === 'sprint_arena' && (
                                                            <span className="px-3 py-1 text-[8px] font-black uppercase tracking-wider rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-800 flex items-center gap-1">
                                                                <Zap size={12} aria-hidden="true" /> SPRINT ARENA
                                                            </span>
                                                        )}
                                                        {quiz.gameType === 'match_up' && (
                                                            <span className="px-3 py-1 text-[8px] font-black uppercase tracking-wider rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-800 flex items-center gap-1">
                                                                <Puzzle size={12} aria-hidden="true" /> MATCH-UP ARENA
                                                            </span>
                                                        )}
                                                        {(!quiz.gameType || quiz.gameType === 'standard') && (
                                                            <span className="px-3 py-1 text-[8px] font-black uppercase tracking-wider rounded-full bg-slate-500/10 border border-slate-500/30 text-slate-700 flex items-center gap-1">
                                                                <FileText size={12} aria-hidden="true" /> STANDARD MODE
                                                            </span>
                                                        )}
                                                        {quiz.isLocked && (
                                                            <span className="px-3 py-1 text-[8px] font-black uppercase tracking-wider rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-700 animate-pulse">
                                                                SCHEDULED
                                                            </span>
                                                        )}
                                                        {quiz.isExpired && (
                                                            <span className="px-3 py-1 text-[8px] font-black uppercase tracking-wider rounded-full bg-red-500/10 border border-red-500/20 text-red-700">
                                                                EXPIRED
                                                            </span>
                                                        )}
                                                        {quiz.wasLiveCompleted && (
                                                            <span className="inline-flex items-center whitespace-nowrap px-3 py-1.5 text-[9px] leading-none font-black uppercase tracking-[0.08em] rounded-full bg-blue-100 border border-blue-400 text-blue-800 opacity-100 shadow-sm">
                                                                LIVE COMPLETED
                                                            </span>
                                                        )}
                                                        {quiz.isAttempted && !quiz.wasLiveCompleted && (
                                                            <span className="px-3 py-1 text-[8px] font-black uppercase tracking-wider rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700">
                                                                COMPLETED
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Timing and metadata indicators */}
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[#555555] text-[10px] font-bold uppercase tracking-widest leading-none">
                                                            <span className="flex items-center gap-1.5"><Clock size={12} aria-hidden="true" /> {quiz.duration > 0 ? `${quiz.duration} Mins` : 'Untimed'}</span>
                                                            <span className="flex items-center gap-1.5"><BookOpen size={12} aria-hidden="true" /> {quiz.totalQuestions || 0} Questions</span>
                                                            <span className="flex items-center gap-1.5"><Filter size={12} aria-hidden="true" /> {quiz.difficulty || 'Normal'}</span>
                                                        </div>
                                                        {quiz.isLocked && startStr && (
                                                            <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider flex items-center gap-1">
                                                                <Calendar size={12} /> Starts: {startStr}
                                                            </span>
                                                        )}
                                                        {quiz.isExpired && endStr && (
                                                            <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider flex items-center gap-1">
                                                                <Calendar size={12} /> Ended: {endStr}
                                                            </span>
                                                        )}
                                                        {quiz.isAttempted && (
                                                            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                                                                <Trophy size={12} /> Score Obtained: {quiz.score}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end md:w-auto w-full">
                                                {quiz.isAttempted && (
                                                    <button
                                                        onClick={() => navigate(`/analytics/quiz/${quiz.id}`)}
                                                        className="bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-300 px-5 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all btn-press btn-hover-scale shadow-sm"
                                                        title="View detailed analytics"
                                                    >
                                                        <BarChart2 size={14} aria-hidden="true" />
                                                        Analytics
                                                    </button>
                                                )}
                                                {!quiz.isAttempted && (
                                                    <button
                                                        onClick={() => handleAttemptClick(quiz)}
                                                        className="bg-[var(--bg-accent)] hover:bg-[var(--bg-accent-hover)] text-white px-6 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all btn-press btn-hover-scale shadow-md"
                                                    >
                                                        <>
                                                            <Play size={14} fill="currentColor" aria-hidden="true" />
                                                            Start Assessment
                                                        </>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })
                        ) : (
                            /* Empty State Illustration */
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="flex flex-col items-center justify-center py-24 text-center"
                            >
                                <div className="w-32 h-32 bg-slate-100 border-2 border-slate-300 rounded-full flex items-center justify-center mb-8 relative">
                                    <Search size={48} className="text-slate-400" aria-hidden="true" />
                                    <motion.div 
                                        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                        transition={{ duration: 3, repeat: Infinity }}
                                        className="absolute inset-0 bg-[var(--bg-accent)]/5 rounded-full"
                                    />
                                </div>
                                <h3 className="text-2xl font-black text-[#111111] italic uppercase tracking-tight mb-2">No Challenges Found</h3>
                                <p className="text-[#555555] font-bold uppercase tracking-widest text-xs">The arena is currently quiet. Check back later!</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </DashboardLayout>
    );
}
