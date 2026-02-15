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
            const students = participantsList.filter(p => p.role !== 'teacher');
            setParticipants(students);
        });

        // Keep user_joined for backward compatibility
        socket.on('user_joined', (newUser) => {
            console.log('User joined:', newUser);
            // Only add if not a teacher
            if (newUser.role !== 'teacher') {
                setParticipants(prev => {
                    if (prev.find(p => p.username === newUser.username)) return prev;
                    return [...prev, newUser];
                });
            }
        });

        return () => {
            socket.off('participants_update');
            socket.off('user_joined');
        };
    }, [joinCode, user, navigate]);

    const handleStartQuiz = () => {
        if (quiz) {
            socket.emit('start_quiz', quiz._id);
            // Navigate to leaderboard to see results as they come in
            navigate(`/leaderboard/${quiz._id}`);
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
                                        {p.username[0]}
                                    </div>
                                    <span className="font-bold text-gray-800 truncate">{p.username}</span>
                                </div>
                            ))}
                            {participants.length === 0 && (
                                <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                    <p className="text-gray-400 font-medium italic">No students joined yet...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-indigo-600 text-white p-8 rounded-3xl shadow-xl shadow-indigo-100 space-y-6">
                            <h3 className="text-lg font-bold">Ready to Begin?</h3>
                            <p className="text-indigo-100 text-sm leading-relaxed">
                                Once all your students have joined the room, click the button below to start the assessment for everyone simultaneously.
                            </p>
                            <button
                                onClick={handleStartQuiz}
                                disabled={participants.length === 0}
                                className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:scale-100"
                            >
                                <Play size={20} fill="currentColor" />
                                Start Quiz
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
