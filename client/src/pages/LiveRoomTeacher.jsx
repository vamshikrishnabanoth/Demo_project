import { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Award, Users, Play, Copy, Loader2, Clock, MinusCircle, WifiOff, Trophy, CheckCircle, XCircle, ChevronRight, ChevronLeft, Minus, ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
import api from '../utils/api';
import socket from '../utils/socket';
import AuthContext from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { showConfirm, showError, showSuccess } from '../utils/alerts';
import toast from 'react-hot-toast';
import throttle from '../utils/throttle';

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
                    if (Array.isArray(logsRes.data) && logsRes.data.length > 0) {
                        const formattedLogs = logsRes.data.map(log => ({
                            name: log.studentName || log.student?.name || log.student?.username || 'Student',
                            rollNumber: log.studentRollNumber || log.student?.username || 'N/A',
                            action: log.action,
                            timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
                            details: log.details
                        }));
                        setCheatAlerts(formattedLogs);
                    }
                } catch (logErr) {
                    console.warn('Could not load persistent suspicious activities:', logErr);
                }

                // Emit join_room — works whether socket is already connected or just connecting
                socket.emit('join_room', { quizId: quizRes.data.id, user: { username: user.username, role: 'teacher' } });
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
                p => p.role?.toLowerCase() !== 'teacher' && p.isOnline !== false
            );
            setParticipants([...students]);
        }, 300);

        const handleProgressUpdate = throttle(({ studentId, username, questionIndex, isCorrect }) => {
            setStudentProgress(prev => {
                const newState = { ...prev };
                const qIdx = parseInt(questionIndex);
                const progressEntry = { answered: true, isCorrect };
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
        }, 250);

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
            if (quiz && !quiz.duration) {
                setTimeLeft(quiz.timerPerQuestion || 30);
                setIsTimerRunning(true);
            }
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

        socket.on('sync_timer', ({ timeLeft }) => {
            console.log('Syncing timer from server:', timeLeft);
            setTimeLeft(timeLeft);
            if (timeLeft > 0) setIsTimerRunning(true);
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
                    p =>
                        p.role?.toLowerCase() !== 'teacher' &&
                        p.isOnline !== false
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
            socket.emit('end_quiz', quiz.id);
            navigate('/teacher-dashboard');
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

    useEffect(() => {
        if (!quiz) return;

        if (quiz.duration > 0) {
            if (!hasInitializedTimer.current) {
                setTimeLeft(quiz.duration * 60);
                hasInitializedTimer.current = true;
            }
        } else if (!isTimerRunning && quiz.status === 'started' && timeLeft === 30) {
            setTimeLeft(quiz.timerPerQuestion || 30);
            setIsTimerRunning(true);
        }

        if (!isTimerRunning || quiz.status !== 'started') return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    setIsTimerRunning(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [isTimerRunning, quiz]);

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

    // Merge participants (connected) + leaderboard (submitted) so reconnected students always show
    const allStudents = useMemo(() => {
        const map = new Map();
        // Build a leaderboard lookup for scores/rank
        const lbMap = new Map();
        leaderboard.forEach(l => lbMap.set(l.username, l));

        participants.forEach(p => map.set(p.username, { ...p, isOnline: p.isOnline !== false, lb: lbMap.get(p.username) }));
        leaderboard.forEach(l => {
            if (!map.has(l.username)) {
                map.set(l.username, {
                    username: l.username,
                    _id: l.studentId?.toString(),
                    role: 'student',
                    isOnline: false,
                    lb: l
                });
            }
        });

        // Sort by score descending (those with leaderboard data first)
        return Array.from(map.values()).sort((a, b) => {
            const scoreA = a.lb?.currentScore ?? -1;
            const scoreB = b.lb?.currentScore ?? -1;
            return scoreB - scoreA;
        });
    }, [participants, leaderboard]);

    const [searchCheatQuery, setSearchCheatQuery] = useState('');

    const groupedCheatAlerts = useMemo(() => {
        const groups = {};
        cheatAlerts.forEach(alert => {
            const rollNo = alert.rollNumber || alert.username || alert.studentRollNumber || 'N/A';
            const action = alert.action || 'unknown';
            const key = `${rollNo}-${action}`;
            const details = alert.details || {};
            
            if (!groups[key]) {
                groups[key] = {
                    name: alert.name || alert.studentName || 'Student',
                    rollNumber: rollNo,
                    action: action,
                    details: details,
                    latestTime: alert.timestamp ? new Date(alert.timestamp) : new Date(),
                    count: 1
                };
            } else {
                groups[key].count += 1;
                const alertTime = alert.timestamp ? new Date(alert.timestamp) : new Date();
                if (alertTime > groups[key].latestTime) {
                    groups[key].latestTime = alertTime;
                    groups[key].details = details;
                }
            }
        });
        const list = Object.values(groups).sort((a, b) => b.latestTime - a.latestTime);
        if (!searchCheatQuery.trim()) return list;
        const query = searchCheatQuery.toLowerCase();
        return list.filter(item => 
            item.name.toLowerCase().includes(query) || 
            item.rollNumber.toLowerCase().includes(query) ||
            item.action.toLowerCase().includes(query)
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
                    <h1 className="text-4xl sm:text-5xl font-black italic uppercase tracking-tighter text-gray-900 text-balance">Quiz <span className="text-[var(--text-accent)]">Ended</span></h1>
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
                <div className="max-w-6xl mx-auto space-y-12 py-10">
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[3rem] p-16 text-center text-white shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 space-y-8">
                            <div className="inline-block px-6 py-2 bg-[var(--bg-accent)]/10 rounded-full border border-[var(--bg-accent)]/30">
                                <span className="text-[var(--text-accent)] font-black uppercase tracking-[0.3em] text-sm italic">Lobby is Open</span>
                            </div>
                            <h1 className="text-4xl sm:text-6xl font-black italic uppercase tracking-tighter text-balance">Waiting for <span className="text-[var(--text-accent)]">Participants</span></h1>
                            <div className="flex flex-col items-center gap-4">
                                <p className="text-white/50 font-bold uppercase tracking-widest text-lg">Join Code</p>
                                <div onClick={copyCode} className="bg-white/5 border-2 border-[var(--bg-accent)]/20 hover:bg-[var(--bg-accent)]/10 hover:border-[var(--bg-accent)]/50 transition-all rounded-3xl p-6 sm:p-8 cursor-pointer group active:scale-95 overflow-hidden">
                                    <p className="text-5xl sm:text-7xl font-black tracking-[0.2em] sm:tracking-[0.4em] group-hover:scale-105 transition-transform italic underline decoration-[var(--text-accent)] decoration-4 sm:decoration-8 underline-offset-[16px] break-all">{joinCode}</p>
                                </div>
                            </div>
                            <div className="pt-10 flex flex-col items-center gap-6">
                                <button
                                    onClick={handleStartQuiz}
                                    disabled={participants.length === 0}
                                    className="group flex flex-col sm:flex-row items-center gap-6 sm:gap-8 bg-[var(--bg-accent)] text-[var(--text-on-accent)] px-10 sm:px-20 py-5 sm:py-8 rounded-[2.5rem] sm:rounded-[3rem] hover:scale-105 transition-all shadow-2xl shadow-[var(--bg-accent)]/30 font-black text-2xl sm:text-4xl italic uppercase tracking-tighter active:scale-95 border-b-[6px] sm:border-b-[10px] border-[var(--bg-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed btn-glow"
                                >
                                    <Play size={32} className="sm:w-[48px] sm:h-[48px] group-hover:translate-x-2 transition-transform" fill="currentColor" />
                                    START GAME
                                </button>
                                <p className="text-white/40 font-bold uppercase tracking-widest text-sm">{participants.length} Students Joined</p>
                            </div>
                        </div>
                        {/* Background Decorations */}
                        <div className="absolute -top-20 -left-20 w-80 h-80 bg-[var(--bg-accent)]/10 rounded-full blur-[100px]"></div>
                        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-[var(--bg-accent)]/10 rounded-full blur-[100px]"></div>
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
                                        <p className="text-white/30 font-medium italic">No students joined yet...</p>
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
            <div className="max-w-6xl mx-auto space-y-8 pb-20">
                {/* Global Status Bar */}
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Time & Title */}
                    <div className="flex-1 bg-white border-2 border-slate-100 rounded-[3rem] p-8 shadow-2xl shadow-slate-200/50 relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`px-5 py-2 rounded-full font-black italic flex items-center gap-2 text-2xl ${timeLeft <= 20 ? 'bg-red-500 text-white animate-pulse' : 'bg-[#0f172a] text-white'}`}>
                                    <Clock size={28} /> {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                                </div>
                                <span className="text-slate-300 font-bold tracking-widest uppercase text-xs">REMAINING TIME</span>
                            </div>
                            <h1 className="text-4xl font-black text-[#0f172a] italic uppercase tracking-tighter truncate">
                                {quiz?.title || 'Active Session'}
                            </h1>
                        </div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--bg-accent)]/5 rounded-full -mr-16 -mt-16"></div>
                    </div>

                    {/* Join Code Hub */}
                    <div onClick={copyCode} className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[3rem] p-8 text-white shadow-2xl flex flex-col items-center justify-center min-w-[280px] cursor-pointer group hover:border-[var(--bg-accent)]/50 transition-all active:scale-95 border-b-[8px]">
                        <p className="text-[var(--text-accent)]/60 text-[10px] font-black uppercase tracking-[0.4em] mb-2">ACCESS CODE</p>
                        <p className="text-6xl font-black tracking-[0.1em] italic text-[var(--text-accent)] group-hover:scale-110 transition-transform">{joinCode}</p>
                        <p className="mt-4 flex items-center gap-2 text-white/30 text-[10px] font-black uppercase tracking-widest opacity-60">
                            <Copy size={12} /> CLICK TO SYNC
                        </p>
                    </div>
                </div>

                {/* Offline Banner */}
                {!isOnline && (
                    <div className="bg-orange-500 rounded-2xl px-6 py-4 flex items-center gap-3 text-white font-bold text-sm">
                        <WifiOff size={18} />
                        You are offline — reconnecting...
                    </div>
                )}

                {/* Session Controls — Compact Row */}
                <div className="bg-[#0f172a] rounded-[2rem] p-6 shadow-2xl border-b-[6px] border-slate-800">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        {/* Question Navigation */}
                        <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-5 py-3">
                            <button
                                onClick={handlePrevSkippedQuestion}
                                disabled={currentQuestion === 0}
                                className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg font-bold uppercase tracking-tight text-xs transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                                title="Revisit skipped questions only"
                            >
                                <ChevronLeft size={14} /> Back
                            </button>
                            <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Q{currentQuestion + 1}/{quiz?.questions?.length || 0}</p>
                            <button
                                onClick={handleNextQuestion}
                                disabled={currentQuestion >= (quiz?.questions?.length || 0) - 1}
                                className="button disabled:opacity-50 disabled:pointer-events-none"
                            >
                                <span>Next</span>
                                <svg viewBox="0 0 13 10">
                                    <polygon points="0.5 0 6.5 5 0.5 10"></polygon>
                                    <polygon points="4.5 0 10.5 5 4.5 10"></polygon>
                                    <polygon points="8.5 0 13 5 8.5 10"></polygon>
                                </svg>
                            </button>
                        </div>

                        <button
                            onClick={handleIncreaseTime}
                            className="bg-[var(--bg-accent)] text-white px-6 py-3 rounded-xl font-black italic uppercase tracking-tighter hover:scale-[1.02] transition shadow-lg shadow-[var(--bg-accent)]/20 active:scale-95 flex items-center gap-2 text-sm border-b-2 border-orange-700"
                        >
                            <Clock size={18} /> +30 SEC
                        </button>

                        <button
                            onClick={handleEndQuiz}
                            className="bg-red-600/10 border-2 border-red-600/20 text-red-500 px-6 py-3 rounded-xl font-black italic uppercase tracking-tighter hover:bg-red-600 hover:text-white transition active:scale-95 flex items-center gap-2 text-sm"
                        >
                            <MinusCircle size={18} /> END SESSION
                        </button>

                        {/* Top Performer */}
                        {liveInsights?.topStudent && (
                            <div className="ml-auto flex items-center gap-3 bg-emerald-500 rounded-xl px-5 py-3 text-white">
                                <Award size={20} />
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest opacity-80">Leader</p>
                                    <p className="text-sm font-black italic uppercase">{liveInsights.topStudent}</p>
                                </div>
                            </div>
                        )}

                        {/* Participants Count */}
                        <div className="flex items-center gap-2 bg-white/5 px-4 py-3 rounded-xl border border-white/10">
                            <Users size={16} className="text-[var(--text-accent)]" />
                            <span className="text-xs font-black uppercase tracking-widest text-white">{participants.length} Online</span>
                        </div>
                    </div>
                </div>

                {/* Active Question Preview */}
                {quiz?.questions?.[currentQuestion] && (
                    <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-8 shadow-2xl shadow-slate-100/80 relative overflow-hidden">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="px-4 py-1.5 bg-[#0f172a] text-white rounded-full text-xs font-black uppercase tracking-wider italic">
                                Active Question Preview
                            </span>
                            <span className="text-slate-300 font-bold tracking-widest uppercase text-xs">
                                Visible to Teacher Only · Answers Hidden
                            </span>
                        </div>

                        <h3 className="text-2xl font-black text-[#0f172a] mb-6 leading-tight">
                            {quiz.questions[currentQuestion].questionText}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {quiz.questions[currentQuestion].options?.map((option, idx) => {
                                const label = String.fromCharCode(65 + idx);
                                return (
                                    <div 
                                        key={idx}
                                        className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 transition hover:bg-slate-100/50"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-[#0f172a]/10 flex items-center justify-center text-[#0f172a] font-black text-sm">
                                            {label}
                                        </div>
                                        <span className="font-bold text-slate-700 text-sm">{option}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Live Proctoring & Security Dashboard */}
                <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-100/80 border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                    <div className="bg-red-500/5 border-b border-red-100 px-8 py-5 flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h2 className="text-xl font-black text-red-600 italic uppercase tracking-tighter flex items-center gap-2">
                                <ShieldAlert size={22} className={cheatAlerts.length > 0 ? "animate-pulse text-red-500" : ""} />
                                Live Proctoring & <span className="text-red-700">Suspicious Activity Log Table</span>
                            </h2>
                            <p className="text-red-500/70 text-[10px] font-black uppercase tracking-widest mt-1">
                                Real-time cheating alerts & persistent database audit history
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search Roll No or Student..."
                                    value={searchCheatQuery}
                                    onChange={(e) => setSearchCheatQuery(e.target.value)}
                                    className="px-4 py-1.5 text-xs rounded-xl border border-red-200 bg-white font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 w-52"
                                />
                            </div>
                            <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                                cheatAlerts.length > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500'
                            }`}>
                                {cheatAlerts.length} {cheatAlerts.length === 1 ? 'Event' : 'Events'} ({groupedCheatAlerts.length} Students)
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-8">
                        {groupedCheatAlerts.length > 0 ? (
                            <div className="max-h-[380px] overflow-y-auto pr-2">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Student Name</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Roll Number</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Suspicious Activity Type</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Details</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Timestamp</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Violations</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {groupedCheatAlerts.map((record, index) => {
                                            const timeStr = record.latestTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                            const dateStr = record.latestTime.toLocaleDateString();
                                            
                                            let eventName = record.action?.replace(/_/g, ' ');
                                            let badgeStyle = 'bg-red-50 border-red-100 text-red-600';
                                            let icon = <AlertTriangle size={12} />;

                                            if (record.action === 'tab_switch') {
                                                eventName = 'Tab Switch Detected';
                                                badgeStyle = 'bg-red-100 border-red-200 text-red-700';
                                            } else if (record.action === 'inactivity') {
                                                eventName = '30s Tab Inactivity';
                                                badgeStyle = 'bg-amber-50 border-amber-200 text-amber-700';
                                                icon = <Clock size={12} />;
                                            } else if (record.action === 'window_blur') {
                                                eventName = 'Window Focus Loss';
                                                badgeStyle = 'bg-orange-50 border-orange-200 text-orange-700';
                                            } else if (record.action === 'devtools_shortcut') {
                                                eventName = 'DevTools Shortcut Intercepted';
                                                badgeStyle = 'bg-purple-50 border-purple-200 text-purple-700';
                                            } else if (record.action === 'devtools_resize') {
                                                eventName = 'DevTools Window Resize';
                                                badgeStyle = 'bg-purple-50 border-purple-200 text-purple-700';
                                            } else if (record.action === 'screenshot_attempt') {
                                                eventName = 'Screenshot / Capture Attempt';
                                                badgeStyle = 'bg-rose-100 border-rose-200 text-rose-800';
                                            } else if (record.action === 'multi_monitor_detected') {
                                                eventName = 'Secondary Monitor Detected';
                                                badgeStyle = 'bg-blue-50 border-blue-200 text-blue-700';
                                            } else if (record.action === 'clipboard_block' || record.action === 'clipboard') {
                                                eventName = 'Clipboard Copy/Paste Block';
                                            } else if (record.action === 'context_block' || record.action === 'contextmenu') {
                                                eventName = 'Right Click Block';
                                            }

                                            const detailStr = record.details?.key ? `Key: ${record.details.key}` :
                                                             record.details?.idleDurationSeconds ? `Idle: ${record.details.idleDurationSeconds}s` :
                                                             record.details?.blurDurationSeconds ? `Blurred: ${record.details.blurDurationSeconds}s` :
                                                             record.details?.switchCount ? `Switch #${record.details.switchCount}` : 'Monitored activity';

                                            return (
                                                <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="font-bold text-slate-800 text-sm">{record.name}</span>
                                                    </td>
                                                    <td className="px-6 py-4 font-mono text-xs text-slate-500 font-bold">
                                                        {record.rollNumber}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-[10px] font-black uppercase tracking-wider ${badgeStyle}`}>
                                                            {icon} {eventName}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                                                        {detailStr}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                                                        {dateStr} {timeStr}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 rounded-full bg-red-600 text-white font-black text-xs shadow-md shadow-red-500/20">
                                                            {record.count}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="py-10 text-center flex flex-col items-center justify-center">
                                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-4 border border-emerald-100">
                                    <ShieldCheck size={28} className="animate-pulse" />
                                </div>
                                <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-1">Secure Environment</h4>
                                <p className="text-slate-400 font-bold text-xs">No integrity violations detected from active participants.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Floating Live Security Feed Container (Notifications List) */}
                {cheatAlerts.length > 0 && (
                    <div className="fixed bottom-6 right-6 z-50 w-96 bg-slate-900/95 backdrop-blur-xl border border-red-500/30 rounded-3xl shadow-2xl shadow-black/60 overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                        <div className="bg-red-600/90 px-5 py-3 flex items-center justify-between text-white">
                            <div className="flex items-center gap-2">
                                <ShieldAlert size={18} className="animate-pulse" />
                                <span className="text-xs font-black uppercase tracking-wider">Live Security Feed ({cheatAlerts.length})</span>
                            </div>
                            <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">Real-time Stream</span>
                        </div>
                        <div className="p-4 max-h-60 overflow-y-auto space-y-2.5">
                            {cheatAlerts.slice(0, 8).map((alert, i) => {
                                const roll = alert.rollNumber || alert.username || alert.studentRollNumber || 'Student';
                                const name = alert.name || alert.studentName || 'Student';
                                const act = alert.action?.replace(/_/g, ' ') || 'suspicious activity';
                                const timeStr = alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();

                                return (
                                    <div key={i} className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3 text-xs">
                                        <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0 animate-ping"></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between font-bold text-white">
                                                <span className="truncate">{name} ({roll})</span>
                                                <span className="text-[10px] text-slate-400 font-mono">{timeStr}</span>
                                            </div>
                                            <p className="text-[11px] text-red-300 font-medium capitalize mt-0.5">
                                                Triggered: {act}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Student Progress — Full Width Table with Dots */}
                <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-100/80 border border-slate-100 overflow-hidden">
                    {/* Header */}
                    <div className="bg-[#0f172a] px-8 py-5 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">
                                Live <span className="text-[var(--text-accent)]">Student Tracker</span>
                            </h2>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">
                                {allStudents.length} Total · {participants.length} Connected · Page {currentPage}/{totalPages}
                            </p>
                        </div>
                        {/* Legend */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-md bg-green-500"></div>
                                <span className="text-[10px] font-bold text-slate-400">Correct</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-md bg-red-500"></div>
                                <span className="text-[10px] font-bold text-slate-400">Wrong</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-md bg-gray-200 border border-gray-300"></div>
                                <span className="text-[10px] font-bold text-slate-400">Not Attempted</span>
                            </div>
                        </div>
                    </div>

                    {/* Column Headers */}
                    <div className="bg-slate-50 border-b border-slate-100 flex items-center gap-4">
                        <div className="w-12 table-header-premium text-center">Rank</div>
                        <div className="w-40 table-header-premium text-left px-0">Student</div>
                        <div className="w-16 table-header-premium text-center px-0">Status</div>
                        <div className="flex-1 table-header-premium text-left px-0">Questions Progress</div>
                        <div className="w-20 table-header-premium text-center px-0">Score</div>
                    </div>

                    {/* Student Rows */}
                    {paginatedStudents.length > 0 ? (
                        <div className="divide-y divide-slate-50">
                            {paginatedStudents.map((p, pIdx) => {
                                const globalIdx = (currentPage - 1) * studentsPerPage + pIdx;
                                const rank = globalIdx + 1;
                                // Participants from socket store DB id as _id (PostgreSQL UUID)
                                // Progress dict is keyed by studentId (UUID) or username as fallback
                                const progressById = (p._id && studentProgress[p._id]) ? studentProgress[p._id]
                                    : (p.id && studentProgress[p.id]) ? studentProgress[p.id]
                                    : null;
                                const progressByName = p.username ? studentProgress[p.username] : null;
                                const progress = progressById || progressByName || {};
                                const score = p.lb?.currentScore ?? 0;

                                return (
                                    <div
                                        key={p.id || p.username || pIdx}
                                        className="px-8 py-4 flex items-center gap-4 hover:bg-slate-50/80 transition-colors group"
                                    >
                                        {/* Rank */}
                                        <div className="w-12 text-center">
                                            {rank === 1 ? (
                                                <div className="w-10 h-10 mx-auto bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
                                                    <Trophy size={18} className="text-white" />
                                                </div>
                                            ) : rank === 2 ? (
                                                <div className="w-10 h-10 mx-auto bg-gradient-to-br from-slate-300 to-slate-400 rounded-xl flex items-center justify-center shadow-lg shadow-slate-400/20">
                                                    <span className="text-white font-black text-sm">#2</span>
                                                </div>
                                            ) : rank === 3 ? (
                                                <div className="w-10 h-10 mx-auto bg-gradient-to-br from-amber-600 to-amber-700 rounded-xl flex items-center justify-center shadow-lg shadow-amber-700/20">
                                                    <span className="text-white font-black text-sm">#3</span>
                                                </div>
                                            ) : (
                                                <span className="text-lg font-black text-slate-300 italic">#{rank}</span>
                                            )}
                                        </div>

                                        {/* Student Name / Roll No */}
                                        <div className="w-40 min-w-0">
                                            <p className="font-bold text-slate-800 truncate text-sm">{p.username || 'Unknown'}</p>
                                            {p.id && (
                                                <p className="text-[10px] text-slate-400 font-mono truncate">{p.id}</p>
                                            )}
                                        </div>

                                        {/* Online/Offline Status */}
                                        <div className="w-16 flex justify-center">
                                            <div className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${p.isOnline
                                                ? 'bg-green-50 text-green-600 border border-green-200'
                                                : 'bg-red-50 text-red-500 border border-red-200'
                                                }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${p.isOnline ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]'}`}></div>
                                                {p.isOnline ? 'ON' : 'OFF'}
                                            </div>
                                        </div>

                                        {/* Question Dots */}
                                        <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                                            {quiz?.questions?.map((_, idx) => {
                                                const data = progress[idx] || progress[idx.toString()];
                                                const isAnswered = data?.answered === true;
                                                const isCorrect = data?.isCorrect === true;

                                                let dotClass = 'bg-gray-100 border-gray-200 text-gray-400';
                                                let Icon = null;

                                                if (isAnswered) {
                                                    if (isCorrect) {
                                                        dotClass = 'bg-green-500 border-green-500 text-white';
                                                        Icon = <CheckCircle size={14} />;
                                                    } else {
                                                        dotClass = 'bg-red-500 border-red-500 text-white';
                                                        Icon = <XCircle size={14} />;
                                                    }
                                                } else if (!p.isOnline && idx < currentQuestion) {
                                                    dotClass = 'bg-gray-50 border-gray-200 text-gray-300';
                                                    Icon = <Minus size={12} />;
                                                }

                                                return (
                                                    <div
                                                        key={idx}
                                                        title={isAnswered ? (isCorrect ? `Q${idx + 1}: Correct` : `Q${idx + 1}: Incorrect`) : `Q${idx + 1}: Not Attempted`}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border-2 transition-all shadow-sm ${dotClass} ${idx === currentQuestion ? 'ring-2 ring-[var(--bg-accent)] ring-offset-1 scale-110' : ''}`}
                                                    >
                                                        {Icon ? Icon : idx + 1}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Score */}
                                        <div className="w-20 text-center">
                                            <span className="text-lg font-black text-[var(--text-accent)] italic">{score}</span>
                                            <span className="text-[10px] text-slate-400 font-bold ml-0.5">pts</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-20 text-center">
                            <Users className="mx-auto text-slate-200 mb-4" size={48} />
                            <p className="text-slate-400 font-bold uppercase tracking-widest italic text-xs">No students have joined yet...</p>
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            <p className="text-xs text-slate-400 font-bold">
                                Showing {(currentPage - 1) * studentsPerPage + 1}–{Math.min(currentPage * studentsPerPage, allStudents.length)} of {allStudents.length} students
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-10 h-10 rounded-xl font-black text-sm transition shadow-sm ${page === currentPage
                                            ? 'bg-[var(--bg-accent)] text-white shadow-[var(--bg-accent)]/20'
                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
