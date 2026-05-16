import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import socket from '../utils/socket';
import AuthContext from '../context/AuthContext';
import ResultsLoader from '../components/loaders/ResultsLoader';
import DashboardLayout from '../components/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Play, TrendingUp, CheckCircle, XCircle, Minus, Star, Target } from 'lucide-react';
import useSocketRoom from '../hooks/useSocketRoom';

export default function Leaderboard() {
    const { quizId } = useParams();
    const { user } = useContext(AuthContext);
    const [results, setResults] = useState([]);
    const [insights, setInsights] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [quiz, setQuiz] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const studentsPerPage = 10;
    const navigate = useNavigate();
    const isStudent = user?.role === 'student';

    const fetchData = async (retryCount = 0) => {
        try {
            const res = await api.get(`/quiz/leaderboard/${quizId}`);
            if (res.data.results) {
                if (res.data.results.length === 0 && retryCount < 3) {
                    setTimeout(() => fetchData(retryCount + 1), 2000);
                    return;
                }
                setResults(res.data.results);
            }
            if (res.data.insights) setInsights(res.data.insights);
            if (res.data.stats) setStats(res.data.stats);

            const quizRes = await api.get(`/quiz/${quizId}`);
            setQuiz(quizRes.data);
        } catch (err) {
            console.error('Leaderboard fetch error:', err?.response?.data || err.message);
        } finally {
            setTimeout(() => setLoading(false), 800);
        }
    };

    useEffect(() => {
        fetchData();
    }, [quizId]);

    useSocketRoom(quizId, user, {
        score_updated: () => fetchData(),
        user_status_change: ({ userId, isOnline }) => {
            setResults(prev => prev.map(res =>
                res.studentId === userId ? { ...res, isOnline } : res
            ));
        },
    });

    if (loading) return <ResultsLoader message="Finalizing Rankings..." />;

    const totalPages = Math.max(1, Math.ceil(results.length / studentsPerPage));
    const paginatedResults = results.slice(
        (currentPage - 1) * studentsPerPage,
        currentPage * studentsPerPage
    );

    const renderStudentView = () => {
        const userRank = stats?.userRank || 0;
        const totalParticipants = stats?.totalParticipants || 0;
        const userScore = stats?.userScore || 0;
        const maxScore = (quiz?.questions?.length || 0) * 10;
        const percentile = totalParticipants > 1 ? (1 - (userRank - 1) / (totalParticipants - 1)) * 100 : 100;

        const getPerformanceZone = () => {
            if (percentile >= 90) return { label: 'Top 10%', color: 'text-[var(--text-accent)]', bg: 'bg-[var(--text-accent)]/10', border: 'border-[var(--text-accent)]/20', icon: Trophy, message: 'Exceptional performance! You mastered this arena.' };
            if (percentile >= 75) return { label: 'Top 25%', color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-400/20', icon: Star, message: "Great job! You're among the elite performers." };
            if (userScore > (stats?.averageScore || 0)) return { label: 'Above Average', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20', icon: TrendingUp, message: 'Solid work! You performed better than most.' };
            return { label: 'Average', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', icon: Target, message: "Good effort! Keep pushing forward." };
        };

        const zone = getPerformanceZone();
        const ZoneIcon = zone.icon;

        return (
            <div className="max-w-2xl mx-auto space-y-12 py-10">
                <div className="text-center space-y-4">
                    <h1 className="text-hero-fluid font-black text-white italic uppercase tracking-tighter drop-shadow-[0_0_15px_var(--bg-accent-glow)]">
                        {quiz?.title} <span className="text-[var(--text-accent)]">Result</span>
                    </h1>
                    <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] text-balance">Final Ranking Intelligence</p>
                </div>

                <div className={`glass-panel rounded-[3.5rem] p-12 md:p-16 border ${zone.border} shadow-[0_0_50px_rgba(0,0,0,0.3)] relative overflow-hidden`}>
                    <span className="text-[clamp(6rem,20vw,12rem)] font-black italic tracking-tighter leading-none text-white/[0.03] absolute -bottom-4 -left-4 pointer-events-none select-none">#{userRank}</span>
                    
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                    <div className="relative z-10 flex flex-col items-center text-center space-y-10">
                        <motion.div 
                            initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 100, damping: 15 }}
                            className={`w-32 h-32 sm:w-40 sm:h-40 ${zone.bg} rounded-[2.5rem] sm:rounded-[3rem] flex items-center justify-center border-4 ${zone.border} shadow-2xl relative group`}
                        >
                            <div className="absolute inset-0 rounded-[3rem] bg-[var(--bg-accent)] opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-700" />
                            <ZoneIcon size={60} className={`sm:w-20 sm:h-20 ${zone.color} drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]`} />
                        </motion.div>

                        <div className="space-y-3">
                            <span className={`text-sm font-black uppercase tracking-[0.4em] ${zone.color} opacity-80`}>{zone.label}</span>
                            <h2 className="text-6xl md:text-9xl font-black italic text-[var(--text-accent)] tracking-tighter drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] leading-none">
                                #{userRank}
                            </h2>
                            <p className="text-white/20 font-black uppercase tracking-[0.3em] text-[10px] sm:text-xs">
                                out of {totalParticipants} students
                            </p>
                        </div>

                        <p className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white max-w-md leading-tight text-balance">
                            {zone.message}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 w-full max-w-lg">
                            <div className="bg-white/[0.03] border border-white/5 p-8 rounded-[2rem] sm:rounded-[2.5rem] text-center btn-cinematic">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">Your Score</p>
                                <p className="text-3xl sm:text-4xl font-black italic text-[var(--text-accent)]">{userScore}</p>
                                <p className="text-[10px] font-black text-white/20 uppercase mt-1">/ {maxScore} points</p>
                            </div>
                            <div className="bg-white/[0.03] border border-white/5 p-8 rounded-[2rem] sm:rounded-[2.5rem] text-center btn-cinematic">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">Percentile</p>
                                <p className="text-3xl sm:text-4xl font-black italic text-white">{Math.round(percentile)}%</p>
                                <p className="text-[10px] font-black text-white/20 uppercase mt-1">Global ranking</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center">
                    <button
                        onClick={() => navigate('/student-dashboard')}
                        className="bg-[var(--bg-accent)] text-[var(--text-on-accent)] px-12 sm:px-16 py-4 sm:py-6 rounded-[2rem] sm:rounded-[2.5rem] font-black italic uppercase tracking-[0.2em] text-lg sm:text-xl btn-cinematic shadow-2xl shadow-[var(--bg-accent)]/30 btn-glow"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    };

    return (
        <DashboardLayout role={user?.role}>
            {isStudent ? renderStudentView() : (
                <div className="max-w-[100rem] mx-auto space-y-12 py-10">
                    <div className="text-center space-y-4">
                        <h1 className="text-hero-fluid font-black italic uppercase tracking-tighter drop-shadow-[0_0_15px_var(--bg-accent-glow)]">
                            Arena <span className="text-[var(--text-accent)]">Standings</span>
                        </h1>
                        <p className="text-white/50 font-black uppercase tracking-[0.5em] text-[10px] text-balance">
                            {results.length} Students • {quiz?.questions?.length || 0} Questions
                        </p>
                    </div>

                    <div className="glass-panel rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden">
                        <div className="overflow-x-auto overflow-y-auto max-h-[700px] premium-scrollbar">
                            <div className="min-w-[1000px]">
                                <div className="px-10 py-6 bg-[var(--bg-primary)]/95 backdrop-blur-xl border-b border-white/5 flex items-center gap-6 sticky top-0 z-30 shadow-xl">
                                    <div className="w-24 table-header-premium text-center">Rank</div>
                                    <div className="w-56 table-header-premium text-left px-0">Student</div>
                                    <div className="flex-1 table-header-premium text-left px-0">Answers</div>
                                    <div className="w-24 table-header-premium text-center px-0">Score</div>
                                    <div className="w-28 table-header-premium text-center px-0">Status</div>
                                </div>

                                <div className="divide-y divide-white/5 bg-white/[0.02]">
                                    <AnimatePresence>
                                        {paginatedResults.map((res, pIdx) => {
                                            const rank = (currentPage - 1) * studentsPerPage + pIdx + 1;
                                            const answerMap = {};
                                            res.answers?.forEach(a => { answerMap[a.questionText] = a; });
                                            
                                            const correctCount = res.answers?.filter(a => a.isCorrect)?.length || 0;
                                            const totalQuestions = quiz?.questions?.length || 1;
                                            const scorePct = (correctCount / totalQuestions) * 100;
                                            const hasPassed = scorePct >= 50;

                                            const getRankVisual = () => {
                                                if (rank === 1) return { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/20', border: 'border-yellow-400/50', size: 42 };
                                                if (rank === 2) return { icon: Trophy, color: 'text-slate-300', bg: 'bg-slate-300/20', border: 'border-slate-300/50', size: 36 };
                                                if (rank === 3) return { icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-600/20', border: 'border-amber-600/50', size: 32 };
                                                return null;
                                            };

                                            const rankVisual = getRankVisual();

                                            return (
                                                <motion.div
                                                    key={res.studentId || pIdx}
                                                    initial={{ x: -20, opacity: 0 }}
                                                    animate={{ x: 0, opacity: 1 }}
                                                    transition={{ delay: pIdx * 0.03, ease: [0.22, 1, 0.36, 1], duration: 0.25 }}
                                                    className={`px-10 py-6 flex items-center gap-6 hover:bg-white/[0.05] transition-all group relative overflow-hidden ${rank <= 3 ? 'bg-white/[0.03]' : ''}`}
                                                >
                                                    {rank <= 3 && <div className="absolute inset-0 bg-gradient-to-r from-white/[0.02] to-transparent pointer-events-none" />}
                                                    
                                                    <div className="w-24 flex items-center justify-center relative">
                                                        {rankVisual ? (
                                                            <div className={`relative p-3 rounded-2xl ${rankVisual.bg} border ${rankVisual.border} shadow-2xl group-hover:scale-110 transition-transform duration-500 flex items-center gap-3`}>
                                                                <rankVisual.icon size={rankVisual.size} className={`${rankVisual.color} drop-shadow-[0_0_10px_currentColor]`} />
                                                                <div className="flex flex-col items-start leading-none pr-1">
                                                                    <span className={`text-[8px] font-black uppercase tracking-widest ${rankVisual.color} opacity-60`}>Rank</span>
                                                                    <span className="text-xl font-black text-white italic">#{rank}</span>
                                                                </div>
                                                                {rank === 1 && <div className="rank-shine-overlay rounded-2xl" />}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-black text-white/10 uppercase tracking-tighter pr-1 border-r border-white/5">RNK</span>
                                                                <span className="text-lg font-black text-white/20 italic tracking-widest group-hover:text-white/40 transition-colors">#{rank}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="w-56 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className={`font-black text-white text-lg tracking-tight transition-colors truncate ${rank <= 3 ? 'text-xl' : ''}`}>
                                                                {res.username || 'Unknown'}
                                                            </p>
                                                            <div className={`w-2 h-2 rounded-full ${res.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-white/10'}`} />
                                                        </div>
                                                        <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1 truncate">{res.studentId}</p>
                                                    </div>

                                                    <div className="flex-1 flex items-center gap-1.5 flex-wrap px-4">
                                                        {quiz?.questions?.map((q, qIdx) => {
                                                            const answer = answerMap[q.questionText];
                                                            const isCorrect = answer?.isCorrect === true;
                                                            return (
                                                                <div key={qIdx} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] border transition-all ${
                                                                    !answer ? 'bg-white/5 border-white/10 text-white/10' :
                                                                    isCorrect ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                                                                    'bg-red-500/20 border-red-500/30 text-red-400'
                                                                }`}>
                                                                    {!answer ? <Minus size={12} /> : isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    <div className="w-24 text-center">
                                                         <span className="text-2xl font-black text-[var(--text-accent)] italic tracking-tighter drop-shadow-[0_0_10px_var(--bg-accent-glow)]">{res.currentScore}</span>
                                                    </div>

                                                    <div className="w-28 flex flex-col items-center justify-center gap-1">
                                                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-black text-[10px] uppercase tracking-widest italic transition-all ${
                                                            hasPassed 
                                                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                                                            : 'bg-orange-500/10 border-orange-500/20 text-orange-400/70'
                                                        }`}>
                                                            {hasPassed ? <TrendingUp size={12} /> : <Target size={12} />}
                                                            {hasPassed ? 'PASSED' : 'FAILED'}
                                                        </div>
                                                        <div className="flex gap-2 text-[8px] font-black opacity-30 tracking-widest">
                                                            <span className="text-green-500">{correctCount}P</span>
                                                            <span>/</span>
                                                            <span className="text-red-500">{totalQuestions - correctCount}F</span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 py-8">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-12 h-12 rounded-2xl font-black transition-all ${
                                            page === currentPage ? 'bg-[var(--bg-accent)] text-white shadow-xl shadow-[var(--bg-accent)]/20' : 'bg-white/5 text-white/40 hover:bg-white/10'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
