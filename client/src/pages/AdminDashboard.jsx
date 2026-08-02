import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import {
    Users, Shield, UserCheck, GraduationCap, Activity,
    RefreshCw, Database, Cpu, Lock, Wifi, HardDrive,
    TrendingUp, Clock, Zap, CheckCircle2, Megaphone,
    ArrowUpRight, BarChart2, Search, Edit3, Trash2, Ban,
    Plus, X, Upload, Award, ArrowUpDown, Eye, Download,
    Briefcase, BookOpen, Mail, Crown, Filter, Layers, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import toast from 'react-hot-toast';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import UserModal from '../components/admin/UserModal';
import BulkImportModal from '../components/admin/BulkImportModal';
import PromoteModal from '../components/admin/PromoteModal';
import StudentProfileModal from '../components/admin/StudentProfileModal';
import { showConfirm, showSuccess } from '../utils/alerts';

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
    return <div className={`animate-pulse bg-slate-200 rounded-2xl ${className}`} />;
}

// ─── High-Contrast Accessible Status Badges ──────────────────────────
function StatusBadge({ suspended, online }) {
    if (suspended)
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300 shadow-xs"><span className="w-2 h-2 rounded-full bg-rose-600" />Suspended</span>;
    if (online)
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-xs"><span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />Online</span>;
    return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-300 shadow-xs"><span className="w-2 h-2 rounded-full bg-slate-500" />Offline</span>;
}

function RoleBadge({ role }) {
    const cfgs = {
        student: { label: 'Student', cls: 'bg-sky-100 text-sky-950 border border-sky-300' },
        teacher: { label: 'Teacher', cls: 'bg-emerald-100 text-emerald-950 border border-emerald-300' },
        admin:   { label: 'Admin',   cls: 'bg-purple-100 text-purple-950 border border-purple-300' },
        none:    { label: 'None',    cls: 'bg-slate-100 text-slate-800 border border-slate-300' },
    };
    const c = cfgs[role] || cfgs.none;
    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${c.cls}`}>
            {c.label}
        </span>
    );
}

function HealthStatusCard({ icon: Icon, title, statusText, subtext, isOnline = true }) {
    return (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border-2 border-slate-200">
            <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white border-2 border-slate-300 flex items-center justify-center shrink-0 text-slate-900 font-bold">
                    <Icon size={20} />
                </div>
                <div>
                    <h4 className="text-xs font-black text-[#0f172a] uppercase italic tracking-wide">{title}</h4>
                    <p className="text-xs text-slate-600 font-bold">{subtext}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border-2 ${isOnline ? 'text-emerald-900 bg-emerald-100 border-emerald-300' : 'text-rose-900 bg-rose-100 border-rose-300'}`}>
                    {statusText}
                </span>
            </div>
        </div>
    );
}

function ActivityRow({ item }) {
    const roleIconMap = {
        STUDENT_CREATED: { icon: GraduationCap, color: 'text-sky-800 bg-sky-100 border-2 border-sky-300' },
        TEACHER_CREATED: { icon: UserCheck, color: 'text-emerald-800 bg-emerald-100 border-2 border-emerald-300' },
        ADMIN_CREATED:   { icon: Shield, color: 'text-purple-800 bg-purple-100 border-2 border-purple-300' },
        USER_DELETED:    { icon: Users, color: 'text-rose-800 bg-rose-100 border-2 border-rose-300' },
        SEMESTER_PROMOTED: { icon: TrendingUp, color: 'text-amber-800 bg-amber-100 border-2 border-amber-300' },
        YEAR_PROMOTED:   { icon: TrendingUp, color: 'text-amber-800 bg-amber-100 border-2 border-amber-300' },
        BULK_IMPORT:     { icon: Database, color: 'text-indigo-800 bg-indigo-100 border-2 border-indigo-300' },
    };

    const cfg = roleIconMap[item.action] || { icon: Activity, color: 'text-slate-800 bg-slate-100 border-2 border-slate-300' };
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
        <div className="flex items-center justify-between py-3.5 px-4 rounded-2xl bg-slate-50 border-2 border-slate-200">
            <div className="flex items-center gap-3.5 min-w-0">
                <div className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <IconComponent size={18} />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-black text-[#0f172a] truncate uppercase italic tracking-tight">
                        {item.target ? `${actionText}: ${item.target}` : actionText}
                    </p>
                    <p className="text-xs text-slate-600 font-bold">By {item.adminName || 'Admin'}</p>
                </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-black tracking-wider uppercase shrink-0 ml-3 bg-white px-3 py-1 rounded-full border-2 border-slate-300">
                <Clock size={14} />
                <span>{timeAgo(item.timestamp)}</span>
            </div>
        </div>
    );
}

