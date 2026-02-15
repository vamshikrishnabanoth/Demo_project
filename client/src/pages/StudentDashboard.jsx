import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { BookOpen, Clock, PlayCircle, CheckCircle, Award, Layout, Search, Trophy } from 'lucide-react';

export default function StudentDashboard() {
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchQuizzes = async () => {
            try {
                const res = await api.get('/quiz/live');
                setQuizzes(res.data);
            } catch (err) {
                console.error('Error fetching quizzes', err);
            } finally {
                setLoading(false);
            }
        };
        fetchQuizzes();
    }, []);


    const filteredQuizzes = quizzes
        .filter(q => !q.isLive) // Hide live quizzes - students must join via code
        .filter(q => q.title.toLowerCase().includes(searchTerm.toLowerCase()));


    const completedQuizzes = quizzes.filter(q => q.isAttempted).length;
    const avgScore = quizzes.filter(q => q.isAttempted).length > 0
        ? quizzes.filter(q => q.isAttempted).reduce((acc, curr) => acc + curr.score, 0) / completedQuizzes
        : 0;

    return (
        <DashboardLayout role="student">
            <div className="space-y-8 pb-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 font-outfit">Student Portal</h1>
                        <p className="text-gray-500 mt-1">Ready to test your knowledge? Choose a quiz below.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search quizzes..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm w-full md:w-64"
                            />
                        </div>
                    </div>
                </div>

                {/* Join with Code - Hero Section */}
                <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden">
                    <div className="relative z-10 max-w-lg">
                        <h2 className="text-2xl font-black mb-2 uppercase tracking-tight">Have a Join Code?</h2>
                        <p className="text-indigo-100 mb-6 font-medium">Enter the 6-digit code provided by your teacher to jump straight into a live quiz session.</p>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                maxLength="6"
                                placeholder="ENTER 6-DIGIT CODE"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                                className="bg-white/20 border-2 border-white/30 rounded-2xl px-6 py-4 text-2xl font-black tracking-[0.5em] placeholder:text-white/40 placeholder:tracking-normal focus:outline-none focus:bg-white/30 focus:border-white transition-all uppercase text-center sm:text-left sm:w-64"
                            />
                            <button
                                onClick={async () => {
                                    if (!joinCode || joinCode.length !== 6) return alert('Please enter a valid 6-digit code');

                                    try {
                                        const res = await api.post('/quiz/join', { code: Number(joinCode) });

                                        if (res.data.isLive) {
                                            navigate(`/live-room-student/${joinCode}`);
                                        } else {
                                            navigate(`/quiz/attempt/${res.data.quizId}`);
                                        }
                                    } catch (err) {
                                        console.error(err);
                                        if (err.response?.status === 404) {
                                            alert('Invalid Join Code');
                                        } else {
                                            alert('Error joining room');
                                        }
                                    }
                                }}
                                className="bg-white text-indigo-600 px-8 py-4 rounded-2xl font-black text-lg hover:bg-indigo-50 transition-all active:scale-95 shadow-lg whitespace-nowrap"
                            >
                                Join Now
                            </button>
                        </div>
                    </div>
                    <PlayCircle className="absolute right-[-40px] top-[-40px] opacity-10" size={300} />
                </div>

                {/* Performance Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="bg-indigo-50 p-4 rounded-xl text-indigo-600">
                            <BookOpen size={28} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Available</p>
                            <p className="text-3xl font-bold text-gray-900">{quizzes.length}</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="bg-green-50 p-4 rounded-xl text-green-600">
                            <CheckCircle size={28} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Completed</p>
                            <p className="text-3xl font-bold text-gray-900">{completedQuizzes}</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="bg-yellow-50 p-4 rounded-xl text-yellow-600">
                            <Trophy size={28} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Avg. Score</p>
                            <p className="text-3xl font-bold text-gray-900">{avgScore.toFixed(0)}%</p>
                        </div>
                    </div>
                </div>

                {/* Quizzes Grid */}
                <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Layout size={20} className="text-indigo-600" />
                        Live Quiz Bank
                    </h2>

                    {loading ? (
                        <div className="text-center py-20">
                            <div className="animate-spin text-indigo-600 inline-block mb-4">
                                <Clock size={40} />
                            </div>
                            <p className="text-gray-500 font-bold">Waking up the systems...</p>
                        </div>
                    ) : filteredQuizzes.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredQuizzes.map((quiz) => (
                                <div key={quiz._id} className={`bg-white rounded-3xl border ${quiz.isAttempted ? 'border-gray-100 opacity-90' : 'border-gray-100 shadow-lg shadow-indigo-50/20'} overflow-hidden group hover:-translate-y-1 transition-all duration-300`}>
                                    <div className={`p-6 ${quiz.isAttempted ? 'bg-gray-50/50' : 'bg-gradient-to-br from-indigo-50 to-white'} border-b border-gray-50`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div className={`p-3 rounded-2xl ${quiz.isAttempted ? 'bg-gray-100 text-gray-400' : 'bg-white shadow-sm text-indigo-600'}`}>
                                                <Award size={24} />
                                            </div>
                                            {quiz.isAttempted && (
                                                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
                                                    Attempted
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-1">{quiz.title}</h3>
                                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                                            {quiz.description || 'Test your proficiency in this topic with structured questions.'}
                                        </p>
                                    </div>

                                    <div className="p-6 space-y-4">
                                        <div className="flex items-center gap-4 text-xs font-bold text-gray-500">
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={14} className="text-indigo-400" />
                                                Unlimited Time
                                            </div>
                                            <div className="flex items-center gap-1.5 text-indigo-600">
                                                <PlayCircle size={14} />
                                                Active Now
                                            </div>
                                        </div>

                                        {quiz.isAttempted ? (
                                            <div className="pt-2">
                                                <div className="flex justify-between items-end mb-2">
                                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Previous Score</p>
                                                    <p className="text-xl font-black text-indigo-600">{quiz.score} <span className="text-[10px] text-gray-300">/ {quiz.totalQuestions}</span></p>
                                                </div>
                                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-600 rounded-full transition-all duration-1000"
                                                        style={{ width: `${(quiz.score / quiz.totalQuestions) * 100}%` }}
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => navigate(`/quiz/attempt/${quiz._id}`)}
                                                    className="w-full mt-4 bg-indigo-50 text-indigo-700 py-3 rounded-2xl text-sm font-black hover:bg-indigo-100 transition-all border border-indigo-100"
                                                >
                                                    Review Results
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => navigate(`/quiz/attempt/${quiz._id}`)}
                                                className="w-full mt-4 bg-indigo-600 text-white py-3 rounded-2xl text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                                            >
                                                Start Assessment
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                            <p className="text-gray-400 font-medium">No live quizzes found for "{searchTerm}"</p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
