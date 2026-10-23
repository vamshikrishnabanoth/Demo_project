import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Plus, Minus, Eye, Code, Pin, Target, Scale } from 'lucide-react';
import { PremiumInput, GlassCard } from '../ui/Primitives';
import FormattedQuestionText from './FormattedQuestionText';

const kahootColors = [
    'border-[#FEB2B2] bg-[#FFF5F5] hover:bg-[#FEE2E2] hover:border-[#F87171]',
    'border-[#93C5FD] bg-[#EFF6FF] hover:bg-[#DBEAFE] hover:border-[#60A5FA]',
    'border-[#FCD34D] bg-[#FFFCF0] hover:bg-[#FEF3C7] hover:border-[#FBBF24]',
    'border-[#86EFAC] bg-[#F0FDF4] hover:bg-[#D1FAE5] hover:border-[#34D399]',
    'border-violet-200 bg-violet-50/70',
    'border-pink-200 bg-pink-50/70',
];

const kahootBadgeColors = [
    '#EF4444',
    '#2563EB',
    '#F59E0B',
    '#10B981',
    '#8b5cf6',
    '#ec4899',
];

const kahootSelectedBorders = [
    'ring-2 ring-[#FEB2B2] !border-[#EF4444] shadow-[0_0_0_1px_rgba(239,68,68,0.12)]',
    'ring-2 ring-[#93C5FD] !border-[#2563EB] shadow-[0_0_0_1px_rgba(37,99,235,0.12)]',
    'ring-2 ring-[#FCD34D] !border-[#F59E0B] shadow-[0_0_0_1px_rgba(245,158,11,0.12)]',
    'ring-2 ring-[#86EFAC] !border-[#10B981] shadow-[0_0_0_1px_rgba(16,185,129,0.12)]',
    'ring-2 ring-violet-200 !border-violet-400 shadow-[0_0_0_1px_rgba(139,92,246,0.12)]',
    'ring-2 ring-pink-200 !border-pink-400 shadow-[0_0_0_1px_rgba(236,72,153,0.12)]',
];

// Auto-resize textarea helper so long questions & options are 100% visible
function AutoTextarea({ value, onChange, placeholder, style, className }) {
    const ref = useRef(null);

    const adjustHeight = () => {
        if (ref.current) {
            ref.current.style.height = 'auto';
            ref.current.style.height = `${Math.max(48, ref.current.scrollHeight)}px`;
        }
    };

    useEffect(() => {
        adjustHeight();
        const timer = setTimeout(adjustHeight, 50);
        return () => clearTimeout(timer);
    }, [value]);

    useEffect(() => {
        window.addEventListener('resize', adjustHeight);
        return () => window.removeEventListener('resize', adjustHeight);
    }, []);

    return (
        <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => {
                onChange(e);
                adjustHeight();
            }}
            placeholder={placeholder}
            className={className}
            style={{ ...style, overflow: 'hidden', resize: 'none' }}
        />
    );
}

