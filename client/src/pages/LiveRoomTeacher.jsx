import { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Award, Users, Play, Copy, Loader2, Clock, MinusCircle, WifiOff, Trophy, CheckCircle, XCircle, ChevronRight, ChevronLeft, Minus, ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
import api from '../utils/api';
import socket, { ensureSocketConnected } from '../utils/socket';
import AuthContext from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { showConfirm, showError, showSuccess } from '../utils/alerts';
import toast from 'react-hot-toast';
import throttle from '../utils/throttle';
import { cleanQuizTitle } from '../utils/cleanTitle';
import { SecurityDashboard } from '../components/SecurityDashboard';

import FormattedQuestionText from '../components/quiz/FormattedQuestionText';

export default function LiveRoomTeacher() {
    const { joinCode } = useParams();
    const { user } = useContext(AuthContext);
    const [participants, setParticipants] = useState([]);
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [studentProgress, setStudentProgress] = useState({});
    const [timeLeft, setTimeLeft] = useState(30);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [leaderboard, setLeaderboard] = useState([]);
    const [liveInsights, setLiveInsights] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isQuizEnded, setIsQuizEnded] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [cheatAlerts, setCheatAlerts] = useState([]);
    const studentsPerPage = 10;
    const hasInitializedTimer = useRef(false);
    const isTransitioning = useRef(false);
    const quizRef = useRef(null); // Always holds latest quiz value for use in socket callbacks
    const navigate = useNavigate();

    // Keep quizRef in sync with quiz state so socket callbacks always have latest value
    useEffect(() => { quizRef.current = quiz; }, [quiz]);

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const res = await api.post('/quiz/join', { code: joinCode });
                const quizRes = await api.get(`/quiz/${res.data.quizId}`);
                setQuiz(quizRes.data);
                quizRef.current = quizRes.data; // Sync ref immediately for socket callbacks
                
                // Persist Teacher Session
                const sessionData = {
                    quizId: quizRes.data.id,
                    username: user.username,
                    role: 'teacher'
                };
                localStorage.setItem(`live_quiz_session_teacher_${joinCode}`, JSON.stringify(sessionData));

                // Fetch persistent suspicious activity logs from DB
                try {
                    const logsRes = await api.get(`/quiz/${quizRes.data.id}/suspicious-activities`);
                    if (Array.isArray(logsRes.data)) {
                        setCheatAlerts(logsRes.data);
                    }
                } catch (logErr) {
                    console.warn('Could not load persistent suspicious activities:', logErr);
                }

                // Emit join_room — works whether socket is already connected or just connecting
                ensureSocketConnected();
                socket.emit('join_room', { quizId: quizRes.data.id, user: { username: user.username, role: user.role || 'teacher' } });
            } catch (err) {
                console.error(err);
                showError('Error', 'Error loading quiz');
                navigate('/teacher-dashboard');
            } finally {
                setLoading(false);
            }
        };

        fetchQuiz();

        const handleParticipantsUpdate = throttle((participantsList = []) => {
            console.log('Participants Update:', participantsList);
            const students = participantsList.filter(
                p => p.role?.toLowerCase() !== 'teacher'
            );
            setParticipants([...students]);
        }, 300);

        const handleProgressUpdate = ({ studentId, username, questionIndex, isCorrect, skipped }) => {
            setStudentProgress(prev => {
                const newState = { ...prev };
                const qIdx = parseInt(questionIndex);
                const progressEntry = { answered: true, isCorrect, skipped: skipped === true };
                if (studentId) {
                    newState[studentId] = {
                        ...(newState[studentId] || {}),
                        [qIdx]: progressEntry
                    };
                }
                if (username) {
                    newState[username] = {
                        ...(newState[username] || {}),
                        [qIdx]: progressEntry
                    };
                }
                return newState;
            });
        };

        socket.on('participants_update', handleParticipantsUpdate);
        socket.on('progress_history', (history) => {
            setStudentProgress(history);
        });
        socket.on('quiz_started', () => {
            setQuiz(prev => prev ? { ...prev, status: 'started' } : null);
        });
        socket.on('student_progress_update', handleProgressUpdate);

        socket.on('change_question', ({ questionIndex }) => {
            setCurrentQuestion(parseInt(questionIndex));
        });

        socket.on('student_focus_update', ({ studentId, username, questionIndex }) => {
            setStudentProgress(prev => {
                const newState = { ...prev };
                const id = studentId || username;
                if (!id) return prev;
                newState[id] = { ...(newState[id] || {}), current: parseInt(questionIndex) };
                return newState;
            });
        });

        socket.on('question_leaderboard', (data) => {
            setLeaderboard(data.leaderboard);
            setLiveInsights(data.liveInsights);
        });

        socket.on('restoreState', (state) => {
            console.log('Restoring State on Reconnect:', state);
            setCurrentQuestion(state.currentQuestionIndex);
            
            // Re-sync leaderboards and participants
            if (state.leaderboard && state.leaderboard.length > 0) {
                setLeaderboard(state.leaderboard);
            }
            if (state.participants) {
                const students = state.participants.filter(
                    p => p.role?.toLowerCase() !== 'teacher'
                );
                setParticipants([...students]);
            }
            if (state.progress) {
                setStudentProgress(state.progress);
            }
            if (state.cheatAlerts) {
                setCheatAlerts(state.cheatAlerts);
            }

            if (state.quizStatus === 'started') {
                setQuiz(prev => prev ? { ...prev, status: 'started' } : null);
                setTimeLeft(state.remainingTime);
                if (state.remainingTime > 0) setIsTimerRunning(true);
            } else if (state.quizStatus === 'finished') {
                setIsQuizEnded(true);
                setIsTimerRunning(false);
            }
        });

        socket.on('quiz_ended', () => {
            setIsQuizEnded(true);
            setIsTimerRunning(false);
        });

        // When a student logs out, mark them offline in participants list (do NOT remove)
        socket.on('user_status_change', ({ userId, isOnline: online }) => {
            setParticipants(prev => prev.map(p =>
                (p._id === userId || p.id === userId)
                    ? { ...p, isOnline: online === true }
                    : p
            ));
        });

        socket.on('student_cheat_warning', (alert) => {
            console.log('Received cheat warning:', alert);
            setCheatAlerts(prev => [alert, ...prev]);
        });

        const handleTeacherReconnect = () => {
    setIsOnline(true);

    const currentQuiz = quizRef.current;

    if (currentQuiz && user) {
        const sessionStr = localStorage.getItem(`live_quiz_session_teacher_${joinCode}`);

        if (sessionStr) {
            try {
                const sess = JSON.parse(sessionStr);

                socket.emit('reconnectUser', {
                    quizId: sess.quizId,
                    user: {
                        username: sess.username,
                        role: sess.role
                    }
                });

            } catch (e) {

                socket.emit('join_room', {
                    quizId: currentQuiz.id,
                    user: {
                        username: user.username,
                        role: 'teacher'
                    }
                });

            }
        } else {

            socket.emit('join_room', {
                quizId: currentQuiz.id,
                user: {
                    username: user.username,
                    role: 'teacher'
                }
            });

        }
    }
};

