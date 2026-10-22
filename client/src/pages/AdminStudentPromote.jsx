import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Award, ArrowRight, ArrowLeft, Loader2, Users, Filter,
    ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { getSectionsForBranch } from '../utils/sectionUtils';
import { showConfirm } from '../utils/alerts';

const BRANCHES = ['ALL', 'CSE', 'CSM'];

export default function AdminStudentPromote() {
    const navigate = useNavigate();

    // Source Scope Filters
    const [dept, setDept] = useState('ALL');
    const [curYear, setCurYear] = useState('1');
    const [curSem, setCurSem] = useState('ALL');
    const [sec, setSec] = useState('ALL');

    // Target Promotion Settings
    const [targetYear, setTargetYear] = useState('2');
    const [targetSem, setTargetSem] = useState('3');
    const [targetSec, setTargetSec] = useState('keep');

    // Matching students live preview & pool
    const [totalCount, setTotalCount] = useState(0);
    const [previewStudents, setPreviewStudents] = useState([]);
    const [availableDBSections, setAvailableDBSections] = useState([]);
    const [loadingCount, setLoadingCount] = useState(false);
    const [executing, setExecuting] = useState(false);

    // Active dynamic sections for current department choice
    const activeSections = getSectionsForBranch(dept, availableDBSections);

    // Auto-compute recommended target state when current year changes
    const handleCurYearChange = (y) => {
        setCurYear(y);
        if (y === '1') { setTargetYear('2'); setTargetSem('3'); }
        else if (y === '2') { setTargetYear('3'); setTargetSem('5'); }
        else if (y === '3') { setTargetYear('4'); setTargetSem('7'); }
        else if (y === '4') { setTargetYear('graduated'); setTargetSem('8'); }
    };

    // Fetch matching student count & live preview
    const fetchEligible = useCallback(async () => {
        setLoadingCount(true);
        try {
            const res = await api.get('/admin/students/eligible', {
                params: { branch: dept, year: curYear, semester: curSem, section: sec }
            });
            setTotalCount(res.data.totalCount || 0);
            setPreviewStudents(res.data.students || []);

            if (res.data.availableSections && Array.isArray(res.data.availableSections)) {
                setAvailableDBSections(res.data.availableSections);
            }
        } catch {
            setTotalCount(0);
            setPreviewStudents([]);
        } finally {
            setLoadingCount(false);
        }
    }, [dept, curYear, curSem, sec]);

    useEffect(() => {
        fetchEligible();
    }, [fetchEligible]);

    // Single-step promotion execution
    const handleExecutePromotion = async (e) => {
        e.preventDefault();
        if (totalCount === 0) {
            toast.error('No matching students found to promote');
            return;
        }

        const isGraduation = targetYear === 'graduated';
        const dialogTitle = isGraduation ? 'Graduate Senior Students?' : 'Confirm Student Promotion?';
        const dialogMsg = isGraduation 
            ? `Are you sure you want to graduate ${totalCount} senior student(s)? Their records will be archived.`
            : `Promote ${totalCount} student(s) to Year ${targetYear}, Semester ${targetSem}${targetSec !== 'keep' ? `, Section ${targetSec}` : ''}?`;

        const confirmRes = await showConfirm(dialogTitle, dialogMsg, isGraduation ? 'Yes, Graduate' : 'Yes, Proceed');
        if (!confirmRes || !confirmRes.isConfirmed) return;

        setExecuting(true);
        try {
            const res = await api.post('/admin/promote/quick', {
                branch: dept,
                sourceYear: curYear,
                sourceSemester: curSem,
                sourceSection: sec,
                targetYear,
                targetSemester: targetSem,
                targetSection: targetSec
            });

            toast.success(res.data.msg || 'Batch promotion executed successfully!');
            navigate('/admin-dashboard?tab=students');
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Batch promotion failed');
        } finally {
            setExecuting(false);
        }
    };

    return (
        <DashboardLayout role="admin">
            <div className="space-y-6 max-w-6xl mx-auto pb-24">
                
                {/* Breadcrumbs */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <nav className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <Link to="/admin-dashboard" className="hover:text-slate-900 transition-colors">
                            Admin Center
                        </Link>
                        <span>/</span>
                        <Link to="/admin-dashboard?tab=students" className="hover:text-slate-900 transition-colors">
                            Students Directory
                        </Link>
                        <span>/</span>
                        <span className="text-slate-900 font-black">Batch Promotion</span>
                    </nav>

                    <button
                        onClick={() => navigate('/admin-dashboard?tab=students')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider border-2 border-slate-200 transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                        <ArrowLeft size={14} /> Back to Directory
                    </button>
                </div>

                {/* Header Card */}
                <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Award size={28} />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-900 bg-amber-100 px-2.5 py-1 rounded-md border border-amber-300">
                                Cohort Progression
                            </span>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                                Batch Student Promotion
                            </h1>
                            <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                Upgrade student cohorts across academic years, semesters, and sections in one operation.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-black text-slate-700">
                        <Users size={16} className="text-slate-500" />
                        <span>Instant Cohort Targeting</span>
                    </div>
                </div>

                {/* Promotion Form */}
                <form onSubmit={handleExecutePromotion} className="space-y-6">
                    
                    {/* Two-Column Setup: Source vs Target */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* Panel 1: Source Student Scope */}
                        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                    <Filter size={16} className="text-amber-600" />
                                    1. Source Student Scope
                                </h2>
                                <span className="text-xs text-slate-400 font-semibold">Who to advance</span>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        Branch / Department
                                    </label>
                                    <select 
                                        value={dept} 
                                        onChange={e => setDept(e.target.value)}
                                        className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 transition-all cursor-pointer"
                                    >
                                        {BRANCHES.map(b => (
                                            <option key={b} value={b}>{b === 'ALL' ? 'All Branches (CSE & CSM)' : b}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                            Current Academic Year
                                        </label>
                                        <select 
                                            value={curYear} 
                                            onChange={e => handleCurYearChange(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 transition-all cursor-pointer"
                                        >
                                            <option value="ALL">All Years</option>
                                            <option value="1">Year 1 (Freshmen)</option>
                                            <option value="2">Year 2 (Sophomores)</option>
                                            <option value="3">Year 3 (Juniors)</option>
                                            <option value="4">Year 4 (Seniors)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                            Current Semester
                                        </label>
                                        <select 
                                            value={curSem} 
                                            onChange={e => setCurSem(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 transition-all cursor-pointer"
                                        >
                                            <option value="ALL">All Semesters</option>
                                            {[1,2,3,4,5,6,7,8].map(s => (
                                                <option key={s} value={String(s)}>Semester {s}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        Current Section
                                    </label>
                                    <select 
                                        value={sec} 
                                        onChange={e => setSec(e.target.value)}
                                        className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 transition-all cursor-pointer"
                                    >
                                        <option value="ALL">All Sections</option>
                                        {activeSections.map(s => (
                                            <option key={s} value={s}>Section {s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Panel 2: Target Academic State */}
                        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                    <Award size={16} className="text-amber-600" />
                                    2. Target Academic Progression
                                </h2>
                                <span className="text-xs text-amber-700 font-bold">New academic state</span>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-amber-900 uppercase tracking-wider mb-1.5">
                                        Target Academic Year
                                    </label>
                                    <select 
                                        value={targetYear} 
                                        onChange={e => setTargetYear(e.target.value)}
                                        className="w-full px-4 py-3 bg-white border-2 border-amber-300 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-600 transition-all cursor-pointer"
                                    >
                                        <option value="1">Year 1 (1st Year)</option>
                                        <option value="2">Year 2 (2nd Year)</option>
                                        <option value="3">Year 3 (3rd Year)</option>
                                        <option value="4">Year 4 (4th Year)</option>
                                        <option value="graduated">Graduated (Alumni)</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-amber-900 uppercase tracking-wider mb-1.5">
                                            Target Semester
                                        </label>
                                        <select 
                                            value={targetSem} 
                                            onChange={e => setTargetSem(e.target.value)}
                                            disabled={targetYear === 'graduated'}
                                            className="w-full px-4 py-3 bg-white border-2 border-amber-300 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-600 transition-all cursor-pointer disabled:opacity-40"
                                        >
                                            {[1,2,3,4,5,6,7,8].map(s => (
                                                <option key={s} value={String(s)}>Semester {s}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-amber-900 uppercase tracking-wider mb-1.5">
                                            Target Section
                                        </label>
                                        <select 
                                            value={targetSec} 
                                            onChange={e => setTargetSec(e.target.value)}
                                            disabled={targetYear === 'graduated'}
                                            className="w-full px-4 py-3 bg-white border-2 border-amber-300 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-600 transition-all cursor-pointer disabled:opacity-40"
                                        >
                                            <option value="keep">Keep Existing Section</option>
                                            {activeSections.map(s => (
                                                <option key={s} value={s}>Section {s}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 font-medium">
                                    {targetYear === 'graduated' 
                                        ? 'Students will be marked as graduated alumni and retained in archived directories.' 
                                        : `Selected cohort will be advanced to Year ${targetYear}, Semester ${targetSem}${targetSec !== 'keep' ? ` in Section ${targetSec}` : ' preserving current section assignments'}.`
                                    }
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Matching Pool Summary Card */}
                    <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shrink-0">
                                <Users size={28} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-2xl font-black tracking-tight">
                                        {loadingCount ? 'Calculating match pool...' : `${totalCount} Student(s) Matching Criteria`}
                                    </h3>
                                    {loadingCount && <Loader2 size={18} className="animate-spin text-amber-400" />}
                                </div>
                                <p className="text-xs text-slate-300 font-medium mt-1">
                                    {targetYear === 'graduated'
                                        ? `Will mark ${totalCount} student(s) as graduated`
                                        : `Will update ${totalCount} records to Year ${targetYear}, Sem ${targetSem}${targetSec !== 'keep' ? `, Sec ${targetSec}` : ''}`
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/admin-dashboard?tab=students')}
                                className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={executing || totalCount === 0 || loadingCount}
                                className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm border-2 border-[#ea580c] cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                {executing ? (
                                    <>
                                        <RefreshCw className="animate-spin text-amber-300" size={16} />
                                        <span>Promoting Students...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} />
                                        <span>Execute Promotion ({totalCount})</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Preview Table of Matching Students */}
                    {previewStudents.length > 0 && (
                        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                    Cohort Preview (Showing up to {previewStudents.length} matching students)
                                </h4>
                                <span className="text-xs text-slate-400 font-semibold">Live directory preview</span>
                            </div>

                            <div className="border-2 border-slate-100 rounded-2xl overflow-hidden overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 border-b-2 border-slate-200 font-black text-slate-700 uppercase tracking-wider">
                                        <tr>
                                            <th className="p-3">Roll Number</th>
                                            <th className="p-3">Student Name</th>
                                            <th className="p-3">Branch</th>
                                            <th className="p-3">Current State</th>
                                            <th className="p-3">Target State After Promotion</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y-2 divide-slate-100 font-bold text-slate-800">
                                        {previewStudents.map(s => (
                                            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-3 font-black text-sky-700 font-mono">{s.username}</td>
                                                <td className="p-3 text-slate-900 uppercase italic">{s.name || s.username}</td>
                                                <td className="p-3">{s.studentBranch || dept}</td>
                                                <td className="p-3 text-slate-500">Yr {s.year} / Sem {s.semester} / Sec {s.section || 'A'}</td>
                                                <td className="p-3 font-black text-amber-700">
                                                    {targetYear === 'graduated' 
                                                        ? 'Graduated (Alumni)' 
                                                        : `Yr ${targetYear} / Sem ${targetSem} / Sec ${targetSec !== 'keep' ? targetSec : (s.section || 'A')}`
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </form>

            </div>
        </DashboardLayout>
    );
}