// ─── TAB 1: OVERVIEW ────────────────────────────────────────────────────────
function AdminOverviewTab({ stats, loadingStats, refreshStats, setActiveTab }) {
    const PIE_COLORS = ['#0284c7', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1'];

    return (
        <div className="space-y-8">
            {/* 4 Clean Stat Cards — Text, Number & Icon Colors Match Container Border Color */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {loadingStats ? (
                    Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />)
                ) : (
                    <>
                        <div 
                            onClick={() => setActiveTab('directory')}
                            className="p-6 rounded-3xl bg-white border-2 border-slate-400 shadow-sm cursor-pointer hover:border-slate-600 transition-all flex flex-col justify-between"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">TOTAL ENTITIES</span>
                                <div className="p-3 rounded-2xl bg-slate-100 border-2 border-slate-300 text-slate-800">
                                    <Users size={22} />
                                </div>
                            </div>
                            <div className="mt-4">
                                <h2 className="text-4xl font-black text-slate-900 italic tracking-tight"><AnimatedCount value={stats.totalUsers} /></h2>
                                <p className="text-xs text-slate-600 font-bold tracking-wide mt-1">Students + Teachers + Admins</p>
                            </div>
                        </div>

                        <div 
                            onClick={() => setActiveTab('students')}
                            className="p-6 rounded-3xl bg-white border-2 border-sky-400 shadow-sm cursor-pointer hover:border-sky-500 transition-all flex flex-col justify-between"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-sky-600 uppercase tracking-wider">ACTIVE STUDENTS</span>
                                <div className="p-3 rounded-2xl bg-sky-50 border-2 border-sky-300 text-sky-600">
                                    <GraduationCap size={22} />
                                </div>
                            </div>
                            <div className="mt-4">
                                <h2 className="text-4xl font-black text-sky-600 italic tracking-tight"><AnimatedCount value={stats.students} /></h2>
                                <p className="text-xs text-slate-600 font-bold tracking-wide mt-1">Enrolled Degree Candidates</p>
                            </div>
                        </div>

                        <div 
                            onClick={() => setActiveTab('teachers')}
                            className="p-6 rounded-3xl bg-white border-2 border-emerald-400 shadow-sm cursor-pointer hover:border-emerald-500 transition-all flex flex-col justify-between"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-emerald-600 uppercase tracking-wider">FACULTY MEMBERS</span>
                                <div className="p-3 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-600">
                                    <UserCheck size={22} />
                                </div>
                            </div>
                            <div className="mt-4">
                                <h2 className="text-4xl font-black text-emerald-600 italic tracking-tight"><AnimatedCount value={stats.teachers} /></h2>
                                <p className="text-xs text-slate-600 font-bold tracking-wide mt-1">Academic & Technical Staff</p>
                            </div>
                        </div>

                        <div 
                            onClick={() => setActiveTab('admins')}
                            className="p-6 rounded-3xl bg-white border-2 border-purple-400 shadow-sm cursor-pointer hover:border-purple-500 transition-all flex flex-col justify-between"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-purple-600 uppercase tracking-wider">SYSTEM ADMINS</span>
                                <div className="p-3 rounded-2xl bg-purple-50 border-2 border-purple-300 text-purple-600">
                                    <Shield size={22} />
                                </div>
                            </div>
                            <div className="mt-4">
                                <h2 className="text-4xl font-black text-purple-600 italic tracking-tight"><AnimatedCount value={stats.admins} /></h2>
                                <p className="text-xs text-slate-600 font-bold tracking-wide mt-1">Super Administrators</p>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Clean Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="p-8 rounded-3xl bg-white border-2 border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-sky-100 text-sky-800 border-2 border-sky-300">
                                <BarChart2 size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-[#0f172a] uppercase italic tracking-tight">Branch Demographics</h3>
                                <p className="text-xs font-bold text-slate-600">Department Breakdown</p>
                            </div>
                        </div>
                    </div>
                    <div className="h-72 flex items-center justify-center">
                        {stats.charts?.branchDistribution?.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={stats.charts.branchDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={4}>
                                        {stats.charts.branchDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-[#0f172a] text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs font-bold">
                                                    <p className="text-sky-300 font-black">{payload[0].name}</p>
                                                    <p>{payload[0].value} Enrolled Students</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-xs font-black text-slate-500 uppercase tracking-wider">No branch data recorded</div>
                        )}
                    </div>
                </div>

                <div className="p-8 rounded-3xl bg-white border-2 border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 border-2 border-emerald-300">
                                <TrendingUp size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-[#0f172a] uppercase italic tracking-tight">Batch Progression</h3>
                                <p className="text-xs font-bold text-slate-600">Academic Year Breakdown</p>
                            </div>
                        </div>
                    </div>
                    <div className="h-72">
                        {stats.charts?.yearDistribution?.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.charts.yearDistribution}>
                                    <XAxis dataKey="name" stroke="#0f172a" fontSize={12} fontWeight={800} />
                                    <YAxis stroke="#0f172a" fontSize={12} fontWeight={800} />
                                    <Tooltip content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-[#0f172a] text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs font-bold">
                                                    <p className="text-emerald-300 font-black">{payload[0].payload.name}</p>
                                                    <p>{payload[0].value} Students</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }} />
                                    <Bar dataKey="value" fill="#0f172a" radius={[10, 10, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-xs font-black text-slate-500 uppercase tracking-wider">No year data recorded</div>
                        )}
                    </div>
                </div>
            </div>

            {/* System Audit & Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 p-8 rounded-3xl bg-white border-2 border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-purple-100 text-purple-800 border-2 border-purple-300">
                                <Activity size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-[#0f172a] uppercase italic tracking-tight">System Audit Trail</h3>
                                <p className="text-xs font-bold text-slate-600">Real-Time Administrative Operations Log</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {stats.recentActivity?.length > 0 ? (
                            stats.recentActivity.map(item => <ActivityRow key={item.id} item={item} />)
                        ) : (
                            <div className="py-16 text-center text-xs font-black text-slate-500 uppercase tracking-widest">No audit log records available</div>
                        )}
                    </div>
                </div>

                <div className="p-8 rounded-3xl bg-white border-2 border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 border-2 border-emerald-300">
                                <Cpu size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-[#0f172a] uppercase italic tracking-tight">System Status</h3>
                                <p className="text-xs font-bold text-slate-600">Infrastructure Integrity</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3.5">
                        <HealthStatusCard icon={Database} title="PostgreSQL Database" statusText="Operational" subtext="Prisma ORM Managed" isOnline={true} />
                        <HealthStatusCard icon={Wifi} title="WebSocket Gateway" statusText="Connected" subtext="Socket.io Real-Time" isOnline={true} />
                        <HealthStatusCard icon={Lock} title="JWT Auth Engine" statusText="Active" subtext="Session Tokens Guarded" isOnline={true} />
                        <HealthStatusCard icon={Zap} title="Active Sessions" statusText={`${stats.onlineNow || 0} Online`} subtext="Connected Live Users" isOnline={true} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── TAB 2: STUDENTS DIRECTORY ─────────────────────────────────────────────
function AdminStudentsTab({ setUserModal, setShowImportModal, setShowPromoteModal, setViewingProfile }) {
    const { user: currentUser } = useContext(AuthContext);
    const { invalidate } = useAdmin();

    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterOptions, setFilterOptions] = useState({ years: [], semesters: [], sections: [], branches: [] });
    const [selectedIds, setSelectedIds] = useState([]);

    const [search, setSearch] = useState('');
    const [yearF, setYearF] = useState('');
    const [semF, setSemF] = useState('');
    const [sectionF, setSectionF] = useState('');
    const [branchF, setBranchF] = useState('');
    const [statusF, setStatusF] = useState('');

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 50;

    const resetAllFilters = () => {
        setSearch('');
        setYearF('');
        setSemF('');
        setSectionF('');
        setBranchF('');
        setStatusF('');
        setPage(1);
    };

    const isFiltered = search || yearF || semF || sectionF || branchF || statusF;

    const fetchStudents = useCallback(async (targetPage = page) => {
        setLoading(true);
        try {
            const res = await api.get('/admin/students', {
                params: {
                    page: targetPage,
                    limit,
                    search: search.trim(),
                    year: yearF,
                    semester: semF,
                    section: sectionF,
                    branch: branchF,
                    status: statusF
                }
            });
            setStudents(res.data.students || []);
            setTotalPages(res.data.totalPages || 1);
            setTotalCount(res.data.totalCount || 0);
            if (res.data.filterOptions) setFilterOptions(res.data.filterOptions);
        } catch {
            toast.error('Failed to load student records');
        } finally { setLoading(false); }
    }, [page, limit, search, yearF, semF, sectionF, branchF, statusF]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchStudents(page);
        }, 200);
        return () => clearTimeout(timer);
    }, [search, yearF, semF, sectionF, branchF, statusF, page, fetchStudents]);

    const handleDelete = async (s) => {
        if (s.id === currentUser?.id) return;
        if (!window.confirm(`Permanently delete student ${s.name || s.username}?`)) return;
        try {
            await api.delete(`/admin/users/${s.id}`);
            setStudents(prev => prev.filter(x => x.id !== s.id));
            setSelectedIds(prev => prev.filter(id => id !== s.id));
            invalidate();
            toast.success('Student deleted');
        } catch { toast.error('Delete failed'); }
    };

    const handleSuspend = async (s) => {
        if (s.id === currentUser?.id) return;
        try {
            const res = await api.put(`/admin/users/suspend/${s.id}`);
            setStudents(prev => prev.map(x => x.id === s.id ? { ...x, ...res.data } : x));
            invalidate();
            toast.success(`Student ${s.isSuspended ? 'reinstated' : 'suspended'}`);
        } catch { toast.error('Action failed'); }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === students.length) setSelectedIds([]);
        else setSelectedIds(students.map(s => s.id));
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleBulkDelete = async () => {
        if (!selectedIds.length) return;
        if (!window.confirm(`Delete ${selectedIds.length} selected students?`)) return;
        try {
            await api.post('/admin/users/bulk-delete', { ids: selectedIds });
            setStudents(prev => prev.filter(s => !selectedIds.includes(s.id)));
            setSelectedIds([]);
            invalidate();
            toast.success('Selected students deleted');
        } catch { toast.error('Bulk delete failed'); }
    };

    const handleBulkSuspend = async (suspend = true) => {
        if (!selectedIds.length) return;
        try {
            await api.post('/admin/users/bulk-suspend', { ids: selectedIds, suspend });
            setStudents(prev => prev.map(s => selectedIds.includes(s.id) ? { ...s, isSuspended: suspend } : s));
            setSelectedIds([]);
            invalidate();
            toast.success(`Selected students ${suspend ? 'suspended' : 'reinstated'}`);
        } catch { toast.error('Bulk status update failed'); }
    };

    return (
        <div className="space-y-6">
            {/* Header Control Panel */}
            <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search student name, roll number, email..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className="w-full pl-11 pr-10 py-3 rounded-2xl border-2 border-slate-300 text-sm font-bold text-[#0f172a] placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-800/20"
                        />
                        {search && (
                            <button 
                                onClick={() => { setSearch(''); setPage(1); }} 
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                                aria-label="Clear search"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={() => setUserModal({ defaultRole: 'student' })} className="px-5 py-3 rounded-2xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm border-2 border-slate-950 transition-all cursor-pointer">
                        <Plus size={18} /> Add Student
                    </button>
                    <button onClick={() => setShowImportModal(true)} className="px-5 py-3 rounded-2xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm border-2 border-slate-950 transition-all cursor-pointer">
                        <Upload size={18} /> Import CSV
                    </button>
                    <button onClick={() => setShowPromoteModal(true)} className="px-5 py-3 rounded-2xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm border-2 border-slate-950 transition-all cursor-pointer">
                        <Award size={18} /> Batch Promote
                    </button>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-slate-100 p-5 rounded-3xl border-2 border-slate-200 text-[#0f172a] flex flex-wrap items-center gap-4 text-xs font-black">
                <div className="flex items-center gap-2 text-slate-800 font-black uppercase tracking-widest text-xs">
                    <Filter size={16} /> Filters:
                </div>
                <select value={yearF} onChange={(e) => { setYearF(e.target.value); setPage(1); }} className="px-4 py-2.5 rounded-xl bg-white border-2 border-slate-300 text-[#0f172a] focus:outline-none font-bold">
                    <option value="">All Years</option>
                    {(filterOptions.years || []).map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
                <select value={semF} onChange={(e) => { setSemF(e.target.value); setPage(1); }} className="px-4 py-2.5 rounded-xl bg-white border-2 border-slate-300 text-[#0f172a] focus:outline-none font-bold">
                    <option value="">All Semesters</option>
                    {(filterOptions.semesters || []).map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
                <select value={sectionF} onChange={(e) => { setSectionF(e.target.value); setPage(1); }} className="px-4 py-2.5 rounded-xl bg-white border-2 border-slate-300 text-[#0f172a] focus:outline-none font-bold">
                    <option value="">All Sections</option>
                    {(filterOptions.sections || []).map(sec => <option key={sec} value={sec}>Section {sec}</option>)}
                </select>
                <select value={branchF} onChange={(e) => { setBranchF(e.target.value); setPage(1); }} className="px-4 py-2.5 rounded-xl bg-white border-2 border-slate-300 text-[#0f172a] focus:outline-none font-bold">
                    <option value="">All Branches</option>
                    {(filterOptions.branches || []).map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1); }} className="px-4 py-2.5 rounded-xl bg-white border-2 border-slate-300 text-[#0f172a] focus:outline-none font-bold">
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                </select>

                {isFiltered && (
                    <button 
                        onClick={resetAllFilters}
                        className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs"
                    >
                        <RotateCcw size={14} /> Reset Filters
                    </button>
                )}

                {selectedIds.length > 0 && (
                    <div className="ml-auto flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border-2 border-slate-300">
                        <span className="text-xs font-black text-rose-800 uppercase">{selectedIds.length} Selected</span>
                        <button onClick={() => handleBulkSuspend(true)} className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-500 hover:text-white text-xs font-black uppercase transition-all">Suspend</button>
                        <button onClick={handleBulkDelete} className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase transition-all">Delete</button>
                    </div>
                )}
            </div>

            {/* Students Table */}
            <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-100 border-b-2 border-slate-200 text-[#0f172a] font-black uppercase tracking-wider text-xs">
                                <th className="p-4 w-12 text-center">
                                    <input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === students.length} onChange={toggleSelectAll} className="rounded text-sky-600 w-4 h-4" />
                                </th>
                                <th className="p-4">Student Details</th>
                                <th className="p-4">Branch</th>
                                <th className="p-4">Academic Progress</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-center min-w-[150px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-slate-100 font-bold text-slate-800">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}><td colSpan="6" className="p-4"><Skeleton className="h-12" /></td></tr>
                                ))
                            ) : students.length > 0 ? (
                                students.map((s) => (
                                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-center">
                                            <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSelectOne(s.id)} className="rounded text-sky-600 w-4 h-4" />
                                        </td>
                                        <td className="p-4">
                                            <div>
                                                <p className="font-black text-[#0f172a] text-sm uppercase italic tracking-tight">{s.name || s.username}</p>
                                                <p className="text-xs text-slate-500 font-bold">{s.email || 'No email'}</p>
                                            </div>
                                        </td>
                                        <td className="p-4"><span className="px-3 py-1 rounded-full bg-slate-100 border-2 border-slate-300 text-xs font-black uppercase text-[#0f172a]">{s.branch || 'CSE'}</span></td>
                                        <td className="p-4 text-xs font-bold text-slate-700">Yr {s.year || 1} · Sem {s.semester || 1} · Sec {s.section || 'A'}</td>
                                        <td className="p-4"><StatusBadge suspended={s.isSuspended} online={s.isOnline} /></td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2 min-w-[140px] shrink-0">
                                                <button 
                                                    onClick={() => setViewingProfile(s.id)} 
                                                    className="p-2.5 rounded-xl border-2 border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-400 transition-all duration-150 cursor-pointer flex items-center justify-center w-9 h-9 shrink-0" 
                                                    title="View Student Analytics"
                                                    aria-label="View Student Analytics"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => setUserModal({ user: s })} 
                                                    className="p-2.5 rounded-xl border-2 border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-400 transition-all duration-150 cursor-pointer flex items-center justify-center w-9 h-9 shrink-0" 
                                                    title="Edit Student Details"
                                                    aria-label="Edit Student Details"
                                                >
                                                    <Edit3 size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleSuspend(s)} 
                                                    className="p-2.5 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:border-amber-400 transition-all duration-150 cursor-pointer flex items-center justify-center w-9 h-9 shrink-0" 
                                                    title={s.isSuspended ? 'Reinstate Student' : 'Suspend Student'}
                                                    aria-label={s.isSuspended ? 'Reinstate Student' : 'Suspend Student'}
                                                >
                                                    <Ban size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(s)} 
                                                    className="p-2.5 rounded-xl border-2 border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-400 transition-all duration-150 cursor-pointer flex items-center justify-center w-9 h-9 shrink-0" 
                                                    title="Delete Student Record"
                                                    aria-label="Delete Student Record"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="6" className="py-16 text-center text-xs font-black text-slate-500 uppercase tracking-widest">No student records match your query</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-5 border-t-2 border-slate-100 flex items-center justify-between text-xs font-black text-slate-700 uppercase tracking-wider">
                    <span>Showing {students.length} of {totalCount} students</span>
                    <div className="flex items-center gap-3">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-xl border-2 border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">Previous</button>
                        <span>Page {page} of {totalPages}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-xl border-2 border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── TAB 3: TEACHERS DIRECTORY ─────────────────────────────────────────────
function AdminTeachersTab({ setUserModal }) {
    const { user: currentUser } = useContext(AuthContext);
    const { invalidate } = useAdmin();

    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterOptions, setFilterOptions] = useState({ departments: [] });

    const [search, setSearch] = useState('');
    const [deptFilter, setDeptFilter] = useState('');
    const [statusF, setStatusF] = useState('');

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 50;

    const resetAllFilters = () => {
        setSearch('');
        setDeptFilter('');
        setStatusF('');
        setPage(1);
    };

    const isFiltered = search || deptFilter || statusF;

    const fetchTeachers = useCallback(async (targetPage = page) => {
        setLoading(true);
        try {
            const res = await api.get('/admin/teachers', {
                params: { page: targetPage, limit, search: search.trim(), department: deptFilter, status: statusF }
            });
            setTeachers(res.data.teachers || []);
            setTotalPages(res.data.totalPages || 1);
            setTotalCount(res.data.totalCount || 0);
            if (res.data.filterOptions) setFilterOptions(res.data.filterOptions);
        } catch {
            toast.error('Failed to load faculty records');
        } finally { setLoading(false); }
    }, [page, limit, search, deptFilter, statusF]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchTeachers(page);
        }, 200);
        return () => clearTimeout(timer);
    }, [search, deptFilter, statusF, page, fetchTeachers]);

    const handleDelete = async (t) => {
        if (t.id === currentUser?.id) return;
        const r = await showConfirm('Delete Teacher?', `Permanently delete ${t.name || t.username}?`, 'Delete');
        if (r.isConfirmed) {
            try {
                await api.delete(`/admin/users/${t.id}`);
                setTeachers(prev => prev.filter(x => x.id !== t.id));
                invalidate();
                showSuccess('Deleted', 'Teacher removed.');
            } catch { toast.error('Delete failed'); }
        }
    };

    const handleSuspend = async (t) => {
        if (t.id === currentUser?.id) return;
        const action = t.isSuspended ? 'Reinstate' : 'Suspend';
        const r = await showConfirm(`${action} Teacher?`, `${action} ${t.name || t.username}?`, action);
        if (r.isConfirmed) {
            try {
                const res = await api.put(`/admin/users/suspend/${t.id}`);
                setTeachers(prev => prev.map(x => x.id === t.id ? { ...x, ...res.data } : x));
                invalidate();
                showSuccess('Updated', `Teacher ${t.isSuspended ? 'reinstated' : 'suspended'}.`);
            } catch { toast.error('Action failed'); }
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-[280px]">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search faculty name, department, email..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className="w-full pl-11 pr-10 py-3 rounded-2xl border-2 border-slate-300 text-sm font-bold text-[#0f172a] placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-800/20"
                        />
                        {search && (
                            <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1" aria-label="Clear search">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }} className="px-4 py-3 rounded-2xl border-2 border-slate-300 text-xs font-bold text-[#0f172a] bg-white focus:outline-none">
                        <option value="">All Departments</option>
                        {(filterOptions.departments || []).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1); }} className="px-4 py-3 rounded-2xl border-2 border-slate-300 text-xs font-bold text-[#0f172a] bg-white focus:outline-none">
                        <option value="">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </select>
                    {isFiltered && (
                        <button 
                            onClick={resetAllFilters}
                            className="px-3.5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs"
                        >
                            <RotateCcw size={14} /> Reset
                        </button>
                    )}
                </div>
                <button onClick={() => setUserModal({ defaultRole: 'teacher' })} className="px-5 py-3 rounded-2xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm border-2 border-slate-950 transition-all cursor-pointer">
                    <Plus size={18} /> Add Faculty Member
                </button>
            </div>

            <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-100 border-b-2 border-slate-200 text-[#0f172a] font-black uppercase tracking-wider text-xs">
                                <th className="p-4">Faculty Member</th>
                                <th className="p-4">Department</th>
                                <th className="p-4">Assigned Quizzes</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-center min-w-[130px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-slate-100 font-bold text-slate-800">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}><td colSpan="5" className="p-4"><Skeleton className="h-12" /></td></tr>
                                ))
                            ) : teachers.length > 0 ? (
                                teachers.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div>
                                                <p className="font-black text-[#0f172a] text-sm uppercase italic tracking-tight">{t.name || t.username}</p>
                                                <p className="text-xs text-slate-500 font-bold">{t.email || 'No email'}</p>
                                            </div>
                                        </td>
                                        <td className="p-4"><span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black uppercase">{t.department || 'CSE'}</span></td>
                                        <td className="p-4 font-black text-slate-800">{t.quizCount || 0} Quizzes Created</td>
                                        <td className="p-4"><StatusBadge suspended={t.isSuspended} online={t.isOnline} /></td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2 min-w-[120px] shrink-0">
                                                <button 
                                                    onClick={() => setUserModal({ user: t })} 
                                                    className="p-2.5 rounded-xl border-2 border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-400 transition-all duration-150 cursor-pointer flex items-center justify-center w-9 h-9 shrink-0" 
                                                    title="Edit Faculty Details"
                                                    aria-label="Edit Faculty Details"
                                                >
                                                    <Edit3 size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleSuspend(t)} 
                                                    className="p-2.5 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:border-amber-400 transition-all duration-150 cursor-pointer flex items-center justify-center w-9 h-9 shrink-0" 
                                                    title={t.isSuspended ? 'Reinstate Faculty' : 'Suspend Faculty'}
                                                    aria-label={t.isSuspended ? 'Reinstate Faculty' : 'Suspend Faculty'}
                                                >
                                                    <Ban size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(t)} 
                                                    className="p-2.5 rounded-xl border-2 border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-400 transition-all duration-150 cursor-pointer flex items-center justify-center w-9 h-9 shrink-0" 
                                                    title="Delete Faculty Record"
                                                    aria-label="Delete Faculty Record"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="5" className="py-16 text-center text-xs font-black text-slate-500 uppercase tracking-widest">No faculty records match your query</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── TAB 4: ADMINS DIRECTORY ─────────────────────────────────────────────
function AdminAdminsTab({ setUserModal }) {
    const { user: currentUser } = useContext(AuthContext);
    const { invalidate } = useAdmin();

    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [statusF, setStatusF] = useState('');

    const resetAllFilters = () => {
        setSearch('');
        setStatusF('');
    };

    const isFiltered = search || statusF;

    const fetchAdmins = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/admins', { params: { search: search.trim(), status: statusF } });
            setAdmins(res.data.admins || []);
        } catch { toast.error('Failed to load system administrators'); }
        finally { setLoading(false); }
    }, [search, statusF]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchAdmins();
        }, 200);
        return () => clearTimeout(timer);
    }, [search, statusF, fetchAdmins]);

    const handleDelete = async (a) => {
        if (a.id === currentUser?.id) { toast.error('You cannot delete your own account.'); return; }
        const r = await showConfirm('Delete Admin?', `Permanently delete admin ${a.name || a.username}?`, 'Delete');
        if (r.isConfirmed) {
            try {
                await api.delete(`/admin/users/${a.id}`);
                setAdmins(prev => prev.filter(x => x.id !== a.id));
                invalidate();
                showSuccess('Deleted', 'Admin account removed.');
            } catch { toast.error('Delete failed'); }
        }
    };

    const handleSuspend = async (a) => {
        if (a.id === currentUser?.id) { toast.error('You cannot suspend yourself.'); return; }
        const action = a.isSuspended ? 'Reinstate' : 'Suspend';
        const r = await showConfirm(`${action} Admin?`, `${action} ${a.name || a.username}?`, action);
        if (r.isConfirmed) {
            try {
                const res = await api.put(`/admin/users/suspend/${a.id}`);
                setAdmins(prev => prev.map(x => x.id === a.id ? { ...x, ...res.data } : x));
                invalidate();
                showSuccess('Updated', `Admin ${a.isSuspended ? 'reinstated' : 'suspended'}.`);
            } catch { toast.error('Action failed'); }
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-[280px]">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search administrators..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-11 pr-10 py-3 rounded-2xl border-2 border-slate-300 text-sm font-bold text-[#0f172a] placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-800/20"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1" aria-label="Clear search">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="px-4 py-3 rounded-2xl border-2 border-slate-300 text-xs font-bold text-[#0f172a] bg-white focus:outline-none">
                        <option value="">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </select>
                    {isFiltered && (
                        <button 
                            onClick={resetAllFilters}
                            className="px-3.5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs"
                        >
                            <RotateCcw size={14} /> Reset
                        </button>
                    )}
                </div>
                <button onClick={() => setUserModal({ defaultRole: 'admin' })} className="px-5 py-3 rounded-2xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm border-2 border-slate-950 transition-all cursor-pointer">
                    <Plus size={18} /> Add Administrator
                </button>
            </div>

            <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-100 border-b-2 border-slate-200 text-[#0f172a] font-black uppercase tracking-wider text-xs">
                                <th className="p-4">Administrator</th>
                                <th className="p-4">Role Level</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-center min-w-[130px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-slate-100 font-bold text-slate-800">
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <tr key={i}><td colSpan="4" className="p-4"><Skeleton className="h-12" /></td></tr>
                                ))
                            ) : admins.length > 0 ? (
                                admins.map((a) => (
                                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div>
                                                <p className="font-black text-[#0f172a] text-sm uppercase italic tracking-tight">{a.name || a.username}</p>
                                                <p className="text-xs text-slate-500 font-bold">{a.email || 'No email'}</p>
                                            </div>
                                        </td>
                                        <td className="p-4"><span className="px-3 py-1 rounded-full bg-purple-100 text-purple-900 border border-purple-300 text-xs font-black uppercase">SUPER ADMIN</span></td>
                                        <td className="p-4"><StatusBadge suspended={a.isSuspended} online={a.isOnline} /></td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2 min-w-[120px] shrink-0">
                                                <button 
                                                    onClick={() => setUserModal({ user: a })} 
                                                    className="p-2.5 rounded-xl border-2 border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-400 transition-all duration-150 cursor-pointer flex items-center justify-center w-9 h-9 shrink-0" 
                                                    title="Edit Administrator Details"
                                                    aria-label="Edit Administrator Details"
                                                >
                                                    <Edit3 size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleSuspend(a)} 
                                                    disabled={a.id === currentUser?.id} 
                                                    className="p-2.5 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:border-amber-400 transition-all duration-150 cursor-pointer flex items-center justify-center w-9 h-9 shrink-0 disabled:opacity-30 disabled:cursor-not-allowed" 
                                                    title={a.isSuspended ? 'Reinstate Administrator' : 'Suspend Administrator'}
                                                    aria-label={a.isSuspended ? 'Reinstate Administrator' : 'Suspend Administrator'}
                                                >
                                                    <Ban size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(a)} 
                                                    disabled={a.id === currentUser?.id} 
                                                    className="p-2.5 rounded-xl border-2 border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-400 transition-all duration-150 cursor-pointer flex items-center justify-center w-9 h-9 shrink-0 disabled:opacity-30 disabled:cursor-not-allowed" 
                                                    title="Delete Administrator Record"
                                                    aria-label="Delete Administrator Record"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="4" className="py-16 text-center text-xs font-black text-slate-500 uppercase tracking-widest">No administrator records match your query</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── TAB 5: ALL USERS DIRECTORY ───────────────────────────────────────────
function AdminDirectoryTab({ setUserModal }) {
    const { user: currentUser } = useContext(AuthContext);
    const { invalidate } = useAdmin();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('');

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 30;

    const resetAllFilters = () => {
        setSearch('');
        setRoleFilter('all');
        setStatusFilter('');
        setPage(1);
    };

    const isFiltered = search || (roleFilter && roleFilter !== 'all') || statusFilter;

    const fetchUsers = useCallback(async (targetPage = page) => {
        setLoading(true);
        try {
            const res = await api.get('/admin/users', {
                params: {
                    page: targetPage,
                    limit,
                    search: search.trim(),
                    role: roleFilter === 'all' ? '' : roleFilter,
                    status: statusFilter
                }
            });
            setUsers(res.data.users || []);
            setTotalPages(res.data.totalPages || 1);
            setTotalCount(res.data.totalCount || 0);
        } catch { toast.error('Failed to load system users'); }
        finally { setLoading(false); }
    }, [page, limit, search, roleFilter, statusFilter]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsers(page);
        }, 200);
        return () => clearTimeout(timer);
    }, [search, roleFilter, statusFilter, page, fetchUsers]);

    const handleDelete = async (u) => {
        if (u.id === currentUser?.id) { toast.error('You cannot delete your own account.'); return; }
        const r = await showConfirm('Delete User?', `Permanently delete ${u.name || u.username}?`, 'Delete');
        if (r.isConfirmed) {
            try {
                await api.delete(`/admin/users/${u.id}`);
                setUsers(prev => prev.filter(x => x.id !== u.id));
                setSelectedIds(prev => prev.filter(id => id !== u.id));
                invalidate();
                showSuccess('Deleted', 'User removed.');
            } catch { toast.error('Delete failed'); }
        }
    };

    const handleSuspend = async (u) => {
        if (u.id === currentUser?.id) { toast.error('You cannot suspend yourself.'); return; }
        const action = u.isSuspended ? 'Reinstate' : 'Suspend';
        const r = await showConfirm(`${action} User?`, `${action} ${u.name || u.username}?`, action);
        if (r.isConfirmed) {
            try {
                const res = await api.put(`/admin/users/suspend/${u.id}`);
                setUsers(prev => prev.map(x => x.id === u.id ? { ...x, ...res.data } : x));
                invalidate();
                showSuccess('Updated', `User ${u.isSuspended ? 'reinstated' : 'suspended'}.`);
            } catch { toast.error('Action failed'); }
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === users.length) setSelectedIds([]);
        else setSelectedIds(users.map(u => u.id));
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleBulkDelete = async () => {
        if (!selectedIds.length) return;
        if (!window.confirm(`Delete ${selectedIds.length} selected users?`)) return;
        try {
            await api.post('/admin/users/bulk-delete', { ids: selectedIds });
            setUsers(prev => prev.filter(u => !selectedIds.includes(u.id)));
            setSelectedIds([]);
            invalidate();
            toast.success('Selected users deleted');
        } catch { toast.error('Bulk delete failed'); }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="relative flex-1 min-w-[280px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search global users by name, username, email..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-11 pr-10 py-3 rounded-2xl border-2 border-slate-300 text-sm font-bold text-[#0f172a] placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-800/20"
                    />
                    {search && (
                        <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1" aria-label="Clear search">
                            <X size={16} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="px-4 py-3 rounded-2xl border-2 border-slate-300 text-xs font-bold text-[#0f172a] bg-white focus:outline-none">
                        <option value="all">All Roles</option>
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
                    </select>
                    <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-4 py-3 rounded-2xl border-2 border-slate-300 text-xs font-bold text-[#0f172a] bg-white focus:outline-none">
                        <option value="">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </select>
                    {isFiltered && (
                        <button 
                            onClick={resetAllFilters}
                            className="px-3.5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs"
                        >
                            <RotateCcw size={14} /> Reset
                        </button>
                    )}
                    <button onClick={() => setUserModal({})} className="px-5 py-3 rounded-2xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm border-2 border-slate-950 transition-all cursor-pointer">
                        <Plus size={18} /> Create User
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-100 border-b-2 border-slate-200 text-[#0f172a] font-black uppercase tracking-wider text-xs">
                                <th className="p-4 w-12 text-center">
                                    <input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === users.length} onChange={toggleSelectAll} className="rounded text-slate-800 w-4 h-4" />
                                </th>
                                <th className="p-4">User Identity</th>
                                <th className="p-4">Role</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-center min-w-[130px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-slate-100 font-bold text-slate-800">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}><td colSpan="5" className="p-4"><Skeleton className="h-12" /></td></tr>
                                ))
                            ) : users.length > 0 ? (
                                users.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-center">
                                            <input type="checkbox" checked={selectedIds.includes(u.id)} onChange={() => toggleSelectOne(u.id)} className="rounded text-slate-800 w-4 h-4" />
                                        </td>
                                        <td className="p-4">
                                            <div>
                                                <p className="font-black text-[#0f172a] text-sm uppercase italic tracking-tight">{u.name || u.username}</p>
                                                <p className="text-xs text-slate-500 font-bold">{u.email || 'No email'}</p>
                                            </div>
                                        </td>
                                        <td className="p-4"><RoleBadge role={u.role} /></td>
                                        <td className="p-4"><StatusBadge suspended={u.isSuspended} online={u.isOnline} /></td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2 min-w-[120px] shrink-0">
                                                <button 
                                                    onClick={() => setUserModal({ user: u })} 
                                                    className="p-2.5 rounded-xl border-2 border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-400 transition-all duration-150 cursor-pointer flex items-center justify-center w-9 h-9 shrink-0" 
                                                    title="Edit User Details"
                                                    aria-label="Edit User Details"
                                                >
                                                    <Edit3 size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleSuspend(u)} 
                                                    disabled={u.id === currentUser?.id} 
                                                    className="p-2.5 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:border-amber-400 transition-all duration-150 cursor-pointer flex items-center justify-center w-9 h-9 shrink-0 disabled:opacity-30 disabled:cursor-not-allowed" 
                                                    title={u.isSuspended ? 'Reinstate User' : 'Suspend User'}
                                                    aria-label={u.isSuspended ? 'Reinstate User' : 'Suspend User'}
                                                >
                                                    <Ban size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(u)} 
                                                    disabled={u.id === currentUser?.id} 
                                                    className="p-2.5 rounded-xl border-2 border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-400 transition-all duration-150 cursor-pointer flex items-center justify-center w-9 h-9 shrink-0 disabled:opacity-30 disabled:cursor-not-allowed" 
                                                    title="Delete User Record"
                                                    aria-label="Delete User Record"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="5" className="py-16 text-center text-xs font-black text-slate-500 uppercase tracking-widest">No user records match your query</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-5 border-t-2 border-slate-100 flex items-center justify-between text-xs font-black text-slate-700 uppercase tracking-wider">
                    <span>Showing {users.length} of {totalCount} users</span>
                    <div className="flex items-center gap-3">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-xl border-2 border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">Previous</button>
                        <span>Page {page} of {totalPages}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-xl border-2 border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── MASTER ADMIN COMMAND CENTER MAIN PAGE ──────────────────────────────────
export default function AdminDashboard() {
    const { user } = useContext(AuthContext);
    const { stats, loadingStats, refreshStats, invalidate } = useAdmin();
    const [searchParams, setSearchParams] = useSearchParams();

    const activeTab = searchParams.get('tab') || 'overview';
    const setActiveTab = (tab) => {
        setSearchParams({ tab });
    };

    // Shared Modals
    const [userModal, setUserModal] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showPromoteModal, setShowPromoteModal] = useState(false);
    const [viewingProfile, setViewingProfile] = useState(null);

    const handleSaveUser = () => {
        setUserModal(null);
        invalidate();
        refreshStats();
    };

    return (
        <DashboardLayout role="admin">
            <div className="space-y-8 pb-24 max-w-[100rem] mx-auto">
                
                {/* Clean High-Contrast Header Card */}
                <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border-2 border-emerald-300 text-emerald-900 text-xs font-black uppercase tracking-wider">
                            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                            System Operational
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black text-[#0f172a] uppercase italic tracking-tight">
                            {getGreeting()}, <span className="text-[var(--text-accent)]">{user?.name || user?.username || 'Administrator'}</span> 👋
                        </h1>
                        <p className="text-slate-700 font-bold text-xs sm:text-sm">
                            Admin Command Center — Real-Time Directory & Enterprise Controls
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={refreshStats} 
                            className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm border-2 border-slate-950 cursor-pointer active:scale-95"
                        >
                            <RefreshCw size={16} className={loadingStats ? 'animate-spin text-amber-400' : 'text-amber-400'} /> 
                            <span>Sync Live Data</span>
                        </button>
                    </div>
                </div>

                {/* Master Tab Bar Navigation */}
                <div className="bg-white border-2 border-slate-200 p-2 rounded-3xl flex items-center gap-2 shadow-sm overflow-x-auto premium-scrollbar">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2.5 transition-all duration-200 cursor-pointer whitespace-nowrap border-2 ${
                            activeTab === 'overview'
                                ? 'bg-[#0f172a] text-white border-black shadow-md scale-[1.02]'
                                : 'bg-white text-[#0f172a] border-slate-300 hover:bg-slate-100 font-extrabold'
                        }`}
                    >
                        <Activity size={18} className={activeTab === 'overview' ? 'text-white' : 'text-blue-600'} />
                        <span>Overview & Logs</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('students')}
                        className={`px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2.5 transition-all duration-200 cursor-pointer whitespace-nowrap border-2 ${
                            activeTab === 'students'
                                ? 'bg-[#0f172a] text-white border-black shadow-md scale-[1.02]'
                                : 'bg-white text-[#0f172a] border-slate-300 hover:bg-slate-100 font-extrabold'
                        }`}
                    >
                        <GraduationCap size={18} className={activeTab === 'students' ? 'text-white' : 'text-teal-600'} />
                        <span>Students</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${activeTab === 'students' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-900 border border-teal-300'}`}>{stats.students || 0}</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('teachers')}
                        className={`px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2.5 transition-all duration-200 cursor-pointer whitespace-nowrap border-2 ${
                            activeTab === 'teachers'
                                ? 'bg-[#0f172a] text-white border-black shadow-md scale-[1.02]'
                                : 'bg-white text-[#0f172a] border-slate-300 hover:bg-slate-100 font-extrabold'
                        }`}
                    >
                        <UserCheck size={18} className={activeTab === 'teachers' ? 'text-white' : 'text-emerald-600'} />
                        <span>Teachers</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${activeTab === 'teachers' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}`}>{stats.teachers || 0}</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('admins')}
                        className={`px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2.5 transition-all duration-200 cursor-pointer whitespace-nowrap border-2 ${
                            activeTab === 'admins'
                                ? 'bg-[#0f172a] text-white border-black shadow-md scale-[1.02]'
                                : 'bg-white text-[#0f172a] border-slate-300 hover:bg-slate-100 font-extrabold'
                        }`}
                    >
                        <Shield size={18} className={activeTab === 'admins' ? 'text-white' : 'text-purple-600'} />
                        <span>Admins</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${activeTab === 'admins' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-900 border border-purple-300'}`}>{stats.admins || 0}</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('directory')}
                        className={`px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2.5 transition-all duration-200 cursor-pointer whitespace-nowrap border-2 ${
                            activeTab === 'directory'
                                ? 'bg-[#0f172a] text-white border-black shadow-md scale-[1.02]'
                                : 'bg-white text-[#0f172a] border-slate-300 hover:bg-slate-100 font-extrabold'
                        }`}
                    >
                        <Users size={18} className={activeTab === 'directory' ? 'text-white' : 'text-slate-800'} />
                        <span>All Directory</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${activeTab === 'directory' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-900 border border-slate-300'}`}>{stats.totalUsers || 0}</span>
                    </button>
                </div>

                {/* Tab Body Content */}
                <div className="pt-2">
                    {activeTab === 'overview' && (
                        <AdminOverviewTab stats={stats} loadingStats={loadingStats} refreshStats={refreshStats} setActiveTab={setActiveTab} />
                    )}

                    {activeTab === 'students' && (
                        <AdminStudentsTab
                            setUserModal={setUserModal}
                            setShowImportModal={setShowImportModal}
                            setShowPromoteModal={setShowPromoteModal}
                            setViewingProfile={setViewingProfile}
                        />
                    )}

                    {activeTab === 'teachers' && (
                        <AdminTeachersTab setUserModal={setUserModal} />
                    )}

                    {activeTab === 'admins' && (
                        <AdminAdminsTab setUserModal={setUserModal} />
                    )}

                    {activeTab === 'directory' && (
                        <AdminDirectoryTab setUserModal={setUserModal} />
                    )}
                </div>

                {/* Shared Modals */}
                {userModal && (
                    <UserModal
                        user={userModal.user}
                        defaultRole={userModal.defaultRole}
                        onClose={() => setUserModal(null)}
                        onSave={handleSaveUser}
                    />
                )}

                {showImportModal && (
                    <BulkImportModal
                        onClose={() => setShowImportModal(false)}
                        onSuccess={() => {
                            setShowImportModal(false);
                            invalidate();
                            refreshStats();
                        }}
                    />
                )}

                {showPromoteModal && (
                    <PromoteModal
                        onClose={() => setShowPromoteModal(false)}
                        onSuccess={() => {
                            setShowPromoteModal(false);
                            invalidate();
                            refreshStats();
                        }}
                    />
                )}

                {viewingProfile && (
                    <StudentProfileModal
                        studentId={viewingProfile}
                        onClose={() => setViewingProfile(null)}
                    />
                )}

            </div>
        </DashboardLayout>
    );
}
