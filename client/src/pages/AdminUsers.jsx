import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    Users, Search, Filter, Edit3, Trash2, Ban, RefreshCw,
    Plus, X, KeyRound, Shield, GraduationCap, UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import AuthContext from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import UserModal from '../components/admin/UserModal';
import { showConfirm, showSuccess } from '../utils/alerts';

function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-white/10 rounded-xl ${className}`} />;
}

function StatusBadge({ suspended, online }) {
    if (suspended)
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />Suspended</span>;
    if (online)
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Online</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-white/5 text-white/40 border border-white/10"><span className="w-1.5 h-1.5 rounded-full bg-white/30" />Offline</span>;
}

function RoleBadge({ role }) {
    const cfgs = {
        student: { label: 'Student', bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
        teacher: { label: 'Teacher', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
        admin:   { label: 'Admin',   bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
        none:    { label: 'None',    bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' },
    };
    const c = cfgs[role] || cfgs.none;
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${c.bg} ${c.text} border ${c.border}`}>
            {c.label}
        </span>
    );
}

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
        const r = await showConfirm('Delete User?', `Permanently delete user ${u.name || u.username}?`, 'Delete');
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
                    className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20"><Users size={24} className="text-amber-400" /></div>
                        <div>
                            <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">All <span className="text-amber-400">Users</span></h1>
                            <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mt-0.5">{totalCount} Total Accounts in Database</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={fetchUsers} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"><RefreshCw size={15} /></button>
                        <button onClick={() => setModal({ isNew: true })}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95">
                            <Plus size={15} /> Add User
                        </button>
                    </div>
                </motion.div>

                {/* Search & Filters */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                    className="rounded-3xl bg-white/[0.04] border border-white/[0.08] p-5 flex flex-wrap gap-3 items-center">
                    <div className="flex-1 min-w-56 relative">
                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search username, email, name, branch, section, department..."
                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50 transition-all" />
                    </div>
                    <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 gap-1">
                        {['all', 'student', 'teacher', 'admin', 'none'].map(r => (
                            <button key={r} onClick={() => { setRoleFilter(r); setPage(1); }}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${roleFilter === r ? 'bg-amber-500 text-black' : 'text-white/40 hover:text-white'}`}>
                                {r}
                            </button>
                        ))}
                    </div>
                    {hasFilters && (
                        <button onClick={clearFilters}
                            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-black text-xs uppercase tracking-wider cursor-pointer hover:bg-rose-500/20 transition-all">
                            <X size={13} /> Clear
                        </button>
                    )}
                </motion.div>

                {/* Users Table */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="rounded-3xl bg-white/[0.04] border border-white/[0.08] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/[0.06]">
                                    {['User / Roll', 'Name', 'Email', 'Role', 'Branch / Dept', 'Status', 'Actions'].map(h => (
                                        <th key={h} className="px-4 py-4 text-left text-[9px] font-black text-white/30 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {loading
                                    ? Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-10" /></td></tr>)
                                    : users.length === 0
                                        ? <tr><td colSpan={7} className="py-20 text-center text-white/20 text-xs font-bold uppercase tracking-widest">No users found</td></tr>
                                        : users.map(u => (
                                            <tr key={u.id} className="hover:bg-white/[0.03] transition-colors group">
                                                <td className="px-4 py-4 text-xs font-black text-amber-400 whitespace-nowrap">@{u.username}</td>
                                                <td className="px-4 py-4 text-sm font-bold text-white whitespace-nowrap">{u.name || '—'}</td>
                                                <td className="px-4 py-4 text-xs text-white/50 max-w-[180px] truncate">{u.email}</td>
                                                <td className="px-4 py-4 whitespace-nowrap"><RoleBadge role={u.role} /></td>
                                                <td className="px-4 py-4 text-xs font-bold text-white/60 whitespace-nowrap">
                                                    {u.role === 'student' ? (u.studentBranch ? `${u.studentBranch}${u.section ? ` - ${u.section}` : ''}` : '—') : u.role === 'teacher' ? (u.department || '—') : '—'}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap"><StatusBadge suspended={u.isSuspended} online={u.isOnline} /></td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => setModal({ isNew: false, user: u })} title="Edit"
                                                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-all cursor-pointer"><Edit3 size={13} /></button>
                                                        <button onClick={() => handleSuspend(u)} title={u.isSuspended ? 'Reinstate' : 'Suspend'} disabled={u.id === currentUser?.id}
                                                            className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all cursor-pointer disabled:opacity-30 ${u.isSuspended ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`}><Ban size={13} /></button>
                                                        <button onClick={() => handleDelete(u)} title="Delete" disabled={u.id === currentUser?.id}
                                                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer disabled:opacity-30"><Trash2 size={13} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                }
                            </tbody>
                        </table>
                    </div>

                    {!loading && totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] flex-wrap gap-3">
                            <p className="text-[10px] text-white/30 font-black uppercase tracking-wider">
                                Page <span className="text-amber-400">{page}</span> of <span className="text-amber-400">{totalPages}</span> — {totalCount} total
                            </p>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 font-black text-xs hover:bg-white/10 disabled:opacity-30 transition-all cursor-pointer">← Prev</button>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 font-black text-xs hover:bg-white/10 disabled:opacity-30 transition-all cursor-pointer">Next →</button>
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
