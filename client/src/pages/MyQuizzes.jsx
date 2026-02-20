import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { FileText, Send, CheckCircle, Clock, Trash2, AlertCircle, PlayCircle, XCircle, Users, Activity, ExternalLink } from 'lucide-react';

export default function MyQuizzes() {
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchQuizzes = async () => {
        try {
            const res = await api.get('/quiz/my-quizzes');
            setQuizzes(res.data);
        } catch (err) {
            console.error('Error fetching quizzes', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuizzes();
    }, []);

    const updateQuizMode = async (quizId, mode) => {
        try {
            // mode can be 'assessment', 'live', or 'close'
            let payload = {};
            if (mode === 'assessment') {
                payload = { isActive: true, isLive: false };
            } else if (mode === 'live') {
                payload = { isActive: true, isLive: true };
            } else if (mode === 'close') {
                payload = { isActive: false };
            }

            const res = await api.put(`/quiz/${quizId}`, payload);
            setQuizzes(quizzes.map(q => q._id === quizId ? res.data : q));
        } catch (err) {
            console.error('Error updating quiz mode', err);
            alert(err.response?.data?.msg || 'Failed to update quiz mode');
        }
    };

    const handleDelete = async (quizId) => {
        if (!window.confirm('Are you sure you want to delete this quiz? All results will be permanently removed.')) {
            return;
        }

        try {
            await api.delete(`/quiz/${quizId}`);
            setQuizzes(quizzes.filter(q => q._id !== quizId));
        } catch (err) {
            console.error('Error deleting quiz', err);
            alert('Failed to delete quiz');
        }
    };

    return (
        <DashboardLayout role="teacher">
            <div className="space-y-12 pb-20 relative">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#ff6b00]/5 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse"></div>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight italic uppercase">Quiz <span className="text-[#ff6b00]">Library</span></h1>
                        <p className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-sm italic">Manage assessments and live sessions</p>
                    </div>
                </div>

                {loading ? (
                    <div className="bg-white/5 rounded-[3rem] border border-white/10 p-24 text-center ring-1 ring-white/5">
                        <Activity className="animate-spin text-[#ff6b00] mx-auto mb-8" size={64} />
                        <p className="font-black text-slate-500 uppercase tracking-[0.3em] italic text-sm">Syncing with KMIT database...</p>
                    </div>
                ) : quizzes.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6">
                        {quizzes.map((quiz) => (
                            <div key={quiz._id} className="bg-white/5 rounded-[3rem] border border-white/10 p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10 hover:bg-white/10 transition-all group relative overflow-hidden ring-1 ring-white/5">
                                <div className="flex items-start gap-8 z-10">
                                    <div className={`p-6 rounded-[2rem] transition-all group-hover:scale-110 shrink-0 shadow-2xl ${quiz.isActive ? 'bg-[#ff6b00] text-white' : 'bg-white/5 text-slate-700 border border-white/10'}`}>
                                        <FileText size={36} />
                                    </div>
                                    <div className="space-y-3">
                                        <h3 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">{quiz.title}</h3>
                                        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
                                            <span className="flex items-center gap-2"><Clock size={14} className="text-[#ff6b00]" /> {new Date(quiz.createdAt).toLocaleDateString()}</span>
                                            <span className="flex items-center gap-2"><CheckCircle size={14} className="text-[#ff6b00]" /> {quiz.questions?.length || 0} Questions</span>
                                            <span className={`flex items-center gap-2 px-3 py-1 rounded-full border ${quiz.isActive ? 'text-green-500 border-green-500/20 bg-green-500/5' : 'text-slate-600 border-white/5 bg-white/5'}`}>
                                                <div className={`w-2 h-2 rounded-full ${quiz.isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`}></div>
                                                {quiz.isActive ? (quiz.isLive ? 'LIVE' : 'ASSESSMENT') : 'IDLE'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 z-10">
                                    {quiz.isAssessment ? (
                                        <div className="flex items-center gap-4">
                                            {quiz.isActive ? (
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-6 py-4 flex items-center gap-4">
                                                        <div className="bg-green-500 w-3 h-3 rounded-full animate-pulse"></div>
                                                        <span className="text-green-500 font-black italic uppercase tracking-tighter text-lg">Active Assessment</span>
                                                    </div>
                                                    <button
                                                        onClick={() => updateQuizMode(quiz._id, 'close')}
                                                        className="bg-red-500/10 text-red-500 border border-red-500/20 px-8 py-4 rounded-2xl font-black italic uppercase tracking-tighter transition-all hover:bg-red-500 hover:text-white active:scale-95 flex items-center gap-3"
                                                        title="Close Assessment"
                                                    >
                                                        <XCircle size={20} /> Close
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-4 opacity-50">
                                                    <XCircle className="text-slate-500" size={20} />
                                                    <span className="text-slate-500 font-black italic uppercase tracking-tighter text-lg">Assessment Closed</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-4">
                                            <div className={`border rounded-2xl px-6 py-4 flex items-center gap-4 ${quiz.status === 'started' ? 'bg-[#ff6b00]/10 border-[#ff6b00]/20 text-[#ff6b00]' :
                                                    quiz.status === 'waiting' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500' :
                                                        'bg-white/5 border-white/10 text-slate-500'
                                                }`}>
                                                <div className={`w-3 h-3 rounded-full ${quiz.status === 'started' ? 'bg-[#ff6b00] animate-pulse' :
                                                        quiz.status === 'waiting' ? 'bg-indigo-500 animate-pulse' :
                                                            'bg-slate-700'
                                                    }`}></div>
                                                <span className="font-black italic uppercase tracking-tighter text-lg">
                                                    {quiz.status === 'started' ? 'Live Now' :
                                                        quiz.status === 'waiting' ? 'Waiting Room' : 'Ended'}
                                                </span>
                                            </div>
                                            {quiz.status !== 'finished' && (
                                                <Link
                                                    to={`/live-room-teacher/${quiz.joinCode}`}
                                                    className="bg-white/5 text-white hover:bg-[#ff6b00] p-4 rounded-2xl border border-white/10 transition-all flex items-center gap-2"
                                                    title="View Room"
                                                >
                                                    <ExternalLink size={20} />
                                                </Link>
                                            )}
                                        </div>
                                    )}

                                    <button
                                        onClick={() => handleDelete(quiz._id)}
                                        className="p-4 text-slate-700 hover:text-red-500 hover:bg-white/5 rounded-2xl transition-all border border-white/10"
                                        title="Delete Permanently"
                                    >
                                        <Trash2 size={24} />
                                    </button>
                                </div>
                                <div className="absolute -right-20 -bottom-20 opacity-[0.02] text-white group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
                                    <Activity size={300} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white/5 rounded-[3rem] border border-white/10 p-32 text-center ring-1 ring-white/5 relative overflow-hidden">
                        <div className="bg-white/5 w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-10 text-slate-800 border border-white/10 shadow-inner">
                            <AlertCircle size={64} />
                        </div>
                        <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter">Library Empty</h3>
                        <p className="max-w-md mx-auto text-slate-500 font-bold text-lg mt-6 leading-relaxed">Your knowledge base is waiting for its first entry. Let's create something extraordinary.</p>
                        <Link to="/" className="inline-block mt-12 bg-[#ff6b00] text-white px-12 py-6 rounded-3xl font-black italic uppercase tracking-tighter hover:scale-105 transition-all shadow-2xl shadow-[#ff6b00]/20">
                            Build First Quiz
                        </Link>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
