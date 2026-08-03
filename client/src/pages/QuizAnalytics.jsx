import { useState, useEffect, useContext, lazy, Suspense } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import AuthContext from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import toast from 'react-hot-toast';
import { cleanQuizTitle } from '../utils/cleanTitle';
import {
    Activity, Download, Users, CheckCircle, Clock, Trophy, ChevronLeft, Target, Award, FileText, ArrowRight, AlertCircle, Home, Loader2, ShieldAlert, ShieldCheck, CheckCircle2, XCircle, MinusCircle, LayoutList
} from 'lucide-react';
import { SecurityDashboard } from '../components/SecurityDashboard';

// Defer Recharts loading completely until QuizAnalytics mounts (saves 375 KB initial bundle)
const ScoreDistributionChart = lazy(() => import('../components/quiz/LazyCharts').then(m => ({ default: m.ScoreDistributionChart })));
const AccuracyPieChart = lazy(() => import('../components/quiz/LazyCharts').then(m => ({ default: m.AccuracyPieChart })));
const MasteryRadarChart = lazy(() => import('../components/quiz/LazyCharts').then(m => ({ default: m.MasteryRadarChart })));
const QuestionPerformanceChart = lazy(() => import('../components/quiz/LazyCharts').then(m => ({ default: m.QuestionPerformanceChart })));
const TimeSpentChart = lazy(() => import('../components/quiz/LazyCharts').then(m => ({ default: m.TimeSpentChart })));

const ChartFallback = () => (
    <div className="w-full h-[280px] flex flex-col items-center justify-center gap-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
        <Loader2 className="animate-spin text-[var(--text-accent)]" size={24} />
        <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Loading Chart Module...</span>
    </div>
);

// Theme 1: Monochromatic Shades derived from Celestial Blue
const BLUE_SHADES = [
    '#133E87', '#1d4ed8', '#2563eb', '#0284c7', '#3b82f6', '#0369a1', '#1e40af', '#0e7490', '#38bdf8', '#172554'
];

// Theme 2: Monochromatic Shades derived from Tiranga Saffron
const SAFFRON_SHADES = [
    '#D96B27', '#ea580c', '#f97316', '#c2410c', '#b84c12', '#fb923c', '#9a3412', '#d97706', '#ff8c00', '#7c2d12'
];

const getThemePalette = () => {
    const isSaffronTheme = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'india';
    return isSaffronTheme ? SAFFRON_SHADES : BLUE_SHADES;
};
const PIE_COLORS = ['#10b981', '#ef4444'];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white border-2 border-[var(--border-color)] p-4 rounded-2xl shadow-xl backdrop-blur-md" style={{ color: '#0f172a' }}>
                <p className="font-black text-[#0f172a] text-sm tracking-wide mb-1" style={{ color: '#0f172a' }}>{label || 'Metric'}</p>
                <div className="border-t border-slate-200 my-2"></div>
                {payload.map((entry, index) => {
                    // Resolve exact bin fill color for tooltip bullet & value indicator
                    const binColor = entry.payload?.fill || entry.fill || entry.color || 'var(--bg-accent)';
                    return (
                        <div key={index} className="flex items-center gap-2.5 text-xs py-1" style={{ color: '#0f172a' }}>
                            <div 
                                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs border border-white" 
                                style={{ backgroundColor: binColor }} 
                            />
                            <span className="text-[#334155] font-bold" style={{ color: '#334155' }}>{entry.name}:</span>
                            <span className="font-black text-sm" style={{ color: binColor }}>{entry.value}</span>
                        </div>
                    );
                })}
            </div>
        );
    }
    return null;
};

