import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { Type, Loader2, Plus, CheckCircle, Clock, Upload, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

// Modular Architecture Imports
import { PremiumButton, PremiumInput, GlassCard } from '../components/ui/Primitives';
import AikenUploadPanel from '../components/quiz/AikenUploadPanel';
import QuizQuestionEditor from '../components/quiz/QuizQuestionEditor';

export default function CreateQuizText() {
    const navigate = useNavigate();
    const location = useLocation();
    
    // ─── STATE MANAGEMENT ───────────────────────────────────────────────────
    const [title, setTitle] = useState('');
    const [isAssessment, setIsAssessment] = useState(false);
    const [duration, setDuration] = useState(30);
    const [questions, setQuestions] = useState([{ questionText: '', options: ['', ''], correctAnswer: '', points: 10 }]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('manual');
    const [aikenLoaded, setAikenLoaded] = useState(false);
    const [isGeneratedSource, setIsGeneratedSource] = useState(false);

    // ─── INITIALIZATION ─────────────────────────────────────────────────────
    useEffect(() => {
        if (location.state?.generatedQuestions) {
            setQuestions(location.state.generatedQuestions);
            setIsGeneratedSource(true);
            if (location.state.title) setTitle(location.state.title);
            toast.success('AI Intel Injected Successfully');
        }
    }, [location.state]);

    // ─── QUESTION ACTIONS ───────────────────────────────────────────────────
    const addQuestion = () => {
        setQuestions([...questions, { questionText: '', options: ['', ''], correctAnswer: '', points: 10 }]);
    };

    const deleteQuestion = (index) => {
        if (questions.length <= 1) return;
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const updateQuestion = (index, field, value) => {
        const newQuestions = [...questions];
        newQuestions[index][field] = value;
        setQuestions(newQuestions);
    };

    const addOption = (qIndex) => {
        const newQuestions = [...questions];
        if (newQuestions[qIndex].options.length < 6) {
            newQuestions[qIndex].options.push('');
            setQuestions(newQuestions);
        }
    };

    const deleteOption = (qIndex, oIndex) => {
        const newQuestions = [...questions];
        if (newQuestions[qIndex].options.length > 2) {
            newQuestions[qIndex].options.splice(oIndex, 1);
            setQuestions(newQuestions);
        }
    };

    const updateOption = (qIndex, oIndex, value) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options[oIndex] = value;
        setQuestions(newQuestions);
    };

    const handleAikenLoad = (newQuestions) => {
        setQuestions(newQuestions);
        setAikenLoaded(true);
        setActiveTab('manual');
        toast.success(`${newQuestions.length} AIKEN questions loaded`);
    };

    // ─── SUBMISSION ─────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation Layer
        if (!title.trim()) return toast.error('Enter a command title');
        const invalidIdx = questions.findIndex(q => !q.questionText.trim() || !q.correctAnswer || q.options.some(o => !o.trim()));
        if (invalidIdx !== -1) return toast.error(`Question ${invalidIdx + 1} is incomplete`);

        setLoading(true);
        try {
            await api.post('/quiz/create', { title, questions, duration, isAssessment });
            toast.success('Mission Published Successfully');
            navigate('/teacher-dashboard');
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Network Link Failure');
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-[100rem] mx-auto px-6 py-10">
                
                {/* Header System */}
                <div className="flex items-center justify-between mb-12">
                    <div className="space-y-4">
                        <PremiumButton variant="ghost" icon={ArrowLeft} onClick={() => navigate(-1)}>
                            Back
                        </PremiumButton>
                        <h1 className="text-hero-fluid font-black text-white italic uppercase tracking-tighter drop-shadow-[0_0_20px_var(--bg-accent-glow)]">
                            QUIZ <span className="text-[var(--text-accent)]">FORGE</span>
                        </h1>
                    </div>
                </div>

                {/* Tab Interface */}
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-2 mb-12 w-fit">
                    <button
                        onClick={() => setActiveTab('manual')}
                        className={`flex items-center gap-2 px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all
                            ${activeTab === 'manual' ? 'bg-[var(--bg-accent)] text-white shadow-xl' : 'text-white/30 hover:text-white'}`}
                    >
                        <Type size={16} /> Manual Matrix
                    </button>
                    {!isGeneratedSource && (
                        <button
                            onClick={() => setActiveTab('aiken')}
                            className={`flex items-center gap-2 px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all
                                ${activeTab === 'aiken' ? 'bg-[var(--bg-accent)] text-white shadow-xl' : 'text-white/30 hover:text-white'}`}
                        >
                            <Upload size={16} /> AIKEN Uplink
                        </button>
                    )}
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'aiken' ? (
                        <motion.div key="aiken" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <AikenUploadPanel onQuestionsLoaded={handleAikenLoad} />
                        </motion.div>
                    ) : (
                        <motion.div key="manual" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                            <form onSubmit={handleSubmit} className="space-y-16">
                                
                                {/* Meta Config */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <GlassCard className="lg:col-span-2">
                                        <PremiumInput
                                            label="Campaign Title"
                                            placeholder="Enter quiz title..."
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            className="text-3xl"
                                        />
                                    </GlassCard>

                                    <GlassCard className="flex flex-col justify-center">
                                        <label className="flex items-center gap-4 cursor-pointer group">
                                            <div className="relative w-16 h-8">
                                                <input type="checkbox" className="sr-only peer" checked={isAssessment} onChange={(e) => setIsAssessment(e.target.checked)} />
                                                <div className="w-16 h-8 bg-white/10 peer-checked:bg-[var(--bg-accent)] rounded-full transition-all ring-1 ring-white/10"></div>
                                                <div className="absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-all peer-checked:translate-x-8"></div>
                                            </div>
                                            <div>
                                                <span className="block font-black text-lg text-white uppercase tracking-tighter italic">Assessment Mode</span>
                                                <span className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em]">Live Link • Async Mode</span>
                                            </div>
                                        </label>
                                    </GlassCard>
                                </div>

                                {/* Questions Matrix */}
                                <div className="space-y-12">
                                    {questions.map((q, idx) => (
                                        <QuizQuestionEditor
                                            key={idx}
                                            index={idx}
                                            question={q}
                                            onUpdate={updateQuestion}
                                            onDelete={deleteQuestion}
                                            onAddOption={addOption}
                                            onDeleteOption={deleteOption}
                                            onUpdateOption={updateOption}
                                        />
                                    ))}

                                    <button
                                        type="button"
                                        onClick={addQuestion}
                                        className="w-full flex items-center justify-center gap-4 p-12 rounded-[3rem] border-4 border-dashed border-white/5 text-white/20 hover:border-[var(--bg-accent)]/50 hover:text-[var(--text-accent)] transition-all group bg-white/[0.01]"
                                    >
                                        <Plus size={32} className="group-hover:scale-125 transition-transform" />
                                        <span className="font-black text-2xl uppercase tracking-widest italic">Add New Data Point</span>
                                    </button>
                                </div>

                                {/* Final Execution */}
                                <div className="flex justify-center pt-16 border-t border-white/5">
                                    <PremiumButton
                                        type="submit"
                                        disabled={loading}
                                        className="px-24 py-10 text-3xl italic"
                                        icon={loading ? Loader2 : CheckCircle}
                                    >
                                        {loading ? 'PUBLISHING...' : 'FINALIZE MISSION'}
                                    </PremiumButton>
                                </div>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </DashboardLayout>
    );
}
