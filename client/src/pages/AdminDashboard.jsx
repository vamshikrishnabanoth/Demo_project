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
    Briefcase, BookOpen, Mail, Crown, Filter
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
    return <div className={`animate-pulse bg-slate-200/80 rounded-[18px] ${className}`} />;
}

function StatusBadge({ suspended, online }) {
    if (suspended)
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Suspended</span>;
    if (online)
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Online</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Offline</span>;
}

function RoleBadge({ role }) {
    const cfgs = {
        student: { label: 'Student', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
        teacher: { label: 'Teacher', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        admin:   { label: 'Admin',   cls: 'bg-violet-50 text-violet-700 border-violet-200' },
        none:    { label: 'None',    cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    };
    const c = cfgs[role] || cfgs.none;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${c.cls}`}>
            {c.label}
        </span>
    );
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

// ─── TAB 1: OVERVIEW ────────────────────────────────────────────────────────
function AdminOverviewTab({ stats, loadingStats, refreshStats, setActiveTab }) {
    const { user } = useContext(AuthContext);
    const PIE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1'];

    return (
        <div className="space-y-6">
            {/* 4 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {loadingStats ? (
                    Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
                ) : (
                    <>
                        <motion.div whileHover={{ y: -4 }} onClick={() => setActiveTab('directory')}
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

                        <motion.div whileHover={{ y: -4 }} onClick={() => setActiveTab('students')}
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

                        <motion.div whileHover={{ y: -4 }} onClick={() => setActiveTab('teachers')}
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

                        <motion.div whileHover={{ y: -4 }} onClick={() => setActiveTab('admins')}
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
    const [debSearch, setDebSearch] = useState('');
    const [yearF, setYearF] = useState('');
    const [semF, setSemF] = useState('');
    const [sectionF, setSectionF] = useState('');
    const [branchF, setBranchF] = useState('');
    const [statusF, setStatusF] = useState('');

    const [sortCol, setSortCol] = useState('');
    const [sortDir, setSortDir] = useState('asc');

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 50;

    useEffect(() => {
        const t = setTimeout(() => { setDebSearch(search); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const fetchStudents = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/students', {
                params: { page, limit, search: debSearch, year: yearF, semester: semF, section: sectionF, branch: branchF, status: statusF, sort: sortCol, sortDir }
            });
            setStudents(res.data.students || []);
            setTotalPages(res.data.totalPages || 1);
            setTotalCount(res.data.totalCount || 0);
            if (res.data.filterOptions) setFilterOptions(res.data.filterOptions);
        } catch {
            toast.error('Failed to load student records');
        } finally { setLoading(false); }
    }, [page, debSearch, yearF, semF, sectionF, branchF, statusF, sortCol, sortDir]);

    useEffect(() => { fetchStudents(); }, [fetchStudents]);

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
            setStudents(prev => prev.map(s => selectedIds.includes(s.id) ? { ...x, isSuspended: suspend } : s));
            setSelectedIds([]);
            invalidate();
            toast.success(`Selected students ${suspend ? 'suspended' : 'reinstated'}`);
        } catch { toast.error('Bulk status update failed'); }
    };

    return (
        <div className="space-y-4">
            {/* Header Action Bar */}
            <div className="bg-white p-4 rounded-[18px] border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search by name, roll no, email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                        />
                        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setUserModal({ defaultRole: 'student' })} className="px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-xs transition-all cursor-pointer">
                        <Plus size={16} /> Add Student
                    </button>
                    <button onClick={() => setShowImportModal(true)} className="px-3.5 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer">
                        <Upload size={16} /> Bulk Import CSV
                    </button>
                    <button onClick={() => setShowPromoteModal(true)} className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer">
                        <Award size={16} /> Batch Promote
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-50 p-3.5 rounded-[16px] border border-slate-200 flex flex-wrap items-center gap-3 text-xs font-bold">
                <div className="flex items-center gap-1.5 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                    <Filter size={14} /> Filters:
                </div>
                <select value={yearF} onChange={(e) => { setYearF(e.target.value); setPage(1); }} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none">
                    <option value="">All Years</option>
                    {(filterOptions.years || []).map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
                <select value={semF} onChange={(e) => { setSemF(e.target.value); setPage(1); }} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none">
                    <option value="">All Semesters</option>
                    {(filterOptions.semesters || []).map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
                <select value={sectionF} onChange={(e) => { setSectionF(e.target.value); setPage(1); }} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none">
                    <option value="">All Sections</option>
                    {(filterOptions.sections || []).map(sec => <option key={sec} value={sec}>Section {sec}</option>)}
                </select>
                <select value={branchF} onChange={(e) => { setBranchF(e.target.value); setPage(1); }} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none">
                    <option value="">All Branches</option>
                    {(filterOptions.branches || []).map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1); }} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none">
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                </select>

                {selectedIds.length > 0 && (
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-[11px] font-black text-slate-600">{selectedIds.length} Selected</span>
                        <button onClick={() => handleBulkSuspend(true)} className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 text-[11px] font-bold">Suspend</button>
                        <button onClick={handleBulkDelete} className="px-2.5 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-[11px] font-bold">Delete</button>
                    </div>
                )}
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-[18px] border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                                <th className="p-3.5 w-10 text-center">
                                    <input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === students.length} onChange={toggleSelectAll} className="rounded text-sky-600" />
                                </th>
                                <th className="p-3.5">Student Details</th>
                                <th className="p-3.5">Roll / Reg No</th>
                                <th className="p-3.5">Branch</th>
                                <th className="p-3.5">Academic Progress</th>
                                <th className="p-3.5">Status</th>
                                <th className="p-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}><td colSpan="7" className="p-3.5"><Skeleton className="h-10" /></td></tr>
                                ))
                            ) : students.length > 0 ? (
                                students.map((s) => (
                                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="p-3.5 text-center">
                                            <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSelectOne(s.id)} className="rounded text-sky-600" />
                                        </td>
                                        <td className="p-3.5">
                                            <div>
                                                <p className="font-extrabold text-slate-900 text-xs">{s.name || s.username}</p>
                                                <p className="text-[10px] text-slate-400 font-normal">{s.email || 'No email'}</p>
                                            </div>
                                        </td>
                                        <td className="p-3.5 font-mono text-[11px] text-slate-600">{s.rollNumber || s.regNo || '—'}</td>
                                        <td className="p-3.5"><span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700">{s.branch || 'CSE'}</span></td>
                                        <td className="p-3.5 text-[11px]">Yr {s.year || 1} · Sem {s.semester || 1} · Sec {s.section || 'A'}</td>
                                        <td className="p-3.5"><StatusBadge suspended={s.isSuspended} online={s.isOnline} /></td>
                                        <td className="p-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button onClick={() => setViewingProfile(s.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View Analytics"><Eye size={16} /></button>
                                                <button onClick={() => setUserModal({ user: s })} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Edit Student"><Edit3 size={16} /></button>
                                                <button onClick={() => handleSuspend(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title={s.isSuspended ? 'Reinstate' : 'Suspend'}><Ban size={16} /></button>
                                                <button onClick={() => handleDelete(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete Student"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="7" className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">No student records found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Showing {students.length} of {totalCount} students</span>
                    <div className="flex items-center gap-2">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                        <span>Page {page} of {totalPages}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
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
    const [debSearch, setDebSearch] = useState('');
    const [deptFilter, setDeptFilter] = useState('');
    const [statusF, setStatusF] = useState('');

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 50;

    useEffect(() => {
        const t = setTimeout(() => { setDebSearch(search); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const fetchTeachers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/teachers', {
                params: { page, limit, search: debSearch, department: deptFilter, status: statusF }
            });
            setTeachers(res.data.teachers || []);
            setTotalPages(res.data.totalPages || 1);
            setTotalCount(res.data.totalCount || 0);
            if (res.data.filterOptions) setFilterOptions(res.data.filterOptions);
        } catch {
            toast.error('Failed to load faculty records');
        } finally { setLoading(false); }
    }, [page, debSearch, deptFilter, statusF]);

    useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

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
        <div className="space-y-4">
            <div className="bg-white p-4 rounded-[18px] border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search faculty by name, department, email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        />
                    </div>
                    <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white">
                        <option value="">All Departments</option>
                        {(filterOptions.departments || []).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
                <button onClick={() => setUserModal({ defaultRole: 'teacher' })} className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-xs transition-all cursor-pointer">
                    <Plus size={16} /> Add Faculty Member
                </button>
            </div>

            <div className="bg-white rounded-[18px] border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                                <th className="p-3.5">Faculty Member</th>
                                <th className="p-3.5">Department</th>
                                <th className="p-3.5">Assigned Quizzes</th>
                                <th className="p-3.5">Status</th>
                                <th className="p-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}><td colSpan="5" className="p-3.5"><Skeleton className="h-10" /></td></tr>
                                ))
                            ) : teachers.length > 0 ? (
                                teachers.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="p-3.5">
                                            <div>
                                                <p className="font-extrabold text-slate-900 text-xs">{t.name || t.username}</p>
                                                <p className="text-[10px] text-slate-400 font-normal">{t.email || 'No email'}</p>
                                            </div>
                                        </td>
                                        <td className="p-3.5"><span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold">{t.department || 'CSE'}</span></td>
                                        <td className="p-3.5">{t.quizCount || 0} Created</td>
                                        <td className="p-3.5"><StatusBadge suspended={t.isSuspended} online={t.isOnline} /></td>
                                        <td className="p-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button onClick={() => setUserModal({ user: t })} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"><Edit3 size={16} /></button>
                                                <button onClick={() => handleSuspend(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><Ban size={16} /></button>
                                                <button onClick={() => handleDelete(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="5" className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">No faculty member records found</td></tr>
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
    const [debSearch, setDebSearch] = useState('');
    const [statusF, setStatusF] = useState('');

    useEffect(() => {
        const t = setTimeout(() => setDebSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    const fetchAdmins = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/admins', { params: { search: debSearch, status: statusF } });
            setAdmins(res.data.admins || []);
        } catch { toast.error('Failed to load system administrators'); }
        finally { setLoading(false); }
    }, [debSearch, statusF]);

    useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

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
        <div className="space-y-4">
            <div className="bg-white p-4 rounded-[18px] border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="relative flex-1 min-w-[280px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search administrators..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    />
                </div>
                <button onClick={() => setUserModal({ defaultRole: 'admin' })} className="px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-xs transition-all cursor-pointer">
                    <Plus size={16} /> Add Administrator
                </button>
            </div>

            <div className="bg-white rounded-[18px] border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                                <th className="p-3.5">Administrator</th>
                                <th className="p-3.5">Role Level</th>
                                <th className="p-3.5">Status</th>
                                <th className="p-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <tr key={i}><td colSpan="4" className="p-3.5"><Skeleton className="h-10" /></td></tr>
                                ))
                            ) : admins.length > 0 ? (
                                admins.map((a) => (
                                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="p-3.5">
                                            <div>
                                                <p className="font-extrabold text-slate-900 text-xs">{a.name || a.username}</p>
                                                <p className="text-[10px] text-slate-400 font-normal">{a.email || 'No email'}</p>
                                            </div>
                                        </td>
                                        <td className="p-3.5"><span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold">SUPER ADMIN</span></td>
                                        <td className="p-3.5"><StatusBadge suspended={a.isSuspended} online={a.isOnline} /></td>
                                        <td className="p-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button onClick={() => setUserModal({ user: a })} className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"><Edit3 size={16} /></button>
                                                <button onClick={() => handleSuspend(a)} disabled={a.id === currentUser?.id} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-30"><Ban size={16} /></button>
                                                <button onClick={() => handleDelete(a)} disabled={a.id === currentUser?.id} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="4" className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">No administrator records found</td></tr>
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
    const [debSearch, setDebSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('');

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 30;

    useEffect(() => {
        const t = setTimeout(() => { setDebSearch(search); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/users', {
                params: { page, limit, search: debSearch, role: roleFilter === 'all' ? '' : roleFilter, status: statusFilter }
            });
            setUsers(res.data.users || []);
            setTotalPages(res.data.totalPages || 1);
            setTotalCount(res.data.totalCount || 0);
        } catch { toast.error('Failed to load system users'); }
        finally { setLoading(false); }
    }, [page, debSearch, roleFilter, statusFilter]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

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
        <div className="space-y-4">
            <div className="bg-white p-4 rounded-[18px] border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="relative flex-1 min-w-[280px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search global users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white">
                        <option value="all">All Roles</option>
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
                    </select>
                    <button onClick={() => setUserModal({})} className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center gap-2 shadow-xs transition-all cursor-pointer">
                        <Plus size={16} /> Create User
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[18px] border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                                <th className="p-3.5 w-10 text-center">
                                    <input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === users.length} onChange={toggleSelectAll} className="rounded text-slate-800" />
                                </th>
                                <th className="p-3.5">User Identity</th>
                                <th className="p-3.5">Role</th>
                                <th className="p-3.5">Status</th>
                                <th className="p-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}><td colSpan="5" className="p-3.5"><Skeleton className="h-10" /></td></tr>
                                ))
                            ) : users.length > 0 ? (
                                users.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="p-3.5 text-center">
                                            <input type="checkbox" checked={selectedIds.includes(u.id)} onChange={() => toggleSelectOne(u.id)} className="rounded text-slate-800" />
                                        </td>
                                        <td className="p-3.5">
                                            <div>
                                                <p className="font-extrabold text-slate-900 text-xs">{u.name || u.username}</p>
                                                <p className="text-[10px] text-slate-400 font-normal">{u.email || 'No email'}</p>
                                            </div>
                                        </td>
                                        <td className="p-3.5"><RoleBadge role={u.role} /></td>
                                        <td className="p-3.5"><StatusBadge suspended={u.isSuspended} online={u.isOnline} /></td>
                                        <td className="p-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button onClick={() => setUserModal({ user: u })} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"><Edit3 size={16} /></button>
                                                <button onClick={() => handleSuspend(u)} disabled={u.id === currentUser?.id} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-30"><Ban size={16} /></button>
                                                <button onClick={() => handleDelete(u)} disabled={u.id === currentUser?.id} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="5" className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">No matching user records found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Showing {users.length} of {totalCount} users</span>
                    <div className="flex items-center gap-2">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                        <span>Page {page} of {totalPages}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
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
            <div className="space-y-6 pb-20 max-w-[100rem] mx-auto">
                
                {/* Header Greeting & Controls */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-200/80">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                            {getGreeting()}, {user?.name || user?.username || 'Administrator'} 👋
                        </h1>
                        <p className="text-slate-500 text-xs font-semibold mt-1">
                            Admin Command Center — Real-Time Directory & Enterprise Controls
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={refreshStats} className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-xs cursor-pointer">
                            <RefreshCw size={14} className={loadingStats ? 'animate-spin' : ''} /> Sync Live Data
                        </button>
                    </div>
                </motion.div>

                {/* Master Tab Bar Navigation */}
                <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto premium-scrollbar">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                            activeTab === 'overview'
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                        }`}
                    >
                        <Activity size={16} /> Overview & Logs
                    </button>

                    <button
                        onClick={() => setActiveTab('students')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                            activeTab === 'students'
                                ? 'bg-sky-600 text-white shadow-sm'
                                : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                        }`}
                    >
                        <GraduationCap size={16} /> Students ({stats.students || 0})
                    </button>

                    <button
                        onClick={() => setActiveTab('teachers')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                            activeTab === 'teachers'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                    >
                        <UserCheck size={16} /> Teachers ({stats.teachers || 0})
                    </button>

                    <button
                        onClick={() => setActiveTab('admins')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                            activeTab === 'admins'
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                        }`}
                    >
                        <Shield size={16} /> Admins ({stats.admins || 0})
                    </button>

                    <button
                        onClick={() => setActiveTab('directory')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                            activeTab === 'directory'
                                ? 'bg-slate-800 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <Users size={16} /> All Directory ({stats.totalUsers || 0})
                    </button>
                </div>

                {/* Tab Body Render */}
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
