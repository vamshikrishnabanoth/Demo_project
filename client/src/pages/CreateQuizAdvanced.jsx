import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { Cpu, Loader2, CheckCircle, Sparkles } from 'lucide-react';

export default function CreateQuizAdvanced() {
    const [title, setTitle] = useState('');
    const [prompt, setPrompt] = useState('');
    const [questionCount, setQuestionCount] = useState(10);
    const [difficulty, setDifficulty] = useState('Thinkable');
    const [timer, setTimer] = useState(45);
    const [duration, setDuration] = useState(0); // Global duration
    const [loading, setLoading] = useState(false);
    const [isLive, setIsLive] = useState(false);

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                title,
                topic: prompt, // Using prompt as topic
                type: 'advanced',
                questionCount,
                difficulty,
                timerPerQuestion: timer,
                duration,
                isLive
            };

            const res = await api.post('/quiz/create', payload);

            if (isLive) {
                navigate(`/live-room-teacher/${res.data.joinCode}`);
            } else {
                navigate('/teacher-dashboard');
                alert('Advanced AI Quiz Created Successfully!');
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
            <div className="max-w-3xl mx-auto py-8">
                <div className="mb-8 flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-lg">
                        <Cpu className="text-purple-600" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Advanced AI Generation</h1>
                        <p className="text-gray-500">Describe exactly what you want and AI will build it.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl border border-purple-50 p-8 space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Sparkles size={120} className="text-purple-600" />
                    </div>

                    <div className="relative z-10 space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Quiz Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full p-4 border-none bg-gray-50 rounded-2xl focus:ring-2 focus:ring-purple-500 text-lg font-medium"
                                placeholder="e.g. Advanced Quantum Mechanics"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Custom Instructions / Prompt</label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="w-full h-40 p-4 border-none bg-gray-50 rounded-2xl focus:ring-2 focus:ring-purple-500 resize-none"
                                placeholder="e.g. Create a quiz about organic chemistry specifically focusing on alkanes and alkenes. Include 2 true/false and 8 MCQ. Make it very challenging."
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                <label className="block text-xs font-bold text-blue-800 mb-2 uppercase">Questions</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={questionCount}
                                    onChange={(e) => setQuestionCount(parseInt(e.target.value) || 0)}
                                    className="w-full bg-transparent border-none p-0 font-black text-2xl text-blue-900 focus:ring-0"
                                    required
                                />
                            </div>

                            <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                                <label className="block text-xs font-bold text-green-800 mb-2 uppercase">Difficulty</label>
                                <select
                                    value={difficulty}
                                    onChange={(e) => setDifficulty(e.target.value)}
                                    className="w-full bg-transparent border-none p-0 font-bold text-lg text-green-900 focus:ring-0 appearance-none"
                                >
                                    <option value="Easy">Easy</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Thinkable">Thinkable</option>
                                    <option value="Hard">Hard</option>
                                </select>
                            </div>

                            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                                <label className="block text-xs font-bold text-orange-800 mb-2 uppercase">Timer (Sec)</label>
                                <input
                                    type="number"
                                    min="10"
                                    max="600"
                                    value={timer}
                                    onChange={(e) => setTimer(parseInt(e.target.value) || 0)}
                                    className="w-full bg-transparent border-none p-0 font-black text-2xl text-orange-900 focus:ring-0"
                                    required
                                />
                            </div>
                        </div>

                        <div className="bg-orange-50 p-6 rounded-2xl border-2 border-orange-100">
                            <label className="flex items-center gap-2 text-sm font-bold text-orange-800 mb-3 uppercase tracking-wide">
                                Global Timer (Minutes)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="180"
                                value={duration}
                                onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                                className="w-full p-4 border-2 border-orange-200 bg-white rounded-xl focus:ring-2 focus:ring-orange-500 font-black text-xl text-orange-900"
                                placeholder="0 = No Limit"
                            />
                            <p className="text-xs text-orange-600 mt-2">Optional: Overrides per-question timer if set {'>'} 0</p>
                        </div>

                        <div>
                            <label className="flex items-center gap-3 cursor-pointer bg-purple-50 p-5 rounded-2xl border border-purple-100 hover:bg-purple-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={isLive}
                                    onChange={(e) => setIsLive(e.target.checked)}
                                    className="w-6 h-6 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <div>
                                    <span className="block font-bold text-gray-900">Enable Live Room Session</span>
                                    <span className="text-xs text-purple-600 font-medium">Control exactly when students begin the assessment.</span>
                                </div>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !prompt}
                            className="w-full flex items-center justify-center gap-3 bg-purple-600 text-white px-8 py-5 rounded-2xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl hover:shadow-2xl font-black text-xl uppercase tracking-widest mt-4"
                        >
                            {loading ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={24} />}
                            {loading ? 'Crafting Advanced Quiz...' : 'Create Advanced Quiz'}
                        </button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
