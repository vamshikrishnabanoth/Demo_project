import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import socket, { ensureSocketConnected } from '../utils/socket';
import { Loader2, CheckCircle, ChevronRight, ChevronLeft, Send, Home, XCircle, Award, Clock, Trophy, Bell, Square, Circle, Triangle, Diamond, WifiOff, Lock, TrendingUp, ShieldAlert, Maximize, Crown, LogOut } from 'lucide-react';
import { cleanQuizTitle } from '../utils/cleanTitle';
import AuthContext from '../context/AuthContext';
import WaitingRoomLoader from '../components/loaders/WaitingRoomLoader';
import LiveQuizWaitAnimation from '../components/loaders/LiveQuizWaitAnimation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import SubmissionSequence from '../components/quiz/SubmissionSequence';
import AdaptiveQuestionContainer from '../components/quiz/AdaptiveQuestionContainer';
import { showError, showSuccess } from '../utils/alerts';
import useExamProctoring from '../hooks/useExamProctoring';
import throttle from '../utils/throttle';


export default function AttemptQuiz() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user: authUser, logout } = useContext(AuthContext);
    
    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (e) {
            navigate('/login');
        }
    };
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [timeLeft, setTimeLeft] = useState(30);
    const [isWaiting, _setIsWaiting] = useState(false); // New waiting state
    const [newQuestionNotification, setNewQuestionNotification] = useState(null);
    const [showNewQuestionModal, setShowNewQuestionModal] = useState(false);
    const [showIntermediateLeaderboard, setShowIntermediateLeaderboard] = useState(false);
    const [currentLeaderboard, setCurrentLeaderboard] = useState([]);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isCorrectFeedback, _setIsCorrectFeedback] = useState(false);
    const [answeredQuestions, setAnsweredQuestions] = useState(new Set()); // tracks submitted questions in live mode
    const [speedFeedback, setSpeedFeedback] = useState(null); // { isFast, message }
    const [showSubmitSequence, setShowSubmitSequence] = useState(false);
    const [finalRankResult, setFinalRankResult] = useState(null);
    const [loadingRankResult, setLoadingRankResult] = useState(false);
    const [showReconnectScreen, setShowReconnectScreen] = useState(false);
    const [reconnectState, setReconnectState] = useState("disconnected");
    const [offlineDuration, setOfflineDuration] = useState(0);
    const prevOnlineRef = useRef(navigator.onLine);

    useEffect(() => {
        if (!speedFeedback) return;
        const timer = setTimeout(() => {
            setSpeedFeedback(null);
        }, 4000);
        return () => clearTimeout(timer);
    }, [speedFeedback]);

    const hasInitializedTimer = useRef(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Dismiss all toasts on unmount so quiz-page toasts don't freeze on the next page
    useEffect(() => {
        return () => {
            toast.dismiss();
        };
    }, []);

    useEffect(() => {
        let timer;
        if (!isOnline) {
            setReconnectState("disconnected");
            setShowReconnectScreen(true);
            const startTime = Date.now();
            timer = setInterval(() => {
                setOfflineDuration(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        } else {
            if (prevOnlineRef.current === false) {
                setReconnectState("recovered");
                setTimeout(() => {
                    setShowReconnectScreen(false);
                    setOfflineDuration(0);
                }, 1500);
            } else {
                setShowReconnectScreen(false);
            }
        }
        prevOnlineRef.current = isOnline;
        return () => clearInterval(timer);
    }, [isOnline]);

    const [missionComplete, setMissionComplete] = useState(false);
    const [waitingForState, setWaitingForState] = useState(false);
    const quizRef = useRef(null);     // Always-current quiz for socket callbacks
    const authUserRef = useRef(null); // Always-current authUser for socket callbacks
    const currentQuestionRef = useRef(0);
    const targetEndTimeRef = useRef(null);
    
    const [lobbySummary, setLobbySummary] = useState('');
    const [totalStudents, setTotalStudents] = useState(0);
    const [answeredStudentsSet, setAnsweredStudentsSet] = useState(new Set());
    const answeredCount = answeredStudentsSet.size;

    // Keep refs in sync
    useEffect(() => { quizRef.current = quiz; }, [quiz]);
    useEffect(() => { authUserRef.current = authUser; }, [authUser]);
    useEffect(() => { currentQuestionRef.current = currentQuestion; }, [currentQuestion]);
    
    // Time Taken tracking system
    const [questionTimes, setQuestionTimes] = useState({});
    const questionStartRef = useRef(Date.now());
    const prevQuestionRef = useRef(0);

    useEffect(() => {
        if (loading || isReviewMode || result || !quiz) return;
        const prevQuestion = prevQuestionRef.current;
        const elapsed = Math.max(1, Math.round((Date.now() - questionStartRef.current) / 1000));
        
        setQuestionTimes(prev => ({
            ...prev,
            [prevQuestion]: (prev[prevQuestion] || 0) + elapsed
        }));

        prevQuestionRef.current = currentQuestion;
        questionStartRef.current = Date.now();
    }, [currentQuestion, loading, isReviewMode, result, quiz]);

    // Block browser back button for students during active quiz
    useEffect(() => {
        if (!quiz || isReviewMode || result) return;
        window.history.pushState(null, '', window.location.pathname);
        const handlePopState = () => {
            navigate('/');
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [quiz, isReviewMode, result, navigate]);

    // Heartbeat Emitter for Online Status Tracking
    useEffect(() => {
        if (!quiz || !authUser || isReviewMode || result) return;
        const heartbeatTimer = setInterval(() => {
            socket.emit('heartbeat', { quizId: id, userId: authUser.id });
        }, 5000);
        return () => clearInterval(heartbeatTimer);
    }, [quiz, authUser, id, isReviewMode, result]);
    // Listen for Teacher Events (timer sync, quiz end only — students navigate themselves)
    useEffect(() => {
        socket.on('timer_update', ({ additionalSeconds }) => {
            console.log('Teacher increased time by:', additionalSeconds);
            if (targetEndTimeRef.current) {
                targetEndTimeRef.current += (additionalSeconds * 1000);
            }
            setTimeLeft(prev => prev + additionalSeconds);
        });

        // When teacher starts the quiz, update the quiz status in local state so
        // the proctoring gate (quiz.status === 'started') becomes true and
        // fullscreen is requested at the correct moment.
        socket.on('quiz_started', () => {
            console.log('[AttemptQuiz] quiz_started event received — activating proctoring gate.');
            setQuiz(prev => prev ? { ...prev, status: 'started' } : prev);
        });

        socket.on('quiz_ended', async () => {
            console.log('[AttemptQuiz] quiz_ended event received. Fetching final rank card immediately...');
            setLoadingRankResult(true);
            const targetId = quizRef.current?.id || id;
            try {
                const res = await api.get(`/quiz/result/${targetId}`);
                setResult(res.data);
                setFinalRankResult(res.data);
                setMissionComplete(false);
            } catch (err) {
                console.error('Error fetching final result:', err);
                navigate(`/analytics/quiz/${targetId}`);
            } finally {
                setLoadingRankResult(false);
            }
        });

        socket.on('sync_timer', ({ timeLeft }) => {
            console.log('Syncing timer from server:', timeLeft);
            targetEndTimeRef.current = Date.now() + (timeLeft * 1000);
            setTimeLeft(timeLeft);
        });

        socket.on('change_question', ({ questionIndex }) => {
            console.log('Teacher changed question to:', questionIndex);
            const nextIdx = parseInt(questionIndex);
            setCurrentQuestion(nextIdx);

            // Reset answered students count for the new question
            setAnsweredStudentsSet(new Set());

            // Clearing waitingForState here ensures first-time joiners are not stuck on the sync screen.
            setWaitingForState(false);

            // Reset state for new question
            if (quiz && !quiz.duration) {
                const newDuration = quiz.timerPerQuestion || 30;
                targetEndTimeRef.current = Date.now() + (newDuration * 1000);
                setTimeLeft(newDuration);
            }
            // Persist new position offline
            localStorage.setItem(`live_quiz_session_${id}`, JSON.stringify({ currentQuestion: nextIdx, answers }));
        });

        socket.on('restoreState', (state) => {
            console.log('[DIAGNOSTIC-QUIZ] Reconnection restoreState event fired. Server payload:', state);
            setCurrentQuestion(state.currentQuestionIndex);

            // Update total student count
            const studentParticipants = (state.participants || []).filter(
                p => p.role?.toLowerCase() !== 'teacher' && p.isOnline !== false
            );
            setTotalStudents(studentParticipants.length);

            // Rebuild set of students who already answered this question
            const answeredSet = new Set();
            const studentIds = new Set(studentParticipants.map(p => (p._id || p.id).toString()));
            Object.keys(state.progress || {}).forEach(key => {
                if (studentIds.has(key) && state.progress?.[key]?.[state.currentQuestionIndex]?.answered) {
                    answeredSet.add(key);
                }
            });
            setAnsweredStudentsSet(answeredSet);
            
            console.log('[DIAGNOSTIC-QUIZ] Evaluating progress restoration. authUser present:', !!authUser, 'state.progress present:', !!state.progress);
            if (state.progress && authUser) {
                console.log(`[DIAGNOSTIC-QUIZ] Progress payload for current student (${authUser.id}):`, state.progress[authUser.id]);
            }

             // Check if student has already answered this question
             if (authUser && state.progress && state.progress[authUser.id]) {
                  const studentProgress = state.progress[authUser.id];
                  
                  // Restore answered tracking for logic
                  const answeredList = Object.keys(studentProgress).map(Number).filter(qIdx => studentProgress?.[qIdx]?.answered);
                  console.log('[DIAGNOSTIC-QUIZ] Restoring answeredQuestions set list:', answeredList);
                  setAnsweredQuestions(new Set(answeredList));

                  // Restore superficial answers mapping for UI dots visually
                  setAnswers(prev => {
                      const recoveredAnswers = {};
                      Object.keys(studentProgress).forEach(qIdx => {
                           if (studentProgress?.[qIdx]?.answered) {
                                recoveredAnswers[qIdx] = studentProgress[qIdx].selectedOption || prev[qIdx] || true;
                                console.log(`[DIAGNOSTIC-QUIZ] Restored answers mapping for qIdx=${qIdx} with:`, recoveredAnswers[qIdx]);
                           }
                      });
                      const next = { ...prev, ...recoveredAnswers };
                      console.log('[DIAGNOSTIC-QUIZ] Final answers state after restoration merge:', next);
                      return next;
                  });
             } else {
                  console.log('[DIAGNOSTIC-QUIZ] No progress state or matching student record to restore in restoreState.');
             }
            
            setWaitingForState(false);
            
            if (state.quizStatus === 'started') {
                 targetEndTimeRef.current = Date.now() + (state.remainingTime * 1000);
                 setTimeLeft(state.remainingTime);
            } else if (state.quizStatus === 'finished') {
                 setLoadingRankResult(true);
                 const targetId = quizRef.current?.id || id;
                 api.get(`/quiz/result/${targetId}`).then(res => {
                     setResult(res.data);
                     setFinalRankResult(res.data);
                 }).catch(err => {
                     console.error('Error fetching final result:', err);
                     navigate(`/analytics/quiz/${targetId}`);
                 }).finally(() => {
                     setLoadingRankResult(false);
                 });
            }
        });

        const handleConnect = () => {
            setIsOnline(true);
            ensureSocketConnected();
            // Use refs so we always read current values even if fetchQuiz resolved after mount
            const currentQuiz = quizRef.current;
            const currentUser = authUserRef.current;
            if (currentQuiz?.isLive && currentUser) {
                const sessionStr = localStorage.getItem(`live_quiz_session_student_${id}`);
                if (sessionStr) {
                    try {
                        const sess = JSON.parse(sessionStr);
                        socket.emit('reconnectUser', { quizId: sess.quizId, user: { username: sess.username, role: sess.role, _id: sess._id } });
                    } catch {
                        socket.emit('join_room', {
                            quizId: id,
                            user: {
                                username: currentUser.username,
                                role: currentUser.role || 'student',
                                _id: currentUser.id || currentUser._id
                            }
                        });
                    }
                } else {
                    socket.emit('join_room', {
                        quizId: id,
                        user: {
                            username: currentUser.username,
                            role: currentUser.role || 'student',
                            _id: currentUser.id || currentUser._id
                        }
                    });
                }
            }
        };

        const handleErrorAlert = (data) => {
            console.error('[AttemptQuiz] Socket error_alert:', data);
            toast.error(data?.msg || 'Live connection error.');
            setWaitingForState(false);
        };

        const handleConnectError = (err) => {
            console.error('[AttemptQuiz] Socket connect_error:', err);
            setWaitingForState(false);
        };

        socket.on('connect', handleConnect);
        socket.on('error_alert', handleErrorAlert);
        socket.on('connect_error', handleConnectError);
        ensureSocketConnected();
        if (socket.connected) {
            handleConnect();
        }
        socket.on('disconnect', () => setIsOnline(false));

        socket.on('answer_feedback', ({ isFast, message }) => {
            console.log('Answer Speed Feedback:', isFast, message);
            setSpeedFeedback({ isFast, message });
        });

        const handleParticipantsUpdate = throttle((participantsList) => {
            const studentParticipants = (participantsList || []).filter(
                p => p.role?.toLowerCase() !== 'teacher' && p.isOnline !== false
            );
            setTotalStudents(studentParticipants.length);
        }, 400);

        const handleProgressUpdate = throttle(({ studentId, questionIndex, answered }) => {
            if (parseInt(questionIndex) === currentQuestionRef.current && answered) {
                setAnsweredStudentsSet(prev => {
                    const next = new Set(prev);
                    next.add(studentId.toString());
                    return next;
                });
            }
        }, 250);

        socket.on('participants_update', handleParticipantsUpdate);
        socket.on('student_progress_update', handleProgressUpdate);

        socket.on('lobby_summary_update', ({ lobbySummary }) => {
            console.log('Received lobby summary update:', lobbySummary);
            setLobbySummary(lobbySummary);
        });

        return () => {
            socket.off('quiz_ended');
            socket.off('quiz_started');
            socket.off('timer_update');
            socket.off('sync_timer');
            socket.off('change_question');
            socket.off('restoreState');
            socket.off('connect', handleConnect);
            socket.off('disconnect');
            socket.off('error_alert', handleErrorAlert);
            socket.off('connect_error', handleConnectError);
            socket.off('answer_feedback');
            socket.off('participants_update');
            socket.off('student_progress_update');
            socket.off('lobby_summary_update');
        };
    }, [quiz, authUser, id, navigate]);

    // Offline / Reconnect detection — restore session and re-join room on reconnect
    useEffect(() => {
        const handleOffline = () => setIsOnline(false);
        const handleOnline = () => {
            setIsOnline(true);
            const currentQuiz = quizRef.current;
            const currentUser = authUserRef.current;
            if (currentQuiz?.isLive && currentUser) {
                // Restore state handled by server restoreState event
                // Re-join room so teacher participant count updates
                const sessionStr = localStorage.getItem(`live_quiz_session_student_${id}`);
                if (sessionStr) {
                    try {
                        const sess = JSON.parse(sessionStr);
                        socket.emit('reconnectUser', { quizId: sess.quizId, user: { username: sess.username, role: sess.role, _id: sess._id } });
                    } catch {
                         socket.emit('join_room', {
                            quizId: id,
                            user: {
                                username: currentUser.username,
                                role: 'student',
                                _id: currentUser.id
                            }
                        });
                    }
                } else {
                    socket.emit('join_room', {
                        quizId: id,
                        user: {
                            username: currentUser.username,
                            role: 'student',
                            _id: currentUser.id
                        }
                    });
                }
            }
        };
        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, [id, quiz]);

    const handleAutoSubmitAnswer = async () => {
        const currentAnswer = answers[currentQuestion] || '';
        if (quiz.isLive && isOnline) {
            const token = localStorage.getItem('token');
            const userId = JSON.parse(atob(token.split('.')[1])).user.id;
            socket.emit('submit_question_answer', {
                quizId: id, studentId: userId,
                questionIndex: currentQuestion, answer: currentAnswer, timeRemaining: 0
            });
            setAnsweredQuestions(prev => new Set([...prev, currentQuestion]));
        }
    };

    const handleTimeUp = () => {
        if (result || missionComplete) return; // Do nothing if quiz completed / waiting
        const isActiveLive = quiz?.isLive && quiz?.status !== 'finished';
        if (isActiveLive) {
            handleAutoSubmitAnswer();
        } else {
            if (quiz.timerType === 'totalTime') {
                // Hitting 0 globally is handled in the interval effect
            } else {
                if (currentQuestion < quiz.questions.length - 1) {
                    setCurrentQuestion(prev => prev + 1);
                    const newDuration = quiz.timerPerQuestion || 30;
                    targetEndTimeRef.current = Date.now() + (newDuration * 1000);
                    setTimeLeft(newDuration);
                } else {
                    submitQuiz();
                }
            }
        }
    };

    const handleContinueToNext = () => {
        setShowIntermediateLeaderboard(false);
        setShowFeedback(false);

        if (currentQuestion < quiz.questions.length - 1) {
            setCurrentQuestion(prev => prev + 1);
            // Reset timer for next question if per-question timer exists
            if (quiz.timerType !== 'totalTime') {
                const newDuration = quiz.timerPerQuestion || 30;
                targetEndTimeRef.current = Date.now() + (newDuration * 1000);
                setTimeLeft(newDuration);
            }
        } else {
            // Last question - navigate to analytics
            navigate(`/analytics/quiz/${id}`);
        }
    };

    useEffect(() => {
        if (quiz && !isReviewMode && !result) {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const decoded = JSON.parse(atob(token.split('.')[1]));
                    socket.emit('student_question_focus', {
                        quizId: id,
                        studentId: decoded.user.id,
                        username: decoded.user.username,
                        questionIndex: currentQuestion
                    });
                } catch (e) {
                    console.error("Focus emit error:", e);
                }
            }
        }
    }, [currentQuestion, quiz, isReviewMode, result, id]);

    // Anti-Cheat & Exam Integrity Controls — Centralised via useExamProctoring hook
    const handleAutoSubmit = useCallback((reason) => {
        toast.error(`Exam Auto-Submitted: ${reason}. Navigating to analytics...`, { duration: 4000 });
        submitQuiz();
        setTimeout(() => {
            navigate(`/analytics/quiz/${id}`);
        }, 1000);
    }, [id, submitQuiz, navigate]);

    // Determine if proctoring should be active:
    // - For LIVE quizzes: only when quiz status is 'started' AND not waiting for state sync
    //   (prevents fullscreen prompt and false violations in the lobby/waiting room)
    // - For SELF-PACED quizzes: when quiz is loaded and not in review/result mode
    const isProctoringActive = !loading && !submitting && !result && !!quiz &&
        (quiz.isLive
            ? quiz.status === 'started' && !waitingForState
            : true);

    const { isFullscreen, requestFullscreenMode, isTerminated } = useExamProctoring({
        enabled: isProctoringActive,
        quizId: quiz?.id || id,
        userId: authUser?.id || authUser?._id,
        maxTabSwitches: 2,
        onAutoSubmit: handleAutoSubmit
    });

    // Timer Initialization (Split from focus logic)
    useEffect(() => {
        if (quiz && !isReviewMode && !result) {
            // Initialize global timer ONLY ONCE
            if (quiz.timerType === 'totalTime') {
                if (!hasInitializedTimer.current) {
                    let totalSeconds = (quiz.duration || 10) * 60;
                    if (quiz.previousResult && quiz.previousResult.startedAt) {
                        const startedAtTime = new Date(quiz.previousResult.startedAt).getTime();
                        const elapsedSeconds = Math.floor((Date.now() - startedAtTime) / 1000);
                        totalSeconds = Math.max(0, totalSeconds - elapsedSeconds);
                    }
                    if (quiz.endTime) {
                        const maxRemaining = Math.max(0, Math.floor((new Date(quiz.endTime).getTime() - Date.now()) / 1000));
                        totalSeconds = Math.min(totalSeconds, maxRemaining);
                    }
                    setTimeLeft(totalSeconds);
                    targetEndTimeRef.current = Date.now() + (totalSeconds * 1000);
                    hasInitializedTimer.current = true;
                }
            } else {
                // Per question timer: reset on every question change
                let pqTime = quiz.timerPerQuestion || 30;
                if (quiz.endTime) {
                    const maxRemaining = Math.max(0, Math.floor((new Date(quiz.endTime).getTime() - Date.now()) / 1000));
                    pqTime = Math.min(pqTime, maxRemaining);
                }
                setTimeLeft(pqTime);
                targetEndTimeRef.current = Date.now() + (pqTime * 1000);
            }
        }
    }, [currentQuestion, quiz, isReviewMode, result, id]); // Keeping currentQuestion for per-question mode

    useEffect(() => {
        if (loading || isReviewMode || !quiz) return;

        // Only stop timer on result if it's NOT a live quiz
        if (result && !quiz.isLive) return;

        // Disable timer if both options are 0 (Assessment Mode)
        if (quiz.timerPerQuestion === 0 && quiz.duration === 0) {
            setTimeLeft(0);
            return;
        }

        const timerId = setInterval(() => {
            if (targetEndTimeRef.current) {
                const remaining = Math.max(0, Math.ceil((targetEndTimeRef.current - Date.now()) / 1000));
                setTimeLeft(remaining);
                if (remaining <= 0) {
                    clearInterval(timerId);
                    if (quiz.timerType === 'totalTime') {
                        submitQuiz();
                    } else {
                        handleTimeUp();
                    }
                }
            } else {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerId);
                        if (quiz.timerType === 'totalTime') {
                            submitQuiz();
                            return 0;
                        } else {
                            handleTimeUp();
                            return 0;
                        }
                    }
                    return prev - 1;
                });
            }
        }, 1000);

        return () => clearInterval(timerId);
    }, [loading, isReviewMode, result, quiz, currentQuestion]);

    useEffect(() => {
        const fetchQuiz = async () => {
            console.log(`[DIAGNOSTIC-QUIZ] fetchQuiz started for quiz ID: ${id}`);
            try {
                const res = await api.get(`/quiz/${id}`);
                console.log('[DIAGNOSTIC-QUIZ] GET /quiz/:id response received. Metadata:', {
                    title: res.data.title,
                    isLive: res.data.isLive,
                    status: res.data.status,
                    hasPreviousResult: !!res.data.previousResult,
                    previousResultStatus: res.data.previousResult?.status
                });
                setQuiz(res.data);

                // LIVE QUIZ PAGE REFRESH: restore session from localStorage and auto-rejoin
                if (res.data.isLive && res.data.status === 'started') {
                    console.log('[DIAGNOSTIC-QUIZ] Quiz is LIVE and STARTED. Waiting for socket sync state.');
                    
                    // Restoring local answers state immediately from client storage
                    const localSaved = localStorage.getItem(`quiz_answers_${id}`);
                    if (localSaved) {
                        try {
                            const localAnswers = JSON.parse(localSaved);
                            console.log('[DIAGNOSTIC-QUIZ] Restoring active answers from localStorage under live quiz load:', localAnswers);
                            setAnswers(prev => ({ ...prev, ...localAnswers }));
                        } catch (e) {
                            console.error('[DIAGNOSTIC-QUIZ] Error parsing localStorage answers for live quiz:', e);
                        }
                    }

                    setWaitingForState(true);
                    // SAFETY TIMEOUT: If the server never sends change_question (e.g. room state missing),
                    // clear the sync screen after 8 seconds so the student isn't stuck forever.
                    setTimeout(() => {
                        console.log('[DIAGNOSTIC-QUIZ] Safety timeout triggered. Clearing waitingForState screen.');
                        setWaitingForState(false);
                    }, 8000);
                    // join_room is sent in the dedicated authUser effect below so it fires even
                    // if authUser loads asynchronously after this fetchQuiz effect runs.
                    // Skip previousResult handling — live quiz session is restored
                } else {
                    console.log('[DIAGNOSTIC-QUIZ] Quiz is self-paced or live but not active. Restoring from history/localStorage if present...');
                    // If there's a previous result (Completed or In-Progress)
                    if (res.data.previousResult) {
                        const prevResult = res.data.previousResult;

                        // Allow re-attempts for:
                        //  - finished live quizzes (async practice)
                        //  - isAssessment quizzes (unlimited practice until full marks)
                        const isFinishedLive = res.data.isLive && res.data.status === 'finished';
                        const allowRetake = isFinishedLive || res.data.isAssessment;

                        if (isFinishedLive) {
                            try {
                                const resultRes = await api.get(`/quiz/result/${id}`);
                                setResult(resultRes.data);
                                setFinalRankResult(resultRes.data);
                            } catch (e) {
                                console.error('Error fetching final result on finished live quiz refresh:', e);
                            }
                        }

                        // BLOCK RE-ENTRY only for regular one-shot quizzes that are already done
                        if (prevResult.status === 'completed' && !allowRetake) {
                            console.log('[DIAGNOSTIC-QUIZ] Block re-entry condition met. Directing to review mode.');
                            setIsReviewMode(true);
                            setResult(prevResult);
                            setAnswersFromHistory(prevResult.answers);
                            return; // Stop further loading
                        }

                        // RESUME: If in-progress, load state
                        if (prevResult.status === 'in-progress') {
                            console.log('Resuming quiz attempt...');
                            setAnswersFromHistory(prevResult.answers);
                            const localSaved = localStorage.getItem(`quiz_answers_${id}`);
                            console.log('[DIAGNOSTIC-QUIZ] Restoring answers from localStorage. Raw payload:', localSaved);
                            if (localSaved) {
                                const localAnswers = JSON.parse(localSaved);
                                setAnswers(prev => {
                                    const next = { ...prev, ...localAnswers };
                                    console.log('[DIAGNOSTIC-QUIZ] Restored answers state in self-paced mode:', next);
                                    return next;
                                });
                            }
                        }
                    }
                } // end else (non-live or not started)
            } catch (err) {
                console.error('[DIAGNOSTIC-QUIZ] Error fetching quiz:', err);
                const error = /** @type {any} */ (err);
                const errorMsg = error?.response?.data?.msg || error?.response?.data?.message || 'Quiz not found';
                showError('Error', errorMsg);
                navigate('/student-dashboard');
            } finally {
                setLoading(false);
            }
        };
        fetchQuiz();

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

    // SEPARATE EFFECT: Emit join_room/reconnectUser once authUser is available.
    // This is needed because authUser may load async from context AFTER fetchQuiz runs.
    useEffect(() => {
        if (!authUser || !quiz) return;
        ensureSocketConnected();
        const sessionData = {
            quizId: id,
            username: authUser.username,
            role: 'student',
            _id: authUser.id
        };
        const hasSession = !!localStorage.getItem(`live_quiz_session_student_${id}`);
        if (quiz.isLive) {
            localStorage.setItem(`live_quiz_session_student_${id}`, JSON.stringify(sessionData));
        }
        if (quiz.isLive && hasSession) {
            socket.emit('reconnectUser', {
                quizId: id,
                user: { username: authUser.username, role: 'student', _id: authUser.id }
            });
        } else {
            socket.emit('join_room', {
                quizId: id,
                user: { username: authUser.username, role: 'student', _id: authUser.id }
            });
        }
    }, [authUser, quiz, id]);

    const setAnswersFromHistory = (historyAnswers) => {
        const newAnswers = {};
        historyAnswers.forEach((ans) => {
            // Find index by question text in case of shuffling (advanced), but here strictly by index for now or assume order
            // Better to map by questionText if possible, but index is safe for now if static
            // Actually, `answers` state is by index.
            // We need to match existing questions.
            const qIndex = quiz.questions.findIndex(q => q.questionText === ans.questionText);
            if (qIndex >= 0) newAnswers[qIndex] = ans.selectedOption;
        });
        setAnswers(prev => ({ ...prev, ...newAnswers }));
    };

    const handleOptionSelect = (option) => {
        if (isReviewMode) return;
        const newAnswers = { ...answers, [currentQuestion]: option };
        setAnswers(newAnswers);
        localStorage.setItem(`quiz_answers_${id}`, JSON.stringify(newAnswers));
        // Persist full live session state for offline recovery
        if (quiz?.isLive) {
            localStorage.setItem(`live_quiz_session_${id}`, JSON.stringify({ currentQuestion, answers: newAnswers }));
        }
    };

    const handleSingleQuestionSubmit = () => {
        if (!answers[currentQuestion]) return showError('Attention', 'Please select an option first!');

        // isLive && status !== 'finished' → active live session: teacher controls navigation.
        // isLive && status === 'finished'  → async practice of a finished live quiz: student controls.
        const isActiveLive = quiz?.isLive && quiz?.status !== 'finished';

        if (isActiveLive) {
            if (!isOnline) {
                return showError('Offline', 'You are offline! Wait for your connection to restore before submitting.');
            }
            const token = localStorage.getItem('token');
            const userId = JSON.parse(atob(token.split('.')[1])).user.id;
            socket.emit('submit_question_answer', {
                quizId: id, studentId: userId,
                questionIndex: currentQuestion,
                answer: answers[currentQuestion],
                timeRemaining: timeLeft
            });
            setAnsweredQuestions(prev => new Set([...prev, currentQuestion]));
            // Show mission complete screen after last question submitted
            if (currentQuestion === quiz.questions.length - 1) {
                setMissionComplete(true);
            }
        } else {
            // Async / self-paced: move immediately to next question or submit
            if (currentQuestion < quiz.questions.length - 1) {
                setCurrentQuestion(prev => prev + 1);
                setTimeLeft(quiz.timerPerQuestion || 30);
            } else {
                submitQuiz();
            }
        }
    };

    // Student advances to next question themselves (live mode)
    const _handleNextQuestion = () => {
        // Disabled in strict mode - teacher controls navigation
        console.log("Manual navigation disabled in live mode.");
    };

    async function submitQuiz() {
        if (submitting || isReviewMode) return;
        setSubmitting(true);
        try {
            const finalElapsed = Math.max(1, Math.round((Date.now() - questionStartRef.current) / 1000));
            const finalQuestionTimes = {
                ...questionTimes,
                [currentQuestion]: (questionTimes[currentQuestion] || 0) + finalElapsed
            };

            const formattedAnswers = quiz.questions.map((q, idx) => ({
                questionText: q.questionText,
                selectedOption: answers[idx] || '',
                timeTaken: finalQuestionTimes[idx] || 0
            }));

            const res = await api.post('/quiz/submit', {
                quizId: id,
                answers: formattedAnswers
            });

            const isActiveLive = quiz?.isLive && quiz?.status !== 'finished';
            if (isActiveLive) {
                // Live quiz: show waiting screen until teacher ends the session
                setResult(res.data);
            } else {
                // Async / assessment: Trigger gorgeous submission sequence first!
                setShowSubmitSequence(true);
            }
        } catch (err) {
            console.error('Error submitting quiz', err);
            const error = /** @type {any} */ (err);
            const status = error?.response?.status;
            const msg = error?.response?.data?.msg || '';
            if (status === 400 && msg === 'Quiz already attempted') {
                window.location.reload();
            } else if (status === 403 && msg.includes('already submitted')) {
                // Quiz doesn't allow re-attempts; navigate to latest analytics
                navigate(`/analytics/quiz/${id}`);
            } else {
                showError('Submission Failed', msg || 'Submission failed. Please check your connection.');
            }
        } finally {
            setSubmitting(false);
            localStorage.removeItem(`quiz_answers_${id}`);
        }
    };

    if (loadingRankResult) {
        return <WaitingRoomLoader message="Calculating final standings..." showCoins={true} />;
    }

    if (loading || !quiz) return <WaitingRoomLoader message="Initializing Arena..." showCoins={false} />;

    if (waitingForState) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6 text-[var(--text-primary)] relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--bg-accent-glow),transparent_45%)] opacity-30" />
                <LiveQuizWaitAnimation
                    variant="quiz-starting"
                    timeLeft={timeLeft}
                    subtitle="Energy ring countdown active."
                    detail="Synchronizing session..."
                />
            </div>
        );
    }

    if (finalRankResult && !isReviewMode) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] p-4 relative overflow-hidden font-inter text-[var(--text-primary)]">
                {/* Background flair and glow effects */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--bg-accent-glow),transparent_60%)] opacity-40 pointer-events-none" />
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 25 }}
                    className="max-w-md w-full bg-white border-2 border-[var(--border-color)] backdrop-blur-xl rounded-[2.5rem] p-8 sm:p-10 text-center shadow-2xl space-y-8 relative z-10 text-[var(--text-primary)]"
                >
                    {/* Crown or Trophy based on Rank */}
                    <div className="relative">
                        <motion.div 
                            animate={{ scale: [1, 1.05, 1], rotate: [0, 3, -3, 0] }}
                            transition={{ duration: 4, repeat: Infinity }}
                            className="w-24 h-24 bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-amber-400/20 relative z-10 border border-amber-300"
                        >
                            {finalRankResult.rank === 1 ? (
                                <Crown size={48} className="text-slate-950" />
                            ) : (
                                <Trophy size={48} className="text-slate-950" />
                            )}
                        </motion.div>
                        <div className="absolute inset-0 bg-yellow-400/25 rounded-full blur-2xl -z-0 scale-75 animate-pulse" />
                    </div>

                    <div className="space-y-3">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.25em] border border-amber-500/40 text-amber-600 bg-amber-500/10"
                        >
                            Quiz Completed Successfully
                        </motion.div>
                        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight italic text-[var(--text-primary)] leading-tight">
                            {cleanQuizTitle(finalRankResult.quizTitle || quiz?.title || 'Arena Complete')}
                        </h1>
                        <p className="text-[var(--text-secondary)] text-xs font-bold uppercase tracking-widest leading-relaxed">
                            Excellent performance! Your telemetry has been recorded.
                        </p>
                    </div>

                    {/* Rank & Score Panel */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                            <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em] mb-1">Your Rank</p>
                            <p className="text-3xl sm:text-4xl font-black text-amber-600 italic">
                                #{finalRankResult.rank} <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase not-italic">/ {finalRankResult.totalParticipants}</span>
                            </p>
                        </div>
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                            <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em] mb-1">Score Obtained</p>
                            <p className="text-3xl sm:text-4xl font-black text-indigo-600 italic">
                                {finalRankResult.score} <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase not-italic">/ {finalRankResult.totalQuestions * 10}</span>
                            </p>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="space-y-3 pt-2">
                        <button
                            onClick={() => navigate(`/analytics/quiz/${id}`)}
                            className="w-full bg-[var(--bg-accent)] text-white font-black italic uppercase tracking-wider py-4 rounded-2xl hover:opacity-95 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-lg shadow-[var(--bg-accent)]/20 flex items-center justify-center gap-2.5 cursor-pointer"
                        >
                            <TrendingUp size={18} />
                            <span>Analytics</span>
                        </button>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setIsReviewMode(true)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 py-3 rounded-2xl font-bold hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <CheckCircle size={16} />
                                <span>Review Answers</span>
                            </button>
                            <button
                                onClick={() => navigate('/student-dashboard')}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 py-3 rounded-2xl font-bold hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Home size={16} />
                                <span>Dashboard</span>
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Mission Complete: student finished all live quiz questions — wait for quiz_ended
    if (missionComplete && quiz?.isLive) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center p-6 text-[var(--text-primary)] text-center font-inter relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--bg-accent)]/10 rounded-full blur-[120px] -mr-64 -mt-64"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] -ml-64 -mb-64"></div>
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative z-10 space-y-8 max-w-md w-full"
                >
                    <div className="w-24 h-24 bg-white/5 backdrop-blur-xl border border-white/20 rounded-[2rem] flex items-center justify-center mx-auto mb-4">
                        <Clock className="text-[var(--text-accent)] animate-pulse" size={40} />
                    </div>
                    <h1 className="text-5xl font-black italic uppercase tracking-tighter leading-none">Mission <span className="text-[var(--text-accent)]">Complete</span></h1>
                    <p className="text-[var(--text-secondary)] font-bold uppercase tracking-widest text-xs leading-relaxed">
                        All answers submitted! The leaderboard will appear when the host terminates the session.
                    </p>
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[3rem] p-10 backdrop-blur-md flex flex-col items-center gap-6 shadow-2xl">
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-[var(--text-secondary)] font-black uppercase tracking-[0.3em] text-[10px] mb-2">Session Status</span>
                            
                            <div className="relative w-32 h-32">
                                <motion.div 
                                    animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.3, 0.1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="absolute inset-0 bg-[var(--bg-accent)] rounded-full blur-2xl"
                                />
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5" />
                                    <motion.circle
                                        cx="64" cy="64" r="60" stroke="var(--bg-accent)" strokeWidth="6" fill="transparent"
                                        strokeDasharray="377"
                                        initial={{ strokeDashoffset: 377 }}
                                        animate={{ strokeDashoffset: 377 * (1 - timeLeft / (quiz.duration * 60 || 1800)) }}
                                        transition={{ duration: 1, ease: "linear" }}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-4xl font-black italic text-[var(--text-accent)] tracking-tighter">
                                        {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                                    </span>
                                </div>
                            </div>
                            <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest mt-4">Remaining Duration</p>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Only show result summary immediately after submission, NOT in review mode
    // For live quizzes, show a "Waiting" screen instead of the score summary
    if (result && !isReviewMode) {
        if (quiz?.isLive) {
            return (
                <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center p-6 text-[var(--text-primary)] text-center font-inter relative overflow-hidden">
                    {/* Background Decorations */}
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--bg-accent)]/10 rounded-full blur-[120px] -mr-64 -mt-64"></div>
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] -ml-64 -mb-64"></div>

                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative z-10 space-y-8 max-w-md w-full"
                    >
                        <div className="w-24 h-24 bg-white/5 backdrop-blur-xl border border-white/20 rounded-[2rem] flex items-center justify-center mx-auto mb-4">
                            <Clock className="text-[var(--text-accent)] animate-pulse" size={40} />
                        </div>
                        <h1 className="text-4xl font-black italic uppercase tracking-tighter">Mission <span className="text-[var(--text-accent)]">Complete</span></h1>
                        <p className="text-[var(--text-secondary)] font-bold uppercase tracking-widest text-xs leading-relaxed">
                            Your data has been transmitted. The gateway will open when the synchronization sequence concludes.
                        </p>
                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[3rem] p-10 backdrop-blur-md flex flex-col items-center gap-6 shadow-2xl">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-[var(--text-secondary)] font-black uppercase tracking-[0.3em] text-[10px] mb-2">Leaderboard appears in</span>
                                <div className="relative w-32 h-32">
                                    <motion.div 
                                        animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.3, 0.1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="absolute inset-0 bg-[var(--bg-accent)] rounded-full blur-2xl"
                                    />
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5" />
                                        <motion.circle
                                            cx="64" cy="64" r="60" stroke="var(--bg-accent)" strokeWidth="6" fill="transparent"
                                            strokeDasharray="377"
                                            initial={{ strokeDashoffset: 377 }}
                                            animate={{ strokeDashoffset: 377 * (1 - timeLeft / (quiz.duration * 60 || 1800)) }}
                                            transition={{ duration: 1, ease: "linear" }}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-4xl font-black italic text-[var(--text-accent)] tracking-tighter">
                                            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-4 text-[var(--text-secondary)] opacity-50">
                                <Loader2 className="animate-spin" size={16} />
                                <span className="font-black italic uppercase tracking-widest text-[10px]">Synchronizing Results...</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            );
        }

        return (
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
                            onClick={() => navigate(`/analytics/quiz/${id}`)}
                            className="w-full bg-[var(--bg-accent)] text-[var(--text-on-accent)] py-4 rounded-xl font-black italic uppercase tracking-wider hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            <TrendingUp size={20} /> View Detailed Analytics
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => {
                                    if (window.history.length > 2) {
                                        navigate(-1);
                                    } else {
                                        navigate('/student-dashboard');
                                    }
                                }}
                                className="bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                            >
                                Home
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
    }
    const question = quiz?.questions?.[currentQuestion];
    const isLastQuestion = currentQuestion === (quiz?.questions?.length || 1) - 1;

    // Get result data for current question if in review mode
    const questionResult = isReviewMode && result && question
        ? result.answers.find(a => a.questionText === question.questionText)
        : null;

    if (!question) {
        return <WaitingRoomLoader message="Loading Question..." showCoins={false} />;
    }

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col relative">
            {/* Strict Fullscreen Mode Overlay */}
            {!isFullscreen && !result && !loading && !submitting && !isReviewMode && !isTerminated && (
                <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[99998] flex flex-col items-center justify-center p-6 text-center text-white">
                    <div className="w-20 h-20 bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl flex items-center justify-center text-amber-400 mb-6 shadow-2xl animate-pulse">
                        <Maximize size={44} />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tight text-amber-400 mb-2">Fullscreen Mode Required</h2>
                    <p className="text-xs sm:text-sm font-bold text-slate-300 max-w-md mb-8 leading-relaxed">
                        This live examination requires mandatory Fullscreen mode. Exiting fullscreen is recorded as a security violation.
                    </p>
                    <button
                        onClick={requestFullscreenMode}
                        className="px-8 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black italic uppercase text-xs tracking-widest rounded-2xl shadow-2xl active:scale-95 transition-all cursor-pointer"
                    >
                        Resume Fullscreen Exam
                    </button>
                </div>
            )}

            {/* Session Terminated / Disqualified Overlay */}
            {isTerminated && (
                <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-2xl z-[99999] flex flex-col items-center justify-center p-6 text-center text-white">
                    <div className="w-20 h-20 bg-red-500/10 border-2 border-red-500/30 rounded-3xl flex items-center justify-center text-red-500 mb-6 shadow-2xl animate-bounce">
                        <ShieldAlert size={44} />
                    </div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tight text-red-500 mb-2">Examination Terminated</h2>
                    <p className="text-xs sm:text-sm font-bold text-slate-300 max-w-md mb-8 leading-relaxed">
                        Your exam session was automatically submitted and terminated due to exceeding security rules (Tab switches, DevTools, or focus loss).
                    </p>
                    <button
                        onClick={() => navigate('/history')}
                        className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-black italic uppercase text-xs tracking-wider rounded-2xl shadow-xl transition-all active:scale-95"
                    >
                        Return to Dashboard
                    </button>
                </div>
            )}

            {/* Offline Banner */}
            {!isOnline && (
                <div className="fixed top-0 left-0 right-0 z-[var(--z-tooltip)] bg-orange-500 text-white px-6 py-3 flex items-center justify-center gap-3 font-bold text-sm shadow-lg">
                    <WifiOff size={18} />
                    You are offline — progress saved locally. Submissions paused until reconnected.
                </div>
            )}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky z-[var(--z-header)] top-0 shadow-xs" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/student-dashboard')}
                        className="p-2 hover:bg-slate-100 rounded-lg text-[#0f172a] transition-colors"
                        style={{ color: '#0f172a' }}
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h2 className="font-bold text-[#0f172a] uppercase tracking-tight italic" style={{ color: '#0f172a' }}>{cleanQuizTitle(quiz.title)}</h2>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{currentQuestion + 1} of {quiz.questions.length} Questions {isReviewMode && '• Review Mode'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {!isReviewMode && !result && (quiz.timerPerQuestion > 0 || quiz.duration > 0) && (
                        <div className="flex flex-col items-center">
                            <div className="relative w-20 h-20">
                                {/* Ambient Glow for low time */}
                                <AnimatePresence>
                                    {timeLeft <= 5 && (
                                        <motion.div 
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: [0, 0.4, 0], scale: [0.8, 1.4, 0.8] }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 1, repeat: Infinity }}
                                            className="absolute inset-0 bg-red-500 rounded-full blur-xl"
                                        />
                                    )}
                                </AnimatePresence>

                                {/* Background Ring */}
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle
                                        cx="40"
                                        cy="40"
                                        r="36"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        fill="transparent"
                                        className="text-slate-200"
                                    />
                                    {/* Progress Ring */}
                                    <motion.circle
                                        cx="40"
                                        cy="40"
                                        r="36"
                                        stroke={timeLeft <= 5 ? '#ef4444' : '#0f172a'}
                                        strokeWidth="4"
                                        fill="transparent"
                                        strokeDasharray="226.2"
                                        initial={{ strokeDashoffset: 226.2 }}
                                        animate={{ strokeDashoffset: 226.2 * (1 - timeLeft / (quiz.timerType === 'totalTime' ? ((quiz.duration || 10) * 60) : (quiz.timerPerQuestion || 30))) }}
                                        transition={{ duration: 1, ease: "linear" }}
                                        strokeLinecap="round"
                                    />
                                </svg>

                                {/* Countdown Text */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <motion.span 
                                        key={timeLeft}
                                        initial={{ scale: 1.1, opacity: 0.8 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className={`text-2xl font-black italic tracking-tighter leading-none ${timeLeft <= 5 ? 'text-red-500' : 'text-[#0f172a]'}`}
                                        style={{ color: timeLeft <= 5 ? '#ef4444' : '#0f172a' }}
                                    >
                                        {timeLeft}
                                    </motion.span>
                                    <span className={`text-[8px] font-black uppercase tracking-[0.2em] mt-0.5 ${timeLeft <= 5 ? 'text-red-500' : 'text-slate-500'}`}>Sec</span>
                                </div>
                            </div>
                        </div>
                    )}
                    {isReviewMode && (
                        <div className="bg-[#0f172a] text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest italic">
                            Yield: {result.score} / {result.totalQuestions * 10}
                        </div>
                    )}
                    <div className="w-48 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className="h-full transition-all duration-300 bg-[#0f172a]"
                            style={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
                        />
                    </div>
                    {/* Visual Progress Dots */}
                    <div className="hidden md:flex items-center gap-1">
                        {quiz.questions.map((_, idx) => (
                            <div
                                key={`prog-${idx}`}
                                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${idx === currentQuestion ? 'scale-125 ring-2 ring-[#0f172a] ring-offset-2' : ''} ${answers[idx] ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            />
                        ))}
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-sm active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap ml-2"
                        aria-label="Log out"
                        title="Log out"
                    >
                        <LogOut size={15} />
                        <span>Logout</span>
                    </button>
                </div>
            </header>

            {/* Strict Mode Waiting Overlay */}
            {quiz?.isLive && answeredQuestions.has(currentQuestion) && (
                <div className="fixed inset-0 z-[var(--z-overlay)] bg-[var(--bg-primary)]/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center text-[var(--text-primary)]">
                    <LiveQuizWaitAnimation
                        variant="synchronizing-answers"
                        answeredCount={answeredCount}
                        totalStudents={totalStudents}
                        detail={totalStudents > 0 && answeredCount < totalStudents
                            ? `${answeredCount} of ${totalStudents} answered`
                            : 'Real-time sync active'}
                    />
                </div>
            )}

            <main className="flex-1 flex flex-col items-center justify-start p-6 pb-24 relative bg-slate-50">
                <div className="max-w-2xl w-full">
                    {isReviewMode && (
                        <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 border ${questionResult?.isCorrect
                            ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                            : 'bg-rose-100 border-rose-400 text-rose-800'
                            }`}>
                            {questionResult?.isCorrect ? <CheckCircle size={20} /> : <XCircle size={20} />}
                            <div className="flex-1">
                                <p className="text-sm font-black uppercase italic tracking-tight">
                                    {questionResult?.isCorrect ? 'Tactical Success' : 'Neural Mismatch'}
                                </p>
                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                                    Yield: {questionResult?.isCorrect ? question.points : 0} / {question.points} Pts
                                </p>
                            </div>
                            <Award size={24} className="opacity-30" />
                        </div>
                    )}

                    {/* WAITING STATE OVERLAY */}
                    {isWaiting && !isReviewMode && (
                        <div className="absolute inset-0 z-[var(--z-overlay)] bg-white/90 backdrop-blur-md flex flex-col items-center justify-center rounded-3xl border border-slate-200">
                            <LiveQuizWaitAnimation
                                variant="loading-next-question"
                                title="Arena Cleared"
                                subtitle="Sliding question card transition."
                                detail="Awaiting host command..."
                            />
                        </div>
                    )}

                    {/* CORRECT/INCORRECT FEEDBACK OVERLAY — only for non-live quizzes */}
                    {showFeedback && !quiz?.isLive && (
                        <div className={`absolute inset-0 z-[var(--z-overlay)] flex flex-col items-center justify-center rounded-[3rem] animate-in zoom-in duration-300 ${isCorrectFeedback ? 'bg-emerald-600/95' : 'bg-rose-600/95'} backdrop-blur-md text-white shadow-2xl`}>
                            {isCorrectFeedback ? <CheckCircle size={80} className="mb-4 text-white" /> : <XCircle size={80} className="mb-4 text-white" />}
                            <h2 className="text-6xl font-black italic uppercase tracking-tighter text-white">
                                {isCorrectFeedback ? 'Success' : 'Failed'}
                            </h2>
                            {!isCorrectFeedback && (
                                <p className="mt-4 font-black uppercase tracking-[0.2em] text-[10px] text-center px-8 opacity-90 text-white">
                                    CORRECT SEQUENCE:<br />
                                    <span className="text-2xl underline decoration-white/30 tracking-tight text-white">{quiz.questions[currentQuestion].correctAnswer}</span>
                                </p>
                            )}
                            <div className="mt-8 flex items-center gap-2 text-white/60 font-black uppercase tracking-widest text-[10px]">
                                <Loader2 className="animate-spin" size={12} /> Next Question...
                            </div>
                        </div>
                    )}

                    <div className="bg-white border-2 border-slate-200 rounded-[3rem] shadow-xl p-8 md:p-12 mb-8 relative overflow-visible" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-100 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                        
                        <div className="flex items-center justify-between mb-8 flex-wrap gap-4 relative z-10">
                            <span className="inline-block bg-slate-100 text-[#0f172a] text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-slate-300">
                                Sequence {currentQuestion + 1}
                            </span>
                            {quiz?.isLive && (
                                <div className="flex flex-col items-end gap-1.5 min-w-[200px]">
                                    <div className="flex justify-between w-full text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        <span>Progress:</span>
                                        <span>{answeredCount} of {totalStudents} Answered</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                        <motion.div 
                                            className="h-full bg-gradient-to-r from-[#0f172a] to-blue-600"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${totalStudents > 0 ? (answeredCount / totalStudents) * 100 : 0}%` }}
                                            transition={{ duration: 0.3 }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <AdaptiveQuestionContainer questionText={question.questionText} />

                        {(!question.options || question.options.length <= 1) ? (
                            <div className="space-y-4 mb-4 relative z-10">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Type Your Answer Below</label>
                                <input
                                    type="text"
                                    value={answers[currentQuestion] || ''}
                                    onChange={(e) => handleOptionSelect(e.target.value)}
                                    disabled={isReviewMode || isWaiting || submitting || (quiz?.isLive && answeredQuestions.has(currentQuestion))}
                                    placeholder="Enter short answer..."
                                    className="w-full p-6 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:bg-white focus:border-[#0f172a] transition-all font-bold text-lg text-[#0f172a] placeholder-slate-400 outline-none"
                                    style={{ color: '#0f172a' }}
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                                {question.options.map((option, idx) => {
                                    const isSelected = answers[currentQuestion] === option;
                                    const isCorrect = questionResult?.correctOption === option;

                                    // Theme-appropriate option styles
                                    const kahootStyles = [
                                        { icon: Triangle },
                                        { icon: Diamond },
                                        { icon: Circle },
                                        { icon: Square }
                                    ];
                                    const style = kahootStyles[idx % 4];
                                    const ShapeIcon = style.icon;

                                    let containerClass = 'bg-white border-2 border-slate-200 shadow-sm text-[#0f172a] hover:border-[#0f172a] hover:bg-slate-50';
                                    let textColor = '#0f172a';
                                    let shapeFill = '#0f172a';

                                    if (isReviewMode) {
                                        if (isCorrect) {
                                            containerClass = 'bg-emerald-600 border-emerald-600 shadow-md text-white';
                                            textColor = '#ffffff';
                                            shapeFill = '#ffffff';
                                        } else if (isSelected && !isCorrect) {
                                            containerClass = 'bg-rose-600 border-rose-600 shadow-md text-white';
                                            textColor = '#ffffff';
                                            shapeFill = '#ffffff';
                                        } else {
                                            containerClass = 'bg-slate-100 text-slate-400 border-slate-200 opacity-50 grayscale';
                                            textColor = '#94a3b8';
                                            shapeFill = '#94a3b8';
                                        }
                                    } else if (isSelected) {
                                        containerClass = 'bg-amber-500/10 border-2 border-amber-500 ring-4 ring-amber-500/20 shadow-md scale-[0.98]';
                                        textColor = '#0f172a';
                                        shapeFill = '#d97706';
                                    }

                                    // In live mode: lock only after submit, allow free re-selection before
                                    const isSubmittedLive = quiz?.isLive && answeredQuestions.has(currentQuestion);

                                    return (
                                        <motion.button
                                            key={`opt-${idx}-${option}`}
                                            disabled={isReviewMode || isWaiting || submitting || isSubmittedLive}
                                            onClick={() => handleOptionSelect(option)}
                                            style={{ willChange: 'transform' }}
                                            animate={{
                                                scale: isSubmittedLive && isSelected ? 1.04 : isSelected ? 0.98 : 1,
                                                opacity: answers[currentQuestion] && !isSelected && !isReviewMode ? 0.75 : 1
                                            }}
                                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                            className={`relative min-h-[5.5rem] md:min-h-[6.5rem] h-auto text-left px-6 py-5 rounded-2xl transition-all duration-300 flex items-center gap-4 group ${containerClass} disabled:cursor-not-allowed cursor-pointer`}
                                        >
                                            <div className={`flex-shrink-0 p-3 rounded-xl transition-transform group-hover:scale-110 ${isSelected && !isReviewMode ? 'bg-amber-500 text-white shadow-xs' : isReviewMode && (isCorrect || (isSelected && !isCorrect)) ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#0f172a] border border-slate-200'}`}>
                                                <ShapeIcon size={24} fill={shapeFill} strokeWidth={0} />
                                            </div>
                                            <span className="text-base md:text-lg font-black italic uppercase tracking-tight leading-snug break-words whitespace-normal min-w-0 flex-1" style={{ color: textColor }}>
                                                {option}
                                            </span>

                                            {isSelected && !isReviewMode && (
                                                <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-amber-500 text-white rounded-full px-2.5 py-1 shadow-md">
                                                    {isSubmittedLive ? (
                                                        <motion.div
                                                            initial={{ rotate: -90, scale: 0 }}
                                                            animate={{ rotate: 0, scale: 1 }}
                                                            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                                                            className="flex items-center justify-center text-white"
                                                        >
                                                            <Lock size={12} className="fill-white/20" />
                                                        </motion.div>
                                                    ) : null}
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        transition={{ type: 'spring', stiffness: 500, damping: 15, delay: 0.1 }}
                                                    >
                                                        <CheckCircle size={14} className="text-white" />
                                                    </motion.div>
                                                </div>
                                            )}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        )}

                        {isReviewMode && !questionResult?.isCorrect && (
                            <div className="mt-8 p-4 bg-emerald-100 border border-emerald-300 rounded-2xl flex items-center gap-4 text-emerald-900">
                                <CheckCircle size={20} className="text-emerald-700" />
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800 mb-1">TACTICAL SOLUTION</p>
                                    <p className="text-lg font-black italic uppercase tracking-tight leading-none text-emerald-950">{questionResult?.correctOption}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between w-full">
                        {/* In live mode, student cannot navigate manually */}
                        <div className="w-10" />

                        {/* Live mode: after submitting show Next Question button */}
                        {quiz?.isLive && answeredQuestions.has(currentQuestion) && !isLastQuestion ? (
                            <div className="px-8 py-4 bg-slate-100 border-2 border-slate-300 rounded-2xl text-[#0f172a] font-black italic uppercase tracking-widest text-[11px] shadow-xs">
                                Awaiting Tactical Commands...
                            </div>
                        ) : isLastQuestion ? (
                            isReviewMode ? (
                                <button
                                    onClick={() => setIsReviewMode(false)}
                                    className="flex items-center gap-3 bg-[#0f172a] text-white px-10 py-4 rounded-2xl font-black italic uppercase tracking-tighter hover:bg-slate-800 transition shadow-lg active:scale-95 cursor-pointer"
                                >
                                    <Home size={20} /> Terminate Review
                                </button>
                            ) : (
                                <button
                                    onClick={quiz?.isLive ? handleSingleQuestionSubmit : submitQuiz}
                                    disabled={submitting || !answers[currentQuestion] || (!isOnline && quiz?.isLive)}
                                    className="flex items-center gap-3 bg-[#0f172a] text-white px-10 py-4 rounded-2xl font-black italic uppercase tracking-tighter hover:bg-slate-800 transition shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={20} /> : (!isOnline && quiz?.isLive) ? <WifiOff size={20} /> : <Send size={20} />}
                                    {submitting ? 'Transmitting...' : (!isOnline && quiz?.isLive) ? 'Link Severed' : (quiz?.isLive ? 'Submit Sequence' : 'Finalize Mission')}
                                </button>
                            )
                        ) : (
                            isReviewMode ? (
                                // Review mode: allow manual prev/next
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                                        disabled={currentQuestion === 0}
                                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] bg-white border-2 border-slate-300 text-[#0f172a] hover:border-[#0f172a] disabled:opacity-30 transition-all shadow-xs"
                                        style={{ color: '#0f172a' }}
                                    >
                                        <ChevronLeft size={20} className="text-[#0f172a]" /> Previous
                                    </button>
                                    <button
                                        onClick={() => setCurrentQuestion(prev => prev + 1)}
                                        className="flex items-center gap-2 px-8 py-4 bg-[#0f172a] border border-[#0f172a] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all shadow-md cursor-pointer"
                                    >
                                        Advance <ChevronRight size={20} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleSingleQuestionSubmit}
                                    disabled={isWaiting || !answers[currentQuestion] || (!isOnline && quiz?.isLive)}
                                    className="flex items-center gap-3 px-10 py-5 rounded-2xl font-black italic uppercase tracking-tighter hover:bg-slate-800 transition shadow-xl active:scale-95 disabled:opacity-50 bg-[#0f172a] text-white cursor-pointer disabled:cursor-not-allowed"
                                >
                                    {!isOnline && quiz?.isLive ? <><WifiOff size={24} /> Link Severed</> : <>Initiate Submission <Send size={20} /></>}
                                </button>
                            )
                        )}

                        <div className="w-10" />
                    </div>
                </div>
            </main>

            {/* New Question Modal */}
            {
                showNewQuestionModal && newQuestionNotification && (
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
                                                showSuccess('Success', `Answer submitted: ${option}`);
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
                )
            }

            {/* Intermediate Leaderboard Modal */}
            {
                showIntermediateLeaderboard && currentLeaderboard.length > 0 && (
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
                                            <div className={`min-w-[2.5rem] px-2 h-10 rounded-full flex items-center justify-center font-bold text-white ${student.rank === 1 ? 'bg-yellow-500' :
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
                                className="button w-full justify-center"
                            >
                                {currentQuestion < quiz.questions.length - 1 ? (
                                    <>
                                        <span>Continue to Next Question</span>
                                        <svg viewBox="0 0 13 10">
                                            <polygon points="0.5 0 6.5 5 0.5 10"></polygon>
                                            <polygon points="4.5 0 10.5 5 4.5 10"></polygon>
                                            <polygon points="8.5 0 13 5 8.5 10"></polygon>
                                        </svg>
                                    </>
                                ) : (
                                    <>
                                        <span>View Final Results</span>
                                        <Trophy size={20} />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )
            }
            <AnimatePresence>
                {speedFeedback && (
                    <motion.div
                        initial={{ opacity: 0, x: 60, scale: 0.85 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 60, scale: 0.85 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                        className="fixed bottom-8 right-6 pointer-events-none z-[9999] w-72"
                    >
                        <div 
                            className={`pointer-events-auto p-5 rounded-3xl border shadow-2xl backdrop-blur-xl relative overflow-hidden transition-all duration-300 ${
                                speedFeedback.isUnattempted
                                    ? 'bg-red-950/95 border-red-500/40 shadow-red-500/25 text-red-300'
                                    : speedFeedback.isFast 
                                    ? 'bg-cyan-950/95 border-cyan-500/40 shadow-cyan-500/25 text-cyan-300' 
                                    : 'bg-amber-950/95 border-amber-500/40 shadow-amber-500/25 text-amber-300'
                            }`}
                        >
                            {/* Animated corner glow */}
                            <motion.div
                                animate={{ opacity: [0.25, 0.55, 0.25] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className={`absolute -top-8 -right-8 w-20 h-20 rounded-full blur-2xl ${
                                    speedFeedback.isUnattempted ? 'bg-red-500' : speedFeedback.isFast ? 'bg-cyan-400' : 'bg-amber-400'
                                }`}
                            />
                            <motion.div
                                animate={{ opacity: [0.15, 0.35, 0.15] }}
                                transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                                className={`absolute -bottom-8 -left-8 w-20 h-20 rounded-full blur-2xl ${
                                    speedFeedback.isUnattempted ? 'bg-rose-500' : speedFeedback.isFast ? 'bg-blue-500' : 'bg-orange-500'
                                }`}
                            />

                            <motion.div 
                                initial={{ rotate: speedFeedback.isUnattempted ? 0 : speedFeedback.isFast ? -8 : 8, scale: 0.9 }}
                                animate={{ rotate: 0, scale: 1 }}
                                transition={{ type: 'spring', delay: 0.08 }}
                                className="relative z-10 flex items-center gap-4"
                            >
                                {/* Big emoji */}
                                <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${
                                    speedFeedback.isUnattempted
                                        ? 'bg-red-900/60 border border-red-500/30'
                                        : speedFeedback.isFast
                                        ? 'bg-cyan-900/60 border border-cyan-500/30'
                                        : 'bg-amber-900/60 border border-amber-500/30'
                                }`}>
                                    {speedFeedback.isUnattempted ? "❌" : speedFeedback.isFast ? "⚡" : "🐢"}
                                </div>

                                {/* Text block */}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[10px] font-black uppercase tracking-[0.25em] opacity-60 mb-0.5 ${
                                        speedFeedback.isUnattempted ? 'text-red-400' : speedFeedback.isFast ? 'text-cyan-400' : 'text-amber-400'
                                    }`}>
                                        {speedFeedback.isUnattempted ? 'Unattempted Alert' : speedFeedback.isFast ? 'Response Speed' : 'Pace Alert'}
                                    </p>
                                    <h3 className={`text-lg font-black italic uppercase tracking-tight leading-tight ${
                                        speedFeedback.isUnattempted ? 'text-red-200' : speedFeedback.isFast ? 'text-cyan-200' : 'text-amber-200'
                                    }`}>
                                        {speedFeedback.isUnattempted
                                            ? 'No Answer Locked!'
                                            : speedFeedback.isFast
                                            ? (speedFeedback.message?.toLowerCase().includes('first') ? 'Lightning Fast! 🔥' :
                                               speedFeedback.message?.toLowerCase().includes('top') ? 'Top Speed! 🚀' :
                                               'Quick Reflexes!')
                                            : (speedFeedback.message?.toLowerCase().includes('last') ? 'Too Slow...' :
                                               speedFeedback.message?.toLowerCase().includes('half') ? 'Speed Up!' :
                                               'Pick Up Pace!')}
                                    </h3>
                                    <p className="text-white/60 font-semibold text-xs leading-snug mt-1">
                                        {speedFeedback.message}
                                    </p>
                                </div>
                            </motion.div>

                            {/* Progress bar draining as toast disappears */}
                            <motion.div
                                className={`mt-4 h-1 rounded-full ${
                                    speedFeedback.isUnattempted ? 'bg-red-500/30' : speedFeedback.isFast ? 'bg-cyan-500/30' : 'bg-amber-500/30'
                                }`}
                            >
                                <motion.div
                                    initial={{ width: '100%' }}
                                    animate={{ width: '0%' }}
                                    transition={{ duration: 4, ease: 'linear' }}
                                    className={`h-full rounded-full ${
                                        speedFeedback.isUnattempted ? 'bg-red-400' : speedFeedback.isFast ? 'bg-cyan-400' : 'bg-amber-400'
                                    }`}
                                />
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Resilient Fullscreen Reconnect Overlay */}
            {showReconnectScreen && (
                <div className="fixed inset-0 z-[5000] bg-[var(--bg-primary,#0a0a0b)]/95 backdrop-blur-xl flex items-center justify-center p-6">
                    <LiveQuizWaitAnimation 
                        variant="reconnecting"
                        offlineDuration={offlineDuration}
                        reconnectState={reconnectState}
                    />
                </div>
            )}

            {/* Gorgeous GPU-Accelerated Submission Sequence Overlay */}
            {showSubmitSequence && (
                <SubmissionSequence 
                    selectedOption={answers[currentQuestion] || 'N/A'}
                    questionText={quiz.questions[currentQuestion]?.questionText || 'Quiz Complete'}
                    timeTaken={questionTimes[currentQuestion] || null}
                    onComplete={async () => {
                        localStorage.removeItem(`quiz_answers_${id}`);
                        setLoadingRankResult(true);
                        try {
                            const res = await api.get(`/quiz/result/${id}`);
                            setResult(res.data);
                            setFinalRankResult(res.data);
                        } catch (err) {
                            console.error('Error fetching final result:', err);
                            navigate(`/analytics/quiz/${id}`);
                        } finally {
                            setLoadingRankResult(false);
                        }
                    }}
                />
            )}

            {/* Strict Fullscreen Enforcement Modal Overlay */}
            {!isFullscreen && !loading && !submitting && !result && (
                <div className="fixed inset-0 z-[10000] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-6 text-white text-center animate-in fade-in duration-300">
                    <div className="bg-slate-900 border-2 border-red-500/40 rounded-[3rem] p-8 sm:p-12 max-w-lg w-full shadow-2xl shadow-red-500/20 space-y-6 animate-in zoom-in-95 duration-300">
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
        </div >
    );
}
