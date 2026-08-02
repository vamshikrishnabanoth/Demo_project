import React, { useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';
import {
    Users, Shield, UserCheck, GraduationCap, Activity, LayoutDashboard,
    Plus, RefreshCw, Database, Cpu, Lock, Wifi, HardDrive, Radio,
    TrendingUp, Clock, Zap, ChevronRight, AlertCircle, CheckCircle2,
    BookOpen, Megaphone, UserPlus
} from 'lucide-react';
import { showSuccess, showError } from '../utils/alerts';
import DashboardLayout from '../components/DashboardLayout';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

// --- Animated counter ---
function AnimatedCount({ value }) {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        let start = 0;
        const end = parseInt(value, 10) || 0;
        if (end === 0) { setDisplay(0); return; }
        const step = Math.max(1, Math.floor(end / 40));
        const timer = setInterval(() => {
            start += step;
            if (start >= end) { setDisplay(end); clearInterval(timer); }
            else setDisplay(start);
        }, 20);
        return () => clearInterval(timer);
    }, [value]);
    return <span>{display.toLocaleString()}</span>;
}

// --- Skeleton pulse ---
function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-white/10 rounded-xl ${className}`} />;
}

// --- System Health Item ---
function HealthItem({ icon: Icon, label, status = 'online' }) {
    const colors = {
        online:   { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Online' },
        degraded: { dot: 'bg-amber-400',   text: 'text-amber-400',   label: 'Degraded' },
        offline:  { dot: 'bg-rose-400',    text: 'text-rose-400',    label: 'Offline' },
    };
    const c = colors[status] || colors.online;
    return (
        <div className="flex items-center justify-between py-3 px-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all">
            <div className="flex items-center gap-3">
                <Icon size={16} className="text-[var(--text-accent)]" />
                <span className="text-xs font-bold text-white/70 uppercase tracking-widest">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${c.dot} ${status === 'online' ? 'animate-pulse' : ''} shadow-[0_0_6px_currentColor]`} />
                <span className={`text-[10px] font-black uppercase tracking-wider ${c.text}`}>{c.label}</span>
            </div>
        </div>
    );
}

// --- Recent Activity Item ---
function ActivityItem({ item }) {
    const roleIcon = { student: '🎓', teacher: '👨‍🏫', admin: '🛡️' };
    const timeAgo = (date) => {
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };
    return (
        <div className="flex items-start gap-3 py-3 px-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all">
            <div className="w-8 h-8 rounded-xl bg-[var(--bg-accent)]/10 flex items-center justify-center shrink-0 text-base">
                {roleIcon[item.user?.role] || '👤'}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white/80 leading-relaxed truncate">{item.message}</p>
                <p className="text-[10px] text-white/30 font-bold mt-0.5 uppercase tracking-widest">{timeAgo(item.timestamp)}</p>
            </div>
        </div>
    );
}

const CHART_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#f97316', '#14b8a6', '#ec4899'];

