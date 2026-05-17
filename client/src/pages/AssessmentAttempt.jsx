import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import {
    ChevronRight, CheckCircle, XCircle, Trophy, RotateCcw,
    BookOpen, Loader2, AlertCircle, ArrowLeft, Timer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { showConfirm, showSuccess, showError } from '../utils/alerts';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ─── Score Ring Component ─────────────────────────────────────────────────────
const ScoreRing = ({ pct, color }) => {
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    return (
        <div className="relative inline-flex items-center justify-center">
            <svg className="w-48 h-48 -rotate-90">
                <circle cx="96" cy="96" r={radius} fill="transparent" stroke="currentColor" strokeWidth="12" className="text-white/5" />
                <motion.circle
                    cx="96" cy="96" r={radius}
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: circumference - (pct / 100) * circumference }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className={color}
                    strokeLinecap="round"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className={`text-5xl font-black italic ${color}`}
                >
                    {pct}%
                </motion.span>
            </div>
        </div>
    );
};

// ─── Timer Bar Component ──────────────────────────────────────────────────────
const TimerBar = ({ duration, onTimeUp, active }) => {
    const [timeLeft, setTimeLeft] = useState(duration);
    const progress = (timeLeft / duration) * 100;

    useEffect(() => {
        if (!active) return;
        if (timeLeft <= 0) {
            onTimeUp();
            return;
        }
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, active, onTimeUp]);

    const barColor = progress > 50 ? 'bg-green-500' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-8">
            <motion.div 
                initial={{ width: '100%' }}
                animate={{ width: `${progress}%` }}
                className={`h-full ${barColor} transition-colors duration-500`}
            />
        </div>
    );
};

