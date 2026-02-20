import { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Award, CheckCircle, ChevronLeft, ChevronRight, BarChart3, Users, Play, Copy, Loader2, Clock, MinusCircle, Plus } from 'lucide-react';
import api from '../utils/api';
import socket from '../utils/socket';
import AuthContext from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';

export default function LiveRoomTeacher() {
    const { joinCode } = useParams();
    const { user } = useContext(AuthContext);
    const [participants, setParticipants] = useState([]);
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [studentProgress, setStudentProgress] = useState({});
    const [timeLeft, setTimeLeft] = useState(600); // Default 10 mins
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
    const [newQuestionData, setNewQuestionData] = useState({
        questionText: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        points: 10
    });
    const [leaderboard, setLeaderboard] = useState([]);
    const [liveInsights, setLiveInsights] = useState(null);
    const hasInitializedTimer = useRef(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const res = await api.post('/quiz/join', { code: joinCode });
                const quizRes = await api.get(`/quiz/${res.data.quizId}`);
                setQuiz(quizRes.data);
                socket.emit('join_room', { quizId: quizRes.data._id, user: { username: user.username, role: 'teacher' } });
            } catch (err) {
                console.error(err);
                alert('Error loading quiz');
                navigate('/teacher-dashboard');
            } finally {
                setLoading(false);
            }
        };

        fetchQuiz();

        socket.on('participants_update', (participantsList) => {
            const students = participantsList.filter(p => p.role !== 'teacher');
            setParticipants(students);
        });

        socket.on('progress_history', (history) => {
            setStudentProgress(history);
        });

        socket.on('quiz_started', () => {
            setQuiz(prev => prev ? { ...prev, status: 'started' } : null);
        });

        socket.on('student_progress_update', ({ studentId, username, questionIndex }) => {
            console.log('Received progress update:', { studentId, username, questionIndex });
            setStudentProgress(prev => {
                const newState = { ...prev };
                const qIdx = parseInt(questionIndex);
                if (studentId) {
                    newState[studentId] = { ...(newState[studentId] || {}), [qIdx]: true };
                }
                if (username) {
                    newState[username] = { ...(newState[username] || {}), [qIdx]: true };
                }
                return newState;
            });
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

        return () => {
            socket.off('participants_update');
            socket.off('student_progress_update');
            socket.off('progress_history');
            socket.off('question_leaderboard');
            socket.off('sync_timer');
        };
    }, [joinCode, user, navigate]);

    const handleStartQuiz = () => {
        if (quiz) {
            socket.emit('start_quiz', quiz._id);
            setIsTimerRunning(true);
        }
    };

    const handleEndQuiz = () => {
        if (window.confirm('End this quiz session?')) {
            socket.emit('end_quiz', quiz._id);
            navigate('/teacher-dashboard');
        }
    };

    useEffect(() => {
        if (!quiz || !isTimerRunning || quiz.status !== 'started') return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setIsTimerRunning(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [isTimerRunning, quiz?.status]);

    const handleIncreaseTime = () => {
        socket.emit('increase_time', { quizId: quiz._id, additionalSeconds: 30 });
        alert('Added 30 seconds to the clock!');
    };

    const handleNavigation = (direction) => {
        if (!quiz) return;
        let newIndex = currentQuestionIndex;
        if (direction === 'next') newIndex = Math.min(quiz.questions.length - 1, currentQuestionIndex + 1);
        else newIndex = Math.max(0, currentQuestionIndex - 1);

        if (newIndex !== currentQuestionIndex) {
            setCurrentQuestionIndex(newIndex);
            socket.emit('change_question', { quizId: quiz._id, questionIndex: newIndex });
            // Note: Timer is global, so we don't reset it here
        }
    };

    const copyCode = () => {
        navigator.clipboard.writeText(joinCode);
        alert('Join Code copied!');
    };

    if (loading) return (
        <DashboardLayout role="teacher">
            <div className="flex flex-col items-center justify-center min-h-[70vh]">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Users className="text-indigo-600" size={24} />
                    </div>
                </div>
                <p className="mt-6 font-black text-gray-400 uppercase tracking-widest animate-pulse">Initializing Room...</p>
            </div>
        </DashboardLayout>
    );

    const maxScore = leaderboard.length > 0
        ? Math.max(...leaderboard.map(l => l.currentScore || 0), 1)
        : 100;

    const isWaitingRoom = !quiz || quiz.status === 'waiting';

    if (isWaitingRoom) {
        return (
            <DashboardLayout role="teacher">
                <div className="max-w-6xl mx-auto space-y-12 py-10">
                    <div className="bg-indigo-900 rounded-[3rem] p-16 text-center text-white shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 space-y-8">
                            <div className="inline-block px-6 py-2 bg-white/10 rounded-full border border-white/20">
                                <span className="text-indigo-200 font-black uppercase tracking-[0.3em] text-sm italic">Lobby is Open</span>
                            </div>
                            <h1 className="text-7xl font-black italic uppercase tracking-tighter">Waiting for <span className="text-[#ff6b00]">Participants</span></h1>
                            <div className="flex flex-col items-center gap-4">
                                <p className="text-indigo-300 font-bold uppercase tracking-widest text-lg">Join Code</p>
                                <div onClick={copyCode} className="bg-white/5 border-2 border-white/10 hover:bg-white/10 transition-all rounded-3xl p-10 cursor-pointer group active:scale-95">
                                    <p className="text-8xl font-black tracking-[0.4em] group-hover:scale-105 transition-transform italic underline decoration-[#ff6b00] decoration-8 underline-offset-[16px]">{joinCode}</p>
                                </div>
                            </div>
                            <div className="pt-10 flex flex-col items-center gap-6">
                                <div className="flex flex-col items-center gap-2 mb-4">
                                    <p className="text-white/40 font-bold uppercase tracking-widest text-sm">Set Quiz Duration (Minutes)</p>
                                    <input
                                        type="number"
                                        value={Math.floor(timeLeft / 60)}
                                        onChange={(e) => {
                                            const mins = parseInt(e.target.value) || 1;
                                            setTimeLeft(mins * 60);
                                            // Optional: Sync this duration to DB via API if needed, but socket 'start_quiz' will handle it
                                            api.put(`/quiz/${quiz._id}`, { duration: mins });
                                        }}
                                        className="bg-white/5 border border-white/20 text-white text-5xl font-black rounded-2xl p-4 w-32 text-center focus:outline-none focus:border-[#ff6b00]"
                                    />
                                </div>
                                <button
                                    onClick={handleStartQuiz}
                                    disabled={participants.length === 0}
                                    className="group flex items-center gap-10 bg-[#ff6b00] text-white px-24 py-10 rounded-[3rem] hover:scale-105 transition-all shadow-2xl shadow-[#ff6b00]/30 font-black text-5xl italic uppercase tracking-tighter active:scale-95 border-b-[12px] border-[#cc5500] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Play size={60} fill="currentColor" className="group-hover:translate-x-2 transition-transform" />
                                    START GAME
                                </button>
                                <p className="text-white/40 font-bold uppercase tracking-widest text-sm">{participants.length} Students Joined</p>
                            </div>
                        </div>
                        {/* Background Decorations */}
                        <div className="absolute -top-20 -left-20 w-80 h-80 bg-indigo-600/20 rounded-full blur-[100px]"></div>
                        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-[#ff6b00]/10 rounded-full blur-[100px]"></div>
                    </div>

                    {/* Participants + Progress section in waiting room */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-2 space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <Users className="text-blue-600" size={24} />
                                    Participants ({participants.length})
                                </h2>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {participants.map((p, idx) => (
                                    <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold uppercase">
                                            {p.username ? p.username[0] : '?'}
                                        </div>
                                        <span className="font-bold text-gray-800 truncate">{p.username || 'Unknown'}</span>
                                    </div>
                                ))}
                                {participants.length === 0 && (
                                    <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                        <p className="text-gray-400 font-medium italic">No students joined yet...</p>
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
            <div className="max-w-6xl mx-auto space-y-10 pb-20">
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
                        {/* Decorative background element */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16"></div>
                    </div>

                    {/* Join Code Hub */}
                    <div onClick={copyCode} className="bg-indigo-900 rounded-[3rem] p-8 text-white shadow-2xl flex flex-col items-center justify-center min-w-[280px] cursor-pointer group hover:bg-indigo-950 transition-all active:scale-95 border-b-[8px] border-indigo-950">
                        <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] mb-2">ACCESS CODE</p>
                        <p className="text-6xl font-black tracking-[0.1em] italic text-[#ff6b00] group-hover:scale-110 transition-transform">{joinCode}</p>
                        <p className="mt-4 flex items-center gap-2 text-indigo-400 text-[10px] font-black uppercase tracking-widest opacity-60">
                            <Copy size={12} /> CLICK TO SYNC
                        </p>
                    </div>
                </div>

                {/* Primary Action Hub & Visualization */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Controls & Insights */}
                    <div className="lg:col-span-4 space-y-8">
                        <div className="bg-[#0f172a] rounded-[3rem] p-10 shadow-2xl border-b-[10px] border-slate-800">
                            <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-8 italic">Field Operations</h2>
                            <div className="space-y-6">
                                <button
                                    onClick={() => setShowAddQuestionModal(true)}
                                    className="w-full bg-indigo-600 text-white p-6 rounded-[2rem] font-black italic uppercase tracking-tighter hover:scale-[1.02] transition shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-4 text-xl border-b-4 border-indigo-900"
                                >
                                    <Plus size={24} /> ADD LIVE QUESTION
                                </button>

                                {/* Question Navigation */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleNavigation('prev')}
                                        disabled={currentQuestionIndex === 0}
                                        className="flex-1 bg-slate-700 text-white p-5 rounded-[2rem] font-black italic uppercase tracking-tighter hover:bg-slate-600 transition active:scale-95 flex items-center justify-center gap-2 text-lg border-b-4 border-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft size={22} /> Prev
                                    </button>
                                    <div className="flex flex-col items-center min-w-[60px]">
                                        <span className="text-white font-black text-2xl italic">{currentQuestionIndex + 1}</span>
                                        <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">/ {quiz?.questions?.length || 0}</span>
                                    </div>
                                    <button
                                        onClick={() => handleNavigation('next')}
                                        disabled={currentQuestionIndex === (quiz?.questions?.length || 1) - 1}
                                        className="flex-1 bg-indigo-600 text-white p-5 rounded-[2rem] font-black italic uppercase tracking-tighter hover:bg-indigo-500 transition active:scale-95 flex items-center justify-center gap-2 text-lg border-b-4 border-indigo-900 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        Next <ChevronRight size={22} />
                                    </button>
                                </div>

                                <button
                                    onClick={handleIncreaseTime}
                                    className="w-full bg-[#ff6b00] text-white p-6 rounded-[2rem] font-black italic uppercase tracking-tighter hover:scale-[1.02] transition shadow-lg shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-4 text-xl border-b-4 border-orange-700"
                                >
                                    <Clock size={24} /> ADD +30 SECONDS
                                </button>
                                <button
                                    onClick={handleEndQuiz}
                                    className="w-full bg-red-600/10 border-2 border-red-600/20 text-red-500 p-6 rounded-[2rem] font-black italic uppercase tracking-tighter hover:bg-red-600 hover:text-white transition active:scale-95 flex items-center justify-center gap-4 text-xl"
                                >
                                    <MinusCircle size={24} /> TERMINATE SESSION
                                </button>
                            </div>
                        </div>

                        {/* Top Performer Snippet */}
                        {liveInsights?.topStudent && (
                            <div className="bg-emerald-500 rounded-[3rem] p-8 text-white shadow-xl shadow-emerald-500/20 flex items-center gap-6">
                                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                                    <Award size={32} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Ringleader</p>
                                    <p className="text-2xl font-black italic uppercase">{liveInsights.topStudent}</p>
                                </div>
                            </div>
                        )}

                        {/* Student Progress Grid */}
                        {participants.length > 0 && (
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Student Progress</h3>
                                <div className="divide-y divide-gray-100">
                                    {participants.map((p, pIdx) => {
                                        // Get this student's progress record (check by _id first, then username)
                                        const progressById = p._id ? studentProgress[p._id] : null;
                                        const progressByName = p.username ? studentProgress[p.username] : null;
                                        const progress = progressById || progressByName || {};

                                        return (
                                            <div key={p._id || p.username || pIdx} className="py-3 flex items-center gap-3">
                                                <span className="font-medium text-gray-700 w-28 truncate text-sm">{p.username || 'Unknown'}</span>
                                                <div className="flex-1 flex items-center gap-1 flex-wrap">
                                                    {quiz?.questions?.map((_, idx) => {
                                                        const isAnswered = progress[idx] === true || progress[idx.toString()] === true;
                                                        const isPast = idx < currentQuestionIndex;
                                                        const isCurrent = idx === currentQuestionIndex;

                                                        // Color logic:
                                                        // answered → green
                                                        // past & not answered → red (missed)
                                                        // current or future → gray
                                                        let dotClass = 'bg-gray-100 border-gray-200 text-gray-400'; // future/current unanswered
                                                        if (isAnswered) {
                                                            dotClass = 'bg-green-500 border-green-500 text-white';
                                                        } else if (isPast) {
                                                            dotClass = 'bg-red-400 border-red-400 text-white';
                                                        }

                                                        return (
                                                            <div
                                                                key={idx}
                                                                title={isAnswered ? 'Answered' : isPast ? 'Missed' : 'Pending'}
                                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                                                                    ${dotClass}
                                                                    ${isCurrent ? 'ring-2 ring-indigo-500 ring-offset-1 scale-110' : ''}
                                                                `}
                                                            >
                                                                {idx + 1}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Performance Visualization (Vertical Bar Graph) */}
                    <div className="lg:col-span-8">
                        <div className="bg-white rounded-[4rem] p-12 shadow-2xl shadow-indigo-100/50 border border-slate-100 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-16">
                                <div>
                                    <h2 className="text-3xl font-black text-[#0f172a] italic uppercase tracking-tighter">Live <span className="text-[#ff6b00]">Leaderboard</span></h2>
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Real-time point distribution</p>
                                </div>
                                <BarChart3 className="text-slate-200" size={40} />
                            </div>

                            {leaderboard.length > 0 ? (
                                <div className="flex-1 flex items-end justify-between gap-6 min-h-[300px] px-4">
                                    {leaderboard.slice(0, 5).map((student, idx) => (
                                        <div key={idx} className="flex flex-col items-center flex-1 group h-full justify-end">
                                            <div className="mb-4 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-black italic opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                                {student.currentScore}
                                            </div>
                                            <div
                                                className={`w-full rounded-t-[1.5rem] transition-all duration-1000 ease-out shadow-2xl relative group-hover:brightness-110 ${idx === 0 ? 'bg-gradient-to-t from-[#ff6b00] to-orange-400 border-t-4 border-white' :
                                                    idx === 1 ? 'bg-indigo-600' :
                                                        idx === 2 ? 'bg-indigo-400' :
                                                            'bg-slate-200 group-hover:bg-indigo-200'
                                                    }`}
                                                style={{ height: `${Math.max((student.currentScore / (maxScore || 1)) * 100, 10)}%` }}
                                            >
                                                {idx === 0 && (
                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-orange-500 animate-bounce">
                                                        <Award size={24} fill="currentColor" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mt-6 text-[10px] font-black uppercase tracking-tighter truncate w-full text-center text-[#0f172a] italic opacity-80 group-hover:opacity-100">
                                                {student.username}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100">
                                    <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-200 mb-6 font-black text-4xl">?</div>
                                    <p className="text-slate-400 font-black uppercase tracking-widest italic text-xs">Waiting for the first strike...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Question Modal */}
            {showAddQuestionModal && (
                <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6 overflow-y-auto">
                    <div className="bg-white rounded-[3.5rem] p-12 max-w-2xl w-full shadow-2xl border border-slate-100 animate-in zoom-in duration-300">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h3 className="text-4xl font-black text-[#0f172a] italic uppercase tracking-tighter">Quick <span className="text-[#ff6b00]">Add</span></h3>
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Deploy a new challenge instantly</p>
                            </div>
                            <button onClick={() => setShowAddQuestionModal(false)} className="text-slate-300 hover:text-slate-900 transition-colors">
                                <MinusCircle size={32} />
                            </button>
                        </div>

                        <div className="space-y-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Question Text</label>
                                <input
                                    type="text"
                                    value={newQuestionData.questionText}
                                    onChange={(e) => setNewQuestionData({ ...newQuestionData, questionText: e.target.value })}
                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-3xl p-6 font-bold text-slate-800 outline-none transition-all"
                                    placeholder="Enter your spontaneous question..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {newQuestionData.options.map((opt, idx) => (
                                    <div key={idx} className="space-y-2">
                                        <div className="flex items-center justify-between px-4">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Option {idx + 1}</label>
                                            <input
                                                type="radio"
                                                name="correct-option"
                                                checked={newQuestionData.correctAnswer === opt && opt !== ''}
                                                onChange={() => setNewQuestionData({ ...newQuestionData, correctAnswer: opt })}
                                                className="w-4 h-4 text-indigo-600 border-slate-200 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            value={opt}
                                            onChange={(e) => {
                                                const newOpts = [...newQuestionData.options];
                                                newOpts[idx] = e.target.value;
                                                setNewQuestionData({ ...newQuestionData, options: newOpts });
                                            }}
                                            className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl p-4 font-bold text-slate-800 outline-none transition-all text-sm"
                                            placeholder={`Likely answer ${idx + 1}`}
                                        />
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => {
                                    if (!newQuestionData.questionText || !newQuestionData.correctAnswer) {
                                        return alert("Please fill in question and select correct answer!");
                                    }
                                    socket.emit('add_question', { quizId: quiz._id, question: { ...newQuestionData, type: 'multiple-choice' } });
                                    setQuiz(prev => ({ ...prev, questions: [...prev.questions, { ...newQuestionData, type: 'multiple-choice' }] }));
                                    setShowAddQuestionModal(false);
                                    setNewQuestionData({ questionText: '', options: ['', '', '', ''], correctAnswer: '', points: 10 });
                                    alert('Question broadcasted to all students!');
                                }}
                                className="w-full bg-[#ff6b00] text-white p-6 rounded-[2rem] font-black italic uppercase tracking-tighter hover:scale-[1.02] transition shadow-2xl shadow-orange-500/30 active:scale-95 text-2xl border-b-8 border-orange-700"
                            >
                                DEPLOY QUESTION
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
