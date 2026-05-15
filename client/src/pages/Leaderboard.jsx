import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import socket from '../utils/socket';
import AuthContext from '../context/AuthContext';
import PremiumLoading from '../components/PremiumLoading';
import DashboardLayout from '../components/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Play, TrendingUp, CheckCircle, XCircle, Minus, Star, Target } from 'lucide-react';

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
        socket.emit('join_room', { quizId, user: { username: user.username, role: user.role } });
        
        socket.on('score_updated', () => fetchData());
        
        const handleStatusChange = ({ userId, isOnline }) => {
            setResults(prev => prev.map(res => res.studentId === userId ? { ...res, isOnline } : res));
        };
        socket.on('user_status_change', handleStatusChange);

        return () => {
            socket.off('score_updated');
            socket.off('user_status_change', handleStatusChange);
        };
    }, [quizId, user]);

    if (loading) return <PremiumLoading message="Finalizing Rankings..." />;

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
            if (percentile >= 90) return { label: 'Top 10%', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20', icon: Trophy, message: 'Exceptional performance! You mastered this arena.' };
            if (percentile >= 75) return { label: 'Top 25%', color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-400/20', icon: Star, message: "Great job! You're among the elite performers." };
            if (userScore > (stats?.averageScore || 0)) return { label: 'Above Average', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20', icon: TrendingUp, message: 'Solid work! You performed better than most.' };
            return { label: 'Average', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', icon: Target, message: "Good effort! Keep pushing forward." };
        };

        const zone = getPerformanceZone();
        const ZoneIcon = zone.icon;

        return (
            <div className="max-w-2xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-6xl font-black italic uppercase tracking-tighter leading-none">
                        {quiz?.title} <span className="text-[var(--text-accent)] drop-shadow-[0_0_15px_var(--bg-accent-glow)]">Result</span>
                    </h1>
                </div>

                <div className={`glass-panel rounded-[3.5rem] p-12 md:p-16 border ${zone.border} shadow-[0_0_50px_rgba(0,0,0,0.3)]`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                    <div className="relative z-10 flex flex-col items-center text-center space-y-10">
                        <motion.div 
                            initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 100, damping: 15 }}
                            className={`w-40 h-40 ${zone.bg} rounded-[3rem] flex items-center justify-center border-4 ${zone.border} shadow-2xl relative group`}
                        >
                            <div className="absolute inset-0 rounded-[3rem] bg-[var(--bg-accent)] opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-700" />
                            <ZoneIcon size={80} className={`${zone.color} drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]`} />
                        </motion.div>

                        <div className="space-y-3">
                            <span className={`text-sm font-black uppercase tracking-[0.4em] ${zone.color} opacity-80`}>{zone.label}</span>
                            <h2 className="text-9xl font-black italic text-[var(--text-accent)] tracking-tighter drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                                #{userRank}
                            </h2>
                            <p className="text-white/20 font-black uppercase tracking-[0.3em] text-xs">
                                out of {totalParticipants} system identities
                            </p>
                        </div>

                        <p className="text-3xl font-black italic uppercase tracking-tighter text-white max-w-md leading-tight">
                            {zone.message}
                        </p>

                        <div className="grid grid-cols-2 gap-8 w-full max-w-lg">
                            <div className="bg-white/[0.03] border border-white/5 p-8 rounded-[2.5rem] text-center btn-cinematic">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">Combat Efficiency</p>
                                <p className="text-4xl font-black italic text-[var(--text-accent)]">{userScore}</p>
                                <p className="text-[10px] font-black text-white/20 uppercase mt-1">/ {maxScore} points</p>
                            </div>
                            <div className="bg-white/[0.03] border border-white/5 p-8 rounded-[2.5rem] text-center btn-cinematic">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">Arena Ranking</p>
                                <p className="text-4xl font-black italic text-white">#{userRank}</p>
                                <p className="text-[10px] font-black text-white/20 uppercase mt-1">Global percentile</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center pt-4">
                    <button
                        onClick={() => navigate('/student-dashboard')}
                        className="bg-[var(--bg-accent)] text-[var(--text-on-accent)] px-16 py-6 rounded-[2.5rem] font-black italic uppercase tracking-[0.2em] text-xl btn-cinematic shadow-2xl shadow-[var(--bg-accent)]/30"
                    >
                        Return to Academy
                    </button>
                </div>
            </div>
        );
    };

    return (
        <DashboardLayout role={user?.role}>
            {isStudent ? renderStudentView() : (
                <div className="max-w-6xl mx-auto space-y-12">
                    <div className="text-center space-y-4">
                        <h1 className="text-7xl font-black italic uppercase tracking-tighter leading-none">
                            Arena <span className="text-[var(--text-accent)] drop-shadow-[0_0_15px_var(--bg-accent-glow)]">Standings</span>
                        </h1>
                        <p className="text-white/20 font-black uppercase tracking-[0.5em] text-[10px]">
                            {results.length} Active Participants • {quiz?.questions?.length || 0} Evaluated Parameters
                        </p>
                    </div>

                    <div className="glass-panel rounded-[3.5rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
                        <div className="px-10 py-8 bg-white/[0.05] border-b border-white/5 flex items-center gap-6">
                            <div className="w-16 text-[10px] font-black text-white/30 uppercase tracking-[0.3em] text-center">Rank</div>
                            <div className="w-56 text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Operator</div>
                            <div className="flex-1 text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Neural Answer Mapping</div>
                            <div className="w-24 text-[10px] font-black text-white/30 uppercase tracking-[0.3em] text-center">Efficiency</div>
                            <div className="w-28 text-[10px] font-black text-white/30 uppercase tracking-[0.3em] text-center">Status</div>
                        </div>

                        <div className="divide-y divide-white/5 bg-white/[0.02]">
                            <AnimatePresence>
                                {paginatedResults.map((res, pIdx) => {
                                    const rank = (currentPage - 1) * studentsPerPage + pIdx + 1;
                                    return (
                                        <motion.div
                                            key={res.studentId || pIdx}
                                            initial={{ x: -30, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ delay: pIdx * 0.05, ease: [0.16, 1, 0.3, 1], duration: 0.8 }}
                                            className={`px-10 py-7 flex items-center gap-6 hover:bg-white/[0.05] transition-all duration-500 group ${rank <= 3 ? 'bg-[var(--bg-accent)]/5' : ''}`}
                                        >
                                            <div className="w-16 text-center">
                                                {rank === 1 ? <Trophy size={34} className="text-yellow-400 mx-auto drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" /> :
                                                 rank === 2 ? <Medal size={30} className="text-slate-200 mx-auto drop-shadow-[0_0_10px_rgba(226,232,240,0.4)]" /> :
                                                 rank === 3 ? <Medal size={30} className="text-amber-500 mx-auto drop-shadow-[0_0_10px_rgba(245,158,11,0.4)]" /> :
                                                 <div className="flex flex-col items-center justify-center text-white/20 group-hover:text-white/60 transition-all">
                                                     <Medal size={16} className="mb-0.5" />
                                                     <span className="text-sm font-black italic">#{rank}</span>
                                                 </div>}
                                            </div>

                                            <div className="w-56 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-black text-white text-lg tracking-tight group-hover:text-[var(--text-accent)] transition-colors truncate">
                                                        {res.username || 'Unknown'}
                                                    </p>
                                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${res.isOnline ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-white/10'}`} />
                                                </div>
                                                <p className="text-[10px] text-white/20 font-black uppercase tracking-widest mt-1 truncate">{res.studentId}</p>
                                            </div>

                                            <div className="flex-1 flex items-center gap-2 flex-wrap">
                                                {quiz?.questions?.map((q, idx) => {
                                                    const answer = res.answers?.find(a => a.questionText === q.questionText);
                                                    const isCorrect = answer?.isCorrect === true;
                                                    return (
                                                        <motion.div 
                                                            key={idx}
                                                            whileHover={{ scale: 1.2, zIndex: 10 }}
                                                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] border shadow-lg transition-all duration-300 ${
                                                            !answer ? 'bg-white/5 border-white/10 text-white/10' :
                                                            isCorrect ? 'bg-green-500/20 border-green-500/30 text-green-400' : 
                                                            'bg-red-500/20 border-red-500/30 text-red-400'
                                                        }`}>
                                                            {!answer ? <Minus size={12} /> : isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>

                                            <div className="w-24 text-center">
                                                <span className="text-3xl font-black text-[var(--text-accent)] italic tracking-tighter">{res.currentScore}</span>
                                            </div>

                                            <div className="w-28 flex items-center justify-center gap-3">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-black text-green-400">{res.answers?.filter(a => a.isCorrect)?.length || 0}</span>
                                                    <span className="text-[8px] font-black text-green-400/30 uppercase">Pass</span>
                                                </div>
                                                <div className="h-6 w-[1px] bg-white/10" />
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-black text-red-400">{(res.answers?.length || 0) - (res.answers?.filter(a => a.isCorrect)?.length || 0)}</span>
                                                    <span className="text-[8px] font-black text-red-400/30 uppercase">Fail</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="flex justify-center gap-8 pt-6">
                        <button onClick={() => navigate('/teacher-dashboard')} className="bg-white/5 border border-white/5 text-white/50 px-12 py-6 rounded-[2.5rem] font-black italic uppercase tracking-[0.2em] text-lg btn-cinematic hover:text-white hover:border-white/20 transition-all">
                            Terminal
                        </button>
                        <button onClick={() => window.location.reload()} className="bg-[var(--bg-accent)] text-[var(--text-on-accent)] px-16 py-6 rounded-[2.5rem] font-black italic uppercase tracking-[0.2em] text-xl btn-cinematic shadow-2xl shadow-[var(--bg-accent)]/30">
                            Sync Arena
                        </button>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
