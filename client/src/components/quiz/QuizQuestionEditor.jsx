import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Plus, Minus, Eye, Code, Pin, Target, Scale } from 'lucide-react';
import { PremiumInput, GlassCard } from '../ui/Primitives';
import FormattedQuestionText from './FormattedQuestionText';

const kahootColors = [
    'border-red-200 bg-red-50/60',
    'border-orange-200 bg-orange-50/70',
    'border-amber-200 bg-amber-50/70',
    'border-emerald-200 bg-emerald-50/70',
    'border-violet-200 bg-violet-50/70',
    'border-pink-200 bg-pink-50/70',
];

const kahootBadgeColors = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#22c55e',
    '#8b5cf6',
    '#ec4899',
];

const kahootSelectedBorders = [
    'ring-2 ring-red-200 !border-red-400 shadow-[0_0_0_1px_rgba(239,68,68,0.12)]',
    'ring-2 ring-orange-200 !border-orange-400 shadow-[0_0_0_1px_rgba(249,115,22,0.12)]',
    'ring-2 ring-amber-200 !border-amber-400 shadow-[0_0_0_1px_rgba(245,158,11,0.12)]',
    'ring-2 ring-emerald-200 !border-emerald-400 shadow-[0_0_0_1px_rgba(34,197,94,0.12)]',
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

    return (
        <div className="relative overflow-hidden rounded-[1.5rem] border border-[#d9d9d5] bg-[#f3f3f1] p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.02)] sm:rounded-[2rem] sm:p-6">
            <div className="absolute -right-1 top-4 z-10 sm:top-5">
                <button
                    type="button"
                    onClick={() => setShowConfirmDelete(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-[#d7a17e] bg-[#f8e3db] text-[#d94a3d] shadow-[0_0_0_2px_rgba(255,255,255,0.9)] transition-all hover:scale-105 hover:bg-[#f1d1c6] active:scale-95 cursor-pointer sm:h-12 sm:w-12"
                    title="Remove Question"
                    aria-label="Remove Question"
                >
                    <Trash2 size={18} />
                </button>
            </div>

            <AnimatePresence>
                {showConfirmDelete && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 flex items-center justify-center rounded-[2rem] bg-white/90 backdrop-blur-sm border border-red-500/30"
                    >
                        <div className="bg-white p-6 rounded-2xl shadow-2xl border border-slate-200 text-center max-w-sm">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">Delete Question?</h3>
                            <p className="text-sm text-slate-500 mb-6 font-medium">This action cannot be undone. Are you sure you want to remove this data point?</p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => setShowConfirmDelete(false)}
                                    className="px-6 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setShowConfirmDelete(false);
                                        onDelete(index);
                                    }}
                                    className="px-6 py-2 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-md shadow-red-500/20"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-6 pr-0 sm:pr-14">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#d9d9d5] bg-[#f4f4f2] text-2xl font-black italic text-[#1d1d1d] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:h-16 sm:w-16 sm:text-3xl">
                        {index + 1}
                    </div>

                    <div className="flex-1 space-y-3">
                        <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#444444] sm:text-[11px] sm:tracking-[0.22em]">
                            {question.concept_tag || 'Question Text / Code Snippet / Scenario'}
                        </label>

                        <AutoTextarea
                            placeholder="Enter question prompt or paste multi-line source code here..."
                            value={question.questionText}
                            onChange={(e) => onUpdate(index, 'questionText', e.target.value)}
                            className="w-full rounded-2xl border border-[#d9d9d5] bg-white p-3 text-sm font-medium text-[#1e1e1e] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-all placeholder:text-[#868d95] focus:border-[#f59e0b] focus:outline-none sm:p-4 sm:text-base"
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

                <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
                    {question.options.map((opt, oIndex) => (
                        <motion.div
                            key={oIndex}
                            layout
                            className={`
                                flex items-center gap-3 rounded-[1.1rem] border p-3 transition-all sm:rounded-[1.4rem] sm:p-3.5
                                ${kahootColors[oIndex % 6]}
                                ${question.correctAnswer === opt && opt !== '' ? kahootSelectedBorders[oIndex % 6] : 'border-[#d9d9d5]'}
                            `}
                        >
                            <div
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white shadow-sm sm:h-9 sm:w-9 sm:text-sm"
                                style={{ backgroundColor: kahootBadgeColors[oIndex % 6] }}
                            >
                                {String.fromCharCode(65 + oIndex)}
                            </div>

                            <AutoTextarea
                                value={opt}
                                onChange={(e) => onUpdateOption(index, oIndex, e.target.value)}
                                placeholder={`Option ${oIndex + 1}`}
                                className="flex-1 border-none bg-transparent px-1 py-2 text-sm font-medium text-[#1f2937] focus:outline-none sm:text-base"
                                style={{ color: '#1f2937', minHeight: '2.5rem' }}
                            />

                            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                                <input
                                    type="radio"
                                    name={`correct-${index}`}
                                    checked={question.correctAnswer === opt && opt !== ''}
                                    onChange={() => onUpdate(index, 'correctAnswer', opt)}
                                    className="h-4 w-4 cursor-pointer accent-[#f97316] sm:h-5 sm:w-5"
                                />
                                {question.options.length > 2 && (
                                    <button
                                        type="button"
                                        onClick={() => onDeleteOption(index, oIndex)}
                                        className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white/50 hover:text-red-500"
                                        aria-label={`Delete option ${oIndex + 1}`}
                                    >
                                        <Minus size={16} />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {question.options.length < 6 && (
                    <button
                        type="button"
                        onClick={() => onAddOption(index)}
                        className="flex w-full items-center justify-center gap-3 rounded-[1.1rem] border-2 border-dashed border-[#b8d9ea] bg-[#edf6fb] p-4 text-[#1e2430] transition-all hover:border-[#7bb7d8] hover:bg-[#e7f3fb] sm:rounded-[1.4rem] sm:p-5"
                    >
                        <Plus size={20} className="text-[#1f2937] sm:text-[22px]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1f2937] sm:text-[11px] sm:tracking-[0.22em]">Add Option</span>
                    </button>
                )}
            </div>
        </div>
    );
}

