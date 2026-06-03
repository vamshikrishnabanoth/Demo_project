import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area 
} from 'recharts';
import { 
    Trophy, Clock, Target, AlertCircle, ArrowLeft, 
    CheckCircle2, XCircle, Brain, 
    Zap, TrendingUp, HelpCircle, Activity, Sparkles, X, Home
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

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#0f172a]/95 border border-white/10 p-4 rounded-2xl shadow-2xl backdrop-blur-xl">
                    <p className="font-bold text-white text-sm tracking-wide">{label || 'Metric'}</p>
                    <div className="border-t border-white/10 my-2.5"></div>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2.5 text-sm">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color || '#22d3ee' }} />
                            <span className="text-slate-300 font-medium">{entry.name === 'time' ? 'Time Spent' : entry.name || 'Value'}:</span>
                            <span className="font-black text-white ml-1">
                                {entry.value}
                                <span className="text-[10px] ml-1 opacity-50 not-italic font-bold uppercase">
                                    {entry.name === 'time' ? 'Seconds' : 'Units'}
                                </span>
                            </span>
                        </div>
                    ))}
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
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.4 }}
                            className="max-w-xl mx-auto text-center py-16 px-6 font-inter relative"
                        >
                            {/* Decorative background glows */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-[var(--bg-accent)]/10 rounded-full blur-[100px] pointer-events-none -z-10" />
                            
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                className="w-28 h-28 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl relative"
                            >
                                <motion.div 
                                    animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.3, 0.1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="absolute inset-0 bg-[var(--bg-accent)] rounded-[2.5rem] blur-xl"
                                />
                                <Trophy className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" size={56} />
                            </motion.div>

                            <p className="text-[10px] font-black tracking-[0.4em] text-[var(--text-accent)] uppercase mb-3">Assessment Concluded</p>
                            <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter text-white uppercase mb-8 leading-none max-w-md mx-auto">
                                {quizTitle}
                            </h2>

                            <div className="bg-[var(--bg-secondary)] border border-white/5 rounded-[3rem] p-10 backdrop-blur-md shadow-2xl mb-10 space-y-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--bg-accent)]/5 rounded-full blur-2xl -mr-16 -mt-16"></div>
                                
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Final Standing</p>
                                    <div className="flex flex-col items-center justify-center gap-1">
                                        <span className="text-2xl md:text-3xl font-black italic text-white/60 uppercase tracking-wider">RANK</span>
                                        <span className={`font-black italic tracking-tighter bg-gradient-to-r from-yellow-400 via-[var(--text-accent)] to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_var(--bg-accent-glow)] leading-none ${
                                            `#${rank}`.length > 5 ? 'text-5xl md:text-6xl' :
                                            `#${rank}`.length > 4 ? 'text-6xl md:text-7xl' :
                                            'text-7xl md:text-8xl'
                                        }`}>
                                            #{rank}
                                        </span>
                                    </div>
                                    <p className="text-xs font-bold text-white/50 uppercase tracking-widest pt-2">
                                        Out of {totalParticipants} {totalParticipants === 1 ? 'Candidate' : 'Candidates'}
                                    </p>
                                </div>

                                <div className="w-full h-px bg-white/5 my-6" />

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/[0.02] border border-white/5 p-4.5 rounded-2xl">
                                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1.5">Tactical Yield</p>
                                        <p className="text-xl font-black italic text-white">{score} <span className="text-[10px] font-bold text-white/40">/ {totalQuestions * 10} Pts</span></p>
                                    </div>
                                    <div className="bg-white/[0.02] border border-white/5 p-4.5 rounded-2xl">
                                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1.5">Net Accuracy</p>
                                        <p className="text-xl font-black italic text-emerald-400">{accuracy}%</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                                <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => setShowAnalytics(true)}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-gradient-to-r from-[var(--bg-accent)] to-amber-500 text-[var(--text-on-accent)] font-black text-xs uppercase tracking-widest hover:shadow-2xl hover:shadow-[var(--bg-accent)]/20 transition-all border-b-4 border-amber-700 btn-press"
                                >
                                    Analytics <TrendingUp size={14} />
                                </motion.button>
                                <button
                                    onClick={() => navigate('/student-dashboard')}
                                    className="flex-1 px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95 btn-press"
                                >
                                    Dashboard
                                </button>
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
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[var(--text-secondary)] hover:text-[var(--text-accent)] transition-all group btn-press"
                                        >
                                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Back to History</span>
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

                            {/* Key Metrics Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-12 px-4">
                                {[
                                    { label: 'Tactical Rank', value: `#${rank}`, subValue: `of ${totalParticipants}`, icon: Trophy, color: 'text-yellow-400', glow: 'shadow-yellow-400/10' },
                                    { label: 'Total Score', value: `${score}`, subValue: `of ${totalQuestions * 10}`, icon: Sparkles, color: 'text-orange-400', glow: 'shadow-orange-400/10' },
                                    { label: 'Accuracy', value: `${accuracy}%`, icon: Target, color: 'text-emerald-400', glow: 'shadow-emerald-400/10' },
                                    { label: 'Time Spent', value: `${totalTimeTaken}s`, icon: Clock, color: 'text-blue-400', glow: 'shadow-blue-400/10' },
                                    { label: 'Avg Speed', value: `${avgTime}s/q`, icon: TrendingUp, color: 'text-purple-400', glow: 'shadow-purple-400/10' }
                                ].map((stat, i) => (
                                    <motion.div 
                                        key={i}
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: i * 0.05 }}
                                        whileHover={{ y: -5, scale: 1.02 }}
                                        className={`glass-panel p-8 rounded-[2.5rem] border border-white/10 hover:border-white/20 transition-all group ${stat.glow} shadow-2xl`}
                                    >
                                        <div className="flex justify-between items-start mb-6">
                                            <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform duration-500`}>
                                                <stat.icon size={28} aria-hidden="true" />
                                            </div>
                                            <div className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--text-accent)] italic border-b border-[var(--bg-accent)]/30 pb-1">Tracker_{i+1}</div>
                                        </div>
                                        <p className="text-[11px] font-black text-white/60 uppercase tracking-[0.3em] mb-3">{stat.label}</p>
                                        <h3 className="text-4xl font-black text-white italic tracking-tighter whitespace-nowrap flex items-baseline">
                                            {stat.value}
                                            {stat.subValue && (
                                                <span className="text-xs font-bold text-white/40 uppercase tracking-wider not-italic ml-1.5 shrink-0">
                                                    {stat.subValue}
                                                </span>
                                            )}
                                        </h3>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Charts Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                {/* Accuracy Graph */}
                                <motion.div 
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="glass-panel !rounded-[2.5rem] p-8 h-[400px] flex flex-col"
                                >
                                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                        <Target className="text-emerald-400" size={20} />
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
                                        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                                            <div className="w-3 h-3 rounded-full bg-emerald-400" /> Correct
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                                            <div className="w-3 h-3 rounded-full bg-rose-500" /> Incorrect
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Time Spent per Question */}
                                <motion.div 
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="glass-panel !rounded-[2.5rem] p-8 h-[400px] flex flex-col"
                                >
                                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                        <Clock className="text-blue-400" size={20} />
                                        Time Spent per Question (Seconds)
                                    </h3>
                                    <div className="flex-1">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={timeData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                                <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} />
                                                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} />
                                                <Tooltip 
                                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                                    content={<CustomTooltip />}
                                                />
                                                <Bar dataKey="time" radius={[8, 8, 0, 0]}>
                                                    {timeData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill="#22d3ee" fillOpacity={0.8} />
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
                                className="glass-panel overflow-hidden"
                            >
                                <div className="p-6 border-b border-[var(--glass-border)] flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <HelpCircle className="text-[var(--text-accent)]" size={20} />
                                        Question Wise Analysis
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white/[0.03] border-b border-white/10">
                                                <th className="px-8 py-6 text-[10px] font-black text-white uppercase tracking-[0.3em] italic">Rank</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-white uppercase tracking-[0.3em] italic">Question Directive</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-white uppercase tracking-[0.3em] italic">Your Input</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-white uppercase tracking-[0.3em] italic">Correct Target</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-white uppercase tracking-[0.3em] italic text-center">Status</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-white uppercase tracking-[0.3em] italic">Latency</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-white uppercase tracking-[0.3em] italic text-right">{uiTerminology.arenaReview}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--glass-border)]">
                                            {answers.map((ans, idx) => (
                                                <tr key={idx} className="hover:bg-white/[0.03] transition-all border-b border-white/[0.02] group">
                                                <td className="px-8 py-8 text-[var(--text-secondary)] font-mono text-xs opacity-50">{idx + 1}</td>
                                                <td className="px-8 py-8">
                                                    <p className="text-white font-black italic uppercase tracking-tight text-sm line-clamp-2 max-w-md group-hover:text-[var(--text-accent)] transition-colors">
                                                        {ans.questionText}
                                                    </p>
                                                </td>
                                                <td className="px-8 py-8">
                                                    {(!ans.selectedOption || ans.selectedOption.trim() === '') ? (
                                                        <div className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest inline-block bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                                            Skipped
                                                        </div>
                                                    ) : (
                                                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest inline-block ${ans.isCorrect ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                                            {ans.selectedOption}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-8 py-8">
                                                    <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-emerald-400 font-black text-[10px] uppercase tracking-widest inline-block">
                                                        {ans.correctOption}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-8">
                                                    <div className="flex justify-center">
                                                        {ans.isCorrect ? (
                                                            <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-tighter bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                                                                <CheckCircle2 size={12} /> Correct
                                                            </div>
                                                        ) : (!ans.selectedOption || ans.selectedOption.trim() === '') ? (
                                                            <div className="flex items-center gap-2 text-yellow-400 text-[10px] font-black uppercase tracking-tighter bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20">
                                                                <AlertCircle size={12} /> Skipped
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 text-rose-400 text-[10px] font-black uppercase tracking-tighter bg-rose-400/10 px-3 py-1 rounded-full border border-rose-400/20">
                                                                <XCircle size={12} /> Wrong
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-8 text-white font-mono text-xs font-black italic">
                                                    {ans.timeTaken}s
                                                </td>
                                                <td className="px-8 py-8 text-right">
                                                    <div className="flex justify-end">
                                                            <motion.button
                                                                whileHover={{ scale: 1.1, rotate: 5 }}
                                                                whileTap={{ scale: 0.9 }}
                                                                onClick={() => setSelectedReview(ans)}
                                                                className="p-3 rounded-2xl transition-all border bg-[var(--bg-accent)] text-[var(--text-on-accent)] border-[var(--bg-accent)] shadow-[0_0_20px_var(--bg-accent-glow)]"
                                                                title={`View Full ${uiTerminology.arenaInsights}`}
                                                            >
                                                                <Brain size={20} />
                                                            </motion.button>
                                                    </div>
                                                </td>
                                                </tr>
                                            ))}
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
                                className="relative w-full max-w-2xl bg-[var(--bg-secondary)] rounded-[3rem] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh]"
                            >
                                <div className="absolute top-6 right-6 z-[110]">
                                    <button 
                                        onClick={() => {
                                            setSelectedReview(null);
                                            setShowDetailed(false);
                                        }}
                                        className="p-3 rounded-2xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all backdrop-blur-md border border-white/5"
                                        aria-label="Close review"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto no-scrollbar p-8 sm:p-14">
                                    <div className="flex items-center gap-4 mb-10">
                                        <div className="w-14 h-14 rounded-2xl bg-[var(--bg-accent)] flex items-center justify-center text-[var(--text-on-accent)] shadow-[0_0_20px_var(--bg-accent-glow)]">
                                            <Brain size={28} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-white italic uppercase tracking-tight">Arena <span className="text-[var(--text-accent)]">Insights</span></h2>
                                            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">Deep Pedagogical Analysis</p>
                                        </div>
                                    </div>

                                    <div className="space-y-10">
                                        <div>
                                            <p className="text-[10px] font-black text-[var(--text-accent)] uppercase tracking-[0.2em] mb-4">Question Directive</p>
                                            <p className="text-xl font-bold text-white leading-relaxed">{details.questionText}</p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="p-6 rounded-3xl bg-white/5 border border-white/5">
                                                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">Your Input</p>
                                                <p className={`text-sm font-black italic uppercase ${details.isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {details.selectedOption || 'No Input Detected'}
                                                </p>
                                            </div>
                                            <div className="p-6 rounded-3xl bg-white/5 border border-white/5">
                                                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">Correct Target</p>
                                                <p className="text-sm font-black italic uppercase text-emerald-400">
                                                    {details.correctOption}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <div className="absolute -top-4 -left-4 w-12 h-12 bg-[var(--bg-accent)]/10 blur-2xl rounded-full" />
                                            <div className="relative p-8 rounded-[2rem] bg-[var(--bg-accent)]/5 border border-[var(--bg-accent)]/20">
                                                <div className="flex items-center justify-between mb-4">
                                                    <Sparkles size={20} className="text-[var(--text-accent)]" />
                                                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                                        details.confidence === 'High' 
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                                        : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                                    }`}>
                                                        Confidence: {details.confidence}
                                                    </div>
                                                </div>
                                                
                                                {!showDetailed ? (
                                                    <div className="text-lg text-white/90 font-medium leading-relaxed whitespace-pre-wrap italic">
                                                        {details.explanation}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-6 text-white/90">
                                                        <div>
                                                            <p className="text-[10px] font-black text-[var(--text-accent)] uppercase tracking-widest mb-1.5">Question Directive</p>
                                                            <p className="text-base font-bold leading-relaxed">{details.questionText}</p>
                                                        </div>
                                                        <div className="pt-4 border-t border-white/5">
                                                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1.5">Correct Target</p>
                                                            <p className="text-sm font-medium leading-relaxed">{details.correctOption}</p>
                                                        </div>
                                                        <div className="pt-4 border-t border-white/5">
                                                            <p className="text-[10px] font-black text-[var(--text-accent)] uppercase tracking-widest mb-1.5">Why Correct</p>
                                                            <p className="text-sm font-medium opacity-80 leading-relaxed italic">{details.whyCorrect}</p>
                                                        </div>
                                                        {details.whyOthersIncorrect && (
                                                            <div className="pt-4 border-t border-white/5">
                                                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1.5">Why Other Options are Incorrect</p>
                                                                <p className="text-sm font-medium opacity-80 leading-relaxed">{details.whyOthersIncorrect}</p>
                                                            </div>
                                                        )}
                                                        {details.takeaway && (
                                                            <div className="pt-4 border-t border-white/5">
                                                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5">Learning Takeaway</p>
                                                                <p className="text-sm font-medium opacity-80 leading-relaxed italic">{details.takeaway}</p>
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
                                                className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all btn-press ${
                                                    showDetailed 
                                                    ? 'bg-white/10 text-white border border-white/20' 
                                                    : 'bg-[var(--bg-accent)]/20 text-[var(--text-accent)] border border-[var(--bg-accent)]/30 hover:bg-[var(--bg-accent)] hover:text-[var(--text-on-accent)]'
                                                }`}
                                            >
                                                {showDetailed ? 'Standard Response' : 'Detailed Analysis'}
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => {
                                                setSelectedReview(null);
                                                setShowDetailed(false);
                                            }}
                                            className="px-8 py-4 rounded-2xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest btn-cinematic shadow-lg shadow-rose-500/20"
                                        >
                                            Close Analysis
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
