import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    GraduationCap, Search, ChevronRight, ChevronDown,
    Edit3, Trash2, Ban, RefreshCw, Plus, X,
    KeyRound, Users, BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import AuthContext from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import UserModal from '../components/admin/UserModal';
import { showConfirm, showSuccess } from '../utils/alerts';

// ---- Skeleton ----
function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-slate-200/80 rounded-xl ${className}`} />;
}

// ---- Status Badge ----
function StatusBadge({ suspended, online }) {
    if (suspended)
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Suspended</span>;
    if (online)
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Online</span>;
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Offline</span>;
}

export default function AdminStudents() {
    const { user: currentUser } = useContext(AuthContext);
    const [students,       setStudents]       = useState([]);
    const [loading,        setLoading]        = useState(false);
    const [filterOptions,  setFilterOptions]  = useState({ years: [], semesters: [], sections: [], branches: [] });
    const [modal,          setModal]          = useState(null);

    // Filters
    const [search,   setSearch]   = useState('');
    const [debSearch, setDebSearch] = useState('');
    const [yearF,    setYearF]    = useState('');
    const [semF,     setSemF]     = useState('');
    const [sectionF, setSectionF] = useState('');
    const [branchF,  setBranchF]  = useState('');
    const [page,     setPage]     = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 50;

    // Tree state
    const [expandedYears,     setExpandedYears]     = useState({});
    const [expandedSemesters, setExpandedSemesters] = useState({});
    const [selectedYear,      setSelectedYear]      = useState('');
    const [selectedSemester,  setSelectedSemester]  = useState('');
    const [selectedSection,   setSelectedSection]   = useState('');

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
                    year: yearF || selectedYear,
                    semester: semF || selectedSemester,
                    section: sectionF || selectedSection,
                    branch: branchF,
                }
            });
            setStudents(res.data.students || []);
            setTotalPages(res.data.totalPages || 1);
            setTotalCount(res.data.totalCount || 0);
            if (res.data.filterOptions) setFilterOptions(res.data.filterOptions);
        } catch (err) {
            try {
                const res2 = await api.get('/admin/users', { params: { page, limit, role: 'student', search: debSearch } });
                setStudents(res2.data.users || []);
                setTotalPages(res2.data.totalPages || 1);
                setTotalCount(res2.data.totalCount || 0);
            } catch { toast.error('Failed to load students'); }
        } finally { setLoading(false); }
    }, [page, debSearch, yearF, semF, sectionF, branchF, selectedYear, selectedSemester, selectedSection]);

    useEffect(() => { fetchStudents(); }, [fetchStudents]);

    const handleDelete = async (s) => {
        if (s.id === currentUser?.id) return;
        const r = await showConfirm('Delete Student?', `This will permanently delete ${s.name || s.username}.`, 'Delete');
        if (r.isConfirmed) {
            try {
                await api.delete(`/admin/users/${s.id}`);
                setStudents(prev => prev.filter(x => x.id !== s.id));
                setTotalCount(c => c - 1);
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
                showSuccess('Updated', `Student ${s.isSuspended ? 'reinstated' : 'suspended'}.`);
            } catch { toast.error('Action failed'); }
        }
    };

    const handleResetPassword = async (s) => {
        const r = await showConfirm('Reset Password?', `Reset password for ${s.name || s.username} to their roll number (${s.username})?`, 'Reset');
        if (r.isConfirmed) {
            try {
                await api.put(`/admin/users/${s.id}`, { password: s.username });
                showSuccess('Reset', 'Password reset to roll number.');
            } catch { toast.error('Reset failed'); }
        }
    };

    const handleSave = (saved, action) => {
        if (action === 'created') setStudents(prev => [saved, ...prev]);
        else setStudents(prev => prev.map(x => x.id === saved.id ? saved : x));
        fetchStudents();
        setModal(null);
    };

    const yearLabels = { '1': '1st Year', '2': '2nd Year', '3': '3rd Year', '4': '4th Year' };
    const semLabels  = { '1': 'Sem 1', '2': 'Sem 2', '3': 'Sem 3', '4': 'Sem 4', '5': 'Sem 5', '6': 'Sem 6', '7': 'Sem 7', '8': 'Sem 8' };

    const clearFilters = () => {
        setYearF(''); setSemF(''); setSectionF(''); setBranchF(''); setSearch('');
        setSelectedYear(''); setSelectedSemester(''); setSelectedSection(''); setPage(1);
    };

    const hasFilters = yearF || semF || sectionF || branchF || debSearch || selectedYear || selectedSemester || selectedSection;

    return (
        <DashboardLayout role="admin">
            <div className="flex flex-col lg:flex-row gap-6 pb-20 max-w-[100rem] mx-auto h-full">

                {/* ── Academic Tree Sidebar ── */}
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
                    className="lg:w-72 shrink-0">
                    <div className="rounded-[18px] bg-white border border-slate-200/80 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] sticky top-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-600"><BookOpen size={16} /></div>
                            <div>
                                <h2 className="text-sm font-bold text-slate-900">Academic Tree</h2>
                                <p className="text-[11px] font-medium text-slate-500">Year → Semester → Section</p>
                            </div>
                        </div>

                        {/* All Students */}
                        <button onClick={clearFilters}
                            className={`w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl mb-2 transition-all text-xs font-bold cursor-pointer ${!hasFilters ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}>
                            <Users size={14} />All Students ({totalCount})
                        </button>

                        {/* Year groups */}
                        {filterOptions.years.length > 0 ? filterOptions.years.map(year => {
                            const isYearExpanded = expandedYears[year];
                            const isYearSelected = selectedYear === year && !selectedSemester;
                            const yearSemesters = filterOptions.semesters.filter(s => {
                                const semNum = parseInt(s);
                                const yearNum = parseInt(year);
                                return semNum >= (yearNum * 2 - 1) && semNum <= (yearNum * 2);
                            });
                            const semestersToShow = yearSemesters.length > 0 ? yearSemesters : filterOptions.semesters;

                            return (
                                <div key={year} className="mb-1">
                                    <button
                                        onClick={() => {
                                            setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }));
                                            setSelectedYear(year); setSelectedSemester(''); setSelectedSection('');
                                            setYearF(year); setSemF(''); setSectionF(''); setPage(1);
                                        }}
                                        className={`w-full text-left flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl transition-all text-xs font-bold cursor-pointer ${isYearSelected ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'text-slate-700 hover:bg-slate-100'}`}>
                                        <span className="flex items-center gap-2"><GraduationCap size={14} />{yearLabels[year] || `Year ${year}`}</span>
                                        {isYearExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>

                                    <AnimatePresence>
                                        {isYearExpanded && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="ml-3 mt-1 space-y-1 overflow-hidden">
                                                {semestersToShow.map(sem => {
                                                    const isSemExpanded = expandedSemesters[`${year}-${sem}`];
                                                    const isSemSelected = selectedYear === year && selectedSemester === sem && !selectedSection;
                                                    return (
                                                        <div key={sem}>
                                                            <button
                                                                onClick={() => {
                                                                    setExpandedSemesters(prev => ({ ...prev, [`${year}-${sem}`]: !prev[`${year}-${sem}`] }));
                                                                    setSelectedSemester(sem); setSelectedSection('');
                                                                    setSemF(sem); setSectionF(''); setPage(1);
                                                                }}
                                                                className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all text-[11px] font-bold cursor-pointer ${isSemSelected ? 'bg-sky-100 text-sky-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                                                                <span>{semLabels[sem] || `Sem ${sem}`}</span>
                                                                {isSemExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                            </button>

                                                            <AnimatePresence>
                                                                {isSemExpanded && filterOptions.sections.length > 0 && (
                                                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="ml-3 mt-0.5 space-y-0.5 overflow-hidden">
                                                                        {filterOptions.sections.map(sec => (
                                                                            <button key={sec}
                                                                                onClick={() => {
                                                                                    setSelectedSection(sec);
                                                                                    setSectionF(sec); setPage(1);
                                                                                }}
                                                                                className={`w-full text-left px-3 py-1.5 rounded-md transition-all text-[10px] font-bold cursor-pointer ${selectedSection === sec ? 'bg-sky-200 text-sky-900' : 'text-slate-500 hover:bg-slate-100'}`}>
                                                                                Section {sec}
                                                                            </button>
                                                                        ))}
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    );
                                                })}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        }) : (
                            <div className="text-slate-400 text-[11px] font-medium text-center py-4">No year data</div>
                        )}
                    </div>
                </motion.div>

                {/* ── Main Content ── */}
                <div className="flex-1 min-w-0">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                        className="rounded-[18px] bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] overflow-hidden">

                        {/* Header */}
                        <div className="p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-600"><GraduationCap size={22} /></div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">
                                        Student Directory
                                    </h2>
                                    <p className="text-slate-500 text-xs font-medium mt-0.5">
                                        {selectedYear ? `${yearLabels[selectedYear] || `Year ${selectedYear}`}` : 'All Students'}{selectedSemester ? ` → ${semLabels[selectedSemester] || `Sem ${selectedSemester}`}` : ''}{selectedSection ? ` → Section ${selectedSection}` : ''} — {totalCount} total students
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={fetchStudents} className="p-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-sm">
                                    <RefreshCw size={15} />
                                </button>
                                <button onClick={() => setModal({ isNew: true })}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-sm cursor-pointer active:scale-95">
                                    <Plus size={15} /> Add Student
                                </button>
                            </div>
                        </div>

                        {/* Search + Filters */}
                        <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-wrap gap-3">
                            <div className="flex-1 min-w-56 relative">
                                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Search name, roll number, email..."
                                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-all" />
                            </div>
                            <select value={branchF} onChange={e => { setBranchF(e.target.value); setPage(1); }}
                                className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer appearance-none">
                                <option value="">All Branches</option>
                                {filterOptions.branches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                            {hasFilters && (
                                <button onClick={clearFilters}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs cursor-pointer hover:bg-rose-100 transition-all">
                                    <X size={13} /> Clear
                                </button>
                            )}
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50/80">
                                        {['Roll Number', 'Name', 'Email', 'Branch', 'Year', 'Sem', 'Section', 'Status', 'Actions'].map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/80">
                                    <AnimatePresence>
                                        {loading
                                            ? Array.from({ length: 8 }).map((_, i) => (
                                                <tr key={i}><td colSpan={9} className="px-4 py-3"><Skeleton className="h-10 w-full" /></td></tr>
                                            ))
                                            : students.length === 0
                                                ? <tr><td colSpan={9} className="py-16 text-center text-slate-500 text-xs font-semibold uppercase tracking-wider">No students found</td></tr>
                                                : students.map((s) => (
                                                    <motion.tr key={s.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                        className="hover:bg-slate-50/80 transition-colors group">
                                                        <td className="px-4 py-3.5 text-xs font-extrabold text-slate-900 whitespace-nowrap">{s.username}</td>
                                                        <td className="px-4 py-3.5 text-xs font-bold text-slate-800 whitespace-nowrap">{s.name || '—'}</td>
                                                        <td className="px-4 py-3.5 text-xs text-slate-600 font-medium max-w-[180px] truncate">{s.email}</td>
                                                        <td className="px-4 py-3.5 text-xs font-bold text-slate-700 whitespace-nowrap">{s.studentBranch || '—'}</td>
                                                        <td className="px-4 py-3.5 text-xs font-bold text-slate-700 whitespace-nowrap">{s.year ? `Y${s.year}` : '—'}</td>
                                                        <td className="px-4 py-3.5 text-xs font-bold text-slate-700 whitespace-nowrap">{s.semester ? `S${s.semester}` : '—'}</td>
                                                        <td className="px-4 py-3.5 text-xs font-bold text-slate-700 whitespace-nowrap">{s.section || '—'}</td>
                                                        <td className="px-4 py-3.5 whitespace-nowrap"><StatusBadge suspended={s.isSuspended} online={s.isOnline} /></td>
                                                        <td className="px-4 py-3.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <button onClick={() => setModal({ isNew: false, user: s })} title="Edit"
                                                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-all cursor-pointer"><Edit3 size={13} /></button>
                                                                <button onClick={() => handleSuspend(s)} title={s.isSuspended ? 'Reinstate' : 'Suspend'}
                                                                    className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${s.isSuspended ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}><Ban size={13} /></button>
                                                                <button onClick={() => handleResetPassword(s)} title="Reset Password"
                                                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-all cursor-pointer"><KeyRound size={13} /></button>
                                                                <button onClick={() => handleDelete(s)} title="Delete" disabled={s.id === currentUser?.id}
                                                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all cursor-pointer disabled:opacity-30"><Trash2 size={13} /></button>
                                                            </div>
                                                        </td>
                                                    </motion.tr>
                                                ))
                                        }
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {!loading && totalPages > 1 && (
                            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex-wrap gap-3">
                                <p className="text-xs text-slate-500 font-medium">
                                    Page <span className="text-slate-900 font-bold">{page}</span> of <span className="text-slate-900 font-bold">{totalPages}</span> — {totalCount} total
                                </p>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 disabled:opacity-40 transition-all cursor-pointer shadow-sm">← Prev</button>
                                    <span className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold">{page}/{totalPages}</span>
                                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 disabled:opacity-40 transition-all cursor-pointer shadow-sm">Next →</button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>

            {modal && (
                <UserModal
                    isNew={modal.isNew}
                    user={modal.user}
                    defaultRole="student"
                    onClose={() => setModal(null)}
                    onSave={handleSave}
                />
            )}
        </DashboardLayout>
    );
}
