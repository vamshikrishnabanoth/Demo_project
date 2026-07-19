/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { Type, Loader2, Plus, CheckCircle, Clock, Upload, ArrowLeft, Users, Clipboard, Code, Zap, BookOpen, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import StudentAssignDrawer from '../components/quiz/StudentAssignDrawer';
import toast from 'react-hot-toast';

// Modular Architecture Imports
import { PremiumButton, PremiumInput, GlassCard } from '../components/ui/Primitives';
import AikenUploadPanel from '../components/quiz/AikenUploadPanel';
import AikenPastePanel from '../components/quiz/AikenPastePanel';
import JsonPastePanel from '../components/quiz/JsonPastePanel';
import QuizQuestionEditor from '../components/quiz/QuizQuestionEditor';
import AgentQualityBadge from '../components/quiz/AgentQualityBadge';
import { uiTerminology } from '../utils/uiTerminology';

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
    const [autoBroadcast, setAutoBroadcast] = useState(true);
    const [questions, setQuestions] = useState([{ questionText: '', options: ['', ''], correctAnswer: '', points: 10 }]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('manual');
    const [aikenLoaded, setAikenLoaded] = useState(false);
    const [isGeneratedSource, setIsGeneratedSource] = useState(false);
    const [agentReport, setAgentReport] = useState(null);
    const [assignedGroups, setAssignedGroups] = useState([]);
    const [assignedStudents, setAssignedStudents] = useState([]);
    const [isAssignDrawerOpen, setIsAssignDrawerOpen] = useState(false);
    const [regeneratingIdx, setRegeneratingIdx] = useState(null);
    const [finalValidation, setFinalValidation] = useState(null);


    // ─── INITIALIZATION ─────────────────────────────────────────────────────
    useEffect(() => {
        // Support both key names: 'questions' (from AI generator) and 'generatedQuestions' (legacy)
        const incoming = location.state?.questions || location.state?.generatedQuestions;
        if (incoming && Array.isArray(incoming)) {
            const normalized = incoming.map((q) => {
                let opts = q.options;
                if (!Array.isArray(opts)) {
                    if (opts && typeof opts === 'object') {
                        // If it's a dict { A, B, C, D }, extract the values in ordered list format
                        const keys = Object.keys(opts).sort();
                        opts = keys.map(k => opts[k]);
                    } else {
                        opts = ['', '', '', ''];
                    }
                }
                while (opts.length < 4) {
                    opts.push(`Option ${opts.length + 1}`);
                }
                const cleanOpts = opts.slice(0, 4).map(String);
                
                // Map correctAnswer values to exact match in options list
                let correctVal = q.correctAnswer || q.correct_answer || q.correct_ans || '';
                if (correctVal === 'A' || correctVal === 'B' || correctVal === 'C' || correctVal === 'D') {
                    const idx = correctVal.charCodeAt(0) - 65;
                    correctVal = cleanOpts[idx] || '';
                }

                return {
                    ...q,
                    questionText: q.questionText || q.prompt_text || q.question || '',
                    options: cleanOpts,
                    correctAnswer: correctVal,
                    concept_tag: q.concept_tag || q.sub_topic || '',
                    points: q.points || 10
                };
            });

            setQuestions(normalized);
            setIsGeneratedSource(true);
            if (location.state.title)           setTitle(location.state.title);
            if (location.state.duration)        setDuration(location.state.duration);
            if (location.state.agentReport)     setAgentReport(location.state.agentReport);
            if (location.state.finalValidation) setFinalValidation(location.state.finalValidation);
            toast.success('AI Intel Injected Successfully');
        }
    }, [location.state]);

    useEffect(() => {
        if (isAssessment) {
            setTimerType('timePerQuestion');
        } else {
            setTimerType('totalTime');
        }
    }, [isAssessment]);

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

    // ─── INDIVIDUAL QUESTION REGENERATION ───────────────────────────────────
    const handleRegenerateQuestion = useCallback(async (idx) => {
        setRegeneratingIdx(idx);
        try {
            // Use the stored title/topic as context for regeneration
            const payload = {
                topic:         location.state?.title || title || 'General Knowledge',
                type:          'topic',
                questionCount: 1,
                difficulty:    'Medium',
            };
            const res = await api.post('/quiz/generate', payload, { timeout: 300000 });
            const [newQ] = res.data.questions || [];
            if (newQ) {
                const updated = [...questions];
                updated[idx] = newQ;
                setQuestions(updated);
                // Patch the agentReport perQuestion entry to mark as regenerated
                if (agentReport?.perQuestion?.[idx]) {
                    const updatedReport = {
                        ...agentReport,
                        perQuestion: agentReport.perQuestion.map((pq, i) =>
                            i === idx ? { ...pq, verdict: 'good', issues: ['Manually regenerated'], retries: 0 } : pq
                        ),
                    };
                    setAgentReport(updatedReport);
                }
                toast.success(`Question ${idx + 1} regenerated`);
            } else {
                toast.error('Could not regenerate — try editing manually');
            }
        } catch (err) {
            toast.error('Regeneration failed — try editing manually');
        } finally {
            setRegeneratingIdx(null);
        }
    }, [questions, agentReport, title, location.state]);

    // ─── FINALIZE (directly publishes) ─────────────────────────────────────────
    const handleFinalizeClick = (e) => {
        e.preventDefault();
        // Validation Layer first
        if (!title.trim()) return toast.error('Enter a command title');
        const invalidIdx = questions.findIndex(q => !q.questionText.trim() || !q.correctAnswer || q.options.some(o => !o.trim()));
        if (invalidIdx !== -1) return toast.error(`Question ${invalidIdx + 1} is incomplete`);
        // Directly publish — no confirmation modal
        handleSubmit();
    };

    // ─── ACTUAL SUBMISSION (called from modal confirm) ────────────────────────
    const handleSubmit = async () => {
        setLoading(true);

        let finalStartTime = null;
        let finalEndTime   = null;

        if (isAssessment) {
            finalStartTime = startTime;
            finalEndTime   = endTime;

            if (startNow) {
                finalStartTime = new Date().toISOString();
                if (!finalEndTime) {
                    if (timerType === 'timePerQuestion' && timerPerQuestion) {
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
                    return toast.error('End time must be after start time');
                }
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
                startTime:  finalStartTime,
                endTime:    finalEndTime || null,
                isAssessment,
                isLive:     !isAssessment,
                assignedGroups,
                assignedStudents,
                autoBroadcast,
            });
            toast.dismiss();
            toast.success('Mission Published & Data Encrypted (SHA-256)');
            if (!isAssessment) {
                navigate(`/live-room-teacher/${res.data.joinCode}`);
            } else {
                navigate('/teacher-dashboard');
            }
        } catch (err) {
            const serverMsg = err.response?.data?.msg || err.response?.data?.message || err.response?.data?.error;
            toast.error(serverMsg || 'Network Link Failure');
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-[100rem] mx-auto px-6 py-8">
                
                {/* Header System */}
                <div className="flex items-center justify-between mb-8">
                    <div className="space-y-3">
                        <PremiumButton variant="ghost" icon={ArrowLeft} onClick={() => navigate(-1)}>
                            Back
                        </PremiumButton>
                        <h1 className="text-hero-fluid font-black text-white italic uppercase tracking-tighter drop-shadow-[0_0_20px_var(--bg-accent-glow)]">
                            <span className="text-[var(--text-accent)]">{uiTerminology.creationMethods.text.toUpperCase()}</span>
                        </h1>
                    </div>
                </div>

                {/* Tab Interface - Centered */}
                {!isGeneratedSource && (
                    <div className="flex justify-center mb-10">
                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-2 w-fit">
                            <button
                                onClick={() => setActiveTab('manual')}
                                className={`flex items-center gap-2 px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all
                                    ${activeTab === 'manual' ? 'bg-[var(--bg-accent)] text-white shadow-xl' : 'text-white/30 hover:text-white'}`}
                            >
                                <Type size={16} /> Manual Matrix
                            </button>
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
                        </div>
                    </div>
                )}

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
                            <form onSubmit={handleSubmit} className="space-y-8">
                                
                                {/* Unified Config Row — 3 Equal Columns */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Column 1: Campaign Title */}
                                    <GlassCard className="flex flex-col justify-center">
                                        <PremiumInput
                                            label="Campaign Title"
                                            placeholder="Enter quiz title..."
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            className="text-3xl"
                                        />
                                    </GlassCard>

                                    {/* Column 2: Assignment Mode Toggle */}
                                    <GlassCard className="flex flex-col justify-center gap-3">
                                        <div className="flex items-center justify-between cursor-pointer group select-none" onClick={() => setIsAssessment(!isAssessment)}>
                                            <div className="space-y-1">
                                                <span className="block font-black text-[9px] text-white/30 uppercase tracking-[0.2em]">Assignment Mode</span>
                                                <span className="block font-black text-xs text-white uppercase tracking-tight italic">Assignment Mode</span>
                                                <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider block">
                                                    {isAssessment ? 'Self-paced homework task' : 'Manual Time, Team Link Rooms'}
                                                </span>
                                            </div>
                                            <div className="relative w-12 h-6 flex-shrink-0">
                                                <input 
                                                    type="checkbox" 
                                                    className="sr-only peer" 
                                                    checked={isAssessment} 
                                                    onChange={(e) => setIsAssessment(e.target.checked)} 
                                                />
                                                <div className="w-12 h-6 bg-white/10 peer-checked:bg-[var(--bg-accent)] rounded-full transition-all ring-1 ring-white/10"></div>
                                                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-6"></div>
                                            </div>
                                        </div>
                                    </GlassCard>

                                    {/* Column 3: Timer Mode */}
                                    <GlassCard className="flex flex-col justify-center gap-4">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Timer Mode</label>
                                                <div className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white font-black italic text-sm uppercase tracking-tighter">
                                                    {isAssessment ? 'Time Per Question' : 'Total Quiz Time'}
                                                </div>
                                            </div>
                                            {isAssessment ? (
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
                                </div>

                                {/* Assessment-Only: Schedule & Expiration Row */}
                                {isAssessment && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                                    {startNow ? 'Opens immediately for students' : 'Optional: Leave blank for instant access'}
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
                                )}

                                {/* ── Final Validation Warning (from backend validator) ── */}
                                {isGeneratedSource && finalValidation && !finalValidation.passed && (
                                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle size={16} className="text-amber-400" />
                                            <p className="text-sm font-black text-amber-400 uppercase tracking-wider">Review Required Before Publish</p>
                                        </div>
                                        <p className="text-xs text-white/50 font-bold uppercase tracking-wider">The final validator found issues. You may still publish — these are recommendations.</p>
                                        <ul className="space-y-1">
                                            {finalValidation.issues.map((issue, i) => (
                                                <li key={i} className="text-xs text-amber-300/70 font-bold flex items-start gap-2">
                                                    <span className="flex-shrink-0 mt-0.5">⚠</span>
                                                    <span>{issue}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* ── Agent Quality Badge (AI-generated quizzes only) ── */}
                                {isGeneratedSource && agentReport && (
                                    <AgentQualityBadge
                                        agentReport={agentReport}
                                        onRegenerateQuestion={handleRegenerateQuestion}
                                    />
                                )}

                                {/* Questions Matrix */}
                                <div className="space-y-10">
                                    {questions.map((q, idx) => (
                                        <div key={idx} className="relative">
                                            {/* Regenerating overlay */}
                                            {regeneratingIdx === idx && (
                                                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[2.5rem] bg-[var(--bg-primary)]/80 backdrop-blur-sm border border-[var(--bg-accent)]/30">
                                                    <div className="flex items-center gap-3 text-[var(--bg-accent)]">
                                                        <Loader2 size={20} className="animate-spin" />
                                                        <span className="font-black text-sm uppercase tracking-widest">Regenerating Q{idx + 1}…</span>
                                                    </div>
                                                </div>
                                            )}
                                            <QuizQuestionEditor
                                                index={idx}
                                                question={q}
                                                onUpdate={updateQuestion}
                                                onDelete={deleteQuestion}
                                                onAddOption={addOption}
                                                onDeleteOption={deleteOption}
                                                onUpdateOption={updateOption}
                                            />
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={addQuestion}
                                        className="w-full flex items-center justify-center gap-4 p-10 rounded-[3rem] border-4 border-dashed border-white/5 text-white/20 hover:border-[var(--bg-accent)]/50 hover:text-[var(--text-accent)] transition-all group bg-white/[0.01]"
                                    >
                                        <Plus size={28} className="group-hover:scale-125 transition-transform" />
                                        <span className="font-black text-xl uppercase tracking-widest italic">Add New Data Point</span>
                                    </button>
                                </div>

                                {/* Final Execution */}
                                <div className="flex justify-center pt-12 border-t border-white/5">
                                    <PremiumButton
                                        type="button"
                                        onClick={handleFinalizeClick}
                                        disabled={loading}
                                        className="px-20 py-8 text-2xl italic"
                                        icon={loading ? Loader2 : CheckCircle}
                                    >
                                        {loading ? 'PUBLISHING...' : 'FINALIZE QUIZZ'}
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
