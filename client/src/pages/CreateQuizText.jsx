import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { Type, Loader2, Plus, Minus, CheckCircle, Clock, Radio } from 'lucide-react';

export default function CreateQuizText() {
    const [title, setTitle] = useState('');
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(30);
    const [isLive, setIsLive] = useState(false);
    const [questions, setQuestions] = useState([
        { questionText: '', options: ['', ''], correctAnswer: '', points: 10 }
    ]);

    const navigate = useNavigate();

    const addQuestion = () => {
        setQuestions([...questions, { questionText: '', options: ['', ''], correctAnswer: '', points: 10 }]);
    };

    const removeQuestion = (index) => {
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const updateQuestion = (index, field, value) => {
        const newQuestions = [...questions];
        newQuestions[index][field] = value;
        setQuestions(newQuestions);
    };

    const updateOption = (qIndex, oIndex, value) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options[oIndex] = value;
        setQuestions(newQuestions);
    };

    const addOption = (qIndex) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options.push('');
        setQuestions(newQuestions);
    };

    const removeOption = (qIndex, oIndex) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options = newQuestions[qIndex].options.filter((_, i) => i !== oIndex);
        setQuestions(newQuestions);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = { title, type: 'manual', questions, isLive, timerPerQuestion: timer };

            const res = await api.post('/quiz/create', payload);

            if (isLive) {
                navigate(`/live-room-teacher/${res.data.joinCode}`);
            } else {
                navigate('/teacher-dashboard');
                alert('Quiz Created Successfully!');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to create quiz');
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-4xl mx-auto pb-12">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <Type className="text-blue-600" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Create Quiz</h1>
                            <p className="text-gray-500">Manually enter your questions and options.</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Quiz Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full p-3 border-none bg-gray-50 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. Midterm Physics Quiz"
                                required
                            />
                        </div>
                    </div>

                    {/* Configuration Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                    className="w-5 h-5 text-indigo-600 border-2 border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500"
                                />
                                <div className="flex items-center gap-2">
                                    <Radio className="text-indigo-600" size={18} />
                                    <span className="text-sm font-bold text-indigo-800 uppercase tracking-wide">Create Live Room</span>
                                </div>
                            </label>
                            <p className="text-xs text-indigo-600 mt-2 ml-8">Students join with a code and see live leaderboard</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {questions.map((q, qIndex) => (
                            <div key={qIndex} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4 relative">
                                <button
                                    type="button"
                                    onClick={() => removeQuestion(qIndex)}
                                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500"
                                >
                                    <Minus size={20} />
                                </button>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Question {qIndex + 1}</label>
                                    <input
                                        type="text"
                                        value={q.questionText}
                                        onChange={(e) => updateQuestion(qIndex, 'questionText', e.target.value)}
                                        className="w-full p-3 border-none bg-gray-50 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="What is the capital of France?"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    {q.options.map((opt, oIndex) => (
                                        <div key={oIndex} className="flex items-center gap-2 group">
                                            <input
                                                type="radio"
                                                name={`correct-${qIndex}`}
                                                checked={q.correctAnswer === opt && opt !== ''}
                                                onChange={() => updateQuestion(qIndex, 'correctAnswer', opt)}
                                                required
                                            />
                                            <input
                                                type="text"
                                                value={opt}
                                                onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                                className="flex-1 p-2 border-none bg-gray-50 rounded-md focus:ring-1 focus:ring-blue-500 text-sm"
                                                placeholder={`Option ${oIndex + 1}`}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeOption(qIndex, oIndex)}
                                                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                                            >
                                                <Minus size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => addOption(qIndex)}
                                    className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:text-blue-700"
                                >
                                    <Plus size={16} /> Add Option
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addQuestion}
                            className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-all flex items-center justify-center gap-2 font-medium"
                        >
                            <Plus size={20} /> Add New Question
                        </button>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl font-bold"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                            {loading ? 'Submitting...' : 'Create Quiz'}
                        </button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
