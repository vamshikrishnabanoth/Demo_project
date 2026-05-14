import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import {
    ChevronRight, CheckCircle, XCircle, Trophy, RotateCcw,
    BookOpen, Loader2, AlertCircle, ArrowLeft
} from 'lucide-react';

// ─── Option letter labels ─────────────────────────────────────────────────────
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const OPTION_COLORS = [
    { bg: 'bg-red-500/10 border-red-500/40 hover:bg-red-500/20', accent: 'bg-red-500', selected: 'bg-red-500/25 border-red-500 ring-2 ring-red-500/40' },
    { bg: 'bg-blue-500/10 border-blue-500/40 hover:bg-blue-500/20', accent: 'bg-blue-500', selected: 'bg-blue-500/25 border-blue-500 ring-2 ring-blue-500/40' },
    { bg: 'bg-yellow-500/10 border-yellow-500/40 hover:bg-yellow-500/20', accent: 'bg-yellow-500', selected: 'bg-yellow-500/25 border-yellow-500 ring-2 ring-yellow-500/40' },
    { bg: 'bg-green-500/10 border-green-500/40 hover:bg-green-500/20', accent: 'bg-green-500', selected: 'bg-green-500/25 border-green-500 ring-2 ring-green-500/40' },
];

// ─── Review Card (shared with the results screen) ─────────────────────────────
function ReviewCard({ q, answer, index }) {
    const isCorrect = answer?.isCorrect;
    const selected = answer?.selectedOption || '';
    const correct = q.correctAnswer || answer?.correctOption || '';

    return (
        <div className={`rounded-[2rem] border-2 p-8 ${isCorrect ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
            <div className="flex items-start gap-4 mb-6">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0
                    ${isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                    {isCorrect ? <CheckCircle size={20} /> : <XCircle size={20} />}
                </div>
                <div className="flex-1">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Question {index + 1}</p>
                    <p className="text-white font-bold text-lg leading-snug">{q.questionText || answer?.questionText}</p>
                </div>
            </div>

            <div className="space-y-3">
                {(q.options || []).map((opt, oi) => {
                    const isSelected = opt === selected || selected === '';
                    const isThisCorrect = opt === correct;
                    const showSelected = opt === selected && selected !== '';

                    let cls = 'border border-white/10 bg-white/5 text-slate-400';
                    if (isThisCorrect) cls = 'border-2 border-green-500/60 bg-green-500/10 text-white';
                    else if (showSelected && !isThisCorrect) cls = 'border-2 border-red-500/60 bg-red-500/10 text-white';

                    return (
                        <div key={oi} className={`flex items-center gap-3 px-5 py-3 rounded-2xl transition-all ${cls}`}>
                            <span className={`w-7 h-7 rounded-lg font-black flex items-center justify-center text-xs shrink-0
                                ${isThisCorrect ? 'bg-green-500 text-white' : showSelected && !isThisCorrect ? 'bg-red-500 text-white' : 'bg-white/10 text-slate-500'}`}>
                                {LETTERS[oi]}
                            </span>
                            <span className="font-bold text-sm flex-1">{opt}</span>
                            {isThisCorrect && <CheckCircle size={16} className="text-green-400 shrink-0" />}
                            {showSelected && !isThisCorrect && <XCircle size={16} className="text-red-400 shrink-0" />}
                        </div>
                    );
                })}
                {selected === '' && (
                    <p className="text-xs text-slate-600 font-bold italic px-2">Not answered</p>
                )}
            </div>

            {!isCorrect && correct && (
                <div className="mt-4 flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-2xl px-5 py-3">
                    <CheckCircle size={15} className="text-green-400 mt-0.5 shrink-0" />
                    <p className="text-green-400 text-sm font-bold">Correct answer: <span className="text-green-300">{correct}</span></p>
                </div>
            )}
        </div>
    );
}

// ─── Results / Review Screen ──────────────────────────────────────────────────
function ResultsScreen({ quiz, answers, onRetry, onBack }) {
    const navigate = useNavigate();
    const totalPossible = quiz.questions.reduce((s, q) => s + (q.points || 10), 0);
    const correctCount = answers.filter(a => a.isCorrect).length;
    const wrongCount = answers.filter(a => !a.isCorrect && a.selectedOption).length;
    const skippedCount = answers.filter(a => !a.selectedOption).length;
    const score = answers.reduce((s, a) => s + (a.isCorrect ? (quiz.questions[answers.indexOf(a)]?.points || 10) : 0), 0);
    const pct = totalPossible > 0 ? Math.round((score / totalPossible) * 100) : 0;

    const scoreColor = pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400';
    const scoreRing = pct >= 80 ? 'ring-green-500/30' : pct >= 50 ? 'ring-yellow-500/30' : 'ring-red-500/30';

    return (
        <div className="space-y-10">
            {/* Score Hero */}
            <div className="bg-white/5 border border-white/10 rounded-[3rem] p-12 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#ff6b00]/5 rounded-full blur-[80px] pointer-events-none" />
                <Trophy className="mx-auto mb-6 text-yellow-400" size={56} strokeWidth={1.5} />
                <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter mb-2">Assessment Complete!</h2>
                <p className="text-slate-400 font-bold mb-10">{quiz.title}</p>

                <div className={`inline-flex items-center justify-center w-40 h-40 rounded-full ring-8 ${scoreRing} bg-white/5 mb-8`}>
                    <span className={`text-5xl font-black italic ${scoreColor}`}>{pct}%</span>
                </div>

                <p className="text-slate-300 font-bold mb-8">
                    You scored <span className="text-white font-black">{score}</span> out of <span className="text-white font-black">{totalPossible}</span> points
                </p>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-10">
                    {[
                        { label: 'Correct', value: correctCount, color: 'text-green-400', bg: 'bg-green-500/10' },
                        { label: 'Wrong', value: wrongCount, color: 'text-red-400', bg: 'bg-red-500/10' },
                        { label: 'Skipped', value: skippedCount, color: 'text-slate-400', bg: 'bg-white/5' },
                    ].map((s, i) => (
                        <div key={i} className={`${s.bg} rounded-2xl p-4 text-center`}>
                            <p className={`text-2xl font-black italic ${s.color}`}>{s.value}</p>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-4 flex-wrap">
                    <button
                        onClick={onRetry}
                        className="flex items-center gap-3 bg-[#ff6b00] text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#ff8533] active:scale-95 transition-all shadow-lg shadow-[#ff6b00]/20"
                    >
                        <RotateCcw size={18} /> Try Again
                    </button>
                    <button
                        onClick={onBack}
                        className="flex items-center gap-3 bg-white/10 border border-white/10 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/15 active:scale-95 transition-all"
                    >
                        <ArrowLeft size={18} /> Back to Assessments
                    </button>
                </div>
            </div>

            {/* Question-by-question review */}
            <div>
                <h3 className="text-xl font-black text-white italic uppercase tracking-tight mb-6 flex items-center gap-3">
                    <BookOpen size={24} className="text-[#ff6b00]" />
                    Detailed Review
                </h3>
                <div className="space-y-4">
                    {quiz.questions.map((q, i) => (
                        <ReviewCard key={i} q={q} answer={answers[i] || {}} index={i} />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AssessmentAttempt() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Quiz flow state
    const [currentIdx, setCurrentIdx] = useState(0);
    const [selected, setSelected] = useState(null);       // Currently picked option
    const [answers, setAnswers] = useState([]);            // Accumulated answers per question
    const [submitting, setSubmitting] = useState(false);
    const [phase, setPhase] = useState('quiz');            // 'quiz' | 'results'

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const res = await api.get(`/quiz/${id}`);
                setQuiz(res.data);
            } catch (err) {
                setError(err.response?.data?.msg || 'Failed to load quiz.');
            } finally {
                setLoading(false);
            }
        };
        fetchQuiz();
    }, [id]);

    const resetQuiz = useCallback(() => {
        setCurrentIdx(0);
        setSelected(null);
        setAnswers([]);
        setPhase('quiz');
    }, []);

    const handleSelect = (option) => {
        setSelected(option);
    };

    const handleNext = async () => {
        if (!quiz) return;
        const currentQ = quiz.questions[currentIdx];

        // Build answer record
        const correctOption = currentQ.correctAnswer || '';
        const selectedOption = selected || '';
        const isCorrect = selectedOption.toLowerCase() === correctOption.toLowerCase();

        const newAnswer = { selectedOption, correctOption, isCorrect, questionText: currentQ.questionText };
        const updatedAnswers = [...answers, newAnswer];
        setAnswers(updatedAnswers);

        const isLast = currentIdx === quiz.questions.length - 1;

        if (isLast) {
            // Submit to backend
            setSubmitting(true);
            try {
                const payload = {
                    quizId: id,
                    answers: updatedAnswers.map(a => ({ selectedOption: a.selectedOption }))
                };
                await api.post('/quiz/submit', payload);
            } catch (err) {
                console.error('Submit error:', err);
            } finally {
                setSubmitting(false);
            }
            setPhase('results');
        } else {
            setCurrentIdx(prev => prev + 1);
            setSelected(null);
        }
    };

    // ── Render: loading ───────────────────────────────────────────────────────
    if (loading) {
        return (
            <DashboardLayout role="student">
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <Loader2 size={48} className="animate-spin text-[#ff6b00] mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Loading assessment...</p>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !quiz) {
        return (
            <DashboardLayout role="student">
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <AlertCircle size={48} className="text-red-400 mb-4" />
                    <p className="text-red-400 font-bold">{error || 'Quiz not found.'}</p>
                    <button onClick={() => navigate('/assessments')} className="mt-6 text-[#ff6b00] font-black underline text-sm uppercase tracking-widest">
                        Back to Assessments
                    </button>
                </div>
            </DashboardLayout>
        );
    }

    // ── Render: results ───────────────────────────────────────────────────────
    if (phase === 'results') {
        return (
            <DashboardLayout role="student">
                <div className="max-w-3xl mx-auto pb-20">
                    <ResultsScreen
                        quiz={quiz}
                        answers={answers}
                        onRetry={resetQuiz}
                        onBack={() => navigate('/assessments')}
                    />
                </div>
            </DashboardLayout>
        );
    }

    // ── Render: quiz ──────────────────────────────────────────────────────────
    const currentQ = quiz.questions[currentIdx];
    const progress = ((currentIdx) / quiz.questions.length) * 100;
    const isLast = currentIdx === quiz.questions.length - 1;

    return (
        <DashboardLayout role="student">
            <div className="max-w-2xl mx-auto pb-20">
                {/* Header + Progress */}
                <div className="mb-8">
                    <button
                        onClick={() => navigate('/assessments')}
                        className="flex items-center gap-2 text-slate-500 hover:text-white font-black text-xs uppercase tracking-widest mb-6 transition-colors"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>

                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                            Question {currentIdx + 1} of {quiz.questions.length}
                        </p>
                        <p className="text-xs font-black text-[#ff6b00] uppercase tracking-widest">{quiz.title}</p>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[#ff6b00] rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Question Card */}
                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 mb-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#ff6b00]/5 rounded-full blur-[80px] pointer-events-none" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-[#ff6b00] flex items-center justify-center text-white font-black text-xl italic shrink-0">
                                {currentIdx + 1}
                            </div>
                            <p className="text-white font-bold text-xl leading-snug">{currentQ.questionText}</p>
                        </div>

                        {/* Options */}
                        <div className="grid grid-cols-1 gap-3">
                            {(currentQ.options || []).map((opt, oi) => {
                                const colors = OPTION_COLORS[oi % OPTION_COLORS.length];
                                const isSelected = selected === opt;
                                return (
                                    <button
                                        key={oi}
                                        onClick={() => handleSelect(opt)}
                                        className={`flex items-center gap-4 px-6 py-4 rounded-2xl border-2 transition-all text-left cursor-pointer active:scale-[0.98]
                                            ${isSelected ? colors.selected : colors.bg}`}
                                    >
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0 ${colors.accent}`}>
                                            {LETTERS[oi]}
                                        </div>
                                        <span className="font-bold text-white text-base flex-1">{opt}</span>
                                        {isSelected && (
                                            <div className="w-6 h-6 rounded-full border-2 border-white bg-white flex items-center justify-center shrink-0">
                                                <div className="w-3 h-3 rounded-full bg-[#ff6b00]" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Next / Submit Button */}
                <button
                    onClick={handleNext}
                    disabled={!selected || submitting}
                    className="w-full flex items-center justify-center gap-3 bg-[#ff6b00] text-white py-5 rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-[#ff8533] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xl shadow-[#ff6b00]/20"
                >
                    {submitting ? (
                        <><Loader2 size={22} className="animate-spin" /> Submitting...</>
                    ) : isLast ? (
                        <><CheckCircle size={22} /> Submit Assessment</>
                    ) : (
                        <>Next Question <ChevronRight size={22} /></>
                    )}
                </button>

                <p className="text-center text-xs text-slate-600 font-bold mt-4 uppercase tracking-widest">
                    You must select an answer to proceed
                </p>
            </div>
        </DashboardLayout>
    );
}
