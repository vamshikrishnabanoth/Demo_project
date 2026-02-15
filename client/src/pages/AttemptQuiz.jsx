import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import socket from '../utils/socket';
import { Loader2, CheckCircle, ChevronRight, ChevronLeft, Send, Home, XCircle, Award, Clock, Trophy, Bell } from 'lucide-react';

export default function AttemptQuiz() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [timeLeft, setTimeLeft] = useState(30);
    const [newQuestionNotification, setNewQuestionNotification] = useState(null);
    const [showNewQuestionModal, setShowNewQuestionModal] = useState(false);
    const [showIntermediateLeaderboard, setShowIntermediateLeaderboard] = useState(false);
    const [currentLeaderboard, setCurrentLeaderboard] = useState([]);

    // Timer Logic
    useEffect(() => {
        if (loading || isReviewMode || result || !quiz) return;

        const timerId = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerId);
                    handleTimeUp();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timerId);
    }, [loading, isReviewMode, result, quiz, currentQuestion]);

    const handleTimeUp = () => {
        // For live quizzes, auto-submit answer and show leaderboard
        if (quiz?.isLive) {
            handleAutoSubmitAnswer();
        } else {
            // For non-live quizzes, just move to next question
            if (currentQuestion < quiz.questions.length - 1) {
                setCurrentQuestion(prev => prev + 1);
                setTimeLeft(quiz.timerPerQuestion || 30);
            } else {
                submitQuiz();
            }
        }
    };

    const handleAutoSubmitAnswer = async () => {
        // Auto-submit current answer when timer expires
        const currentAnswer = answers[currentQuestion] || '';

        if (quiz.isLive) {
            // For live quiz, emit socket event and show leaderboard
            const token = localStorage.getItem('token');
            const userId = JSON.parse(atob(token.split('.')[1])).user.id;

            socket.emit('submit_question_answer', {
                quizId: id,
                studentId: userId,
                questionIndex: currentQuestion,
                answer: currentAnswer,
                timeRemaining: 0
            });

            // Show intermediate leaderboard
            setShowIntermediateLeaderboard(true);
        }
    };

    const handleContinueToNext = () => {
        setShowIntermediateLeaderboard(false);

        if (currentQuestion < quiz.questions.length - 1) {
            setCurrentQuestion(prev => prev + 1);
            setTimeLeft(quiz.timerPerQuestion || 30);
        } else {
            // Last question - navigate to final leaderboard
            navigate(`/leaderboard/${id}`);
        }
    };

    useEffect(() => {
        if (quiz && !isReviewMode) {
            setTimeLeft(quiz.timerPerQuestion || 30);
        }
    }, [currentQuestion, quiz, isReviewMode]);

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const res = await api.get(`/quiz/${id}`);
                setQuiz(res.data);

                // If there's a previous result, enter Review Mode
                if (res.data.previousResult) {
                    setIsReviewMode(true);
                    setResult(res.data.previousResult);

                    // Map previous answers to state
                    const prevAnswers = {};
                    res.data.previousResult.answers.forEach((ans, idx) => {
                        prevAnswers[idx] = ans.selectedOption;
                    });
                    setAnswers(prevAnswers);
                }
            } catch (err) {
                console.error('Error fetching quiz', err);
                alert('Quiz not found');
                navigate('/student-dashboard');
            } finally {
                setLoading(false);
            }
        };
        fetchQuiz();

        // Listen for new questions added by teacher
        socket.emit('join_room', { quizId: id, user: { username: 'student', role: 'student' } });

        socket.on('new_question_added', ({ question, questionIndex, totalQuestions }) => {
            console.log('New question received:', question);
            setNewQuestionNotification({ question, questionIndex, totalQuestions });
            setShowNewQuestionModal(true);

            // Update quiz with new question
            setQuiz(prev => ({
                ...prev,
                questions: [...prev.questions, question]
            }));
        });

        // Listen for intermediate leaderboard after each question
        socket.on('question_leaderboard', ({ questionIndex, leaderboard }) => {
            console.log('Leaderboard received for question', questionIndex, leaderboard);
            setCurrentLeaderboard(leaderboard);
        });

        return () => {
            socket.off('new_question_added');
            socket.off('question_leaderboard');
        };
    }, [id, navigate]);

    const handleOptionSelect = (option) => {
        if (isReviewMode) return; // Prevent selection in review mode
        setAnswers({
            ...answers,
            [currentQuestion]: option
        });
    };

    const submitQuiz = async () => {
        if (submitting || isReviewMode) return;
        setSubmitting(true);
        try {
            const formattedAnswers = quiz.questions.map((q, idx) => ({
                questionText: q.questionText,
                selectedOption: answers[idx] || ''
            }));

            const res = await api.post('/quiz/submit', {
                quizId: id,
                answers: formattedAnswers
            });

            setResult(res.data);
        } catch (err) {
            console.error('Error submitting quiz', err);
            // Handle "already attempted" gracefully
            if (err.response?.status === 400 && err.response?.data?.msg === 'Quiz already attempted') {
                window.location.reload(); // Refresh to catch the result in useEffect
            } else {
                alert('Submission failed. Please check your connection.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
        </div>
    );

    // Only show result summary immediately after submission, NOT in review mode
    // In review mode we want to walk through questions
    if (result && !isReviewMode) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={48} />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Quiz Completed!</h1>
                <p className="text-gray-500 mb-8">Great job finishing the quiz. Here are your results:</p>

                <div className="bg-indigo-50 rounded-2xl p-6 mb-8">
                    <p className="text-sm text-indigo-600 font-bold uppercase tracking-wider mb-1">Your Score</p>
                    <div className="text-5xl font-black text-indigo-900">
                        {result.score} <span className="text-xl text-indigo-400 font-medium">/ {result.totalQuestions * 10}</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => navigate(`/leaderboard/${id}`)}
                        className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                    >
                        <Trophy size={20} /> View Leaderboard
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => navigate('/student-dashboard')}
                            className="bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                        >
                            <Home size={18} /> Home
                        </button>
                        <button
                            onClick={() => setIsReviewMode(true)}
                            className="bg-indigo-50 text-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                        >
                            Review
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const question = quiz.questions[currentQuestion];
    const isLastQuestion = currentQuestion === quiz.questions.length - 1;

    // Get result data for current question if in review mode
    const questionResult = isReviewMode && result
        ? result.answers.find(a => a.questionText === question.questionText)
        : null;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/student-dashboard')}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h2 className="font-bold text-gray-900">{quiz.title}</h2>
                        <p className="text-xs text-gray-500">{currentQuestion + 1} of {quiz.questions.length} Questions {isReviewMode && '• Review Mode'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {!isReviewMode && !result && (
                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-black transition-all ${timeLeft <= 5 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-orange-100 text-orange-600'
                            }`}>
                            <Clock size={18} />
                            <span className="font-mono text-lg">{timeLeft}s</span>
                        </div>
                    )}
                    {isReviewMode && (
                        <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                            Score: {result.score} / {result.totalQuestions * 10}
                        </div>
                    )}
                    <div className="w-48 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 ${isReviewMode ? 'bg-indigo-600' : 'bg-indigo-600'}`}
                            style={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
                        />
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-6 pb-24">
                <div className="max-w-2xl w-full">
                    {isReviewMode && (
                        <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 border ${questionResult?.isCorrect
                            ? 'bg-green-50 border-green-100 text-green-700'
                            : 'bg-red-50 border-red-100 text-red-700'
                            }`}>
                            {questionResult?.isCorrect ? <CheckCircle size={20} /> : <XCircle size={20} />}
                            <div className="flex-1">
                                <p className="text-sm font-bold">
                                    {questionResult?.isCorrect ? 'Correct Answer!' : 'Incorrect Answer'}
                                </p>
                                <p className="text-xs opacity-80">
                                    Marks Awarded: {questionResult?.isCorrect ? question.points : 0} / {question.points}
                                </p>
                            </div>
                            <Award size={24} className="opacity-20" />
                        </div>
                    )}

                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12 mb-8">
                        <span className="inline-block bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-6">
                            Question {currentQuestion + 1}
                        </span>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 leading-tight">
                            {question.questionText}
                        </h1>

                        <div className="space-y-4">
                            {question.options.map((option, idx) => {
                                const isSelected = answers[currentQuestion] === option;
                                const isCorrect = questionResult?.correctOption === option;

                                let containerClass = 'border-gray-100 text-gray-700 hover:border-indigo-200 hover:bg-gray-50';
                                if (isReviewMode) {
                                    if (isCorrect) containerClass = 'border-green-500 bg-green-50 text-green-900';
                                    else if (isSelected && !isCorrect) containerClass = 'border-red-500 bg-red-50 text-red-900';
                                    else containerClass = 'border-gray-100 text-gray-400 opacity-60';
                                } else if (isSelected) {
                                    containerClass = 'border-indigo-600 bg-indigo-50 text-indigo-900';
                                }

                                return (
                                    <button
                                        key={idx}
                                        disabled={isReviewMode}
                                        onClick={() => handleOptionSelect(option)}
                                        className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center justify-between group ${containerClass}`}
                                    >
                                        <span className="font-medium">{option}</span>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isReviewMode
                                            ? (isCorrect ? 'border-green-500 bg-green-500 text-white' : (isSelected ? 'border-red-500 bg-red-500 text-white' : 'border-gray-200'))
                                            : (isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 group-hover:border-indigo-300')
                                            }`}>
                                            {isSelected && isReviewMode && !isCorrect && <XCircle size={14} />}
                                            {(isSelected || (isReviewMode && isCorrect)) && (isReviewMode ? isCorrect : isSelected) && <CheckCircle size={14} />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {isReviewMode && !questionResult?.isCorrect && (
                            <div className="mt-6 p-4 bg-green-50 rounded-xl flex items-center gap-3 text-green-800 border border-green-100">
                                <CheckCircle size={18} />
                                <p className="text-xs font-bold">The correct answer was: <span className="underline">{questionResult?.correctOption}</span></p>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between w-full">
                        <button
                            onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                            disabled={currentQuestion === 0 || quiz?.isLive}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-gray-500 hover:text-gray-900 disabled:opacity-30 transition-all"
                        >
                            <ChevronLeft size={20} /> Previous
                        </button>

                        {isLastQuestion ? (
                            isReviewMode ? (
                                <button
                                    onClick={() => navigate('/student-dashboard')}
                                    className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all"
                                >
                                    <Home size={20} /> Finish Review
                                </button>
                            ) : (
                                <button
                                    onClick={submitQuiz}
                                    disabled={submitting}
                                    className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                                    {submitting ? 'Submitting...' : 'Finish Quiz'}
                                </button>
                            )
                        ) : (
                            <button
                                onClick={() => setCurrentQuestion(prev => prev + 1)}
                                disabled={quiz?.isLive}
                                className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                            >
                                Next <ChevronRight size={20} />
                            </button>
                        )}
                    </div>
                </div>
            </main>

            {/* New Question Modal */}
            {showNewQuestionModal && newQuestionNotification && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 animate-in fade-in zoom-in duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                                <Bell className="text-indigo-600" size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-gray-900">New Question Added!</h2>
                                <p className="text-sm text-gray-500">Your teacher added a bonus question</p>
                            </div>
                        </div>

                        <div className="bg-indigo-50 rounded-2xl p-6 mb-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">{newQuestionNotification.question.questionText}</h3>
                            <div className="space-y-3">
                                {newQuestionNotification.question.options.map((option, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            const token = localStorage.getItem('token');
                                            const userId = JSON.parse(atob(token.split('.')[1])).user.id;

                                            socket.emit('submit_new_question', {
                                                quizId: id,
                                                studentId: userId,
                                                questionIndex: newQuestionNotification.questionIndex,
                                                answer: option
                                            });

                                            setShowNewQuestionModal(false);
                                            alert(`Answer submitted: ${option}`);
                                        }}
                                        className="w-full text-left p-4 rounded-xl border-2 border-indigo-200 hover:border-indigo-600 hover:bg-indigo-50 transition-all font-medium text-gray-700"
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => setShowNewQuestionModal(false)}
                            className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all"
                        >
                            Skip This Question
                        </button>
                    </div>
                </div>
            )}

            {/* Intermediate Leaderboard Modal */}
            {showIntermediateLeaderboard && currentLeaderboard.length > 0 && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 animate-in fade-in zoom-in duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                                <Trophy className="text-indigo-600" size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-gray-900">Question {currentQuestion + 1} Leaderboard</h2>
                                <p className="text-sm text-gray-500">Current standings after this question</p>
                            </div>
                        </div>

                        <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                            {currentLeaderboard.map((student) => (
                                <div key={student.studentId} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${student.rank === 1 ? 'bg-yellow-500' :
                                            student.rank === 2 ? 'bg-gray-400' :
                                                student.rank === 3 ? 'bg-orange-600' :
                                                    'bg-indigo-600'
                                            }`}>
                                            {student.rank}
                                        </div>
                                        <span className="font-bold text-gray-900">{student.username}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-gray-500">{student.answeredQuestions} answered</span>
                                        <div className="text-xl font-black text-indigo-600">
                                            {student.currentScore} pts
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleContinueToNext}
                            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                        >
                            {currentQuestion < quiz.questions.length - 1 ? (
                                <>Continue to Next Question <ChevronRight size={20} /></>
                            ) : (
                                <>View Final Results <Trophy size={20} /></>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