export default function AssessmentAttempt() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentIdx, setCurrentIdx] = useState(0);
    const [selected, setSelected] = useState(null);
    const [answers, setAnswers] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [phase, setPhase] = useState('quiz');
    const [isShowingFeedback, setIsShowingFeedback] = useState(false);
    const [feedbackResult, setFeedbackResult] = useState(null); // { isCorrect: bool }

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
        setIsShowingFeedback(false);
    }, []);

    const handleSelect = (option) => {
        if (isShowingFeedback) return;
        setSelected(option);
    };

    const triggerConfetti = () => {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#D7AC28', '#ffffff', '#B371E0']
        });
    };

    const questionStartTime = useRef(Date.now());

    useEffect(() => {
        questionStartTime.current = Date.now();
    }, [currentIdx]);

    const handleNext = async () => {
        if (!quiz || isShowingFeedback) return;
        const currentQ = quiz.questions[currentIdx];
        const correctOption = currentQ.correctAnswer || '';
        const selectedOption = selected || '';
        const isCorrect = selectedOption.toLowerCase() === correctOption.toLowerCase();
        
        // Calculate time spent on this question
        const timeTaken = Math.round((Date.now() - questionStartTime.current) / 1000);

        setFeedbackResult({ isCorrect });
        setIsShowingFeedback(true);

        // Feedback Delay
        setTimeout(async () => {
            const newAnswer = { 
                selectedOption, 
                correctOption, 
                isCorrect, 
                questionText: currentQ.questionText,
                timeTaken: timeTaken // TRACKED TIME
            };
            const updatedAnswers = [...answers, newAnswer];
            setAnswers(updatedAnswers);
            setIsShowingFeedback(false);
            setSelected(null);

            const isLast = currentIdx === quiz.questions.length - 1;

            if (isLast) {
                setSubmitting(true);
                try {
                    const totalPoints = quiz.questions.reduce((s, q) => s + (q.points || 10), 0);
                    const score = updatedAnswers.reduce((s, a, i) => s + (a.isCorrect ? (quiz.questions[i]?.points || 10) : 0), 0);
                    const pct = Math.round((score / totalPoints) * 100);
                    
                    if (pct >= 60) triggerConfetti();

                    const payload = {
                        quizId: id,
                        answers: updatedAnswers.map(a => ({ 
                            selectedOption: a.selectedOption,
                            timeTaken: a.timeTaken // SEND TIMING DATA
                        }))
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
            }
        }, 1200); // 1.2s feedback animation time
    };

    if (loading) return (
        <DashboardLayout role="student">
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 size={48} className="animate-spin text-[var(--text-accent)] mb-4" />
                <p className="text-white/30 font-bold uppercase tracking-widest text-xs">Entering Arena...</p>
            </div>
        </DashboardLayout>
    );

    if (error || !quiz) return (
        <DashboardLayout role="student">
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <AlertCircle size={48} className="text-red-400 mb-4" />
                <p className="text-red-400 font-bold">{error || 'Quiz not found.'}</p>
                <button onClick={() => navigate('/assessments')} className="mt-6 bg-white/5 border border-white/10 px-6 py-3 rounded-xl text-white font-black text-xs uppercase tracking-widest btn-press">
                    Exit Arena
                </button>
            </div>
        </DashboardLayout>
    );

    if (phase === 'results') {
        const totalPossible = quiz.questions.reduce((s, q) => s + (q.points || 10), 0);
        const score = answers.reduce((s, a, i) => s + (a.isCorrect ? (quiz.questions[i]?.points || 10) : 0), 0);
        const pct = Math.round((score / totalPossible) * 100);
        const scoreColor = pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-[var(--text-accent)]' : 'text-red-400';

        return (
            <DashboardLayout role="student">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-3xl mx-auto py-12 px-6 text-center"
                >
                    <div className="bg-white/[0.02] border border-white/10 rounded-[3rem] p-12 mb-10">
                        <Trophy className="mx-auto mb-6 text-[var(--text-accent)]" size={56} />
                        <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter mb-2">Final Verdict</h2>
                        <p className="text-white/40 font-bold mb-10 uppercase tracking-widest text-xs">{quiz.title}</p>
                        
                        <ScoreRing pct={pct} color={scoreColor} />

                        <p className="text-white/60 font-bold mt-10 mb-8">
                            You earned <span className="text-white font-black text-xl">{score}</span> / {totalPossible} energy points
                        </p>

                        <div className="flex items-center justify-center gap-4">
                            <button onClick={resetQuiz} className="bg-[var(--bg-accent)] text-[var(--text-on-accent)] px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest btn-press btn-hover-scale shadow-lg">
                                Re-Enter Arena
                            </button>
                            <button onClick={() => navigate('/assessments')} className="bg-white/5 border border-white/10 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest btn-press">
                                Exit Arena
                            </button>
                        </div>
                    </div>
                </motion.div>
            </DashboardLayout>
        );
    }

    const currentQ = quiz.questions[currentIdx];
    const progress = ((currentIdx) / quiz.questions.length) * 100;
    const isLast = currentIdx === quiz.questions.length - 1;

    return (
        <DashboardLayout role="student">
            <div className="max-w-2xl mx-auto py-12 px-6">
                {/* Header */}
                <div className="mb-10">
                    <button
                        onClick={async () => {
                            const res = await showConfirm('Abort Quiz?', 'Progress will be lost. Are you sure?');
                            if (res.isConfirmed) navigate('/assessments');
                        }}
                        className="flex items-center gap-2 text-white/30 hover:text-white font-black text-[10px] uppercase tracking-[0.2em] mb-8 transition-colors btn-press"
                    >
                        <ArrowLeft size={14} /> Abandon Challenge
                    </button>

                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
                            Challenge Phase {currentIdx + 1} / {quiz.questions.length}
                        </p>
                        <div className="flex items-center gap-2 text-[var(--text-accent)]">
                            <Timer size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Arena Timer</span>
                        </div>
                    </div>

                    <TimerBar duration={30} onTimeUp={handleNext} active={!isShowingFeedback} key={currentIdx} />
                </div>

                {/* Question Area */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIdx}
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -20, opacity: 0 }}
                        className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-10 mb-8 shadow-2xl"
                    >
                        <div className="flex items-start gap-5 mb-10">
                            <div className="w-12 h-12 bg-[var(--bg-accent)] rounded-2xl flex items-center justify-center text-white font-black text-xl italic shrink-0 shadow-lg">
                                {currentIdx + 1}
                            </div>
                            <p className="text-white font-black text-2xl leading-tight italic uppercase tracking-tight">{currentQ.questionText}</p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {(currentQ.options || []).map((opt, oi) => {
                                const isSelected = selected === opt;
                                const isCorrectFeedback = isShowingFeedback && opt.toLowerCase() === currentQ.correctAnswer?.toLowerCase();
                                const isWrongFeedback = isShowingFeedback && isSelected && !feedbackResult?.isCorrect;

                                return (
                                    <motion.button
                                        key={oi}
                                        onClick={() => handleSelect(opt)}
                                        disabled={isShowingFeedback}
                                        animate={isWrongFeedback ? { x: [-5, 5, -5, 5, 0] } : isCorrectFeedback ? { scale: [1, 1.05, 1] } : {}}
                                        className={`flex items-center gap-5 px-6 py-5 rounded-2xl border-2 transition-all text-left relative overflow-hidden btn-press
                                            ${isCorrectFeedback ? 'border-[var(--success-bg)] bg-[var(--success-bg)]/10' : 
                                              isWrongFeedback ? 'border-[var(--error-bg)] bg-[var(--error-bg)]/10' : 
                                              isSelected ? 'border-[var(--bg-accent)] bg-[var(--bg-accent)]/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0 shadow-md
                                            ${isCorrectFeedback ? 'bg-[var(--success-bg)]' : isWrongFeedback ? 'bg-[var(--error-bg)]' : 'bg-white/10'}`}>
                                            {LETTERS[oi]}
                                        </div>
                                        <span className="font-bold text-white text-lg flex-1">{opt}</span>
                                        
                                        <AnimatePresence>
                                            {isCorrectFeedback && (
                                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-[var(--success-bg)]"><CheckCircle size={24} /></motion.div>
                                            )}
                                            {isWrongFeedback && (
                                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-[var(--error-bg)]"><XCircle size={24} /></motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </motion.div>
                </AnimatePresence>

                <button
                    onClick={handleNext}
                    disabled={!selected || submitting || isShowingFeedback}
                    className="w-full flex items-center justify-center gap-3 bg-[var(--bg-accent)] text-[var(--text-on-accent)] py-5 rounded-2xl font-black text-lg uppercase tracking-widest btn-press btn-hover-scale disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl"
                >
                    {submitting ? (
                        <Loader2 size={24} className="animate-spin" />
                    ) : (
                        <>
                            {isLast ? 'Complete Challenge' : 'Secure Choice'}
                            <ChevronRight size={24} />
                        </>
                    )}
                </button>
            </div>
        </DashboardLayout>
    );
}
