import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clipboard, Code, CheckCircle, AlertTriangle } from 'lucide-react';
import { PremiumButton } from '../ui/Primitives';
import toast from 'react-hot-toast';

export default function JsonPastePanel({ onQuestionsLoaded }) {
    const [pastedText, setPastedText] = useState('');
    const [parsedCount, setParsedCount] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');
    const [decodedQuestions, setDecodedQuestions] = useState([]);

    const handleAnalyze = () => {
        try {
            if (!pastedText.trim()) {
                setErrorMsg('Paste buffer is empty. Please enter your JSON structure.');
                setParsedCount(0);
                setDecodedQuestions([]);
                return;
            }

            const parsed = JSON.parse(pastedText);
            if (!Array.isArray(parsed)) {
                setErrorMsg('Invalid Format: Root element must be a JSON Array of questions.');
                setParsedCount(0);
                setDecodedQuestions([]);
                return;
            }
            if (parsed.length === 0) {
                setErrorMsg('Invalid Format: JSON array is empty.');
                setParsedCount(0);
                setDecodedQuestions([]);
                return;
            }

            const validated = [];
            for (let i = 0; i < parsed.length; i++) {
                const item = parsed[i];
                const qNum = i + 1;
                
                const questionText = item.questionText || item.question || item.text || item.question_text;
                let options = item.options || item.choices || item.answers;
                const correctAnswer = item.correctAnswer || item.correct || item.answer || item.correct_answer;
                const explanation = item.explanation || item.exp || '';

                if (!questionText) {
                    setErrorMsg(`Question ${qNum}: Missing "questionText" key.`);
                    setParsedCount(0);
                    setDecodedQuestions([]);
                    return;
                }
                if (!options || !Array.isArray(options) || options.length < 2) {
                    setErrorMsg(`Question ${qNum}: Must have an "options" array with at least 2 choices.`);
                    setParsedCount(0);
                    setDecodedQuestions([]);
                    return;
                }
                if (correctAnswer === undefined || correctAnswer === null) {
                    setErrorMsg(`Question ${qNum}: Missing "correctAnswer" key.`);
                    setParsedCount(0);
                    setDecodedQuestions([]);
                    return;
                }

                // Clean options
                const cleanOptions = options.map(o => String(o).trim());
                
                // Clean correct answer
                const cleanCorrect = String(correctAnswer).trim();
                
                // Resilient index and string matches
                let matchedOption = '';
                const idxMatch = parseInt(cleanCorrect);
                if (!isNaN(idxMatch) && idxMatch >= 0 && idxMatch < cleanOptions.length) {
                    matchedOption = cleanOptions[idxMatch];
                } else {
                    matchedOption = cleanOptions.find(o => o.toLowerCase() === cleanCorrect.toLowerCase()) || '';
                }

                if (!matchedOption) {
                    setErrorMsg(`Question ${qNum}: Correct answer "${cleanCorrect}" does not match any choice text or index.`);
                    setParsedCount(0);
                    setDecodedQuestions([]);
                    return;
                }

                validated.push({
                    questionText: String(questionText).trim(),
                    options: cleanOptions,
                    correctAnswer: matchedOption,
                    explanation: String(explanation).trim(),
                    points: parseInt(item.points || 10)
                });
            }

            setDecodedQuestions(validated);
            setParsedCount(validated.length);
            setErrorMsg('');
            toast.success(`Successfully decoded ${validated.length} JSON questions`);
        } catch (err) {
            setErrorMsg(`Syntax Error: Failed to parse JSON. Double check your commas and quotation marks. (${err.message})`);
            setParsedCount(0);
            setDecodedQuestions([]);
            toast.error('JSON compilation error');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Format Protocol Guide */}
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-3xl p-8 backdrop-blur-xl">
                <div className="flex items-center gap-3 mb-4">
                    <Code size={20} className="text-indigo-400" />
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">JSON Layout Schema</span>
                </div>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-4">
                    Pasted text must be a standard JSON array containing question details. Supports alternative keys (question, choices, correct) out of the box!
                </p>
                <pre className="text-indigo-100/40 text-xs font-mono leading-relaxed whitespace-pre-wrap bg-black/20 p-4 rounded-xl border border-white/5">
{`[
  {
    "question": "What is the result of 5 * 6?",
    "options": ["20", "25", "30", "35"],
    "correctAnswer": "30",
    "explanation": "5 multiplied by 6 equals 30"
  }
]`}
                </pre>
            </div>

            {/* Input Form Matrix */}
            <div className="glass-panel p-8 rounded-[2.5rem] border border-white/10 bg-white/[0.01]">
                <div className="flex items-center justify-between mb-4">
                    <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest">JSON Paste Terminal</label>
                    <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">ASCII / UTF-8</span>
                </div>
                <textarea
                    rows={12}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste your JSON array here..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white font-mono text-sm outline-none focus:border-[var(--bg-accent)]/50 focus:ring-2 focus:ring-[var(--bg-accent)]/15 transition-all resize-none shadow-inner animate-glow"
                />

                <div className="flex justify-end mt-6">
                    <PremiumButton variant="ghost" icon={Clipboard} onClick={handleAnalyze}>
                        Analyze Paste Stream
                    </PremiumButton>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-[2rem] p-6 flex items-start gap-4 animate-in slide-in-from-top-2">
                    <AlertTriangle className="text-red-500 shrink-0 mt-1" size={20} />
                    <pre className="text-red-300 text-xs font-mono leading-relaxed whitespace-pre-wrap">{errorMsg}</pre>
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
                                    <span className="text-sm font-black text-white uppercase italic">{parsedCount} Questions Decoded & Verified</span>
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
