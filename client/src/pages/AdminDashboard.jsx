import React, { useContext, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import api from '../utils/api';
import {
    Users, Shield, Settings, Activity, LayoutDashboard, LogOut,
    Plus, Trash2, Edit3, X, Check, Eye, EyeOff, Search,
    RefreshCw, UserCheck, GraduationCap, Crown, AlertTriangle,
    ChevronDown, Save, Loader2
} from 'lucide-react';

const ROLE_META = {
    admin:   { label: 'Admin',   color: 'text-red-400',   bg: 'bg-red-400/10',   border: 'border-red-400/30',   icon: Crown },
    teacher: { label: 'Teacher', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30', icon: UserCheck },
    student: { label: 'Student', color: 'text-sky-400',   bg: 'bg-sky-400/10',   border: 'border-sky-400/30',   icon: GraduationCap },
    none:    { label: 'None',    color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/30', icon: Users },
};

const RoleBadge = ({ role }) => {
    const meta = ROLE_META[role] || ROLE_META.none;
    const Icon = meta.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${meta.color} ${meta.bg} border ${meta.border}`}>
            <Icon size={11} /> {meta.label}
        </span>
    );
};

function UserModal({ user, onClose, onSave, isNew }) {
    const [form, setForm] = useState({
        username: user?.username || '',
        email:    user?.email    || '',
        password: '',
        role:     user?.role     || 'student',
    });
    const [showPw, setShowPw]   = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    const handleSubmit = async () => {
        if (!form.username || !form.email || (isNew && !form.password)) {
            setError('Please fill all required fields.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            if (isNew) {
                const res = await api.post('/admin/users', form);
                onSave(res.data, 'created');
            } else {
                const payload = { ...form };
                if (!payload.password) delete payload.password;
                const res = await api.put(`/admin/users/${user._id}`, payload);
                onSave(res.data, 'updated');
            }
        } catch (err) {
            setError(err.response?.data?.msg || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
            <div className="bg-[#1e293b] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#ff6b00]/15 rounded-xl">
                            {isNew ? <Plus size={20} className="text-[#ff6b00]" /> : <Edit3 size={20} className="text-[#ff6b00]" />}
                        </div>
                        <div>
                            <h2 className="text-white font-black text-lg">{isNew ? 'Provision New User' : 'Edit User'}</h2>
                            <p className="text-slate-500 text-xs mt-0.5">{isNew ? 'Directly added to MongoDB' : `Editing: ${user?.username}`}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition p-2 hover:bg-white/5 rounded-xl"><X size={18} /></button>
                </div>

                <div className="p-6 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl">
                            <AlertTriangle size={14} /> {error}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1.5 block">Name / Username *</label>
                            <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#ff6b00]/50 transition"
                                placeholder="e.g. John Doe" value={form.username}
                                onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1.5 block">Role *</label>
                            <div className="relative">
                                <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#ff6b00]/50 transition appearance-none cursor-pointer"
                                    value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                                    <option value="student" className="bg-[#1e293b]">Student</option>
                                    <option value="teacher" className="bg-[#1e293b]">Teacher</option>
                                    <option value="admin"   className="bg-[#1e293b]">Admin</option>
                                    <option value="none"    className="bg-[#1e293b]">None</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1.5 block">Email / Roll Number *</label>
                        <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#ff6b00]/50 transition"
                            placeholder="admin@kmit.in" value={form.email}
                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div>
                        <label className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1.5 block">
                            {isNew ? 'Password *' : 'New Password (blank = keep current)'}
                        </label>
                        <div className="relative">
                            <input type={showPw ? 'text' : 'password'}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#ff6b00]/50 transition"
                                placeholder="••••••••" value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                            <button onClick={() => setShowPw(p => !p)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 p-6 pt-0">
                    <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-slate-400 font-bold text-sm hover:bg-white/5 transition">Cancel</button>
                    <button onClick={handleSubmit} disabled={loading}
                        className="flex-1 px-4 py-3 rounded-xl bg-[#ff6b00] text-white font-black text-sm hover:bg-[#e55f00] transition shadow-lg shadow-[#ff6b00]/20 disabled:opacity-60 flex items-center justify-center gap-2">
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {isNew ? 'Create User' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function DeleteConfirm({ user, onClose, onDelete }) {
    const [loading, setLoading] = useState(false);
    const handle = async () => {
        setLoading(true);
        try { await api.delete(`/admin/users/${user._id}`); onDelete(user._id); }
        catch (err) { console.error(err); setLoading(false); }
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
            <div className="bg-[#1e293b] border border-red-500/20 rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center space-y-5">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                    <Trash2 size={28} className="text-red-400" />
                </div>
                <div>
                    <h3 className="text-white font-black text-lg">Delete User?</h3>
                    <p className="text-slate-400 text-sm mt-1">This permanently removes <span className="text-white font-bold">{user.username}</span> from MongoDB.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-slate-400 font-bold text-sm hover:bg-white/5 transition">Cancel</button>
                    <button onClick={handle} disabled={loading}
                        className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-black text-sm hover:bg-red-600 transition disabled:opacity-60 flex items-center justify-center gap-2">
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminDashboard() {
    const { user, logout }  = useContext(AuthContext);
    const location          = useLocation();
    const navigate          = useNavigate();
    const isUsersTab        = location.pathname === '/admin/users';

    const [stats, setStats]         = useState({ total: 0, teachers: 0, students: 0, admins: 0 });
    const [users, setUsers]         = useState([]);
    const [loading, setLoading]     = useState(false);
    const [search, setSearch]       = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [modal, setModal]         = useState(null);
    const [toast, setToast]         = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchStats = useCallback(async () => {
        try { const res = await api.get('/admin/stats'); setStats(res.data); }
        catch (err) { console.error(err); }
    }, []);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try { const res = await api.get('/admin/users'); setUsers(res.data); }
        catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);
    useEffect(() => { if (isUsersTab) fetchUsers(); }, [isUsersTab, fetchUsers]);

    const handleSave = (savedUser, action) => {
        if (action === 'created') setUsers(prev => [savedUser, ...prev]);
        else setUsers(prev => prev.map(u => u._id === savedUser._id ? savedUser : u));
        fetchStats();
        setModal(null);
        showToast(`User ${action} successfully!`);
    };

    const handleDelete = (deletedId) => {
        setUsers(prev => prev.filter(u => u._id !== deletedId));
        fetchStats();
        setModal(null);
        showToast('User deleted.', 'error');
    };

    const filtered = users.filter(u => {
        const q = search.toLowerCase();
        return (u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
            && (roleFilter === 'all' || u.role === roleFilter);
    });

    const navLinks = [
        { name: 'Dashboard', path: '/admin-dashboard', icon: LayoutDashboard },
        { name: 'Users',     path: '/admin/users',     icon: Users },
    ];

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-[100] flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm shadow-2xl animate-bounce-once
                    ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'} text-white`}>
                    {toast.type === 'success' ? <Check size={16} /> : <Trash2 size={16} />} {toast.msg}
                </div>
            )}

            {/* Navbar */}
            <header className="bg-[#0f172a]/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20">
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-3">
                                <div className="bg-[#ff6b00] p-2 rounded-xl shadow-[0_0_20px_rgba(255,107,0,0.3)]">
                                    <span className="text-2xl">🔥</span>
                                </div>
                                <h1 className="text-2xl font-black text-white tracking-tight italic">KMIT <span className="text-[#ff6b00]">Kahoot</span></h1>
                            </div>
                            <nav className="hidden md:flex space-x-2">
                                {navLinks.map(link => {
                                    const Icon = link.icon;
                                    const active = location.pathname === link.path;
                                    return (
                                        <Link key={link.path} to={link.path}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300
                                                ${active ? 'bg-[#ff6b00] text-white shadow-lg shadow-[#ff6b00]/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                                            <Icon size={18} /> {link.name}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/10">
                                <div className="w-8 h-8 rounded-full bg-[#ff6b00] flex items-center justify-center text-white font-black ring-2 ring-white/10">
                                    {user?.username?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-xs font-black text-white leading-none">{user?.username}</p>
                                    <p className="text-[10px] text-[#ff6b00] font-bold uppercase mt-1 tracking-widest">Admin</p>
                                </div>
                            </div>
                            <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-emerald-400 text-xs font-bold uppercase tracking-wide">Live</span>
                            </div>
                            <button onClick={() => { logout(); navigate('/login'); }}
                                className="p-3 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-2xl transition-all border border-transparent hover:border-red-400/20">
                                <LogOut size={22} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* ── DASHBOARD TAB ── */}
                {!isUsersTab && (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-black text-white tracking-tight italic uppercase">
                                Admin <span className="text-[#ff6b00]">Control Panel</span>
                            </h1>
                            <p className="text-slate-500 font-medium mt-1">
                                Welcome back, <span className="text-slate-300">{user?.username}</span>. MongoDB connected — system nominal.
                            </p>
                        </div>

                        {/* Stats cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                            {[
                                { label: 'Total Users',     value: stats.total,    Icon: Users,    color: 'text-sky-400',    bg: 'bg-sky-400/10' },
                                { label: 'Security Status', value: 'Verified',     Icon: Shield,   color: 'text-emerald-400',bg: 'bg-emerald-400/10' },
                                { label: 'System Load',     value: '12%',          Icon: Activity, color: 'text-violet-400', bg: 'bg-violet-400/10' },
                                { label: 'Config Items',    value: '42',           Icon: Settings, color: 'text-[#ff6b00]',  bg: 'bg-[#ff6b00]/10' },
                            ].map((s, i) => (
                                <div key={i} className="bg-[#1e293b] border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center hover:border-white/10 transition">
                                    <div className={`${s.bg} ${s.color} p-4 rounded-2xl mb-4`}><s.Icon size={24} /></div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
                                    <p className="text-2xl font-black text-white italic">{s.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Role breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {[
                                { role: 'student', count: stats.students, desc: 'Enrolled on the platform' },
                                { role: 'teacher', count: stats.teachers, desc: 'Creating & managing quizzes' },
                                { role: 'admin',   count: stats.admins,  desc: 'Full system access' },
                            ].map(({ role, count, desc }) => {
                                const meta = ROLE_META[role]; const Icon = meta.icon;
                                return (
                                    <div key={role} className={`bg-[#1e293b] border ${meta.border} rounded-2xl p-6 flex items-center gap-5`}>
                                        <div className={`${meta.bg} ${meta.color} p-4 rounded-2xl`}><Icon size={28} /></div>
                                        <div>
                                            <p className="text-3xl font-black text-white">{count}</p>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{role}s</p>
                                            <p className="text-xs text-slate-600 mt-0.5">{desc}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Quick actions */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="bg-gradient-to-br from-[#ff6b00]/20 to-[#ff6b00]/5 border border-[#ff6b00]/20 rounded-2xl p-8 flex flex-col gap-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-[#ff6b00]/20 rounded-xl"><Plus size={24} className="text-[#ff6b00]" /></div>
                                    <div>
                                        <h3 className="text-white font-black text-lg uppercase italic">Provision New User</h3>
                                        <p className="text-slate-500 text-sm">Add teachers or students to MongoDB</p>
                                    </div>
                                </div>
                                <button onClick={() => setModal({ type: 'create' })}
                                    className="self-start px-6 py-3 bg-[#ff6b00] text-white font-black text-sm rounded-xl hover:bg-[#e55f00] transition shadow-lg shadow-[#ff6b00]/20 active:scale-95 flex items-center gap-2">
                                    <Plus size={16} /> Create User
                                </button>
                            </div>
                            <div className="bg-[#1e293b] border border-white/5 rounded-2xl p-8 flex flex-col gap-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-violet-500/10 rounded-xl"><Shield size={24} className="text-violet-400" /></div>
                                    <div>
                                        <h3 className="text-white font-black text-lg uppercase italic">System Vault</h3>
                                        <p className="text-slate-500 text-sm">Securely manage credentials & audit logs</p>
                                    </div>
                                </div>
                                <Link to="/admin/users"
                                    className="self-start px-6 py-3 bg-white/5 border border-white/10 text-white font-black text-sm rounded-xl hover:bg-white/10 transition flex items-center gap-2">
                                    <Users size={16} /> View All Members
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── USERS TAB ── */}
                {isUsersTab && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-black text-white tracking-tight italic uppercase">
                                    User <span className="text-[#ff6b00]">Management</span>
                                </h1>
                                <p className="text-slate-500 text-sm mt-1">All members in MongoDB — edit roles, passwords, and more</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={fetchUsers} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white transition" title="Refresh">
                                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                                </button>
                                <button onClick={() => setModal({ type: 'create' })}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-[#ff6b00] text-white font-black text-sm rounded-xl hover:bg-[#e55f00] transition shadow-lg shadow-[#ff6b00]/20 active:scale-95">
                                    <Plus size={16} /> Add User
                                </button>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#ff6b00]/40 transition"
                                    placeholder="Search name or email..." value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                            <div className="relative">
                                <select className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm text-white focus:outline-none focus:border-[#ff6b00]/40 transition appearance-none cursor-pointer"
                                    value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                                    <option value="all"     className="bg-[#1e293b]">All Roles</option>
                                    <option value="student" className="bg-[#1e293b]">Students</option>
                                    <option value="teacher" className="bg-[#1e293b]">Teachers</option>
                                    <option value="admin"   className="bg-[#1e293b]">Admins</option>
                                    <option value="none"    className="bg-[#1e293b]">No Role</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-[#1e293b] border border-white/5 rounded-2xl overflow-hidden">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <Loader2 size={32} className="animate-spin text-[#ff6b00]" />
                                    <p className="text-slate-500 text-sm">Fetching from MongoDB...</p>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <Users size={40} className="text-slate-700" />
                                    <p className="text-slate-500 text-sm">No users found.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-white/5">
                                                {['User', 'Email / Roll No.', 'Role', 'Created', 'Actions'].map(h => (
                                                    <th key={h} className={`px-6 py-4 text-slate-500 font-black uppercase tracking-widest text-[10px] ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map((u, i) => (
                                                <tr key={u._id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-full bg-[#ff6b00]/15 flex items-center justify-center text-[#ff6b00] font-black text-sm flex-shrink-0">
                                                                {u.username?.[0]?.toUpperCase()}
                                                            </div>
                                                            <span className="text-white font-bold">{u.username}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-400">{u.email}</td>
                                                    <td className="px-6 py-4"><RoleBadge role={u.role} /></td>
                                                    <td className="px-6 py-4 text-slate-500 text-xs">
                                                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 justify-end">
                                                            <button onClick={() => setModal({ type: 'edit', user: u })}
                                                                className="p-2 text-slate-500 hover:text-[#ff6b00] hover:bg-[#ff6b00]/10 rounded-lg transition" title="Edit">
                                                                <Edit3 size={15} />
                                                            </button>
                                                            <button onClick={() => setModal({ type: 'delete', user: u })}
                                                                disabled={u._id === user?._id}
                                                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed" title="Delete">
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <p className="text-slate-600 text-xs text-right">Showing {filtered.length} of {users.length} users</p>
                    </div>
                )}
            </main>

            <footer className="py-6 text-center text-slate-600 text-xs font-medium border-t border-white/5">
                © {new Date().getFullYear()} KMIT Educational Arena. Admin Console.
            </footer>

            {modal?.type === 'create' && <UserModal isNew user={null} onClose={() => setModal(null)} onSave={handleSave} />}
            {modal?.type === 'edit'   && <UserModal isNew={false} user={modal.user} onClose={() => setModal(null)} onSave={handleSave} />}
            {modal?.type === 'delete' && <DeleteConfirm user={modal.user} onClose={() => setModal(null)} onDelete={handleDelete} />}
        </div>
    );
}
