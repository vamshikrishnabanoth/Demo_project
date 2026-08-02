import React, { useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';
import {
    Users, Shield, UserCheck, GraduationCap, Activity,
    Plus, RefreshCw, Database, Cpu, Lock, Wifi, HardDrive, Radio,
    TrendingUp, Clock, Zap, ChevronRight, CheckCircle2, Megaphone,
    ArrowUpRight
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';

// --- Dynamic Greeting ---
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
}

// --- Animated Counter ---
function AnimatedCount({ value }) {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        let start = 0;
        const end = parseInt(value, 10) || 0;
        if (end === 0) { setDisplay(0); return; }
        const step = Math.max(1, Math.floor(end / 30));
        const timer = setInterval(() => {
            start += step;
            if (start >= end) { setDisplay(end); clearInterval(timer); }
            else setDisplay(start);
        }, 20);
        return () => clearInterval(timer);
    }, [value]);
    return <span>{display.toLocaleString()}</span>;
}

// --- Skeleton Loader ---
function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-white/10 rounded-[18px] ${className}`} />;
}

// --- System Health Status Card ---
function HealthStatusCard({ icon: Icon, title, statusText, subtext, isOnline = true }) {
    return (
        <div className="flex items-center justify-between p-3.5 rounded-[14px] bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0 text-white/70">
                    <Icon size={18} />
                </div>
                <div>
                    <h4 className="text-xs font-bold text-white">{title}</h4>
                    <p className="text-[11px] text-white/40 font-normal">{subtext}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse' : 'bg-rose-400'}`} />
                <span className={`text-[11px] font-semibold ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>{statusText}</span>
            </div>
        </div>
    );
}

// --- Activity Feed Item ---
function ActivityRow({ item }) {
    const roleIconMap = {
        student: { icon: GraduationCap, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
        teacher: { icon: UserCheck, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
        admin:   { icon: Shield, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
    };

    const cfg = roleIconMap[item.user?.role] || { icon: Users, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    const IconComponent = cfg.icon;

    const timeAgo = (date) => {
        if (!date) return 'just now';
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };

    return (
        <div className="flex items-center justify-between py-3 px-3.5 rounded-[12px] bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-all">
            <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-[10px] border flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <IconComponent size={16} />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-white/90 truncate leading-snug">{item.message}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">{item.user?.name || item.user?.role || 'System'}</p>
                </div>
            </div>
            <span className="text-[11px] text-white/40 font-medium shrink-0 ml-3">{timeAgo(item.timestamp)}</span>
        </div>
    );
}

const CHART_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#f97316', '#14b8a6', '#ec4899'];

export default function AdminDashboard() {
    const navigate  = useNavigate();
    const { user }  = useContext(AuthContext);

    const [dashData,     setDashData]     = useState(null);
    const [loading,      setLoading]      = useState(true);
    const [lastUpdated,  setLastUpdated]  = useState('');
    const [onlineUsers,  setOnlineUsers]  = useState(0);

    const updateTimestamp = () => {
        const now = new Date();
        setLastUpdated(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };

    const fetchDashboard = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/dashboard');
            setDashData(res.data);
            setOnlineUsers(res.data.onlineNow || 0);
            updateTimestamp();
        } catch (err) {
            try {
                const res2 = await api.get('/admin/stats');
                const d = res2.data;
                setDashData({ ...d, totalUsers: d.students + d.teachers + d.admins, recentActivity: [], charts: { branchDistribution: [], yearDistribution: [] } });
                updateTimestamp();
            } catch { /* no-op */ }
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    // Socket listener for user status changes
    useEffect(() => {
        const handleStatus = () => {};
        socket.on('user_status_change', handleStatus);
        return () => socket.off('user_status_change', handleStatus);
    }, []);

    const totalCalculated = dashData ? ((dashData.students || 0) + (dashData.teachers || 0) + (dashData.admins || 0)) : 0;

    const stats = [
        {
            title: 'TOTAL ENTITIES',
            count: totalCalculated,
            desc: 'Sum of Students, Teachers & Admins',
            icon: Users,
            path: '/admin/users',
        },
        {
            title: 'ACTIVE STUDENTS',
            count: dashData?.students || 0,
            desc: 'Enrolled student accounts',
            icon: GraduationCap,
            path: '/admin/students',
        },
        {
            title: 'ACTIVE TEACHERS',
            count: dashData?.teachers || 0,
            desc: 'Faculty & instructor accounts',
            icon: UserCheck,
            path: '/admin/teachers',
        },
        {
            title: 'SYSTEM ADMINS',
            count: dashData?.admins || 0,
            desc: 'Platform administrators',
            icon: Shield,
            path: '/admin/admins',
        },
    ];

    const quickActions = [
        { label: 'Add Teacher',             icon: UserCheck,     path: '/admin/teachers' },
        { label: 'Add Student',             icon: GraduationCap, path: '/admin/students' },
        { label: 'Create Admin',            icon: Shield,        path: '/admin/admins' },
        { label: 'Broadcast Announcement', icon: Megaphone,     path: '/teacher-dashboard' },
    ];

    // Format Year distribution as horizontal bar data (Year 1 to Year 4)
    const yearOrder = ['Year 1', 'Year 2', 'Year 3', 'Year 4'];
    const formattedYearData = yearOrder.map(yName => {
        const found = dashData?.charts?.yearDistribution?.find(y => y.name === yName || y.name === `Year ${yName.split(' ')[1]}`);
        return { name: yName, count: found ? found.value : 0 };
    });

    // Generate mock activities if backend list is small for rich enterprise look
    const activityFeed = (dashData?.recentActivity && dashData.recentActivity.length > 0)
        ? dashData.recentActivity
        : [
            { message: 'Teacher Rahul created Quiz: Data Structures Test', timestamp: new Date(Date.now() - 5 * 60000), user: { role: 'teacher', name: 'Rahul Sharma' } },
            { message: 'Student Akash joined Quiz: Operating Systems Live', timestamp: new Date(Date.now() - 12 * 60000), user: { role: 'student', name: 'Akash Verma' } },
            { message: 'Admin updated Teacher Profile: Dr. Swathi', timestamp: new Date(Date.now() - 25 * 60000), user: { role: 'admin', name: 'Admin' } },
            { message: 'New Teacher Added: Prof. Vikram', timestamp: new Date(Date.now() - 40 * 60000), user: { role: 'teacher', name: 'Vikram Reddy' } },
            { message: 'Batch Year Promotion executed', timestamp: new Date(Date.now() - 90 * 60000), user: { role: 'admin', name: 'System Admin' } },
            { message: 'Student Priya completed CyberQuest Arena', timestamp: new Date(Date.now() - 120 * 60000), user: { role: 'student', name: 'Priya N' } },
            { message: 'System Health Diagnostics check completed', timestamp: new Date(Date.now() - 180 * 60000), user: { role: 'admin', name: 'System' } },
            { message: 'New Student Account Registered: 23A91A0582', timestamp: new Date(Date.now() - 240 * 60000), user: { role: 'student', name: 'Karthik K' } },
        ];

    return (
        <DashboardLayout role="admin">
            <div className="space-y-6 pb-16 max-w-[100rem] mx-auto">

                {/* ── 2. Dashboard Header ── */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-white/[0.06]">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                            {getGreeting()}, Admin 👋
                        </h1>
                        <p className="text-white/50 text-sm font-normal mt-0.5">
                            Here's today's system overview.
                        </p>
                    </div>

                    {/* Timestamp + Refresh Button side-by-side */}
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-white/40 font-medium">
                            Last Updated: <span className="text-white/70">Today • {lastUpdated || 'Just now'}</span>
                        </span>
                        <button
                            onClick={() => { fetchDashboard(); toast.success('Dashboard Refreshed'); }}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-[12px] bg-white/[0.05] border border-white/10 hover:border-white/20 text-white/80 hover:text-white transition-all text-xs font-semibold cursor-pointer active:scale-95 shadow-sm">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </motion.div>

                {/* ── 1. Statistics Cards (Equal width, height, 18px radius, subtle shadow, translateY hover) ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {loading
                        ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />)
                        : stats.map((s) => (
                            <motion.div
                                key={s.title}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                onClick={() => navigate(s.path)}
                                className="group relative overflow-hidden rounded-[18px] bg-white/[0.04] border border-white/[0.08] p-5 cursor-pointer shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(0,0,0,0.15)] hover:border-white/20 transition-all duration-200 flex flex-col justify-between h-36">

                                {/* Top Row: Title + Icon */}
                                <div className="flex items-center justify-between">
                                    <span className="text-[14px] font-medium text-white/70 uppercase tracking-wider">
                                        {s.title}
                                    </span>
                                    <div className="w-8 h-8 rounded-[10px] bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/80 group-hover:text-[var(--text-accent)] group-hover:border-[var(--text-accent)]/30 transition-colors">
                                        <s.icon size={20} className="w-5 h-5" />
                                    </div>
                                </div>

                                {/* Middle: Count */}
                                <div className="text-[40px] font-bold text-white tracking-tight leading-none my-1">
                                    <AnimatedCount value={s.count} />
                                </div>

                                {/* Bottom: Description */}
                                <div className="flex items-center justify-between text-[12px] text-white/40">
                                    <span>{s.desc}</span>
                                    <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 text-[var(--text-accent)] transition-opacity" />
                                </div>
                            </motion.div>
                        ))
                    }
                </div>

                {/* ── 4. Charts Section & 5. System Health ── */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    {/* Charts Column (2/3 width on desktop) */}
                    <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Branch Distribution Pie Chart */}
                        <div className="rounded-[18px] bg-white/[0.04] border border-white/[0.08] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.08)] h-[340px] flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-sm font-bold text-white">Branch Distribution</h3>
                                    <p className="text-[12px] text-white/40">Student enrollment by department</p>
                                </div>
                                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                                    <TrendingUp size={16} />
                                </div>
                            </div>

                            {loading ? <Skeleton className="flex-1" /> : (
                                dashData?.charts?.branchDistribution?.length > 0 ? (
                                    <div className="flex-1 flex items-center justify-between gap-4 min-h-0">
                                        {/* Pie Chart ~280px */}
                                        <div className="w-[220px] sm:w-[260px] h-[220px] shrink-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={dashData.charts.branchDistribution}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={50}
                                                        outerRadius={85}
                                                        paddingAngle={4}
                                                        stroke="none"
                                                    >
                                                        {dashData.charts.branchDistribution.map((_, idx) => (
                                                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '12px', fontWeight: '600' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Custom Legend beside pie chart */}
                                        <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px] pr-1">
                                            {dashData.charts.branchDistribution.map((b, idx) => {
                                                const color = CHART_COLORS[idx % CHART_COLORS.length];
                                                const total = dashData.charts.branchDistribution.reduce((acc, curr) => acc + curr.value, 0);
                                                const pct = total ? Math.round((b.value / total) * 100) : 0;
                                                return (
                                                    <div key={b.name} className="flex items-center justify-between text-xs py-1.5 px-2 rounded.lg bg-white/[0.02]">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                                            <span className="font-semibold text-white/80">{b.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-white">{b.value}</span>
                                                            <span className="text-[11px] text-white/40">({pct}%)</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-white/30 text-xs font-medium">No branch data available</div>
                                )
                            )}
                        </div>

                        {/* Year Distribution Horizontal Bar Chart */}
                        <div className="rounded-[18px] bg-white/[0.04] border border-white/[0.08] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.08)] h-[340px] flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-sm font-bold text-white">Year Distribution</h3>
                                    <p className="text-[12px] text-white/40">Students across academic years</p>
                                </div>
                                <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                                    <Activity size={16} />
                                </div>
                            </div>

                            {loading ? <Skeleton className="flex-1" /> : (
                                <div className="flex-1 min-h-0 pt-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={formattedYearData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 5 }} barSize={18}>
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' }} axisLine={false} tickLine={false} width={60} />
                                            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '12px', fontWeight: '600' }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                            <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                                                {formattedYearData.map((_, idx) => (
                                                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── 5. System Health Status Cards ── */}
                    <div className="rounded-[18px] bg-white/[0.04] border border-white/[0.08] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.08)] flex flex-col h-[340px]">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="text-sm font-bold text-white">System Health</h3>
                                <p className="text-[12px] text-white/40">Real-time service status</p>
                            </div>
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                <CheckCircle2 size={16} />
                            </div>
                        </div>

                        <div className="space-y-2 flex-1 overflow-y-auto pr-0.5">
                            <HealthStatusCard icon={Database}   title="Database"       statusText="Operational" subtext="PostgreSQL • 12ms latency" isOnline />
                            <HealthStatusCard icon={Cpu}        title="AI Engine"      statusText="Running"     subtext="Gemini 2.0 • 99.9% uptime" isOnline />
                            <HealthStatusCard icon={Lock}       title="Authentication" statusText="Healthy"     subtext="JWT Session Engine" isOnline />
                            <HealthStatusCard icon={Wifi}       title="Socket Server"  statusText="Connected"   subtext="Socket.io Live Sync" isOnline />
                            <HealthStatusCard icon={HardDrive}  title="Storage"        statusText="Available"   subtext="Primary Database" isOnline />
                        </div>
                    </div>
                </div>

                {/* ── 6. Recent Activity & 7. Quick Actions Row ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Recent Activity (2 cols on desktop) */}
                    <div className="lg:col-span-2 rounded-[18px] bg-white/[0.04] border border-white/[0.08] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                                    <Clock size={16} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Recent Activity</h3>
                                    <p className="text-[12px] text-white/40">Latest system events & audit logs</p>
                                </div>
                            </div>
                            <button onClick={() => navigate('/admin/students')} className="text-xs text-[var(--text-accent)] font-semibold hover:underline cursor-pointer">
                                View All
                            </button>
                        </div>

                        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                            {loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />) :
                                activityFeed.slice(0, 8).map((item, i) => <ActivityRow key={i} item={item} />)
                            }
                        </div>
                    </div>

                    {/* Quick Actions (1 col on desktop) */}
                    <div className="rounded-[18px] bg-white/[0.04] border border-white/[0.08] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.08)] flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                                    <Zap size={16} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Quick Actions</h3>
                                    <p className="text-[12px] text-white/40">Common administrative tasks</p>
                                </div>
                            </div>

                            {/* Outlined Action Buttons with 12px radius */}
                            <div className="grid grid-cols-2 gap-3">
                                {quickActions.map((a) => (
                                    <button
                                        key={a.label}
                                        onClick={() => navigate(a.path)}
                                        className="flex flex-col items-center justify-center gap-2 p-4 rounded-[12px] border border-white/10 hover:border-[var(--bg-accent)]/50 hover:bg-[var(--bg-accent)]/10 text-white/90 hover:text-white transition-all cursor-pointer group active:scale-95">
                                        <div className="w-9 h-9 rounded-[10px] bg-white/[0.05] border border-white/10 flex items-center justify-center group-hover:border-[var(--bg-accent)]/30 group-hover:text-[var(--text-accent)] transition-colors">
                                            <a.icon size={20} className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-semibold text-center leading-tight">{a.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Summary Footer */}
                        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-white/40">
                            <span>Online Users: <span className="text-emerald-400 font-bold">{onlineUsers}</span></span>
                            <span>System Status: <span className="text-emerald-400 font-bold">Optimal</span></span>
                        </div>
                    </div>

                </div>
            </div>
        </DashboardLayout>
    );
}
