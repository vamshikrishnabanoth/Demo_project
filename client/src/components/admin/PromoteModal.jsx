import React, { useState, useEffect, useCallback } from 'react';
import {
    X, Award, ArrowRight,
    Loader2, Users, Filter, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { getSectionsForBranch } from '../../utils/sectionUtils';

const BRANCHES = ['ALL', 'CSE', 'CSM', 'CSD', 'ECE', 'IT', 'EEE', 'CIVIL', 'MECH'];

export default function PromoteModal({ onClose, onSuccess }) {
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
    const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);
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
        const confirmText = isGraduation 
            ? `Are you sure you want to graduate ${totalCount} senior student(s)? Their records will be archived.`
            : `Promote ${totalCount} student(s) to Year ${targetYear}, Semester ${targetSem}${targetSec !== 'keep' ? `, Section ${targetSec}` : ''}?`;

        if (!window.confirm(confirmText)) return;

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
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Batch promotion failed');
        } finally {
            setExecuting(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
                    onClick={onClose} 
                />

                {/* Modal */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 15 }} 
                    animate={{ opacity: 1, scale: 1, y: 0 }} 
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative z-10 w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
                >

                    {/* Header */}
                    <div className="px-6 py-5 border-b border-amber-200/60 bg-amber-50/80 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-amber-500 text-white shadow-sm">
                                <Award size={22} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">Batch Student Promotion</h3>
                                <p className="text-xs text-slate-600 font-bold">Configure source cohort and target academic state in a single step</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="w-9 h-9 rounded-xl bg-amber-100/60 hover:bg-amber-200 text-amber-900 flex items-center justify-center transition-all cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Body Form */}
                    <form onSubmit={handleExecutePromotion} className="p-6 space-y-6 overflow-y-auto flex-1">
                        
                        {/* Section 1: Source Student Scope (Who to Promote) */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <Filter size={14} className="text-amber-600" />
                                    1. Select Source Student Scope
                                </span>
                                <span className="text-[11px] text-slate-500 font-semibold">Which students are you promoting?</span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">Branch / Dept</label>
                                    <select 
                                        value={dept} 
                                        onChange={e => setDept(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 cursor-pointer"
                                    >
                                        {BRANCHES.map(b => <option key={b} value={b}>{b === 'ALL' ? 'All Branches' : b}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">Current Year</label>
                                    <select 
                                        value={curYear} 
                                        onChange={e => handleCurYearChange(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 cursor-pointer"
                                    >
                                        <option value="ALL">All Years</option>
                                        <option value="1">Year 1 (Freshmen)</option>
                                        <option value="2">Year 2 (Sophomores)</option>
                                        <option value="3">Year 3 (Juniors)</option>
                                        <option value="4">Year 4 (Seniors)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">Current Semester</label>
                                    <select 
                                        value={curSem} 
                                        onChange={e => setCurSem(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 cursor-pointer"
                                    >
                                        <option value="ALL">All Semesters</option>
                                        {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={String(s)}>Semester {s}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">Current Section</label>
                                    <select 
                                        value={sec} 
                                        onChange={e => setSec(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 cursor-pointer"
                                    >
                                        <option value="ALL">All Sections</option>
                                        {activeSections.map(s => <option key={s} value={s}>Section {s}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Target Academic State (Where to Promote To) */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <Award size={14} className="text-amber-600" />
                                    2. Set Target Academic State
                                </span>
                                <span className="text-[11px] text-slate-500 font-semibold">Where will these students advance to?</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-amber-50/70 p-4 rounded-2xl border border-amber-200">
                                <div>
                                    <label className="block text-[10px] font-black text-amber-900 uppercase tracking-wider mb-1">Target Year</label>
                                    <select 
                                        value={targetYear} 
                                        onChange={e => setTargetYear(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-600 cursor-pointer"
                                    >
                                        <option value="1">Year 1 (1st Year)</option>
                                        <option value="2">Year 2 (2nd Year)</option>
                                        <option value="3">Year 3 (3rd Year)</option>
                                        <option value="4">Year 4 (4th Year)</option>
                                        <option value="graduated">🎓 Graduated (Alumni)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-amber-900 uppercase tracking-wider mb-1">Target Semester</label>
                                    <select 
                                        value={targetSem} 
                                        onChange={e => setTargetSem(e.target.value)}
                                        disabled={targetYear === 'graduated'}
                                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-600 cursor-pointer disabled:opacity-50"
                                    >
                                        {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={String(s)}>Semester {s}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-amber-900 uppercase tracking-wider mb-1">Target Section</label>
                                    <select 
                                        value={targetSec} 
                                        onChange={e => setTargetSec(e.target.value)}
                                        disabled={targetYear === 'graduated'}
                                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-600 cursor-pointer disabled:opacity-50"
                                    >
                                        <option value="keep">Keep Current Section</option>
                                        {activeSections.map(s => <option key={s} value={s}>Section {s}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Live Matching Pool Banner */}
                        <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black tracking-tight">
                                            {loadingCount ? 'Calculating match pool...' : `${totalCount} Student(s) Matching Filter`}
                                        </span>
                                        {loadingCount && <Loader2 size={14} className="animate-spin text-amber-400" />}
                                    </div>
                                    <p className="text-[11px] text-slate-300 font-medium">
                                        {targetYear === 'graduated' 
                                            ? `Will mark ${totalCount} student(s) as graduated` 
                                            : `Will update to Year ${targetYear}, Sem ${targetSem}${targetSec !== 'keep' ? `, Sec ${targetSec}` : ''}`
                                        }
                                    </p>
                                </div>
                            </div>

                            {totalCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setShowPreviewDrawer(!showPreviewDrawer)}
                                    className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-center whitespace-nowrap"
                                >
                                    {showPreviewDrawer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    {showPreviewDrawer ? 'Hide Preview' : 'Preview Students'}
                                </button>
                            )}
                        </div>

                        {/* Optional Preview Drawer */}
                        {showPreviewDrawer && previewStudents.length > 0 && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="border border-slate-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto"
                            >
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 border-b border-slate-200 font-extrabold text-slate-700 sticky top-0">
                                        <tr>
                                            <th className="p-2.5">Roll No</th>
                                            <th className="p-2.5">Name</th>
                                            <th className="p-2.5">Current State</th>
                                            <th className="p-2.5">Target State</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                        {previewStudents.slice(0, 50).map(s => (
                                            <tr key={s.id} className="hover:bg-slate-50">
                                                <td className="p-2.5 font-bold text-sky-700">{s.username}</td>
                                                <td className="p-2.5 font-medium">{s.name || s.username}</td>
                                                <td className="p-2.5 text-slate-500">Y{s.year} / Sem{s.semester} / {s.section || 'A'}</td>
                                                <td className="p-2.5 font-bold text-amber-700">
                                                    {targetYear === 'graduated' ? '🎓 Graduated' : `Y${targetYear} / Sem${targetSem} / ${targetSec !== 'keep' ? targetSec : (s.section || 'A')}`}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </motion.div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-all cursor-pointer"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={executing || totalCount === 0 || loadingCount}
                                className="px-7 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                            >
                                {executing ? (
                                    <><Loader2 size={16} className="animate-spin" /> Promoting Students...</>
                                ) : (
                                    <>
                                        <span>Promote {totalCount} Student(s) Now</span>
                                        <ArrowRight size={15} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
