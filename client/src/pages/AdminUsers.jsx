import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    Users, Search, Edit3, Trash2, Ban, RefreshCw,
    Plus, X, Shield, GraduationCap, UserCheck
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import AuthContext from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import UserModal from '../components/admin/UserModal';
import { showConfirm, showSuccess } from '../utils/alerts';

function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-slate-200/80 rounded-xl ${className}`} />;
}

function StatusBadge({ suspended, online }) {
    if (suspended)
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Suspended</span>;
    if (online)
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Online</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Offline</span>;
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

const ROLE_TABS = ['all', 'student', 'teacher', 'admin', 'none'];

export default function AdminUsers() {
    const { user: currentUser } = useContext(AuthContext);
    const [users,      setUsers]      = useState([]);
    const [loading,    setLoading]    = useState(false);
    const [modal,      setModal]      = useState(null);

    const [search,     setSearch]     = useState('');
    const [debSearch,  setDebSearch]  = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [page,       setPage]       = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 20;

    useEffect(() => {
        const t = setTimeout(() => { setDebSearch(search); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/users', {
                params: { page, limit, search: debSearch, role: roleFilter === 'all' ? '' : roleFilter }
            });
            setUsers(res.data.users || []);
            setTotalPages(res.data.totalPages || 1);
            setTotalCount(res.data.totalCount || 0);
        } catch {
            toast.error('Failed to load users');
        } finally { setLoading(false); }
    }, [page, debSearch, roleFilter]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleDelete = async (u) => {
        if (u.id === currentUser?.id) { toast.error('You cannot delete your own account.'); return; }
        const r = await showConfirm('Delete User?', `Permanently delete ${u.name || u.username}?`, 'Delete');
        if (r.isConfirmed) {
            try {
                await api.delete(`/admin/users/${u.id}`);
                setUsers(prev => prev.filter(x => x.id !== u.id));
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
                showSuccess('Updated', `User ${u.isSuspended ? 'reinstated' : 'suspended'}.`);
            } catch { toast.error('Action failed'); }
        }
    };

    const handleSave = (saved, action) => {
        if (action === 'created') setUsers(prev => [saved, ...prev]);
        else setUsers(prev => prev.map(x => x.id === saved.id ? saved : x));
        fetchUsers();
        setModal(null);
    };

    const hasFilters = debSearch || roleFilter !== 'all';
    const clearFilters = () => { setSearch(''); setRoleFilter('all'); setPage(1); };

    return (
        <DashboardLayout role="admin">
            <div className="space-y-6 pb-20 max-w-[100rem] mx-auto">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-200/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700"><Users size={24} /></div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">All Users</h1>
                            <p className="text-slate-500 text-xs font-medium mt-0.5">{totalCount} Total Accounts in Database</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={fetchUsers}
                            className="p-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-sm">
                            <RefreshCw size={15} />
                        </button>
                        <button onClick={() => setModal({ isNew: true })}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-sm cursor-pointer active:scale-95">
                            <Plus size={15} /> Add User
                        </button>
                    </div>
                </motion.div>

                {/* Search & Filters */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                    className="rounded-[18px] bg-white border border-slate-200/80 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex flex-wrap gap-3 items-center">
                    <div className="flex-1 min-w-56 relative">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search username, email, name, branch..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-all" />
                    </div>
                    {/* Role tab pills */}
                    <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 gap-1 flex-wrap">
                        {ROLE_TABS.map(r => (
                            <button key={r} onClick={() => { setRoleFilter(r); setPage(1); }}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${roleFilter === r ? 'bg-white text-slate-900 shadow-sm border border-slate-300' : 'text-slate-500 hover:text-slate-900'}`}>
                                {r}
                            </button>
                        ))}
                    </div>
                    {hasFilters && (
                        <button onClick={clearFilters}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs cursor-pointer hover:bg-rose-100 transition-all">
                            <X size={13} /> Clear
                        </button>
                    )}
                </motion.div>

                {/* Users Table */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="rounded-[18px] bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/80">
                                    {['Username', 'Name', 'Email', 'Role', 'Branch / Dept', 'Status', 'Actions'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/80">
                                {loading
                                    ? Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-10" /></td></tr>)
                                    : users.length === 0
                                        ? <tr><td colSpan={7} className="py-16 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">No users found</td></tr>
                                        : users.map(u => (
                                            <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-4 py-3.5 text-xs font-bold text-amber-700 whitespace-nowrap">@{u.username}</td>
                                                <td className="px-4 py-3.5 text-sm font-bold text-slate-900 whitespace-nowrap">{u.name || '—'}</td>
                                                <td className="px-4 py-3.5 text-xs text-slate-600 font-medium max-w-[180px] truncate">{u.email}</td>
                                                <td className="px-4 py-3.5 whitespace-nowrap"><RoleBadge role={u.role} /></td>
                                                <td className="px-4 py-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                                                    {u.role === 'student'
                                                        ? (u.studentBranch ? `${u.studentBranch}${u.section ? ` — ${u.section}` : ''}` : '—')
                                                        : u.role === 'teacher' ? (u.department || '—') : '—'}
                                                </td>
                                                <td className="px-4 py-3.5 whitespace-nowrap"><StatusBadge suspended={u.isSuspended} online={u.isOnline} /></td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => setModal({ isNew: false, user: u })} title="Edit"
                                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-all cursor-pointer"><Edit3 size={13} /></button>
                                                        <button onClick={() => handleSuspend(u)} title={u.isSuspended ? 'Reinstate' : 'Suspend'} disabled={u.id === currentUser?.id}
                                                            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer disabled:opacity-30 ${u.isSuspended ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}><Ban size={13} /></button>
                                                        <button onClick={() => handleDelete(u)} title="Delete" disabled={u.id === currentUser?.id}
                                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all cursor-pointer disabled:opacity-30"><Trash2 size={13} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                }
                            </tbody>
                        </table>
                    </div>

                    {!loading && totalPages > 1 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex-wrap gap-3">
                            <p className="text-xs text-slate-500 font-medium">
                                Page <span className="text-slate-900 font-bold">{page}</span> of <span className="text-slate-900 font-bold">{totalPages}</span> — {totalCount} total
                            </p>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs disabled:opacity-40 cursor-pointer hover:bg-slate-100 transition-all">← Prev</button>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs disabled:opacity-40 cursor-pointer hover:bg-slate-100 transition-all">Next →</button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>

            {modal && (
                <UserModal isNew={modal.isNew} user={modal.user} defaultRole="student" onClose={() => setModal(null)} onSave={handleSave} />
            )}
        </DashboardLayout>
    );
}
