import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    UserCheck, Search, Edit3, Trash2, Ban, RefreshCw,
    Plus, X, Briefcase, BookOpen, Mail, ArrowUpDown
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
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Suspended</span>;
    if (online)
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Online</span>;
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Offline</span>;
}

function Avatar({ name }) {
    const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??';
    const colors = ['bg-emerald-600 text-white', 'bg-sky-600 text-white', 'bg-purple-600 text-white', 'bg-amber-600 text-white'];
    const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
    return (
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-xs font-black shrink-0 shadow-xs`}>
            {initials}
        </div>
    );
}

export default function AdminTeachers() {
    const { user: currentUser } = useContext(AuthContext);
    const { invalidate } = useAdmin();

    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterOptions, setFilterOptions] = useState({ departments: [] });
    const [modal, setModal] = useState(null);
    const [view, setView] = useState('grid');

    const [search, setSearch] = useState('');
    const [debSearch, setDebSearch] = useState('');
    const [deptFilter, setDeptFilter] = useState('');
    const [statusF, setStatusF] = useState('');

    const [sortCol, setSortCol] = useState('username');
    const [sortDir, setSortDir] = useState('asc');

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
                params: {
                    page, limit,
                    search: debSearch,
                    department: deptFilter,
                    status: statusF,
                    sort: sortCol,
                    sortDir
                }
            });
            setTeachers(res.data.teachers || []);
            setTotalPages(res.data.totalPages || 1);
            setTotalCount(res.data.totalCount || 0);
            if (res.data.filterOptions) setFilterOptions(res.data.filterOptions);
        } catch {
            toast.error('Failed to load faculty records');
        } finally {
            setLoading(false);
        }
    }, [page, debSearch, deptFilter, statusF, sortCol, sortDir]);

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

    const handleSave = () => {
        fetchTeachers();
        invalidate();
        setModal(null);
    };

    const toggleSort = (col) => {
        if (sortCol === col) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('asc'); }
    };

    const hasFilters = debSearch || deptFilter || statusF;
    const clearFilters = () => { setSearch(''); setDeptFilter(''); setStatusF(''); setPage(1); };

    return (
        <DashboardLayout role="admin">
            <div className="space-y-6 pb-20 max-w-[100rem] mx-auto">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-200/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700"><UserCheck size={24} /></div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Faculty & Teacher Directory</h1>
                            <p className="text-slate-500 text-xs font-medium mt-0.5">{totalCount} Faculty Members Registered</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
                            {['grid', 'table'].map(v => (
                                <button key={v} onClick={() => setView(v)}
                                    className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${view === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                                    {v}
                                </button>
                            ))}
                        </div>
                        <button onClick={fetchTeachers} className="p-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-xs"><RefreshCw size={15} /></button>
                        <button onClick={() => setModal({ isNew: true })}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95">
                            <Plus size={15} /> Add Teacher
                        </button>
                    </div>
                </motion.div>

                {/* Search & Filters */}
                <div className="rounded-[18px] bg-white border border-slate-200/80 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex flex-wrap gap-3 items-center">
                    <div className="flex-1 min-w-56 relative">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search teacher name, email, username..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-all" />
                    </div>

                    <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }}
                        className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer">
                        <option value="">All Departments</option>
                        {filterOptions.departments?.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>

                    <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }}
                        className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </select>

                    {hasFilters && (
                        <button onClick={clearFilters}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs cursor-pointer hover:bg-rose-100 transition-all">
                            <X size={13} /> Clear
                        </button>
                    )}
                </div>

                {/* Grid view */}
                {view === 'grid' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {loading ? (
                            Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-56" />)
                        ) : teachers.length === 0 ? (
                            <div className="col-span-full py-16 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">No faculty records found</div>
                        ) : (
                            teachers.map(t => (
                                <div key={t.id} className="rounded-[18px] bg-white border border-slate-200/80 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:border-slate-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all flex flex-col gap-4">
                                    <div className="flex items-start justify-between">
                                        <Avatar name={t.name || t.username} />
                                        <StatusBadge suspended={t.isSuspended} online={t.isOnline} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{t.name || t.username}</p>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">Dept: {t.department || 'General Faculty'}</p>
                                    </div>
                                    <div className="space-y-1.5 text-xs text-slate-600 font-medium">
                                        {t.email && <div className="flex items-center gap-2 truncate"><Mail size={13} className="text-slate-400" />{t.email}</div>}
                                    </div>
                                    <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-200/80">
                                        <button onClick={() => setModal({ isNew: false, user: t })}
                                            className="flex-1 py-1.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1">
                                            <Edit3 size={12} /> Edit
                                        </button>
                                        <button onClick={() => handleSuspend(t)}
                                            className={`flex-1 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1 ${t.isSuspended ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                            <Ban size={12} /> {t.isSuspended ? 'Reinstate' : 'Suspend'}
                                        </button>
                                        <button onClick={() => handleDelete(t)} disabled={t.id === currentUser?.id}
                                            className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer transition-all flex items-center justify-center disabled:opacity-30">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Table view */}
                {view === 'table' && (
                    <div className="rounded-[18px] bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50/80">
                                        <th onClick={() => toggleSort('name')} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider cursor-pointer">
                                            <div className="flex items-center gap-1">Faculty Name <ArrowUpDown size={12} /></div>
                                        </th>
                                        <th className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Email</th>
                                        <th onClick={() => toggleSort('studentBranch')} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider cursor-pointer">
                                            <div className="flex items-center gap-1">Department <ArrowUpDown size={12} /></div>
                                        </th>
                                        <th className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/80">
                                    {loading ? (
                                        Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-10" /></td></tr>)
                                    ) : teachers.length === 0 ? (
                                        <tr><td colSpan={5} className="py-16 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">No faculty records found</td></tr>
                                    ) : (
                                        teachers.map(t => (
                                            <tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar name={t.name || t.username} />
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-900">{t.name || t.username}</p>
                                                            <p className="text-[11px] text-slate-500">@{t.username}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-xs text-slate-600 font-medium">{t.email}</td>
                                                <td className="px-4 py-3.5 text-xs font-bold text-slate-700">{t.department || '—'}</td>
                                                <td className="px-4 py-3.5"><StatusBadge suspended={t.isSuspended} online={t.isOnline} /></td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <button onClick={() => setModal({ isNew: false, user: t })} className="w-7 h-7 flex items-center justify-center rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-all cursor-pointer"><Edit3 size={13} /></button>
                                                        <button onClick={() => handleSuspend(t)} className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${t.isSuspended ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><Ban size={13} /></button>
                                                        <button onClick={() => handleDelete(t)} disabled={t.id === currentUser?.id} className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all cursor-pointer disabled:opacity-30"><Trash2 size={13} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>

            {modal && <UserModal isNew={modal.isNew} user={modal.user} defaultRole="teacher" onClose={() => setModal(null)} onSave={handleSave} />}
        </DashboardLayout>
    );
}
