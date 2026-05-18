import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import AttemptQuiz from './AttemptQuiz';
import AssessmentAttempt from './AssessmentAttempt';
import WaitingRoomLoader from '../components/loaders/WaitingRoomLoader';

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
    } else {
        return <AssessmentAttempt />;
    }
}
