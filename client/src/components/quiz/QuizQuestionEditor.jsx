import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Plus, Minus } from 'lucide-react';
import { PremiumInput, GlassCard } from '../ui/Primitives';

// Pastel card backgrounds keyed by index
const kahootColors = [
    'border-red-400/50 bg-red-50',
    'border-orange-400/50 bg-orange-50',
    'border-yellow-400/50 bg-yellow-50',
    'border-green-400/50 bg-green-50',
    'border-purple-400/50 bg-purple-50',
    'border-pink-400/50 bg-pink-50',
];

// Solid colors for the letter badge (hex so they always render regardless of Tailwind purge)
const kahootBadgeColors = [
    '#ef4444', // red-500
    '#f97316', // orange-500
    '#eab308', // yellow-500
    '#22c55e', // green-500
    '#a855f7', // purple-500
    '#ec4899', // pink-500
];

// Highlight borders matching option's own color when selected
const kahootSelectedBorders = [
    'ring-4 ring-red-500/50 !border-red-500 shadow-md shadow-red-500/20',
    'ring-4 ring-orange-500/50 !border-orange-500 shadow-md shadow-orange-500/20',
    'ring-4 ring-yellow-500/50 !border-yellow-500 shadow-md shadow-yellow-500/20',
    'ring-4 ring-green-500/50 !border-green-500 shadow-md shadow-green-500/20',
    'ring-4 ring-purple-500/50 !border-purple-500 shadow-md shadow-purple-500/20',
    'ring-4 ring-pink-500/50 !border-pink-500 shadow-md shadow-pink-500/20',
];

// Auto-resize textarea helper
function AutoTextarea({ value, onChange, placeholder, style, className }) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current) {
            ref.current.style.height = 'auto';
            ref.current.style.height = ref.current.scrollHeight + 'px';
        }
    }, [value]);
    return (
        <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={className}
            style={{ ...style, resize: 'none', overflow: 'hidden' }}
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
        <GlassCard className="relative overflow-hidden">
            {/* Clean, Professional Top-Right Delete Action Button */}
            <div className="absolute top-6 right-6 z-10">
                <button
                    type="button"
                    onClick={() => setShowConfirmDelete(true)}
                    className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 flex items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer"
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

            <div className="space-y-10">
                <div className="flex items-start gap-6 pr-14">
                    <div className="bg-[var(--bg-accent)]/10 w-16 h-16 rounded-2xl flex items-center justify-center text-[var(--text-accent)] font-black text-2xl border border-[var(--bg-accent)]/20 italic shrink-0">
                        {index + 1}
                    </div>
                    <div className="flex-1">
                        <PremiumInput
                            label={question.concept_tag || "Neural Query"}
                            placeholder="Ask your question here..."
                            value={question.questionText}
                            onChange={(e) => onUpdate(index, 'questionText', e.target.value)}
                            className="text-xl italic"
                        />
                        {question.qualityScore !== undefined && (
                            <div className="mt-2 inline-flex items-center gap-2 text-xs font-mono text-purple-700 bg-purple-50 px-3 py-1 rounded-lg border border-purple-200 mr-2">
                                📊 <strong>Quality Score:</strong> {(question.qualityScore * 100).toFixed(0)}%
                            </div>
                        )}
                        {question.sourceEvidence && Array.isArray(question.sourceEvidence) && question.sourceEvidence.length > 0 && question.sourceEvidence[0]?.text && (
                            <div className="mt-2 text-xs font-mono text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                                📌 <strong>Source Evidence Span:</strong> "{question.sourceEvidence[0].text}"
                            </div>
                        )}
                        {question.assessment_objective && (
                            <p className="mt-2 text-xs font-mono text-emerald-400/90 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                                🎯 Objective: {question.assessment_objective}
                            </p>
                        )}
                        {question.difficulty_reason && Array.isArray(question.difficulty_reason) && (
                            <div className="mt-2 text-xs font-mono text-amber-300/80 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                                <span className="font-bold text-amber-400">⚖️ Calibration Rationale:</span>
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
                                flex items-start gap-4 p-4 rounded-2xl border-2 transition-all group/opt relative h-auto
                                ${kahootColors[oIndex % 6]} 
                                ${question.correctAnswer === opt && opt !== '' ? kahootSelectedBorders[oIndex % 6] : ''}
                            `}
                        >
                            {/* Letter Badge — always white text on solid color */}
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shrink-0 shadow-md mt-0.5"
                                style={{ backgroundColor: kahootBadgeColors[oIndex % 6], color: '#ffffff' }}
                            >
                                {String.fromCharCode(65 + oIndex)}
                            </div>

                            {/* Auto-resizing textarea — full option text always visible */}
                            <AutoTextarea
                                value={opt}
                                onChange={(e) => onUpdateOption(index, oIndex, e.target.value)}
                                placeholder={`Option ${oIndex + 1}`}
                                className="flex-1 bg-transparent border-none focus:ring-0 font-bold py-2 text-base leading-snug w-full"
                                style={{ color: '#1f2937', minHeight: '2.5rem' }}
                            />

                            {/* Radio + Delete */}
                            <div className="flex items-center gap-2 shrink-0 pt-1">
                                <input
                                    type="radio"
                                    name={`correct-${index}`}
                                    checked={question.correctAnswer === opt && opt !== ''}
                                    onChange={() => onUpdate(index, 'correctAnswer', opt)}
                                    className="w-6 h-6 text-blue-600 bg-white border-slate-300 focus:ring-blue-500 cursor-pointer"
                                />
                                {question.options.length > 2 && (
                                    <button 
                                        type="button" 
                                        onClick={() => onDeleteOption(index, oIndex)} 
                                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
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
                            className="flex items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-white/10 text-white/20 hover:border-[var(--bg-accent)]/50 hover:text-[var(--text-accent)] transition-all group/addopt bg-white/[0.01]"
                        >
                            <Plus size={20} className="group-hover/addopt:scale-125 transition-transform" />
                            <span className="font-black text-xs uppercase tracking-[0.2em]">Add Option</span>
                        </button>
                    )}
                </div>
            </div>
        </GlassCard>
    );
}

