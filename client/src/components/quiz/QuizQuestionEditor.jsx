import React from 'react';
import { motion } from 'framer-motion';
import { Trash2, Plus, Minus, CheckCircle, Circle, Square, Triangle, Diamond } from 'lucide-react';
import { PremiumInput, GlassCard, PremiumButton } from '../ui/Primitives';

const kahootColors = [
    'border-red-500/40 bg-red-500/10',
    'border-blue-500/40 bg-blue-500/10',
    'border-yellow-500/40 bg-yellow-500/10',
    'border-green-500/40 bg-green-500/10',
    'border-purple-500/40 bg-purple-500/10',
    'border-pink-500/40 bg-pink-500/10',
];

const kahootAccents = [
    'bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'
];

export default function QuizQuestionEditor({ 
    question, 
    index, 
    onUpdate, 
    onDelete, 
    onAddOption, 
    onDeleteOption,
    onUpdateOption 
}) {
    return (
        <GlassCard className="relative group overflow-visible">
            <div className="absolute top-0 right-0 p-6 flex items-center gap-4 translate-x-4 -translate-y-4 opacity-0 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                <button
                    type="button"
                    onClick={() => onDelete(index)}
                    className="bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white p-3 rounded-xl border border-red-500/30 transition-all shadow-xl"
                >
                    <Trash2 size={20} />
                </button>
            </div>

            <div className="space-y-10">
                <div className="flex items-start gap-6">
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
                                flex items-center gap-4 p-4 rounded-2xl border-2 transition-all group/opt relative overflow-hidden 
                                ${kahootColors[oIndex % 6]} 
                                ${question.correctAnswer === opt && opt !== '' ? 'ring-4 ring-green-500/50 scale-[1.02] border-green-500/50' : 'border-transparent'}
                            `}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black ${kahootAccents[oIndex % 6]} shrink-0 shadow-lg`}>
                                {String.fromCharCode(65 + oIndex)}
                            </div>
                            <input
                                type="text"
                                value={opt}
                                onChange={(e) => onUpdateOption(index, oIndex, e.target.value)}
                                className="flex-1 bg-transparent border-none focus:ring-0 font-bold text-[#1f2937] placeholder:text-[#1f2937]/50 py-3 text-lg"
                                placeholder={`Option ${oIndex + 1}`}
                            />
                            <div className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name={`correct-${index}`}
                                    checked={question.correctAnswer === opt && opt !== ''}
                                    onChange={() => onUpdate(index, 'correctAnswer', opt)}
                                    className="w-8 h-8 text-green-500 bg-white/10 border-white/20 focus:ring-green-500 cursor-pointer"
                                />
                                {question.options.length > 2 && (
                                    <button 
                                        type="button" 
                                        onClick={() => onDeleteOption(index, oIndex)} 
                                        className="p-2 text-white/30 hover:text-red-500 transition-colors"
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
