import React, { useState } from 'react';
import { X, Award, AlertTriangle, CheckCircle2, ArrowRight, ShieldAlert, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { showConfirm, showSuccess } from '../../utils/alerts';

export default function PromoteModal({ selectedIds = [], filterState = {}, onClose, onSuccess }) {
    const [mode, setMode] = useState('semester'); // 'semester' | 'year' | 'full'
    const [fromYear, setFromYear] = useState('1');
    const [toYear, setToYear] = useState('2');
    const [graduateYear4, setGraduateYear4] = useState(true);
    const [loading, setLoading] = useState(false);

    const handlePromoteSemester = async () => {
        const confirmText = selectedIds.length > 0
            ? `Promote ${selectedIds.length} selected student(s) to the next semester?`
            : `Promote students in current filter view to the next semester?`;
        
        const resAlert = await showConfirm('Promote Semester?', confirmText, 'Promote');
        if (!resAlert.isConfirmed) return;

        setLoading(true);
        try {
            const res = await api.post('/admin/promote/semester', {
                ids: selectedIds,
                year: filterState.year,
                semester: filterState.semester,
                branch: filterState.branch,
                section: filterState.section
            });
            showSuccess('Promotion Complete', res.data.msg);
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Semester promotion failed');
        } finally {
            setLoading(false);
        }
    };

    const handlePromoteYear = async () => {
        const confirmText = `Promote all Year ${fromYear} students to Year ${toYear}${fromYear === '4' && graduateYear4 ? ' (Year 4 students will be graduated)' : ''}?`;
        const resAlert = await showConfirm(`Promote Cohort Year ${fromYear}?`, confirmText, 'Execute Promotion');
        if (!resAlert.isConfirmed) return;

        setLoading(true);
        try {
            const res = await api.post('/admin/promote/year', {
                fromYear,
                toYear,
                branch: filterState.branch,
                section: filterState.section,
                graduateYear4
            });
            showSuccess('Cohort Promoted', res.data.msg);
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Year promotion failed');
        } finally {
            setLoading(false);
        }
    };

    const handleFullBatchPromote = async () => {
        const resAlert = await showConfirm(
            '⚠️ Institution-Wide Promotion?',
            'This will promote ALL 1st, 2nd, and 3rd year students to the next year, and GRADUATE 4th year students. This action is IRREVERSIBLE.',
            'Confirm Full Batch Promotion'
        );
        if (!resAlert.isConfirmed) return;

        setLoading(true);
        try {
            const res = await api.post('/admin/promote');
            showSuccess('Institution Promoted', res.data.msg);
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Full batch promotion failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

                <motion.div initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="relative z-10 w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
                    
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-amber-100 border border-amber-200 text-amber-800">
                                <Award size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900">Academic Promotion Workflow</h3>
                                <p className="text-xs text-slate-500 font-medium">Promote students to next semester or academic year</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-5">
                        {/* Workflow Tabs */}
                        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold">
                            <button onClick={() => setMode('semester')}
                                className={`py-2 rounded-lg transition-all cursor-pointer ${mode === 'semester' ? 'bg-white text-slate-900 shadow-xs border border-slate-200' : 'text-slate-500 hover:text-slate-900'}`}>
                                Semester
                            </button>
                            <button onClick={() => setMode('year')}
                                className={`py-2 rounded-lg transition-all cursor-pointer ${mode === 'year' ? 'bg-white text-slate-900 shadow-xs border border-slate-200' : 'text-slate-500 hover:text-slate-900'}`}>
                                Year Cohort
                            </button>
                            <button onClick={() => setMode('full')}
                                className={`py-2 rounded-lg transition-all cursor-pointer ${mode === 'full' ? 'bg-white text-rose-700 shadow-xs border border-rose-200' : 'text-slate-500 hover:text-slate-900'}`}>
                                Full Institution
                            </button>
                        </div>

                        {/* Mode 1: Semester */}
                        {mode === 'semester' && (
                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-xs space-y-2">
                                    <h4 className="font-extrabold text-sky-900 flex items-center gap-1.5">
                                        <CheckCircle2 size={15} /> Semester Progression Logic
                                    </h4>
                                    <p className="text-sky-800 leading-relaxed font-medium">
                                        Advances students by +1 Semester within their academic record (e.g. Sem 1 → Sem 2, Sem 3 → Sem 4).
                                    </p>
                                    {selectedIds.length > 0 ? (
                                        <span className="inline-block font-bold text-sky-900 bg-sky-200/70 px-2.5 py-1 rounded-md mt-1">
                                            {selectedIds.length} specific student(s) selected
                                        </span>
                                    ) : (
                                        <span className="inline-block font-bold text-sky-900 bg-sky-200/70 px-2.5 py-1 rounded-md mt-1">
                                            Applies to all active filters ({filterState.branch || 'All Branches'} / {filterState.section || 'All Sections'})
                                        </span>
                                    )}
                                </div>
                                <button onClick={handlePromoteSemester} disabled={loading}
                                    className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2">
                                    {loading ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : <>Execute Semester Promotion <ArrowRight size={14} /></>}
                                </button>
                            </div>
                        )}

                        {/* Mode 2: Year Cohort */}
                        {mode === 'year' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">From Year</label>
                                        <select value={fromYear} onChange={e => { setFromYear(e.target.value); setToYear(String(parseInt(e.target.value) + 1)); }}
                                            className="w-full p-2.5 mt-1 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900">
                                            <option value="1">Year 1</option>
                                            <option value="2">Year 2</option>
                                            <option value="3">Year 3</option>
                                            <option value="4">Year 4 (Graduation)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">To Target Year</label>
                                        <input value={fromYear === '4' ? 'Graduated' : `Year ${toYear}`} disabled
                                            className="w-full p-2.5 mt-1 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700" />
                                    </div>
                                </div>

                                {fromYear === '4' && (
                                    <label className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl cursor-pointer">
                                        <input type="checkbox" checked={graduateYear4} onChange={e => setGraduateYear4(e.target.checked)} className="rounded text-rose-600 focus:ring-0" />
                                        <span className="text-xs font-bold text-rose-900">Graduate & Archive Year 4 students from database</span>
                                    </label>
                                )}

                                <button onClick={handlePromoteYear} disabled={loading}
                                    className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2">
                                    {loading ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : <>Promote Year {fromYear} Cohort <ArrowRight size={14} /></>}
                                </button>
                            </div>
                        )}

                        {/* Mode 3: Full Institution */}
                        {mode === 'full' && (
                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-2">
                                    <h4 className="font-extrabold text-rose-900 flex items-center gap-1.5">
                                        <ShieldAlert size={16} /> Annual Institution Promotion
                                    </h4>
                                    <p className="text-rose-800 leading-relaxed font-medium">
                                        Shifts Year 1 → Year 2, Year 2 → Year 3, Year 3 → Year 4, and automatically graduates Year 4 students.
                                    </p>
                                </div>

                                <button onClick={handleFullBatchPromote} disabled={loading}
                                    className="w-full py-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2">
                                    {loading ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : <>Run Full Institution Promotion <ArrowRight size={14} /></>}
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
