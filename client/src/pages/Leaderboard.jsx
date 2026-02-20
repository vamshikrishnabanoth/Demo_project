import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import socket from '../utils/socket';
import AuthContext from '../context/AuthContext';
import { Trophy, Award, Medal, Users, Home, ArrowRight, Loader2, Plus, X, Play, BarChart3, TrendingUp } from 'lucide-react';

export default function Leaderboard() {
    const { quizId } = useParams();
    const { user } = useContext(AuthContext);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [quiz, setQuiz] = useState(null);
    const [showAddQuestion, setShowAddQuestion] = useState(false);
    const [newQuestion, setNewQuestion] = useState({
        questionText: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        points: 10
    });
    const navigate = useNavigate();
    const isStudent = user?.role === 'student';

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await api.get(`/quiz/leaderboard/${quizId}`);
                setResults(res.data);
                const quizRes = await api.get(`/quiz/${quizId}`);
                setQuiz(quizRes.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        socket.emit('join_room', { quizId, user: { username: user.username, role: user.role } });

        socket.on('score_updated', () => {
            fetchData();
        });

        return () => {
            socket.off('score_updated');
        };
    }, [quizId, user]);

    const handleAddQuestion = () => {
        if (!newQuestion.questionText || newQuestion.options.some(opt => !opt) || !newQuestion.correctAnswer) {
            alert('Please fill in all fields');
            return;
        }
        socket.emit('add_question', { quizId, question: { ...newQuestion, points: Number(newQuestion.points), type: 'multiple-choice' } });
        setNewQuestion({ questionText: '', options: ['', '', '', ''], correctAnswer: '', points: 10 });
        setShowAddQuestion(false);
        alert('Question added successfully!');
    };

    const getRankIcon = (index) => {
        switch (index) {
            case 0: return <Trophy className="text-yellow-400" size={32} fill="currentColor" />;
            case 1: return <Award className="text-gray-300" size={28} fill="currentColor" />;
            case 2: return <Medal className="text-amber-500" size={24} fill="currentColor" />;
            default: return <span className="text-lg font-black text-gray-500">#{index + 1}</span>;
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a]">
            <Loader2 className="animate-spin text-[#ff6b00]" size={64} />
            <p className="mt-6 font-black text-gray-500 uppercase tracking-widest animate-pulse">Calculating Rankings...</p>
        </div>
    );

    const maxScore = results.length > 0 ? Math.max(...results.map(r => r.score), 1) : 100;

    return (
        <div className="min-h-screen bg-[#0f172a] text-white py-12 px-4 relative overflow-hidden font-inter">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#ff6b00]/5 rounded-full blur-[120px] -mr-64 -mt-64"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] -ml-64 -mb-64"></div>

            <div className="max-w-6xl mx-auto space-y-12 relative z-10">
                {/* Header Section */}
                <div className="text-center space-y-6">
                    <div className="inline-flex items-center gap-4 px-6 py-2 bg-white/5 rounded-full border border-white/10 mb-4">
                        <TrendingUp className="text-[#ff6b00]" size={16} />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Final Standings</span>
                    </div>
                    <h1 className="text-6xl font-black italic uppercase tracking-tighter">
                        {quiz?.title || 'Quiz'} <span className="text-[#ff6b00]">Results</span>
                    </h1>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">A display of sheer brilliance and speed</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Performance Graph (Show for everyone, but bigger for students) */}
                    <div className={`${isStudent ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-8`}>
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                            <div className="flex items-center justify-between mb-12">
                                <h2 className="text-3xl font-black italic uppercase tracking-tight">
                                    Live <span className="text-[#ff6b00]">Performance Graph</span>
                                </h2>
                                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                                    <Users size={18} className="text-[#ff6b00]" />
                                    <span className="text-xs font-black uppercase tracking-widest">{results.length} Participants</span>
                                </div>
                            </div>

                            {results.length > 0 ? (
                                <div className="flex items-end justify-between gap-4 h-80 px-4 mt-8">
                                    {results.slice(0, 10).map((res, idx) => {
                                        const isCurrentUser = res.student._id === user.id;
                                        return (
                                            <div key={idx} className="flex flex-col items-center flex-1 group h-full justify-end">
                                                <div className={`mb-4 text-xs font-black italic transition-all ${isCurrentUser ? 'text-[#ff6b00] opacity-100' : 'text-indigo-300 opacity-0 group-hover:opacity-100'}`}>
                                                    {res.score}
                                                </div>
                                                <div
                                                    className={`w-full rounded-t-2xl transition-all duration-[1500ms] ease-out shadow-2xl relative ${isCurrentUser ? 'bg-gradient-to-t from-[#ff6b00] to-orange-400 ring-4 ring-orange-500/20' :
                                                            idx === 0 ? 'bg-indigo-500' :
                                                                idx === 1 ? 'bg-indigo-600' :
                                                                    idx === 2 ? 'bg-indigo-700' :
                                                                        'bg-white/10 group-hover:bg-white/20'
                                                        }`}
                                                    style={{ height: `${Math.max((res.score / (maxScore || 1)) * 100, 10)}%` }}
                                                >
                                                    {isCurrentUser && (
                                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-[#ff6b00] animate-bounce">
                                                            <div className="bg-white rounded-full p-1 shadow-xl">
                                                                <Award size={20} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`mt-6 text-[10px] font-black uppercase tracking-tighter truncate w-full text-center italic ${isCurrentUser ? 'text-[#ff6b00]' : 'text-gray-400'}`}>
                                                    {res.student.username}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-24 text-center">
                                    <BarChart3 className="mx-auto text-white/5 mb-6" size={80} />
                                    <p className="text-gray-500 font-bold uppercase tracking-widest italic">No statistical data available</p>
                                </div>
                            )}

                            {isStudent && (
                                <div className="mt-16 flex justify-center">
                                    <button
                                        onClick={() => navigate('/student-dashboard')}
                                        className="group flex items-center gap-6 bg-[#ff6b00] text-white px-12 py-6 rounded-3xl font-black italic uppercase tracking-tighter hover:scale-105 transition-all shadow-2xl shadow-orange-600/20 active:scale-95 text-2xl border-b-8 border-orange-700"
                                    >
                                        <Home size={30} className="group-hover:-translate-y-1 transition-transform" />
                                        BACK TO ACADEMY
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Teacher-Only Podium & List */}
                    {!isStudent && (
                        <div className="space-y-8">
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-10 shadow-2xl">
                                <h3 className="text-2xl font-black italic uppercase tracking-tight mb-8">Quick <span className="text-[#ff6b00]">Actions</span></h3>
                                <div className="space-y-4">
                                    <button
                                        onClick={() => setShowAddQuestion(true)}
                                        className="w-full flex items-center justify-between p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl transition-all group"
                                    >
                                        <span className="font-bold uppercase tracking-widest text-xs">Add Question</span>
                                        <Plus className="text-[#ff6b00] group-hover:rotate-90 transition-transform" />
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                const res = await api.get(`/quiz/${quizId}`);
                                                if (res.data?.joinCode) navigate(`/live-room-teacher/${res.data.joinCode}`);
                                            } catch (e) { navigate('/teacher-dashboard'); }
                                        }}
                                        className="w-full flex items-center justify-between p-6 bg-[#ff6b00] hover:bg-orange-500 rounded-3xl transition-all shadow-lg shadow-orange-600/20 group"
                                    >
                                        <span className="font-black italic uppercase tracking-tighter text-lg">Resume Control</span>
                                        <Play fill="currentColor" size={20} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                    <button
                                        onClick={() => navigate('/teacher-dashboard')}
                                        className="w-full flex items-center justify-between p-6 bg-white/10 hover:bg-white/20 rounded-3xl transition-all group"
                                    >
                                        <span className="font-bold uppercase tracking-widest text-xs text-gray-300">Dashboard</span>
                                        <Home size={18} className="group-hover:-translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Question Modal */}
            {showAddQuestion && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-[#1e293b] border border-white/10 rounded-[3rem] shadow-2xl max-w-2xl w-full p-10 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-3xl font-black italic uppercase italic tracking-tighter">Add <span className="text-[#ff6b00]">Question</span></h2>
                            <button onClick={() => setShowAddQuestion(false)} className="p-3 hover:bg-white/5 rounded-full text-gray-400">
                                <X size={28} />
                            </button>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Question Description</label>
                                <textarea
                                    value={newQuestion.questionText}
                                    onChange={(e) => setNewQuestion({ ...newQuestion, questionText: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white focus:outline-none focus:ring-2 focus:ring-[#ff6b00]/50"
                                    placeholder="What is the capital of..."
                                    rows={3}
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Options</label>
                                {newQuestion.options.map((opt, idx) => (
                                    <input
                                        key={idx}
                                        value={opt}
                                        onChange={(e) => {
                                            const newOpts = [...newQuestion.options];
                                            newOpts[idx] = e.target.value;
                                            setNewQuestion({ ...newQuestion, options: newOpts });
                                        }}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        placeholder={`Option ${idx + 1}`}
                                    />
                                ))}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Correct Choice</label>
                                <select
                                    value={newQuestion.correctAnswer}
                                    onChange={(e) => setNewQuestion({ ...newQuestion, correctAnswer: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none appearance-none"
                                >
                                    <option value="" className="bg-[#1e293b]">Select Answer</option>
                                    {newQuestion.options.filter(opt => opt).map((opt, idx) => (
                                        <option key={idx} value={opt} className="bg-[#1e293b]">{opt}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={handleAddQuestion}
                                className="w-full bg-[#ff6b00] text-white py-6 rounded-[2rem] font-black italic uppercase tracking-tighter text-xl hover:scale-[1.02] transition-all shadow-xl shadow-orange-600/20 active:scale-95"
                            >
                                Publish Question
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
