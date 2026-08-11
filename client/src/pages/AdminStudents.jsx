import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    GraduationCap, Search, Edit3, Trash2, Ban, RefreshCw,
    Plus, X, Upload, Award, ArrowUpDown, Eye, Download
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import AuthContext from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import DashboardLayout from '../components/DashboardLayout';
import UserModal from '../components/admin/UserModal';
import BulkImportModal from '../components/admin/BulkImportModal';
import PromoteModal from '../components/admin/PromoteModal';
import StudentProfileModal from '../components/admin/StudentProfileModal';

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
    const [viewingProfile, setViewingProfile] = useState(null);

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
        if (!window.confirm(`Permanently delete student ${s.name || s.username}?`)) return;
        try {
            await api.delete(`/admin/users/${s.id}`);
            toast.success('Student record deleted');
            setStudents(prev => prev.filter(x => x.id !== s.id));
            setTotalCount(c => Math.max(0, c - 1));
            invalidate();
        } catch { toast.error('Delete failed'); }
    };

    const handleSuspend = async (s) => {
        if (s.id === currentUser?.id) return;
        const action = s.isSuspended ? 'Reactivate' : 'Suspend';
        if (!window.confirm(`${action} student ${s.name || s.username}?`)) return;
        try {
            const res = await api.put(`/admin/users/suspend/${s.id}`);
            toast.success(`Student account ${s.isSuspended ? 'reactivated' : 'suspended'}`);
            setStudents(prev => prev.map(x => x.id === s.id ? { ...x, ...res.data } : x));
            invalidate();
        } catch { toast.error('Action failed'); }
    };

    // Bulk Actions
    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedIds(students.map(s => s.id));
        else setSelectedIds([]);
    };

    const handleSelectOne = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Permanently delete ${selectedIds.length} selected student(s)?`)) return;
        try {
            await api.post('/admin/users/bulk-delete', { ids: selectedIds });
            setSelectedIds([]);
            fetchStudents();
            invalidate();
            toast.success('Selected students deleted');
        } catch { toast.error('Bulk delete failed'); }
    };

    const handleBulkSuspend = async (suspend) => {
        if (selectedIds.length === 0) return;
        const action = suspend ? 'Suspend' : 'Reactivate';
        if (!window.confirm(`${action} ${selectedIds.length} selected student(s)?`)) return;
        try {
            await api.post('/admin/users/bulk-suspend', { ids: selectedIds, suspend });
            setSelectedIds([]);
            fetchStudents();
            invalidate();
            toast.success(`Selected students ${suspend ? 'suspended' : 'reactivated'}`);
        } catch { toast.error('Bulk action failed'); }
    };

    const handleSave = () => {
        fetchStudents();
        invalidate();
        setUserModal(null);
    };

    const toggleSort = (col) => {
        if (sortCol === col) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('asc'); }
    };

    const downloadSampleCSV = () => {
        const header = 'RollNumber,Name,Email,Branch,Year,Semester,Section,Phone,Gender,DateOfAdmission,Status';
        const sampleRow = '24BD1A0501,Rahul Sharma,24bd1a0501@kmit.in,CSE,1,1,A,9876543210,Male,2024-08-01,active';
        const blob = new Blob([[header, sampleRow].join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'KMIT_Student_Import_Template.csv';
        a.click();
        URL.revokeObjectURL(url);
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
                            <p className="text-slate-500 text-xs font-semibold mt-0.5">{totalCount.toLocaleString()} Total Students Enrolled (Database Synchronized)</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button onClick={() => setShowPromoteModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95">
                            <Award size={15} /> Promote Workflow
                        </button>
                        <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95">
                            <Upload size={15} /> CSV Import
                        </button>
                        <button onClick={downloadSampleCSV} title="Download Sample CSV Template" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-xs cursor-pointer">
                            <Download size={14} /> Sample CSV
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
                        {filterOptions.branches?.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>

                    <select value={yearF} onChange={e => { setYearF(e.target.value); setPage(1); }}
                        className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer">
                        <option value="">All Years</option>
                        {filterOptions.years?.map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>

                    <select value={semF} onChange={e => { setSemF(e.target.value); setPage(1); }}
                        className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer">
                        <option value="">All Semesters</option>
                        {filterOptions.semesters?.map(s => <option key={s} value={s}>Sem {s}</option>)}
                    </select>

                    <select value={sectionF} onChange={e => { setSectionF(e.target.value); setPage(1); }}
                        className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer">
                        <option value="">All Sections</option>
                        {filterOptions.sections?.map(sec => <option key={sec} value={sec}>Sec {sec}</option>)}
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
                                Reactivate Selected
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
                        <table className="w-full min-w-[1000px]">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/80">
                                    <th className="p-3.5 w-10 text-center">
                                        <input type="checkbox" checked={students.length > 0 && selectedIds.length === students.length} onChange={handleSelectAll} className="rounded text-slate-900 cursor-pointer" />
                                    </th>
                                    <th onClick={() => toggleSort('username')} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider cursor-pointer hover:text-slate-900">
                                        <div className="flex items-center gap-1">Roll Number <ArrowUpDown size={12} /></div>
                                    </th>
                                    <th onClick={() => toggleSort('name')} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider cursor-pointer hover:text-slate-900">
                                        <div className="flex items-center gap-1">Name <ArrowUpDown size={12} /></div>
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Email</th>
                                    <th onClick={() => toggleSort('studentBranch')} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider cursor-pointer hover:text-slate-900">
                                        <div className="flex items-center gap-1">Branch <ArrowUpDown size={12} /></div>
                                    </th>
                                    <th onClick={() => toggleSort('year')} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider cursor-pointer hover:text-slate-900">
                                        <div className="flex items-center gap-1">Year <ArrowUpDown size={12} /></div>
                                    </th>
                                    <th onClick={() => toggleSort('semester')} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider cursor-pointer hover:text-slate-900">
                                        <div className="flex items-center gap-1">Semester <ArrowUpDown size={12} /></div>
                                    </th>
                                    <th onClick={() => toggleSort('section')} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider cursor-pointer hover:text-slate-900">
                                        <div className="flex items-center gap-1">Section <ArrowUpDown size={12} /></div>
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/80">
                                {loading ? (
                                    Array.from({ length: 10 }).map((_, i) => <tr key={i}><td colSpan={10} className="px-4 py-3"><Skeleton className="h-9" /></td></tr>)
                                ) : students.length === 0 ? (
                                    <tr><td colSpan={10} className="py-16 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">No student records found</td></tr>
                                ) : (
                                    students.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3.5 text-center">
                                                <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => handleSelectOne(s.id)} className="rounded text-slate-900 cursor-pointer" />
                                            </td>
                                            <td className="px-4 py-3.5 text-xs font-bold text-sky-700 whitespace-nowrap">{s.username}</td>
                                            <td className="px-4 py-3.5 text-xs font-bold text-slate-900 whitespace-nowrap">{s.name || '—'}</td>
                                            <td className="px-4 py-3.5 text-xs text-slate-600 font-medium truncate max-w-[180px]">{s.email}</td>
                                            <td className="px-4 py-3.5 text-xs font-bold text-slate-700 whitespace-nowrap">{s.studentBranch || '—'}</td>
                                            <td className="px-4 py-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap">Yr {s.year || '?'}</td>
                                            <td className="px-4 py-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap">Sem {s.semester || '?'}</td>
                                            <td className="px-4 py-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap">Sec {s.section || '?'}</td>
                                            <td className="px-4 py-3.5 whitespace-nowrap"><StatusBadge suspended={s.isSuspended} online={s.isOnline} /></td>
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <button onClick={() => setViewingProfile(s)} title="View Student Profile" className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer transition-all"><Eye size={13} /></button>
                                                    <button onClick={() => setUserModal({ isNew: false, user: s })} title="Edit Student" className="p-1.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 cursor-pointer transition-all"><Edit3 size={13} /></button>
                                                    <button onClick={() => handleSuspend(s)} title={s.isSuspended ? 'Reactivate' : 'Suspend'} className={`p-1.5 rounded-lg border cursor-pointer transition-all ${s.isSuspended ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}><Ban size={13} /></button>
                                                    <button onClick={() => handleDelete(s)} title="Delete Student" className="p-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer transition-all"><Trash2 size={13} /></button>
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
                            <p className="text-xs text-slate-500 font-medium">Page {page} of {totalPages} — {totalCount.toLocaleString()} total students</p>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs disabled:opacity-40 cursor-pointer hover:bg-slate-100">← Prev</button>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs disabled:opacity-40 cursor-pointer hover:bg-slate-100">Next →</button>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* Modals */}
            {userModal && <UserModal isNew={userModal.isNew !== undefined ? userModal.isNew : !userModal.user} user={userModal.user} defaultRole="student" onClose={() => setUserModal(null)} onSave={handleSave} />}
            {showImportModal && <BulkImportModal onClose={() => setShowImportModal(false)} onSuccess={() => { fetchStudents(); invalidate(); }} />}
            {showPromoteModal && <PromoteModal onClose={() => setShowPromoteModal(false)} onSuccess={() => { fetchStudents(); invalidate(); }} />}
            {viewingProfile && <StudentProfileModal student={viewingProfile} onClose={() => setViewingProfile(null)} onEdit={(s) => setUserModal({ isNew: false, user: s })} onSuspend={handleSuspend} />}
        </DashboardLayout>
    );
}
