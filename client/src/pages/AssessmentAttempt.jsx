import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import {
    ChevronRight, CheckCircle, XCircle, Trophy, HelpCircle,
    Loader2, AlertCircle, ArrowLeft, Timer, Home, Send, Lock, ShieldAlert, Maximize
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { showConfirm } from '../utils/alerts';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import AdaptiveQuestionContainer from '../components/quiz/AdaptiveQuestionContainer';
import AuthContext from '../context/AuthContext';
import useExamProctoring from '../hooks/useExamProctoring';


const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ─── Timer Bar Component ──────────────────────────────────────────────────────
const TimerBar = ({ duration, onTimeUp, active }) => {
    const [timeLeft, setTimeLeft] = useState(duration);
    const progress = (timeLeft / duration) * 100;

    useEffect(() => {
        setTimeLeft(duration);
    }, [duration]);

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

    const questionStartTime = useRef(Date.now());

    // Auth context for proctoring userId
    const { user: authUser } = useContext(AuthContext);

    // Exam Integrity — strict fullscreen, tab-switch limit (max 2), focus loss monitoring, resize heuristic
    const handleAutoSubmit = useCallback((reason) => {
        toast.error(`Exam Auto-Submitted: ${reason}. Navigating to report...`, { duration: 4000 });
        handleFinalSubmit();
        setTimeout(() => {
            navigate(`/report/${id}`);
        }, 1000);
    }, [id, handleFinalSubmit, navigate]);

    const { isFullscreen, requestFullscreenMode, isTerminated } = useExamProctoring({
        enabled: !loading && !submitting && !isTerminated && !!quiz,
        quizId: id,
        userId: authUser?.id,
        maxTabSwitches: 2,
        onAutoSubmit: handleAutoSubmit
    });

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const res = await api.get(`/quiz/${id}`);
                setQuiz(res.data);
                // Initialize answers array matching question count
                setAnswers(new Array(res.data.questions.length).fill(null));
            } catch (err) {
                setError(err.response?.data?.msg || 'Failed to load quiz.');
            } finally {
                setLoading(false);
            }
        };
        fetchQuiz();
    }, [id]);

    useEffect(() => {
        questionStartTime.current = Date.now();
    }, [currentIdx]);

    const handleSelect = (option) => {
        // Prevent selection changes if answer is already finalized in normal quizzes
        if (!quiz?.isAssessment && answers[currentIdx]?.finalized) return;
        
        setSelected(option);

        // If it is a practice assignment, save the selection immediately to local answers state
        // to ensure it isn't lost if they jump to another question using the navigation dots.
        if (quiz?.isAssessment) {
            const currentQ = quiz.questions[currentIdx];
            const timeTaken = Math.round((Date.now() - questionStartTime.current) / 1000);
            const newAnswers = [...answers];
            newAnswers[currentIdx] = {
                selectedOption: option,
                questionText: currentQ.questionText,
                timeTaken: (answers[currentIdx]?.timeTaken || 0) + timeTaken,
                finalized: false,
                skipped: false
            };
            setAnswers(newAnswers);
            questionStartTime.current = Date.now(); // reset start timer
        }
    };

    const triggerConfetti = () => {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#D7AC28', '#ffffff', '#B371E0']
        });
    };

    // Global Final Submission
    async function handleFinalSubmit(currentAnswersList = answers) {
        setSubmitting(true);
        try {
            // Map answers strictly to what the server expects: { selectedOption, timeTaken }
            const payloadAnswers = quiz.questions.map((q, idx) => {
                const ans = currentAnswersList[idx];
                return {
                    selectedOption: ans ? ans.selectedOption : '',
                    timeTaken: ans ? ans.timeTaken : 0
                };
            });

            const res = await api.post('/quiz/submit', {
                quizId: id,
                answers: payloadAnswers
            });

            toast.success('Campaign Concluded! Generating tactical report...');
            triggerConfetti();
            setTimeout(() => {
                navigate(`/report/${id}`, { state: { reportData: res.data } });
            }, 1500);
        } catch (err) {
            console.error('Submit error:', err);
            toast.error('Submission failed. Please check your connection.');
        } finally {
            setSubmitting(false);
        }
    };

    // Secure choice & lock answer permanently in live, or Save & Advance in practice assignments
    const handleNext = async () => {
        if (!quiz) return;
        
        const currentQ = quiz.questions[currentIdx];
        const timeTaken = Math.round((Date.now() - questionStartTime.current) / 1000);
        
        const newAnswer = {
            selectedOption: selected || (answers[currentIdx]?.selectedOption || ''),
            questionText: currentQ.questionText,
            timeTaken: (answers[currentIdx]?.timeTaken || 0) + timeTaken,
            finalized: quiz.isAssessment ? false : true,
            skipped: false
        };

        const newAnswers = [...answers];
        newAnswers[currentIdx] = newAnswer;
        setAnswers(newAnswers);
        setSelected(null);

        if (quiz.isAssessment) {
            // Self-paced assignments simply advance, wrapping around
            const nextIdx = (currentIdx + 1) % quiz.questions.length;
            setCurrentIdx(nextIdx);
            setSelected(newAnswers[nextIdx]?.selectedOption || null);
            toast.success("Progress Saved!");
            return;
        }

        // Find next unattempted or skipped question index
        let nextIdx = -1;
        for (let i = currentIdx + 1; i < quiz.questions.length; i++) {
            if (newAnswers[i] === null || newAnswers[i].skipped) {
                nextIdx = i;
                break;
            }
        }
        
        // Wrap around from beginning if not found
        if (nextIdx === -1) {
            for (let i = 0; i < currentIdx; i++) {
                if (newAnswers[i] === null || newAnswers[i].skipped) {
                    nextIdx = i;
                    break;
                }
            }
        }

        if (nextIdx !== -1) {
            setCurrentIdx(nextIdx);
            setSelected(newAnswers[nextIdx]?.selectedOption || null);
            toast.success("Choice Secured & Locked!");
        } else {
            // All questions finalized! Auto-submit
            await handleFinalSubmit(newAnswers);
        }
    };

    // Go to previous question (only active in practice assessments)
    const handlePrevious = () => {
        if (!quiz) return;

        const currentQ = quiz.questions[currentIdx];
        const timeTaken = Math.round((Date.now() - questionStartTime.current) / 1000);

        const newAnswer = {
            selectedOption: selected || (answers[currentIdx]?.selectedOption || ''),
            questionText: currentQ.questionText,
            timeTaken: (answers[currentIdx]?.timeTaken || 0) + timeTaken,
            finalized: false,
            skipped: !selected && (!answers[currentIdx] || answers[currentIdx].skipped)
        };

        const newAnswers = [...answers];
        newAnswers[currentIdx] = newAnswer;
        setAnswers(newAnswers);
        setSelected(null);

        const prevIdx = (currentIdx - 1 + quiz.questions.length) % quiz.questions.length;
        setCurrentIdx(prevIdx);
        setSelected(newAnswers[prevIdx]?.selectedOption || null);
    };

    // Skip the current question (marks as skipped, allows later revisit)
    const handleSkip = () => {
        if (!quiz) return;
        
        const currentQ = quiz.questions[currentIdx];
        const timeTaken = Math.round((Date.now() - questionStartTime.current) / 1000);
        
        const skippedAnswer = {
            selectedOption: selected || (answers[currentIdx]?.selectedOption || ''),
            questionText: currentQ.questionText,
            timeTaken: (answers[currentIdx]?.timeTaken || 0) + timeTaken,
            finalized: false,
            skipped: true
        };

        const newAnswers = [...answers];
        newAnswers[currentIdx] = skippedAnswer;
        setAnswers(newAnswers);
        setSelected(null);

        // Find next unanswered or skipped question index
        let nextIdx = -1;
        for (let i = currentIdx + 1; i < quiz.questions.length; i++) {
            if (newAnswers[i] === null || newAnswers[i].skipped) {
                nextIdx = i;
                break;
            }
        }
        if (nextIdx === -1) {
            for (let i = 0; i < currentIdx; i++) {
                if (newAnswers[i] === null || newAnswers[i].skipped) {
                    nextIdx = i;
                    break;
                }
            }
        }

        if (nextIdx !== -1) {
            setCurrentIdx(nextIdx);
            setSelected(newAnswers[nextIdx]?.selectedOption || null);
            toast.success("Question Skipped!");
        } else {
            toast.success("Question Skipped! You can revisit it using the navigation dots.");
        }
    };

    // Handle timer expiration
    const handleTimeUp = () => {
        if (quiz.timerType === 'totalTime') {
            toast.error("Arena time expired! Transmitting results...");
            handleFinalSubmit();
        } else {
            toast.error("Question time expired! Auto-skipping.");
            handleSkip();
        }
    };

    // Manual Submit Button handler (Confirm with user if they have remaining skips)
    const handleManualSubmitAttempt = async () => {
        const skippedCount = answers.filter(a => a && a.skipped).length;
        const unattemptedCount = answers.filter(a => a === null).length;
        const totalPending = skippedCount + unattemptedCount;

        if (totalPending > 0) {
            const confirm = await showConfirm(
                'Submit Quiz?',
                `You have ${totalPending} unanswered/skipped question(s). Are you sure you want to finish now?`,
                'Submit'
            );
            if (!confirm.isConfirmed) return;
        }
        await handleFinalSubmit();
    };

    if (loading) return (
        <DashboardLayout role="student">
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 size={48} className="animate-spin text-[var(--text-accent)] mb-4" />
                <p className="text-[var(--text-secondary)] font-bold uppercase tracking-widest text-xs">Entering Arena...</p>
            </div>
        </DashboardLayout>
    );

    if (error || !quiz) return (
        <DashboardLayout role="student">
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <AlertCircle size={48} className="text-red-500 mb-4" />
                <p className="text-red-600 font-bold">{error || 'Quiz not found.'}</p>
                <button onClick={() => navigate('/assessments')} className="mt-6 bg-[var(--bg-primary)] border border-[var(--border-color)] px-6 py-3 rounded-xl text-[var(--text-primary)] font-black text-xs uppercase tracking-widest btn-press">
                    Exit Arena
                </button>
            </div>
        </DashboardLayout>
    );

    const currentQ = quiz.questions[currentIdx];
    const finalizedCount = answers.filter(a => a && a.finalized).length;
    const skippedCount = answers.filter(a => a && a.skipped).length;
    const isQuestionFinalized = answers[currentIdx]?.finalized;

    // Timer calculation logic
    let maxRemaining = Infinity;
    if (quiz.endTime) {
        maxRemaining = Math.max(0, Math.floor((new Date(quiz.endTime).getTime() - Date.now()) / 1000));
    }
    
    let timerDuration = 30;
    let timerKey = currentIdx;
    
    if (quiz.timerType === 'totalTime') {
        const totalDuration = (quiz.duration || 10) * 60;
        timerDuration = Math.min(totalDuration, maxRemaining);
        timerKey = 'global-timer';
    } else {
        const pqTime = quiz.timerPerQuestion || 30;
        timerDuration = Math.min(pqTime, maxRemaining);
        timerKey = currentIdx;
    }

    return (
        <DashboardLayout role="student">
            <div className="max-w-3xl mx-auto py-10 px-6">
                {/* Top Action Row */}
                <div className="mb-8 flex items-center justify-between">
                    <button
                        onClick={async () => {
                            const res = await showConfirm('Abandon Challenge?', 'All active attempt progress will be lost. Are you sure?');
                            if (res.isConfirmed) navigate('/assessments');
                        }}
                        className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-black text-[10px] uppercase tracking-[0.2em] transition-colors btn-press"
                    >
                        <ArrowLeft size={14} /> Abandon Challenge
                    </button>
                    <button
                        onClick={handleExit}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[var(--text-accent)] hover:text-[#334155] text-xs font-black uppercase tracking-widest transition-all"
                    >
                        <Home size={14} /> Go to Home
                    </button>
                </div>

                {/* Progress Details Bar */}
                <div className="bg-[var(--bg-secondary)] rounded-[2rem] border border-[var(--border-color)] p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-xl text-center">
                            <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Locked</p>
                            <p className="text-lg font-black text-[var(--text-primary)]">{finalizedCount} / {quiz.questions.length}</p>
                        </div>
                        <div className="bg-yellow-500/10 border border-yellow-500/20 px-4 py-2 rounded-xl text-center">
                            <p className="text-[9px] font-black text-yellow-600 uppercase tracking-widest">Skipped</p>
                            <p className="text-lg font-black text-[var(--text-primary)]">{skippedCount}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-[var(--text-accent)] self-center">
                        <Timer size={16} />
                        <span className="text-[10px] font-black uppercase tracking-[0.25em]">Arena Timer</span>
                    </div>
                </div>

                <TimerBar duration={timerDuration} onTimeUp={handleTimeUp} active={!submitting} key={timerKey} />

                {/* Navigation Dots Map */}
                <div className="flex items-center justify-center gap-2 flex-wrap mb-8 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2rem] p-6">
                    {quiz.questions.map((_, idx) => {
                        const ans = answers[idx];
                        const isCurrent = idx === currentIdx;
                        const isFinalized = ans && ans.finalized;
                        const isSkipped = ans && ans.skipped;

                        // Clickability criteria: Must not be finalized, and must have reached it sequential.
                        const firstUnreachedIdx = answers.findIndex(a => a === null);
                        const isReachable = quiz.isAssessment ? true : (idx <= (firstUnreachedIdx === -1 ? quiz.questions.length : firstUnreachedIdx));
                        const isLocked = quiz.isAssessment ? false : isFinalized;

                        let dotClass = "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs border transition-all ";
                        
                        if (isCurrent) {
                            dotClass += "bg-[var(--bg-accent)] text-white border-[var(--bg-accent)] ring-2 ring-[var(--bg-accent)] ring-offset-2 ring-offset-[var(--bg-secondary)] scale-110";
                        } else if (isFinalized) {
                            dotClass += "bg-green-500/10 border-green-500/30 text-green-400 cursor-not-allowed opacity-60";
                        } else if (quiz.isAssessment && ans && ans.selectedOption) {
                            dotClass += "bg-green-500/15 border-green-500/40 text-green-400 hover:bg-green-500/25 cursor-pointer";
                        } else if (isSkipped) {
                            dotClass += "bg-yellow-500/10 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20 cursor-pointer";
                        } else if (!isReachable) {
                            dotClass += "bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-secondary)] cursor-not-allowed opacity-40";
                        } else {
                            dotClass += "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)] cursor-pointer";
                        }

                        const handleClick = () => {
                            if (isLocked) {
                                toast.error("Answer is finalized and locked!");
                                return;
                            }
                            if (!isReachable) {
                                toast.error("Please answer or skip previous questions first!");
                                return;
                            }
                            
                            // Save current selection to Answers list if isAssessment
                            if (quiz.isAssessment) {
                                const currentQ = quiz.questions[currentIdx];
                                const timeTaken = Math.round((Date.now() - questionStartTime.current) / 1000);
                                const newAnswers = [...answers];
                                newAnswers[currentIdx] = {
                                    selectedOption: selected || (answers[currentIdx] ? answers[currentIdx].selectedOption : ''),
                                    questionText: currentQ.questionText,
                                    timeTaken: (answers[currentIdx]?.timeTaken || 0) + timeTaken,
                                    finalized: false,
                                    skipped: !selected && (!answers[currentIdx] || answers[currentIdx].skipped)
                                };
                                setAnswers(newAnswers);
                            }

                            setCurrentIdx(idx);
                            setSelected(answers[idx] ? answers[idx].selectedOption : null);
                        };

                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={handleClick}
                                disabled={isLocked || !isReachable}
                                className={dotClass}
                            >
                                {isFinalized ? <Lock size={12} className="mx-auto" /> : idx + 1}
                            </button>
                        );
                    })}
                </div>

                {/* Main Question Card */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIdx}
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -20, opacity: 0 }}
                        className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.5rem] p-8 md:p-12 mb-8 shadow-lg relative"
                    >
                        <div className="flex items-start gap-5 mb-10">
                            <div className="w-12 h-12 bg-[var(--bg-accent)] rounded-2xl flex items-center justify-center text-white font-black text-xl italic shrink-0 shadow-lg">
                                {currentIdx + 1}
                            </div>
                            <div>
                                <p className="text-[var(--text-secondary)] font-bold uppercase tracking-widest text-[9px] mb-1">Active Question</p>
                                <AdaptiveQuestionContainer questionText={currentQ.questionText} />
                            </div>
                        </div>

                        {/* Options Group or Text Input for Fill-in-the-blank */}
                        {(!currentQ.options || currentQ.options.length <= 1) ? (
                            <div className="space-y-4 mb-8">
                                <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Type Your Answer Below</label>
                                <input
                                    type="text"
                                    value={selected || ''}
                                    onChange={(e) => handleSelect(e.target.value)}
                                    disabled={isQuestionFinalized}
                                    placeholder="Enter short answer..."
                                    className="w-full p-6 bg-white border-2 border-[var(--border-color)] rounded-2xl focus:bg-[var(--bg-primary)] focus:border-[var(--bg-accent)] transition-all font-bold text-lg text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 outline-none input-cinematic"
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 mb-8">
                                {(currentQ.options || []).map((opt, oi) => {
                                    const isSelected = selected === opt;
                                    const isFinalizedOption = !quiz.isAssessment && isQuestionFinalized;
                                    return (
                                        <motion.button
                                            key={oi}
                                            onClick={() => handleSelect(opt)}
                                            disabled={isFinalizedOption}
                                            className={`flex items-center gap-5 px-6 py-5 rounded-2xl border-2 transition-all text-left relative h-auto btn-press
                                                ${isSelected ? 'border-[var(--bg-accent)] bg-[var(--bg-accent)]/10 text-[var(--text-primary)]' : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-[var(--text-primary)]'}
                                                ${isFinalizedOption ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-md
                                                ${isSelected ? 'bg-[var(--bg-accent)] text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-color)]'}`}>
                                                {LETTERS[oi]}
                                            </div>
                                            <span className="font-bold text-base flex-1 min-w-0 break-words whitespace-normal" style={{ color: '#1f2937' }}>{opt}</span>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Question Action Controls */}
                        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                            {quiz.isAssessment ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={handlePrevious}
                                        disabled={submitting || currentIdx === 0}
                                        className="w-full sm:w-auto bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[var(--bg-primary)] transition-all disabled:opacity-40"
                                    >
                                        Previous Question
                                    </button>
                                    <div className="flex gap-4 w-full sm:w-auto">
                                        <button
                                            type="button"
                                            onClick={handleSkip}
                                            disabled={submitting}
                                            className="flex-1 sm:flex-none bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[var(--bg-primary)] transition-all"
                                        >
                                            Skip Question
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleNext}
                                            disabled={submitting || currentIdx === quiz.questions.length - 1}
                                            className="button flex-1 sm:flex-none disabled:opacity-40 disabled:pointer-events-none"
                                        >
                                            <span>Next Question</span>
                                            <svg viewBox="0 0 13 10">
                                                <polygon points="0.5 0 6.5 5 0.5 10"></polygon>
                                                <polygon points="4.5 0 10.5 5 4.5 10"></polygon>
                                                <polygon points="8.5 0 13 5 8.5 10"></polygon>
                                            </svg>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleSkip}
                                        disabled={submitting || isQuestionFinalized}
                                        className="w-full sm:w-auto bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[var(--bg-primary)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Skip & Proceed
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleNext}
                                        disabled={!selected || submitting || isQuestionFinalized}
                                        className="w-full sm:w-auto bg-[var(--bg-accent)] text-[var(--text-on-accent)] px-10 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-102 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 border-b-4 border-orange-700"
                                    >
                                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <>Lock & Advance <ChevronRight size={16} /></>}
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Final Submission Card */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.5rem] p-8 text-center shadow-lg">
                    <h3 className="text-xl font-black italic uppercase text-[var(--text-primary)] mb-2">Conclude Attempt</h3>
                    <p className="text-[var(--text-secondary)] text-xs font-bold uppercase tracking-widest mb-6">You can finalize and submit your responses at any point.</p>
                    <button
                        onClick={handleManualSubmitAttempt}
                        disabled={submitting}
                        className="bg-[var(--bg-accent)] text-white px-12 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[var(--bg-accent)]/10 flex items-center justify-center gap-3 mx-auto border-b-4 border-orange-700"
                    >
                        {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        Finalize Attempt
                    </button>
                </div>
            </div>

            {/* Strict Fullscreen Enforcement Modal Overlay */}
            {!isFullscreen && !loading && !submitting && (
                <div className="fixed inset-0 z-[10000] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-6 text-white text-center animate-in fade-in duration-300 min-h-[100dvh] w-full my-auto overflow-y-auto">
                    <div className="bg-slate-900 border-2 border-red-500/40 rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-12 max-w-lg w-full shadow-2xl shadow-red-500/20 space-y-6 animate-in zoom-in-95 duration-300 my-auto">
                        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-500 mx-auto border border-red-500/30">
                            <ShieldAlert size={44} className="animate-pulse" />
                        </div>
                        
                        <div className="space-y-2">
                            <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tight text-white">
                                Fullscreen Mode Required
                            </h2>
                            <p className="text-slate-400 font-bold text-xs leading-relaxed uppercase tracking-wider">
                                To maintain exam security and integrity, this examination must be taken in Fullscreen Mode only.
                            </p>
                        </div>

                        <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20 text-xs font-bold text-red-300 text-left space-y-2">
                            <p className="flex items-center gap-2"><span>⚠️</span> Exiting fullscreen mode records an integrity alert.</p>
                            <p className="flex items-center gap-2"><span>⚠️</span> Switching tabs 2 times auto-submits exam.</p>
                        </div>

                        <button
                            type="button"
                            onClick={requestFullscreenMode}
                            className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm uppercase tracking-widest py-5 px-8 rounded-2xl shadow-xl shadow-red-600/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer border-2 border-white/20"
                        >
                            <Maximize size={22} />
                            <span>Enter Fullscreen Mode</span>
                        </button>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