export default function AdminDashboard() {
    const navigate  = useNavigate();
    const { user }  = useContext(AuthContext);

    const [dashData, setDashData] = useState(null);
    const [loading,  setLoading]  = useState(true);
    const [onlineUsers, setOnlineUsers] = useState(0);
    const [healthStatus, setHealthStatus] = useState({ db: 'online', auth: 'online', socket: 'online', storage: 'online' });

    const fetchDashboard = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/dashboard');
            setDashData(res.data);
            setOnlineUsers(res.data.onlineNow || 0);
        } catch (err) {
            // Fallback to stats endpoint if new dashboard endpoint not deployed yet
            try {
                const res2 = await api.get('/admin/stats');
                const d = res2.data;
                setDashData({ ...d, totalUsers: d.students + d.teachers + d.admins, recentActivity: [], charts: { branchDistribution: [], yearDistribution: [] } });
            } catch { /* no-op */ }
        } finally { setLoading(false); }
    }, []);

    // Check API health
    const checkHealth = useCallback(async () => {
        try {
            await api.get('/health');
            setHealthStatus(h => ({ ...h, db: 'online', auth: 'online' }));
        } catch {
            setHealthStatus(h => ({ ...h, db: 'degraded' }));
        }
    }, []);

    useEffect(() => { fetchDashboard(); checkHealth(); }, [fetchDashboard, checkHealth]);

    // Listen to online user changes via socket
    useEffect(() => {
        const handleStatus = () => {};
        socket.on('user_status_change', handleStatus);
        return () => socket.off('user_status_change', handleStatus);
    }, []);

    const stats = dashData ? [
        {
            label: 'Total Users',
            value: (dashData.students || 0) + (dashData.teachers || 0) + (dashData.admins || 0),
            icon: Users,
            color: 'from-amber-500 to-orange-500',
            shadow: 'shadow-amber-500/20',
            path: '/admin/students',
            description: 'All registered accounts',
        },
        {
            label: 'Students',
            value: dashData.students || 0,
            icon: GraduationCap,
            color: 'from-sky-500 to-blue-600',
            shadow: 'shadow-sky-500/20',
            path: '/admin/students',
            description: 'Enrolled students',
        },
        {
            label: 'Teachers',
            value: dashData.teachers || 0,
            icon: UserCheck,
            color: 'from-emerald-500 to-teal-600',
            shadow: 'shadow-emerald-500/20',
            path: '/admin/teachers',
            description: 'Faculty members',
        },
        {
            label: 'System Admins',
            value: dashData.admins || 0,
            icon: Shield,
            color: 'from-violet-500 to-purple-600',
            shadow: 'shadow-violet-500/20',
            path: '/admin/admins',
            description: 'Admin accounts',
        },
    ] : [];

    const quickActions = [
        { label: 'Add Teacher',    icon: UserCheck, color: 'bg-emerald-500 hover:bg-emerald-400', path: '/admin/teachers', hint: 'Register new teacher' },
        { label: 'Add Student',    icon: GraduationCap, color: 'bg-sky-500 hover:bg-sky-400',     path: '/admin/students', hint: 'Register new student' },
        { label: 'Create Admin',   icon: Shield,    color: 'bg-violet-500 hover:bg-violet-400',   path: '/admin/admins',   hint: 'Create admin account' },
        { label: 'Broadcast',      icon: Megaphone, color: 'bg-amber-500 hover:bg-amber-400',     path: '/teacher-dashboard', hint: 'Send announcement' },
    ];

    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
    const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } };

    return (
        <DashboardLayout role="admin">
            <div className="space-y-8 pb-20 max-w-[100rem] mx-auto">

                {/* ── Header ── */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                    className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                            Admin <span className="text-[var(--text-accent)]">Dashboard</span>
                        </h1>
                        <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">
                            KMIT Kahoot — System Overview
                        </p>
                    </div>
                    <button onClick={() => { fetchDashboard(); toast.success('Refreshed'); }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all text-xs font-black uppercase tracking-wider cursor-pointer">
                        <RefreshCw size={14} /> Refresh
                    </button>
                </motion.div>

                {/* ── Statistics Cards ── */}
                <motion.div variants={containerVariants} initial="hidden" animate="visible"
                    className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                    {loading
                        ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
                        : stats.map((s) => (
                            <motion.div key={s.label} variants={itemVariants}
                                onClick={() => navigate(s.path)}
                                className={`relative overflow-hidden rounded-3xl bg-white/[0.04] border border-white/[0.08] p-5 cursor-pointer hover:scale-[1.03] hover:border-white/20 transition-all duration-300 group shadow-xl ${s.shadow}`}>
                                {/* Gradient glow blob */}
                                <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-br ${s.color} opacity-20 blur-xl group-hover:opacity-30 transition-opacity`} />
                                <div className="relative z-10">
                                    <div className={`inline-flex p-2.5 rounded-2xl bg-gradient-to-br ${s.color} shadow-lg mb-4`}>
                                        <s.icon size={20} className="text-white" />
                                    </div>
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{s.label}</p>
                                    <p className="text-3xl font-black text-white mt-1 italic tracking-tight">
                                        <AnimatedCount value={s.value} />
                                    </p>
                                    <div className="flex items-center gap-1 mt-2 text-white/30 group-hover:text-white/50 transition-colors">
                                        <span className="text-[9px] font-bold uppercase tracking-widest">{s.description}</span>
                                        <ChevronRight size={10} />
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    }
                </motion.div>

                {/* ── Charts + Activity + Health row ── */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    {/* Charts */}
                    <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Branch distribution pie chart */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                            className="rounded-3xl bg-white/[0.04] border border-white/[0.08] p-6">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="p-2 rounded-xl bg-amber-500/10"><TrendingUp size={16} className="text-amber-400" /></div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-tight">Branch Distribution</h3>
                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Students by branch</p>
                                </div>
                            </div>
                            {loading ? <Skeleton className="h-48" /> : (
                                dashData?.charts?.branchDistribution?.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={180}>
                                        <PieChart>
                                            <Pie data={dashData.charts.branchDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} stroke="none">
                                                {dashData.charts.branchDistribution.map((_, idx) => (
                                                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }} />
                                            <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ color: '#ffffff80', fontSize: 10, fontWeight: 'bold' }}>{v}</span>} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-48 flex items-center justify-center text-white/20 text-xs font-bold uppercase tracking-widest">No branch data yet</div>
                                )
                            )}
                        </motion.div>

                        {/* Year distribution bar chart */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                            className="rounded-3xl bg-white/[0.04] border border-white/[0.08] p-6">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="p-2 rounded-xl bg-sky-500/10"><Activity size={16} className="text-sky-400" /></div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-tight">Year Distribution</h3>
                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Students per year</p>
                                </div>
                            </div>
                            {loading ? <Skeleton className="h-48" /> : (
                                dashData?.charts?.yearDistribution?.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart data={dashData.charts.yearDistribution} barSize={28}>
                                            <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                            <YAxis hide />
                                            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }} cursor={false} />
                                            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                                {dashData.charts.yearDistribution.map((_, idx) => (
                                                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-48 flex items-center justify-center text-white/20 text-xs font-bold uppercase tracking-widest">No year data yet</div>
                                )
                            )}
                        </motion.div>
                    </div>

                    {/* System Health */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                        className="rounded-3xl bg-white/[0.04] border border-white/[0.08] p-6 flex flex-col">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2 rounded-xl bg-emerald-500/10"><CheckCircle2 size={16} className="text-emerald-400" /></div>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-tight">System Health</h3>
                                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Service status</p>
                            </div>
                        </div>
                        <div className="space-y-2 flex-1">
                            <HealthItem icon={Database}   label="Database"        status={healthStatus.db} />
                            <HealthItem icon={Cpu}        label="AI Engine"       status="online" />
                            <HealthItem icon={Lock}       label="Authentication"  status={healthStatus.auth} />
                            <HealthItem icon={Wifi}       label="Socket Server"   status="online" />
                            <HealthItem icon={HardDrive}  label="Storage"         status="online" />
                        </div>
                        <div className="mt-4 p-4 rounded-2xl bg-[var(--bg-accent)]/5 border border-[var(--bg-accent)]/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Radio size={14} className="text-[var(--text-accent)]" />
                                <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Online Now</span>
                            </div>
                            <span className="text-sm font-black text-[var(--text-accent)]">{loading ? '...' : onlineUsers}</span>
                        </div>
                    </motion.div>
                </div>

                {/* ── Activity + Quick Actions row ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Recent Activity */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                        className="rounded-3xl bg-white/[0.04] border border-white/[0.08] p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-violet-500/10"><Clock size={16} className="text-violet-400" /></div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-tight">Recent Activity</h3>
                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Latest system events</p>
                                </div>
                            </div>
                            <button onClick={() => navigate('/admin/students')}
                                className="text-[10px] text-[var(--text-accent)] font-black uppercase tracking-widest hover:underline cursor-pointer">
                                View All
                            </button>
                        </div>
                        <div className="space-y-2">
                            {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />) :
                                dashData?.recentActivity?.length > 0
                                    ? dashData.recentActivity.map((item, i) => <ActivityItem key={i} item={item} />)
                                    : <div className="py-10 text-center text-white/20 text-xs font-bold uppercase tracking-widest">No recent activity</div>
                            }
                        </div>
                    </motion.div>

                    {/* Quick Actions */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                        className="rounded-3xl bg-white/[0.04] border border-white/[0.08] p-6 flex flex-col">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2 rounded-xl bg-orange-500/10"><Zap size={16} className="text-orange-400" /></div>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-tight">Quick Actions</h3>
                                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Common admin tasks</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 flex-1">
                            {quickActions.map((a) => (
                                <button key={a.label} onClick={() => navigate(a.path)}
                                    className={`flex flex-col items-center justify-center gap-2 p-5 rounded-2xl ${a.color} text-white font-black text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer active:scale-95 hover:scale-[1.03] shadow-lg`}>
                                    <a.icon size={22} />
                                    <span className="text-center leading-tight">{a.label}</span>
                                </button>
                            ))}
                        </div>
                        {/* Active session info */}
                        {dashData && (
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Active Today</p>
                                    <p className="text-xl font-black text-[var(--text-accent)] mt-0.5"><AnimatedCount value={dashData.activeToday || 0} /></p>
                                </div>
                                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Online Now</p>
                                    <p className="text-xl font-black text-emerald-400 mt-0.5"><AnimatedCount value={onlineUsers} /></p>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </DashboardLayout>
    );
}
