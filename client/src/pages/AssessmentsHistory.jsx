import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    History, 
    ChevronRight, 
    Trophy, 
    Clock, 
    Calendar, 
    CheckCircle2, 
    XCircle,
    ArrowLeft,
    Search,
    Filter,
    User,
    Book,
    Brain,
    Activity,
    Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useApiQuery from '../hooks/useApiQuery';
import { ListSkeleton } from '../components/ui/ShimmerSkeleton';
import DashboardLayout from '../components/DashboardLayout';

const AssessmentsHistory = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    // Centralized Data Orchestration with SWR Caching
    const { data: historyData, loading, error, refetch } = useApiQuery('/quiz/history/student', {
        errorMessage: 'Archives could not be retrieved'
    });

    const history = historyData || [];

    const formatTime = (date) => {
        if (!date) return '00:00:00 XX';
        return new Date(date).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit', 
            hour12: true 
        }).toUpperCase();
    };

    const formatDate = (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const filteredHistory = history.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             (item.topic && item.topic.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesFilter = filterStatus === 'all' || 
                             (filterStatus === 'completed' && item.isAttempted) ||
                             (filterStatus === 'missed' && !item.isAttempted);
        return matchesSearch && matchesFilter;
    });

    if (loading && history.length === 0) return (
        <DashboardLayout role="student">
            <div className="max-w-6xl mx-auto py-8">
                <div className="h-40 bg-white/5 rounded-[2.5rem] mb-12 animate-pulse" />
                <ListSkeleton count={5} />
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout role="student">
            <div className="max-w-6xl mx-auto py-8">
                
                {/* Cinematic Header Banner (Enterprise Aesthetic) */}
                <motion.div 
                    initial={{ opacity: 0, y: -40 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden bg-gradient-to-br from-[#0a0a0b] via-[var(--bg-secondary)] to-[#050506] rounded-[3.5rem] border border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.8)] mb-12"
                >
                    {/* Atmospheric Lighting */}
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--bg-accent)]/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/4" />
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/4" />
                    
                    <div className="relative z-10 px-10 py-10 sm:px-14 sm:py-12 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                        <div className="space-y-4">
                            <motion.div 
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="flex items-center gap-3"
                            >
                                <div className="h-[2px] w-10 bg-[var(--bg-accent)] rounded-full shadow-[0_0_10px_var(--bg-accent-glow)]" />
                                <p className="text-[9px] font-black text-[var(--text-accent)] uppercase tracking-[0.6em] italic">Session Analytics</p>
                            </motion.div>
                            
                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white italic uppercase tracking-tighter leading-[0.95]">
                                Quiz History <br />
                                <span className="text-[var(--text-accent)] drop-shadow-[0_0_30px_var(--bg-accent-glow)]">& Yields</span>
                            </h1>
                            
                            <p className="text-sm font-medium text-white/50 max-w-xl leading-relaxed">
                                A comprehensive repository of your tactical evolution and performance yields. Every session analyzed for your academic progression.
                            </p>
                        </div>

                        {/* Animated Kinetic Icon with Magnetic Shimmer */}
                        <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.8, type: "spring" }}
                            className="relative flex items-center justify-center lg:pr-6"
                        >
                            <motion.div 
                                animate={{ 
                                    rotateX: [0, 10, -10, 0],
                                    rotateY: [0, -15, 15, 0],
                                    y: [-5, 5, -5]
                                }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                className="w-24 h-24 sm:w-32 sm:h-32 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center relative backdrop-blur-3xl overflow-hidden group shadow-[0_0_40px_rgba(215,172,40,0.15)]"
                                style={{ perspective: "1000px" }}
                            >
                                {/* Neural Light Sweep */}
                                <motion.div 
                                    animate={{ 
                                        left: ["-100%", "200%"] 
                                    }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
                                    className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -rotate-45"
                                />

                                <motion.div 
                                    animate={{ 
                                        scale: [1, 1.1, 1],
                                        filter: ["drop-shadow(0 0 10px rgba(215, 172, 40, 0.4))", "drop-shadow(0 0 30px rgba(215, 172, 40, 0.7))", "drop-shadow(0 0 10px rgba(215, 172, 40, 0.4))"]
                                    }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                    className="text-[var(--text-accent)] relative z-10"
                                >
                                    <Clock size={48} strokeWidth={1.5} />
                                </motion.div>
                                
                                {/* Orbital Ring */}
                                <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 border border-[var(--bg-accent)]/20 rounded-[3rem] border-dashed"
                                />
                            </motion.div>
                        </motion.div>
                    </div>
                </motion.div>

                {/* Tactical Controls Row */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6 px-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-96">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--text-accent)] drop-shadow-[0_0_10px_rgba(255,183,0,0.5)]" size={20} />
                            <input 
                                type="text"
                                placeholder="Query the repositories..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[var(--bg-secondary)] backdrop-blur-xl border-2 border-white/10 rounded-[1.5rem] py-4 pl-16 pr-8 text-white text-base font-black placeholder:text-white/60 focus:outline-none focus:border-[var(--text-accent)] focus:bg-white/10 transition-all shadow-2xl"
                            />
                        </div>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                        <div className="relative w-full md:w-56">
                            <Filter className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--text-accent)]" size={16} />
                            <select 
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full bg-[var(--bg-secondary)] backdrop-blur-xl border-2 border-white/10 rounded-[1.5rem] py-4 pl-14 pr-8 text-white font-black text-[10px] uppercase tracking-[0.2em] focus:outline-none focus:border-[var(--text-accent)] transition-all appearance-none cursor-pointer shadow-2xl"
                            >
                                <option value="all" className="bg-[var(--bg-secondary)]">All Status</option>
                                <option value="completed" className="bg-[var(--bg-secondary)]">Completed</option>
                                <option value="missed" className="bg-[var(--bg-secondary)]">Missed</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Imperial Row List */}
                <div className="space-y-6">
                    <AnimatePresence mode='popLayout'>
                        {filteredHistory.map((item, index) => {
                            const accuracy = Math.round((item.score / (item.totalQuestions * 10)) * 100);
                            const isFirst = item.rank === 1;
                            
                            return (
                                <motion.div
                                    key={item.id || `hist-${index}`}
                                    layout
                                    initial={{ opacity: 0, x: -30 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                                    className={`glass-panel rounded-[2.5rem] ${isFirst ? 'border-[var(--text-accent)] shadow-[0_0_50px_rgba(215,172,40,0.15)]' : 'border-white/5'} transition-all group relative overflow-hidden`}
                                >
                                    {isFirst && <div className="rank-shine-overlay" />}
                                    
                                    <div className="p-8">
                                        {/* Top Section */}
                                        <div className="flex flex-col lg:flex-row justify-between gap-8 mb-8">
                                            <div className="space-y-3">
                                                <h3 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter group-hover:text-[var(--text-accent)] transition-colors leading-tight">
                                                    {item.title}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-80">
                                                    <div className="flex items-center gap-2">
                                                        <User size={14} className="text-[var(--text-accent)]" />
                                                        Conducted by: <span className="text-white">{item.conductedBy}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Book size={14} className="text-[var(--text-accent)]" />
                                                        Subject: <span className="text-white">{item.subject}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-6 lg:text-right">
                                                {[
                                                    { label: 'Conducted Date', val: formatDate(item.date) },
                                                    { label: 'Started Time', val: formatTime(item.startedAt) },
                                                    { label: 'Ended Time', val: formatTime(item.completedAt) }
                                                ].map((t, i) => (
                                                    <div key={i}>
                                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-1">{t.label}</p>
                                                        <p className="text-sm font-black text-white italic">{t.val}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Score & Action System */}
                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-white/5 pt-6">
                                            <div className="flex flex-wrap items-center gap-3">
                                                {item.isAttempted ? (
                                                    <>
                                                        <div className="bg-[var(--text-accent)] text-[var(--bg-primary)] px-4 py-1.5 rounded-lg font-black text-xs italic shadow-lg">
                                                            {accuracy}%
                                                        </div>
                                                        {item.rank && (
                                                            <div className="bg-white/5 px-4 py-1.5 rounded-lg text-white/60 font-black text-xs italic border border-white/5">
                                                                Rank #{item.rank}
                                                            </div>
                                                        )}
                                                        <div className="bg-[#B371E0]/20 border border-[#B371E0]/30 px-4 py-1.5 rounded-lg text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                                                            <Brain size={12} className="text-[#B371E0]" /> AI Available
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="bg-rose-500/10 border border-rose-500/20 px-4 py-1.5 rounded-lg text-rose-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                                                        <XCircle size={12} aria-hidden="true" /> No Attempt
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                                {item.isAttempted ? (
                                                    <>
                                                        <button 
                                                            onClick={() => navigate(`/report/${item.id}`)}
                                                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 transition-all btn-press"
                                                        >
                                                            <Activity size={16} className="text-[var(--text-accent)]" aria-hidden="true" /> View Report
                                                        </button>
                                                        <button 
                                                            onClick={() => navigate(`/report/${item.id}`, { state: { showAnalytics: true } })}
                                                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--bg-accent)] text-[var(--text-on-accent)] font-black text-[10px] uppercase tracking-[0.2em] hover:opacity-90 transition-all btn-press shadow-lg shadow-[var(--bg-accent-glow)]"
                                                        >
                                                            <Activity size={16} aria-hidden="true" /> View Analytics
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button className="w-full sm:w-auto px-8 py-3 rounded-xl bg-white/5 text-white/20 font-black text-[10px] uppercase tracking-widest border border-white/5 cursor-not-allowed">
                                                        Locked
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {/* Empty State System */}
                {filteredHistory.length === 0 && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-40 glass-panel rounded-[3rem] border border-white/5"
                    >
                        <Trophy size={100} className="mx-auto text-white/5 mb-8" />
                        <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-4">The Archives are Empty</h3>
                        <p className="text-[var(--text-secondary)] opacity-70 font-black uppercase tracking-[0.3em] text-[10px]">
                            No assessment records found in the neural link.
                        </p>
                    </motion.div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default AssessmentsHistory;
