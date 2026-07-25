import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area 
} from 'recharts';
import { 
    Trophy, Clock, Target, AlertCircle, ArrowLeft, 
    CheckCircle2, XCircle, Brain, 
    Zap, TrendingUp, HelpCircle, Activity, Sparkles, X, Home, Code
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import PremiumLoading from '../components/PremiumLoading';
import DashboardLayout from '../components/DashboardLayout';
import PremiumError from '../components/PremiumError';
import { uiTerminology } from '../utils/uiTerminology';

const AssessmentReport = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedReview, setSelectedReview] = useState(null);
    const [showDetailed, setShowDetailed] = useState(false);
    const [isDashHovered, setIsDashHovered] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(() => {
        return location.state?.showAnalytics ?? false;
    });

    const fetchReport = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/quiz/result/${id}`);
            setData(res.data);
        } catch (err) {
            console.error('Failed to fetch report:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (location.state?.reportData) {
            setData(location.state.reportData);
            setLoading(false);
        } else {
            fetchReport();
        }
    }, [fetchReport, location.state]);

    if (loading) return <PremiumLoading />;
    if (!data) return (
        <DashboardLayout role="student">
            <PremiumError 
                title="Tactical Link Severed" 
                message="The mission analysis for this session is unavailable or has been archived. Verify the operational ID and re-establish link."
                onRetry={fetchReport}
            />
        </DashboardLayout>
    );

    const { score, totalQuestions, answers, quizTitle, totalTimeTaken, createdAt, rank, totalParticipants } = data;
    const accuracy = Math.round((score / (totalQuestions * 10)) * 100);
    const avgTime = Math.round(totalTimeTaken / totalQuestions);

    // Data for Accuracy Pie Chart
    const pieData = [
        { name: 'Correct', value: answers.filter(a => a.isCorrect).length },
        { name: 'Incorrect', value: answers.filter(a => !a.isCorrect).length }
    ];
    const COLORS = ['#10b981', '#f43f5e'];

    // Theme 1: Blue Shades Only (Extreme High Contrast — Dark/Light Alternating)
    const BLUE_SHADES = [
        '#0B192C', // 1. Deep Midnight Navy (Very Dark)
        '#38BDF8', // 2. Vivid Electric Cyan (Very Light & Bright)
        '#1D4ED8', // 3. Royal Cobalt Blue (Rich Medium Dark)
        '#BAE6FD', // 4. Ice Cyan Blue (Pastel Extra Light)
        '#0369A1', // 5. Deep Ocean Azure (Medium Dark)
        '#2563EB', // 6. Bright Electric Indigo (Vivid Medium)
        '#0C4A6E', // 7. Dark Abyss Steel Navy (Dark)
        '#60A5FA', // 8. Soft Sky Powder Blue (Light)
        '#1E3A8A', // 9. Deep Ink Cobalt (Very Dark)
        '#06B6D4'  // 10. Bright Turquoise Cyan (Vivid Light)
    ];

    // Theme 2: Orange Shades Only (Extreme High Contrast — Dark/Light Alternating)
    const SAFFRON_SHADES = [
        '#9A3412', // 1. Deep Terracotta Rust (Very Dark)
        '#FED7AA', // 2. Soft Warm Apricot (Very Light)
        '#D96B27', // 3. Warm Heritage Saffron (Medium Dark)
        '#FFEDD5', // 4. Cream Peach Saffron (Pastel Extra Light)
        '#C2410C', // 5. Deep Burnt Orange (Dark)
        '#FF8C00', // 6. Vivid Dark Orange (Bright Medium)
        '#7C2D12', // 7. Dark Mahogany Rust (Extra Dark)
        '#FB923C', // 8. Warm Sunset Amber (Light)
        '#B8571B', // 9. Rich Crimson Saffron (Dark Medium)
        '#F59E0B'  // 10. Bright Golden Amber (Vivid Light)
    ];

    const isSaffronTheme = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'india';
    const GRAPH_SHADES = isSaffronTheme ? SAFFRON_SHADES : BLUE_SHADES;

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white border-2 border-[#9cbcd8] p-4 rounded-2xl shadow-xl backdrop-blur-md" style={{ color: '#0f172a' }}>
                    <p className="font-black text-[#0f172a] text-sm tracking-wide mb-1" style={{ color: '#0f172a' }}>{label || 'Metric'}</p>
                    <div className="border-t border-slate-200 my-2"></div>
                    {payload.map((entry, index) => {
                        const binColor = entry.payload?.fill || entry.fill || entry.color || '#133E87';
                        return (
                            <div key={index} className="flex items-center gap-2.5 text-xs py-1" style={{ color: '#0f172a' }}>
                                <div className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs border border-white" style={{ backgroundColor: binColor }} />
                                <span className="text-[#334155] font-bold" style={{ color: '#334155' }}>{entry.name === 'time' ? 'Time Spent' : entry.name || 'Value'}:</span>
                                <span className="font-black text-sm ml-1" style={{ color: binColor }}>
                                    {entry.value}
                                    <span className="text-[10px] ml-1 opacity-75 not-italic font-bold uppercase text-[#334155]" style={{ color: '#334155' }}>
                                        {entry.name === 'time' ? 'Sec' : ''}
                                    </span>
                                </span>
                            </div>
                        );
                    })}
                </div>
            );
        }
        return null;
    };

    // Data for Time Spent per Question
    const timeData = answers.map((a, i) => ({
        name: `Q${i + 1}`,
        time: a.timeTaken || 0,
        status: a.isCorrect ? 'Correct' : 'Incorrect'
    }));

    return (
        <DashboardLayout role="student">
            <div className="max-w-7xl mx-auto py-8">
                <AnimatePresence mode="wait">
                    {!showAnalytics ? (
                        <motion.div
                            key="rank-card"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.4 }}
                            className="max-w-lg mx-auto text-center py-10 px-4 font-inter relative select-none"
                        >
                            {/* Ambient background glow */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-[#133E87]/10 rounded-full blur-[90px] pointer-events-none -z-10" />
                            
                            {/* Theme-Matching Hero Trophy Icon Container */}
                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                                className="w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-white via-[#f0f6ff] to-[#dbeafe] border-2 border-[#9cbcd8] rounded-[2.2rem] flex items-center justify-center mx-auto mb-6 shadow-xl relative group cursor-pointer"
                            >
                                <motion.div 
                                    animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0.6, 0.3] }}
                                    transition={{ duration: 2.5, repeat: Infinity }}
                                    className="absolute inset-0 bg-[#133E87]/20 rounded-[2.2rem] blur-md pointer-events-none"
                                />
                                <Trophy className="text-amber-500 fill-amber-400 drop-shadow-md relative z-10" size={52} />
                                <Sparkles className="absolute top-2 right-2 text-amber-400 z-10" size={16} fill="currentColor" />
                            </motion.div>

                            <p className="text-[10px] font-black tracking-[0.4em] text-[var(--text-accent)] uppercase mb-2">Assessment Concluded</p>
                            <h2 className="text-2xl sm:text-4xl font-black italic tracking-tight text-[#0f172a] uppercase mb-6 leading-tight max-w-md mx-auto" style={{ color: '#0f172a' }}>
                                {quizTitle}
                            </h2>

                            {/* Premium Rank Card */}
                            <div className="bg-white border-2 border-[var(--border-color)] rounded-[2.5rem] p-8 sm:p-10 shadow-xl mb-8 space-y-6 relative overflow-hidden">
                                {/* Subtle Top Background Accent Ribbon */}
                                <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[var(--bg-accent)] to-[var(--text-accent)]"></div>
                                
                                <div className="space-y-2">
                                    <div className="inline-block px-4 py-1 rounded-full bg-[var(--bg-accent)]/10 border border-[var(--border-color)] mb-2">
                                        <p className="text-[10px] font-black text-[var(--text-accent)] uppercase tracking-[0.3em]">Final Standing</p>
                                    </div>
                                    <div className="flex flex-col items-center justify-center gap-1 w-full max-w-full overflow-hidden">
                                        <div className="drop-shadow-xs py-1 w-full max-w-full text-center">
                                            <span className={`inline-block px-4 font-black italic tracking-tight bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-accent)] bg-clip-text text-transparent leading-none ${
                                                `#${rank}`.length > 6 ? 'text-3xl md:text-4xl' :
                                                `#${rank}`.length > 5 ? 'text-4xl md:text-5xl' :
                                                `#${rank}`.length > 4 ? 'text-5xl md:text-6xl' :
                                                'text-6xl md:text-7xl'
                                            }`}>
                                                #{rank}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs font-extrabold text-[#4B5563] uppercase tracking-widest pt-1" style={{ color: '#4B5563' }}>
                                        Out of {totalParticipants} {totalParticipants === 1 ? 'Candidate' : 'Candidates'}
                                    </p>
                                </div>

                                <div className="w-full h-px bg-slate-200 my-4" />

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gradient-to-br from-[var(--accent-sand)] to-amber-50/50 border border-[var(--border-color)] p-4 rounded-2xl text-left">
                                        <p className="text-[9px] font-black text-[var(--text-accent)] uppercase tracking-widest mb-1">Tactical Yield</p>
                                        <p className="text-xl font-black italic text-[#0f172a]" style={{ color: '#0f172a' }}>{score} <span className="text-[10px] font-bold text-[#4B5563]">/ {totalQuestions * 10} Pts</span></p>
                                    </div>
                                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200 p-4 rounded-2xl text-left">
                                        <p className="text-[9px] font-black text-emerald-800 uppercase tracking-widest mb-1">Net Accuracy</p>
                                        <p className="text-xl font-black italic text-emerald-700">{accuracy}%</p>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                                <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => setShowAnalytics(true)}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-[var(--bg-saffron)] hover:bg-[var(--bg-saffron-hover)] text-white font-black text-xs uppercase tracking-widest transition-all shadow-md border border-[var(--bg-saffron)] cursor-pointer"
                                >
                                    <span className="!text-white font-black" style={{ color: '#ffffff' }}>Analytics</span> 
                                    <TrendingUp size={16} className="text-white" />
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.04 }}
                                    whileTap={{ scale: 0.96 }}
                                    onMouseEnter={() => setIsDashHovered(true)}
                                    onMouseLeave={() => setIsDashHovered(false)}
                                    onClick={() => navigate('/student-dashboard')}
                                    className="flex-1 flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-lg"
                                    style={{
                                        backgroundColor: isDashHovered ? 'var(--bg-saffron)' : 'var(--accent-sand)',
                                        borderColor: isDashHovered ? 'var(--bg-saffron)' : 'var(--border-color)',
                                        color: isDashHovered ? '#ffffff' : 'var(--text-accent)'
                                    }}
                                >
                                    <Home size={18} style={{ color: isDashHovered ? '#ffffff' : 'var(--text-accent)' }} className="transition-colors duration-200" />
                                    <span 
                                        className="font-black text-xs uppercase tracking-widest transition-colors duration-200"
                                        style={{ color: isDashHovered ? '#ffffff' : 'var(--text-accent)' }}
                                    >
                                        Dashboard
                                    </span>
                                </motion.button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="analytics-dashboard"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                        >
                            {/* Header System */}
                            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6 px-4">
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <button 
                                            onClick={() => navigate('/history')}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border-2 border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--bg-accent)] transition-all group btn-press shadow-sm"
                                            style={{ color: '#0f172a' }}
                                        >
                                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#0f172a' }}>Back to History</span>
                                        </button>
                                        <button 
                                            onClick={() => navigate('/student-dashboard')}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-accent)]/10 border border-[var(--bg-accent)]/30 text-[var(--text-accent)] hover:text-white transition-all group btn-press"
                                        >
                                            <Home size={16} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Go to Home</span>
                                        </button>
                                        <button 
                                            onClick={() => setShowAnalytics(false)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all btn-press"
                                        >
                                            <Trophy size={16} className="text-yellow-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Rank Summary</span>
                                        </button>
                                    </div>
                                    
                                    <h1 className="text-3xl md:text-6xl font-black text-white italic uppercase tracking-tighter flex items-center gap-4">
                                        <Zap className="text-[var(--text-accent)] drop-shadow-[0_0_15px_var(--bg-accent-glow)]" size={48} aria-hidden="true" />
                                        Strategic <span className="text-[var(--text-accent)]">Analytics</span>
                                    </h1>
                                    <p className="text-white/60 font-bold uppercase tracking-[0.4em] text-[10px] italic">
                                        Operational Brief: <span className="text-white">{quizTitle}</span> • {createdAt ? new Date(createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Temporal Log'}
                                    </p>
                                </div>
                            </div>

                            {/* Key Metrics Grid — Compact & Space-Efficient */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8 px-4">
                                {[
                                    { label: 'Tactical Rank', value: `#${rank}`, subValue: `of ${totalParticipants}`, icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50 border border-amber-200' },
                                    { label: 'Total Score', value: `${score}`, subValue: `of ${totalQuestions * 10}`, icon: Sparkles, color: 'text-orange-600', bg: 'bg-orange-50 border border-orange-200' },
                                    { label: 'Accuracy', value: `${accuracy}%`, icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50 border border-emerald-200' },
                                    { label: 'Time Spent', value: `${totalTimeTaken}s`, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50 border border-blue-200' },
                                    { label: 'Avg Speed', value: `${avgTime}s/q`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50 border border-purple-200' }
                                ].map((stat, i) => (
                                    <motion.div 
                                        key={i}
                                        initial={{ y: 15, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: i * 0.04 }}
                                        className="bg-white border-2 border-[#9cbcd8] p-4 sm:p-5 rounded-2xl shadow-xs hover:shadow-md hover:border-[#133E87] transition-all duration-200 group flex flex-col justify-between min-h-[105px]"
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className="text-[10px] font-black text-[#334155] uppercase tracking-wider truncate" style={{ color: '#334155' }}>
                                                {stat.label}
                                            </span>
                                            <div className={`w-8 h-8 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform`}>
                                                <stat.icon size={16} aria-hidden="true" />
                                            </div>
                                        </div>

                                        <div className="flex items-baseline gap-1.5 flex-wrap">
                                            <h3 className="font-black text-2xl text-[#0f172a] italic tracking-tight" style={{ color: '#0f172a' }}>
                                                {stat.value}
                                            </h3>
                                            {stat.subValue && (
                                                <span className="text-[10px] font-extrabold text-[#4B5563] uppercase tracking-wide" style={{ color: '#4B5563' }}>
                                                    {stat.subValue}
                                                </span>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Charts Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                {/* Accuracy Graph */}
                                <motion.div 
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="bg-white border-2 border-[var(--border-color)] rounded-[2.5rem] p-8 h-[400px] flex flex-col shadow-sm"
                                >
                                    <h3 className="text-xl font-black text-[#0f172a] mb-6 flex items-center gap-3 uppercase italic tracking-tight" style={{ color: '#0f172a' }}>
                                        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                                            <Target size={20} />
                                        </div>
                                        Accuracy Distribution
                                    </h3>
                                    <div className="flex-1">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={pieData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={80}
                                                    outerRadius={120}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                    stroke="none"
                                                >
                                                    {pieData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex justify-center gap-8 mt-4">
                                        <div className="flex items-center gap-2 text-xs font-bold text-[#334155]" style={{ color: '#334155' }}>
                                            <div className="w-3 h-3 rounded-full bg-emerald-500" /> Correct
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-[#334155]" style={{ color: '#334155' }}>
                                            <div className="w-3 h-3 rounded-full bg-rose-500" /> Incorrect
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Time Spent per Question */}
                                <motion.div 
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="bg-white border-2 border-[var(--border-color)] rounded-[2.5rem] p-8 h-[400px] flex flex-col shadow-sm"
                                >
                                    <h3 className="text-xl font-black text-[#0f172a] mb-6 flex items-center gap-3 uppercase italic tracking-tight" style={{ color: '#0f172a' }}>
                                        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                                            <Clock size={20} />
                                        </div>
                                        Time Spent per Question (Seconds)
                                    </h3>
                                    <div className="flex-1">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={timeData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                                <XAxis dataKey="name" stroke="#334155" fontSize={11} fontWeight="800" tick={{ fill: '#334155' }} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#334155" fontSize={11} fontWeight="800" tick={{ fill: '#334155' }} tickLine={false} axisLine={false} />
                                                <Tooltip 
                                                    cursor={{ fill: 'rgba(19,62,135,0.06)' }}
                                                    content={<CustomTooltip />}
                                                />
                                                <Bar dataKey="time" radius={[8, 8, 0, 0]} maxBarSize={45}>
                                                    {timeData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={GRAPH_SHADES[index % GRAPH_SHADES.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </motion.div>
                            </div>

                            {/* Question Wise Analysis Table */}
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white border-2 border-[#9cbcd8] rounded-[2.5rem] shadow-sm overflow-hidden"
                            >
                                {/* Table Card Header */}
                                <div className="p-6 sm:p-8 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#133E87]">
                                            <HelpCircle size={22} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-[#0f172a] uppercase italic tracking-tight" style={{ color: '#0f172a' }}>
                                                Question Wise <span className="text-[#133E87]">Analysis</span>
                                            </h3>
                                            <p className="text-[10px] font-black text-[#334155] uppercase tracking-widest" style={{ color: '#334155' }}>
                                                Directive Breakdown & Output Verification
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Table Container */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100/70 border-b border-slate-200">
                                                <th className="px-6 py-4 text-[10px] font-black text-[#334155] uppercase tracking-widest w-14 text-center">Rank</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-[#334155] uppercase tracking-widest min-w-[240px] max-w-sm">Question Directive</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-[#334155] uppercase tracking-widest min-w-[200px] max-w-xs">Your Input</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-[#334155] uppercase tracking-widest min-w-[200px] max-w-xs">Correct Target</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-[#334155] uppercase tracking-widest text-center w-32">Status</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-[#334155] uppercase tracking-widest w-20">Latency</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-[#334155] uppercase tracking-widest text-right w-24">{uiTerminology.arenaReview}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {answers.map((ans, idx) => {
                                                const isCodeInput = (ans.selectedOption && (ans.selectedOption.includes('{') || ans.selectedOption.includes(';') || ans.selectedOption.includes('```')));
                                                const isCodeTarget = (ans.correctOption && (ans.correctOption.includes('{') || ans.correctOption.includes(';') || ans.correctOption.includes('```')));

                                                return (
                                                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors border-b border-slate-100 group">
                                                        {/* Rank */}
                                                        <td className="px-6 py-5 text-[#4B5563] font-mono text-xs font-bold text-center align-top pt-6">
                                                            {idx + 1}
                                                        </td>

                                                        {/* Question Directive */}
                                                        <td className="px-6 py-5 align-top">
                                                            <div className="max-w-md">
                                                                <p className="text-[#0f172a] font-bold text-sm leading-snug break-words group-hover:text-[#133E87] transition-colors" style={{ color: '#0f172a' }}>
                                                                    {ans.questionText}
                                                                </p>
                                                            </div>
                                                        </td>

                                                        {/* Your Input */}
                                                        <td className="px-6 py-5 align-top">
                                                            <div className="max-w-xs">
                                                                {(!ans.selectedOption || ans.selectedOption.trim() === '') ? (
                                                                    <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                                                        <AlertCircle size={14} className="shrink-0" />
                                                                        <span>Skipped</span>
                                                                    </div>
                                                                ) : isCodeInput ? (
                                                                    <div className="bg-[#0f172a] text-[#f8fafc] border border-slate-700 rounded-xl p-3 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-36 whitespace-pre-wrap break-all shadow-xs">
                                                                        <div className="flex items-center justify-between text-[9px] font-sans text-slate-400 border-b border-slate-800 pb-1 mb-1.5 uppercase font-bold">
                                                                            <span>Code Input</span>
                                                                            <Code size={12} />
                                                                        </div>
                                                                        <code>{ans.selectedOption.replace(/```[a-z]*/g, '').trim()}</code>
                                                                    </div>
                                                                ) : (
                                                                    <div className={`p-3 rounded-2xl text-xs font-bold leading-relaxed break-words border ${
                                                                        ans.isCorrect 
                                                                            ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]' 
                                                                            : 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]'
                                                                    }`}>
                                                                        {ans.selectedOption}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Correct Target */}
                                                        <td className="px-6 py-5 align-top">
                                                            <div className="max-w-xs">
                                                                {isCodeTarget ? (
                                                                    <div className="bg-[#0f172a] text-[#f8fafc] border border-slate-700 rounded-xl p-3 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-36 whitespace-pre-wrap break-all shadow-xs">
                                                                        <div className="flex items-center justify-between text-[9px] font-sans text-slate-400 border-b border-slate-800 pb-1 mb-1.5 uppercase font-bold">
                                                                            <span>Target Code</span>
                                                                            <Code size={12} />
                                                                        </div>
                                                                        <code>{ans.correctOption.replace(/```[a-z]*/g, '').trim()}</code>
                                                                    </div>
                                                                ) : (
                                                                    <div className="p-3 rounded-2xl bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE] text-xs font-bold leading-relaxed break-words">
                                                                        {ans.correctOption}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Status */}
                                                        <td className="px-6 py-5 text-center align-top pt-6">
                                                            <div className="flex justify-center">
                                                                {ans.isCorrect ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0]">
                                                                        <CheckCircle2 size={14} className="shrink-0" /> Correct
                                                                    </span>
                                                                ) : (!ans.selectedOption || ans.selectedOption.trim() === '') ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A]">
                                                                        <AlertCircle size={14} className="shrink-0" /> Skipped
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#991B1B] bg-[#FEF2F2] border border-[#FCA5A5]">
                                                                        <XCircle size={14} className="shrink-0" /> Wrong
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Latency */}
                                                        <td className="px-6 py-5 text-[#334155] font-mono text-xs font-bold align-top pt-6">
                                                            {ans.timeTaken}s
                                                        </td>

                                                        {/* Action / Arena Review */}
                                                        <td className="px-6 py-5 text-right align-top pt-5">
                                                            <div className="flex justify-end">
                                                                <button
                                                                    onClick={() => setSelectedReview(ans)}
                                                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#133E87] hover:bg-[#0e2e65] text-white shadow-xs transition-all duration-200 active:scale-95 cursor-pointer"
                                                                    title={`View Full ${uiTerminology.arenaInsights}`}
                                                                    aria-label="View Insights"
                                                                >
                                                                    <Brain size={18} strokeWidth={2.25} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            
            {/* Arena Insights Modal Overlay */}
            <AnimatePresence>
                {selectedReview && (() => {
                    const questionObj = data.questions?.find(q => q.questionText === selectedReview.questionText);
                    const explanation = questionObj?.explanation || "";
                    const hasExplanation = explanation.trim().length > 0;
                    
                    const details = {
                        explanation: hasExplanation ? explanation : "No explanation available.",
                        confidence: hasExplanation ? "High" : "Low",
                        questionText: selectedReview.questionText,
                        correctOption: selectedReview.correctOption,
                        selectedOption: selectedReview.selectedOption,
                        isCorrect: selectedReview.isCorrect,
                        whyCorrect: hasExplanation ? explanation : "No explanation available.",
                        whyOthersIncorrect: !hasExplanation ? "" : (() => {
                            const otherOpts = questionObj?.options ? questionObj.options.filter(o => o !== selectedReview.correctOption) : [];
                            return otherOpts.length > 0 
                                ? `The alternate choices (${otherOpts.join(', ')}) do not align with the primary structural and logical requirements verified in the question directive.`
                                : "Alternate options present suboptimal, incorrect, or logically inconsistent states that deviate from correct execution pathways.";
                        })(),
                        takeaway: !hasExplanation ? "" : `Focus on the foundational patterns of this topic. Remember: ${selectedReview.correctOption} satisfies all logical constraints defined in the question directive.`
                    };

                    return (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => {
                                    setSelectedReview(null);
                                    setShowDetailed(false);
                                }}
                                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            />
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="relative w-full max-w-2xl bg-white rounded-[3rem] border-2 border-[#9cbcd8] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
                            >
                                {/* Sticky Top Header Bar — Keeps Close (X) button fixed and prevents scroll overlapping */}
                                <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md px-8 sm:px-10 py-6 border-b border-slate-200 flex items-center justify-between rounded-t-[3rem] shrink-0">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-[#133E87] flex items-center justify-center text-white shadow-md">
                                            <Brain size={24} className="text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl sm:text-2xl font-black text-[#0f172a] italic uppercase tracking-tight" style={{ color: '#0f172a' }}>Arena <span className="text-[#133E87]">Insights</span></h2>
                                            <p className="text-[9px] sm:text-[10px] font-black text-[#334155] uppercase tracking-[0.3em]" style={{ color: '#334155' }}>Deep Pedagogical Analysis</p>
                                        </div>
                                    </div>

                                    {/* Close Button — Pinned safely in Header Bar */}
                                    <button 
                                        onClick={() => {
                                            setSelectedReview(null);
                                            setShowDetailed(false);
                                        }}
                                        className="p-3 rounded-2xl bg-slate-100 text-[#0f172a] hover:bg-slate-200 active:scale-95 transition-all border border-slate-300 shadow-xs cursor-pointer"
                                        aria-label="Close review"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Scrollable Content Body */}
                                <div className="flex-1 overflow-y-auto no-scrollbar p-8 sm:p-10">
                                    <div className="space-y-8">
                                        <div>
                                            <p className="text-[10px] font-black text-[var(--text-accent)] uppercase tracking-[0.2em] mb-4">Question Directive</p>
                                            <p className="text-xl font-bold text-[#0f172a] leading-relaxed" style={{ color: '#0f172a' }}>{details.questionText}</p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200">
                                                <p className="text-[10px] font-black text-[#334155] uppercase tracking-[0.2em] mb-3" style={{ color: '#334155' }}>Your Input</p>
                                                <p className={`text-sm font-black italic uppercase ${details.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                    {details.selectedOption || 'No Input Detected'}
                                                </p>
                                            </div>
                                            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200">
                                                <p className="text-[10px] font-black text-[#334155] uppercase tracking-[0.2em] mb-3" style={{ color: '#334155' }}>Correct Target</p>
                                                <p className="text-sm font-black italic uppercase text-emerald-700">
                                                    {details.correctOption}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <div className="relative p-8 rounded-[2rem] bg-[var(--accent-sand)]/60 border-2 border-[var(--border-color)]">
                                                <div className="flex items-center justify-between mb-4">
                                                    <Sparkles size={20} className="text-[var(--text-accent)]" />
                                                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                                        details.confidence === 'High' 
                                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-400' 
                                                        : 'bg-amber-100 text-amber-800 border-amber-400'
                                                    }`}>
                                                        Confidence: {details.confidence}
                                                    </div>
                                                </div>
                                                
                                                {!showDetailed ? (
                                                    <div className="text-lg text-[#0f172a] font-bold leading-relaxed whitespace-pre-wrap italic" style={{ color: '#0f172a' }}>
                                                        {details.explanation}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-6 text-[#0f172a]">
                                                        <div>
                                                            <p className="text-[10px] font-black text-[var(--text-accent)] uppercase tracking-widest mb-1.5">Question Directive</p>
                                                            <p className="text-base font-bold leading-relaxed text-[#0f172a]" style={{ color: '#0f172a' }}>{details.questionText}</p>
                                                        </div>
                                                        <div className="pt-4 border-t border-slate-200">
                                                            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1.5">Correct Target</p>
                                                            <p className="text-sm font-bold leading-relaxed text-[#0f172a]" style={{ color: '#0f172a' }}>{details.correctOption}</p>
                                                        </div>
                                                        <div className="pt-4 border-t border-slate-200">
                                                            <p className="text-[10px] font-black text-[var(--text-accent)] uppercase tracking-widest mb-1.5">Why Correct</p>
                                                            <p className="text-sm font-bold leading-relaxed text-[#0f172a] italic" style={{ color: '#0f172a' }}>{details.whyCorrect}</p>
                                                        </div>
                                                        {details.whyOthersIncorrect && (
                                                            <div className="pt-4 border-t border-slate-200">
                                                                <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest mb-1.5">Why Other Options are Incorrect</p>
                                                                <p className="text-sm font-bold leading-relaxed text-[#0f172a]" style={{ color: '#0f172a' }}>{details.whyOthersIncorrect}</p>
                                                            </div>
                                                        )}
                                                        {details.takeaway && (
                                                            <div className="pt-4 border-t border-slate-200">
                                                                <p className="text-[10px] font-black text-[var(--text-accent)] uppercase tracking-widest mb-1.5">Learning Takeaway</p>
                                                                <p className="text-sm font-bold leading-relaxed text-[#0f172a] italic" style={{ color: '#0f172a' }}>{details.takeaway}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-12 flex flex-col sm:flex-row justify-end gap-4">
                                        {details.confidence !== 'Low' && (
                                            <button 
                                                onClick={() => setShowDetailed(!showDetailed)}
                                                className="px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all !text-white bg-[var(--bg-saffron)] hover:bg-[var(--bg-saffron-hover)] active:scale-95 shadow-md border border-[var(--bg-saffron)]"
                                            >
                                                <span className="!text-white font-black" style={{ color: '#ffffff' }}>
                                                    {showDetailed ? 'Standard Response' : 'Detailed Analysis'}
                                                </span>
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => {
                                                setSelectedReview(null);
                                                setShowDetailed(false);
                                            }}
                                            className="px-8 py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white-force !text-white font-black text-xs uppercase tracking-widest shadow-md border border-rose-600"
                                            style={{ color: '#ffffff' }}
                                        >
                                            <span className="!text-white font-black" style={{ color: '#ffffff' }}>Close Analysis</span>
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    );
                })()}
            </AnimatePresence>
        </DashboardLayout>
    );
};

export default AssessmentReport;
