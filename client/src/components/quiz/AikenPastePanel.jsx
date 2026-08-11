import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clipboard, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { parseAiken } from '../../utils/parsers';
import { PremiumButton, GlassCard } from '../ui/Primitives';
import toast from 'react-hot-toast';

export default function AikenPastePanel({ onQuestionsLoaded }) {
    const [pastedText, setPastedText] = useState('');
    const [parsedCount, setParsedCount] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');
    const [decodedQuestions, setDecodedQuestions] = useState([]);

    const handleAnalyze = () => {
        if (!pastedText.trim()) {
            setErrorMsg('Paste buffer is empty. Please enter your Aiken format questions first.');
            setParsedCount(0);
            setDecodedQuestions([]);
            return;
        }

        const { questions, errors } = parseAiken(pastedText);

        if (errors && errors.length > 0) {
            setErrorMsg('Invalid AIKEN format detected. Please check the uploaded file format.\n\n' + errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n...and ${errors.length - 5} more errors.` : ''));
            setParsedCount(0);
            setDecodedQuestions([]);
            toast.error('Invalid AIKEN format detected. Please check the uploaded file format.', {
                duration: 6000,
                id: 'aiken-paste-error'
            });
            return;
        }

        if (questions.length === 0) {
            setErrorMsg('Invalid AIKEN format detected. Please check the uploaded file format.');
            setParsedCount(0);
            setDecodedQuestions([]);
            toast.error('Invalid AIKEN format detected. Please check the uploaded file format.', {
                duration: 6000,
                id: 'aiken-paste-empty-error'
            });
            return;
        }

        setDecodedQuestions(questions);
        setParsedCount(questions.length);
        setErrorMsg('');
        toast.success(`Successfully decoded ${questions.length} questions`);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Format Protocol Guide */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-8 backdrop-blur-xl shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <FileText size={20} className="text-indigo-600" />
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-[0.3em]">AIKEN Syntax Rules</span>
                </div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4">
                    Supports single and multi-line question stems (including code blocks with blank lines, indentation & syntax). All lines before Option A. are treated as the question stem. Options must start with A., B., C., D. followed by a period and space, ending with ANSWER: X.
                </p>
                <pre className="text-slate-700 text-xs font-mono leading-relaxed whitespace-pre-wrap bg-white p-4 rounded-xl border border-indigo-50 shadow-sm">
{`What is the output of the following C++ code?

#include <iostream>
using namespace std;

int main() {
    int arr[] = {10, 20, 30, 40, 50};
    for(int i = 4; i >= 0; i -= 2) {
        cout << arr[i] << " ";
    }
    return 0;
}

A. 50 30 10
B. 10 30 50
C. 40 20
D. 50 40 30
ANSWER: A`}
                </pre>
            </div>

            {/* Input Form Matrix */}
            <div className="glass-panel p-8 rounded-[2.5rem] border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Aiken Paste Terminal</label>
                    <span className="text-[9px] text-slate-300 font-black uppercase tracking-widest">UTF-8 Format</span>
                </div>
                <textarea
                    rows={12}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste your raw Aiken text data here..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 text-slate-700 font-mono text-sm outline-none focus:border-[var(--bg-accent)] focus:ring-2 focus:ring-[var(--bg-accent)]/15 transition-all resize-none shadow-inner"
                />

                <div className="flex justify-end mt-6">
                    <PremiumButton variant="ghost" icon={Clipboard} onClick={handleAnalyze}>
                        Analyze Paste Stream
                    </PremiumButton>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 border border-red-200 rounded-[2rem] p-6 flex items-start gap-4 animate-in slide-in-from-top-2">
                    <AlertTriangle className="text-red-500 shrink-0 mt-1" size={20} />
                    <pre className="text-red-700/80 text-xs font-mono leading-relaxed whitespace-pre-wrap flex-1">{errorMsg}</pre>
                </div>
            )}

            <AnimatePresence>
                {parsedCount > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="glass-panel p-8 rounded-[2.5rem] border border-green-500/20 bg-green-500/5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <CheckCircle className="text-green-500" size={20} />
                                    <span className="text-sm font-black text-emerald-950 uppercase italic">{parsedCount} Questions Decoded & Verified</span>
                                </div>
                                <PremiumButton variant="primary" onClick={() => onQuestionsLoaded(decodedQuestions)}>
                                    Inject Questions
                                </PremiumButton>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
