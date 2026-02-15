import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import socket from '../utils/socket';
import AuthContext from '../context/AuthContext';
import { Trophy, Award, Medal, Users, Home, ArrowRight, Loader2, Plus, X } from 'lucide-react';

export default function Leaderboard() {
    const { quizId } = useParams();
    const { user } = useContext(AuthContext);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddQuestion, setShowAddQuestion] = useState(false);
    const [newQuestion, setNewQuestion] = useState({
        questionText: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        points: 10
    });
    const navigate = useNavigate();

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await api.get(`/quiz/leaderboard/${quizId}`);
                setResults(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();

        // Join socket room for real-time updates
        socket.emit('join_room', { quizId, user: { username: user.username, role: user.role } });

        // Listen for score updates
        socket.on('score_updated', () => {
            fetchLeaderboard(); // Refresh leaderboard when scores update
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

        // Emit to socket
        socket.emit('add_question', { quizId, question: { ...newQuestion, points: Number(newQuestion.points), type: 'multiple-choice' } });

        // Reset form and close modal
        setNewQuestion({
            questionText: '',
            options: ['', '', '', ''],
            correctAnswer: '',
            points: 10
        });
        setShowAddQuestion(false);
        alert('Question added successfully! Students will see it now.');
    };

    const getRankIcon = (index) => {
        switch (index) {
            case 0: return <Trophy className="text-yellow-500" size={32} fill="currentColor" />;
            case 1: return <Award className="text-gray-400" size={28} fill="currentColor" />;
            case 2: return <Medal className="text-amber-600" size={24} fill="currentColor" />;
            default: return <span className="text-lg font-black text-gray-400">#{index + 1}</span>;
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header Section */}
                <div className="text-center space-y-4">
                    <div className="inline-block bg-yellow-100 p-4 rounded-full shadow-lg border-4 border-white">
                        <Trophy className="text-yellow-600" size={48} fill="currentColor" />
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 uppercase italic tracking-tight">Quiz Leaderboard</h1>
                    <p className="text-gray-500 font-medium">Behold the masters of wisdom! Top 10 scorers shown below.</p>
                </div>

                {/* Podium Section (Top 3) */}
                {results.length >= 3 && (
                    <div className="grid grid-cols-3 gap-4 items-end pt-12">
                        {/* 2nd Place */}
                        <div className="flex flex-col items-center gap-4 group">
                            <div className="relative">
                                <div className="w-20 h-20 bg-gray-200 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-2xl font-black text-gray-500">
                                    {results[1].student.username[0]}
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-white p-1.5 rounded-full shadow-md text-gray-400">
                                    <Award size={20} fill="currentColor" />
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-gray-800 truncate max-w-[100px]">{results[1].student.username}</p>
                                <p className="text-2xl font-black text-gray-400">{results[1].score}</p>
                            </div>
                            <div className="w-full bg-gray-200 h-24 rounded-t-3xl shadow-inner group-hover:bg-gray-300 transition-colors"></div>
                        </div>

                        {/* 1st Place */}
                        <div className="flex flex-col items-center gap-4 group relative -top-8">
                            <div className="relative">
                                <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full border-4 border-white shadow-2xl flex items-center justify-center text-3xl font-black text-white">
                                    {results[0].student.username[0]}
                                </div>
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 animate-bounce">
                                    <Trophy className="text-yellow-500" size={32} fill="currentColor" />
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="font-black text-gray-900 truncate max-w-[120px]">{results[0].student.username}</p>
                                <p className="text-3xl font-black text-yellow-600">{results[0].score}</p>
                            </div>
                            <div className="w-full bg-yellow-500 h-40 rounded-t-3xl shadow-xl group-hover:bg-yellow-600 transition-colors"></div>
                        </div>

                        {/* 3rd Place */}
                        <div className="flex flex-col items-center gap-4 group">
                            <div className="relative">
                                <div className="w-16 h-16 bg-amber-100 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-xl font-black text-amber-600">
                                    {results[2].student.username[0]}
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-white p-1 rounded-full shadow-md text-amber-600">
                                    <Medal size={18} fill="currentColor" />
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-gray-800 truncate max-w-[80px]">{results[2].student.username}</p>
                                <p className="text-xl font-black text-amber-600">{results[2].score}</p>
                            </div>
                            <div className="w-full bg-amber-600 h-16 rounded-t-3xl shadow-inner group-hover:bg-amber-700 transition-colors opacity-80"></div>
                        </div>
                    </div>
                )}

                {/* List Section (remaining) */}
                <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                        <div className="flex items-center gap-2 text-gray-500 uppercase tracking-widest text-xs font-black">
                            <Users size={16} /> Rankings
                        </div>
                        <div className="text-xs font-black text-gray-400 uppercase">Score</div>
                    </div>

                    <div className="divide-y divide-gray-50">
                        {results.length > 0 ? results.map((res, idx) => (
                            <div key={idx} className={`p-6 flex items-center justify-between hover:bg-gray-50 transition-colors ${idx < 3 ? 'bg-gradient-to-r from-gray-50/50 to-transparent' : ''}`}>
                                <div className="flex items-center gap-6">
                                    <div className="w-12 flex justify-center">{getRankIcon(idx)}</div>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${idx < 3 ? 'bg-white shadow-sm ring-1 ring-gray-100' : 'bg-gray-100'}`}>
                                            {res.student.username[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 uppercase tracking-tight italic">{res.student.username}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(res.completedAt).toLocaleTimeString()}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-2xl font-black text-indigo-600 italic tracking-tighter">
                                    {res.score}
                                </div>
                            </div>
                        )) : (
                            <div className="p-12 text-center">
                                <p className="text-gray-400 italic">No attempts yet. Be the first!</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                    {user.role === 'teacher' && (
                        <button
                            onClick={() => setShowAddQuestion(true)}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
                        >
                            <Plus size={20} />
                            Add Another Question
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 bg-gray-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-black transition-all shadow-lg active:scale-95"
                    >
                        <Home size={20} />
                        Back to Dashboard
                    </button>
                    <button
                        onClick={() => navigate('/student-dashboard')}
                        className="flex items-center gap-2 bg-white text-gray-900 border-2 border-gray-100 px-8 py-4 rounded-2xl font-black hover:bg-gray-50 transition-all shadow-md active:scale-95"
                    >
                        Try Another Quiz
                        <ArrowRight size={20} />
                    </button>
                </div>
            </div>

            {/* Add Question Modal */}
            {showAddQuestion && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black text-gray-900">Add New Question</h2>
                            <button onClick={() => setShowAddQuestion(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Question Text</label>
                                <textarea
                                    value={newQuestion.questionText}
                                    onChange={(e) => setNewQuestion({ ...newQuestion, questionText: e.target.value })}
                                    className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-indigo-600 focus:outline-none"
                                    rows="3"
                                    placeholder="Enter your question..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Options</label>
                                {newQuestion.options.map((opt, idx) => (
                                    <input
                                        key={idx}
                                        value={opt}
                                        onChange={(e) => {
                                            const newOpts = [...newQuestion.options];
                                            newOpts[idx] = e.target.value;
                                            setNewQuestion({ ...newQuestion, options: newOpts });
                                        }}
                                        className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-600 focus:outline-none mb-3"
                                        placeholder={`Option ${idx + 1}`}
                                    />
                                ))}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Correct Answer</label>
                                <select
                                    value={newQuestion.correctAnswer}
                                    onChange={(e) => setNewQuestion({ ...newQuestion, correctAnswer: e.target.value })}
                                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-600 focus:outline-none"
                                >
                                    <option value="">Select correct answer</option>
                                    {newQuestion.options.filter(opt => opt).map((opt, idx) => (
                                        <option key={idx} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Points</label>
                                <input
                                    type="number"
                                    value={newQuestion.points}
                                    onChange={(e) => setNewQuestion({ ...newQuestion, points: parseInt(e.target.value) || 10 })}
                                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-600 focus:outline-none"
                                    min="1"
                                />
                            </div>

                            <button
                                onClick={handleAddQuestion}
                                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black hover:bg-indigo-700 transition-all shadow-lg"
                            >
                                Add Question
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
