import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    Users, Search, Edit3, Trash2, Ban, RefreshCw,
    Plus, X, ArrowUpDown
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import AuthContext from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
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
    const { invalidate } = useAdmin();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState(null);

    const [selectedIds, setSelectedIds] = useState([]);

    const [search, setSearch] = useState('');
    const [debSearch, setDebSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('');

    const [sortCol, setSortCol] = useState('createdAt');
    const [sortDir, setSortDir] = useState('desc');

    const [page, setPage] = useState(1);
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
                params: {
                    page, limit,
                    search: debSearch,
                    role: roleFilter === 'all' ? '' : roleFilter,
                    status: statusFilter,
                    sort: sortCol,
                    sortDir
                }
            });
            setUsers(res.data.users || []);
            setTotalPages(res.data.totalPages || 1);
            setTotalCount(res.data.totalCount || 0);
        } catch {
            toast.error('Failed to load system users');
        } finally { setLoading(false); }
    }, [page, debSearch, roleFilter, statusFilter, sortCol, sortDir]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleDelete = async (u) => {
        if (u.id === currentUser?.id) { toast.error('You cannot delete your own account.'); return; }
        const r = await showConfirm('Delete User?', `Permanently delete ${u.name || u.username}?`, 'Delete');
        if (r.isConfirmed) {
            try {
                await api.delete(`/admin/users/${u.id}`);
                setUsers(prev => prev.filter(x => x.id !== u.id));
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

    // Bulk Actions
    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedIds(users.map(u => u.id));
        else setSelectedIds([]);
    };

    const handleSelectOne = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        const r = await showConfirm('Bulk Delete Users?', `Permanently delete ${selectedIds.length} selected user(s)?`, 'Delete All');
        if (r.isConfirmed) {
            try {
                await api.post('/admin/users/bulk-delete', { ids: selectedIds });
                setSelectedIds([]);
                fetchUsers();
                invalidate();
                showSuccess('Bulk Delete', 'Selected users deleted.');
            } catch { toast.error('Bulk delete failed'); }
        }
    };

    const handleBulkSuspend = async (suspend) => {
        if (selectedIds.length === 0) return;
        const action = suspend ? 'Suspend' : 'Reinstate';
        const r = await showConfirm(`Bulk ${action}?`, `${action} ${selectedIds.length} selected user(s)?`, action);
        if (r.isConfirmed) {
            try {
                await api.post('/admin/users/bulk-suspend', { ids: selectedIds, suspend });
                setSelectedIds([]);
                fetchUsers();
                invalidate();
                showSuccess(`Bulk ${action}`, `Selected users ${suspend ? 'suspended' : 'reinstated'}.`);
            } catch { toast.error('Bulk action failed'); }
        }
    };

    const handleSave = () => {
        fetchUsers();
        invalidate();
        setModal(null);
    };

    const toggleSort = (col) => {
        if (sortCol === col) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('asc'); }
    };

    const hasFilters = debSearch || roleFilter !== 'all' || statusFilter;
    const clearFilters = () => { setSearch(''); setRoleFilter('all'); setStatusFilter(''); setPage(1); };

    return (
        <DashboardLayout role="admin">
            <div className="space-y-6 pb-20 max-w-[100rem] mx-auto">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-200/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700"><Users size={24} /></div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">All System Accounts</h1>
                            <p className="text-slate-500 text-xs font-medium mt-0.5">{totalCount} Total Accounts in Database</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={fetchUsers} className="p-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-xs">
                            <RefreshCw size={15} />
                        </button>
                        <button onClick={() => setModal({ isNew: true })} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95">
                            <Plus size={15} /> Add User
                        </button>
                    </div>
                </motion.div>

                {/* Filters */}
                <div className="rounded-[18px] bg-white border border-slate-200/80 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex flex-wrap gap-3 items-center">
                    <div className="flex-1 min-w-56 relative">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search username, email, name..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-all" />
                    </div>

                    <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 gap-1 flex-wrap">
                        {ROLE_TABS.map(r => (
                            <button key={r} onClick={() => { setRoleFilter(r); setPage(1); }}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${roleFilter === r ? 'bg-white text-slate-900 shadow-xs border border-slate-300' : 'text-slate-500 hover:text-slate-900'}`}>
                                {r}
                            </button>
                        ))}
                    </div>

                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </select>

                    {hasFilters && (
                        <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs cursor-pointer hover:bg-rose-100">
                            <X size={13} /> Clear
                        </button>
                    )}
                </div>

                {/* Bulk Actions Bar */}
                {selectedIds.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between flex-wrap gap-3">
                        <span className="text-xs font-bold pl-2">{selectedIds.length} user(s) selected</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleBulkSuspend(true)} className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold cursor-pointer hover:bg-amber-500/30">
                                Suspend Selected
                            </button>
                            <button onClick={() => handleBulkSuspend(false)} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold cursor-pointer hover:bg-emerald-500/30">
                                Reinstate Selected
                            </button>
                            <button onClick={handleBulkDelete} className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer hover:bg-rose-500/30">
                                Delete Selected
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Users Table */}
                <div className="rounded-[18px] bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/80">
                                    <th className="p-3.5 w-10 text-center">
                                        <input type="checkbox" checked={users.length > 0 && selectedIds.length === users.length} onChange={handleSelectAll} className="rounded text-slate-900 cursor-pointer" />
                                    </th>
                                    <th onClick={() => toggleSort('username')} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider cursor-pointer">
                                        <div className="flex items-center gap-1">Username <ArrowUpDown size={12} /></div>
                                    </th>
                                    <th onClick={() => toggleSort('name')} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider cursor-pointer">
                                        <div className="flex items-center gap-1">Name <ArrowUpDown size={12} /></div>
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Email</th>
                                    <th onClick={() => toggleSort('role')} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider cursor-pointer">
                                        <div className="flex items-center gap-1">Role <ArrowUpDown size={12} /></div>
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Branch / Dept</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/80">
                                {loading ? (
                                    Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-10" /></td></tr>)
                                ) : users.length === 0 ? (
                                    <tr><td colSpan={8} className="py-16 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">No users found</td></tr>
                                ) : (
                                    users.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="p-3.5 text-center">
                                                <input type="checkbox" checked={selectedIds.includes(u.id)} onChange={() => handleSelectOne(u.id)} className="rounded text-slate-900 cursor-pointer" />
                                            </td>
                                            <td className="px-4 py-3.5 text-xs font-bold text-amber-700 whitespace-nowrap">@{u.username}</td>
                                            <td className="px-4 py-3.5 text-sm font-bold text-slate-900 whitespace-nowrap">{u.name || '—'}</td>
                                            <td className="px-4 py-3.5 text-xs text-slate-600 font-medium max-w-[180px] truncate">{u.email}</td>
                                            <td className="px-4 py-3.5 whitespace-nowrap"><RoleBadge role={u.role} /></td>
                                            <td className="px-4 py-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                                                {u.role === 'student'
                                                    ? (u.studentBranch ? `${u.studentBranch}${u.section ? ` — ${u.section}` : ''}` : '—')
                                                    : u.role === 'teacher' ? (u.studentBranch || '—') : '—'}
                                            </td>
                                            <td className="px-4 py-3.5 whitespace-nowrap"><StatusBadge suspended={u.isSuspended} online={u.isOnline} /></td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-1.5">
                                                    <button onClick={() => setModal({ isNew: false, user: u })} title="Edit" className="w-7 h-7 flex items-center justify-center rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 cursor-pointer"><Edit3 size={13} /></button>
                                                    <button onClick={() => handleSuspend(u)} title={u.isSuspended ? 'Reinstate' : 'Suspend'} disabled={u.id === currentUser?.id} className={`w-7 h-7 flex items-center justify-center rounded-lg border cursor-pointer disabled:opacity-30 ${u.isSuspended ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}><Ban size={13} /></button>
                                                    <button onClick={() => handleDelete(u)} title="Delete" disabled={u.id === currentUser?.id} className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer disabled:opacity-30"><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {!loading && totalPages > 1 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex-wrap gap-3">
                            <p className="text-xs text-slate-500 font-medium">Page {page} of {totalPages} — {totalCount} total</p>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs disabled:opacity-40 cursor-pointer hover:bg-slate-100">← Prev</button>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs disabled:opacity-40 cursor-pointer hover:bg-slate-100">Next →</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {modal && <UserModal isNew={modal.isNew !== undefined ? modal.isNew : !modal.user} user={modal.user} defaultRole={modal.defaultRole || modal.user?.role || 'student'} onClose={() => setModal(null)} onSave={handleSave} />}
        </DashboardLayout>
    );
}
