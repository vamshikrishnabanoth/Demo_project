import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { Type, Loader2, Plus, CheckCircle, Clock, Upload, ArrowLeft, Users, Clipboard, Code, Zap, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import StudentAssignDrawer from '../components/quiz/StudentAssignDrawer';
import toast from 'react-hot-toast';

// Modular Architecture Imports
import { PremiumButton, PremiumInput, GlassCard } from '../components/ui/Primitives';
import AikenUploadPanel from '../components/quiz/AikenUploadPanel';
import AikenPastePanel from '../components/quiz/AikenPastePanel';
import JsonPastePanel from '../components/quiz/JsonPastePanel';
import QuizQuestionEditor from '../components/quiz/QuizQuestionEditor';

export default function CreateQuizText() {
    const navigate = useNavigate();
    const location = useLocation();
    
    // ─── STATE MANAGEMENT ───────────────────────────────────────────────────
    const [title, setTitle] = useState('');
    const [isAssessment, setIsAssessment] = useState(false);
    const [duration, setDuration] = useState(30);
    const [timerType, setTimerType] = useState('timePerQuestion');
    const [timerPerQuestion, setTimerPerQuestion] = useState(30);
    const [accessType, setAccessType] = useState('private');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [startNow, setStartNow] = useState(false);
    const [questions, setQuestions] = useState([{ questionText: '', options: ['', ''], correctAnswer: '', points: 10 }]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('manual');
    const [aikenLoaded, setAikenLoaded] = useState(false);
    const [isGeneratedSource, setIsGeneratedSource] = useState(false);
    const [assignedGroups, setAssignedGroups] = useState([]);
    const [assignedStudents, setAssignedStudents] = useState([]);
    const [isAssignDrawerOpen, setIsAssignDrawerOpen] = useState(false);

    // ─── INITIALIZATION ─────────────────────────────────────────────────────
    useEffect(() => {
        // Support both key names: 'questions' (from AI generator) and 'generatedQuestions' (legacy)
        const incoming = location.state?.questions || location.state?.generatedQuestions;
        if (incoming) {
            setQuestions(incoming);
            setIsGeneratedSource(true);
            if (location.state.title) setTitle(location.state.title);
            if (location.state.duration) setDuration(location.state.duration);
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

        let finalStartTime = startTime;
        let finalEndTime = endTime;

        if (startNow) {
            finalStartTime = new Date().toISOString();
            if (!finalEndTime) {
                if (timerType === 'totalTime' && duration) {
                    finalEndTime = new Date(Date.now() + (parseInt(duration) || 30) * 60000).toISOString();
                } else if (timerType === 'timePerQuestion' && timerPerQuestion) {
                    // Auto-calculate end time: (number of questions * timerPerQuestion) in milliseconds
                    // Add a 5 minute buffer so students have time to join the "Start Now" quiz
                    const totalTimeMs = (questions.length * (parseInt(timerPerQuestion) || 30)) * 1000;
                    finalEndTime = new Date(Date.now() + totalTimeMs + (5 * 60000)).toISOString();
                } else {
                    setLoading(false);
                    return toast.error('Expiration End is required when Start Now is enabled');
                }
            }
        } else if (!startTime) {
            finalStartTime = null;
        }

        if (finalStartTime && finalEndTime) {
             if (new Date(finalEndTime) <= new Date(finalStartTime)) {
                  setLoading(false);
                  return toast.error("End time must be after start time");
             }
        }

        try {
            const res = await api.post('/quiz/create', { 
                title, 
                questions, 
                duration: timerType === 'totalTime' ? (parseInt(duration) || 30) : 0,
                timerPerQuestion: timerType === 'timePerQuestion' ? (parseInt(timerPerQuestion) || 30) : 0,
                timerType,
                accessType,
                startTime: finalStartTime,
                endTime: finalEndTime || null,
                isAssessment,
                isLive: !isAssessment,
                assignedGroups,
                assignedStudents
            });
            toast.success('Mission Published Successfully');
            if (!isAssessment) {
                // Synchronous quiz -> Redirect to live teacher lobby room
                navigate(`/live-room-teacher/${res.data.joinCode}`);
            } else {
                // Asynchronous quiz -> Standard dashboard
                navigate('/teacher-dashboard');
            }
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
                        <>
                            <button
                                onClick={() => setActiveTab('aiken')}
                                className={`flex items-center gap-2 px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all
                                    ${activeTab === 'aiken' ? 'bg-[var(--bg-accent)] text-white shadow-xl' : 'text-white/30 hover:text-white'}`}
                            >
                                <Upload size={16} /> AIKEN Uplink
                            </button>
                            <button
                                onClick={() => setActiveTab('aikenPaste')}
                                className={`flex items-center gap-2 px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all
                                    ${activeTab === 'aikenPaste' ? 'bg-[var(--bg-accent)] text-white shadow-xl' : 'text-white/30 hover:text-white'}`}
                            >
                                <Clipboard size={16} /> AIKEN Paste
                            </button>
                            <button
                                onClick={() => setActiveTab('jsonPaste')}
                                className={`flex items-center gap-2 px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all
                                    ${activeTab === 'jsonPaste' ? 'bg-[var(--bg-accent)] text-white shadow-xl' : 'text-white/30 hover:text-white'}`}
                            >
                                <Code size={16} /> JSON Paste
                            </button>
                        </>
                    )}
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'aiken' && (
                        <motion.div key="aiken" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <AikenUploadPanel onQuestionsLoaded={handleAikenLoad} />
                        </motion.div>
                    )}
                    {activeTab === 'aikenPaste' && (
                        <motion.div key="aikenPaste" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <AikenPastePanel onQuestionsLoaded={handleAikenLoad} />
                        </motion.div>
                    )}
                    {activeTab === 'jsonPaste' && (
                        <motion.div key="jsonPaste" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <JsonPastePanel onQuestionsLoaded={handleAikenLoad} />
                        </motion.div>
                    )}
                    {activeTab === 'manual' && (
                        <motion.div key="manual" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                            <form onSubmit={handleSubmit} className="space-y-16">
                                
                                {/* Meta Config */}
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                                    <GlassCard className="lg:col-span-2">
                                        <PremiumInput
                                            label="Campaign Title"
                                            placeholder="Enter quiz title..."
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            className="text-3xl"
                                        />
                                    </GlassCard>

                                    <GlassCard className="flex flex-col justify-center gap-3">
                                        <div>
                                            <span className="block font-black text-[9px] text-white/30 uppercase tracking-[0.2em] mb-2">Arena Mode</span>
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsAssessment(false)}
                                                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all text-left ${
                                                        !isAssessment
                                                            ? 'bg-[var(--bg-accent)]/20 border-[var(--bg-accent)] text-white shadow-md'
                                                            : 'bg-white/[0.02] border-white/5 text-white/50 hover:text-white hover:border-white/10'
                                                    }`}
                                                >
                                                    <Zap size={14} className={!isAssessment ? 'text-[var(--text-accent)] animate-pulse' : 'text-white/30'} />
                                                    <div>
                                                        <span className="block font-black text-xs uppercase tracking-tight italic">Synchronous</span>
                                                        <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider block">Real-time Live Arena</span>
                                                    </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsAssessment(true)}
                                                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all text-left ${
                                                        isAssessment
                                                            ? 'bg-[var(--bg-accent)]/20 border-[var(--bg-accent)] text-white shadow-md'
                                                            : 'bg-white/[0.02] border-white/5 text-white/50 hover:text-white hover:border-white/10'
                                                    }`}
                                                >
                                                    <BookOpen size={14} className={isAssessment ? 'text-[var(--text-accent)]' : 'text-white/30'} />
                                                    <div>
                                                        <span className="block font-black text-xs uppercase tracking-tight italic">Asynchronous</span>
                                                        <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider block">Self-paced Task</span>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    </GlassCard>

                                    <GlassCard className="flex flex-col justify-center">
                                        <div className="flex flex-col gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setIsAssignDrawerOpen(true)}
                                                className="w-full bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400 hover:text-slate-950 px-6 py-3.5 rounded-2xl font-black italic uppercase tracking-tighter transition-all active:scale-95 flex items-center justify-center gap-2 text-xs"
                                            >
                                                <Users size={14} /> Target Students ({assignedGroups.length} Grp, {assignedStudents.length} Ind)
                                            </button>
                                            <span className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em] text-center">Set eligibility rules during forge</span>
                                        </div>
                                    </GlassCard>
                                </div>

                                {/* Premium Campaign Control Settings */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                    <GlassCard className="flex flex-col justify-center gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Access Admission</label>
                                            <select
                                                value={accessType}
                                                onChange={(e) => setAccessType(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white font-black italic outline-none appearance-none cursor-pointer focus:border-[var(--bg-accent)]/50 focus:ring-2 focus:ring-[var(--bg-accent)]/15 transition-all text-sm uppercase tracking-tighter"
                                            >
                                                <option value="private" style={{ color: '#ffffff', backgroundColor: '#0f172a' }}>Private (PIN Required)</option>
                                                <option value="public" style={{ color: '#ffffff', backgroundColor: '#0f172a' }}>Public (No PIN)</option>
                                            </select>
                                        </div>
                                    </GlassCard>

                                    <GlassCard className="flex flex-col justify-center gap-4">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Timer Mode</label>
                                                <select
                                                    value={timerType}
                                                    onChange={(e) => setTimerType(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white font-black italic outline-none appearance-none cursor-pointer focus:border-[var(--bg-accent)]/50 focus:ring-2 focus:ring-[var(--bg-accent)]/15 transition-all text-sm uppercase tracking-tighter"
                                                >
                                                    <option value="timePerQuestion" style={{ color: '#ffffff', backgroundColor: '#0f172a' }}>Time Per Question</option>
                                                    <option value="totalTime" style={{ color: '#ffffff', backgroundColor: '#0f172a' }}>Total Quiz Time</option>
                                                </select>
                                            </div>
                                            {timerType === 'timePerQuestion' ? (
                                                <div className="animate-in slide-in-from-top-2 duration-200">
                                                    <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Seconds Per Screen</label>
                                                    <input
                                                        type="number"
                                                        min="5"
                                                        max="300"
                                                        value={timerPerQuestion}
                                                        onChange={(e) => { const v = parseInt(e.target.value); setTimerPerQuestion(isNaN(v) ? '' : v); }}
                                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-5 text-white font-black italic outline-none focus:border-[var(--bg-accent)]/50 transition-all"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="animate-in slide-in-from-top-2 duration-200">
                                                    <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Total Minutes</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="300"
                                                        value={duration}
                                                        onChange={(e) => { const v = parseInt(e.target.value); setDuration(isNaN(v) ? '' : v); }}
                                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-5 text-white font-black italic outline-none focus:border-[var(--bg-accent)]/50 transition-all"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </GlassCard>

                                    <GlassCard className="flex flex-col justify-center gap-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest">Scheduled Start</label>
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className="relative w-8 h-4">
                                                        <input type="checkbox" className="sr-only peer" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} />
                                                        <div className="w-8 h-4 bg-white/10 peer-checked:bg-[var(--bg-accent)] rounded-full transition-all ring-1 ring-white/10"></div>
                                                        <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-all peer-checked:translate-x-4"></div>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-[var(--text-accent)] uppercase tracking-wider">Start Now</span>
                                                </label>
                                            </div>
                                            
                                            {!startNow ? (
                                                <input
                                                    type="datetime-local"
                                                    value={startTime}
                                                    onChange={(e) => setStartTime(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white font-black outline-none focus:border-[var(--bg-accent)]/50 focus:ring-2 focus:ring-[var(--bg-accent)]/15 transition-all text-xs"
                                                />
                                            ) : (
                                                <div className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 flex items-center justify-center opacity-70">
                                                    <span className="text-xs font-black text-[var(--text-accent)] italic uppercase tracking-wider">Active Immediately</span>
                                                </div>
                                            )}
                                            
                                            <span className="text-[8px] text-white/20 font-black uppercase tracking-[0.2em] mt-2 block">
                                                {startNow ? 'Bypasses scheduled waiting state' : 'Optional: Leave blank for instant access'}
                                            </span>
                                        </div>
                                    </GlassCard>

                                    <GlassCard className="flex flex-col justify-center gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Expiration End</label>
                                            <input
                                                type="datetime-local"
                                                value={endTime}
                                                onChange={(e) => setEndTime(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white font-black outline-none focus:border-[var(--bg-accent)]/50 focus:ring-2 focus:ring-[var(--bg-accent)]/15 transition-all text-xs"
                                            />
                                            <span className="text-[8px] text-white/20 font-black uppercase tracking-[0.2em] mt-2 block">Optional: Leave blank for perpetual access</span>
                                        </div>
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

            <StudentAssignDrawer
                isOpen={isAssignDrawerOpen}
                onClose={() => setIsAssignDrawerOpen(false)}
                initialGroups={assignedGroups}
                initialStudents={assignedStudents}
                onSave={({ assignedGroups: groups, assignedStudents: students }) => {
                    setAssignedGroups(groups);
                    setAssignedStudents(students);
                }}
            />
        </DashboardLayout>
    );
}
