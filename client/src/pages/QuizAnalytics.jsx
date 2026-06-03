import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import toast from 'react-hot-toast';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import {
    Activity, Download, Users, CheckCircle, Clock, Trophy, ChevronLeft, Target, Award, FileText, ArrowRight, AlertCircle, Home
} from 'lucide-react';

const COLORS = ['#0ea5e9', '#3b82f6', '#0284c7', '#38bdf8', '#2563eb'];
const PIE_COLORS = ['#10b981', '#ef4444'];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#0f172a]/95 border border-white/10 p-4 rounded-2xl shadow-2xl backdrop-blur-xl">
                <p className="font-bold text-white text-sm tracking-wide">{label}</p>
                <div className="border-t border-white/10 my-2.5"></div>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2.5 text-sm">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="text-slate-300 font-medium">{entry.name}:</span>
                        <span className="font-black text-white">{entry.value}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export default function QuizAnalytics() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const res = await api.get(`/analytics/quiz/${id}`);
                setAnalytics(res.data);
            } catch (err) {
                console.error(err);
                toast.error('Failed to load analytics.');
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, [id]);

    const handleExport = (format) => {
        if (format === 'CSV') {
            const rows = [];
            // Quiz Header Info
            rows.push([`"QUIZ DETAILED ANALYTICS REPORT: ${analytics.quizTitle.replace(/"/g, '""')}"`]);
            rows.push([`"Generated At: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}"`]);
            rows.push([]);
            
            // Key Metrics
            rows.push(['"SUMMARY METRICS"']);
            rows.push(['"Total Questions"', analytics.totalQuestions]);
            rows.push(['"Total Participants"', analytics.totalParticipants]);
            rows.push(['"Average Score"', `"${analytics.averageScore}%"`]);
            rows.push(['"Highest Score"', `"${analytics.highestScore}%"`]);
            rows.push(['"Participation Rate"', `"${analytics.participationRate.totalEligible > 0 ? Math.round((analytics.participationRate.attempted / analytics.participationRate.totalEligible) * 100) : 100}%"`]);
            rows.push([]);

            // Section Mastery
            rows.push(['"SECTION MASTERY"']);
            rows.push(['"Section / Topic"', '"Average Score (%)"']);
            radarData.forEach(s => {
                rows.push([`"${s.subject.replace(/"/g, '""')}"`, `"${s.A}%"`]);
            });
            rows.push([]);

            // Complete Student Leaderboard
            rows.push(['"COMPLETE STUDENT LEADERBOARD"']);
            rows.push(['"Rank"', '"Student"', '"Score"', '"Accuracy"', '"Time Taken"']);
            (analytics.leaderboard || []).forEach(s => {
                rows.push([
                    `"#${s.rank}"`,
                    `"${s.username.replace(/"/g, '""')}"`,
                    s.score,
                    `"${s.accuracy}%"`,
                    `"${Math.round(s.timeTaken / 60)}m ${s.timeTaken % 60}s"`
                ]);
            });
            rows.push([]);

            // Question Breakdown
            rows.push(['"QUESTION PERFORMANCE ANALYSIS"']);
            rows.push(['"Q.No"', '"Question Text"', '"Difficulty"', '"Accuracy"', '"Correct"', '"Wrong"', '"Skipped"']);
            analytics.questionPerformance.forEach((q, idx) => {
                rows.push([
                    `"#${idx + 1}"`,
                    `"${q.questionText.replace(/"/g, '""')}"`,
                    `"${q.difficulty}"`,
                    `"${q.accuracy}%"`,
                    q.correct,
                    q.wrong,
                    q.skipped
                ]);
            });

            const csvString = rows.map(e => e.join(",")).join("\n");
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `${analytics.quizTitle.replace(/\s+/g, '_')}_Detailed_Report.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('CSV Report Downloaded Successfully');
        } else if (format === 'PDF') {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
               <html>
                 <head>
                   <title>${analytics.quizTitle} - Report</title>
                   <style>
                     body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 40px; background: white; line-height: 1.5; }
                     h1 { font-size: 28px; margin-bottom: 5px; color: #0f172a; font-weight: 900; letter-spacing: -0.03em; }
                     h2 { font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 40px; color: #0f172a; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
                     .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 20px; }
                     .meta-card { border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; text-align: center; background: #f8fafc; }
                     .meta-val { font-size: 24px; font-weight: bold; color: #3b82f6; }
                     .meta-lbl { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-top: 4px; }
                     table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                     th, td { border-bottom: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 13px; }
                     th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 800; }
                     .badge { padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
                     .badge-Easy { background: #dcfce7; color: #15803d; }
                     .badge-Medium { background: #dbeafe; color: #1d4ed8; }
                     .badge-Hard { background: #fee2e2; color: #b91c1c; }
                   </style>
                 </head>
                 <body>
                   <h1>${analytics.quizTitle}</h1>
                   <p style="color: #64748b; margin-top: 0; font-size: 14px;">Detailed Analytics & Performance Report • Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                   
                   <h2>Summary Metrics</h2>
                   <div class="meta-grid">
                     <div class="meta-card"><div class="meta-val">${analytics.totalParticipants}</div><div class="meta-lbl">Total Participants</div></div>
                     <div class="meta-card"><div class="meta-val">${analytics.averageScore}%</div><div class="meta-lbl">Average Score</div></div>
                     <div class="meta-card"><div class="meta-val">${analytics.highestScore}%</div><div class="meta-lbl">Highest Score</div></div>
                     <div class="meta-card"><div class="meta-val">${analytics.totalQuestions}</div><div class="meta-lbl">Total Questions</div></div>
                   </div>

                   <h2>Section-wise Mastery</h2>
                   <table>
                     <thead><tr><th>Section / Subject</th><th>Average Score (%)</th></tr></thead>
                     <tbody>
                       ${radarData.map(s => `<tr><td style="font-weight: 600;">${s.subject}</td><td>${s.A}%</td></tr>`).join('')}
                     </tbody>
                   </table>

                   <h2>Complete Student Leaderboard</h2>
                   <table>
                     <thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>Accuracy</th><th>Time Taken</th></tr></thead>
                     <tbody>
                       ${(analytics.leaderboard || []).map(s => `<tr><td style="font-weight: 800; color: #64748b;">#${s.rank}</td><td style="font-weight: 600;">${s.username}</td><td><strong style="color: #3b82f6;">${s.score}</strong></td><td>${s.accuracy}%</td><td>${Math.round(s.timeTaken / 60)}m ${s.timeTaken % 60}s</td></tr>`).join('')}
                     </tbody>
                   </table>

                   <h2>Question Performance Breakdown</h2>
                   <table>
                     <thead><tr><th>Q.No</th><th>Question Text</th><th>Difficulty</th><th>Accuracy</th><th>Correct</th><th>Wrong</th><th>Skipped</th></tr></thead>
                     <tbody>
                       ${analytics.questionPerformance.map((q, idx) => `<tr><td style="font-weight: 800; color: #64748b;">#${idx + 1}</td><td style="max-width: 300px; font-weight: 500;">${q.questionText}</td><td><span class="badge badge-${q.difficulty || 'Medium'}">${q.difficulty || 'Medium'}</span></td><td><strong style="color: ${q.accuracy > 70 ? '#16a34a' : q.accuracy < 40 ? '#dc2626' : '#d97706'}">${q.accuracy}%</strong></td><td>${q.correct}</td><td>${q.wrong}</td><td>${q.skipped}</td></tr>`).join('')}
                     </tbody>
                   </table>
                   <script>
                     window.onload = function() { 
                       setTimeout(function() {
                         window.print(); 
                         window.close();
                       }, 500); 
                     }
                   </script>
                 </body>
               </html>
            `);
            printWindow.document.close();
            toast.success('PDF Print Report Triggered');
        }
    };

    if (loading) {
        return (
            <DashboardLayout role="teacher">
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

    if (!analytics) return <DashboardLayout role="teacher"><div className="text-white text-center mt-20">Analytics not found.</div></DashboardLayout>;

    // Prepare data
    const pieData = [
        { name: 'Attempted', value: analytics.participationRate.attempted },
        { name: 'Not Attempted', value: Math.max(0, analytics.participationRate.totalEligible - analytics.participationRate.attempted) }
    ];

    const radarData = analytics.sectionPerformance.length > 0 
        ? analytics.sectionPerformance.map(s => ({ subject: s.section, A: s.averagePercentage, fullMark: 100 }))
        : [{ subject: 'General', A: analytics.averageScore, fullMark: 100 }];

    return (
        <DashboardLayout role="teacher">
            <div className="space-y-12 pb-20 relative">
                {/* Background effects */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>

                {/* Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-white/10 pb-8">
                    <div>
                        <div className="flex flex-wrap items-center gap-4 mb-4">
                            <button onClick={() => navigate('/my-quizzes')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest">
                                <ChevronLeft size={16} /> Back to Library
                            </button>
                            <span className="text-slate-400/30">|</span>
                            <button onClick={() => navigate('/teacher-dashboard')} className="flex items-center gap-1.5 text-[var(--text-accent)] hover:text-white transition-colors text-sm font-black uppercase tracking-widest btn-press">
                                <Home size={16} /> Go to Home
                            </button>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white italic uppercase tracking-tighter text-balance">
                            {analytics.quizTitle}
                        </h1>
                        <p className="text-indigo-400 font-bold mt-2 uppercase tracking-widest text-sm italic">
                            Analytics Dashboard
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => handleExport('PDF')} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-3 rounded-2xl font-black italic uppercase tracking-tighter transition-all active:scale-95 flex items-center gap-2 shadow-lg text-sm">
                            <Download size={16} /> PDF
                        </button>
                        <button onClick={() => handleExport('CSV')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-black italic uppercase tracking-tighter transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-indigo-500/20 text-sm">
                            <FileText size={16} /> CSV
                        </button>
                    </div>
                </div>

                {/* KPI Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { title: 'Total Participants', value: analytics.totalParticipants, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                        { title: 'Average Score', value: `${analytics.averageScore}%`, icon: Target, color: 'text-teal-400', bg: 'bg-teal-400/10' },
                        { title: 'Highest Score', value: `${analytics.highestScore}%`, icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
                        { title: 'Total Questions', value: analytics.totalQuestions, icon: CheckCircle, color: 'text-purple-400', bg: 'bg-purple-400/10' },
                    ].map((kpi, idx) => (
                        <div key={idx} className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-3xl flex items-center gap-6 hover:bg-white/10 transition-all group">
                            <div className={`p-4 rounded-2xl ${kpi.bg} ${kpi.color} group-hover:scale-110 transition-transform`}>
                                <kpi.icon size={28} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{kpi.title}</p>
                                <p className="text-3xl font-black text-white italic">{kpi.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Score Distribution */}
                    <div className="lg:col-span-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 sm:p-8 rounded-[2.5rem]">
                        <div className="flex items-center gap-3 mb-8">
                            <Activity className="text-indigo-400" size={24} />
                            <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Score Distribution</h3>
                        </div>
                        <div className="w-full overflow-x-auto premium-scrollbar">
                            <div style={{ minWidth: `${Math.max(500, analytics.scoreDistribution.length * 60)}px`, height: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.scoreDistribution} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                        <XAxis dataKey="range" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} tickLine={false} axisLine={false} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                        <Bar dataKey="count" name="Count of Students" radius={[8, 8, 0, 0]} maxBarSize={50}>
                                            {analytics.scoreDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Participation Rate */}
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 sm:p-8 rounded-[2.5rem] flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <Users className="text-teal-400" size={24} />
                            <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Participation</h3>
                        </div>
                        <div className="flex-1 flex items-center justify-center relative min-h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-4xl font-black text-white italic">
                                    {analytics.participationRate.totalEligible > 0 ? Math.round((analytics.participationRate.attempted / analytics.participationRate.totalEligible) * 100) : 100}%
                                </span>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rate</span>
                            </div>
                        </div>
                        <div className="flex justify-center gap-6 mt-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attempted</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Missed</span>
                            </div>
                        </div>
                    </div>

                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Section Performance */}
                    <div className="lg:col-span-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 sm:p-8 rounded-[2.5rem]">
                        <div className="flex items-center gap-3 mb-6">
                            <Award className="text-yellow-400" size={24} />
                            <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Section Mastery</h3>
                        </div>
                        <div className="w-full overflow-x-auto premium-scrollbar pb-2">
                            <div style={{ minWidth: `${Math.max(300, radarData.length * 60)}px`, height: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={radarData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                        <XAxis dataKey="subject" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} tickLine={false} axisLine={false} />
                                        <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} tickLine={false} axisLine={false} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                        <Bar dataKey="A" name="Avg Score (%)" radius={[8, 8, 0, 0]} maxBarSize={50}>
                                            {radarData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Top Students */}
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 sm:p-8 rounded-[2.5rem]">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <Trophy className="text-yellow-500" size={24} />
                                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Top Performers (Leaderboard)</h3>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {analytics.topStudents.length > 0 ? analytics.topStudents.map((student, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-[var(--bg-primary)] border border-white/5 p-4 rounded-2xl hover:bg-[var(--bg-secondary)] transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`min-w-[2.5rem] px-2.5 h-10 rounded-full flex items-center justify-center font-black italic text-lg ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/50' : idx === 2 ? 'bg-amber-600/20 text-amber-600 border border-amber-600/50' : 'bg-[var(--bg-secondary)] text-slate-400'}`}>
                                            #{student.rank}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white uppercase">{student.username}</p>
                                            <p className="text-xs text-slate-500 font-bold tracking-widest uppercase flex items-center gap-1">
                                                <Clock size={12} /> {Math.round(student.timeTaken / 60)}m {student.timeTaken % 60}s
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-black text-[var(--text-accent)] italic">{student.score}</p>
                                        <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase">Accuracy: {student.accuracy}%</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-10 text-slate-500 font-bold uppercase tracking-widest italic">No attempts yet</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Question Performance Chart */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 sm:p-8 rounded-[2.5rem]">
                    <div className="flex items-center gap-3 mb-8">
                        <Activity className="text-teal-400" size={24} />
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Question-Wise Performance</h3>
                    </div>
                    <div className="w-full overflow-x-auto premium-scrollbar">
                        <div style={{ minWidth: `${Math.max(600, analytics.questionPerformance.length * 60)}px`, height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart 
                                    data={analytics.questionPerformance.map(q => ({ name: `Q${q.questionIndex + 1}`, index: q.questionIndex, correct: q.correct }))} 
                                    margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                                    onClick={(state) => {
                                        if (state && state.activePayload && state.activePayload.length) {
                                            navigate(`/analytics/question/${id}/${state.activePayload[0].payload.index}`);
                                        }
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis 
                                        dataKey="name" 
                                        stroke="#64748b" 
                                        tickLine={false} 
                                        axisLine={false} 
                                        tick={(props) => {
                                            const { x, y, payload } = props;
                                            if (!payload) return null;
                                            const qNum = parseInt(payload.value.replace('Q', ''), 10) - 1;
                                            return (
                                                <g 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/analytics/question/${id}/${qNum}`);
                                                    }}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <text 
                                                        x={x} 
                                                        y={y + 15} 
                                                        textAnchor="middle" 
                                                        fill="#64748b" 
                                                        className="font-bold hover:fill-[var(--text-accent)] transition-colors hover:underline"
                                                        style={{ fontSize: '12px', fontWeight: 700 }}
                                                    >
                                                        {payload.value}
                                                    </text>
                                                </g>
                                            );
                                        }}
                                    />
                                    <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} tickLine={false} axisLine={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                    <Bar dataKey="correct" name="Correct Answers" radius={[8, 8, 0, 0]} maxBarSize={50}>
                                        {analytics.questionPerformance.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <p className="text-center text-xs text-slate-500 font-bold uppercase tracking-widest mt-4">Click a bar to view detailed deep analysis</p>
                </div>

                {/* Question Performance List */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 sm:p-8 rounded-[2.5rem]">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="text-rose-400" size={24} />
                            <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Question Insights</h3>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto premium-scrollbar pb-3 scroll-smooth" style={{ scrollbarWidth: 'thin' }}>
                        <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
                            <thead>
                                <tr className="border-b border-[var(--border-color)]">
                                    <th className="p-4 text-[10px] font-black text-[var(--text-secondary)] opacity-60 uppercase tracking-widest w-[80px]">Q.No</th>
                                    <th className="p-4 text-[10px] font-black text-[var(--text-secondary)] opacity-60 uppercase tracking-widest min-w-[400px] max-w-[900px] w-auto">Question Text</th>
                                    <th className="p-4 text-[10px] font-black text-[var(--text-secondary)] opacity-60 uppercase tracking-widest w-[130px]">Difficulty</th>
                                    <th className="p-4 text-[10px] font-black text-[var(--text-secondary)] opacity-60 uppercase tracking-widest text-center w-[130px]">Accuracy</th>
                                    <th className="p-4 text-[10px] font-black text-[var(--text-secondary)] opacity-60 uppercase tracking-widest text-right w-[130px]">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.questionPerformance.map((q, idx) => (
                                    <tr key={idx} className="border-b border-white/5 premium-table-row group">
                                        <td className="p-4 text-sm font-black text-[var(--text-secondary)] opacity-80 italic">#{idx + 1}</td>
                                        <td className="p-4 text-sm text-[var(--text-primary)] opacity-90 font-medium">
                                            <div className="max-h-[100px] overflow-y-auto premium-scrollbar pr-2 break-words overflow-wrap-anywhere whitespace-normal leading-relaxed text-left scroll-smooth" style={{ scrollbarWidth: 'thin' }}>
                                                {q.questionText}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${q.difficulty === 'Easy' ? 'bg-green-500/10 text-green-400' : q.difficulty === 'Hard' ? 'bg-rose-500/10 text-rose-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                {q.difficulty}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`text-sm font-black italic ${q.accuracy > 70 ? 'text-green-400' : q.accuracy < 40 ? 'text-rose-400' : 'text-yellow-400'}`}>
                                                    {q.accuracy}%
                                                </span>
                                                <div className="w-20 h-1.5 bg-black/40 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${q.accuracy > 70 ? 'bg-green-400' : q.accuracy < 40 ? 'bg-rose-400' : 'bg-yellow-400'}`} style={{ width: `${q.accuracy}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <Link 
                                                to={`/analytics/question/${id}/${idx}`}
                                                className="inline-flex items-center gap-1 bg-[var(--bg-primary)] hover:bg-[var(--bg-accent)] hover:text-[var(--text-on-accent)] text-[var(--text-secondary)] px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 border border-[var(--border-color)]"
                                            >
                                                Analyze <ArrowRight size={12} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Tactical Memory Map Leaderboard */}
                {analytics.leaderboard && analytics.leaderboard.length > 0 && (
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 sm:p-8 rounded-[2.5rem]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                            <div className="flex items-center gap-3">
                                <Users className="text-[var(--text-accent)]" size={24} />
                                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Tactical Memory Map</h3>
                            </div>
                            
                            {/* Legend */}
                            <div className="flex flex-wrap items-center gap-4 bg-white/[0.02] border border-white/5 rounded-2xl px-4 py-2 text-xs">
                                <span className="font-bold text-white/40 uppercase tracking-widest text-[9px]">Legend:</span>
                                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                                    <span className="w-5 h-5 rounded bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[10px]">✓</span>
                                    Correct
                                </div>
                                <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                                    <span className="w-5 h-5 rounded bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-[10px]">✗</span>
                                    Incorrect
                                </div>
                                <div className="flex items-center gap-1.5 text-white/40 font-bold">
                                    <span className="w-5 h-5 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[10px]">-</span>
                                    Skipped
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto premium-scrollbar pb-3">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="border-b border-[var(--border-color)]">
                                        <th className="p-4 text-[10px] font-black text-[var(--text-secondary)] opacity-60 uppercase tracking-widest w-[80px] text-center">Rank</th>
                                        <th className="p-4 text-[10px] font-black text-[var(--text-secondary)] opacity-60 uppercase tracking-widest w-[200px]">Student</th>
                                        <th className="p-4 text-[10px] font-black text-[var(--text-secondary)] opacity-60 uppercase tracking-widest">Question Markings</th>
                                        <th className="p-4 text-[10px] font-black text-[var(--text-secondary)] opacity-60 uppercase tracking-widest text-center w-[120px]">Current Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analytics.leaderboard.map((student, idx) => (
                                        <tr key={idx} className="border-b border-white/5 premium-table-row group">
                                            <td className="p-4 text-sm font-black text-[var(--text-secondary)] opacity-80 italic text-center tracking-normal"><span className="inline-block px-2 py-0.5">#{student.rank}</span></td>
                                            <td className="p-4 text-left">
                                                <p className="font-black text-white uppercase text-sm">{student.username}</p>
                                                <p className="text-[10px] text-[var(--text-secondary)] opacity-50 font-mono mt-0.5">{student.id}</p>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {analytics.questionPerformance.map((q, qIdx) => {
                                                        const studentAns = (student.answers || []).find(a => a.questionText === q.questionText);
                                                        const isAnswered = studentAns && studentAns.selectedOption && studentAns.selectedOption !== '';
                                                        const isCorrect = studentAns?.isCorrect === true;

                                                        let dotClass = 'bg-white/5 border-white/10 text-white/30';
                                                        let iconText = '-';

                                                        if (isAnswered) {
                                                            if (isCorrect) {
                                                                dotClass = 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
                                                                iconText = '✓';
                                                            } else {
                                                                dotClass = 'bg-rose-500/20 border-rose-500/40 text-rose-400';
                                                                iconText = '✗';
                                                            }
                                                        }

                                                        return (
                                                            <div
                                                                key={qIdx}
                                                                title={`Q${qIdx + 1}: ${isAnswered ? (isCorrect ? 'Correct' : 'Incorrect') : 'Skipped/Not Attempted'}`}
                                                                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black border transition-all ${dotClass}`}
                                                            >
                                                                {iconText}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="text-lg font-black italic text-[var(--text-accent)]">{student.score}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>
        </DashboardLayout>
    );
}
