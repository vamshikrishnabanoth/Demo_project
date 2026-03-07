import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { FileText, Type, Book, Cpu, BarChart3, Users, PlayCircle, PlusCircle, Sparkles, X } from 'lucide-react';

export default function TeacherDashboard() {
    const [stats, setStats] = useState({ totalQuizzes: 0, totalAttempts: 0, averageScore: 0 });
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showOptions, setShowOptions] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/quiz/stats');
                const quizArray = res.data || [];
                const totalQuizzes = quizArray.length;
                const totalAttempts = quizArray.reduce((sum, quiz) => sum + (quiz.completionCount || 0), 0);
                const averageScore = quizArray.length > 0
                    ? quizArray.reduce((sum, quiz) => sum + (quiz.averageScore || 0), 0) / quizArray.length
                    : 0;

                setStats({ totalQuizzes, totalAttempts, averageScore });
                setQuizzes(quizArray);
            } catch (err) {
                console.error('Error fetching dashboard stats', err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const creationOptions = [
        { title: 'From Text', description: 'Paste text or manual entry', icon: Type, color: 'hover:bg-blue-500', path: '/create-quiz/text' },
        { title: 'From PDF', description: 'Upload and extract document', icon: FileText, color: 'hover:bg-red-500', path: '/create-quiz/pdf' },
        { title: 'From Topic', description: 'AI generates from a prompt', icon: Book, color: 'hover:bg-green-500', path: '/create-quiz/topic' }
    ];

    return (
        <DashboardLayout role="teacher">
            <div className="space-y-12 pb-20 relative">
                {/* Immersive Background Element */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-[#ff6b00]/5 rounded-full blur-[150px] pointer-events-none -z-10 animate-pulse"></div>

                {/* Hero Section */}
                <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-10 pt-10">
                    {!showOptions ? (
                        <div className="space-y-12 animate-in fade-in zoom-in duration-500 w-full max-w-4xl">
                            <div className="space-y-4">
                                <h1 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-[0.9]">
                                    Ready to <span className="text-[#ff6b00]">Engage</span>?
                                </h1>
                                <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-sm italic">Create dynamic assessments in seconds</p>
                            </div>

                            <button
                                onClick={() => setShowOptions(true)}
                                className="group relative bg-[#ff6b00] text-white px-20 py-10 rounded-[3rem] font-black text-4xl italic tracking-tighter hover:scale-105 transition-all shadow-[0_32px_64px_-16px_rgba(255,107,0,0.3)] active:scale-95 flex items-center gap-8 mx-auto overflow-hidden border-4 border-white/20"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                <span className="relative">CREATE A QUIZ</span>
                                <PlusCircle className="relative group-hover:rotate-90 transition-transform duration-500" size={48} />
                            </button>
                        </div>
                    ) : (
                        <div className="w-full space-y-12 animate-in slide-in-from-bottom-10 fade-in duration-500">
                            <div className="flex items-center justify-between max-w-4xl mx-auto w-full px-4">
                                <h2 className="text-4xl font-black text-[#ff6b00] italic tracking-tighter uppercase">Select Your Method</h2>
                                <button
                                    onClick={() => setShowOptions(false)}
                                    className="p-4 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all ring-1 ring-white/10"
                                >
                                    <X size={28} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto px-4">
                                {creationOptions.map((option, idx) => {
                                    const Icon = option.icon;
                                    return (
                                        <Link
                                            key={idx}
                                            to={option.path}
                                            className="group bg-white/5 border border-white/10 rounded-[3rem] p-12 hover:border-[#ff6b00]/50 hover:shadow-2xl hover:shadow-[#ff6b00]/10 transition-all duration-300 text-left relative overflow-hidden ring-1 ring-white/5"
                                        >
                                            <div className="bg-white/5 w-20 h-20 rounded-3xl flex items-center justify-center text-[#ff6b00] mb-8 group-hover:bg-[#ff6b00] group-hover:text-white transition-all duration-300 shadow-xl ring-1 ring-white/10">
                                                <Icon size={40} />
                                            </div>
                                            <h3 className="text-3xl font-black text-white italic tracking-tighter mb-4 group-hover:text-[#ff6b00] transition-colors uppercase leading-none">{option.title}</h3>
                                            <p className="text-slate-400 font-bold text-base leading-relaxed">{option.description}</p>
                                            <div className="mt-10 flex items-center gap-2 text-[#ff6b00] font-black text-sm uppercase tracking-widest opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all">
                                                Launch <Sparkles size={18} />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Previous Quizzes Section */}
                <div className="mt-20 space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-300">
                    <div className="flex items-end justify-between border-b border-white/5 pb-6">
                        <div>
                            <h2 className="text-5xl font-black text-white tracking-tight italic uppercase">Previous <span className="text-[#ff6b00]">Sessions</span></h2>
                            <p className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-sm italic">Review results and student rankings</p>
                        </div>
                        <Link to="/my-quizzes" className="bg-white/5 hover:bg-white/10 px-8 py-4 rounded-2xl border border-white/10 text-slate-400 hover:text-[#ff6b00] font-black uppercase tracking-tighter italic transition-all active:scale-95 flex items-center gap-3">
                            Full Library <PlusCircle size={20} />
                        </Link>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {[1, 2].map(i => (
                                <div key={i} className="bg-white/5 rounded-[3rem] border border-white/10 p-12 animate-pulse h-80 ring-1 ring-white/5"></div>
                            ))}
                        </div>
                    ) : quizzes.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {quizzes.slice(0, 4).map((quiz) => (
                                <div key={quiz.quizId} className="group bg-white/5 border border-white/10 rounded-[3rem] p-10 hover:bg-white/10 transition-all duration-500 relative overflow-hidden ring-1 ring-white/5 flex flex-col">
                                    <div className="flex items-start justify-between mb-8">
                                        <div className="space-y-2">
                                            <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none group-hover:text-[#ff6b00] transition-colors">{quiz.title}</h3>
                                            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
                                                <span className="flex items-center gap-1.5"><Clock size={12} className="text-[#ff6b00]" /> {quiz.results?.[0]?.completedAt ? new Date(quiz.results[0].completedAt).toLocaleDateString() : 'Recent'}</span>
                                                <span className="flex items-center gap-1.5"><Users size={12} className="text-[#ff6b00]" /> {quiz.completionCount} Students</span>
                                            </div>
                                        </div>
                                        <Link to={`/leaderboard/${quiz.quizId}`} className="p-4 bg-white/5 rounded-2xl border border-white/10 text-slate-400 hover:text-white hover:bg-[#ff6b00] transition-all">
                                            <Sparkles size={24} />
                                        </Link>
                                    </div>

                                    {/* Mini Leaderboard */}
                                    <div className="space-y-3 mt-auto">
                                        <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            Final Leaderboard <Trophy size={14} className="text-[#ff6b00]" />
                                        </div>
                                        {quiz.results.length > 0 ? (
                                            <div className="space-y-2">
                                                {quiz.results.slice(0, 3).map((res, idx) => (
                                                    <div key={idx} className="bg-white/5 rounded-2xl p-4 flex items-center justify-between group/row hover:bg-white/10 transition-colors border border-white/5">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black italic shadow-sm
                                                                ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                                                    idx === 1 ? 'bg-slate-300/20 text-slate-300' :
                                                                        'bg-amber-600/20 text-amber-600'}`}>
                                                                {idx + 1}
                                                            </div>
                                                            <span className="font-black text-white uppercase italic tracking-tighter">{res.studentName}</span>
                                                        </div>
                                                        <span className="text-sm font-black text-[#ff6b00] italic">{res.score} pts</span>
                                                    </div>
                                                ))}
                                                {quiz.results.length > 3 && (
                                                    <p className="text-center text-[10px] font-black text-slate-600 uppercase italic mt-4 tracking-widest">
                                                        + {quiz.results.length - 3} more participants
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="bg-white/5 rounded-2xl p-8 text-center border border-dashed border-white/10">
                                                <p className="text-xs font-black text-slate-600 uppercase italic tracking-widest">No participants yet</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="absolute -right-10 -top-10 text-white/5 transform -rotate-12 group-hover:rotate-0 transition-transform duration-1000">
                                        <Activity size={180} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white/5 rounded-[3rem] border border-white/10 p-24 text-center ring-1 ring-white/5">
                            <h3 className="text-3xl font-black text-slate-700 uppercase italic tracking-tighter mb-4">No Session History</h3>
                            <p className="text-slate-500 font-bold text-sm tracking-widest uppercase italic">Your quiz history will appear here once you host a session</p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}

