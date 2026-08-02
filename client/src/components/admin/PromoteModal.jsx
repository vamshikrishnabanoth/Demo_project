import React, { useState, useEffect, useCallback } from 'react';
import {
    X, Award, CheckCircle2, ArrowRight, ArrowLeft, ShieldAlert,
    Loader2, Users, BookOpen, Calendar, BookMarked, Grid,
    AlertTriangle, CheckSquare, Square, RefreshCw, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const BRANCHES = ['ALL', 'CSE', 'ECE', 'IT', 'CSM', 'CSD', 'EEE', 'CIVIL', 'MECH'];
const YEARS = ['ALL', '1', '2', '3', '4'];
const SEMESTERS = ['ALL', '1', '2', '3', '4', '5', '6', '7', '8'];
const SECTIONS = ['ALL', 'A', 'B', 'C', 'D'];

export default function PromoteModal({ onClose, onSuccess }) {
    const [step, setStep] = useState(1);

    // Filter selections (Steps 1 - 4)
    const [dept, setDept] = useState('ALL');
    const [curYear, setCurYear] = useState('ALL');
    const [curSem, setCurSem] = useState('ALL');
    const [sec, setSec] = useState('ALL');

    // Eligible students & selection (Step 5)
    const [eligibleStudents, setEligibleStudents] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loadingEligible, setLoadingEligible] = useState(false);

    // Target promotion configuration (Step 6)
    const [targetYear, setTargetYear] = useState('2');
    const [targetSem, setTargetSem] = useState('3');
    const [targetSec, setTargetSec] = useState('');

    const [executing, setExecuting] = useState(false);

    // Fetch eligible students when reaching Step 5
    const fetchEligible = useCallback(async () => {
        setLoadingEligible(true);
        try {
            const res = await api.get('/admin/students/eligible', {
                params: { branch: dept, year: curYear, semester: curSem, section: sec }
            });
            const list = res.data.students || [];
            setEligibleStudents(list);
            setSelectedIds(list.map(s => s.id)); // Select all by default

            // Auto-calculate target year & sem based on current selection
            if (curYear !== 'ALL') {
                const y = parseInt(curYear, 10);
                const nextY = Math.min(4, y + 1);
                setTargetYear(String(nextY));
                setTargetSem(String((nextY - 1) * 2 + 1));
            } else if (curSem !== 'ALL') {
                const s = parseInt(curSem, 10);
                const nextS = Math.min(8, s + 1);
                setTargetSem(String(nextS));
                setTargetYear(String(Math.ceil(nextS / 2)));
            }
        } catch (err) {
            toast.error('Failed to fetch eligible students');
        } finally {
            setLoadingEligible(false);
        }
    }, [dept, curYear, curSem, sec]);

    useEffect(() => {
        if (step === 5) fetchEligible();
    }, [step, fetchEligible]);

    const toggleSelectAll = () => {
        if (selectedIds.length === eligibleStudents.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(eligibleStudents.map(s => s.id));
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    // Execute Promotion (Step 8)
    const handleExecutePromotion = async () => {
        if (selectedIds.length === 0) {
            toast.error('No students selected for promotion');
            return;
        }
        setExecuting(true);
        try {
            const res = await api.post('/admin/promote/wizard', {
                studentIds: selectedIds,
                targetYear,
                targetSemester: targetSem,
                targetSection: targetSec || undefined
            });
            toast.success(res.data.msg);
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Promotion failed');
        } finally {
            setExecuting(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

                <motion.div initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="relative z-10 w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">

                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-200 bg-amber-50/60 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-amber-100 border border-amber-200 text-amber-800">
                                <Award size={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900">Academic Promotion Wizard</h3>
                                <p className="text-xs text-slate-500 font-medium">Step {step} of 7 — Enterprise Promotion System</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Stepper Progress Bar */}
                    <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-extrabold text-slate-500 shrink-0">
                        <span className={step >= 1 ? 'text-amber-700 font-black' : ''}>1. Dept</span> →
                        <span className={step >= 2 ? 'text-amber-700 font-black' : ''}>2. Year</span> →
                        <span className={step >= 3 ? 'text-amber-700 font-black' : ''}>3. Sem</span> →
                        <span className={step >= 4 ? 'text-amber-700 font-black' : ''}>4. Sec</span> →
                        <span className={step >= 5 ? 'text-amber-700 font-black' : ''}>5. Eligible</span> →
                        <span className={step >= 6 ? 'text-amber-700 font-black' : ''}>6. Preview</span> →
                        <span className={step >= 7 ? 'text-amber-700 font-black' : ''}>7. Confirm</span>
                    </div>

                    {/* Wizard Step Content */}
                    <div className="p-6 overflow-y-auto flex-1 space-y-5">

                        {/* STEP 1: Select Department */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                                    <BookOpen size={18} className="text-amber-600" />
                                    <span>Step 1: Select Academic Department / Branch</span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium">Filter promotion pool by specific branch or select ALL branches.</p>

                                <div className="grid grid-cols-3 sm:grid-cols-3 gap-2.5">
                                    {BRANCHES.map(b => (
                                        <button key={b} onClick={() => setDept(b)}
                                            className={`p-3.5 rounded-2xl border text-xs font-black transition-all cursor-pointer flex items-center justify-between ${
                                                dept === b ? 'bg-amber-500 text-white border-amber-500 shadow-md scale-[1.02]' : 'bg-white text-slate-700 border-slate-300 hover:border-amber-400'
                                            }`}>
                                            <span>{b === 'ALL' ? '🏢 All Branches' : b}</span>
                                            {dept === b && <CheckCircle2 size={15} />}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex justify-end pt-4">
                                    <button onClick={() => setStep(2)} className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all flex items-center gap-2 cursor-pointer">
                                        Next: Select Current Year <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: Select Current Year */}
                        {step === 2 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                                    <Calendar size={18} className="text-amber-600" />
                                    <span>Step 2: Select Current Academic Year</span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium">Choose the current year cohort you want to advance.</p>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                                    {YEARS.map(y => (
                                        <button key={y} onClick={() => setCurYear(y)}
                                            className={`p-4 rounded-2xl border text-xs font-black transition-all cursor-pointer flex flex-col items-center gap-1 ${
                                                curYear === y ? 'bg-amber-500 text-white border-amber-500 shadow-md scale-[1.02]' : 'bg-white text-slate-700 border-slate-300 hover:border-amber-400'
                                            }`}>
                                            <span>{y === 'ALL' ? 'All Years' : `Year ${y}`}</span>
                                            {curYear === y && <CheckCircle2 size={15} />}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between pt-4">
                                    <button onClick={() => setStep(1)} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer flex items-center gap-1.5">
                                        <ArrowLeft size={14} /> Back
                                    </button>
                                    <button onClick={() => setStep(3)} className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all flex items-center gap-2 cursor-pointer">
                                        Next: Select Semester <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: Select Current Semester */}
                        {step === 3 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                                    <BookMarked size={18} className="text-amber-600" />
                                    <span>Step 3: Select Current Semester</span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium">Filter by specific semester or select ALL semesters.</p>

                                <div className="grid grid-cols-3 sm:grid-cols-3 gap-2.5">
                                    {SEMESTERS.map(s => (
                                        <button key={s} onClick={() => setCurSem(s)}
                                            className={`p-3.5 rounded-2xl border text-xs font-black transition-all cursor-pointer flex items-center justify-between ${
                                                curSem === s ? 'bg-amber-500 text-white border-amber-500 shadow-md scale-[1.02]' : 'bg-white text-slate-700 border-slate-300 hover:border-amber-400'
                                            }`}>
                                            <span>{s === 'ALL' ? 'All Semesters' : `Semester ${s}`}</span>
                                            {curSem === s && <CheckCircle2 size={15} />}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between pt-4">
                                    <button onClick={() => setStep(2)} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer flex items-center gap-1.5">
                                        <ArrowLeft size={14} /> Back
                                    </button>
                                    <button onClick={() => setStep(4)} className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all flex items-center gap-2 cursor-pointer">
                                        Next: Select Section <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 4: Select Section (Optional) */}
                        {step === 4 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                                    <Grid size={18} className="text-amber-600" />
                                    <span>Step 4: Select Section (Optional)</span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium">Filter by section (A, B, C, D) or choose ALL sections.</p>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                                    {SECTIONS.map(sc => (
                                        <button key={sc} onClick={() => setSec(sc)}
                                            className={`p-4 rounded-2xl border text-xs font-black transition-all cursor-pointer flex flex-col items-center gap-1 ${
                                                sec === sc ? 'bg-amber-500 text-white border-amber-500 shadow-md scale-[1.02]' : 'bg-white text-slate-700 border-slate-300 hover:border-amber-400'
                                            }`}>
                                            <span>{sc === 'ALL' ? 'All Sections' : `Section ${sc}`}</span>
                                            {sec === sc && <CheckCircle2 size={15} />}
                                        </button>
                                    ))}
                                </div>

                                {/* Active Filters Summary */}
                                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900 flex items-center justify-between">
                                    <span>Selected Filter Scope:</span>
                                    <span className="font-extrabold text-amber-950 bg-amber-100 px-3 py-1 rounded-lg">
                                        {dept} Branch · Year {curYear} · Sem {curSem} · Sec {sec}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between pt-4">
                                    <button onClick={() => setStep(3)} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer flex items-center gap-1.5">
                                        <ArrowLeft size={14} /> Back
                                    </button>
                                    <button onClick={() => setStep(5)} className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all flex items-center gap-2 cursor-pointer">
                                        Fetch Eligible Students <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 5: Display Eligible Students */}
                        {step === 5 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                                        <Users size={18} className="text-amber-600" />
                                        <span>Step 5: Eligible Students Pool ({selectedIds.length} / {eligibleStudents.length} selected)</span>
                                    </div>
                                    <button onClick={toggleSelectAll} className="text-xs font-bold text-sky-700 hover:underline cursor-pointer flex items-center gap-1">
                                        {selectedIds.length === eligibleStudents.length ? <CheckSquare size={14} /> : <Square size={14} />}
                                        {selectedIds.length === eligibleStudents.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>

                                {loadingEligible ? (
                                    <div className="py-16 text-center space-y-2">
                                        <Loader2 size={24} className="animate-spin text-amber-600 mx-auto" />
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Querying database for eligible students...</p>
                                    </div>
                                ) : eligibleStudents.length === 0 ? (
                                    <div className="py-12 text-center bg-slate-50 border border-slate-200 rounded-2xl p-6">
                                        <AlertTriangle size={24} className="text-amber-500 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-slate-800">No students matched the selected filter criteria</p>
                                        <p className="text-[11px] text-slate-500 mt-1 font-medium">Try broadening your department, year, or semester selections in previous steps.</p>
                                    </div>
                                ) : (
                                    <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 font-extrabold text-slate-700">
                                                <tr>
                                                    <th className="p-3 w-10 text-center">
                                                        <input type="checkbox" checked={selectedIds.length === eligibleStudents.length} onChange={toggleSelectAll} className="rounded text-amber-600" />
                                                    </th>
                                                    <th className="p-3">Roll Number</th>
                                                    <th className="p-3">Name</th>
                                                    <th className="p-3">Branch</th>
                                                    <th className="p-3">Yr/Sem/Sec</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                                {eligibleStudents.map(s => (
                                                    <tr key={s.id} className="hover:bg-slate-50/70">
                                                        <td className="p-3 text-center">
                                                            <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSelectOne(s.id)} className="rounded text-amber-600 cursor-pointer" />
                                                        </td>
                                                        <td className="p-3 font-bold text-sky-700">{s.username}</td>
                                                        <td className="p-3 font-semibold text-slate-900">{s.name || s.username}</td>
                                                        <td className="p-3 font-bold text-emerald-700">{s.studentBranch || '—'}</td>
                                                        <td className="p-3">Y{s.year} / Sem{s.semester} / {s.section || 'A'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div className="flex items-center justify-between pt-2">
                                    <button onClick={() => setStep(4)} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer flex items-center gap-1.5">
                                        <ArrowLeft size={14} /> Back
                                    </button>
                                    <button onClick={() => setStep(6)} disabled={selectedIds.length === 0} className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40">
                                        Next: Preview Promotion <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 6: Preview Promotion Changes */}
                        {step === 6 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                                    <Eye size={18} className="text-amber-600" />
                                    <span>Step 6: Target Promotion Configuration & Mapping Preview</span>
                                </div>

                                <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                                    <div>
                                        <label className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">Target Year</label>
                                        <select value={targetYear} onChange={e => setTargetYear(e.target.value)}
                                            className="w-full mt-1 p-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900">
                                            <option value="1">Year 1</option>
                                            <option value="2">Year 2</option>
                                            <option value="3">Year 3</option>
                                            <option value="4">Year 4</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">Target Semester</label>
                                        <select value={targetSem} onChange={e => setTargetSem(e.target.value)}
                                            className="w-full mt-1 p-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900">
                                            {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={String(n)}>Sem {n}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">Target Section (Optional)</label>
                                        <select value={targetSec} onChange={e => setTargetSec(e.target.value)}
                                            className="w-full mt-1 p-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900">
                                            <option value="">Keep Same Section</option>
                                            <option value="A">Section A</option>
                                            <option value="B">Section B</option>
                                            <option value="C">Section C</option>
                                            <option value="D">Section D</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Preview Mapping Table */}
                                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-700 sticky top-0">
                                            <tr>
                                                <th className="p-3">Student Name</th>
                                                <th className="p-3">Current Academic State</th>
                                                <th className="p-3 text-center">➔</th>
                                                <th className="p-3">Promoted Academic State</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                            {eligibleStudents.filter(s => selectedIds.includes(s.id)).slice(0, 15).map(s => (
                                                <tr key={s.id} className="hover:bg-slate-50">
                                                    <td className="p-3 font-bold text-slate-900">{s.name || s.username} <span className="text-[10px] text-slate-400">({s.username})</span></td>
                                                    <td className="p-3 text-slate-600">Year {s.year} / Sem {s.semester} / Sec {s.section || 'A'}</td>
                                                    <td className="p-3 text-center text-amber-600 font-bold">➔</td>
                                                    <td className="p-3 font-bold text-amber-900">Year {targetYear} / Sem {targetSem} / Sec {targetSec || s.section || 'A'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <button onClick={() => setStep(5)} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer flex items-center gap-1.5">
                                        <ArrowLeft size={14} /> Back
                                    </button>
                                    <button onClick={() => setStep(7)} className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all flex items-center gap-2 cursor-pointer">
                                        Proceed to Final Confirmation <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 7: Final Confirmation Dialog */}
                        {step === 7 && (
                            <div className="space-y-5 py-2">
                                <div className="p-6 rounded-3xl bg-amber-500 text-white text-center space-y-2 shadow-lg">
                                    <ShieldAlert size={36} className="mx-auto" />
                                    <h4 className="text-lg font-black">Confirm Academic Promotion</h4>
                                    <p className="text-sm font-bold opacity-95">
                                        "This action will promote {selectedIds.length} student(s) to Year {targetYear}, Semester {targetSem}{targetSec ? `, Section ${targetSec}` : ''}."
                                    </p>
                                </div>

                                <div className="space-y-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                                    <p className="font-extrabold text-slate-900">Post-Promotion Automated System Triggers:</p>
                                    <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /> Database records for {selectedIds.length} students updated</p>
                                    <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /> Student directory table & pagination refreshed</p>
                                    <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /> Executive dashboard statistics & year distribution charts updated</p>
                                    <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /> Activity audit log entry recorded</p>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <button onClick={() => setStep(6)} className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer">
                                        ← Back to Preview
                                    </button>
                                    <button onClick={handleExecutePromotion} disabled={executing}
                                        className="px-8 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50">
                                        {executing ? <><Loader2 size={16} className="animate-spin" /> Executing Promotion...</> : <>Execute Promotion Now <ArrowRight size={15} /></>}
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
