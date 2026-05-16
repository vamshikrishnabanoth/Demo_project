import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { showConfirm, showError } from '../utils/alerts';
import toast from 'react-hot-toast';
import {
    FileText,
    CheckCircle,
    Clock,
    Trash2,
    AlertCircle,
    XCircle,
    Activity,
    ExternalLink,
    Trophy,
    Search,
    Calendar,
    HelpCircle,
    Play
} from 'lucide-react';
import EmptyState from '../components/EmptyState';

export default function MyQuizzes() {
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchQuizzes = async () => {
        try {
            const res = await api.get('/quiz/my-quizzes');
            setQuizzes(res.data);
        } catch (err) {
            console.error('Error fetching quizzes', err);
            toast.error('Could not load your quizzes. Please refresh.', {
                style: { background: '#1e293b', color: '#fff', borderRadius: '1rem' },
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuizzes();
    }, []);

    const updateQuizMode = async (quizId, mode) => {
        try {
            let payload = {};
            if (mode === 'assessment') payload = { isActive: true,  isLive: false };
            else if (mode === 'live')  payload = { isActive: true,  isLive: true  };
            else if (mode === 'close') payload = { isActive: false };

            const res = await api.put(`/quiz/${quizId}`, payload);
            setQuizzes(quizzes.map(q => q.id === quizId ? res.data : q));
        } catch (err) {
            console.error('Error updating quiz mode', err);
            showError('Update Failed', err.response?.data?.msg || 'Could not update quiz mode.');
        }
    };

    const handleDelete = async (quizId, quizTitle) => {
        const result = await showConfirm(
            'Delete Quiz?',
            `"${quizTitle}" and all its results will be permanently removed.`,
            'Yes, Delete'
        );
        if (!result.isConfirmed) return;

        try {
            await api.delete(`/quiz/${quizId}`);
            setQuizzes(quizzes.filter(q => q.id !== quizId));
        } catch (err) {
            console.error('Error deleting quiz', err);
            showError('Delete Failed', 'Could not delete this quiz. Please try again.');
        }
    };

    const filteredQuizzes = quizzes.filter(quiz =>
        quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quiz.topic?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DashboardLayout role="teacher">
            <div className="space-y-12 pb-20 relative">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--bg-accent)]/5 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse"></div>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-hero-fluid font-black text-white italic uppercase tracking-tighter">Quiz <span className="text-[var(--text-accent)]">Library</span></h1>
                        <p className="text-slate-500 font-bold mt-4 uppercase tracking-widest text-xs sm:text-sm italic text-balance">Manage your knowledge assets</p>
                    </div>

                    <div className="relative w-full md:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[var(--text-accent)] transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="SEARCH LIBRARY..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-white font-black italic placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[var(--bg-accent)]/20 focus:border-[var(--bg-accent)]/50 transition-all uppercase tracking-tighter"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="bg-white/5 rounded-[3rem] border border-white/10 p-12 sm:p-24 flex flex-col items-center justify-center gap-8 ring-1 ring-white/5">
                        <div className="relative w-16 h-16">
                            <div className="premium-spinner-ring"></div>
                            <div className="premium-spinner-ring"></div>
                            <div className="premium-spinner-ring"></div>
                        </div>
                        <p className="font-black text-white italic uppercase tracking-[0.3em] text-sm animate-pulse mt-4 text-center">
                            Syncing with KMIT database...
                        </p>
                    </div>
                ) : filteredQuizzes.length > 0 ? (
                    <div className="grid grid-cols-1 gap-8">
                        {filteredQuizzes.map((quiz) => (
                            <div key={quiz.id} className="bg-white/5 rounded-[3rem] border border-white/10 p-8 lg:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-10 hover:bg-white/10 transition-all group relative overflow-hidden ring-1 ring-white/5">
                                <div className="flex flex-col sm:flex-row items-start gap-8 z-10">
                                    <div className={`p-8 rounded-[2.5rem] transition-all group-hover:scale-110 shrink-0 shadow-2xl ${quiz.isActive ? 'bg-[var(--bg-accent)] text-white' : 'bg-[var(--bg-accent)]/10 text-[var(--text-accent)]/40 border border-[var(--bg-accent)]/20'}`}>
                                        <FileText size={40} />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <h3 className="text-4xl font-black text-[var(--text-accent)] tracking-tighter uppercase italic leading-none transition-colors">{quiz.title}</h3>
                                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs italic">{quiz.topic || 'General Knowledge'}</p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                                                <Calendar size={14} className="text-[var(--text-accent)]" /> {new Date(quiz.createdAt).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                                                <HelpCircle size={14} className="text-[var(--text-accent)]" /> {quiz.questions?.length || 0} Questions
                                            </div>
                                            <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] italic ${quiz.isActive ? 'text-green-500 border-green-500/20 bg-green-500/5' : 'text-slate-600 border-white/5 bg-white/5'}`}>
                                                <div className={`w-2 h-2 rounded-full ${quiz.isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`}></div>
                                                {quiz.isActive ? (quiz.isLive ? 'LIVE' : 'ASSESSMENT') : 'OFFLINE'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 z-10 w-full lg:w-auto">
                                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/5 p-4 rounded-[2.5rem] border border-white/5 w-full lg:w-auto">
                                        {/* Performance Stats */}
                                        <div className="flex items-center gap-6 px-6 py-2 border-r border-white/10 hidden sm:flex">
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Avg Score</p>
                                                <p className="text-lg font-black text-white italic">{(quiz.averageScore || 0).toFixed(0)}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Students</p>
                                                <p className="text-lg font-black text-[var(--text-accent)] italic">{quiz.completionCount || 0}</p>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-3 w-full sm:w-auto">
                                            {quiz.isAssessment ? (
                                                <>
                                                    {quiz.isActive ? (
                                                        <button
                                                            onClick={() => updateQuizMode(quiz.id, 'close')}
                                                            className="flex-1 sm:flex-none bg-red-500/10 text-red-500 border border-red-500/20 px-6 py-3 rounded-2xl font-black italic uppercase tracking-tighter transition-all hover:bg-red-500 hover:text-white active:scale-95 flex items-center justify-center gap-2 text-sm"
                                                        >
                                                            <XCircle size={18} /> Close
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => updateQuizMode(quiz.id, 'assessment')}
                                                            className="flex-1 sm:flex-none bg-[var(--bg-accent)]/10 text-[var(--text-accent)] border border-[var(--bg-accent)]/20 px-6 py-3 rounded-2xl font-black italic uppercase tracking-tighter transition-all hover:bg-[var(--bg-accent)] hover:text-white active:scale-95 flex items-center justify-center gap-2 text-sm"
                                                        >
                                                            <Play size={18} /> Reopen
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    {quiz.status !== 'finished' ? (
                                                        <Link
                                                            to={`/live-room-teacher/${quiz.joinCode}`}
                                                            className="flex-1 sm:flex-none bg-[var(--bg-accent)] text-white px-6 py-3 rounded-2xl font-black italic uppercase tracking-tighter transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-[var(--bg-accent)]/20 text-sm"
                                                        >
                                                            <ExternalLink size={18} /> Room
                                                        </Link>
                                                    ) : (
                                                        <Link
                                                            to={`/leaderboard/${quiz.id}`}
                                                            className="flex-1 sm:flex-none bg-green-500/10 text-green-500 border border-green-500/20 px-6 py-3 rounded-2xl font-black italic uppercase tracking-tighter transition-all hover:bg-green-500 hover:text-white active:scale-95 flex items-center justify-center gap-2 text-sm"
                                                        >
                                                            <Trophy size={18} /> Results
                                                        </Link>
                                                    )}
                                                </>
                                            )}

                                            <button
                                                onClick={() => handleDelete(quiz.id, quiz.title)}
                                                className="p-3 text-slate-700 hover:text-red-500 transition-all group/del shrink-0"
                                                aria-label={`Delete quiz: ${quiz.title}`}
                                                title="Delete Quiz"
                                            >
                                                <Trash2 size={20} className="group-hover/del:scale-110 transition-transform" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Mini Leaderboard - Displayed within the card */}
                                {quiz.results && quiz.results.length > 0 && (
                                    <div className="w-full lg:w-72 bg-white/5 rounded-3xl p-6 border border-white/5 space-y-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">Top Students</span>
                                            <Trophy size={12} className="text-[var(--text-accent)]" />
                                        </div>
                                        {quiz.results.slice(0, 3).map((res, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-xs bg-black/20 rounded-xl p-3 border border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <span className={`font-black italic ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-slate-300' : 'text-amber-600'}`}>#1</span>
                                                    <span className="font-bold text-white uppercase truncate w-24">{res.studentName}</span>
                                                </div>
                                                <span className="font-black text-[var(--text-accent)] italic">{res.score}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="absolute -right-20 -bottom-20 opacity-[0.02] text-white group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
                                    <Activity size={300} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState 
                        icon={FileText}
                        title="Library Empty"
                        message={searchTerm ? `No results match "${searchTerm}".` : "Your knowledge base is waiting for its first entry. Let's create something extraordinary."}
                        action={!searchTerm && (
                            <Link to="/teacher-dashboard" className="bg-[var(--bg-accent)] text-white px-12 py-5 rounded-[2rem] font-black italic uppercase tracking-tighter hover:scale-105 transition-all shadow-2xl shadow-[var(--bg-accent)]/20 btn-glow">
                                Build First Quiz
                            </Link>
                        )}
                    />
                )}
            </div>
        </DashboardLayout>
    );
}
