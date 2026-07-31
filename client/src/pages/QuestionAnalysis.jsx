import { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import toast from 'react-hot-toast';
import AuthContext from '../context/AuthContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import {
    ChevronLeft, CheckCircle, XCircle, AlertCircle, Clock, Target, Users, MinusCircle, ChevronRight, Search, Home
} from 'lucide-react';

const PIE_COLORS = ['#10b981', '#f43f5e', '#64748b'];



const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white border-2 border-[var(--border-color)] p-4 rounded-2xl shadow-2xl backdrop-blur-xl ring-1 ring-black/5" style={{ color: '#0f172a' }}>
                <p className="font-black text-[#0f172a] text-sm tracking-wide" style={{ color: '#0f172a' }}>{label || 'Metric'}</p>
                <div className="border-t border-[var(--border-color)] my-2"></div>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2.5 text-xs py-0.5" style={{ color: '#0f172a' }}>
                        <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: entry.color || entry.fill || '#133E87' }} />
                        <span className="text-[#334155] font-bold" style={{ color: '#334155' }}>{entry.name}:</span>
                        <span className="font-black text-[#0f172a] text-sm" style={{ color: '#0f172a' }}>{entry.value}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export default function QuestionAnalysis() {
    const { quizId, questionIndex } = useParams();
    const navigate = useNavigate();
    const { user, theme } = useContext(AuthContext);
    const currentRole = user?.role || 'student';
    
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [totalQuestions, setTotalQuestions] = useState(1);
    
    // AI Review States
    const [aiReview, setAiReview] = useState(null);
    const [loadingAi, setLoadingAi] = useState(false);

    // List Search States
    const [searchCorrect, setSearchCorrect] = useState('');
    const [searchIncorrect, setSearchIncorrect] = useState('');
    const [searchSkipped, setSearchSkipped] = useState('');

    useEffect(() => {
        const fetchAnalysis = async () => {
            try {
                // Fetch the specific question analysis
                const res = await api.get(`/analytics/question/${quizId}/${questionIndex}`);
                setData(res.data);
                
                // Reset AI review on index change
                setAiReview(null);
                
                // Fetch total questions for pagination
                const quizRes = await api.get(`/quiz/${quizId}`);
                if (quizRes.data && quizRes.data.questions) {
                    setTotalQuestions(quizRes.data.questions.length);
                }
            } catch (err) {
                console.error(err);
                toast.error('Failed to load question analysis.');
            } finally {
                setLoading(false);
            }
        };
        fetchAnalysis();
    }, [quizId, questionIndex]);

    const handleGetAIReview = async () => {
        setLoadingAi(true);
        try {
            const res = await api.get(`/analytics/question-review/${quizId}/${questionIndex}`, { timeout: 300000 });
            setAiReview(res.data.review);
            toast.success('AI Review Generated!', { icon: '🤖' });
        } catch (err) {
            console.error(err);
            toast.error('Failed to generate AI Review.');
        } finally {
            setLoadingAi(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout role={currentRole}>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="relative w-16 h-16">
                        <div className="premium-spinner-ring"></div>
                        <div className="premium-spinner-ring"></div>
                        <div className="premium-spinner-ring"></div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (!data) return <DashboardLayout role={currentRole}><div className="text-white text-center mt-20">Analysis not found.</div></DashboardLayout>;

    const { question, analytics, studentInsights } = data;

    const pieData = [
        { name: 'Correct', value: analytics.correctCount },
        { name: 'Wrong', value: analytics.wrongCount },
        { name: 'Skipped', value: analytics.skippedCount }
    ];

    const qIdx = parseInt(questionIndex) || 0;
    const isSaffronTheme = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'india';
    const optionColors = isSaffronTheme 
        ? ['#D96B27', '#ea580c', '#f97316', '#c2410c', '#fb923c', '#9a3412'] 
        : ['#133E87', '#1d4ed8', '#2563eb', '#0284c7', '#3b82f6', '#0369a1'];

    // Filters for lists
    const filteredCorrect = studentInsights.correct.filter(name =>
        name.toLowerCase().includes(searchCorrect.toLowerCase())
    );

    const filteredIncorrect = studentInsights.wrong.filter(name =>
        name.toLowerCase().includes(searchIncorrect.toLowerCase())
    );

    const filteredSkipped = studentInsights.skipped.filter(name =>
        name.toLowerCase().includes(searchSkipped.toLowerCase())
    );

    const chartData = (analytics.optionSelection || []).map((entry) => {
        let label = entry.option;
        if (question && question.options) {
            const idx = question.options.findIndex(opt => opt.toLowerCase().trim() === entry.option.toLowerCase().trim());
            if (idx !== -1) {
                label = String.fromCharCode(65 + idx);
            } else {
                const match = entry.option.match(/^option\s+([a-z])$/i);
                if (match) {
                    label = match[1].toUpperCase();
                } else {
                    label = entry.option.charAt(0).toUpperCase();
                }
            }
        }
        return {
            ...entry,
            displayLabel: label
        };
    });

    return (
        <DashboardLayout role={currentRole}>
            <div className="space-y-12 pb-20 relative">
                {/* Background effects */}
                <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-rose-500/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
                
                {/* Header & Nav */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-color)] pb-8">
                    <div>
                        <div className="flex flex-wrap items-center gap-4 mb-4">
                            <button onClick={() => navigate(`/analytics/quiz/${quizId}`)} className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--bg-accent)] transition-all text-xs font-black uppercase tracking-widest rounded-xl shadow-sm" style={{ color: '#0f172a' }}>
                                <ChevronLeft size={16} /> Back to Analytics
                            </button>
                            <span className="text-[var(--text-secondary)]/30">|</span>
                            <button onClick={() => navigate('/teacher-dashboard')} className="flex items-center gap-1.5 text-[var(--text-accent)] hover:text-white transition-colors text-sm font-black uppercase tracking-widest btn-press">
                                <Home size={16} /> Go to Home
                            </button>
                        </div>
                        <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter text-balance">
                            Question <span className="text-[var(--text-accent)]">#{qIdx + 1}</span> Analysis
                        </h1>
                    </div>

                    <div className="flex gap-4">
                        <button 
                            disabled={qIdx <= 0}
                            onClick={() => navigate(`/analytics/question/${quizId}/${qIdx - 1}`)}
                            className="bg-[var(--bg-secondary)] hover:bg-[var(--bg-accent)] hover:text-[var(--text-on-accent)] disabled:opacity-30 disabled:cursor-not-allowed border border-[var(--border-color)] text-white px-6 py-3 rounded-2xl font-black italic uppercase tracking-tighter transition-all flex items-center gap-2 text-sm"
                        >
                            <ChevronLeft size={16} /> Prev
                        </button>
                        <button 
                            disabled={qIdx >= totalQuestions - 1}
                            onClick={() => navigate(`/analytics/question/${quizId}/${qIdx + 1}`)}
                            className="bg-[var(--bg-secondary)] hover:bg-[var(--bg-accent)] hover:text-[var(--text-on-accent)] disabled:opacity-30 disabled:cursor-not-allowed border border-[var(--border-color)] text-white px-6 py-3 rounded-2xl font-black italic uppercase tracking-tighter transition-all flex items-center gap-2 text-sm"
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {/* Question Display */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-8 md:p-12 rounded-[3rem] relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <Target size={150} />
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 mb-6">
                        <span className={`text-xs font-black px-4 py-2 rounded-xl uppercase tracking-widest border-2 shadow-xs ${
                            question.difficulty === 'Easy' ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 
                            question.difficulty === 'Hard' ? 'bg-rose-100 border-rose-400 text-rose-800' : 
                            'bg-amber-100 border-amber-400 text-amber-800'
                        }`}>
                            {question.difficulty || 'Medium'}
                        </span>
                        <span className="text-xs font-black px-4 py-2 rounded-xl uppercase tracking-widest bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                            {question.points || 10} Points
                        </span>
                        <button 
                            onClick={handleGetAIReview} 
                            disabled={loadingAi}
                            className="ml-auto flex items-center gap-2 bg-[var(--bg-primary)] hover:bg-[var(--bg-accent)] text-[var(--text-accent)] hover:text-[var(--text-on-accent)] border border-[var(--border-color)] px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 disabled:opacity-50"
                        >
                            {loadingAi ? 'Reviewing...' : 'Ask AI Review'}
                        </button>
                    </div>

                    <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-10 relative z-10 break-words overflow-wrap-anywhere whitespace-normal text-balance">
                        {question.questionText}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                        {question.options.map((opt, idx) => {
                            const isCorrect = opt.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
                            const stat = analytics.optionSelection.find(o => o.option === opt.toLowerCase())?.count || 0;
                            const percentage = analytics.totalAttempts > 0 ? Math.round((stat / analytics.totalAttempts) * 100) : 0;
                            
                            return (
                                <div key={idx} className={`p-6 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${isCorrect ? 'bg-green-500/10 border-green-500/50 shadow-[0_0_15px_rgba(16,185,129,0.05)]' : 'bg-[var(--bg-primary)]/40 border-[var(--border-color)]'}`}>
                                    <div className="flex items-start gap-4 flex-1 min-w-0">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black shrink-0 ${isCorrect ? 'bg-green-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]/70 border border-[var(--border-color)]'}`}>
                                            {String.fromCharCode(65 + idx)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <span className={`font-bold text-sm md:text-base break-words overflow-wrap-anywhere whitespace-normal leading-relaxed block ${isCorrect ? 'text-green-400' : 'text-[var(--text-secondary)]'}`}>{opt}</span>
                                            {isCorrect && <span className="mt-1.5 inline-block text-[9px] uppercase tracking-widest font-black text-green-500 bg-green-500/20 px-2 py-0.5 rounded-md">Correct Answer</span>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0 text-right justify-start pt-0.5">
                                        <span className="font-black text-xl italic text-white leading-none">{percentage}%</span>
                                        <div className="text-[10px] uppercase font-bold text-[var(--text-secondary)]/50 tracking-widest mt-1">{stat} picks</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* AI Review Section */}
                {(loadingAi || aiReview) && (
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-8 md:p-12 rounded-[3rem] relative overflow-hidden transition-all duration-500 animate-fadeIn">
                        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none text-[var(--text-accent)]">
                            <Target size={150} />
                        </div>
                        
                        <div className="flex items-center gap-3 mb-6">
                            <div className="relative w-8 h-8 flex items-center justify-center rounded-xl bg-[var(--text-accent)]/15 text-[var(--text-accent)]">
                                {loadingAi ? (
                                    <div className="w-4 h-4 border-2 border-[var(--text-accent)] border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <span>🤖</span>
                                )}
                            </div>
                            <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">AI Pedagogical Review</h3>
                        </div>

                        {loadingAi ? (
                            <div className="space-y-4 py-4">
                                <div className="h-4 bg-white/5 rounded-full w-3/4 animate-pulse"></div>
                                <div className="h-4 bg-white/5 rounded-full w-5/6 animate-pulse"></div>
                                <div className="h-4 bg-white/5 rounded-full w-2/3 animate-pulse"></div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Gemini is analyzing student pick options and diagnostic data...</p>
                            </div>
                        ) : (
                            <div className="prose prose-invert max-w-none text-slate-300 font-medium text-sm md:text-base leading-relaxed space-y-4 max-h-[350px] overflow-y-auto premium-scrollbar pr-3 pb-2 break-words overflow-wrap-anywhere whitespace-normal scroll-smooth">
                                {aiReview.split('\n').map((line, idx) => {
                                    if (line.startsWith('### ')) {
                                        return <h4 key={idx} className="text-lg font-bold text-[var(--text-accent)] mt-6 mb-2 uppercase tracking-wide break-words overflow-wrap-anywhere whitespace-normal">{line.replace('### ', '')}</h4>;
                                    }
                                    if (line.startsWith('## ')) {
                                        return <h3 key={idx} className="text-xl font-black text-white mt-8 mb-4 uppercase italic tracking-tight border-b border-white/5 pb-2 break-words overflow-wrap-anywhere whitespace-normal">{line.replace('## ', '')}</h3>;
                                    }
                                    if (line.startsWith('# ')) {
                                        return <h2 key={idx} className="text-2xl font-black text-white mt-8 mb-4 uppercase italic tracking-tight border-b border-white/10 pb-2 break-words overflow-wrap-anywhere whitespace-normal">{line.replace('# ', '')}</h2>;
                                    }
                                    if (line.startsWith('**') || line.startsWith('1. **') || line.startsWith('2. **') || line.startsWith('3. **') || line.startsWith('4. **')) {
                                        return <p key={idx} className="text-slate-200 mt-2 break-words overflow-wrap-anywhere whitespace-normal"><strong className="text-white">{line}</strong></p>;
                                    }
                                    return <p key={idx} className="mt-1 break-words overflow-wrap-anywhere whitespace-normal">{line}</p>;
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Pie Chart */}
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-[2.5rem] flex flex-col items-center justify-center relative">
                        <h3 className="absolute top-6 left-8 text-lg font-black text-white uppercase italic tracking-tighter">Attempt Breakdown</h3>
                        
                        <div className="w-full h-[250px] mt-8">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4 mt-2">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#10b981]"></div><span className="text-xs font-bold text-[var(--text-secondary)] uppercase">Correct ({analytics.correctPercentage}%)</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#f43f5e]"></div><span className="text-xs font-bold text-[var(--text-secondary)] uppercase">Wrong ({analytics.wrongPercentage}%)</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#64748b]"></div><span className="text-xs font-bold text-[var(--text-secondary)] uppercase">Skipped ({analytics.skippedPercentage}%)</span></div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex flex-col gap-6">
                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-[2.5rem] flex-1 flex items-center gap-6">
                            <div className="p-4 rounded-2xl bg-[var(--text-accent)]/10 text-[var(--text-accent)]"><Users size={32} /></div>
                            <div>
                                <p className="text-[10px] font-black text-[var(--text-secondary)] opacity-60 uppercase tracking-widest mb-1">Total Attempts</p>
                                <p className="text-4xl font-black text-white italic">{analytics.totalAttempts}</p>
                            </div>
                        </div>
                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-[2.5rem] flex-1 flex items-center gap-6">
                            <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-400"><Clock size={32} /></div>
                            <div>
                                <p className="text-[10px] font-black text-[var(--text-secondary)] opacity-60 uppercase tracking-widest mb-1">Avg Time Spent</p>
                                <p className="text-4xl font-black text-white italic">{analytics.avgTimeSpent}s</p>
                            </div>
                        </div>
                    </div>

                    {/* Option Selection Bar Chart */}
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-[2.5rem]">
                        <h3 className="text-lg font-black text-white uppercase italic tracking-tighter mb-6">Option Distribution</h3>
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={true} vertical={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="displayLabel" type="category" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 900 }} tickLine={false} axisLine={false} width={30} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                    <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={20}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={optionColors[index % optionColors.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>

                {/* Student Lists */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Correct */}
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-[2.5rem] flex flex-col">
                        <div className="flex items-center gap-3 mb-4 border-b border-[var(--border-color)] pb-4">
                            <CheckCircle className="text-green-500" size={20} />
                            <h3 className="text-sm font-black text-white uppercase italic tracking-widest flex-1">Correct ({filteredCorrect.length})</h3>
                        </div>
                        
                        {/* Search Input */}
                        <div className="relative mb-4">
                            <input 
                                type="text"
                                placeholder="Search correct students..."
                                value={searchCorrect}
                                onChange={(e) => setSearchCorrect(e.target.value)}
                                className="w-full bg-[var(--bg-primary)]/50 border border-[var(--border-color)] text-white placeholder-slate-500 pl-10 pr-4 py-2 rounded-xl text-xs font-bold focus:outline-none focus:border-[var(--text-accent)] transition-all"
                            />
                            <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                        </div>

                        <div className="space-y-2 max-h-[250px] overflow-y-auto premium-scrollbar pr-2 flex-1">
                            {filteredCorrect.length > 0 ? filteredCorrect.map((name, i) => (
                                <div key={i} className="bg-green-500/5 text-green-400 font-bold px-4 py-3 rounded-xl border border-green-500/10 text-sm animate-fadeIn break-words overflow-wrap-anywhere whitespace-normal">
                                    {name}
                                </div>
                            )) : <div className="text-slate-500 text-sm italic py-2 text-center">No students found.</div>}
                        </div>
                    </div>

                    {/* Wrong */}
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-[2.5rem] flex flex-col">
                        <div className="flex items-center gap-3 mb-4 border-b border-[var(--border-color)] pb-4">
                            <XCircle className="text-rose-500" size={20} />
                            <h3 className="text-sm font-black text-white uppercase italic tracking-widest flex-1">Incorrect ({filteredIncorrect.length})</h3>
                        </div>

                        {/* Search Input */}
                        <div className="relative mb-4">
                            <input 
                                type="text"
                                placeholder="Search incorrect students..."
                                value={searchIncorrect}
                                onChange={(e) => setSearchIncorrect(e.target.value)}
                                className="w-full bg-[var(--bg-primary)]/50 border border-[var(--border-color)] text-white placeholder-slate-500 pl-10 pr-4 py-2 rounded-xl text-xs font-bold focus:outline-none focus:border-[var(--text-accent)] transition-all"
                            />
                            <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                        </div>

                        <div className="space-y-2 max-h-[250px] overflow-y-auto premium-scrollbar pr-2 flex-1">
                            {filteredIncorrect.length > 0 ? filteredIncorrect.map((name, i) => (
                                <div key={i} className="bg-rose-500/5 text-rose-400 font-bold px-4 py-3 rounded-xl border border-rose-500/10 text-sm animate-fadeIn break-words overflow-wrap-anywhere whitespace-normal">
                                    {name}
                                </div>
                            )) : <div className="text-slate-500 text-sm italic py-2 text-center">No students found.</div>}
                        </div>
                    </div>

                    {/* Skipped */}
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-[2.5rem] flex flex-col">
                        <div className="flex items-center gap-3 mb-4 border-b border-[var(--border-color)] pb-4">
                            <MinusCircle className="text-slate-400" size={20} />
                            <h3 className="text-sm font-black text-white uppercase italic tracking-widest flex-1">Skipped ({filteredSkipped.length})</h3>
                        </div>

                        {/* Search Input */}
                        <div className="relative mb-4">
                            <input 
                                type="text"
                                placeholder="Search skipped students..."
                                value={searchSkipped}
                                onChange={(e) => setSearchSkipped(e.target.value)}
                                className="w-full bg-[var(--bg-primary)]/50 border border-[var(--border-color)] text-white placeholder-slate-500 pl-10 pr-4 py-2 rounded-xl text-xs font-bold focus:outline-none focus:border-[var(--text-accent)] transition-all"
                            />
                            <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                        </div>

                        <div className="space-y-2 max-h-[250px] overflow-y-auto premium-scrollbar pr-2 flex-1">
                            {filteredSkipped.length > 0 ? filteredSkipped.map((name, i) => (
                                <div key={i} className="bg-[var(--bg-primary)]/40 text-[var(--text-secondary)] font-bold px-4 py-3 rounded-xl border border-[var(--border-color)] text-sm animate-fadeIn break-words overflow-wrap-anywhere whitespace-normal">
                                    {name}
                                </div>
                            )) : <div className="text-slate-500 text-sm italic py-2 text-center">No students found.</div>}
                        </div>
                    </div>
                </div>

            </div>
        </DashboardLayout>
    );
}
