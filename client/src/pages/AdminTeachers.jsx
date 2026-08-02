import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    UserCheck, Search, Filter, Edit3, Trash2, Ban, RefreshCw,
    Plus, X, KeyRound, Briefcase, BookOpen, Phone, Mail
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
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />Suspended</span>;
    if (online)
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Online</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-white/5 text-white/40 border border-white/10"><span className="w-1.5 h-1.5 rounded-full bg-white/30" />Offline</span>;
}

// Avatar initials
function Avatar({ name, department }) {
    const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??';
    const colors = ['from-emerald-500 to-teal-600', 'from-sky-500 to-blue-600', 'from-violet-500 to-purple-600', 'from-amber-500 to-orange-500'];
    const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
    return (
        <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-xs font-black text-white shrink-0`}>
            {initials}
        </div>
    );
}

export default function AdminTeachers() {
    const { user: currentUser } = useContext(AuthContext);
    const [teachers,       setTeachers]       = useState([]);
    const [loading,        setLoading]        = useState(false);
    const [filterOptions,  setFilterOptions]  = useState({ departments: [] });
    const [modal,          setModal]          = useState(null);
    const [view,           setView]           = useState('grid'); // 'grid' | 'table'

    const [search,     setSearch]     = useState('');
    const [debSearch,  setDebSearch]  = useState('');
    const [deptFilter, setDeptFilter] = useState('');
    const [statusF,    setStatusF]    = useState('');
    const [page,       setPage]       = useState(1);
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
            try {
                const res2 = await api.get('/admin/users', { params: { page, limit, role: 'teacher', search: debSearch } });
                setTeachers(res2.data.users || []);
                setTotalPages(res2.data.totalPages || 1);
                setTotalCount(res2.data.totalCount || 0);
            } catch { toast.error('Failed to load teachers'); }
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
                showSuccess('Updated', `Teacher ${t.isSuspended ? 'reinstated' : 'suspended'}.`);
            } catch { toast.error('Action failed'); }
        }
    };

    const handleSave = (saved, action) => {
        if (action === 'created') setTeachers(prev => [saved, ...prev]);
        else setTeachers(prev => prev.map(x => x.id === saved.id ? saved : x));
        fetchTeachers();
        setModal(null);
    };

    const hasFilters = debSearch || deptFilter || statusF;
    const clearFilters = () => { setSearch(''); setDeptFilter(''); setStatusF(''); setPage(1); };

    return (
        <DashboardLayout role="admin">
            <div className="space-y-6 pb-20 max-w-[100rem] mx-auto">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"><UserCheck size={24} className="text-emerald-400" /></div>
                        <div>
                            <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Teacher <span className="text-emerald-400">Directory</span></h1>
                            <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mt-0.5">{totalCount} Faculty Members Registered</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                            {['grid', 'table'].map(v => (
                                <button key={v} onClick={() => setView(v)}
                                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${view === v ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/40 hover:text-white'}`}>
                                    {v}
                                </button>
                            ))}
                        </div>
                        <button onClick={fetchTeachers} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"><RefreshCw size={15} /></button>
                        <button onClick={() => setModal({ isNew: true })}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95">
                            <Plus size={15} /> Add Teacher
                        </button>
                    </div>
                </motion.div>

                {/* Search + Filters */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                    className="rounded-3xl bg-white/[0.04] border border-white/[0.08] p-5 flex flex-wrap gap-3 items-center">
                    <div className="flex-1 min-w-56 relative">
                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search name, email, employee ID, department..."
                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-all" />
                    </div>
                    <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }}
                        className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-black text-white/70 focus:outline-none cursor-pointer appearance-none">
                        <option value="">All Departments</option>
                        {filterOptions.departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }}
                        className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-black text-white/70 focus:outline-none cursor-pointer appearance-none">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </select>
                    {hasFilters && (
                        <button onClick={clearFilters}
                            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-black text-xs uppercase tracking-wider cursor-pointer hover:bg-rose-500/20 transition-all">
                            <X size={13} /> Clear
                        </button>
                    )}
                </motion.div>

                {/* Grid view */}
                {view === 'grid' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {loading
                            ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-56" />)
                            : teachers.length === 0
                                ? <div className="col-span-full py-20 text-center text-white/20 text-xs font-bold uppercase tracking-widest">No teachers found</div>
                                : teachers.map(t => (
                                    <motion.div key={t.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                        className="rounded-3xl bg-white/[0.04] border border-white/[0.08] p-5 hover:border-emerald-500/20 hover:bg-white/[0.07] transition-all group flex flex-col gap-4">
                                        <div className="flex items-start justify-between">
                                            <Avatar name={t.name || t.username} />
                                            <StatusBadge suspended={t.isSuspended} online={t.isOnline} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-white">{t.name || t.username}</p>
                                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">{t.department || 'No Department'}</p>
                                        </div>
                                        <div className="space-y-1.5 text-[11px]">
                                            {t.employeeId && <div className="flex items-center gap-2 text-white/50"><Briefcase size={11} />{t.employeeId}</div>}
                                            {t.email && <div className="flex items-center gap-2 text-white/50 truncate"><Mail size={11} />{t.email}</div>}
                                            {t.subjects && <div className="flex items-center gap-2 text-emerald-400/70"><BookOpen size={11} />{t.subjects}</div>}
                                        </div>
                                        <div className="flex items-center gap-2 mt-auto pt-3 border-t border-white/[0.06] opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setModal({ isNew: false, user: t })}
                                                className="flex-1 py-2 rounded-xl bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1">
                                                <Edit3 size={11} /> Edit
                                            </button>
                                            <button onClick={() => handleSuspend(t)}
                                                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1 ${t.isSuspended ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`}>
                                                <Ban size={11} /> {t.isSuspended ? 'Reinstate' : 'Suspend'}
                                            </button>
                                            <button onClick={() => handleDelete(t)} disabled={t.id === currentUser?.id}
                                                className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 cursor-pointer transition-all flex items-center justify-center disabled:opacity-30">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))
                        }
                    </motion.div>
                )}

                {/* Table view */}
                {view === 'table' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl bg-white/[0.04] border border-white/[0.08] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/[0.06]">
                                        {['Teacher', 'Email', 'Employee ID', 'Department', 'Subjects', 'Status', 'Actions'].map(h => (
                                            <th key={h} className="px-4 py-4 text-left text-[9px] font-black text-white/30 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {loading
                                        ? Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-10" /></td></tr>)
                                        : teachers.length === 0
                                            ? <tr><td colSpan={7} className="py-20 text-center text-white/20 text-xs font-bold uppercase tracking-widest">No teachers found</td></tr>
                                            : teachers.map(t => (
                                                <motion.tr key={t.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-white/[0.03] transition-colors group">
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar name={t.name || t.username} />
                                                            <div>
                                                                <p className="text-sm font-black text-white">{t.name || t.username}</p>
                                                                <p className="text-[10px] text-white/30">{t.username}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-xs text-white/50 max-w-[160px] truncate">{t.email}</td>
                                                    <td className="px-4 py-4 text-xs font-bold text-[var(--text-accent)]">{t.employeeId || '—'}</td>
                                                    <td className="px-4 py-4 text-xs font-bold text-white/60">{t.department || '—'}</td>
                                                    <td className="px-4 py-4 text-xs text-emerald-400/70 max-w-[160px] truncate">{t.subjects || '—'}</td>
                                                    <td className="px-4 py-4"><StatusBadge suspended={t.isSuspended} online={t.isOnline} /></td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => setModal({ isNew: false, user: t })} className="w-8 h-8 flex items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-all cursor-pointer"><Edit3 size={13} /></button>
                                                            <button onClick={() => handleSuspend(t)} className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all cursor-pointer ${t.isSuspended ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`}><Ban size={13} /></button>
                                                            <button onClick={() => handleDelete(t)} disabled={t.id === currentUser?.id} className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer disabled:opacity-30"><Trash2 size={13} /></button>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))
                                    }
                                </tbody>
                            </table>
                        </div>
                        {!loading && totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06]">
                                <p className="text-[10px] text-white/30 font-black uppercase tracking-wider">Page {page}/{totalPages} — {totalCount} total</p>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 font-black text-xs disabled:opacity-30 cursor-pointer hover:bg-white/10">← Prev</button>
                                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 font-black text-xs disabled:opacity-30 cursor-pointer hover:bg-white/10">Next →</button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>

            {modal && (
                <UserModal isNew={modal.isNew} user={modal.user} defaultRole="teacher" onClose={() => setModal(null)} onSave={handleSave} />
            )}
        </DashboardLayout>
    );
}
