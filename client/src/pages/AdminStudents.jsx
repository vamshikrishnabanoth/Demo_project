import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    GraduationCap, Search, ChevronRight, ChevronDown,
    Edit3, Trash2, Ban, RefreshCw, Plus, X,
    KeyRound, Users, Upload, Award, ArrowUpDown, CheckSquare, Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import AuthContext from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import DashboardLayout from '../components/DashboardLayout';
import UserModal from '../components/admin/UserModal';
import BulkImportModal from '../components/admin/BulkImportModal';
import PromoteModal from '../components/admin/PromoteModal';
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

export default function AdminStudents() {
    const { user: currentUser } = useContext(AuthContext);
    const { invalidate } = useAdmin();

    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterOptions, setFilterOptions] = useState({ years: [], semesters: [], sections: [], branches: [] });
    
    // Modals
    const [userModal, setUserModal] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showPromoteModal, setShowPromoteModal] = useState(false);

    // Multi-select state
    const [selectedIds, setSelectedIds] = useState([]);

    // Filters & Sorting
    const [search, setSearch] = useState('');
    const [debSearch, setDebSearch] = useState('');
    const [yearF, setYearF] = useState('');
    const [semF, setSemF] = useState('');
    const [sectionF, setSectionF] = useState('');
    const [branchF, setBranchF] = useState('');
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

    const fetchStudents = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/students', {
                params: {
                    page, limit,
                    search: debSearch,
                    year: yearF,
                    semester: semF,
                    section: sectionF,
                    branch: branchF,
                    status: statusF,
                    sort: sortCol,
                    sortDir
                }
            });
            setStudents(res.data.students || []);
            setTotalPages(res.data.totalPages || 1);
            setTotalCount(res.data.totalCount || 0);
            if (res.data.filterOptions) setFilterOptions(res.data.filterOptions);
        } catch {
            toast.error('Failed to load student records');
        } finally {
            setLoading(false);
        }
    }, [page, debSearch, yearF, semF, sectionF, branchF, statusF, sortCol, sortDir]);

    useEffect(() => { fetchStudents(); }, [fetchStudents]);

    // Single Actions
    const handleDelete = async (s) => {
        if (s.id === currentUser?.id) return;
        const r = await showConfirm('Delete Student?', `This will permanently delete ${s.name || s.username}.`, 'Delete');
        if (r.isConfirmed) {
            try {
                await api.delete(`/admin/users/${s.id}`);
                setStudents(prev => prev.filter(x => x.id !== s.id));
                setTotalCount(c => c - 1);
                invalidate();
                showSuccess('Deleted', 'Student removed.');
            } catch { toast.error('Delete failed'); }
        }
    };

    const handleSuspend = async (s) => {
        if (s.id === currentUser?.id) return;
        const action = s.isSuspended ? 'Reinstate' : 'Suspend';
        const r = await showConfirm(`${action} Student?`, `${action} ${s.name || s.username}?`, action);
        if (r.isConfirmed) {
            try {
                const res = await api.put(`/admin/users/suspend/${s.id}`);
                setStudents(prev => prev.map(x => x.id === s.id ? { ...x, ...res.data } : x));
                invalidate();
                showSuccess('Updated', `Student ${s.isSuspended ? 'reinstated' : 'suspended'}.`);
            } catch { toast.error('Action failed'); }
        }
    };

    // Bulk Actions
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(students.map(s => s.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        const r = await showConfirm('Bulk Delete?', `Permanently delete ${selectedIds.length} selected student(s)?`, 'Delete All');
        if (r.isConfirmed) {
            try {
                await api.post('/admin/users/bulk-delete', { ids: selectedIds });
                setSelectedIds([]);
                fetchStudents();
                invalidate();
                showSuccess('Bulk Delete', 'Selected students deleted.');
            } catch { toast.error('Bulk delete failed'); }
        }
    };

    const handleBulkSuspend = async (suspend) => {
        if (selectedIds.length === 0) return;
        const action = suspend ? 'Suspend' : 'Reinstate';
        const r = await showConfirm(`Bulk ${action}?`, `${action} ${selectedIds.length} selected student(s)?`, action);
        if (r.isConfirmed) {
            try {
                await api.post('/admin/users/bulk-suspend', { ids: selectedIds, suspend });
                setSelectedIds([]);
                fetchStudents();
                invalidate();
                showSuccess(`Bulk ${action}`, `Selected students ${suspend ? 'suspended' : 'reinstated'}.`);
            } catch { toast.error('Bulk action failed'); }
        }
    };

    const handleSave = () => {
        fetchStudents();
        invalidate();
        setUserModal(null);
    };

    const toggleSort = (col) => {
        if (sortCol === col) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortCol(col);
            setSortDir('asc');
        }
    };

    const hasFilters = debSearch || yearF || semF || sectionF || branchF || statusF;
    const clearFilters = () => {
        setSearch(''); setYearF(''); setSemF(''); setSectionF(''); setBranchF(''); setStatusF(''); setPage(1);
    };

    return (
        <DashboardLayout role="admin">
            <div className="space-y-6 pb-20 max-w-[100rem] mx-auto">
                
                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-200/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-700">
                            <GraduationCap size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Student Directory</h1>
                            <p className="text-slate-500 text-xs font-medium mt-0.5">{totalCount} Total Students Enrolled</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button onClick={() => setShowPromoteModal(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all shadow-xs cursor-pointer">
                            <Award size={15} /> Promote Workflow
                        </button>
                        <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer">
                            <Upload size={15} /> CSV Import
                        </button>
                        <button onClick={fetchStudents} className="p-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-xs">
                            <RefreshCw size={15} />
                        </button>
                        <button onClick={() => setUserModal({ isNew: true })} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95">
                            <Plus size={15} /> Add Student
                        </button>
                    </div>
                </motion.div>

                {/* Filter Bar */}
                <div className="rounded-[18px] bg-white border border-slate-200/80 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex flex-wrap gap-3 items-center">
                    <div className="flex-1 min-w-56 relative">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search name, roll number, email..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-all" />
                    </div>

                    <select value={branchF} onChange={e => { setBranchF(e.target.value); setPage(1); }}
                        className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer">
                        <option value="">All Branches</option>
                        {filterOptions.branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>

                    <select value={yearF} onChange={e => { setYearF(e.target.value); setPage(1); }}
                        className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer">
                        <option value="">All Years</option>
                        {filterOptions.years.map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>

                    <select value={semF} onChange={e => { setSemF(e.target.value); setPage(1); }}
                        className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer">
                        <option value="">All Semesters</option>
                        {filterOptions.semesters.map(s => <option key={s} value={s}>Sem {s}</option>)}
                    </select>

                    <select value={sectionF} onChange={e => { setSectionF(e.target.value); setPage(1); }}
                        className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer">
                        <option value="">All Sections</option>
                        {filterOptions.sections.map(sec => <option key={sec} value={sec}>Sec {sec}</option>)}
                    </select>

                    <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }}
                        className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </select>

                    {hasFilters && (
                        <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs cursor-pointer hover:bg-rose-100 transition-all">
                            <X size={13} /> Clear
                        </button>
                    )}
                </div>

                {/* Bulk Actions Toolbar */}
                {selectedIds.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between flex-wrap gap-3">
                        <span className="text-xs font-bold pl-2">{selectedIds.length} student(s) selected</span>
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

                {/* Students Table */}
                <div className="rounded-[18px] bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/80">
                                    <th className="p-3.5 w-10 text-center">
                                        <input type="checkbox" checked={students.length > 0 && selectedIds.length === students.length} onChange={handleSelectAll} className="rounded text-slate-900 cursor-pointer" />
                                    </th>
                                    <th onClick={() => toggleSort('username')} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider cursor-pointer hover:text-slate-900">
                                        <div className="flex items-center gap-1">Roll / Username <ArrowUpDown size={12} /></div>
                                    </th>
                                    <th onClick={() => toggleSort('name')} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider cursor-pointer hover:text-slate-900">
                                        <div className="flex items-center gap-1">Name <ArrowUpDown size={12} /></div>
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Email</th>
                                    <th onClick={() => toggleSort('studentBranch')} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider cursor-pointer hover:text-slate-900">
                                        <div className="flex items-center gap-1">Branch <ArrowUpDown size={12} /></div>
                                    </th>
                                    <th onClick={() => toggleSort('year')} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider cursor-pointer hover:text-slate-900">
                                        <div className="flex items-center gap-1">Yr / Sem / Sec <ArrowUpDown size={12} /></div>
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/80">
                                {loading ? (
                                    Array.from({ length: 10 }).map((_, i) => <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-9" /></td></tr>)
                                ) : students.length === 0 ? (
                                    <tr><td colSpan={8} className="py-16 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">No student records found</td></tr>
                                ) : (
                                    students.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="p-3.5 text-center">
                                                <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => handleSelectOne(s.id)} className="rounded text-slate-900 cursor-pointer" />
                                            </td>
                                            <td className="px-4 py-3.5 text-xs font-bold text-sky-700">{s.username}</td>
                                            <td className="px-4 py-3.5 text-xs font-bold text-slate-900">{s.name || '—'}</td>
                                            <td className="px-4 py-3.5 text-xs text-slate-600 font-medium truncate max-w-[180px]">{s.email}</td>
                                            <td className="px-4 py-3.5 text-xs font-bold text-slate-700">{s.studentBranch || '—'}</td>
                                            <td className="px-4 py-3.5 text-xs font-semibold text-slate-700">
                                                Y{s.year || '?'} / Sem {s.semester || '?'} / Sec {s.section || '?'}
                                            </td>
                                            <td className="px-4 py-3.5"><StatusBadge suspended={s.isSuspended} online={s.isOnline} /></td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setUserModal({ isNew: false, user: s })} title="Edit" className="p-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 cursor-pointer"><Edit3 size={13} /></button>
                                                    <button onClick={() => handleSuspend(s)} title={s.isSuspended ? 'Reinstate' : 'Suspend'} className={`p-1.5 rounded-lg border cursor-pointer ${s.isSuspended ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><Ban size={13} /></button>
                                                    <button onClick={() => handleDelete(s)} title="Delete" className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {!loading && totalPages > 1 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/50">
                            <p className="text-xs text-slate-500 font-medium">Page {page} of {totalPages} — {totalCount} total</p>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs disabled:opacity-40 cursor-pointer hover:bg-slate-100">← Prev</button>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs disabled:opacity-40 cursor-pointer hover:bg-slate-100">Next →</button>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* Modals */}
            {userModal && <UserModal isNew={userModal.isNew} user={userModal.user} defaultRole="student" onClose={() => setUserModal(null)} onSave={handleSave} />}
            {showImportModal && <BulkImportModal onClose={() => setShowImportModal(false)} onSuccess={() => { fetchStudents(); invalidate(); }} />}
            {showPromoteModal && <PromoteModal selectedIds={selectedIds} filterState={{ year: yearF, semester: semF, branch: branchF, section: sectionF }} onClose={() => setShowPromoteModal(false)} onSuccess={() => { fetchStudents(); invalidate(); }} />}
        </DashboardLayout>
    );
}