export default function QuizQuestionEditor({ 
    question, 
    index, 
    onUpdate, 
    onDelete, 
    onAddOption, 
    onDeleteOption,
    onUpdateOption 
}) {
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const confirmRef = useRef(null);

    // Auto-dismiss confirmation when clicking outside
    useEffect(() => {
        if (!showConfirmDelete) return;
        const handleOutsideClick = (e) => {
            if (confirmRef.current && !confirmRef.current.contains(e.target)) {
                setShowConfirmDelete(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [showConfirmDelete]);

    return (
        <GlassCard className="relative overflow-hidden">
            {/* Clean, Non-Intrusive Inline Delete Action — No Layered Modals */}
            <div className="absolute top-6 right-6 z-10" ref={confirmRef}>
                {showConfirmDelete ? (
                    <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5 shadow-sm animate-in fade-in zoom-in-95 duration-150">
                        <span className="text-xs font-black text-rose-700 whitespace-nowrap">
                            Delete Q{index + 1}?
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                setShowConfirmDelete(false);
                                onDelete(index);
                            }}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs rounded-lg shadow-xs transition-all cursor-pointer"
                        >
                            Yes, Delete
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowConfirmDelete(false)}
                            className="px-2 py-1 bg-white hover:bg-slate-100 active:scale-95 text-slate-600 text-xs font-bold rounded-lg border border-slate-200 transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowConfirmDelete(true)}
                        className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 flex items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer"
                        title={`Delete Question ${index + 1}`}
                        aria-label={`Delete Question ${index + 1}`}
                    >
                        <Trash2 size={18} />
                    </button>
                )}
            </div>

            <div className="space-y-10">
                <div className="flex items-start gap-6 pr-14">
                    <div className="bg-[var(--bg-secondary)] w-16 h-16 rounded-2xl flex items-center justify-center text-[var(--text-primary)] font-black text-2xl border border-[var(--border-color)] italic shrink-0 shadow-sm">
                        {index + 1}
                    </div>
                    <div className="flex-1 space-y-3">
                        <label className="block text-xs font-black uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                            {question.concept_tag || "Question Text / Code Snippet / Scenario"}
                        </label>

                        <AutoTextarea
                            placeholder="Enter question prompt or paste multi-line source code here..."
                            value={question.questionText}
                            onChange={(e) => onUpdate(index, 'questionText', e.target.value)}
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl p-4 font-sans font-bold text-base text-[var(--text-primary)] leading-relaxed focus:outline-none focus:border-[var(--bg-accent)] focus:ring-2 focus:ring-[var(--bg-accent-glow)] transition-all shadow-sm"
                        />

                        {question.sourceEvidence && Array.isArray(question.sourceEvidence) && question.sourceEvidence.length > 0 && question.sourceEvidence[0]?.text && (
                            <div className="mt-2 text-xs font-mono text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                                <Pin size={13} className="inline mr-1" aria-hidden="true" /> <strong>Source Evidence Span:</strong> "{question.sourceEvidence[0].text}"
                            </div>
                        )}
                        {question.assessment_objective && (
                            <p className="mt-2 text-xs font-mono text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                                <Target size={13} className="inline mr-1" aria-hidden="true" /> Objective: {question.assessment_objective}
                            </p>
                        )}
                        {question.difficulty_reason && Array.isArray(question.difficulty_reason) && (
                            <div className="mt-2 text-xs font-mono text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                                <span className="font-bold text-amber-700"><Scale size={13} className="inline mr-1" aria-hidden="true" /> Calibration Rationale:</span>
                                <ul className="list-disc list-inside mt-1 space-y-0.5">
                                    {question.difficulty_reason.map((r, rIdx) => (
                                        <li key={rIdx}>{r}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                    {question.options.map((opt, oIndex) => (
                        <motion.div
                            key={oIndex}
                            layout
                            className={`
                                flex items-start gap-4 p-4 rounded-2xl border transition-all group/opt relative h-auto
                                ${kahootColors[oIndex % 6]}
                                ${question.correctAnswer === opt && opt !== '' ? kahootSelectedBorders[oIndex % 6] : ''}
                            `}
                        >
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center font-black text-base shrink-0 shadow-sm mt-0.5"
                                style={{ backgroundColor: kahootBadgeColors[oIndex % 6], color: '#ffffff' }}
                            >
                                {String.fromCharCode(65 + oIndex)}
                            </div>

                            <AutoTextarea
                                value={opt}
                                onChange={(e) => onUpdateOption(index, oIndex, e.target.value)}
                                placeholder={`Option ${oIndex + 1}`}
                                className="flex-1 bg-transparent border-none focus:ring-0 font-bold py-2 text-base leading-snug w-full"
                                style={{ color: '#172033', minHeight: '2.5rem' }}
                            />

                            <div className="flex items-center gap-2 shrink-0 pt-1">
                                <input
                                    type="radio"
                                    name={`correct-${index}`}
                                    checked={question.correctAnswer === opt && opt !== ''}
                                    onChange={() => onUpdate(index, 'correctAnswer', opt)}
                                    className="w-5 h-5 text-[var(--bg-accent)] bg-white border-slate-300 focus:ring-[var(--bg-accent)] cursor-pointer"
                                />
                                {question.options.length > 2 && (
                                    <button
                                        type="button"
                                        onClick={() => onDeleteOption(index, oIndex)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                        aria-label={`Delete option ${oIndex + 1}`}
                                    >
                                        <Minus size={16} />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}

                    {question.options.length < 6 && (
                        <button
                            type="button"
                            onClick={() => onAddOption(index)}
                            className="flex items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--bg-accent)]/60 hover:text-[var(--text-primary)] transition-all group/addopt bg-[var(--bg-secondary)]"
                        >
                            <Plus size={20} className="group-hover/addopt:scale-110 transition-transform" />
                            <span className="font-black text-[10px] uppercase tracking-[0.22em]">Add Option</span>
                        </button>
                    )}
                </div>
            </div>
        </GlassCard>
    );
}

