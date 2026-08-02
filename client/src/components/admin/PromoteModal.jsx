import React, { useState } from 'react';
import { X, Award, AlertTriangle, CheckCircle2, ArrowRight, ShieldAlert, Loader2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../utils/api';

export default function PromoteModal({ selectedIds = [], filterState = {}, onClose, onSuccess }) {
    const [mode, setMode] = useState('semester'); // 'semester' | 'year' | 'full'
    const [fromYear, setFromYear] = useState('1');
    const [loading, setLoading] = useState(false);

    const toYear = fromYear === '4' ? 'Graduated' : String(parseInt(fromYear) + 1);

    // ── Semester Promotion ────────────────────────────────────────────────────
    const handlePromoteSemester = async () => {
        const target = selectedIds.length > 0
            ? `${selectedIds.length} selected student(s)`
            : `all students in current filters`;

        const ok = window.confirm(`Promote ${target} to the next semester?\n\nSem 1 → 2, Sem 3 → 4, etc.`);
        if (!ok) return;

        setLoading(true);
        try {
            const res = await api.post('/admin/promote/semester', {
                ids: selectedIds,
                year: filterState.year,
                semester: filterState.semester,
                branch: filterState.branch,
                section: filterState.section
            });
            toast.success(res.data.msg || 'Semester promotion complete!');
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Semester promotion failed');
        } finally {
            setLoading(false);
        }
    };

    // ── Year Promotion ────────────────────────────────────────────────────────
    const handlePromoteYear = async () => {
        const label = fromYear === '4'
            ? `Graduate all Year 4 students`
            : `Promote all Year ${fromYear} students → Year ${toYear}`;

        const ok = window.confirm(`${label}\n\nThis will update their year and semester in the database.`);
        if (!ok) return;

        setLoading(true);
        try {
            const res = await api.post('/admin/promote/year', {
                fromYear,
                toYear: fromYear === '4' ? '4' : toYear,
                branch: filterState.branch,
                section: filterState.section,
                graduateYear4: fromYear === '4'
            });
            toast.success(res.data.msg || 'Year promotion complete!');
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Year promotion failed');
        } finally {
            setLoading(false);
        }
    };

    // ── Full Institution ──────────────────────────────────────────────────────
    const handleFullPromotion = async () => {
        const ok = window.confirm(
            '⚠️ INSTITUTION-WIDE PROMOTION\n\n' +
            '• Year 1 → Year 2\n' +
            '• Year 2 → Year 3\n' +
            '• Year 3 → Year 4\n' +
            '• Year 4 → Graduated\n\n' +
            'This action affects ALL students and cannot be undone. Proceed?'
        );
        if (!ok) return;

        setLoading(true);
        try {
            const res = await api.post('/admin/promote');
            toast.success(res.data.msg || 'Full institution promotion complete!');
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Full promotion failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

                <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="relative z-10 w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">

                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-200 bg-amber-50/60 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-amber-100 border border-amber-200 text-amber-700">
                                <Award size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900">Academic Promotion</h3>
                                <p className="text-xs text-slate-500 font-medium">Advance students to next semester or year</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Mode Tabs */}
                    <div className="p-4 border-b border-slate-200 bg-white">
                        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold">
                            {[
                                { key: 'semester', label: 'Semester' },
                                { key: 'year',     label: 'Year Cohort' },
                                { key: 'full',     label: 'Full Institution' },
                            ].map(tab => (
                                <button key={tab.key} onClick={() => setMode(tab.key)}
                                    className={`py-2 rounded-lg transition-all cursor-pointer text-[11px] ${
                                        mode === tab.key
                                            ? tab.key === 'full'
                                                ? 'bg-white text-rose-700 shadow-sm border border-rose-200'
                                                : 'bg-white text-slate-900 shadow-sm border border-slate-200'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">

                        {/* ── Semester Mode ── */}
                        {mode === 'semester' && (
                            <>
                                <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-2">
                                    <h4 className="text-xs font-extrabold text-sky-900 flex items-center gap-1.5">
                                        <CheckCircle2 size={14} /> How Semester Promotion Works
                                    </h4>
                                    <ul className="text-xs text-sky-800 font-medium space-y-1 pl-1">
                                        <li className="flex items-center gap-2"><ChevronRight size={11} />Sem 1 → Sem 2</li>
                                        <li className="flex items-center gap-2"><ChevronRight size={11} />Sem 3 → Sem 4</li>
                                        <li className="flex items-center gap-2"><ChevronRight size={11} />Sem 5 → Sem 6, etc.</li>
                                    </ul>
                                    <div className="pt-1 text-xs font-bold text-sky-900 bg-sky-100/60 border border-sky-200 rounded-lg px-3 py-2">
                                        {selectedIds.length > 0
                                            ? `✅ Applies to ${selectedIds.length} selected student(s)`
                                            : `📋 Applies to all students (use filters to narrow scope)`}
                                    </div>
                                </div>

                                <button onClick={handlePromoteSemester} disabled={loading}
                                    className="w-full py-3 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm">
                                    {loading
                                        ? <><Loader2 size={15} className="animate-spin" /> Promoting...</>
                                        : <>Promote to Next Semester <ArrowRight size={15} /></>}
                                </button>
                            </>
                        )}

                        {/* ── Year Cohort Mode ── */}
                        {mode === 'year' && (
                            <>
                                <div className="space-y-3">
                                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Select Year to Promote</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {['1','2','3','4'].map(y => (
                                            <button key={y} onClick={() => setFromYear(y)}
                                                className={`py-3 rounded-xl text-sm font-extrabold border transition-all cursor-pointer ${
                                                    fromYear === y
                                                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                                        : 'bg-white text-slate-700 border-slate-300 hover:border-amber-400'
                                                }`}>
                                                Year {y}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                                        <div className="text-center">
                                            <p className="text-[10px] font-bold text-amber-700 uppercase">From</p>
                                            <p className="text-2xl font-black text-amber-900">Year {fromYear}</p>
                                        </div>
                                        <ArrowRight size={24} className="text-amber-500" />
                                        <div className="text-center">
                                            <p className="text-[10px] font-bold text-amber-700 uppercase">To</p>
                                            <p className={`text-2xl font-black ${fromYear === '4' ? 'text-rose-700' : 'text-amber-900'}`}>
                                                {fromYear === '4' ? '🎓 Grad' : `Year ${toYear}`}
                                            </p>
                                        </div>
                                    </div>

                                    {fromYear === '4' && (
                                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200">
                                            <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                                            <p className="text-xs font-semibold text-rose-800">
                                                Year 4 students will be marked as <strong>Graduated</strong>. This action is permanent.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <button onClick={handlePromoteYear} disabled={loading}
                                    className={`w-full py-3 rounded-xl text-white font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm ${
                                        fromYear === '4' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'
                                    }`}>
                                    {loading
                                        ? <><Loader2 size={15} className="animate-spin" /> Promoting...</>
                                        : fromYear === '4'
                                            ? <>Graduate Year 4 Students <ArrowRight size={15} /></>
                                            : <>Promote Year {fromYear} → Year {toYear} <ArrowRight size={15} /></>}
                                </button>
                            </>
                        )}

                        {/* ── Full Institution Mode ── */}
                        {mode === 'full' && (
                            <>
                                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                                    <h4 className="text-xs font-extrabold text-rose-900 flex items-center gap-1.5">
                                        <ShieldAlert size={14} /> Annual Institution-Wide Promotion
                                    </h4>
                                    <div className="space-y-1.5 text-xs font-medium text-rose-800">
                                        {['Year 1 → Year 2', 'Year 2 → Year 3', 'Year 3 → Year 4', 'Year 4 → Graduated'].map(t => (
                                            <div key={t} className="flex items-center gap-2">
                                                <ChevronRight size={12} className="text-rose-500 shrink-0" />
                                                <span>{t}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-2 text-[11px] font-bold text-rose-700 flex items-center gap-1.5">
                                        <AlertTriangle size={12} /> This affects ALL students. Cannot be undone.
                                    </div>
                                </div>

                                <button onClick={handleFullPromotion} disabled={loading}
                                    className="w-full py-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm">
                                    {loading
                                        ? <><Loader2 size={15} className="animate-spin" /> Promoting All...</>
                                        : <>Run Full Institution Promotion <ArrowRight size={15} /></>}
                                </button>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
