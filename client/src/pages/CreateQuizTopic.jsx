import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { Book, Loader2, CheckCircle, Hash, Gauge, Clock, Radio } from 'lucide-react';

export default function CreateQuizTopic() {
    const [topic, setTopic] = useState('');
    const [questionCount, setQuestionCount] = useState(5);
    const [difficulty, setDifficulty] = useState('Medium');
    const [timer, setTimer] = useState(30);
    const [loading, setLoading] = useState(false);
    const [isLive, setIsLive] = useState(false);

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                topic,
                type: 'topic',
                questionCount,
                difficulty,
                timerPerQuestion: timer,
                isLive
            };

            const res = await api.post('/quiz/create', payload);

            if (isLive) {
                navigate(`/live-room-teacher/${res.data.joinCode}`);
            } else {
                navigate('/teacher-dashboard');
                alert('AI Quiz Generated from Topic Successfully!');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to generate quiz');
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-2xl mx-auto py-8">
                <div className="mb-8 flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-lg">
                        <Book className="text-green-600" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Create from Topic</h1>
                        <p className="text-gray-500">Enter a topic and let AI handle the rest.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border-2 border-green-50 p-8 space-y-8">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Enter Topic</label>
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            className="w-full p-4 border-none bg-gray-50 rounded-xl focus:ring-2 focus:ring-green-500"
                            placeholder="e.g. World War II, Photosynthesis, Javascript Basics"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-100">
                            <label className="flex items-center gap-2 text-sm font-bold text-blue-800 mb-3 uppercase tracking-wide">
                                <Hash size={18} /> Questions
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="20"
                                value={questionCount}
                                onChange={(e) => setQuestionCount(parseInt(e.target.value) || 0)}
                                className="w-full p-4 border-2 border-blue-200 bg-white rounded-xl focus:ring-2 focus:ring-blue-500 font-black text-xl text-blue-900"
                                required
                            />
                        </div>

                        <div className="bg-purple-50 p-6 rounded-2xl border-2 border-purple-100">
                            <label className="flex items-center gap-2 text-sm font-bold text-purple-800 mb-3 uppercase tracking-wide">
                                <Gauge size={18} /> Difficulty
                            </label>
                            <select
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value)}
                                className="w-full p-4 border-2 border-purple-200 bg-white rounded-xl focus:ring-2 focus:ring-purple-500 font-bold text-lg text-purple-900"
                            >
                                <option value="Easy">Easy</option>
                                <option value="Medium">Medium</option>
                                <option value="Thinkable">Thinkable</option>
                                <option value="Hard">Hard</option>
                            </select>
                        </div>
                    </div>
                    <div className="bg-orange-50 p-6 rounded-2xl border-2 border-orange-100">
                        <label className="flex items-center gap-2 text-sm font-bold text-orange-800 mb-3 uppercase tracking-wide">
                            <Clock size={18} /> Timer per Question (Seconds)
                        </label>
                        <input
                            type="number"
                            min="10"
                            max="300"
                            value={timer}
                            onChange={(e) => setTimer(parseInt(e.target.value) || 0)}
                            className="w-full p-4 border-2 border-orange-200 bg-white rounded-xl focus:ring-2 focus:ring-orange-500 font-black text-xl text-orange-900"
                            required
                        />
                    </div>

                    <div className="bg-indigo-50 p-6 rounded-2xl border-2 border-indigo-100 flex flex-col justify-center">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={isLive}
                                onChange={(e) => setIsLive(e.target.checked)}
                                className="w-5 h-5 text-indigo-600 border-indigo-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer"
                            />
                            <div className="flex items-center gap-2">
                                <Radio className="text-indigo-600" size={18} />
                                <span className="text-sm font-bold text-indigo-800 uppercase tracking-wide">Create Live Room</span>
                            </div>
                        </label>
                        <p className="text-xs text-indigo-600 mt-2 ml-8">Students join with a code and see live leaderboard</p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !topic}
                        className="w-full flex items-center justify-center gap-3 bg-green-600 text-white px-8 py-5 rounded-2xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl hover:shadow-2xl font-black text-xl uppercase tracking-widest mt-4"
                    >
                        {loading ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={24} />}
                        {loading ? 'Generating Quiz...' : 'Generate AI Quiz'}
                    </button>
                </form>
            </div >
        </DashboardLayout >
    );
}
