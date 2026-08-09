import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { 
    Hash, Sparkles, Loader2, Database, 
    FileText, FileCode, Plus, Trash2, Mic, X, Award,
    PlayCircle, PauseCircle, StopCircle, WifiOff, RefreshCw
} from 'lucide-react';
import AgentPipelineLoader from '../components/loaders/AgentPipelineLoader';
import toast from 'react-hot-toast';
import { 
    createSessionRecord, 
    saveAudioChunk, 
    reconstructSessionBlob, 
    getPendingSessions, 
    markSessionCompleted, 
    deleteSessionRecord 
} from '../utils/audioDB';
import { createTimerWorker } from '../utils/timerWorker';

export default function CreateQuizTopic() {
    // ── 3 Inputs Only ──────────────────────────────────────────────────────────
    // 1. Source Content (Ingested files, recordings, or text prompts)
    const [inputs, setInputs] = useState(() => {
        try {
            const saved = localStorage.getItem('quiz_docket_inputs');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.error('Failed to load docket inputs:', e);
        }
        return [];
    });

    useEffect(() => {
        try {
            const serializable = inputs.map(inp => {
                const { file, ...rest } = inp;
                return rest;
            });
            localStorage.setItem('quiz_docket_inputs', JSON.stringify(serializable));
        } catch (e) {
            console.error('Failed to save docket inputs:', e);
        }
    }, [inputs]);

    // 2. Difficulty Focus ("Balanced", "Easy", "Medium", "Hard")
    const [difficulty, setDifficulty] = useState('Balanced');

    // 3. Question Count (Integer, default 10, range 1-30)
    const [questionCount, setQuestionCount] = useState(10);

    // Dynamic Lecture Depth Rating
    const [lectureDepth, setLectureDepth] = useState(null);

    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    // Voice recording states & offline/crash resilience
    const [recording, setRecording] = useState(false);
    const [recordingPaused, setRecordingPaused] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const audioChunksRef = useRef([]);
    const isCancelledRef = useRef(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [transcribing, setTranscribing] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [pendingRecoverySessions, setPendingRecoverySessions] = useState([]);

    const currentSessionIdRef = useRef(null);
    const chunkIndexRef = useRef(0);
    const timerWorkerRef = useRef(null);

    const fileInputRef = useRef(null);

    // Dropdown & Modal states
    const [showDropdown, setShowDropdown] = useState(false);
    const [showTextModal, setShowTextModal] = useState(false);
    const [textModalType, setTextModalType] = useState('context');
    const [textInputContent, setTextInputContent] = useState('');

    // Polling states
    const [polling, setPolling] = useState(false);
    const [stage, setStage] = useState(0);
    const [stageLabel, setStageLabel] = useState('Generating Questions');
    const [elapsed, setElapsed] = useState(0);
    const [pollError, setPollError] = useState(null);
    const pollIntervalRef = useRef(null);
    const startTimeRef = useRef(null);
    const elapsedRef = useRef(null);

    const isGenerating = submitting || polling;

    const formatTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return [
            h > 0 ? h : null,
            h > 0 ? String(m).padStart(2, '0') : m,
            String(s).padStart(2, '0')
        ].filter(x => x !== null).join(':');
    };

    // Listen for Online / Offline events
    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            toast.success('🌐 Connection restored. Ready to sync voice recordings.');
        };
        const handleOffline = () => {
            setIsOffline(true);
            toast('⚠️ Network offline. Recording saved locally to IndexedDB.', { icon: '💾' });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Check for crash recovery sessions on mount
    useEffect(() => {
        async function checkRecovery() {
            const sessions = await getPendingSessions();
            if (sessions && sessions.length > 0) {
                setPendingRecoverySessions(sessions);
            }
        }
        checkRecovery();
    }, []);

    // Calculate lecture depth whenever text content in docket changes
    useEffect(() => {
        const combinedText = inputs
            .map(inp => inp.content || '')
            .join(' ');
        
        if (combinedText.length > 20) {
            const words = combinedText.trim().split(/\s+/).length;
            let score = Math.min(100, Math.max(15, Math.floor(words / 15) + (combinedText.includes('```') ? 25 : 0)));
            let band = 'Low';
            if (score >= 86) band = 'Very High';
            else if (score >= 61) band = 'High';
            else if (score >= 31) band = 'Moderate';
            setLectureDepth({ score, band });
        } else {
            setLectureDepth(null);
        }
    }, [inputs]);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (elapsedRef.current) clearInterval(elapsedRef.current);
        setPolling(false);
    }, []);

    const startPolling = useCallback((taskId, { onComplete, onError } = {}) => {
        setPolling(true);
        setStage(0);
        setStageLabel('Generating Questions');
        setElapsed(0);
        setPollError(null);
        startTimeRef.current = Date.now();

        elapsedRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);

        const doPoll = async () => {
            try {
                const res = await api.get(`/quiz/generate/status/${taskId}`);
                const { status, stage: s, stageLabel: sl, result, error: e } = res.data;
                if (s !== undefined) setStage(s);
                if (sl) setStageLabel(sl);

                if (status === 'COMPLETED' && result) {
                    stopPolling();
                    if (onComplete) onComplete(result);
                } else if (status === 'FAILED' || status === 'EXPIRED') {
                    stopPolling();
                    const errMsg = e || 'Generation failed.';
                    setPollError(errMsg);
                    if (onError) onError(errMsg);
                }
            } catch (err) {
                console.warn('Polling error:', err);
            }
        };

        doPoll();
        pollIntervalRef.current = setInterval(doPoll, 1500);
    }, [stopPolling]);

    // Handle File Uploads
    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            const ext = file.name.split('.').pop().toLowerCase();
            const id = Math.random().toString();
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);

            const newInput = {
                id,
                type: ext,
                file,
                source_name: file.name,
                startPage: 1,
                endPage: undefined,
                maxPages: undefined,
                fetchingMetadata: !isImage
            };

            setInputs(prev => [...prev, newInput]);

            if (!isImage) {
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const res = await api.post('/quiz/file-metadata', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    if (res.data && res.data.totalCount) {
                        setInputs(prev => prev.map(item => item.id === id ? {
                            ...item,
                            maxPages: res.data.totalCount,
                            endPage: res.data.totalCount,
                            fetchingMetadata: false
                        } : item));
                    }
                } catch (err) {
                    console.error('Metadata fetch error:', err);
                    setInputs(prev => prev.map(item => item.id === id ? { ...item, fetchingMetadata: false } : item));
                }
            }
        }
        e.target.value = '';
    };

    const handleAddTextInput = () => {
        if (!textInputContent.trim()) return;
        const newInput = {
            id: Math.random().toString(),
            type: 'text',
            content: textInputContent,
            source_name: textModalType === 'description' ? 'Topic Description' : `Context Prompt (${textInputContent.slice(0, 20)}...)`
        };
        setInputs(prev => [...prev, newInput]);
        setTextInputContent('');
        setShowTextModal(false);
    };

    const handleRemoveInput = (id) => {
        if (isGenerating) return;
        setInputs(prev => prev.filter(item => item.id !== id));
    };

    // ── 4-Hour Memory-Safe & Crash-Proof Voice Recording Lifecycle ───────────────
    const startRecording = async () => {
        if (isGenerating) return;
        isCancelledRef.current = false;

        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        currentSessionIdRef.current = newSessionId;
        chunkIndexRef.current = 0;

        // Initialize recording session in IndexedDB
        await createSessionRecord(newSessionId, { title: 'Lecture Recording' });

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });

            let mimeType = 'audio/webm;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
            }

            const recorder = new MediaRecorder(stream, {
                mimeType,
                audioBitsPerSecond: 32000 // Speech-optimized low bitrate for 4-hour memory safety
            });

            audioChunksRef.current = [];

            // Memory-safe 10-second timeslice chunking directly saved to IndexedDB
            recorder.ondataavailable = async (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                    const cIndex = chunkIndexRef.current++;
                    await saveAudioChunk({
                        sessionId: newSessionId,
                        chunkIndex: cIndex,
                        blobData: e.data,
                        timestamp: Date.now()
                    });
                }
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());

                if (timerWorkerRef.current) {
                    timerWorkerRef.current.postMessage({ command: 'stop' });
                    timerWorkerRef.current.terminate();
                    timerWorkerRef.current = null;
                }

                // If user clicked Cancel, discard session & IndexedDB store
                if (isCancelledRef.current) {
                    console.log('🚫 Voice recording was cancelled by user. Discarding IndexedDB session.');
                    await deleteSessionRecord(newSessionId);
                    setRecording(false);
                    setRecordingPaused(false);
                    setRecordingDuration(0);
                    return;
                }

                // Reconstruct Blob from IndexedDB chunks for maximum reliability
                const audioBlob = await reconstructSessionBlob(newSessionId, mimeType);
                setRecording(false);
                setRecordingPaused(false);
                setRecordingDuration(0);

                if (!audioBlob || audioBlob.size < 1000) {
                    toast.error('Recording too short. Please speak for at least a few seconds.');
                    await deleteSessionRecord(newSessionId);
                    return;
                }

                // Offline handling
                if (!navigator.onLine) {
                    toast('Network offline. Recording safely saved locally in IndexedDB.', { icon: '💾' });
                    return;
                }

                setTranscribing(true);
                const toastId = toast.loading('Transcribing speech...');

                try {
                    const formData = new FormData();
                    formData.append('file', audioBlob, 'lecture_recording.webm');

                    let transcriptText = '';
                    try {
                        const localRes = await api.post('http://localhost:8000/transcribe', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                            timeout: 30000
                        });
                        transcriptText = localRes.data.text;
                    } catch (_) {
                        const transcribeRes = await api.post('/quiz/transcribe', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        transcriptText = transcribeRes.data.text;
                    }

                    if (transcriptText && transcriptText.trim().length > 5) {
                        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        toast.success('Speech transcribed successfully!', { id: toastId });
                        setInputs(prev => [...prev, {
                            id: Math.random().toString(),
                            type: 'voice',
                            content: transcriptText,
                            source_name: `Recording (${timeStr})`
                        }]);
                        await markSessionCompleted(newSessionId);
                        await deleteSessionRecord(newSessionId);
                    } else {
                        toast.error('Could not capture clear speech. Please try again.', { id: toastId });
                    }
                } catch (err) {
                    console.error('Transcription failed:', err);
                    toast.error('Failed to transcribe voice. Recording saved in IndexedDB.', { id: toastId });
                } finally {
                    setTranscribing(false);
                }
            };

            // Instantiate Web Worker for background-tab resilient timer
            const worker = createTimerWorker();
            timerWorkerRef.current = worker;
            worker.onmessage = (e) => {
                if (e.data.type === 'tick') {
                    setRecordingDuration(e.data.seconds);
                }
            };
            worker.postMessage({ command: 'start', seconds: 0 });

            // Start recorder with 10-second timeslice intervals
            recorder.start(10000);
            setMediaRecorder(recorder);
            setRecording(true);
            setRecordingPaused(false);
            setRecordingDuration(0);
        } catch (err) {
            console.error('Microphone error:', err);
            toast.error('Microphone access denied or unavailable.');
        }
    };

    const stopRecording = () => {
        isCancelledRef.current = false;
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    };

    const pauseRecording = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.pause();
            if (timerWorkerRef.current) timerWorkerRef.current.postMessage({ command: 'pause' });
            setRecordingPaused(true);
        }
    };

    const resumeRecording = () => {
        if (mediaRecorder && mediaRecorder.state === 'paused') {
            mediaRecorder.resume();
            if (timerWorkerRef.current) timerWorkerRef.current.postMessage({ command: 'resume' });
            setRecordingPaused(false);
        }
    };

    const cancelRecording = () => {
        isCancelledRef.current = true;
        if (timerWorkerRef.current) {
            timerWorkerRef.current.postMessage({ command: 'stop' });
            timerWorkerRef.current.terminate();
            timerWorkerRef.current = null;
        }
        if (mediaRecorder) {
            mediaRecorder.onstop = null;
            if (mediaRecorder.state !== 'inactive') {
                try { mediaRecorder.stop(); } catch (e) {}
            }
            if (mediaRecorder.stream) {
                mediaRecorder.stream.getTracks().forEach(t => t.stop());
            }
        }
        if (currentSessionIdRef.current) {
            deleteSessionRecord(currentSessionIdRef.current);
        }
        audioChunksRef.current = [];
        setRecording(false);
        setRecordingPaused(false);
        setRecordingDuration(0);
        toast('Recording cancelled', { icon: '🗑️' });
    };

    // Recover session from previous tab crashes
    const handleRecoverSession = async (sess) => {
        const toastId = toast.loading(`Recovering recording from ${new Date(sess.createdAt).toLocaleTimeString()}...`);
        try {
            const blob = await reconstructSessionBlob(sess.sessionId);
            if (!blob || blob.size < 1000) {
                toast.error('Recovered recording was empty or corrupt.', { id: toastId });
                await deleteSessionRecord(sess.sessionId);
                setPendingRecoverySessions(prev => prev.filter(s => s.sessionId !== sess.sessionId));
                return;
            }

            const formData = new FormData();
            formData.append('file', blob, 'recovered_recording.webm');

            let transcriptText = '';
            try {
                const localRes = await api.post('http://localhost:8000/transcribe', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 30000
                });
                transcriptText = localRes.data.text;
            } catch (_) {
                const transcribeRes = await api.post('/quiz/transcribe', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                transcriptText = transcribeRes.data.text;
            }

            if (transcriptText && transcriptText.trim().length > 5) {
                const timeStr = new Date(sess.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                toast.success('Recovered recording transcribed successfully!', { id: toastId });
                setInputs(prev => [...prev, {
                    id: Math.random().toString(),
                    type: 'voice',
                    content: transcriptText,
                    source_name: `Recovered Recording (${timeStr})`
                }]);
                await markSessionCompleted(sess.sessionId);
                await deleteSessionRecord(sess.sessionId);
                setPendingRecoverySessions(prev => prev.filter(s => s.sessionId !== sess.sessionId));
            } else {
                toast.error('Could not transcribe recovered audio.', { id: toastId });
            }
        } catch (err) {
            console.error('Session recovery failed:', err);
            toast.error('Failed to recover session.', { id: toastId });
        }
    };

    // Direct Generation Submission
    const handleGenerateQuiz = async () => {
        if (inputs.length === 0 || isGenerating) {
            if (inputs.length === 0) toast.error('Please add at least one source input (document, voice recording, or text).');
            return;
        }

        setSubmitting(true);

        const formData = new FormData();
        const fileInputs = inputs.filter(inp => inp.file);
        const textInputs = inputs.filter(inp => !inp.file);

        fileInputs.forEach(inp => {
            formData.append('files', inp.file);
        });

        const fileConfigs = fileInputs.map(inp => ({
            name: inp.source_name,
            startPage: inp.startPage || 1,
            endPage: inp.endPage || 999
        }));

        formData.append('file_configs', JSON.stringify(fileConfigs));
        formData.append('topic', inputs.map(i => i.source_name).join(', '));
        formData.append('questionCount', questionCount);
        formData.append('question_count', questionCount);
        formData.append('difficulty', difficulty);
        formData.append('text_prompts', JSON.stringify(textInputs.map(t => t.content)));

        try {
            const res = await api.post('/quiz/generate', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 180000 
            });

            const { taskId } = res.data;
            if (!taskId) throw new Error('No taskId returned from server');
            setSubmitting(false);

            startPolling(taskId, {
                onComplete: (result) => {
                    if (result.lectureDepth) {
                        setLectureDepth(result.lectureDepth);
                    }
                    navigate('/create-quiz/text', {
                        state: {
                            taskId: taskId,
                            questions: result.questions,
                            title: result.title || `Quiz: ${inputs[0]?.source_name}`,
                            duration: result.duration || 10,
                            source: 'generated',
                            agentReport: result.agentReport || null,
                            lectureDepth: result.lectureDepth || lectureDepth,
                            notice: result.notice || null
                        },
                    });
                },
                onError: (msg) => {
                    toast.error(msg || 'Generation failed. Please try again.');
                },
            });
        } catch (err) {
            console.error(err);
            toast.error('Failed to start generation. Please try again.');
            setSubmitting(false);
        }
    };

    return (
        <DashboardLayout role="teacher">
            {isGenerating && (
                <AgentPipelineLoader
                    stage={stage}
                    stageLabel={stageLabel}
                    elapsed={elapsed}
                    isVoice={false}
                />
            )}

            <div className="flex flex-col min-h-[calc(100vh-6.5rem)] w-full">
                
                {/* Header branding & Lecture Depth Badge */}
                <div className="p-6 pb-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight italic uppercase">
                            Kahoot <span className="text-[var(--text-accent)]">AI Studio</span>
                        </h1>
                        <p className="text-[var(--text-secondary)] mt-1 font-bold uppercase tracking-wider text-xs italic">
                            Ground-truth AI MCQ Generator with automated source verification.
                        </p>
                    </div>

                    {/* Lecture Depth Rating Badge */}
                    {lectureDepth && (
                        <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl px-5 py-3 flex items-center gap-4 shadow-sm">
                            <Award className="text-purple-600 shrink-0" size={24} />
                            <div>
                                <p className="text-[10px] font-black text-purple-900 uppercase tracking-widest">Lecture Depth Rating</p>
                                <p className="text-sm font-black text-purple-700">
                                    {lectureDepth.band} ({lectureDepth.score}/100)
                                </p>
                            </div>
                            <div className="w-20 bg-purple-200 h-2.5 rounded-full overflow-hidden shrink-0">
                                <div 
                                    className="bg-purple-600 h-full rounded-full transition-all duration-500" 
                                    style={{ width: `${lectureDepth.score}%` }} 
                                />
                            </div>
                        </div>
                    )}
                </div>

                {pollError && (
                    <div className="mx-6 mt-4 px-5 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 font-bold text-xs uppercase tracking-wider">
                        ⚠️ {pollError}
                    </div>
                )}

                {/* CRASH RECOVERY BANNER */}
                {pendingRecoverySessions.length > 0 && (
                    <div className="mx-4 lg:mx-6 mt-4 p-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                        <div className="flex items-center gap-3">
                            <RefreshCw className="text-amber-600 animate-spin" size={20} />
                            <div>
                                <p className="text-xs font-black text-amber-900 uppercase tracking-wider">
                                    Unsaved Recording Session Detected ({pendingRecoverySessions.length})
                                </p>
                                <p className="text-[10px] font-bold text-amber-700">
                                    Recover previous recording session saved in IndexedDB from a prior crash or tab closure.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {pendingRecoverySessions.map(sess => (
                                <button
                                    key={sess.sessionId}
                                    type="button"
                                    onClick={() => handleRecoverSession(sess)}
                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                                >
                                    Recover Session
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2-COLUMN ASYMMETRIC GRID WORKSPACE (60% / 40%) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 lg:p-6 w-full">
                    
                    {/* LEFT COLUMN: Input 1 - Source Content (60% Desktop Width -> lg:col-span-7) */}
                    <div className="lg:col-span-7 bg-[var(--bg-secondary)] backdrop-blur-md border border-[var(--border-color)] rounded-3xl p-5 lg:p-6 flex flex-col space-y-5 shadow-lg">
                        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
                            <div className="flex items-center gap-2.5">
                                <span className="px-2.5 py-1 bg-[var(--accent-sand)] text-[var(--text-accent)] border border-[var(--border-color)] rounded-lg text-[9px] font-black uppercase tracking-wider">Input 1</span>
                                <h2 className="text-base font-black text-[var(--text-primary)] uppercase italic tracking-wide">Source Content</h2>
                            </div>
                            <span className="bg-[var(--bg-primary)] text-[var(--text-primary)] px-3 py-1 rounded-full text-xs font-black uppercase border border-[var(--border-color)]">
                                {inputs.length} {inputs.length === 1 ? 'Source' : 'Sources'}
                            </span>
                        </div>

                        {/* 1. VOICE AUDIO RECORDING WIDGET (4-Hour Memory-Safe & Offline Resilient) */}
                        <div className={`bg-amber-500/5 border-2 border-amber-500/40 rounded-2xl p-6 text-center flex flex-col items-center justify-center space-y-4 shadow-sm transition-all ${isGenerating ? 'pointer-events-none opacity-60' : ''}`}>
                            <div className="flex items-center justify-between w-full border-b pb-2.5 border-amber-500/20">
                                <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-1.5">
                                    <Mic size={15} className="text-amber-600" /> Voice Audio Recording (4h Memory-Safe)
                                </span>
                                {isOffline ? (
                                    <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                                        <WifiOff size={12} /> Offline - Recording saved locally
                                    </span>
                                ) : recording ? (
                                    <span className="text-[10px] font-mono font-bold text-emerald-600 animate-pulse">
                                        {formatTime(recordingDuration)}
                                    </span>
                                ) : null}
                            </div>

                            {transcribing ? (
                                <div className="py-4 flex flex-col items-center gap-2">
                                    <Loader2 size={26} className="animate-spin text-purple-600" />
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Transcribing Speech...</p>
                                </div>
                            ) : recording ? (
                                <div className="flex flex-col items-center gap-3 py-1">
                                    <div className="flex items-center gap-2 font-mono font-bold text-xs text-amber-900 bg-amber-100/80 px-3 py-1 rounded-full border border-amber-300">
                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                                        <span>{recordingPaused ? 'RECORDING PAUSED' : 'RECORDING LECTURE'}</span>
                                        <span className="font-mono font-black text-slate-800">({formatTime(recordingDuration)})</span>
                                    </div>

                                    {/* Tactile Voice Control Buttons */}
                                    <div className="flex items-center justify-center gap-2.5 pt-1 flex-wrap">
                                        {recordingPaused ? (
                                            <button
                                                type="button"
                                                onClick={resumeRecording}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5 shadow-sm border border-emerald-500 cursor-pointer"
                                            >
                                                <PlayCircle size={15} />
                                                <span>Resume</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={pauseRecording}
                                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5 shadow-sm border border-amber-400 cursor-pointer"
                                            >
                                                <PauseCircle size={15} />
                                                <span>Pause</span>
                                            </button>
                                        )}
                                        
                                        <button
                                            type="button"
                                            onClick={stopRecording}
                                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5 shadow-sm border border-purple-500 cursor-pointer"
                                        >
                                            <StopCircle size={15} />
                                            <span>Stop & Transcribe</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={cancelRecording}
                                            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Trash2 size={15} />
                                            <span>Cancel</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-5 py-2">
                                    <button
                                        type="button"
                                        disabled={isGenerating}
                                        onClick={startRecording}
                                        className="w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-amber-500 to-purple-600 text-white hover:scale-105 shadow-purple-500/30"
                                    >
                                        <Mic size={28} />
                                    </button>
                                    <div className="text-left">
                                        <p className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                                            Tap to Record Lecture
                                        </p>
                                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mt-0.5">
                                            Background tab & offline safe • Speech added to docket
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 2. ADD SOURCE MATERIAL BUTTON */}
                        <div className={`relative ${isGenerating ? 'pointer-events-none opacity-60' : ''}`}>
                            <button 
                                type="button"
                                disabled={isGenerating}
                                onClick={() => setShowDropdown(prev => !prev)}
                                className="w-full py-4 bg-white border-2 border-[var(--border-color)] hover:border-[var(--bg-accent)] text-[var(--text-accent)] rounded-2xl font-black uppercase text-xs italic tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.98] hover:bg-[var(--accent-sand)]/80 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <Plus size={18} className="text-[var(--text-accent)]" /> + Add Source Material
                            </button>
                            
                            {showDropdown && !isGenerating && (
                                <div className="absolute left-0 right-0 mt-2 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] rounded-2xl overflow-hidden shadow-2xl z-20">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowDropdown(false);
                                            fileInputRef.current.click();
                                        }}
                                        className="w-full px-5 py-3.5 text-left text-xs font-black text-[var(--text-primary)] hover:bg-[var(--bg-primary)] uppercase transition-all flex items-center gap-3 border-b border-[var(--border-color)]/50 cursor-pointer"
                                    >
                                        <FileText size={16} className="text-[var(--text-accent)]" /> Upload Document (.pdf, .docx, .pptx)
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowDropdown(false);
                                            setTextModalType('context');
                                            setTextInputContent('');
                                            setShowTextModal(true);
                                        }}
                                        className="w-full px-5 py-3.5 text-left text-xs font-black text-[var(--text-primary)] hover:bg-[var(--bg-primary)] uppercase transition-all flex items-center gap-3 cursor-pointer"
                                    >
                                        <Plus size={16} className="text-emerald-600" /> Enter Topic Description / Text
                                    </button>
                                </div>
                            )}
                        </div>

                        <input 
                            type="file" 
                            ref={fileInputRef}
                            multiple 
                            onChange={handleFileUpload} 
                            className="hidden"
                            accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png"
                        />

                        {/* 3. SOURCE MATERIAL DOCKET LIST (Compact Empty State py-5) */}
                        <div className={isGenerating ? 'pointer-events-none opacity-60' : ''}>
                            {inputs.length === 0 ? (
                                <div className="py-5 border-2 border-dashed border-[var(--border-color)] rounded-2xl flex flex-col items-center justify-center text-center p-4 bg-white space-y-1.5 shadow-xs">
                                    <Database size={26} className="text-[var(--text-accent)] opacity-80" />
                                    <p className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">No source material added</p>
                                    <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Upload curriculum guides, enter text, or record audio lecture</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[35vh] overflow-y-auto premium-scrollbar pr-1">
                                    {inputs.map((inp) => (
                                        <div key={inp.id} className="p-4 bg-white rounded-2xl border-2 border-[var(--border-color)] shadow-sm space-y-3 hover:border-[var(--bg-accent)]/50 transition-all">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className="p-2.5 bg-[var(--bg-accent)]/10 rounded-xl text-[var(--text-accent)] shrink-0">
                                                        {inp.type === 'pdf' ? <FileText size={18} /> : inp.type === 'voice' ? <Mic size={18} /> : <FileCode size={18} />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs sm:text-sm font-black text-[var(--text-primary)] truncate">{inp.source_name}</p>
                                                        <p className="text-[9px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider">{inp.type}</p>
                                                    </div>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    disabled={isGenerating}
                                                    onClick={() => handleRemoveInput(inp.id)}
                                                    className="text-red-500 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-all shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Remove input"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            {inp.fetchingMetadata && (
                                                <div className="text-[10px] font-black text-[var(--text-accent)] uppercase animate-pulse pt-2 border-t border-[var(--border-color)]/60">
                                                    ⚡ Reading document page length...
                                                </div>
                                            )}

                                            {inp.file && !['jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'image'].includes(inp.type) && (
                                                <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-[var(--border-color)]/60 bg-slate-50 p-2.5 rounded-xl">
                                                     <div className="flex items-center gap-2">
                                                         <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Start Page:</span>
                                                         <input 
                                                             type="number" 
                                                             min="1" 
                                                             disabled={isGenerating}
                                                             max={inp.maxPages || undefined}
                                                             value={inp.startPage || 1} 
                                                             onChange={(e) => {
                                                                 const rawVal = e.target.value;
                                                                 let val = Math.max(1, parseInt(rawVal) || 1);
                                                                 if (inp.maxPages && val > inp.maxPages) val = inp.maxPages;
                                                                 setInputs(prev => prev.map(item => item.id === inp.id ? { ...item, startPage: val } : item));
                                                             }}
                                                             className="w-16 px-2 py-1 bg-white border-2 border-slate-300 rounded-lg text-xs font-black text-slate-800 text-center disabled:opacity-50" 
                                                         />
                                                     </div>
                                                     <div className="flex items-center gap-2">
                                                         <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">End Page:</span>
                                                         <input 
                                                             type="number" 
                                                             min="1"
                                                             disabled={isGenerating}
                                                             max={inp.maxPages || undefined}
                                                             placeholder="All"
                                                             value={inp.endPage || ''} 
                                                             onChange={(e) => {
                                                                 const rawVal = e.target.value;
                                                                 let val = rawVal === '' ? undefined : parseInt(rawVal);
                                                                 if (val !== undefined && inp.maxPages && val > inp.maxPages) val = inp.maxPages;
                                                                 setInputs(prev => prev.map(item => item.id === inp.id ? { ...item, endPage: val } : item));
                                                             }}
                                                             className="w-16 px-2 py-1 bg-white border-2 border-slate-300 rounded-lg text-xs font-black text-slate-800 text-center disabled:opacity-50" 
                                                         />
                                                     </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Difficulty Focus & Question Count Configuration (40% Desktop Width -> lg:col-span-5) */}
                    <div className={`lg:col-span-5 bg-[var(--bg-secondary)] backdrop-blur-md border border-[var(--border-color)] rounded-3xl p-5 lg:p-6 flex flex-col justify-between space-y-6 shadow-lg ${isGenerating ? 'pointer-events-none opacity-60' : ''}`}>
                        <div className="space-y-6">
                            
                            {/* 1. DIFFICULTY FOCUS SELECTOR */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[9px] font-black uppercase tracking-wider">Input 2</span>
                                    <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">Difficulty Focus</h3>
                                </div>

                                <div className="bg-white border-2 border-[var(--border-color)] rounded-2xl p-5 shadow-sm space-y-3">
                                    <div className="grid grid-cols-2 gap-2.5">
                                        {['Balanced', 'Easy', 'Medium', 'Hard'].map((level) => (
                                            <button
                                                key={level}
                                                type="button"
                                                disabled={isGenerating}
                                                onClick={() => setDifficulty(level)}
                                                className={`py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-200 border-2 cursor-pointer active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${
                                                    difficulty === level
                                                        ? 'bg-[var(--bg-accent)] text-white border-[var(--bg-accent)] shadow-md shadow-[var(--bg-accent)]/20'
                                                        : 'bg-white text-[var(--text-primary)] border-slate-200 hover:border-[var(--bg-accent)]/60 hover:bg-slate-50'
                                                }`}
                                            >
                                                {level === 'Balanced' ? '⚖️ Balanced' : level}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 2. QUESTION COUNT SLIDER (min=1, max=30) */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[9px] font-black uppercase tracking-wider">Input 3</span>
                                    <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">Question Count</h3>
                                </div>

                                <div className="bg-white border-2 border-[var(--border-color)] rounded-2xl p-5 flex items-center gap-5 shadow-sm">
                                    <div className="w-12 h-12 rounded-xl bg-[var(--bg-accent)]/10 border border-[var(--bg-accent)]/20 flex items-center justify-center text-[var(--text-accent)] font-black text-lg italic shrink-0">
                                        <Hash size={22} />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Target Count:</span>
                                            <span className="text-lg font-black text-[var(--text-accent)] italic">{questionCount} MCQs</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="30"
                                            disabled={isGenerating}
                                            value={questionCount}
                                            onChange={(e) => setQuestionCount(parseInt(e.target.value) || 5)}
                                            className="w-full accent-[var(--bg-accent)] bg-slate-100 h-2 rounded-lg cursor-pointer disabled:opacity-50"
                                        />
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                </div>

                {/* BOTTOM FULL-WIDTH ACTION BUTTON */}
                <div className="p-4 lg:p-6 pt-0 w-full">
                    <button
                        type="button"
                        disabled={inputs.length === 0 || isGenerating}
                        onClick={handleGenerateQuiz}
                        className={`w-full py-4.5 px-8 font-black text-sm sm:text-base uppercase tracking-[0.15em] rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 border-2 cursor-pointer ${
                            inputs.length === 0 || isGenerating
                                ? 'bg-[var(--bg-saffron)]/80 text-white border-[var(--bg-saffron)] opacity-80 cursor-not-allowed'
                                : 'bg-[var(--bg-saffron)] hover:bg-[var(--bg-saffron-hover)] text-white border-[var(--bg-saffron)] active:scale-[0.99]'
                        }`}
                        style={{ backgroundColor: 'var(--bg-accent)', color: 'var(--text-on-accent)' }}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="animate-spin text-white" size={20} />
                                <span className="!text-white font-black uppercase tracking-widest text-base" style={{ color: '#ffffff' }}>
                                    Generating MCQs...
                                </span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={20} className="text-amber-300 animate-pulse" />
                                <span className="!text-white font-black uppercase tracking-widest text-base" style={{ color: '#ffffff' }}>
                                    GENERATE AI MCQS
                                </span>
                            </>
                        )}
                    </button>
                </div>

            </div>

            {/* TEXT PROMPT MODAL */}
            {showTextModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md">
                    <div className="bg-white border-2 border-[var(--border-color)] rounded-[2.5rem] p-6 sm:p-8 w-full max-w-lg space-y-6 shadow-2xl relative">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                            <h3 className="text-base sm:text-lg font-black text-[#0f172a] uppercase italic">
                                Add Topic Description / Text
                            </h3>
                            <button 
                                type="button" 
                                onClick={() => setShowTextModal(false)}
                                className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <textarea
                            value={textInputContent}
                            onChange={(e) => setTextInputContent(e.target.value)}
                            placeholder="Paste textbook content, syllabus notes, code snippets, or formula definitions..."
                            rows={6}
                            className="w-full p-4 bg-slate-50 border-2 border-slate-200 focus:border-[var(--bg-accent)] rounded-2xl text-xs sm:text-sm font-bold text-slate-900 outline-none"
                            autoFocus
                        />

                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setShowTextModal(false)}
                                className="px-6 py-3 bg-slate-100 text-slate-600 font-black uppercase text-xs rounded-2xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAddTextInput}
                                disabled={!textInputContent.trim()}
                                className="px-8 py-3 bg-[var(--bg-accent)] text-white font-black uppercase text-xs rounded-2xl shadow-md cursor-pointer"
                            >
                                Add Input
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
