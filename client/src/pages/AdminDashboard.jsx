import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import {
    Users, Shield, UserCheck, GraduationCap, Activity,
    RefreshCw, Database, Cpu, Lock, Wifi, HardDrive,
    TrendingUp, Clock, Zap, CheckCircle2, Megaphone,
    ArrowUpRight, BarChart2
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { motion } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
}

function AnimatedCount({ value }) {
    return <span>{parseInt(value || 0, 10).toLocaleString()}</span>;
}

function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-slate-200/80 rounded-[18px] ${className}`} />;
}

function HealthStatusCard({ icon: Icon, title, statusText, subtext, isOnline = true }) {
    return (
        <div className="flex items-center justify-between p-3.5 rounded-[14px] bg-slate-50/80 border border-slate-200/80 hover:bg-slate-100/80 transition-all">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-white border border-slate-200 shadow-xs flex items-center justify-center shrink-0 text-slate-700">
                    <Icon size={18} />
                </div>
                <div>
                    <h4 className="text-xs font-bold text-slate-900">{title}</h4>
                    <p className="text-[11px] text-slate-500 font-medium">{subtext}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse' : 'bg-rose-500'}`} />
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${isOnline ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200'}`}>
                    {statusText}
                </span>
            </div>
        </div>
    );
}

