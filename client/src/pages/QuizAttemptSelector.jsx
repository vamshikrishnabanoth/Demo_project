import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import AttemptQuiz from './AttemptQuiz';
import AssessmentAttempt from './AssessmentAttempt';
import WaitingRoomLoader from '../components/loaders/WaitingRoomLoader';
import { Check } from 'lucide-react';

export default function QuizAttemptSelector() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const res = await api.get(`/quiz/${id}`);
                setQuiz(res.data);
            } catch (err) {
                console.error(err);
                setError(err.response?.data?.msg || 'Failed to initialize arena link.');
            } finally {
                setLoading(false);
            }
        };
        fetchQuiz();
    }, [id]);

    

    if (loading) return <WaitingRoomLoader message="Synchronizing Arena Link..." />;
    
    if (error || !quiz) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mb-6 font-bold text-xl">!</div>
                <h2 className="text-2xl font-black text-white italic uppercase tracking-tight mb-2">Arena Link Severed</h2>
                <p className="text-white/40 font-bold uppercase tracking-widest text-xs max-w-sm leading-relaxed mb-6">
                    {error || 'The tactical parameters for this session could not be established.'}
                </p>
                <button
                    onClick={() => navigate('/student-dashboard')}
                    className="bg-white/5 border border-white/10 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all btn-press"
                >
                    Exit to Dashboard
                </button>
            </div>
        );
    }

    if (quiz.isLive) {
        return <AttemptQuiz />;
    }

    const isCompleted = quiz.isAlreadyCompleted || (quiz.isAssessment && quiz.previousResult?.status === 'completed');
    if (isCompleted) {
        return (
            <div className="min-h-screen bg-[#07090e] text-white flex flex-col items-center justify-center p-6 text-center font-inter relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[160px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[160px] pointer-events-none" />

                <div className="max-w-lg w-full bg-white/[0.02] backdrop-blur-2xl border border-emerald-500/20 rounded-[2.5rem] p-10 shadow-[0_30px_100px_rgba(16,185,129,0.15)] relative z-10 space-y-6">
                    <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.2)] font-black text-2xl">
                        <Check size={16} aria-hidden="true" />
                    </div>

                    <div className="space-y-2">
                        <span className="px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            Single Attempt Assessment
                        </span>
                        <h2 className="text-3xl font-black italic uppercase tracking-tight text-white mt-2">
                            Assessment Completed
                        </h2>
                        <p className="text-slate-400 font-bold uppercase tracking-wider text-xs max-w-sm mx-auto leading-relaxed">
                            You have already submitted your official attempt for <span className="text-emerald-400">{quiz.title}</span>. Multi-attempts are restricted for this assessment.
                        </p>
                    </div>

                    {quiz.previousResult && (
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 max-w-xs mx-auto text-center">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Achieved Score</p>
                            <p className="text-3xl font-mono font-black text-emerald-400 mt-1">{quiz.previousResult.score} pts</p>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                            onClick={() => navigate(`/report/${quiz.id}`)}
                            className="flex-1 py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest transition-all shadow-[0_10px_25px_rgba(16,185,129,0.25)] cursor-pointer"
                        >
                            View Assessment Report
                        </button>
                        <button
                            onClick={() => navigate('/assessments')}
                            className="flex-1 py-4 px-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
                        >
                            Back to Arena
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    
    // Render game selection UI for assignments
    const statePayload = { questions: quiz.questions, title: quiz.title, quizId: quiz.id };
    
    return (
        <div className="min-h-screen bg-[var(--bg-primary)] p-6 sm:p-10 font-inter text-white">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-black italic uppercase tracking-tighter">Choose Your Arena</h1>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Select a game mode for {quiz.title}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Cyber Quest */}
                    <div 
                        onClick={() => navigate('/cyber-quest', { replace: true, state: statePayload })}
                        className="bg-white/5 border border-white/10 p-6 rounded-3xl hover:border-amber-500 hover:bg-amber-500/10 cursor-pointer transition-all text-center flex flex-col items-center gap-4 group"
                    >
                        <div className="w-16 h-16 bg-amber-500/20 text-amber-500 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                            🏆
                        </div>
                        <div>
                            <h3 className="font-black text-xl italic uppercase tracking-tight text-white mb-1">Cyber Quest</h3>
                            <p className="text-xs font-medium text-slate-400">10-level survival ladder with emergency lifelines & streak multipliers</p>
                        </div>
                    </div>

                    {/* Sprint Arena */}
                    <div 
                        onClick={() => navigate('/sprint-arena', { replace: true, state: statePayload })}
                        className="bg-white/5 border border-white/10 p-6 rounded-3xl hover:border-cyan-500 hover:bg-cyan-500/10 cursor-pointer transition-all text-center flex flex-col items-center gap-4 group"
                    >
                        <div className="w-16 h-16 bg-cyan-500/20 text-cyan-500 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                            ⚡
                        </div>
                        <div>
                            <h3 className="font-black text-xl italic uppercase tracking-tight text-white mb-1">Sprint Arena</h3>
                            <p className="text-xs font-medium text-slate-400">Rapid-fire speed run against a 45s countdown timer</p>
                        </div>
                    </div>

                    {/* Match-Up */}
                    <div 
                        onClick={() => navigate('/match-up-arena', { replace: true, state: statePayload })}
                        className="bg-white/5 border border-white/10 p-6 rounded-3xl hover:border-emerald-500 hover:bg-emerald-500/10 cursor-pointer transition-all text-center flex flex-col items-center gap-4 group"
                    >
                        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                            🧩
                        </div>
                        <div>
                            <h3 className="font-black text-xl italic uppercase tracking-tight text-white mb-1">Match-Up</h3>
                            <p className="text-xs font-medium text-slate-400">Memory card matching grid connecting questions with answers</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
    
}