export default function QuizAnalytics() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const isStudent = user?.role === 'student';
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    const fetchAnalytics = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const res = await api.get(`/analytics/quiz/${id}?t=${Date.now()}`);
            setAnalytics(res.data);
        } catch (err) {
            console.error('Analytics fetch error:', err);
            const status = err?.response?.status;
            const msg = err?.response?.data?.msg || err?.response?.data?.error || 'Failed to load analytics';
            setFetchError({ status, msg });
            toast.error(status === 403 ? 'You are not authorized to view these analytics.' : 'Failed to load analytics. Please retry.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
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

    const userRole = user?.role || 'teacher';

    if (loading) {
        return (
            <DashboardLayout role={userRole}>
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

    // Error state — show proper UI with retry button instead of blank screen
    if (fetchError || !analytics) {
        const isUnauthorized = fetchError?.status === 403;
        return (
            <DashboardLayout role={userRole}>
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-color)' }}>
                        <AlertCircle size={32} style={{ color: isUnauthorized ? 'var(--bg-accent)' : '#ef4444' }} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--text-primary)' }}>
                            {isUnauthorized ? 'Access Restricted' : 'Analytics Unavailable'}
                        </h2>
                        <p className="text-sm font-medium max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
                            {isUnauthorized
                                ? 'You are not authorized to view analytics for this quiz.'
                                : fetchError?.msg || 'Analytics data could not be loaded. The quiz may still be in progress or results have not been finalized yet.'}
                        </p>
                    </div>
                    <div className="flex gap-3 flex-wrap justify-center">
                        {!isUnauthorized && (
                            <button
                                onClick={fetchAnalytics}
                                className="px-6 py-3 rounded-xl font-bold text-sm transition-all"
                                style={{ background: 'var(--bg-accent)', color: '#fff' }}
                            >
                                Retry
                            </button>
                        )}
                        <button
                            onClick={() => navigate(-1)}
                            className="px-6 py-3 rounded-xl font-bold text-sm transition-all"
                            style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        >
                            Go Back
                        </button>
                        <button
                            onClick={() => navigate(userRole === 'teacher' ? '/teacher-dashboard' : '/student-dashboard')}
                            className="px-6 py-3 rounded-xl font-bold text-sm transition-all"
                            style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        >
                            Dashboard
                        </button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    // Prepare data safely with fallback defaults
    const pieData = [
        { name: 'Attempted', value: analytics?.participationRate?.attempted || 0 },
        { name: 'Not Attempted', value: Math.max(0, (analytics?.participationRate?.totalEligible || 0) - (analytics?.participationRate?.attempted || 0)) }
    ];

    const radarData = (analytics?.sectionPerformance && analytics.sectionPerformance.length > 0) 
        ? analytics.sectionPerformance.map(s => ({ subject: s.section, A: s.averagePercentage, fullMark: 100 }))
        : [{ subject: 'General', A: analytics?.averageScore || 0, fullMark: 100 }];

    return (
        <DashboardLayout role={userRole}>
            <div className="space-y-12 pb-20 relative">
                {/* Background effects — theme-aware */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none -z-10" style={{ background: 'var(--aurora-glow-1)' }}></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none -z-10" style={{ background: 'var(--aurora-glow-2)' }}></div>

                {/* Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-white/10 pb-8">
                    <div>
                        <div className="flex flex-wrap items-center gap-4 mb-4">
                            {!isStudent && (
                                <>
                                    <button 
                                        onClick={() => navigate('/my-quizzes')} 
                                        className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--bg-accent)] transition-all text-xs font-black uppercase tracking-widest rounded-xl shadow-sm" 
                                        style={{ color: '#0f172a' }}
                                    >
                                        <ChevronLeft size={16} /> Back to Library
                                    </button>
                                    <span className="text-slate-400/30">|</span>
                                </>
                            )}
                            <button 
                                onClick={() => navigate(isStudent ? '/student-dashboard' : '/teacher-dashboard')} 
                                className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all text-xs font-black uppercase tracking-widest rounded-xl shadow-sm cursor-pointer"
                            >
                                <Home size={16} /> Go to Home
                            </button>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white italic uppercase tracking-tighter text-balance">
                            {cleanQuizTitle(analytics.quizTitle)}
                        </h1>
                        <p className="text-indigo-400 font-bold mt-2 uppercase tracking-widest text-sm italic">
                            Analytics Dashboard
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => handleExport('PDF')} className="bg-white border-2 border-[var(--border-color)] !text-[#0f172a] hover:bg-slate-100 px-6 py-3 rounded-2xl font-black italic uppercase tracking-tighter transition-all active:scale-95 flex items-center gap-2 shadow-md text-sm" style={{ color: '#0f172a' }}>
                            <Download size={16} className="text-[#0f172a]" /> <span style={{ color: '#0f172a' }}>PDF</span>
                        </button>
                        <button onClick={() => handleExport('CSV')} className="bg-[var(--bg-accent)] hover:bg-[var(--bg-accent-hover)] !text-white px-6 py-3 rounded-2xl font-black italic uppercase tracking-tighter transition-all active:scale-95 flex items-center gap-2 shadow-md text-sm border border-[var(--bg-accent)]" style={{ color: '#ffffff' }}>
                            <FileText size={16} className="text-white" /> <span style={{ color: '#ffffff' }}>CSV</span>
                        </button>
                    </div>
                </div>

                {/* KPI Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {(isStudent ? [
                        { 
                            title: 'Your Score', 
                            value: analytics.studentAttempt ? `${analytics.studentAttempt.score} PTS` : 'N/A', 
                            icon: Award, 
                            color: 'text-emerald-700', 
                            bg: 'bg-emerald-100 border border-emerald-300 ring-2 ring-emerald-400/20' 
                        },
                        { title: 'Total Questions', value: analytics.totalQuestions, icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50 border border-purple-200' },
                        { title: 'Average Score', value: `${analytics.averageScore}%`, icon: Target, color: 'text-teal-600', bg: 'bg-teal-50 border border-teal-200' },
                        { title: 'Highest Score', value: `${analytics.highestScore}%`, icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50 border border-amber-200' },
                    ] : [
                        { title: 'Total Participants', value: analytics.totalParticipants, icon: Users, color: 'text-[var(--text-accent)]', bg: 'bg-[var(--accent-sand)] border border-[var(--border-color)]' },
                        { title: 'Average Score', value: `${analytics.averageScore}%`, icon: Target, color: 'text-teal-600', bg: 'bg-teal-50 border border-teal-200' },
                        { title: 'Highest Score', value: `${analytics.highestScore}%`, icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50 border border-amber-200' },
                        { title: 'Total Questions', value: analytics.totalQuestions, icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50 border border-purple-200' },
                    ]).map((kpi, idx) => (
                        <div key={idx} className="bg-white border-2 border-[var(--border-color)] p-6 rounded-3xl flex items-center gap-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-[var(--bg-accent)] transition-all duration-300 group">
                            <div className={`p-4 rounded-2xl ${kpi.bg} ${kpi.color} group-hover:scale-105 transition-transform`}>
                                <kpi.icon size={28} />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-[#334155] uppercase tracking-wider mb-1" style={{ color: '#334155' }}>{kpi.title}</p>
                                <p className="text-3xl font-black text-[#0f172a] italic" style={{ color: '#0f172a' }}>{kpi.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Charts Area — Hidden for Students */}
                {!isStudent && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Score Distribution */}
                        <div className="lg:col-span-2 bg-white border-2 border-[var(--border-color)] p-6 sm:p-8 rounded-[2.5rem] shadow-sm">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                                    <Activity size={22} />
                                </div>
                                <h3 className="text-xl font-black text-[#0f172a] uppercase italic tracking-tighter" style={{ color: '#0f172a' }}>Score Distribution</h3>
                            </div>
                            <div className="w-full overflow-x-auto premium-scrollbar">
                                <div style={{ minWidth: `${Math.max(500, analytics.scoreDistribution.length * 60)}px`, height: '300px' }}>
                                    <Suspense fallback={<ChartFallback />}>
                                        <ScoreDistributionChart 
                                            data={(analytics.scoreDistribution || []).map((entry, idx) => ({ ...entry, fill: getThemePalette()[idx % getThemePalette().length] }))} 
                                            tooltip={<CustomTooltip />} 
                                        />
                                    </Suspense>
                                </div>
                            </div>
                        </div>

                        {/* Participation Rate */}
                        <div className="bg-white border-2 border-[var(--border-color)] p-6 sm:p-8 rounded-[2.5rem] flex flex-col shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
                                    <Users size={22} />
                                </div>
                                <h3 className="text-xl font-black text-[#0f172a] uppercase italic tracking-tighter" style={{ color: '#0f172a' }}>Participation</h3>
                            </div>
                            <div className="flex-1 flex items-center justify-center relative min-h-[250px]">
                                <Suspense fallback={<ChartFallback />}>
                                    <AccuracyPieChart data={pieData} colors={PIE_COLORS} />
                                </Suspense>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-4xl font-black text-[#0f172a] italic" style={{ color: '#0f172a' }}>
                                        {analytics.participationRate.totalEligible > 0 ? Math.round((analytics.participationRate.attempted / analytics.participationRate.totalEligible) * 100) : 100}%
                                    </span>
                                    <span className="text-[10px] font-black text-[#334155] uppercase tracking-widest" style={{ color: '#334155' }}>Rate</span>
                                </div>
                            </div>
                            <div className="flex justify-center gap-6 mt-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
                                    <span className="text-xs font-bold text-[#334155] uppercase tracking-wider" style={{ color: '#334155' }}>Attempted</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
                                    <span className="text-xs font-bold text-[#334155] uppercase tracking-wider" style={{ color: '#334155' }}>Missed</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!isStudent && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Section Performance */}
                        <div className="lg:col-span-2 bg-white border-2 border-[var(--border-color)] p-6 sm:p-8 rounded-[2.5rem] shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                                    <Award size={22} />
                                </div>
                                <h3 className="text-xl font-black text-[#0f172a] uppercase italic tracking-tighter" style={{ color: '#0f172a' }}>Section Mastery</h3>
                            </div>
                            <div className="w-full overflow-x-auto premium-scrollbar pb-2">
                                <div style={{ minWidth: `${Math.max(300, radarData.length * 60)}px`, height: '300px' }}>
                                    <Suspense fallback={<ChartFallback />}>
                                        <ScoreDistributionChart 
                                            data={(radarData || []).map((entry, idx) => ({ ...entry, range: entry.subject, count: entry.A, fill: getThemePalette()[idx % getThemePalette().length] }))} 
                                            tooltip={<CustomTooltip />} 
                                        />
                                    </Suspense>
                                </div>
                            </div>
                        </div>

                        {/* Top Students / Leaderboard */}
                        <div className="bg-white border-2 border-[var(--border-color)] rounded-[2.5rem] p-4 sm:p-8 shadow-sm overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                            <div className="flex items-center justify-between mb-8 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-sm">
                                        <Trophy size={26} className="text-amber-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-[#0f172a] uppercase italic tracking-tighter" style={{ color: '#0f172a' }}>
                                            TOP PERFORMERS <span className="text-[var(--text-accent)]">(LEADERBOARD)</span>
                                        </h3>
                                        <p className="text-xs text-[#334155] font-bold uppercase tracking-wider" style={{ color: '#334155' }}>
                                            Ranked by score, accuracy & time taken
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 relative z-10">
                                {analytics.topStudents && analytics.topStudents.length > 0 ? analytics.topStudents.map((student, idx) => {
                                    const isFirst = idx === 0;
                                    const isSecond = idx === 1;
                                    const isThird = idx === 2;

                                    return (
                                        <div 
                                            key={idx} 
                                            className={`flex items-center justify-between p-5 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md border-2 ${
                                                isFirst 
                                                    ? 'bg-gradient-to-r from-amber-500/10 via-yellow-400/5 to-amber-500/10 border-amber-400/60 ring-2 ring-amber-400/20' 
                                                    : isSecond 
                                                    ? 'bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 border-slate-300' 
                                                    : isThird 
                                                    ? 'bg-gradient-to-r from-amber-950/5 via-orange-500/5 to-amber-900/5 border-amber-600/40' 
                                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            {/* Left: Rank badge & Student Info */}
                                            <div className="flex items-center gap-4">
                                                {/* Rank Badge */}
                                                <div 
                                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black italic text-lg shadow-md shrink-0 ${
                                                        isFirst 
                                                            ? 'bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-slate-950 ring-2 ring-amber-400/50' 
                                                            : isSecond 
                                                            ? 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-900 ring-2 ring-slate-300/50' 
                                                            : isThird 
                                                            ? 'bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 text-white ring-2 ring-amber-600/50' 
                                                            : 'bg-white border-2 border-slate-300 text-slate-700'
                                                    }`}
                                                >
                                                    #{student.rank}
                                                </div>

                                                <div>
                                                    <p className="font-black text-[#0f172a] text-base uppercase tracking-tight" style={{ color: '#0f172a' }}>
                                                        {student.username}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-200/80 border border-slate-300 text-[11px] font-bold text-[#334155]" style={{ color: '#334155' }}>
                                                            <Clock size={12} className="text-[#334155]" /> 
                                                            {Math.round(student.timeTaken / 60)}m {student.timeTaken % 60}s
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right: Score & Accuracy Badge */}
                                            <div className="text-right flex flex-col items-end gap-1">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-black text-[var(--text-accent)] italic">
                                                        {student.score}
                                                    </span>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        PTS
                                                    </span>
                                                </div>
                                                <span 
                                                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-xs ${
                                                        student.accuracy >= 80 
                                                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800' 
                                                            : student.accuracy >= 50 
                                                            ? 'bg-[var(--accent-sand)] border-[var(--border-color)] text-[var(--text-accent)]' 
                                                            : 'bg-amber-500/15 border-amber-500/40 text-amber-800'
                                                    }`}
                                                >
                                                    ACCURACY: <span className="font-black">{student.accuracy}%</span>
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-[#334155] font-black uppercase tracking-widest text-xs italic" style={{ color: '#334155' }}>
                                        No attempts recorded yet
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Time Spent per Question Graph — Hidden for Students */}
                {!isStudent && (() => {
                    const studentAnswers = analytics?.studentAttempt?.answers || [];
                    const timeSpentData = (analytics?.questionPerformance || []).map((q, idx) => {
                        const studentAns = studentAnswers.find(a => a.questionText === q.questionText || a.questionIndex === idx);
                        const timeSpent = studentAns ? (studentAns.timeTaken || 0) : (q.avgTimeSpent || 0);
                        const isCorrect = studentAns ? studentAns.isCorrect : null;
                        const status = studentAns ? (studentAns.selectedOption ? (studentAns.isCorrect ? 'Correct' : 'Incorrect') : 'Skipped') : 'Average Time';
                        return {
                            name: `Q${idx + 1}`,
                            index: idx,
                            timeSpent,
                            isCorrect,
                            status
                        };
                    });

                    return (
                        <div className="bg-white border-2 border-[var(--border-color)] p-6 sm:p-8 rounded-[2.5rem] shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                                        <Clock size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-[#0f172a] uppercase italic tracking-tighter" style={{ color: '#0f172a' }}>Time Spent per Question</h3>
                                        <p className="text-xs text-[#334155] font-bold" style={{ color: '#334155' }}>
                                            Time distribution across questions (click any question number or point to analyze)
                                        </p>
                                    </div>
                                </div>

                                {/* Legend */}
                                <div className="flex flex-wrap items-center gap-4 bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-2 text-xs">
                                    <div className="flex items-center gap-1.5 font-black text-emerald-700">
                                        <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Correct
                                    </div>
                                    <div className="flex items-center gap-1.5 font-black text-rose-700">
                                        <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" /> Incorrect
                                    </div>
                                    <div className="flex items-center gap-1.5 font-black text-slate-600">
                                        <span className="w-3 h-3 rounded-full bg-slate-500 inline-block" /> Skipped / Avg
                                    </div>
                                </div>
                            </div>

                            <div className="w-full overflow-x-auto premium-scrollbar">
                                <div style={{ minWidth: `${Math.max(600, (timeSpentData || []).length * 60)}px`, height: '300px' }}>
                                    <Suspense fallback={<ChartFallback />}>
                                        <TimeSpentChart
                                            data={timeSpentData}
                                            onQuestionClick={(qIndex) => navigate(`/analytics/question/${id}/${qIndex}`)}
                                        />
                                    </Suspense>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Question Performance Chart — Hidden for Students */}
                {!isStudent && (
                    <div className="bg-white border-2 border-[var(--border-color)] p-6 sm:p-8 rounded-[2.5rem] shadow-sm">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
                                <Activity size={22} />
                            </div>
                            <h3 className="text-xl font-black text-[#0f172a] uppercase italic tracking-tighter" style={{ color: '#0f172a' }}>Question-Wise Performance</h3>
                        </div>
                        <div className="w-full overflow-x-auto premium-scrollbar">
                            <div style={{ minWidth: `${Math.max(600, (analytics.questionPerformance || []).length * 60)}px`, height: '300px' }}>
                                <Suspense fallback={<ChartFallback />}>
                                    <QuestionPerformanceChart 
                                        data={(analytics.questionPerformance || []).map((q, idx) => ({ 
                                            name: `Q${q.questionIndex + 1}`, 
                                            index: q.questionIndex, 
                                            correct: q.correct,
                                            fill: getThemePalette()[idx % getThemePalette().length] 
                                        }))}
                                        themePalette={getThemePalette()}
                                        onQuestionClick={(qIndex) => navigate(`/analytics/question/${id}/${qIndex}`)}
                                        CustomTooltip={CustomTooltip}
                                    />
                                </Suspense>
                            </div>
                        </div>
                        <p className="text-center text-xs text-[#334155] font-bold uppercase tracking-widest mt-4" style={{ color: '#334155' }}>Click a bar to view detailed deep analysis</p>
                    </div>
                )}

                {/* Question Performance List */}
                <div className="bg-white border-2 border-[var(--border-color)] p-6 sm:p-8 rounded-[2.5rem] shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                                <LayoutList size={22} />
                            </div>
                            <h3 className="text-xl font-black text-[#0f172a] uppercase italic tracking-tighter" style={{ color: '#0f172a' }}>Question Insights</h3>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto premium-scrollbar pb-3 scroll-smooth" style={{ scrollbarWidth: 'thin' }}>
                        <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
                            <thead>
                                <tr className="border-b-2 border-slate-200">
                                    <th className="p-4 text-[11px] font-black text-[#334155] uppercase tracking-widest w-[80px]" style={{ color: '#334155' }}>Q.No</th>
                                    <th className="p-4 text-[11px] font-black text-[#334155] uppercase tracking-widest min-w-[350px] max-w-[900px] w-auto" style={{ color: '#334155' }}>Question Text</th>
                                    {isStudent ? (
                                        <>
                                            <th className="p-4 text-[11px] font-black text-[#334155] uppercase tracking-widest w-[130px] text-center" style={{ color: '#334155' }}>Time Taken</th>
                                            <th className="p-4 text-[11px] font-black text-[#334155] uppercase tracking-widest w-[140px] text-center" style={{ color: '#334155' }}>Result</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="p-4 text-[11px] font-black text-[#334155] uppercase tracking-widest w-[130px]" style={{ color: '#334155' }}>Difficulty</th>
                                            <th className="p-4 text-[11px] font-black text-[#334155] uppercase tracking-widest text-center w-[130px]" style={{ color: '#334155' }}>Accuracy</th>
                                        </>
                                    )}
                                    <th className="p-4 text-[11px] font-black text-[#334155] uppercase tracking-widest text-right w-[130px]" style={{ color: '#334155' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.questionPerformance.map((q, idx) => {
                                    const studentAnswers = analytics?.studentAttempt?.answers || [];
                                    const studentAns = studentAnswers.find(a => a && (
                                        (a.questionIndex !== undefined && Number(a.questionIndex) === idx) ||
                                        (a.questionText && q.questionText && a.questionText.toString().trim().toLowerCase() === q.questionText.toString().trim().toLowerCase())
                                    ));
                                    const studentTime = studentAns ? `${studentAns.timeTaken || 0}s` : '0s';
                                    const isCorrect = studentAns ? studentAns.isCorrect : null;
                                    const isAnswered = studentAns && studentAns.selectedOption && studentAns.selectedOption !== '';

                                    return (
                                        <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 text-sm font-black text-[#0f172a] italic" style={{ color: '#0f172a' }}>#{idx + 1}</td>
                                            <td className="p-4 text-sm text-[#0f172a] font-bold" style={{ color: '#0f172a' }}>
                                                <div className="max-h-[100px] overflow-y-auto premium-scrollbar pr-2 break-words overflow-wrap-anywhere whitespace-normal leading-relaxed text-left scroll-smooth" style={{ scrollbarWidth: 'thin' }}>
                                                    {q.questionText}
                                                </div>
                                            </td>
                                            {isStudent ? (
                                                <>
                                                    <td className="p-4 text-center">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-slate-100 border border-slate-300 text-slate-800 shadow-xs">
                                                            <Clock size={12} className="text-slate-500" /> {studentTime}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        {isAnswered ? (
                                                            isCorrect ? (
                                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-emerald-100 border border-emerald-400 text-emerald-800 shadow-xs">
                                                                    <CheckCircle2 size={12} /> Correct
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-rose-100 border border-rose-400 text-rose-800 shadow-xs">
                                                                    <XCircle size={12} /> Incorrect
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-100 border border-slate-300 text-slate-600 shadow-xs">
                                                                <MinusCircle size={12} /> Skipped
                                                            </span>
                                                        )}
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="p-4">
                                                        <span className={`text-[10px] font-black px-3 py-1 rounded-xl uppercase tracking-widest border-2 shadow-xs ${
                                                            q.difficulty === 'Easy' ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 
                                                            q.difficulty === 'Hard' ? 'bg-rose-100 border-rose-400 text-rose-800' : 
                                                            'bg-amber-100 border-amber-400 text-amber-800'
                                                        }`}>
                                                            {q.difficulty}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className={`text-sm font-black italic ${q.accuracy > 70 ? 'text-emerald-700' : q.accuracy < 40 ? 'text-rose-700' : 'text-amber-700'}`}>
                                                                {q.accuracy}%
                                                            </span>
                                                            <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                                                                <div className={`h-full rounded-full ${q.accuracy > 70 ? 'bg-emerald-600' : q.accuracy < 40 ? 'bg-rose-600' : 'bg-amber-500'}`} style={{ width: `${q.accuracy}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                            <td className="p-4 text-right">
                                                <Link 
                                                    to={`/analytics/question/${id}/${idx}`}
                                                    className="inline-flex items-center gap-1.5 bg-[var(--bg-saffron)] hover:bg-[var(--bg-saffron-hover)] !text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 border border-[var(--bg-saffron)] text-white-force"
                                                    style={{ color: '#ffffff' }}
                                                >
                                                    <span className="!text-white font-black" style={{ color: '#ffffff' }}>Analyze</span> <ArrowRight size={14} className="!text-white text-white-force" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Tactical Memory Map Leaderboard — Hidden for Students */}
                {!isStudent && analytics.leaderboard && analytics.leaderboard.length > 0 && (
                    <div className="bg-white border-2 border-[var(--border-color)] p-6 sm:p-8 rounded-[2.5rem] shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[var(--accent-sand)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-accent)]">
                                    <Users size={22} />
                                </div>
                                <h3 className="text-xl font-black text-[#0f172a] uppercase italic tracking-tighter" style={{ color: '#0f172a' }}>Tactical Memory Map</h3>
                            </div>
                            
                            {/* Legend */}
                            <div className="flex flex-wrap items-center gap-4 bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-2.5 text-xs shadow-xs">
                                <span className="font-black text-[#334155] uppercase tracking-widest text-[10px]" style={{ color: '#334155' }}>LEGEND:</span>
                                <div className="flex items-center gap-2 text-emerald-800 font-black">
                                    <span className="w-6 h-6 rounded-lg bg-emerald-100 border-2 border-emerald-400 text-emerald-700 flex items-center justify-center text-xs font-black shadow-xs">✓</span>
                                    Correct
                                </div>
                                <div className="flex items-center gap-2 text-rose-800 font-black">
                                    <span className="w-6 h-6 rounded-lg bg-rose-100 border-2 border-rose-400 text-rose-700 flex items-center justify-center text-xs font-black shadow-xs">✗</span>
                                    Incorrect
                                </div>
                                <div className="flex items-center gap-2 text-[#334155] font-black" style={{ color: '#334155' }}>
                                    <span className="w-6 h-6 rounded-lg bg-slate-100 border-2 border-slate-300 text-slate-500 flex items-center justify-center text-xs font-black">-</span>
                                    Skipped
                                </div>
                            </div>
                        </div>

                        <div className="w-full overflow-x-auto max-w-full premium-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr className="border-b-2 border-slate-200">
                                        <th className="p-4 text-[11px] font-black text-[#334155] uppercase tracking-widest w-[80px] text-center" style={{ color: '#334155' }}>Rank</th>
                                        <th className="p-4 text-[11px] font-black text-[#334155] uppercase tracking-widest w-[200px]" style={{ color: '#334155' }}>Student</th>
                                        <th className="p-4 text-[11px] font-black text-[#334155] uppercase tracking-widest" style={{ color: '#334155' }}>Question Markings</th>
                                        <th className="p-4 text-[11px] font-black text-[#334155] uppercase tracking-widest text-center w-[120px]" style={{ color: '#334155' }}>Current Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analytics.leaderboard.map((student, idx) => (
                                        <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 text-sm font-black text-[#0f172a] italic text-center tracking-normal" style={{ color: '#0f172a' }}>
                                                <span className="inline-block px-3 py-1 rounded-lg bg-slate-100 border border-slate-300">#{student.rank}</span>
                                            </td>
                                            <td className="p-4 text-left">
                                                <p className="font-black text-[#0f172a] uppercase text-sm" style={{ color: '#0f172a' }}>{student.username}</p>
                                                <p className="text-[10px] text-[#334155] font-mono mt-0.5" style={{ color: '#334155' }}>{student.id}</p>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {analytics.questionPerformance.map((q, qIdx) => {
                                                        const studentAns = (student.answers || []).find(a => a.questionText === q.questionText);
                                                        const isAnswered = studentAns && studentAns.selectedOption && studentAns.selectedOption !== '';
                                                        const isCorrect = studentAns?.isCorrect === true;

                                                        let dotClass = 'bg-slate-100 border-2 border-slate-300 text-slate-400';
                                                        let iconText = '-';

                                                        if (isAnswered) {
                                                            if (isCorrect) {
                                                                dotClass = 'bg-emerald-100 border-2 border-emerald-400 text-emerald-700 font-black shadow-xs';
                                                                iconText = '✓';
                                                            } else {
                                                                dotClass = 'bg-rose-100 border-2 border-rose-400 text-rose-700 font-black shadow-xs';
                                                                iconText = '✗';
                                                            }
                                                        }

                                                        return (
                                                            <div
                                                                key={qIdx}
                                                                title={`Q${qIdx + 1}: ${isAnswered ? (isCorrect ? 'Correct' : 'Incorrect') : 'Skipped/Not Attempted'}`}
                                                                className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black transition-all transform hover:scale-110 ${dotClass}`}
                                                            >
                                                                {iconText}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="text-xl font-black italic text-[var(--text-accent)]">{student.score}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Security Alerts & Cheating Audit Log Table — Hidden for Students */}
                {!isStudent && (
                    <SecurityDashboard students={analytics.cheatingLogs || []} />
                )}

            </div>
        </DashboardLayout>
    );
}
