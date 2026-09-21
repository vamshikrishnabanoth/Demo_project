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
            <div className="max-w-6xl mx-auto space-y-8 pb-20">
                {/* Global Status Bar */}
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Time & Title */}
                    <div className="flex-1 bg-white border-2 border-slate-100 rounded-[3rem] p-8 shadow-2xl shadow-slate-200/50 relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="px-5 py-2 rounded-full font-black italic flex items-center gap-2 text-sm bg-emerald-500 text-white shadow-md">
                                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span> LIVE SESSION
                                </div>
                            </div>
                            <h1 className="type-page-title font-black text-[#0f172a] italic uppercase truncate">
                                {cleanQuizTitle(quiz?.title) || 'Active Session'}
                            </h1>
                        </div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--bg-accent)]/5 rounded-full -mr-16 -mt-16"></div>
                    </div>

                    {/* Join Code Hub */}
                    <div onClick={copyCode} className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[3rem] p-6 sm:p-8 text-white shadow-2xl flex flex-col items-center justify-center w-full sm:w-auto min-w-0 sm:min-w-[240px] cursor-pointer group hover:border-[var(--bg-accent)]/50 transition-all active:scale-95 border-b-[8px]">
                        <p className="text-[var(--text-accent)]/60 text-[10px] font-black uppercase tracking-[0.4em] mb-2">ACCESS CODE</p>
                        <p className="text-4xl sm:text-6xl font-black tracking-[0.1em] italic text-[var(--text-accent)] group-hover:scale-110 transition-transform">{joinCode}</p>
                        <p className="mt-4 flex items-center gap-2 text-white/30 text-[10px] font-black uppercase tracking-widest opacity-60">
                            <Copy size={12} /> CLICK TO SYNC
                        </p>
                    </div>
                </div>

                {/* Offline Banner */}
                {!isOnline && (
                    <div className="bg-[#f97316] rounded-2xl px-6 py-4 flex items-center gap-3 text-white font-bold text-sm">
                        <WifiOff size={18} />
                        You are offline — reconnecting...
                    </div>
                )}

                {/* Session Controls — High-Contrast Modern Control Panel */}
                <div className="bg-[var(--bg-accent)] border border-[var(--bg-accent)] rounded-[1.7rem] p-3 sm:p-4 shadow-[0_18px_32px_rgba(15,23,42,0.12)] text-white">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                        <div className="flex items-center justify-center gap-3 bg-white/8 border border-white/10 rounded-2xl p-2 shadow-inner w-full md:w-auto">
                            <button
                                onClick={handlePrevSkippedQuestion}
                                disabled={currentQuestion === 0}
                                className="bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-xl font-black uppercase tracking-[0.18em] text-[10px] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
                                title="Revisit skipped questions only"
                            >
                                <ChevronLeft size={14} /> Back
                            </button>

                            <div className="px-3 py-2 bg-white/8 rounded-xl border border-white/10">
                                <p className="text-amber-300 text-[10px] font-black uppercase tracking-[0.2em]">
                                    Q{currentQuestion + 1} <span className="text-white/60 font-bold">/</span> {quiz?.questions?.length || 0}
                                </p>
                            </div>

                            <button
                                onClick={handleNextQuestion}
                                disabled={currentQuestion >= (quiz?.questions?.length || 0) - 1}
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl font-black uppercase tracking-[0.18em] text-[10px] transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
                            >
                                <span>Next</span>
                                <ChevronRight size={14} strokeWidth={3} />
                            </button>
                        </div>

                        <div className="flex items-center justify-center gap-3 flex-wrap w-full md:w-auto">
                            <button
                                onClick={handleIncreaseTime}
                                className="bg-white/10 hover:bg-white/15 text-white border border-white/10 px-4 py-2.5 rounded-xl font-black uppercase tracking-[0.18em] transition-all shadow-sm active:scale-95 flex items-center gap-2 text-[10px]"
                            >
                                <Clock size={16} /> +30 SEC
                            </button>

                            <button
                                onClick={handleEndQuiz}
                                className="bg-rose-500/20 hover:bg-rose-500 text-rose-100 border border-rose-400/30 px-4 py-2.5 rounded-xl font-black uppercase tracking-[0.18em] transition-all shadow-sm active:scale-95 flex items-center gap-2 text-[10px]"
                            >
                                <MinusCircle size={16} /> End Session
                            </button>
                        </div>

                        <div className="flex items-center justify-center gap-3 w-full md:w-auto">
                            {liveInsights?.topStudent && (
                                <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-400/30 rounded-xl px-3 py-2 text-emerald-200">
                                    <Award size={16} />
                                    <div>
                                        <p className="text-[7px] font-black uppercase tracking-[0.2em] opacity-80">Leader</p>
                                        <p className="text-[10px] font-black uppercase tracking-[0.12em]">{liveInsights.topStudent}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2 bg-white/8 border border-white/10 px-3 py-2.5 rounded-xl shadow-xs">
                                <span className="flex h-2.5 w-2.5 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                                </span>
                                <Users size={14} className="text-white/70" />
                                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{participants.length} Online</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Active Question Preview */}
                {quiz?.questions?.[currentQuestion] && (
                    <div className="bg-white border-2 border-slate-100 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 md:p-8 shadow-2xl shadow-slate-100/80 relative overflow-hidden w-full max-w-full">
                        <div className="flex flex-wrap items-center gap-2 mb-4 md:mb-6">
                            <span className="px-3 py-1 sm:px-4 sm:py-1.5 bg-[var(--bg-accent)] text-[var(--text-on-accent)] rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider italic">
                                Active Question Preview
                            </span>
                            <span className="text-slate-400 font-bold tracking-widest uppercase text-[10px] sm:text-xs">
                                Visible to Teacher Only · Answers Hidden
                            </span>
                        </div>

                        <div className="mb-4 sm:mb-6 w-full max-w-full overflow-hidden">
                            <FormattedQuestionText 
                                questionText={quiz.questions[currentQuestion].questionText} 
                                textClassName="text-base sm:text-xl md:text-2xl font-black text-[#0f172a] leading-tight"
                            />
                        </div>

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

                {/* Student Progress — Full Width Table with Live Dots (BEFORE Security Dashboard) */}
                <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-100/80 border border-slate-100 overflow-hidden">
                    {/* Header */}
                    <div className="bg-[var(--bg-accent)] px-8 py-5 flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">
                                Live <span className="text-white/80">Student Tracker</span>
                            </h2>
                            <p className="text-white/50 text-[10px] font-black uppercase tracking-widest mt-1">
                                {allStudents.length} Total · {participants.length} Connected · Page {currentPage}/{totalPages}
                            </p>
                        </div>
                        {/* Legend */}
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3.5 h-3.5 rounded-md bg-green-500"></div>
                                <span className="text-[10px] font-bold text-white/90">Correct</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3.5 h-3.5 rounded-md bg-red-500"></div>
                                <span className="text-[10px] font-bold text-white/90">Wrong</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3.5 h-3.5 rounded-md bg-amber-500"></div>
                                <span className="text-[10px] font-bold text-white/90">Skipped</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3.5 h-3.5 rounded-md bg-gray-200 border border-gray-300"></div>
                                <span className="text-[10px] font-bold text-white/90">Not Attempted</span>
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
                                // Use server-provided rank from leaderboard if available; otherwise use position
                                const rank = p.lb?.rank ?? (globalIdx + 1);
                                // Progress dict is keyed by studentId (UUID) or username as fallback
                                const progressById = (p._id && studentProgress[p._id]) ? studentProgress[p._id]
                                    : (p.id && studentProgress[p.id]) ? studentProgress[p.id]
                                    : (p.userId && studentProgress[p.userId]) ? studentProgress[p.userId]
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

                                        {/* Question Dots — Live Real-Time Response Visualizer */}
                                        <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                                            {quiz?.questions?.map((_, idx) => {
                                                const data = progress[idx] || progress[idx.toString()];
                                                const isAnswered = data?.answered === true || data?.isCorrect !== undefined || data?.skipped === true;
                                                const isCorrect = data?.isCorrect === true;
                                                const isSkipped = data?.skipped === true;

                                                let dotClass = 'bg-gray-100 border-gray-200 text-gray-400';
                                                let Icon = null;

                                                if (isAnswered) {
                                                    if (isCorrect) {
                                                        dotClass = 'bg-green-500 border-green-500 text-white shadow-xs';
                                                        Icon = <CheckCircle size={14} />;
                                                    } else if (isSkipped) {
                                                        dotClass = 'bg-amber-500 border-amber-500 text-white shadow-xs';
                                                        Icon = <MinusCircle size={14} />;
                                                    } else {
                                                        dotClass = 'bg-red-500 border-red-500 text-white shadow-xs';
                                                        Icon = <XCircle size={14} />;
                                                    }
                                                } else if (!p.isOnline && idx < currentQuestion) {
                                                    dotClass = 'bg-gray-50 border-gray-200 text-gray-300';
                                                    Icon = <Minus size={12} />;
                                                }

                                                return (
                                                    <div
                                                        key={idx}
                                                        title={isAnswered ? (isCorrect ? `Q${idx + 1}: Correct` : isSkipped ? `Q${idx + 1}: Skipped` : `Q${idx + 1}: Incorrect`) : `Q${idx + 1}: Not Attempted`}
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
