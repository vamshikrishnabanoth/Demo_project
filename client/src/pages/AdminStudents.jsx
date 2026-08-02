import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    GraduationCap, Search, Filter, ChevronRight, ChevronDown,
    Edit3, Trash2, Ban, RefreshCw, Plus, UserCheck, X,
    KeyRound, Eye, Loader2, Users, BookOpen
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
    return <div className={`animate-pulse bg-white/10 rounded-xl ${className}`} />;
}

// ---- Status Badge ----
function StatusBadge({ suspended, online }) {
    if (suspended)
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />Suspended</span>;
    if (online)
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Online</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-white/5 text-white/40 border border-white/10"><span className="w-1.5 h-1.5 rounded-full bg-white/30" />Offline</span>;
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
            // Fallback to /admin/users?role=student
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

    // Build tree structure
    const yearGroups = {};
    filterOptions.years.forEach(y => {
        yearGroups[y] = {};
        filterOptions.semesters.forEach(s => {
            yearGroups[y][s] = filterOptions.sections;
        });
    });

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
                    <div className="rounded-3xl bg-white/[0.04] border border-white/[0.08] p-5 sticky top-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2 rounded-xl bg-sky-500/10"><BookOpen size={16} className="text-sky-400" /></div>
                            <div>
                                <h2 className="text-sm font-black text-white uppercase tracking-tight">Academic Tree</h2>
                                <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest">Year → Semester → Section</p>
                            </div>
                        </div>

                        {/* All Students */}
                        <button onClick={clearFilters}
                            className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl mb-2 transition-all text-xs font-black uppercase tracking-wider cursor-pointer ${!hasFilters ? 'bg-[var(--bg-accent)] text-white shadow-md' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
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
                                        className={`w-full text-left flex items-center justify-between gap-2 px-4 py-3 rounded-2xl transition-all text-xs font-black uppercase tracking-wider cursor-pointer ${isYearSelected ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                                        <span className="flex items-center gap-2"><GraduationCap size={13} />{yearLabels[year] || `Year ${year}`}</span>
                                        {isYearExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
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
                                                                className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl transition-all text-[11px] font-black uppercase tracking-wider cursor-pointer ${isSemSelected ? 'bg-sky-500/15 text-sky-300' : 'text-white/40 hover:bg-white/5 hover:text-white/70'}`}>
                                                                <span>{semLabels[sem] || `Sem ${sem}`}</span>
                                                                {isSemExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
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
                                                                                className={`w-full text-left px-3 py-2 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest cursor-pointer ${selectedSection === sec ? 'bg-sky-500/20 text-sky-300' : 'text-white/30 hover:bg-white/5 hover:text-white/60'}`}>
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
                            <div className="text-white/20 text-[10px] font-bold uppercase tracking-widest text-center py-4">No year data yet</div>
                        )}
                    </div>
                </motion.div>

                {/* ── Main Content ── */}
                <div className="flex-1 min-w-0">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                        className="rounded-3xl bg-white/[0.04] border border-white/[0.08] overflow-hidden">

                        {/* Header */}
                        <div className="p-6 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 rounded-2xl bg-sky-500/10"><GraduationCap size={22} className="text-sky-400" /></div>
                                <div>
                                    <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">
                                        Student <span className="text-sky-400">Directory</span>
                                    </h2>
                                    <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mt-0.5">
                                        {selectedYear ? `${yearLabels[selectedYear] || `Year ${selectedYear}`}` : 'All Students'}{selectedSemester ? ` → ${semLabels[selectedSemester] || `Sem ${selectedSemester}`}` : ''}{selectedSection ? ` → Section ${selectedSection}` : ''} — {totalCount} students
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={fetchStudents} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
                                    <RefreshCw size={15} />
                                </button>
                                <button onClick={() => setModal({ isNew: true })}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[var(--bg-accent)] hover:opacity-90 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer active:scale-95">
                                    <Plus size={15} /> Add Student
                                </button>
                            </div>
                        </div>

                        {/* Search + Filters */}
                        <div className="p-5 border-b border-white/[0.06] flex flex-wrap gap-3">
                            <div className="flex-1 min-w-56 relative">
                                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                                <input
                                    value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Search name, roll number, email..."
                                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-sky-500/50 transition-all" />
                            </div>
                            <select value={branchF} onChange={e => { setBranchF(e.target.value); setPage(1); }}
                                className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-black text-white/70 focus:outline-none cursor-pointer appearance-none">
                                <option value="">All Branches</option>
                                {filterOptions.branches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                            {hasFilters && (
                                <button onClick={clearFilters}
                                    className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-black text-xs uppercase tracking-wider cursor-pointer hover:bg-rose-500/20 transition-all">
                                    <X size={13} /> Clear
                                </button>
                            )}
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/[0.06]">
                                        {['Roll Number', 'Name', 'Email', 'Branch', 'Year', 'Sem', 'Section', 'Status', 'Actions'].map(h => (
                                            <th key={h} className="px-4 py-4 text-left text-[9px] font-black text-white/30 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    <AnimatePresence>
                                        {loading
                                            ? Array.from({ length: 8 }).map((_, i) => (
                                                <tr key={i}><td colSpan={9} className="px-4 py-3"><Skeleton className="h-10 w-full" /></td></tr>
                                            ))
                                            : students.length === 0
                                                ? <tr><td colSpan={9} className="py-20 text-center text-white/20 text-xs font-bold uppercase tracking-widest">No students found</td></tr>
                                                : students.map((s) => (
                                                    <motion.tr key={s.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                        className="hover:bg-white/[0.03] transition-colors group">
                                                        <td className="px-4 py-4 text-xs font-black text-[var(--text-accent)] whitespace-nowrap">{s.username}</td>
                                                        <td className="px-4 py-4 text-sm font-bold text-white whitespace-nowrap">{s.name || '—'}</td>
                                                        <td className="px-4 py-4 text-xs text-white/50 font-medium max-w-[180px] truncate">{s.email}</td>
                                                        <td className="px-4 py-4 text-xs font-bold text-white/60 whitespace-nowrap">{s.studentBranch || '—'}</td>
                                                        <td className="px-4 py-4 text-xs font-bold text-white/60 whitespace-nowrap">{s.year ? `Y${s.year}` : '—'}</td>
                                                        <td className="px-4 py-4 text-xs font-bold text-white/60 whitespace-nowrap">{s.semester ? `S${s.semester}` : '—'}</td>
                                                        <td className="px-4 py-4 text-xs font-bold text-white/60 whitespace-nowrap">{s.section || '—'}</td>
                                                        <td className="px-4 py-4 whitespace-nowrap"><StatusBadge suspended={s.isSuspended} online={s.isOnline} /></td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => setModal({ isNew: false, user: s })} title="Edit"
                                                                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-all cursor-pointer"><Edit3 size={13} /></button>
                                                                <button onClick={() => handleSuspend(s)} title={s.isSuspended ? 'Reinstate' : 'Suspend'}
                                                                    className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all cursor-pointer ${s.isSuspended ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`}><Ban size={13} /></button>
                                                                <button onClick={() => handleResetPassword(s)} title="Reset Password"
                                                                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-all cursor-pointer"><KeyRound size={13} /></button>
                                                                <button onClick={() => handleDelete(s)} title="Delete" disabled={s.id === currentUser?.id}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer disabled:opacity-30"><Trash2 size={13} /></button>
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
                            <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] flex-wrap gap-3">
                                <p className="text-[10px] text-white/30 font-black uppercase tracking-wider">
                                    Page <span className="text-[var(--text-accent)]">{page}</span> of <span className="text-[var(--text-accent)]">{totalPages}</span> — {totalCount} total
                                </p>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 font-black text-xs hover:bg-white/10 disabled:opacity-30 transition-all cursor-pointer">← Prev</button>
                                    <span className="px-4 py-2 rounded-xl bg-[var(--bg-accent)] text-white text-xs font-black">{page}/{totalPages}</span>
                                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 font-black text-xs hover:bg-white/10 disabled:opacity-30 transition-all cursor-pointer">Next →</button>
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
