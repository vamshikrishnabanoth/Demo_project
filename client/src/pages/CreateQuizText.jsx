/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { Type, Loader2, Plus, CheckCircle, Clock, Upload, ArrowLeft, Users, Clipboard, Code, Zap, BookOpen, AlertTriangle, Send, Save, Sparkles, Award, X, ShieldCheck } from 'lucide-react';
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
    const [gameType, setGameType] = useState('cyber_quest');
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
    const [lectureDepth, setLectureDepth] = useState(null);
    const [isVoice, setIsVoice] = useState(false);
    const [pipelineNotice, setPipelineNotice] = useState(null);
    const [isPartialYield, setIsPartialYield] = useState(false);
    const [requestedCount, setRequestedCount] = useState(null);
    const [representationMode, setRepresentationMode] = useState(null);

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
                    concept_tag: q.concept_tag || q.sub_topic || location.state?.title || 'Curriculum Concept',
                    points: q.points || 10
                };
            });

            setQuestions(normalized);
            setIsGeneratedSource(true);
            if (location.state.title)           setTitle(location.state.title);
            if (location.state.duration)        setDuration(location.state.duration);
            if (location.state.timerPerQuestion) setTimerPerQuestion(location.state.timerPerQuestion);
            if (location.state.isAssessment !== undefined) setIsAssessment(location.state.isAssessment);
            if (location.state.gameType)         setGameType(location.state.gameType);
            if (location.state.agentReport)     setAgentReport(location.state.agentReport);
            if (location.state.finalValidation) setFinalValidation(location.state.finalValidation);
            if (location.state.isVoice || location.state.isAudio || location.state.source === 'voice') {
                setIsVoice(true);
            }
            if (location.state.lectureDepth) {
                setLectureDepth(location.state.lectureDepth);
            }
            if (location.state.notice) {
                setPipelineNotice(location.state.notice);
            }
            if (location.state.isPartial) {
                setIsPartialYield(true);
            }
            if (location.state.requestedCount) {
                setRequestedCount(location.state.requestedCount);
            }
            if (location.state.representationMode) {
                setRepresentationMode(location.state.representationMode);
            }

            if (location.state.isTemplate || location.state.source === 'template') {
                toast.success('Template Loaded for Preview & Publishing');
            } else {
                toast.success('AI Intel Injected Successfully');
            }

            if (location.state.executionMessages && Array.isArray(location.state.executionMessages) && location.state.executionMessages.length > 0) {
                location.state.executionMessages.forEach(msg => {
                    toast(msg, {
                        icon: 'ℹ️',
                        duration: 8000,
                        style: {
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            padding: '16px',
                            color: '#fff',
                            background: '#0f172a',
                        }
                    });
                });
            }
        }
    }, [location.state]);

    useEffect(() => {
        if (isAssessment) {
            setTimerType('totalTime');
            if (!duration || duration === 0) setDuration(20);
        } else {
            setTimerType('manual');
            setDuration(0);
            setTimerPerQuestion(0);
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

    // ─── ACTUAL SUBMISSION (called from modal confirm) ────────────────────────
    const handleSubmit = async () => {
        setLoading(true);

        let finalStartTime = null;
        let finalEndTime   = null;

        if (isAssessment) {
            finalStartTime = startTime ? new Date(startTime).toISOString() : null;
            finalEndTime   = endTime ? new Date(endTime).toISOString() : null;

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
                title: title.trim(),
                questions,
                duration: isAssessment ? (parseInt(duration) || 20) : 0,
                timerPerQuestion: 0,
                timerType: isAssessment ? 'totalTime' : 'manual',
                accessType: accessType || 'private',
                startTime: finalStartTime || null,
                endTime: finalEndTime || null,
                isAssessment: Boolean(isAssessment),
                gameType: isAssessment ? gameType : 'standard',
                isLive: !isAssessment,
                assignedGroups: assignedGroups || [],
                assignedStudents: assignedStudents || [],
                autoBroadcast: autoBroadcast !== false,
            });
            toast.dismiss();
            if (!isAssessment) {
                toast.success('Mission Published & Data Encrypted (SHA-256)');
                navigate(`/live-room-teacher/${res.data.joinCode}`);
            } else {
                const gameNames = {
                    cyber_quest: 'Cyber Quest Arena',
                    sprint_arena: 'Sprint Arena',
                    match_up: 'Match-Up Arena',
                    standard: 'Standard Mode'
                };
                toast.success(`Assessment Deployed to Games Arena in ${gameNames[gameType] || 'Selected Game'} Mode!`);
                navigate('/assessments');
            }
        } catch (err) {
            const serverMsg = err.response?.data?.msg || err.response?.data?.message || err.response?.data?.error;
            toast.error(serverMsg || 'Network Link Failure');
        } finally {
            setLoading(false);
        }
    };

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

    const handleSaveQuizTemplate = async () => {
        if (!title || !title.trim()) {
            toast.error('Please enter a quiz title before saving to Saved Quizzes repository.');
            return;
        }
        if (!questions || questions.length === 0 || !questions[0].questionText.trim()) {
            toast.error('Please add at least one valid question before saving quiz.');
            return;
        }
        setLoading(true);
        const toastId = toast.loading('Saving quiz to Saved Quizzes repository...');
        try {
            const res = await api.post('/quiz/save-template', {
                title: title.trim(),
                questions,
                difficulty: 'Medium',
                timerPerQuestion: parseInt(timerPerQuestion) || 30,
                assignedGroups
            });
            toast.success(res.data.msg || 'Quiz template saved successfully!', { id: toastId });
            navigate('/my-quizzes');
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Failed to save quiz template.', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-[100rem] mx-auto px-6 py-8">
                
                {/* Header System */}
                <div className="relative flex items-center justify-between mb-6 min-h-[3rem]">
                    <div className="z-10">
                        <PremiumButton variant="ghost" icon={ArrowLeft} onClick={() => navigate(-1)}>
                            Back
                        </PremiumButton>
                    </div>
                    <div className="flex-1 flex justify-center items-center">
                        <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter drop-shadow-[0_0_20px_var(--bg-accent-glow)] m-0">
                            <span className="text-[var(--text-accent)]">{uiTerminology.creationMethods.text.toUpperCase()}</span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-3 z-10">
                        {(aikenLoaded || isGeneratedSource) && (
                            <button
                                type="button"
                                onClick={handleSaveQuizTemplate}
                                disabled={loading}
                                className="px-7 py-3 rounded-full bg-[#e55b00] hover:bg-[#d45200] active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2.5 cursor-pointer transition-all border-b-4 border-[#b34700] shrink-0 animate-in fade-in duration-200"
                            >
                                <Save size={17} className="stroke-[2.5]" />
                                <span>Save Quiz Template</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* PDI Representation Path Verification Banner */}
                {isGeneratedSource && representationMode && (
                    <div className="mb-6 bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-4 backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="flex items-center gap-3.5">
                            <div className="px-3 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                                PDI PATH: {representationMode}
                            </div>
                            <p className="text-xs text-slate-300 font-medium leading-relaxed">
                                {representationMode === 'UNIFIED' && 'Multimodal Dual-Source Synthesis: Spoken Teacher Authority (WHY) + Slide/Document Artifacts (WHAT).'}
                                {representationMode === 'SUMMARY' && 'Voice Narrative Path: Synthesized directly from live lecture spoken exposition & instructor emphasis.'}
                                {representationMode === 'BLUEPRINT' && 'Document / Code Blueprint Path: Structured syllabus & programmatic artifact schema.'}
                            </p>
                        </div>
                        <span className="text-[10px] font-mono text-indigo-300/70 uppercase tracking-widest hidden sm:inline-block px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
                            Architecture E Verified
                        </span>
                    </div>
                )}

                {/* Evidence Grounding & Partial Yield Notice Banner */}
                {pipelineNotice && (
                    <div className="mb-6 bg-gradient-to-r from-blue-950/80 via-slate-900/90 to-indigo-950/80 border border-blue-500/30 rounded-2xl p-4 shadow-lg flex items-start justify-between gap-4 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-start gap-3.5">
                            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30 shrink-0 mt-0.5">
                                <ShieldCheck size={20} className="stroke-[2.5]" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-blue-300">
                                        Evidence-Grounded Yield
                                    </h4>
                                    {requestedCount && (
                                        <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 text-[10px] font-bold">
                                            {questions.length} Delivered of {requestedCount} Requested
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                    {requestedCount && questions.length < requestedCount
                                        ? `${questions.length} of ${requestedCount} requested questions were generated. The remaining ${requestedCount - questions.length === 1 ? 'question' : 'questions'} could not be validated against the available instructional evidence. Add more lecture content or supporting material to enable additional questions.`
                                        : pipelineNotice}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setPipelineNotice(null)}
                            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                            title="Dismiss Notice"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Tab Interface - Centered */}
                {!isGeneratedSource && (
                    <div className="flex justify-center mb-6">
                        <div className="flex flex-wrap items-center justify-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 w-full max-w-4xl shadow-sm">
                            <button
                                onClick={() => setActiveTab('manual')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex-1 min-w-[140px]
                                    ${activeTab === 'manual' ? 'bg-[var(--bg-accent)] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                            >
                                <Type size={16} /> Manual Matrix
                            </button>
                            <>
                                <button
                                    onClick={() => setActiveTab('aiken')}
                                    className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex-1 min-w-[140px]
                                        ${activeTab === 'aiken' ? 'bg-[var(--bg-accent)] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                                >
                                    <Upload size={16} /> AIKEN Uplink
                                </button>
                                <button
                                    onClick={() => setActiveTab('aikenPaste')}
                                    className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex-1 min-w-[140px]
                                        ${activeTab === 'aikenPaste' ? 'bg-[var(--bg-accent)] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                                >
                                    <Clipboard size={16} /> AIKEN Paste
                                </button>
                                <button
                                    onClick={() => setActiveTab('jsonPaste')}
                                    className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex-1 min-w-[140px]
                                        ${activeTab === 'jsonPaste' ? 'bg-[var(--bg-accent)] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
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
                            <form onSubmit={handleSubmit} className="space-y-6">
                                
                                {/* Unified Config Row — 3 Equal Columns */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    {/* Column 1: Campaign Title */}
                                    <GlassCard className="flex flex-col justify-center p-4">
                                        <PremiumInput
                                            label="Campaign Title"
                                            placeholder="Enter quiz title..."
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            className="text-xl py-2 px-3"
                                        />
                                    </GlassCard>

                                    {/* Column 2: Quiz Creation Mode (Live Quiz vs Assignment) */}
                                    <GlassCard className="flex flex-col justify-center p-4">
                                        <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-2">Quiz Creation Mode</label>
                                        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsAssessment(false);
                                                    setDuration(0);
                                                    setTimerPerQuestion(0);
                                                }}
                                                className={`py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${!isAssessment ? 'bg-[var(--bg-accent)] text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
                                            >
                                                <span>⚡ Live Quiz</span>
                                                <span className="text-[8px] font-medium opacity-80">No Timer</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsAssessment(true);
                                                    if (!duration || duration === 0) setDuration(20);
                                                }}
                                                className={`py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${isAssessment ? 'bg-violet-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
                                            >
                                                <span>📋 Assignment</span>
                                                <span className="text-[8px] font-medium opacity-80">Fixed Duration</span>
                                            </button>
                                        </div>
                                    </GlassCard>

                                    {/* Column 3: Timer & Duration Controls */}
                                    <GlassCard className="flex flex-col justify-center gap-2 p-4">
                                        {!isAssessment ? (
                                            <div className="space-y-1.5 text-center flex flex-col items-center justify-center h-full">
                                                <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Live Quiz Timer</label>
                                                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 px-4 py-2 rounded-xl text-xs font-black italic uppercase tracking-wider flex items-center justify-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                                                    No Timer (Manual Navigation)
                                                </div>
                                                <span className="text-[9px] text-slate-400 font-semibold">Teacher advances questions manually</span>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Assignment Duration</label>
                                                    <span className="text-xs font-black text-violet-700 italic">{duration || 20} Mins</span>
                                                </div>
                                                
                                                {/* Preset Duration Buttons */}
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    {[15, 20, 30].map(mins => (
                                                        <button
                                                            key={mins}
                                                            type="button"
                                                            onClick={() => setDuration(mins)}
                                                            className={`py-1.5 rounded-lg text-xs font-black italic transition-all cursor-pointer ${parseInt(duration) === mins ? 'bg-violet-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                                        >
                                                            {mins} Mins
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="pt-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider shrink-0">Custom:</span>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="300"
                                                            value={duration}
                                                            onChange={(e) => { const v = parseInt(e.target.value); setDuration(isNaN(v) ? '' : v); }}
                                                            placeholder="Minutes"
                                                            className="w-full bg-white border border-[var(--border-color)] rounded-xl py-1 px-2.5 text-[var(--text-primary)] font-black italic outline-none focus:border-violet-600 transition-all text-xs"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </GlassCard>
                                </div>

                                {/* Assessment-Only: Games Arena Mode Selection */}
                                {isAssessment && (
                                    <GlassCard className="p-5 border-2 border-violet-500/30 bg-violet-500/5">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <h4 className="text-xs font-black text-violet-900 uppercase tracking-wider flex items-center gap-2">
                                                    <span>🎮 Games Arena Mode Selection</span>
                                                </h4>
                                                <p className="text-[10px] text-slate-500 font-semibold">Select how students will experience and attempt this quiz in the Games Arena</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setGameType('cyber_quest')}
                                                className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${gameType === 'cyber_quest' ? 'border-amber-500 bg-amber-500/10 text-slate-900 shadow-md ring-2 ring-amber-500/30' : 'border-slate-200 bg-white hover:border-amber-400 text-slate-700'}`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xl">🏆</span>
                                                    {gameType === 'cyber_quest' && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white">Selected</span>}
                                                </div>
                                                <div>
                                                    <h5 className="text-xs font-black uppercase tracking-wide text-amber-900">Cyber Quest</h5>
                                                    <p className="text-[9px] font-medium text-slate-600 mt-0.5">10-level survival ladder with emergency lifelines & streak multipliers</p>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setGameType('sprint_arena')}
                                                className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${gameType === 'sprint_arena' ? 'border-cyan-500 bg-cyan-500/10 text-slate-900 shadow-md ring-2 ring-cyan-500/30' : 'border-slate-200 bg-white hover:border-cyan-400 text-slate-700'}`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xl">⚡</span>
                                                    {gameType === 'sprint_arena' && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500 text-white">Selected</span>}
                                                </div>
                                                <div>
                                                    <h5 className="text-xs font-black uppercase tracking-wide text-cyan-900">Sprint Arena</h5>
                                                    <p className="text-[9px] font-medium text-slate-600 mt-0.5">Rapid-fire speed run against a 45s countdown timer</p>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setGameType('match_up')}
                                                className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${gameType === 'match_up' ? 'border-emerald-500 bg-emerald-500/10 text-slate-900 shadow-md ring-2 ring-emerald-500/30' : 'border-slate-200 bg-white hover:border-emerald-400 text-slate-700'}`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xl">🧩</span>
                                                    {gameType === 'match_up' && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white">Selected</span>}
                                                </div>
                                                <div>
                                                    <h5 className="text-xs font-black uppercase tracking-wide text-emerald-900">Match-Up Arena</h5>
                                                    <p className="text-[9px] font-medium text-slate-600 mt-0.5">Memory card matching grid connecting questions with answers</p>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setGameType('standard')}
                                                className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${gameType === 'standard' ? 'border-indigo-500 bg-indigo-500/10 text-slate-900 shadow-md ring-2 ring-indigo-500/30' : 'border-slate-200 bg-white hover:border-indigo-400 text-slate-700'}`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xl">📝</span>
                                                    {gameType === 'standard' && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500 text-white">Selected</span>}
                                                </div>
                                                <div>
                                                    <h5 className="text-xs font-black uppercase tracking-wide text-indigo-900">Standard Mode</h5>
                                                    <p className="text-[9px] font-medium text-slate-600 mt-0.5">Classic step-by-step tactical assessment interface</p>
                                                </div>
                                            </button>
                                        </div>
                                    </GlassCard>
                                )}

                                {/* Assessment-Only: Schedule & Expiration Row */}
                                {isAssessment && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <GlassCard className="flex flex-col justify-center gap-2 p-4">
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Scheduled Start</label>
                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                        <div className="relative w-8 h-4">
                                                            <input type="checkbox" className="sr-only peer" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} />
                                                            <div className="w-8 h-4 bg-slate-300 peer-checked:bg-[var(--bg-accent)] rounded-full transition-all ring-1 ring-slate-400"></div>
                                                            <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-all peer-checked:translate-x-4 shadow-sm"></div>
                                                        </div>
                                                        <span className="text-[10px] font-black text-[var(--text-accent)] uppercase tracking-wider">Start Now</span>
                                                    </label>
                                                </div>
                                                
                                                {!startNow ? (
                                                    <input
                                                        type="datetime-local"
                                                        value={startTime}
                                                        onChange={(e) => setStartTime(e.target.value)}
                                                        className="w-full bg-white border border-[var(--border-color)] rounded-xl py-2 px-3 text-[var(--text-primary)] font-black outline-none focus:border-[var(--bg-accent)] transition-all text-xs shadow-sm"
                                                    />
                                                ) : (
                                                    <div className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-xl py-2 px-3 flex items-center justify-center">
                                                        <span className="text-xs font-black text-emerald-600 italic uppercase tracking-wider">Active Immediately</span>
                                                    </div>
                                                )}
                                                
                                                <span className="text-[9px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em] mt-1 block">
                                                    {startNow ? 'Opens immediately for students' : 'Optional: Leave blank for instant access'}
                                                </span>
                                            </div>
                                        </GlassCard>

                                        <GlassCard className="flex flex-col justify-center gap-2 p-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2">Expiration End</label>
                                                <input
                                                    type="datetime-local"
                                                    value={endTime}
                                                    onChange={(e) => setEndTime(e.target.value)}
                                                    className="w-full bg-white border border-[var(--border-color)] rounded-xl py-2 px-3 text-[var(--text-primary)] font-black outline-none focus:border-[var(--bg-accent)] transition-all text-xs shadow-sm"
                                                />
                                                <span className="text-[9px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em] mt-1 block">Optional: Leave blank for perpetual access</span>
                                            </div>
                                        </GlassCard>
                                    </div>
                                )}



                                {/* ── Agent Quality Badge (AI-generated quizzes only) ── */}
                                {isGeneratedSource && agentReport && (
                                    <AgentQualityBadge
                                        agentReport={agentReport}
                                        onRegenerateQuestion={handleRegenerateQuestion}
                                    />
                                )}

                                {/* ── Teaching Depth (Voice Quizzes Only) ── */}
                                {isVoice && lectureDepth && lectureDepth.rating !== 'Non-Academic' && (
                                    <div className="p-5 bg-purple-50/80 border-2 border-purple-200 rounded-3xl space-y-3 shadow-xs animate-in fade-in duration-200">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-purple-900 uppercase tracking-widest flex items-center gap-2">
                                                <Sparkles size={16} className="text-purple-600" />
                                                Teaching Depth: <span className="font-bold text-purple-700">{lectureDepth.rating}</span>
                                            </span>
                                            <span className="text-xs font-mono font-black text-purple-700 bg-purple-100 px-3 py-1 rounded-full border border-purple-300">
                                                Score: {lectureDepth.score}/100
                                            </span>
                                        </div>

                                        {lectureDepth.characteristics && (
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[10px] font-bold text-slate-600">
                                                <div className="bg-white/90 p-2 rounded-xl border border-purple-100">
                                                    Concepts: <span className="font-black text-purple-800">{lectureDepth.characteristics.conceptExplanation || 'Developing'}</span>
                                                </div>
                                                <div className="bg-white/90 p-2 rounded-xl border border-purple-100">
                                                    Reasoning: <span className="font-black text-purple-800">{lectureDepth.characteristics.reasoning || 'Present'}</span>
                                                </div>
                                                <div className="bg-white/90 p-2 rounded-xl border border-purple-100">
                                                    Examples: <span className="font-black text-purple-800">{lectureDepth.characteristics.examples || 'Light'}</span>
                                                </div>
                                                <div className="bg-white/90 p-2 rounded-xl border border-purple-100">
                                                    Procedures: <span className="font-black text-purple-800">{lectureDepth.characteristics.procedures || 'Light'}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
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
                                        className="w-full flex items-center justify-center gap-4 p-6 rounded-[2rem] border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--bg-accent)] hover:bg-slate-50 transition-all group shadow-sm"
                                    >
                                        <Plus size={24} className="text-[var(--text-accent)] group-hover:scale-125 transition-transform" />
                                        <span className="font-black text-lg uppercase tracking-widest italic">Add New Data Point</span>
                                    </button>
                                </div>

                                {/* Final Execution */}
                                <div className="flex justify-center pt-8 border-t border-slate-200">
                                    <button
                                        type="button"
                                        onClick={handleFinalizeClick}
                                        disabled={loading}
                                        className={`button-fly button-fly-reversed ${loading ? 'is-loading' : ''} disabled:opacity-80 disabled:cursor-not-allowed`}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="animate-spin" size={18} />
                                                <span>PUBLISHING...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>PUBLISH</span>
                                                <div className="svg-wrapper">
                                                    <Send size={18} />
                                                </div>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>


        </DashboardLayout>
    );
}
