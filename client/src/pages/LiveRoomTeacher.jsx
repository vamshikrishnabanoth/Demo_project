import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import socket from '../utils/socket';
import DashboardLayout from '../components/DashboardLayout';
import AuthContext from '../context/AuthContext';
import { Users, Play, Copy, Loader2 } from 'lucide-react';

export default function LiveRoomTeacher() {
    const { joinCode } = useParams();
    const { user } = useContext(AuthContext);
    const [participants, setParticipants] = useState([]);
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [studentProgress, setStudentProgress] = useState({}); // { studentId: { [questionIndex]: true } }
    const [timeLeft, setTimeLeft] = useState(30); // Teacher-side timer
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const res = await api.post('/quiz/join', { code: joinCode });
                // Get full quiz details
                const quizRes = await api.get(`/quiz/${res.data.quizId}`);
                setQuiz(quizRes.data);

                // Join socket room
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

        // Listen for participant updates (full list)
        socket.on('participants_update', (participantsList) => {
            console.log('Participants updated:', participantsList);
            // Filter out teachers, only show students
            // Also filter out 'Unknown' or invalid names to be safe
            const students = participantsList.filter(p =>
                p.role !== 'teacher' &&
                p.username &&
                p.username.toLowerCase() !== 'unknown' &&
                p.username.toLowerCase() !== 'student'
            );
            setParticipants(students);
        });

        // Listen for progress history (on resume/refresh)
        socket.on('progress_history', (history) => {
            console.log("Restoring student progress:", history);
            setStudentProgress(history);
        });

        // Listen for new student progress
        socket.on('student_progress_update', ({ studentId, username, questionIndex }) => {
            console.log(`Progress Update: Student ${username} (${studentId}) - Question ${questionIndex}`);
            setStudentProgress(prev => {
                const newState = { ...prev };
                const qIdx = parseInt(questionIndex); // Ensure integer

                // Update by ID
                if (studentId) {
                    newState[studentId] = { ...(newState[studentId] || {}), [qIdx]: true };
                }
                // Update by Username (fallback)
                if (username) {
                    newState[username] = { ...(newState[username] || {}), [qIdx]: true };
                }

                return newState;
            });
        });

        // Keep user_joined for backward compatibility
        socket.on('user_joined', (newUser) => {
            console.log('User joined:', newUser);
            // Only add if not a teacher
            if (newUser.role !== 'teacher') {
                setParticipants(prev => {
                    // Deduplicate
                    const exists = prev.find(p => p.username === newUser.username || (p._id && newUser._id && p._id === newUser._id));
                    if (exists) {
                        // Update existing
                        return prev.map(p => (p.username === newUser.username || (p._id && newUser._id && p._id === newUser._id)) ? newUser : p);
                    }
                    // Add new if valid
                    if (newUser.username && newUser.username.toLowerCase() !== 'unknown' && newUser.username.toLowerCase() !== 'student') {
                        return [...prev, newUser];
                    }
                    return prev;
                });
            }
        });

        return () => {
            socket.off('participants_update');
            socket.off('student_progress_update');
            socket.off('progress_history');
            socket.off('user_joined');
        };
    }, [joinCode, user, navigate]);

    const handleStartQuiz = () => {
        if (quiz) {
            socket.emit('start_quiz', quiz._id);
            setIsTimerRunning(true); // Start local timer
        }
    };

    const handleEndQuiz = () => {
        if (window.confirm('Are you sure you want to END the quiz? This will submit for all students.')) {
            socket.emit('end_quiz', quiz._id);
            navigate('/teacher-dashboard');
        }
    };

    // Timer Logic for Auto-Advance
    useEffect(() => {
        // Only run timer if it's running AND we are NOT in global timer mode (duration > 0)
        // If duration > 0, the teacher controls it manually without auto-advance
        if (!isTimerRunning || !quiz || quiz.duration > 0) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    // Time's up for this question
                    // Auto-advance if not the last question
                    if (currentQuestionIndex < quiz.questions.length - 1) {
                        handleNavigation('next');
                    } else {
                        // End of quiz? Or just stop timer? 
                        // Usually we stop here.
                        setIsTimerRunning(false);
                    }
                    return 0; // Reset or hold at 0
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isTimerRunning, quiz, currentQuestionIndex]);

    const handleNavigation = (direction) => {
        if (!quiz) return;

        let newIndex = currentQuestionIndex;
        if (direction === 'next') {
            newIndex = Math.min(quiz.questions.length - 1, currentQuestionIndex + 1);
        } else {
            newIndex = Math.max(0, currentQuestionIndex - 1);
        }

        if (newIndex !== currentQuestionIndex) {
            setCurrentQuestionIndex(newIndex);
            socket.emit('change_question', { quizId: quiz._id, questionIndex: newIndex });
            // Reset timer for next question
            setTimeLeft(quiz.timerPerQuestion || 30);
            setIsTimerRunning(true);
        }
    };

    const copyCode = () => {
        navigator.clipboard.writeText(joinCode);
        alert('Join Code copied to clipboard!');
    };

    if (loading) return (
        <DashboardLayout role="teacher">
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-blue-600" size={48} />
            </div>
        </DashboardLayout>
    );

    if (!quiz) return (
        <DashboardLayout role="teacher">
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <h2 className="text-2xl font-bold text-gray-800">Quiz not found</h2>
                <button
                    onClick={() => navigate('/teacher-dashboard')}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
                >
                    Return to Dashboard
                </button>
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-2 text-center md:text-left">
                        <h1 className="text-3xl font-black text-gray-900">{quiz?.title}</h1>
                        <p className="text-gray-500 font-medium">Waiting for students to join...</p>
                    </div>

                    <div className="flex flex-col items-center bg-blue-50 p-6 rounded-2xl border-2 border-blue-100 cursor-pointer hover:bg-blue-100 transition-all" onClick={copyCode}>
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Join Code</span>
                        <span className="text-4xl font-black text-blue-900 tracking-widest">{joinCode}</span>
                        <div className="flex items-center gap-1 mt-2 text-blue-500 text-xs font-bold uppercase">
                            <Copy size={12} /> Click to Copy
                        </div>
                    </div>
                </div>

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

                        {/* Student Progress Grid */}
                        {participants.length > 0 && (
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mt-8">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Student Progress</h3>
                                <div className="divide-y divide-gray-100">
                                    {participants.map((p, pIdx) => (
                                        <div key={p.username || pIdx} className="py-3 flex items-center justify-between">
                                            <span className="font-medium text-gray-700 w-32 truncate">{p.username || 'Unknown'}</span>
                                            <div className="flex-1 flex items-center gap-1 overflow-x-auto">
                                                {quiz?.questions?.map((_, idx) => {
                                                    // Chech by ID OR Username to be safe
                                                    const byId = p._id && studentProgress[p._id] && studentProgress[p._id][idx];
                                                    const byName = p.username && studentProgress[p.username] && studentProgress[p.username][idx];
                                                    const isAnswered = byId || byName;

                                                    const isCurrent = idx === currentQuestionIndex;

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 
                                                                ${isAnswered ? 'bg-green-500 border-green-500 text-white' : 'bg-gray-50 border-gray-200 text-gray-400'}
                                                                ${isCurrent ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
                                                            `}
                                                        >
                                                            {idx + 1}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>

                    <div className="space-y-6">
                        <div className="bg-indigo-600 text-white p-8 rounded-3xl shadow-xl shadow-indigo-100 space-y-6">
                            <h3 className="text-lg font-bold">Live Controls</h3>

                            <div className="flex items-center justify-between bg-indigo-800/30 p-4 rounded-xl">
                                <span className="text-sm font-bold">Current Question: {currentQuestionIndex + 1} / {quiz?.questions?.length || 0}</span>
                                <div className={`flex items-center gap-2 px-3 py-1 rounded-lg font-mono font-bold ${timeLeft <= 5 && !quiz?.duration ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-900 text-indigo-100'}`}>
                                    <span className="text-xs uppercase opacity-75">Timer</span>
                                    <span>{quiz?.duration > 0 ? 'MANUAL' : `${timeLeft}s`}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handleNavigation('prev')}
                                    disabled={currentQuestionIndex === 0}
                                    className="bg-white/10 hover:bg-white/20 p-3 rounded-xl text-sm font-bold disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => handleNavigation('next')}
                                    disabled={!quiz?.questions || currentQuestionIndex === (quiz.questions.length - 1)}
                                    className="bg-white text-indigo-600 hover:bg-indigo-50 p-3 rounded-xl text-sm font-bold disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>

                            <div className="border-t border-indigo-500/30 pt-4 space-y-3">
                                <button
                                    onClick={handleStartQuiz}
                                    // disabled={participants.length === 0} 
                                    className="w-full bg-green-500 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-green-600 transition-all shadow-lg active:scale-95"
                                >
                                    <Play size={20} fill="currentColor" />
                                    Start / Sync Students
                                </button>

                                <button
                                    onClick={handleEndQuiz}
                                    className="w-full bg-red-500/20 text-red-100 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-500/40 transition-all"
                                >
                                    Stop & End Quiz
                                </button>
                            </div>

                            <button
                                onClick={() => navigate(`/leaderboard/${quiz?._id}`)}
                                className="w-full bg-indigo-800/30 text-indigo-100 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-800/50 transition-all"
                            >
                                View Live Leaderboard
                            </button>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-4">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Quick Instructions</h4>
                            <div className="space-y-3">
                                <p className="text-xs text-gray-600 flex gap-2">
                                    <span className="w-4 h-4 bg-gray-100 rounded-full flex items-center justify-center text-[10px] flex-shrink-0">1</span>
                                    Share the 6-digit code with your class.
                                </p>
                                <p className="text-xs text-gray-600 flex gap-2">
                                    <span className="w-4 h-4 bg-gray-100 rounded-full flex items-center justify-center text-[10px] flex-shrink-0">2</span>
                                    Wait for names to appear in the list.
                                </p>
                                <p className="text-xs text-gray-600 flex gap-2">
                                    <span className="w-4 h-4 bg-gray-100 rounded-full flex items-center justify-center text-[10px] flex-shrink-0">3</span>
                                    Click "Start Quiz" to launch the session.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
