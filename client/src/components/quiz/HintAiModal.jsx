import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles, X, Check, Lightbulb, Compass, ShieldAlert } from 'lucide-react';

export default function HintAiModal({
    isOpen = false,
    onClose,
    questionText = '',
    explanation = '',
    hint = '',
    cost = 30
}) {
    if (!isOpen) return null;

    // Synthesize a helpful conceptual hint if no pre-defined explanation or hint exists
    const resolvedHint = hint || explanation || (
        questionText
            ? `Focus on the core keywords in the prompt: "${questionText.slice(0, 60)}${questionText.length > 60 ? '...' : ''}". Eliminate extreme choices and look for standard industry terminology.`
            : 'Analyze the options carefully. Pay attention to specific qualifying words or technical definitions.'
    );

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[var(--z-modal,100)] flex items-center justify-center p-4 sm:p-6">
                {/* Backdrop with rich blur */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-950/70 backdrop-blur-md cursor-pointer"
                />

                {/* Modal Window */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    className="relative w-full max-w-lg bg-white dark:bg-slate-900 border-2 border-indigo-500/30 rounded-[2.5rem] shadow-2xl p-6 sm:p-8 text-slate-900 dark:text-white z-10 overflow-hidden"
                >
                    {/* Glow Accents */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

                    {/* Header */}
                    <div className="flex items-center justify-between pb-5 mb-5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                                <Brain size={24} className="animate-pulse" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                                        Tactical Clue
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400">-{cost} pts</span>
                                </div>
                                <h3 className="text-xl font-black italic uppercase tracking-tight">
                                    Neural Assistant
                                </h3>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Clue Body */}
                    <div className="space-y-4 mb-6">
                        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-purple-50/30 dark:from-indigo-950/40 dark:to-purple-950/20 border border-indigo-200/60 dark:border-indigo-800/40">
                            <div className="flex items-start gap-3">
                                <Lightbulb size={20} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                                <div className="space-y-1.5">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                                        Concept Guidance
                                    </h4>
                                    <p className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200">
                                        {resolvedHint}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
                            <ShieldAlert size={16} className="shrink-0 text-amber-600" />
                            <span className="font-semibold text-[11px] leading-tight">
                                Clues never reveal the direct answer option, preserving academic integrity.
                            </span>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white font-black italic uppercase tracking-wider text-xs rounded-2xl shadow-xl shadow-indigo-600/25 hover:opacity-95 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                        <Check size={16} />
                        <span>Lock In & Return to Arena</span>
                    </button>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
