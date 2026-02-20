import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { Type, Loader2, Plus, Minus, CheckCircle, Clock, Radio } from 'lucide-react';

export default function CreateQuizText() {
    const navigate = useNavigate();
    const location = useLocation();

    const [title, setTitle] = useState('');
    const [loading, setLoading] = useState(false);
    const [duration, setDuration] = useState(10); // Default 10 minutes
    const [isAssessment, setIsAssessment] = useState(false);
    const [questions, setQuestions] = useState(
        Array(5).fill(null).map(() => ({
            questionText: '',
            options: ['', '', '', ''],
            correctAnswer: '',
            points: 10
        }))
    );

    useEffect(() => {
        if (location.state) {
            if (location.state.questions) setQuestions(location.state.questions);
            if (location.state.title) setTitle(location.state.title);
            if (location.state.duration) setDuration(location.state.duration);
            if (location.state.isAssessment !== undefined) setIsAssessment(location.state.isAssessment);
        }
    }, [location.state]);

    const addQuestion = () => {
        setQuestions([...questions, {
            questionText: '',
            options: ['', '', '', ''],
            correctAnswer: '',
            points: 10
        }]);
    };

    const deleteQuestion = (index) => {
        if (questions.length <= 1) return;
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const addOption = (qIndex) => {
        const newQuestions = [...questions];
        if (newQuestions[qIndex].options.length >= 6) return;
        newQuestions[qIndex].options.push('');
        setQuestions(newQuestions);
    };

    const deleteOption = (qIndex, oIndex) => {
        const newQuestions = [...questions];
        if (newQuestions[qIndex].options.length <= 2) return;
        const optToDelete = newQuestions[qIndex].options[oIndex];
        newQuestions[qIndex].options = newQuestions[qIndex].options.filter((_, i) => i !== oIndex);
        if (newQuestions[qIndex].correctAnswer === optToDelete) {
            newQuestions[qIndex].correctAnswer = '';
        }
        setQuestions(newQuestions);
    };

    const updateQuestion = (index, field, value) => {
        const newQuestions = [...questions];
        newQuestions[index][field] = value;
        setQuestions(newQuestions);
    };

    const updateOption = (qIndex, oIndex, value) => {
        const newQuestions = [...questions];
        const oldVal = newQuestions[qIndex].options[oIndex];
        newQuestions[qIndex].options[oIndex] = value;
        if (newQuestions[qIndex].correctAnswer === oldVal && oldVal !== '') {
            newQuestions[qIndex].correctAnswer = value;
        }
        setQuestions(newQuestions);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (questions.some(q => !q.questionText || !q.correctAnswer || q.options.some(opt => !opt))) {
            return alert('Please fill in all questions, options, and select correct answers.');
        }

        setLoading(true);
        try {
            const payload = {
                title: title || 'Untitled Quiz',
                type: 'manual',
                questions,
                isLive: !isAssessment,
                isActive: true, // Always active so join code is searchable
                isAssessment,
                timerPerQuestion: isAssessment ? 0 : 30, // Default 30s for live, 0 for assessment
                duration: isAssessment ? 0 : duration // Disable global timer for assessment if live timers are disabled? Or maybe keep it? User said "timer should be disabled because it is not live quiz"
            };

            // Re-read user: "automatically the timer should be disabled because it is not live quiz"
            // This probably means both per-question and global duration.
            if (isAssessment) {
                payload.duration = 0;
                payload.timerPerQuestion = 0;
            }

            const res = await api.post('/quiz/create', payload);

            if (res.data.isAssessment) {
                navigate('/my-quizzes');
            } else {
                navigate(`/live-room-teacher/${res.data.joinCode}`);
            }
            alert(isAssessment ? 'Assessment Published!' : 'Live Quiz Created!');
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.msg || 'Failed to save quiz');
        } finally {
            setLoading(false);
        }
    };

    const kahootColors = [
        'border-red-500/50 bg-red-500/10 hover:bg-red-500/20',
        'border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20',
        'border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20',
        'border-green-500/50 bg-green-500/10 hover:bg-green-500/20'
    ];

    const kahootAccents = [
        'bg-red-500',
        'bg-blue-500',
        'bg-yellow-500',
        'bg-green-500'
    ];

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-4xl mx-auto pb-20">
                <div className="mb-12 flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight italic uppercase">
                            Create <span className="text-[#ff6b00]">New Quiz</span>
                        </h1>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-12">
                    {/* Basic Info */}
                    <div className="space-y-8">
                        {/* Title Row - Full Width */}
                        <div className="bg-white/5 rounded-[2.5rem] border border-white/10 p-10 ring-1 ring-white/5 w-full">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Quiz Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full p-6 bg-white/5 border-2 border-transparent rounded-2xl focus:bg-white/10 focus:border-[#ff6b00] transition-all font-black text-2xl text-white placeholder:text-slate-700 outline-none"
                                placeholder="Enter quiz title..."
                                required
                            />
                        </div>

                        {/* Mode and Timer Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Assessment Toggle */}
                            <div className="bg-white/5 rounded-[2.5rem] border border-white/10 p-10 ring-1 ring-white/5 h-full">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Quiz Mode</label>
                                <label className="flex items-center gap-4 cursor-pointer group/toggle">
                                    <div className="relative w-16 h-10">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={isAssessment}
                                            onChange={(e) => setIsAssessment(e.target.checked)}
                                        />
                                        <div className="w-16 h-10 bg-white/10 peer-checked:bg-[#ff6b00] rounded-full transition-all duration-300 ring-1 ring-white/10 shadow-inner"></div>
                                        <div className="absolute left-1 top-1 w-8 h-8 bg-white rounded-full transition-all duration-300 peer-checked:translate-x-6 shadow-lg"></div>
                                    </div>
                                    <div>
                                        <span className="block font-black text-xl text-white tracking-tighter italic uppercase group-hover/toggle:text-[#ff6b00] transition-colors">Assessment Mode</span>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Fixed Link • No Timers</span>
                                    </div>
                                </label>
                            </div>

                            {!isAssessment ? (
                                <div className="bg-[#ff6b00] rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-[#ff6b00]/20 min-h-[160px]">
                                    <div className="relative z-10">
                                        <label className="flex items-center gap-2 text-[10px] font-black text-white/70 uppercase tracking-widest mb-4">
                                            <Clock size={16} /> Total Time (Mins)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="180"
                                            value={duration}
                                            onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                                            className="w-full bg-transparent border-none p-0 font-black text-5xl text-white outline-none focus:ring-0"
                                            required
                                        />
                                    </div>
                                    <Clock className="absolute -right-8 -bottom-8 opacity-10" size={140} />
                                </div>
                            ) : (
                                <div className="bg-indigo-600 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-indigo-500/20 min-h-[160px]">
                                    <div className="relative z-10">
                                        <label className="flex items-center gap-2 text-[10px] font-black text-white/70 uppercase tracking-widest mb-4">
                                            Status
                                        </label>
                                        <p className="font-black text-4xl text-white italic tracking-tighter uppercase">Asynchronous</p>
                                        <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest mt-2">Will be live for all students</p>
                                    </div>
                                    <CheckCircle className="absolute -right-8 -bottom-8 opacity-10" size={140} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Questions Section */}
                    <div className="space-y-12">
                        {questions.map((q, qIndex) => (
                            <div key={qIndex} className="bg-white/5 rounded-[3rem] border border-white/10 p-12 space-y-10 relative group ring-1 ring-white/5 overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 flex items-center gap-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                    <button
                                        type="button"
                                        onClick={() => deleteQuestion(qIndex)}
                                        className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white p-3 rounded-2xl border border-red-500/20 transition-all shadow-lg"
                                        title="Delete Question"
                                    >
                                        <Minus size={20} />
                                    </button>
                                </div>

                                <div className="flex flex-col gap-10">
                                    <div className="flex items-center gap-6">
                                        <div className="bg-white/5 w-16 h-16 rounded-2xl flex items-center justify-center text-slate-700 font-black text-2xl group-hover:bg-[#ff6b00] group-hover:text-white transition-all duration-300 shrink-0 border border-white/10 italic">
                                            {qIndex + 1}
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Question Text</label>
                                            <input
                                                type="text"
                                                value={q.questionText}
                                                onChange={(e) => updateQuestion(qIndex, 'questionText', e.target.value)}
                                                className="w-full p-6 bg-white/5 border-2 border-transparent rounded-2xl focus:bg-white/10 focus:border-[#ff6b00] transition-all font-black text-xl text-white placeholder:text-slate-700 outline-none"
                                                placeholder="Ask your question here..."
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                                        {q.options.map((opt, oIndex) => (
                                            <div key={oIndex} className={`flex items-center gap-4 p-4 rounded-3xl border-2 transition-all group/opt relative overflow-hidden ${kahootColors[oIndex % 4]} ${q.correctAnswer === opt && opt !== '' ? 'ring-4 ring-green-500/50 scale-[1.02]' : ''}`}>
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black ${kahootAccents[oIndex % 4]} shrink-0 shadow-lg`}>
                                                    {String.fromCharCode(65 + oIndex)}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={opt}
                                                    onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                                    className="flex-1 bg-transparent border-none focus:ring-0 font-bold text-white placeholder:text-white/20 py-3 text-lg"
                                                    placeholder={`Option ${oIndex + 1}`}
                                                    required
                                                />
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name={`correct-${qIndex}`}
                                                        checked={q.correctAnswer === opt && opt !== ''}
                                                        onChange={() => updateQuestion(qIndex, 'correctAnswer', opt)}
                                                        className="w-8 h-8 text-green-500 bg-white/10 border-white/20 focus:ring-green-500 cursor-pointer"
                                                        required
                                                    />
                                                    {q.options.length > 2 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteOption(qIndex, oIndex)}
                                                            className="p-2 text-white/30 hover:text-red-500 transition-colors"
                                                        >
                                                            <Minus size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {q.options.length < 6 && (
                                            <button
                                                type="button"
                                                onClick={() => addOption(qIndex)}
                                                className="flex items-center justify-center gap-2 p-6 rounded-3xl border-2 border-dashed border-white/10 text-slate-500 hover:border-[#ff6b00]/50 hover:text-[#ff6b00] transition-all group/addopt"
                                            >
                                                <Plus size={20} className="group-hover/addopt:scale-125 transition-transform" />
                                                <span className="font-black text-sm uppercase tracking-widest">Add Option</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={addQuestion}
                            className="w-full flex items-center justify-center gap-4 p-10 rounded-[3rem] border-4 border-dashed border-white/10 text-slate-500 hover:border-[#ff6b00]/50 hover:text-[#ff6b00] transition-all group/addq bg-white/2"
                        >
                            <Plus size={32} className="group-hover/addq:scale-125 transition-transform" />
                            <span className="font-black text-2xl uppercase tracking-widest italic">Add New Question</span>
                        </button>
                    </div>

                    {/* Submit */}
                    <div className="flex justify-center pt-12 border-t border-white/5">
                        <button
                            type="submit"
                            disabled={loading}
                            className="group flex items-center gap-6 bg-[#ff6b00] text-white px-20 py-8 rounded-[2.5rem] hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xl shadow-[#ff6b00]/20 font-black text-3xl italic uppercase tracking-tighter active:scale-95 border-b-8 border-[#cc5500]"
                        >
                            {loading ? <Loader2 className="animate-spin" size={32} /> : <CheckCircle size={32} />}
                            {loading ? 'PUBLISHING...' : (isAssessment ? 'PUBLISH ASSESSMENT' : 'CREATE LIVE QUIZ')}
                        </button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