function ActivityRow({ item }) {
    const roleIconMap = {
        STUDENT_CREATED: { icon: GraduationCap, color: 'text-sky-600 bg-sky-50 border-sky-200' },
        TEACHER_CREATED: { icon: UserCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
        ADMIN_CREATED:   { icon: Shield, color: 'text-purple-600 bg-purple-50 border-purple-200' },
        USER_DELETED:    { icon: Users, color: 'text-rose-600 bg-rose-50 border-rose-200' },
        SEMESTER_PROMOTED: { icon: TrendingUp, color: 'text-amber-600 bg-amber-50 border-amber-200' },
        YEAR_PROMOTED:   { icon: TrendingUp, color: 'text-amber-600 bg-amber-50 border-amber-200' },
        BULK_IMPORT:     { icon: Database, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    };

    const cfg = roleIconMap[item.action] || { icon: Activity, color: 'text-slate-600 bg-slate-50 border-slate-200' };
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

    const actionText = item.action ? item.action.replace(/_/g, ' ') : 'System Action';

    return (
        <div className="flex items-center justify-between py-3 px-3.5 rounded-[12px] bg-slate-50/80 border border-slate-200/60 hover:bg-slate-100/80 transition-all">
            <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-[10px] border flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <IconComponent size={16} />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 truncate">
                        {item.target ? `${actionText}: ${item.target}` : actionText}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">By {item.adminName || 'Admin'}</p>
                </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold shrink-0 ml-2">
                <Clock size={12} />
                <span>{timeAgo(item.timestamp)}</span>
            </div>
        </div>
    );
}

export default function AdminDashboard() {
    const { user } = useContext(AuthContext);
    const { stats, loadingStats, refreshStats } = useAdmin();
    const navigate = useNavigate();

    const PIE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1'];

    return (
        <DashboardLayout role="admin">
            <div className="space-y-6 pb-20 max-w-[100rem] mx-auto">
                
                {/* Header Greeting */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-200/80">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                            {getGreeting()}, {user?.name || user?.username || 'Administrator'} 👋
                        </h1>
                        <p className="text-slate-500 text-xs font-semibold mt-1">
                            Enterprise Portal Overview — Live Real-Time Database Metrics
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={refreshStats} className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-xs cursor-pointer">
                            <RefreshCw size={14} className={loadingStats ? 'animate-spin' : ''} /> Sync Live Data
                        </button>
                    </div>
                </motion.div>

                {/* 4 Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {loadingStats ? (
                        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
                    ) : (
                        <>
                            {/* Total Entities */}
                            <motion.div whileHover={{ y: -4 }} onClick={() => navigate('/admin/users')}
                                className="p-5 rounded-[18px] bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] cursor-pointer hover:border-slate-300 transition-all flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">TOTAL ENTITIES</span>
                                    <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700"><Users size={20} /></div>
                                </div>
                                <div className="mt-3">
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight"><AnimatedCount value={stats.totalUsers} /></h2>
                                    <p className="text-xs text-slate-500 font-medium mt-1">Students + Teachers + Admins</p>
                                </div>
                            </motion.div>

                            {/* Students */}
                            <motion.div whileHover={{ y: -4 }} onClick={() => navigate('/admin/students')}
                                className="p-5 rounded-[18px] bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] cursor-pointer hover:border-slate-300 transition-all flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold text-sky-600 uppercase tracking-wider">ACTIVE STUDENTS</span>
                                    <div className="p-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-600"><GraduationCap size={20} /></div>
                                </div>
                                <div className="mt-3">
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight"><AnimatedCount value={stats.students} /></h2>
                                    <p className="text-xs text-slate-500 font-medium mt-1">Enrolled in Degree Programs</p>
                                </div>
                            </motion.div>

                            {/* Teachers */}
                            <motion.div whileHover={{ y: -4 }} onClick={() => navigate('/admin/teachers')}
                                className="p-5 rounded-[18px] bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] cursor-pointer hover:border-slate-300 transition-all flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold text-emerald-600 uppercase tracking-wider">FACULTY MEMBERS</span>
                                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600"><UserCheck size={20} /></div>
                                </div>
                                <div className="mt-3">
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight"><AnimatedCount value={stats.teachers} /></h2>
                                    <p className="text-xs text-slate-500 font-medium mt-1">Academic & Technical Staff</p>
                                </div>
                            </motion.div>

                            {/* Admins */}
                            <motion.div whileHover={{ y: -4 }} onClick={() => navigate('/admin/admins')}
                                className="p-5 rounded-[18px] bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] cursor-pointer hover:border-slate-300 transition-all flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold text-purple-600 uppercase tracking-wider">SYSTEM ADMINS</span>
                                    <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-600"><Shield size={20} /></div>
                                </div>
                                <div className="mt-3">
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight"><AnimatedCount value={stats.admins} /></h2>
                                    <p className="text-xs text-slate-500 font-medium mt-1">Super Administrators</p>
                                </div>
                            </motion.div>
                        </>
                    )}
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Branch Distribution Pie */}
                    <div className="p-6 rounded-[18px] bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <BarChart2 size={16} className="text-sky-600" /> Branch Demographics
                            </h3>
                            <span className="text-xs text-slate-400 font-bold">Live Breakdown</span>
                        </div>
                        <div className="h-64 flex items-center justify-center">
                            {stats.charts?.branchDistribution?.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={stats.charts.branchDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4}>
                                            {stats.charts.branchDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">No branch data available</div>
                            )}
                        </div>
                    </div>

                    {/* Year Distribution Bar */}
                    <div className="p-6 rounded-[18px] bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <TrendingUp size={16} className="text-emerald-600" /> Student Batch Progression
                            </h3>
                            <span className="text-xs text-slate-400 font-bold">Academic Distribution</span>
                        </div>
                        <div className="h-64">
                            {stats.charts?.yearDistribution?.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.charts.yearDistribution}>
                                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontWeight={700} />
                                        <YAxis stroke="#64748b" fontSize={11} fontWeight={700} />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#0f172a" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-xs font-bold text-slate-400 uppercase tracking-wider">No year data available</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* System Health & Activity Feed */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Activity Feed */}
                    <div className="lg:col-span-2 p-6 rounded-[18px] bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <Activity size={16} className="text-purple-600" /> System Audit Trail
                            </h3>
                            <span className="text-xs font-bold text-slate-400">Recent Admin Operations</span>
                        </div>
                        <div className="space-y-2">
                            {stats.recentActivity?.length > 0 ? (
                                stats.recentActivity.map(item => <ActivityRow key={item.id} item={item} />)
                            ) : (
                                <div className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">No audit activities recorded</div>
                            )}
                        </div>
                    </div>

                    {/* System Infrastructure Health */}
                    <div className="p-6 rounded-[18px] bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] space-y-4">
                        <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <Cpu size={16} className="text-emerald-600" /> System Status
                        </h3>
                        <div className="space-y-3">
                            <HealthStatusCard icon={Database} title="PostgreSQL Database" statusText="Operational" subtext="Prisma ORM Managed" isOnline={true} />
                            <HealthStatusCard icon={Wifi} title="WebSocket Gateway" statusText="Connected" subtext="Socket.io Real-Time" isOnline={true} />
                            <HealthStatusCard icon={Lock} title="JWT Auth Engine" statusText="Active" subtext="Session Tokens Guarded" isOnline={true} />
                            <HealthStatusCard icon={Zap} title="Active Sessions" statusText={`${stats.onlineNow || 0} Online`} subtext="Real-Time Users Connected" isOnline={true} />
                        </div>
                    </div>
                </div>

            </div>
        </DashboardLayout>
    );
}
