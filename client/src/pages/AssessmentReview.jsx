import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import {
    CheckCircle, XCircle, ArrowLeft, Trophy, BookOpen,
    Loader2, AlertCircle, RotateCcw
} from 'lucide-react';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function ReviewCard({ question, answer, index }) {
    const isCorrect = answer?.isCorrect;
    const selected = answer?.selectedOption || '';
    const correct = question?.correctAnswer || answer?.correctOption || '';
    const options = question?.options || [];

    return (
        <div className={`rounded-[2rem] border-2 p-8 transition-all
            ${isCorrect ? 'border-green-500/30 bg-green-500/5' : selected ? 'border-red-500/30 bg-red-500/5' : 'border-white/10 bg-white/5'}`}>
            <div className="flex items-start gap-4 mb-6">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0
                    ${isCorrect ? 'bg-green-500 text-white' : selected ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                    {isCorrect ? <CheckCircle size={20} /> : selected ? <XCircle size={20} /> : <span className="text-sm">{index + 1}</span>}
                </div>
                <div className="flex-1">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Question {index + 1}</p>
                    <p className="text-white font-bold text-lg leading-snug">{question?.questionText || answer?.questionText}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0
                    ${isCorrect ? 'bg-green-500/20 text-green-400' : selected ? 'bg-red-500/20 text-red-400' : 'bg-slate-700/50 text-slate-500'}`}>
                    {isCorrect ? 'Correct' : selected ? 'Wrong' : 'Skipped'}
                </span>
            </div>

            <div className="space-y-3">
                {options.map((opt, oi) => {
                    const isThisCorrect = opt === correct;
                    const isSelected = opt === selected && selected !== '';

                    let cls = 'border border-white/10 bg-white/5 text-slate-400';
                    if (isThisCorrect) cls = 'border-2 border-green-500/60 bg-green-500/10 text-[#1f2937] font-bold';
                    else if (isSelected && !isThisCorrect) cls = 'border-2 border-red-500/60 bg-red-500/10 text-[#1f2937]';

                    return (
                        <div key={oi} className={`flex items-center gap-3 px-5 py-3 rounded-2xl transition-all ${cls}`}>
                            <span className={`w-7 h-7 rounded-lg font-black flex items-center justify-center text-xs shrink-0
                                ${isThisCorrect ? 'bg-green-500 text-white' : isSelected && !isThisCorrect ? 'bg-red-500 text-white' : 'bg-white/10 text-slate-500'}`}>
                                {LETTERS[oi]}
                            </span>
                            <span className="text-sm flex-1">{opt}</span>
                            {isThisCorrect && <CheckCircle size={15} className="text-green-400 shrink-0" />}
                            {isSelected && !isThisCorrect && <XCircle size={15} className="text-red-400 shrink-0" />}
                        </div>
                    );
                })}

                {!selected && (
                    <p className="text-xs text-slate-600 font-bold italic px-2 mt-2">Not answered during attempt</p>
                )}
            </div>

            {!isCorrect && correct && selected && (
                <div className="mt-4 flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-2xl px-5 py-3">
                    <CheckCircle size={15} className="text-green-400 mt-0.5 shrink-0" />
                    <p className="text-green-400 text-sm font-bold">
                        Correct answer: <span className="text-green-300">{correct}</span>
                    </p>
                </div>
            )}
        </div>
    );
}

export default function AssessmentReview() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchResult = async () => {
            try {
                const res = await api.get(`/quiz/result/${id}`);
                setData(res.data);
            } catch (err) {
                setError(err.response?.data?.msg || 'Could not load review data.');
            } finally {
                setLoading(false);
            }
        };
        fetchResult();
    }, [id]);

    if (loading) {
        return (
            <DashboardLayout role="student">
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <Loader2 size={48} className="animate-spin text-[#ff6b00] mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Loading review...</p>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !data) {
        return (
            <DashboardLayout role="student">
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <AlertCircle size={48} className="text-red-400 mb-4" />
                    <p className="text-red-400 font-bold mb-2">{error || 'No review data found.'}</p>
                    <p className="text-slate-500 text-sm font-bold mb-6">You may not have attempted this quiz yet.</p>
                    <button onClick={() => navigate('/assessments')} className="text-[#ff6b00] font-black underline text-sm uppercase tracking-widest">
                        Back to Assessments
                    </button>
                </div>
            </DashboardLayout>
        );
    }

    const answers = Array.isArray(data.answers) ? data.answers : [];
    const questions = Array.isArray(data.questions) ? data.questions : [];
    const totalPossible = questions.reduce((s, q) => s + (q.points || 10), 0);
    const correctCount = answers.filter(a => a.isCorrect).length;
    const wrongCount = answers.filter(a => !a.isCorrect && a.selectedOption).length;
    const skippedCount = answers.filter(a => !a.selectedOption).length;
    const score = data.score || 0;
    const pct = totalPossible > 0 ? Math.round((score / totalPossible) * 100) : 0;

    const scoreColor = pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400';
    const scoreRing = pct >= 80 ? 'ring-green-500/30' : pct >= 50 ? 'ring-yellow-500/30' : 'ring-red-500/30';

    const completedAt = data.completedAt ? new Date(data.completedAt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '';

    return (
        <DashboardLayout role="student">
            <div className="max-w-3xl mx-auto pb-20 space-y-10">
                {/* Back button */}
                <button
                    onClick={() => navigate('/assessments')}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border-2 border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--bg-accent)] font-black text-xs uppercase tracking-widest transition-all shadow-sm"
                    style={{ color: '#0f172a' }}
                >
                    <ArrowLeft size={16} /> Back to Assessments
                </button>

                {/* Score summary */}
                <div className="bg-white/5 border border-white/10 rounded-[3rem] p-10 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#ff6b00]/5 rounded-full blur-[80px] pointer-events-none" />
                    <Trophy className="mx-auto mb-4 text-yellow-400" size={48} strokeWidth={1.5} />
                    <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-1">{data.quizTitle}</h1>
                    {completedAt && <p className="text-xs text-slate-500 font-bold mb-8">Attempted on {completedAt}</p>}

                    <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full ring-8 ${scoreRing} bg-white/5 mb-6`}>
                        <span className={`text-4xl font-black italic ${scoreColor}`}>{pct}%</span>
                    </div>

                    <p className="text-slate-300 font-bold mb-8">
                        Score: <span className="text-white font-black">{score}</span> / <span className="text-white font-black">{totalPossible}</span> pts
                    </p>

                    <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-8">
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

                    <button
                        onClick={() => navigate(`/quiz/attempt/${id}`)}
                        className="inline-flex items-center gap-3 bg-[#ff6b00] text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#ff8533] active:scale-95 transition-all shadow-lg shadow-[#ff6b00]/20"
                    >
                        <RotateCcw size={18} /> Attempt Again
                    </button>
                </div>

                {/* Detailed Q&A Review */}
                <div>
                    <h2 className="text-xl font-black text-white italic uppercase tracking-tight mb-6 flex items-center gap-3">
                        <BookOpen size={22} className="text-[#ff6b00]" />
                        Question-by-Question Review
                    </h2>
                    <div className="space-y-4">
                        {questions.map((q, i) => (
                            <ReviewCard key={i} question={q} answer={answers[i] || {}} index={i} />
                        ))}
                        {questions.length === 0 && (
                            <p className="text-slate-500 text-center font-bold py-10">No question details available.</p>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