socket.on('connect', handleTeacherReconnect);

/* IMPORTANT FIX
   If socket is already connected,
   connect event will NOT fire again.
*/
if (socket.connected) {
    handleTeacherReconnect();
}

        socket.on('disconnect', () => setIsOnline(false));

        return () => {
            if (quiz?.id) {
                socket.emit('leave_room', { quizId: quiz.id });
            }
            socket.off('participants_update');
            socket.off('student_progress_update');
            socket.off('progress_history');
            socket.off('question_leaderboard');
            socket.off('sync_timer');
            socket.off('restoreState');
            socket.off('quiz_ended');
            socket.off('quiz_started');
            socket.off('change_question');
            socket.off('student_focus_update');
            socket.off('student_cheat_warning');
            socket.off('connect');
            socket.off('disconnect');
        };
    }, [joinCode, user, navigate]);

    // Teacher Heartbeat Logic
    useEffect(() => {
    if (!quiz || !user) return;

    const sendHeartbeat = () => {
        if (socket.connected) {
            socket.emit('heartbeat', {
                quizId: quiz.id,
                userId: user.id || user.username
            });
        }
    };

    sendHeartbeat();

    const heartbeatId = setInterval(sendHeartbeat, 3000);

    return () => clearInterval(heartbeatId);
}, [quiz, user]);
    const handleStartQuiz = () => {
        if (quiz) {
            socket.emit('start_quiz', quiz.id);
            setIsTimerRunning(true);
        }
    };

    const handleEndQuiz = async () => {
        const result = await showConfirm(
            'Terminate Session?',
            'All live progress will be finalized. This action cannot be undone.',
            'End Quiz'
        );
        if (result.isConfirmed) {
            const toastId = toast.loading('Finalizing quiz results & generating analytics...');
            
            let hasNavigated = false;
            const goToAnalytics = () => {
                if (!hasNavigated) {
                    hasNavigated = true;
                    toast.dismiss(toastId);
                    navigate(`/analytics/quiz/${quiz.id}`);
                }
            };

            socket.once('quiz_ended_success', () => {
                goToAnalytics();
            });

            socket.emit('end_quiz', quiz.id);

            // Safety fallback: Navigate after 2.5 seconds max if socket event delayed
            setTimeout(() => {
                goToAnalytics();
            }, 2500);
        }
    };

    const handleNextQuestion = () => {
        if (isTransitioning.current) return;
        if (quiz && currentQuestion < quiz.questions.length - 1) {
            isTransitioning.current = true;
            const nextIdx = currentQuestion + 1;
            socket.emit('change_question', { quizId: quiz.id, questionIndex: nextIdx });
            setTimeout(() => {
                isTransitioning.current = false;
            }, 1000);
        }
    };

    const handlePrevSkippedQuestion = () => {
        if (isTransitioning.current) return;
        if (quiz && currentQuestion > 0) {
            // Find closest past question index where zero students submitted an answer
            let targetIdx = -1;
            for (let qIdx = currentQuestion - 1; qIdx >= 0; qIdx--) {
                let answerCount = 0;
                Object.keys(studentProgress).forEach(sId => {
                    if (studentProgress[sId]?.[qIdx]?.answered) {
                        answerCount++;
                    }
                });
                if (answerCount === 0) {
                    targetIdx = qIdx;
                    break;
                }
            }

            if (targetIdx !== -1) {
                isTransitioning.current = true;
                socket.emit('change_question', { quizId: quiz.id, questionIndex: targetIdx });
                toast.success(`Rolling back to skipped Question ${targetIdx + 1}`);
                setTimeout(() => {
                    isTransitioning.current = false;
                }, 1000);
            } else {
                toast.error("No skipped questions found in past timeline.");
            }
        }
    };



    // Offline / Reconnect handling
    useEffect(() => {
        const handleOffline = () => setIsOnline(false);
        const handleOnline = () => {
            setIsOnline(true);
            // Use quizRef so the handler always reads the latest quiz, not a stale closure
            const currentQuiz = quizRef.current;
            if (currentQuiz) {
                const sessionStr = localStorage.getItem(`live_quiz_session_teacher_${joinCode}`);
                if (sessionStr) {
                    try {
                        const sess = JSON.parse(sessionStr);
                        socket.emit('reconnectUser', { quizId: sess.quizId, user: { username: sess.username, role: sess.role } });
                    } catch (e) {
                         socket.emit('join_room', { quizId: currentQuiz.id, user: { username: user.username, role: 'teacher' } });
                    }
                } else {
                    socket.emit('join_room', { quizId: currentQuiz.id, user: { username: user.username, role: 'teacher' } });
                }
            }
        };
        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, [quiz, user]);

    const handleIncreaseTime = () => {
        socket.emit('increase_time', { quizId: quiz.id, additionalSeconds: 30 });
        showSuccess('Time Increased', 'Added 30 seconds to the clock!');
    };

    const copyCode = () => {
        navigator.clipboard.writeText(joinCode);
        showSuccess('Copied', 'Join Code copied!');
    };

    // Merge participants (connected) + leaderboard (submitted) so all students always show
    const allStudents = useMemo(() => {
        const map = new Map();
        const lbMap = new Map();
        leaderboard.forEach(l => lbMap.set(l.studentId?.toString(), l));
        // Also index by username fallback
        leaderboard.forEach(l => { if (l.username) lbMap.set(l.username, l); });

        // Seed from participants (includes isOnline state from server)
        participants.forEach(p => {
            const key = p._id?.toString() || p.username;
            const lb = lbMap.get(p._id?.toString()) || lbMap.get(p.username);
            map.set(key, { ...p, isOnline: p.isOnline === true, lb });
        });

        // Add any leaderboard entries not already in participants (joined but then disconnected before reconnecting)
        leaderboard.forEach(l => {
            const key = l.studentId?.toString();
            if (key && !map.has(key) && !map.has(l.username)) {
                map.set(key, {
                    username: l.username,
                    _id: l.studentId?.toString(),
                    role: 'student',
                    isOnline: false,
                    lb: l
                });
            }
        });

        // Sort: highest score first; ties broken by fastest total time
        return Array.from(map.values()).sort((a, b) => {
            const scoreA = a.lb?.currentScore ?? 0;
            const scoreB = b.lb?.currentScore ?? 0;
            if (scoreB !== scoreA) return scoreB - scoreA;
            const timeA = a.lb?.totalTimeTaken ?? Infinity;
            const timeB = b.lb?.totalTimeTaken ?? Infinity;
            return timeA - timeB;
        });
    }, [participants, leaderboard]);

    const [searchCheatQuery, setSearchCheatQuery] = useState('');

    const groupedCheatAlerts = useMemo(() => {
        const groups = {};
        cheatAlerts.forEach(alert => {
            const studentKey = alert.studentId || alert.rollNumber || alert.username || alert.studentRollNumber || 'N/A';
            const rollNo = alert.rollNumber || alert.username || alert.studentRollNumber || alert.studentId || 'N/A';
            const name = alert.name || alert.studentName || alert.username || 'Student';
            const action = alert.action || 'unknown';
            const details = alert.details || {};
            const alertTime = alert.timestamp ? new Date(alert.timestamp) : new Date();

            if (!groups[studentKey]) {
                groups[studentKey] = {
                    name,
                    rollNumber: rollNo,
                    actionsMap: { [action]: 1 },
                    details,
                    latestTime: alertTime,
                    totalCount: 1
                };
            } else {
                groups[studentKey].totalCount += 1;
                groups[studentKey].actionsMap[action] = (groups[studentKey].actionsMap[action] || 0) + 1;
                if (alertTime > groups[studentKey].latestTime) {
                    groups[studentKey].latestTime = alertTime;
                    groups[studentKey].details = details;
                }
            }
        });

        const list = Object.values(groups).sort((a, b) => b.latestTime - a.latestTime);
        if (!searchCheatQuery.trim()) return list;
        const query = searchCheatQuery.toLowerCase();
        return list.filter(item => 
            item.name.toLowerCase().includes(query) || 
            item.rollNumber.toLowerCase().includes(query) ||
            Object.keys(item.actionsMap).some(act => act.toLowerCase().includes(query))
        );
    }, [cheatAlerts, searchCheatQuery]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(allStudents.length / studentsPerPage));
    const paginatedStudents = allStudents.slice(
        (currentPage - 1) * studentsPerPage,
        currentPage * studentsPerPage
    );

    if (loading) return (
        <DashboardLayout role="teacher">
            <div className="flex flex-col items-center justify-center min-h-[70vh]">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-[var(--bg-accent)]/20 border-t-[var(--bg-accent)] rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Users className="text-[var(--text-accent)]" size={24} />
                    </div>
                </div>
                <p className="mt-6 font-black text-gray-400 uppercase tracking-widest animate-pulse">Initializing Room...</p>
            </div>
        </DashboardLayout>
    );

    // Quiz ended (auto or manually) — show fallback screen
    if (isQuizEnded || quiz?.status === 'finished') {
        return (
            <DashboardLayout role="teacher">
                <div className="max-w-2xl mx-auto py-24 text-center space-y-8">
                    <div className="w-24 h-24 bg-[var(--bg-accent)]/10 rounded-[2rem] flex items-center justify-center mx-auto">
                        <Trophy className="text-[var(--text-accent)]" size={48} />
                    </div>
                    <h1 className="type-page-title font-black italic uppercase text-gray-900 text-balance">Quiz <span className="text-[var(--text-accent)]">Ended</span></h1>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">The session has concluded. View results in the Performance tab.</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => navigate(`/leaderboard/${quiz.id}`)}
                            className="bg-[var(--bg-accent)] text-white px-10 py-5 rounded-[2rem] font-black italic uppercase tracking-tighter text-xl hover:scale-105 transition shadow-xl shadow-[var(--bg-accent)]/20 active:scale-95 border-b-4 border-orange-700"
                        >
                            View Leaderboard
                        </button>
                        <button
                            onClick={async () => {
                                const result = await showConfirm(
                                    'Return to Dashboard?',
                                    'Would you like to exit the live arena and return to your workspace?',
                                    'Yes, Exit'
                                );
                                if (result.isConfirmed) {
                                    navigate('/teacher-dashboard');
                                }
                            }}
                            className="bg-gray-100 text-gray-700 px-10 py-5 rounded-[2rem] font-black italic uppercase tracking-tighter text-xl hover:bg-gray-200 transition"
                        >
                            Dashboard
                        </button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    const isWaitingRoom = !quiz || quiz.status === 'waiting';

    if (isWaitingRoom) {
        return (
            <DashboardLayout role="teacher">
                <div className="max-w-6xl mx-auto space-y-6 sm:space-y-10 py-6 sm:py-10">
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.2rem] p-8 sm:p-10 lg:p-12 text-center shadow-[0_18px_40px_rgba(15,23,42,0.06)] relative overflow-hidden">
                        <div className="relative z-10 space-y-7">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-sm">
                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                <span className="text-[var(--text-primary)] font-black uppercase tracking-[0.22em] text-[10px] italic">Lobby is Open</span>
                            </div>
                            <h1 className="type-page-title font-black italic uppercase text-balance" style={{ color: 'var(--text-primary)' }}>
                                Waiting for <span className="text-[var(--text-accent)]">Participants</span>
                            </h1>
                            <div className="flex flex-col items-center gap-4">
                                <p className="text-[var(--text-secondary)] font-black uppercase tracking-[0.18em] text-[10px]">Join Code</p>
                                <div onClick={copyCode} className="bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--bg-accent)]/50 transition-all rounded-2xl p-5 sm:p-7 cursor-pointer group active:scale-95 shadow-sm w-full max-w-lg">
                                    <p className="text-4xl sm:text-6xl font-black tracking-[0.14em] sm:tracking-[0.2em] group-hover:scale-[1.02] transition-transform italic break-all text-[var(--text-primary)]">{joinCode}</p>
                                </div>
                            </div>
                            <div className="pt-4 flex flex-col items-center gap-5">
                                <button
                                    onClick={handleStartQuiz}
                                    disabled={participants.length === 0}
                                    className="group flex flex-row items-center justify-center gap-3 bg-[var(--bg-accent)] hover:bg-[var(--bg-accent-hover)] text-white px-8 sm:px-12 py-4 rounded-[1.5rem] transition-all shadow-[0_12px_22px_rgba(17,17,17,0.16)] font-black text-lg sm:text-xl italic uppercase tracking-[0.12em] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <Play size={22} className="group-hover:translate-x-1 transition-transform text-white fill-white" />
                                    <span>START GAME</span>
                                </button>
                                <p className="text-[var(--text-secondary)] font-black uppercase tracking-[0.18em] text-[10px]">{participants.length} {participants.length === 1 ? 'Student' : 'Students'} Joined</p>
                            </div>
                        </div>
                    </div>

                    {/* Participants in waiting room */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-2 space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                                    <Users className="text-[var(--text-accent)]" size={24} />
                                    Participants ({participants.length})
                                </h2>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {participants.map((p, idx) => (
                                    <div key={idx} className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)] flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                                        <div className="w-10 h-10 bg-[var(--bg-accent)] rounded-full flex items-center justify-center text-[var(--text-on-accent)] font-bold uppercase">
                                            {p.username ? p.username[0] : '?'}
                                        </div>
                                        <span className="font-bold text-[var(--text-primary)] truncate">{p.username || 'Unknown'}</span>
                                    </div>
                                ))}
                                {participants.length === 0 && (
                                    <div className="col-span-full py-12 text-center bg-[var(--bg-secondary)] rounded-2xl border-2 border-dashed border-[var(--border-color)]">
                                        <p className="text-[var(--text-secondary)] font-medium italic">No students joined yet...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-7xl mx-auto pb-20 space-y-0">

                {/* ─── OFFLINE BANNER ─────────────────────────────────────────────────── */}
                {!isOnline && (
                    <div className="bg-rose-600 px-6 py-3 flex items-center gap-3 text-white font-bold text-sm rounded-2xl mb-4 shadow-lg">
                        <WifiOff size={16} />
                        You are offline — reconnecting automatically...
                    </div>
                )}

                {/* ─── SESSION COMMAND STRIP ───────────────────────────────────────────── */}
                {/*
                    PRIMARY TEACHER CONTROLS — always visible, never buried.
                    Answers: Is session live? What question? What to do next?
                */}
                <div className="bg-white border-2 border-slate-200/80 rounded-[2rem] px-6 py-4 shadow-sm mb-6">
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 lg:gap-0 justify-between">

                        {/* LEFT: Session identity */}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            {/* Live badge */}
                            <div className="flex-shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black shadow-md shadow-emerald-500/20 border border-emerald-400/40">
                                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                                <span className="text-[10px] font-black uppercase tracking-[0.25em]">Live</span>
                            </div>
                            {/* Title */}
                            <div className="min-w-0">
                                <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] mb-0.5">Session</p>
                                <h1 className="text-slate-900 font-black italic uppercase text-base sm:text-lg leading-tight truncate max-w-[280px]">
                                    {cleanQuizTitle(quiz?.title) || 'Active Session'}
                                </h1>
                            </div>
                        </div>

                        {/* CENTER: Question Navigator */}
                        <div className="flex items-center justify-center gap-2 flex-shrink-0">
                            <button
                                onClick={handlePrevSkippedQuestion}
                                disabled={currentQuestion === 0}
                                className="h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 border border-slate-700 text-white font-black uppercase text-[11px] tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-md"
                                title="Go back to skipped questions"
                            >
                                <ChevronLeft size={14} strokeWidth={3} />
                                Back
                            </button>

                            {/* Question counter */}
                            <div className="px-5 py-2 rounded-xl bg-amber-500 shadow-md shadow-amber-500/20 border border-amber-400">
                                <p className="text-slate-950 font-black text-lg leading-none tracking-tight">
                                    Q<span className="text-2xl">{currentQuestion + 1}</span>
                                    <span className="text-slate-950/60 font-bold text-sm"> / {quiz?.questions?.length || 0}</span>
                                </p>
                            </div>

                            <button
                                onClick={handleNextQuestion}
                                disabled={currentQuestion >= (quiz?.questions?.length || 0) - 1}
                                className="h-10 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-600 hover:to-emerald-700 text-white font-black uppercase text-[11px] tracking-wider transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer border border-amber-400/40"
                            >
                                Next
                                <ChevronRight size={14} strokeWidth={3} />
                            </button>
                        </div>

                        {/* RIGHT: Actions + stats */}
                        <div className="flex items-center justify-end gap-3 flex-1 flex-wrap">

                            {/* Students online metric badge */}
                            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 font-black shadow-xs">
                                <span className="flex h-2.5 w-2.5 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                                </span>
                                <Users size={14} className="text-emerald-600" />
                                <span className="text-slate-900 font-black text-[11px] tracking-wider">{participants.length}</span>
                                <span className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">Online</span>
                            </div>

                            {/* Live leader */}
                            {liveInsights?.topStudent && (
                                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 font-black shadow-xs">
                                    <Award size={14} className="text-amber-600" />
                                    <span className="text-amber-700 font-black text-[10px] uppercase tracking-wider truncate max-w-[80px]">
                                        {liveInsights.topStudent}
                                    </span>
                                </div>
                            )}

                            {/* +30 sec button */}
                            <button
                                onClick={handleIncreaseTime}
                                className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500 font-black uppercase text-[10px] tracking-wider transition-all shadow-md shadow-indigo-500/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                            >
                                <Clock size={14} />
                                +30s
                            </button>

                            {/* End Session button */}
                            <button
                                onClick={handleEndQuiz}
                                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white border border-rose-500 font-black uppercase text-[10px] tracking-wider transition-all shadow-md shadow-rose-500/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                            >
                                <MinusCircle size={14} />
                                End
                            </button>
                        </div>
                    </div>
                </div>

                {/* ─── STATUS BAR — Access Code + Quiz Stats ──────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

                    {/* Access Code — Tap to copy */}
                    <div
                        onClick={copyCode}
                        className="col-span-1 bg-white border-2 border-slate-100 rounded-[1.5rem] p-5 cursor-pointer group active:scale-95 transition-all hover:border-[var(--bg-accent)]/30 hover:shadow-lg shadow-sm flex flex-col items-center justify-center gap-1 select-none"
                    >
                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Access Code</p>
                        <p className="text-4xl font-black tracking-[0.15em] italic text-[var(--bg-accent)] group-hover:scale-105 transition-transform">
                            {joinCode}
                        </p>
                        <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-300 mt-0.5">
                            <Copy size={10} /> Tap to Copy
                        </p>
                    </div>

                    {/* Progress snapshot */}
                    <div className="col-span-1 bg-white border-2 border-slate-100 rounded-[1.5rem] p-5 shadow-sm flex flex-col justify-center gap-3">
                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Progress</p>
                        {/* Answered vs total for current question */}
                        {(() => {
                            const answered = allStudents.filter(s => {
                                const pid = s._id || s.id || s.userId;
                                const pn = s.username;
                                const prog = (pid && studentProgress[pid]) || (pn && studentProgress[pn]) || {};
                                const d = prog[currentQuestion] || prog[currentQuestion?.toString()];
                                return d?.answered === true || d?.isCorrect !== undefined || d?.skipped === true;
                            }).length;
                            const pct = allStudents.length > 0 ? Math.round((answered / allStudents.length) * 100) : 0;
                            return (
                                <>
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-black text-slate-900 leading-none">{answered}</span>
                                        <span className="text-slate-400 font-bold text-sm mb-0.5">/ {allStudents.length} answered Q{currentQuestion + 1}</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[var(--bg-accent)] rounded-full transition-all duration-500"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Live leaderboard top-3 */}
                    <div className="col-span-1 bg-white border-2 border-slate-100 rounded-[1.5rem] p-5 shadow-sm flex flex-col gap-2">
                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 mb-1">Top Students</p>
                        {allStudents.slice(0, 3).map((s, i) => {
                            const rankColors = ['text-amber-500', 'text-slate-400', 'text-amber-700'];
                            return (
                                <div key={s.username || i} className="flex items-center gap-2">
                                    <span className={`text-xs font-black w-4 text-right ${rankColors[i] || 'text-slate-300'}`}>#{i + 1}</span>
                                    <span className="font-bold text-slate-700 text-xs truncate flex-1">{s.username || 'Unknown'}</span>
                                    <span className="font-black text-[var(--bg-accent)] text-xs">{s.lb?.currentScore ?? 0}pts</span>
                                </div>
                            );
                        })}
                        {allStudents.length === 0 && (
                            <p className="text-slate-300 text-xs font-bold italic">No scores yet</p>
                        )}
                    </div>
                </div>

                {/* ─── ACTIVE QUESTION CARD ────────────────────────────────────────────── */}
                {quiz?.questions?.[currentQuestion] && (
                    <div className="bg-white border-2 border-slate-200 rounded-[2rem] shadow-xl overflow-hidden mb-6">
                        {/* Dark high-contrast Card header */}
                        <div className="bg-slate-950 border-b border-slate-800 px-7 py-4 flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-md shadow-amber-500/30">
                                    <span className="text-slate-950 font-black text-base">{currentQuestion + 1}</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400">Active Question Preview</p>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Visible to Teacher Only · Answers Hidden</p>
                                </div>
                            </div>
                            <span className="px-3.5 py-1.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-wider border border-amber-500/30">
                                Q{currentQuestion + 1} of {quiz.questions.length}
                            </span>
                        </div>

                        {/* Question text */}
                        <div className="px-7 py-6">
                            <div className="mb-5">
                                <FormattedQuestionText
                                    questionText={quiz.questions[currentQuestion].questionText}
                                    textClassName="text-xl sm:text-2xl font-black text-slate-900 leading-snug"
                                />
                            </div>

                            {/* Options grid with bold high-contrast badges */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {quiz.questions[currentQuestion].options?.map((option, idx) => {
                                    const label = String.fromCharCode(65 + idx);
                                    const optionThemes = [
                                        { badge: 'bg-red-600 text-white font-black shadow-sm', border: 'border-red-300 bg-red-50/80 text-slate-900' },
                                        { badge: 'bg-blue-600 text-white font-black shadow-sm', border: 'border-blue-300 bg-blue-50/80 text-slate-900' },
                                        { badge: 'bg-amber-600 text-white font-black shadow-sm', border: 'border-amber-300 bg-amber-50/80 text-slate-900' },
                                        { badge: 'bg-emerald-600 text-white font-black shadow-sm', border: 'border-emerald-300 bg-emerald-50/80 text-slate-900' },
                                        { badge: 'bg-violet-600 text-white font-black shadow-sm', border: 'border-violet-300 bg-violet-50/80 text-slate-900' },
                                        { badge: 'bg-pink-600 text-white font-black shadow-sm', border: 'border-pink-300 bg-pink-50/80 text-slate-900' },
                                    ];
                                    const theme = optionThemes[idx % optionThemes.length];
                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-center gap-3.5 border-2 rounded-2xl p-4 transition-all shadow-xs ${theme.border}`}
                                        >
                                            <div className={`w-9 h-9 rounded-xl ${theme.badge} flex items-center justify-center font-black text-base flex-shrink-0 shadow-sm border border-white/20`}>
                                                {label}
                                            </div>
                                            <span className="font-bold text-slate-900 text-sm sm:text-base leading-snug">{option}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── LIVE STUDENT TRACKER (MATCHING SCREENSHOT 3) ──────────── */}
                <div className="bg-slate-950 rounded-[2rem] shadow-2xl border-2 border-slate-800 overflow-hidden text-white">
                    {/* Tracker header */}
                    <div className="bg-slate-900/90 border-b border-slate-800 px-7 py-5 flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h2 className="text-xl font-black italic uppercase tracking-tight flex items-center gap-2 text-white">
                                <Users size={20} className="text-amber-500" />
                                <span className="text-amber-500">LIVE</span>
                                <span>STUDENT TRACKER</span>
                            </h2>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                                {allStudents.length} TOTAL · {participants.length} CONNECTED · PAGE {currentPage}/{totalPages}
                            </p>
                        </div>
                        {/* Legend */}
                        <div className="flex items-center gap-4 flex-wrap text-xs font-bold">
                            {[
                                { color: 'bg-emerald-500', label: 'Correct' },
                                { color: 'bg-rose-500', label: 'Wrong' },
                                { color: 'bg-amber-500', label: 'Skipped' },
                                { color: 'bg-slate-600', label: 'Not Attempted' },
                            ].map(({ color, label }) => (
                                <div key={label} className="flex items-center gap-1.5">
                                    <div className={`w-3.5 h-3.5 rounded-full ${color}`} />
                                    <span className="text-slate-300 font-bold">{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Column headers */}
                    <div className="bg-slate-900/50 border-b border-slate-800/80 px-7 py-3 grid grid-cols-[60px_minmax(120px,180px)_80px_1fr_90px] items-center gap-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                        <div>RANK</div>
                        <div>STUDENT</div>
                        <div className="text-center">STATUS</div>
                        <div>QUESTIONS PROGRESS</div>
                        <div className="text-right">SCORE</div>
                    </div>

                    {/* Student rows */}
                    {paginatedStudents.length > 0 ? (
                        <div className="divide-y divide-slate-900">
                            {paginatedStudents.map((p, pIdx) => {
                                const globalIdx = (currentPage - 1) * studentsPerPage + pIdx;
                                const rank = p.lb?.rank ?? (globalIdx + 1);
                                const progressById = (p._id && studentProgress[p._id]) ? studentProgress[p._id]
                                    : (p.id && studentProgress[p.id]) ? studentProgress[p.id]
                                    : (p.userId && studentProgress[p.userId]) ? studentProgress[p.userId]
                                    : null;
                                const progressByName = p.username ? studentProgress[p.username] : null;
                                const progress = progressById || progressByName || {};
                                const score = p.lb?.currentScore ?? 0;

                                // Count answered on current question
                                const curData = progress[currentQuestion] || progress[currentQuestion?.toString()];
                                const hasAnsweredCurrent = curData?.answered === true || curData?.isCorrect !== undefined || curData?.skipped === true;

                                return (
                                    <div
                                        key={p.id || p.username || pIdx}
                                        className="px-7 py-4 grid grid-cols-[60px_minmax(120px,180px)_80px_1fr_90px] items-center gap-4 hover:bg-slate-900/60 transition-colors group"
                                    >
                                        {/* Rank */}
                                        <div className="flex items-center justify-start">
                                            {rank === 1 ? (
                                                <div className="w-9 h-9 bg-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
                                                    <Trophy size={18} className="text-slate-950 fill-slate-950" />
                                                </div>
                                            ) : rank === 2 ? (
                                                <div className="w-9 h-9 bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center font-black text-slate-200 text-xs">
                                                    #2
                                                </div>
                                            ) : rank === 3 ? (
                                                <div className="w-9 h-9 bg-amber-900/80 border border-amber-700 rounded-full flex items-center justify-center font-black text-amber-200 text-xs">
                                                    #3
                                                </div>
                                            ) : (
                                                <span className="text-slate-500 font-bold text-base font-mono">#{rank}</span>
                                            )}
                                        </div>

                                        {/* Student name */}
                                        <div className="min-w-0">
                                            <p className="font-bold text-white text-sm font-mono truncate">{p.username || 'Unknown'}</p>
                                        </div>

                                        {/* Online status */}
                                        <div className="flex justify-center">
                                            <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${p.isOnline
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                            }`}>
                                                <div className={`w-2 h-2 rounded-full ${p.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                                                {p.isOnline ? 'ON' : 'OFF'}
                                            </div>
                                        </div>

                                        {/* Question progress checkmark circles matching Screenshot 3 */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {quiz?.questions?.map((_, idx) => {
                                                const data = progress[idx] || progress[idx.toString()];
                                                const isCorrect = data?.isCorrect === true || data?.isCorrect === 'true' || data?.isCorrect === 1;
                                                const isSkipped = data?.skipped === true || data?.skipped === 'true';
                                                const isAnswered = data?.answered === true || data?.isCorrect !== undefined || isSkipped;

                                                let circleStyle = 'bg-slate-800 border-slate-700 text-slate-500';
                                                let IconSymbol = null;

                                                if (isAnswered) {
                                                    if (isCorrect) {
                                                        circleStyle = 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/20';
                                                        IconSymbol = <CheckCircle size={15} className="text-white" strokeWidth={3} />;
                                                    } else if (isSkipped) {
                                                        circleStyle = 'bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-500/20';
                                                        IconSymbol = <MinusCircle size={15} className="text-white" strokeWidth={3} />;
                                                    } else {
                                                        circleStyle = 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/20';
                                                        IconSymbol = <XCircle size={15} className="text-white" strokeWidth={3} />;
                                                    }
                                                }

                                                const isActive = idx === currentQuestion;

                                                return (
                                                    <div
                                                        key={idx}
                                                        title={isAnswered
                                                            ? (isCorrect ? `Q${idx + 1}: Correct` : isSkipped ? `Q${idx + 1}: Skipped` : `Q${idx + 1}: Incorrect`)
                                                            : `Q${idx + 1}: Pending`
                                                        }
                                                        className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${circleStyle} ${isActive
                                                            ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 scale-110 shadow-lg shadow-emerald-500/30'
                                                            : ''
                                                        }`}
                                                    >
                                                        {IconSymbol ?? <span className="text-[11px] font-bold">{idx + 1}</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                         {/* Score */}
                                        <div className="text-right font-black font-mono text-base text-white">
                                            {score} <span className="text-xs font-bold text-slate-400">pts</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-12 text-center text-slate-500 font-bold italic">
                            No students connected yet...
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-7 py-5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-4">
                            <p className="text-xs text-slate-400 font-bold">
                                Showing {(currentPage - 1) * studentsPerPage + 1}–{Math.min(currentPage * studentsPerPage, allStudents.length)} of {allStudents.length} students
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:bg-slate-700 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-9 h-9 rounded-xl font-black text-sm transition shadow-sm ${page === currentPage
                                            ? 'bg-amber-500 text-slate-950 shadow-amber-500/20'
                                            : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:bg-slate-700 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── SECURITY & CHEAT ALERT PANEL ────────────────────────────────────── */}
                {cheatAlerts.length > 0 && (
                    <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-100/60 border-2 border-rose-100 overflow-hidden mt-6">
                        {/* Panel header */}
                        <div className="bg-rose-900 px-7 py-5 flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <h2 className="text-lg font-black text-white italic uppercase tracking-tight flex items-center gap-2">
                                    <ShieldAlert size={18} className="text-rose-300" />
                                    Security Monitor
                                    <span className="ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest">
                                        {cheatAlerts.length} alerts
                                    </span>
                                </h2>
                                <p className="text-rose-300/60 text-[10px] font-black uppercase tracking-widest mt-1">
                                    Real-time suspicious activity tracking
                                </p>
                            </div>
                            {/* Search */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search by name or action..."
                                    value={searchCheatQuery}
                                    onChange={(e) => setSearchCheatQuery(e.target.value)}
                                    className="w-56 bg-rose-800/40 border border-rose-700/50 text-white placeholder:text-rose-400/60 rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:border-rose-400/60 transition-all"
                                />
                            </div>
                        </div>

                        {/* Alert rows */}
                        {groupedCheatAlerts.length === 0 ? (
                            <div className="py-10 text-center">
                                <ShieldCheck className="mx-auto text-emerald-200 mb-3" size={36} />
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No suspicious activity matches your search</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-rose-50">
                                {groupedCheatAlerts.map((item, idx) => {
                                    const violationCount = item.totalCount;
                                    const riskLevel = violationCount >= 5 ? 'CRITICAL' : violationCount >= 3 ? 'HIGH' : violationCount >= 2 ? 'MEDIUM' : 'LOW';
                                    const riskColors = {
                                        CRITICAL: 'bg-red-50 text-red-700 border-red-200',
                                        HIGH: 'bg-rose-50 text-rose-700 border-rose-200',
                                        MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
                                        LOW: 'bg-slate-50 text-slate-600 border-slate-200',
                                    };
                                    return (
                                        <div key={idx} className="px-7 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-rose-50/30 transition-colors">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                {/* Risk badge */}
                                                <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border ${riskColors[riskLevel]} flex-shrink-0`}>
                                                    {riskLevel}
                                                </div>
                                                {/* Student info */}
                                                <div className="min-w-0">
                                                    <p className="font-black text-slate-800 text-sm">{item.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono">{item.rollNumber}</p>
                                                </div>
                                            </div>
                                            {/* Actions list */}
                                            <div className="flex flex-wrap gap-1.5">
                                                {Object.entries(item.actionsMap).map(([action, count]) => (
                                                    <span key={action} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[9px] font-black uppercase tracking-wider">
                                                        <AlertTriangle size={10} />
                                                        {action.replace(/_/g, ' ')}
                                                        {count > 1 && <span className="ml-0.5 font-black">×{count}</span>}
                                                    </span>
                                                ))}
                                            </div>
                                            {/* Total + time */}
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-rose-600 font-black text-lg leading-none">{violationCount}</p>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">violations</p>
                                                <p className="text-[9px] text-slate-300 font-bold mt-0.5">{item.latestTime?.toLocaleTimeString?.() || ''}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

