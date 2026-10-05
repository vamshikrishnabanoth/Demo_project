import { useState, useRef, useCallback, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import AuthContext from '../context/AuthContext';
import { 
    Hash, Sparkles, Loader2, Database, 
    FileText, FileCode, Plus, Trash2, Mic, X as XIcon, Award,
    PlayCircle, PauseCircle, StopCircle, WifiOff, RefreshCw,
    AlertCircle, CheckCircle, Download, Lightbulb, Shield, Zap, Scale, Activity
} from 'lucide-react';
import AgentPipelineLoader from '../components/loaders/AgentPipelineLoader';
import TeachingScoreModal from '../components/quiz/TeachingScoreModal';
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
    const { user, loading: authLoading } = useContext(AuthContext);
    const userId = user?.id || 'guest';
    const storageKey = `quiz_docket_inputs_${userId}`;

    // ── 3 Inputs Only ──────────────────────────────────────────────────────────
    // 1. Source Content (Ingested files, recordings, or text prompts)
    const [inputs, setInputs] = useState([]);
    const [isHydrated, setIsHydrated] = useState(false);

    // Fresh session: Do NOT restore stale inputs from previous sessions.
    // Inputs must only be displayed when the user explicitly adds them in the current session.
    useEffect(() => {
        try {
            localStorage.removeItem(storageKey);
            localStorage.removeItem('quiz_docket_inputs_guest');
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('quiz_docket_inputs_')) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch (e) {
            console.warn('Could not clean docket storage:', e);
        }
        setInputs([]);
        setIsHydrated(true);
    }, [storageKey]);

    // 2. Difficulty Focus ("Balanced", "Easy", "Medium", "Hard")
    const [difficulty, setDifficulty] = useState('Balanced');

    // 3. Question Count (Integer, default 10, range 1-30)
    const [questionCount, setQuestionCount] = useState(10);

    // Dynamic Lecture Depth & Curriculum Overview
    const [lectureDepth, setLectureDepth] = useState(null);
    const [detectedFocus, setDetectedFocus] = useState([]);
    const [whatWasTaught, setWhatWasTaught] = useState('');
    const [keyTopics, setKeyTopics] = useState([]);
    const [lectureWordCount, setLectureWordCount] = useState(0);
    const [recommendedQuestions, setRecommendedQuestions] = useState('');
    const [recommendedQuestionCount, setRecommendedQuestionCount] = useState(null);
    const [showTeachingScoreModal, setShowTeachingScoreModal] = useState(false);
    const [depthLoading, setDepthLoading] = useState(false);
    const [depthError, setDepthError] = useState(false);
    const [depthRetryCount, setDepthRetryCount] = useState(0);
    const [lectureIntel, setLectureIntel] = useState(null);

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
    const [transcribeProgress, setTranscribeProgress] = useState(0);
    const [transcribePhase, setTranscribePhase] = useState('');
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [pendingRecoverySessions, setPendingRecoverySessions] = useState([]);

    const currentSessionIdRef = useRef(null);
    const chunkIndexRef = useRef(0);
    const timerWorkerRef = useRef(null);
    const wakeLockRef = useRef(null);
    const [wakeLockActive, setWakeLockActive] = useState(false);
    const recordedBlobsRef = useRef(new Map()); // inputId -> { blob, mimeType, createdAt }

    // ── Screen Wake Lock API to prevent laptop lock/sleep during lecture recording ──
    const requestWakeLock = useCallback(async () => {
        try {
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
                setWakeLockActive(true);
                console.log('Screen Wake Lock ACTIVE during lecture recording.');
            }
        } catch (err) {
            console.warn('Screen Wake Lock request failed:', err.message);
        }
    }, []);

    const releaseWakeLock = useCallback(async () => {
        try {
            if (wakeLockRef.current) {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
                setWakeLockActive(false);
                console.log('Screen Wake Lock RELEASED.');
            }
        } catch (err) {
            console.warn('Screen Wake Lock release failed:', err.message);
        }
    }, []);

    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && recording) {
                await requestWakeLock();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [recording, requestWakeLock]);

    const fileInputRef = useRef(null);
    const lectureFileInputRef = useRef(null);

    // Dropdown & Modal states
    const [showDropdown, setShowDropdown] = useState(false);
    const [showTextModal, setShowTextModal] = useState(false);
    const [textModalType, setTextModalType] = useState('context');
    const [textInputContent, setTextInputContent] = useState('');

    // Polling states
    const [polling, setPolling] = useState(false);
    const [stage, setStage] = useState(0);
    const [stageLabel, setStageLabel] = useState('Generating Questions');
    const [representationMode, setRepresentationMode] = useState(null);
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
            toast('Network offline. Recording saved locally to IndexedDB.', { icon: <Database size={16} aria-hidden="true" /> });
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

    // Fetch unified pedagogical lecture depth for any learning material (voices, documents, or text)
    useEffect(() => {
        const voiceInputs = inputs.filter(inp => (inp.type === 'voice' || inp.type === 'audio') && inp.status !== 'transcribing');
        const docAndTextInputs = inputs.filter(inp => inp.type !== 'voice' && inp.type !== 'audio' && Boolean(inp.content));
        
        const hasInputs = voiceInputs.length > 0 || docAndTextInputs.length > 0;
        if (!hasInputs) {
            setLectureDepth(null);
            setDetectedFocus([]);
            setWhatWasTaught('');
            setKeyTopics([]);
            setLectureWordCount(0);
            setRecommendedQuestions('');
            setRecommendedQuestionCount(null);
            setDepthLoading(false);
            setDepthError(false);
            return;
        }

        let textToAnalyze = '';
        let primaryName = '';
        let voiceSegs = [];
        let modality = 'DOCUMENT_ONLY';

        if (voiceInputs.length > 0) {
            textToAnalyze = voiceInputs.map((v, i) => {
                const title = v.source_name || `Lecture Part ${i + 1}`;
                return voiceInputs.length > 1 ? `=== Lecture Part ${i + 1}: ${title} ===\n${(v.content || '').trim()}` : (v.content || '').trim();
            }).join('\n\n');
            primaryName = voiceInputs[0].source_name || '';
            voiceSegs = voiceInputs.find(inp => Array.isArray(inp.segments) && inp.segments.length > 0)?.segments || [];
            modality = docAndTextInputs.length > 0 ? 'HYBRID' : 'VOICE_ONLY';
        } else {
            textToAnalyze = docAndTextInputs.map(d => (d.content || '').trim()).join('\n\n');
            primaryName = docAndTextInputs[0].source_name || '';
            modality = 'DOCUMENT_ONLY';
        }
        
        if (textToAnalyze.length > 25) {
            setDepthLoading(true);
            setDepthError(false);
            const timer = setTimeout(async () => {
                try {
                    const res = await api.post('/quiz/analyze-depth', {
                        text: textToAnalyze,
                        title: primaryName,
                        modality,
                        segments: voiceSegs,
                        hasTimingData: voiceSegs.length > 0 && voiceSegs.some(s => s.start !== null && s.start !== undefined)
                    });
                    if (res.data && res.data.isAcademic) {
                        setLectureDepth(res.data.lectureDepth);
                        setDetectedFocus(res.data.detectedFocus || []);
                        setWhatWasTaught(res.data.whatWasTaught || '');
                        setKeyTopics(res.data.keyTopics || []);
                        setLectureWordCount(res.data.wordCount || textToAnalyze.trim().split(/\s+/).length);
                        setRecommendedQuestions(res.data.recommendedQuestions || '');
                        setRecommendedQuestionCount(res.data.recommendedQuestionCount || res.data.lectureDepth?.breakdown?.recommendedQuestionCount || 5);
                        setLectureIntel(res.data.lecture_intelligence || null);
                        setDepthError(false);
                    } else if (res.data && !res.data.isAcademic) {
                        setLectureDepth({ rating: 'Non-Academic', score: 10, characteristics: {} });
                        setDetectedFocus([]);
                        setWhatWasTaught('');
                        setKeyTopics([]);
                        setLectureWordCount(0);
                        setRecommendedQuestions('');
                        setRecommendedQuestionCount(null);
                        setLectureIntel(null);
                        setDepthError(false);
                    } else {
                        setLectureDepth(null);
                        setLectureIntel(null);
                        setDepthError(true);
                    }
                } catch (err) {
                    console.warn('[DepthAnalysis] Failed to analyze lecture depth:', err);
                    setLectureDepth(null);
                    setLectureIntel(null);
                    setDepthError(true);
                } finally {
                    setDepthLoading(false);
                }
            }, 600);
            return () => clearTimeout(timer);
        } else {
            setLectureDepth(null);
            setLectureIntel(null);
            setDetectedFocus([]);
            setWhatWasTaught('');
            setKeyTopics([]);
            setLectureWordCount(0);
            setRecommendedQuestions('');
            setRecommendedQuestionCount(null);
            setDepthLoading(false);
            setDepthError(false);
            setDepthError(false);
        }
    }, [inputs, depthRetryCount]);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (elapsedRef.current) clearInterval(elapsedRef.current);
        setPolling(false);
    }, []);

    const startPolling = useCallback((taskId, { onComplete, onError } = {}) => {
        setPolling(true);
        setStage(0);
        setStageLabel('Generating Questions');
        setRepresentationMode(null);
        setElapsed(0);
        setPollError(null);
        startTimeRef.current = Date.now();

        elapsedRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);

        const doPoll = async () => {
            try {
                const res = await api.get(`/quiz/generate/status/${taskId}`);
                const { status, stage: s, stageLabel: sl, representation_mode: rm, result, error: e } = res.data;
                if (s !== undefined) setStage(s);
                if (sl) setStageLabel(sl);
                if (rm) setRepresentationMode(rm);

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

    // ── Unified Audio File Ingestion & Whisper Transcription ─────────────────
    // Immediately after file selection, creates a docket item with status: 'transcribing'
    // Retries update the existing docket item in-place without creating duplicates.
    const processAudioFile = async (file, existingId = null) => {
        const id = existingId || Math.random().toString();
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);

        if (!existingId) {
            // Immediately after file selection: show in docket card with active progress
            const newInput = {
                id,
                type: 'voice',
                file,
                source_name: file.name,
                fileSizeMB,
                status: 'transcribing',
                fetchingMetadata: true,
                content: '',
                progress: 15,
                stepText: 'Uploading audio stream...',
                phaseLabel: 'Network Ingestion',
                errorMsg: null
            };
            setInputs(prev => [...prev, newInput]);
        } else {
            // In-place retry: mark existing item as transcribing with active progress
            setInputs(prev => prev.map(item => item.id === id ? {
                ...item,
                status: 'transcribing',
                fetchingMetadata: true,
                progress: 15,
                stepText: 'Uploading audio stream...',
                phaseLabel: 'Network Ingestion',
                errorMsg: null
            } : item));
        }

        // Client-side preflight check: direct upload limit
        const MAX_DIRECT_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB direct upload ceiling
        if (file.size > MAX_DIRECT_UPLOAD_BYTES) {
            const warningMsg = `Large audio file (${fileSizeMB} MB) exceeds the 500 MB direct upload limit. Please compress audio (e.g. 16 kHz mono) or use a file under 500 MB.`;
            setInputs(prev => prev.map(item => item.id === id ? {
                ...item,
                status: 'error',
                fetchingMetadata: false,
                progress: 0,
                errorMsg: warningMsg
            } : item));
            toast.error(warningMsg, { duration: 8000 });
            return;
        }

        let currentP = 15;
        const progressTicker = setInterval(() => {
            currentP = Math.min(94, currentP < 35 ? currentP + 4 : currentP < 75 ? currentP + 3 : currentP + 1);
            setInputs(prev => prev.map(item => {
                if (item.id !== id || item.status !== 'transcribing') return item;
                let step = 'Uploading audio payload...';
                let phase = 'Payload Transfer';
                if (currentP >= 35 && currentP < 75) {
                    step = 'Whisper Large-v3 speech decoding...';
                    phase = 'Acoustic Model Inference';
                } else if (currentP >= 75) {
                    step = 'Indexing speech timestamps & curriculum depth...';
                    phase = 'Pedagogical Parsing';
                }
                return { ...item, progress: currentP, stepText: step, phaseLabel: phase };
            }));
        }, 700);

        try {
            const formData = new FormData();
            formData.append('file', file);

            // Scale timeout with file size: 5 min base + 1 min per 10 MB (for slow connections)
            const uploadTimeoutMs = Math.max(300000, 300000 + Math.floor((file.size / (10 * 1024 * 1024)) * 60000));

            const transcribeRes = await api.post('/quiz/transcribe', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: uploadTimeoutMs
            });

            clearInterval(progressTicker);

            if (transcribeRes.data && transcribeRes.data.text && transcribeRes.data.text.trim().length >= 5) {
                const smartName = transcribeRes.data.sourceName || transcribeRes.data.smartTitle || file.name;
                setInputs(prev => prev.map(item => item.id === id ? {
                    ...item,
                    status: 'ready',
                    fetchingMetadata: false,
                    progress: 100,
                    stepText: 'Ready',
                    phaseLabel: 'Complete',
                    source_name: smartName,
                    originalFileName: file.name,
                    smartTitle: transcribeRes.data.smartTitle || null,
                    durationLabel: transcribeRes.data.durationLabel || null,
                    content: transcribeRes.data.text,
                    segments: transcribeRes.data.segments || [],
                    duration: transcribeRes.data.duration || null,
                    duration_formatted: transcribeRes.data.duration_formatted || null,
                    lectureDepth: transcribeRes.data.lectureDepth || null,
                    errorMsg: null
                } : item));
                if (transcribeRes.data.lectureDepth) {
                    setLectureDepth(transcribeRes.data.lectureDepth);
                }
                toast.success(`Lecture "${smartName}" ready!`);
            } else {
                const failReason = transcribeRes.data?.msg || 'Could not extract intelligible speech from audio.';
                setInputs(prev => prev.map(item => item.id === id ? {
                    ...item,
                    status: 'error',
                    fetchingMetadata: false,
                    progress: 0,
                    errorMsg: failReason
                } : item));
                toast.error(failReason);
            }
        } catch (err) {
            clearInterval(progressTicker);
            console.error('Lecture transcription failed:', err);
            const rawMsg = err.response?.data?.msg || err.response?.data?.error || err.message || '';
            const isFetchFail = err.message === 'Failed to fetch' || !err.response || rawMsg.includes('Failed to fetch');
            const errorMsg = isFetchFail
                ? `Upload interrupted (${fileSizeMB} MB). The server connection was lost during transfer — this usually means the file is too large for your current network speed. Try compressing the audio to MP3 (128kbps) or use a faster/wired connection.`
                : (rawMsg || 'Transcription failed');
            setInputs(prev => prev.map(item => item.id === id ? {
                ...item,
                status: 'error',
                fetchingMetadata: false,
                progress: 0,
                errorMsg: errorMsg
            } : item));
            toast.error(errorMsg, { duration: 7000 });
        }
    };

    // Retry an existing docket item in-place
    const retryAudioTranscription = async (id) => {
        const target = inputs.find(item => item.id === id);
        if (!target) return;
        if (!target.file) {
            toast.error('Audio file is no longer in browser memory. Please select the file again.');
            return;
        }
        await processAudioFile(target.file, id);
    };

    // Handle File Uploads
    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            const ext = file.name.split('.').pop().toLowerCase();
            const isAudio = ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'aac', 'flac', 'opus'].includes(ext);

            // Automatically route audio files to the dedicated Whisper pipeline
            if (isAudio) {
                await processAudioFile(file);
                continue;
            }

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
                    if (res.data) {
                        if (res.data.isAcademic === false) {
                            const failReason = res.data.reason || `"${file.name}" contains no assessable instructional content and was not added.`;
                            toast.error(failReason, { duration: 5000 });
                            setInputs(prev => prev.filter(item => item.id !== id));
                            continue;
                        }

                        if (res.data.totalCount) {
                            setInputs(prev => prev.map(item => item.id === id ? {
                                ...item,
                                documentId: res.data.documentId,
                                maxPages: res.data.totalCount,
                                endPage: res.data.totalCount,
                                content: res.data.extractedText || '',
                                schemaVersion: 2,
                                fetchingMetadata: false
                            } : item));
                        }
                    }
                } catch (err) {
                    console.error('Metadata fetch error:', err);
                    setInputs(prev => prev.map(item => item.id === id ? { ...item, fetchingMetadata: false } : item));
                }
            }
        }
        e.target.value = '';
    };

    // Handle Lecture File Upload (.mp3, .wav, .m4a, .webm, .ogg, .txt)
    const handleLectureFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            const ext = file.name.split('.').pop().toLowerCase();
            const isAudio = ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'aac', 'flac', 'opus'].includes(ext);
            const isTxt = ext === 'txt';

            if (isTxt) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const text = event.target.result;
                    if (!text || text.trim().length < 10) {
                        toast.error(`Lecture transcript file "${file.name}" is too short.`);
                        return;
                    }
                    setInputs(prev => [...prev, {
                        id: Math.random().toString(),
                        type: 'voice',
                        content: text,
                        source_name: `Lecture Transcript (${file.name})`,
                        status: 'ready',
                        fetchingMetadata: false
                    }]);
                    toast.success(`Added lecture transcript "${file.name}"`);
                };
                reader.readAsText(file);
            } else if (isAudio) {
                // Immediately after file selection: process and show in docket
                await processAudioFile(file);
            } else {
                toast.error(`Unsupported format for "${file.name}". Supported: .mp3, .wav, .m4a, .webm, .ogg, .aac, .flac, .opus, or .txt`);
            }
        }

        e.target.value = '';
    };

    const handleAddTextInput = async () => {
        const text = textInputContent.trim();
        if (!text) return;

        // Verify academic content before adding to docket
        try {
            const res = await api.post('/quiz/analyze-depth', { text });
            if (res.data && res.data.isAcademic === false) {
                const failReason = res.data.reason || 'Entered text contains no assessable instructional content and was not added.';
                toast.error(failReason, { duration: 5000 });
                return;
            }
        } catch (_) {}

        const newInput = {
            id: Math.random().toString(),
            type: 'text',
            content: text,
            source_name: textModalType === 'description' ? 'Topic Description' : `Context Prompt (${text.slice(0, 20)}...)`
        };
        setInputs(prev => [...prev, newInput]);
        setTextInputContent('');
        setShowTextModal(false);
    };

    const handleRemoveInput = (id) => {
        if (isGenerating) return;
        if (recordedBlobsRef.current.has(id)) {
            recordedBlobsRef.current.delete(id);
        }
        setInputs(prev => prev.filter(item => item.id !== id));
    };

    const handleDownloadRecording = (inputId, sourceName) => {
        const entry = recordedBlobsRef.current.get(inputId);
        if (!entry || !entry.blob) {
            toast.error('Original recording audio is not available in browser memory.');
            return;
        }

        const blob = entry.blob;
        const typeStr = (blob.type || entry.mimeType || '').toLowerCase();
        let ext = 'webm';
        if (typeStr.includes('mp4') || typeStr.includes('m4a') || typeStr.includes('aac')) {
            ext = 'm4a';
        } else if (typeStr.includes('ogg')) {
            ext = 'ogg';
        } else if (typeStr.includes('wav')) {
            ext = 'wav';
        } else if (typeStr.includes('webm')) {
            ext = 'webm';
        }

        const d = entry.createdAt ? new Date(entry.createdAt) : new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
        
        const safePrefix = (sourceName || 'Lecture_Recording')
            .replace(/[^a-zA-Z0-9_\-]/g, '_')
            .replace(/_+/g, '_');
        
        const fileName = `${safePrefix}_${dateStr}.${ext}`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        toast.success(`Downloaded "${fileName}"`);
    };

    // ── 4-Hour Memory-Safe & Crash-Proof Voice Recording Lifecycle ───────────────
    const startRecording = async () => {
        if (isGenerating) return;
        isCancelledRef.current = false;

        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        currentSessionIdRef.current = newSessionId;
        chunkIndexRef.current = 0;

        // Prevent screen dimming / lock during recording
        await requestWakeLock();

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
                await releaseWakeLock();

                if (timerWorkerRef.current) {
                    timerWorkerRef.current.postMessage({ command: 'stop' });
                    timerWorkerRef.current.terminate();
                    timerWorkerRef.current = null;
                }

                // If user clicked Cancel, discard session & IndexedDB store
                if (isCancelledRef.current) {
                    console.log('Voice recording was cancelled by user. Discarding IndexedDB session.');
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
                    toast('Network offline. Recording safely saved locally in IndexedDB.', { icon: <Database size={16} aria-hidden="true" /> });
                    return;
                }

                setTranscribing(true);
                setTranscribeProgress(20);
                setTranscribePhase('Uploading lecture recording...');
                const toastId = toast.loading('Transcribing speech with Whisper Large-v3...');

                const micTicker = setInterval(() => {
                    setTranscribeProgress(p => {
                        if (p < 40) {
                            setTranscribePhase('Uploading lecture audio...');
                            return p + 6;
                        }
                        if (p < 75) {
                            setTranscribePhase('Whisper Large-v3 acoustic decoding...');
                            return p + 3;
                        }
                        if (p < 94) {
                            setTranscribePhase('Verifying pedagogical depth & timestamps...');
                            return p + 1;
                        }
                        return p;
                    });
                }, 600);

                try {
                    const formData = new FormData();
                    formData.append('file', audioBlob, 'lecture_recording.webm');

                    let transcriptText = '';
                    let transcriptSegments = [];
                    let transcriptDuration = null;
                    let transcriptDurationFormatted = null;
                    let smartTitle = null;
                    let durationLabel = null;
                    let smartSourceName = null;
                    let isAcademic = true;
                    let academicFailureReason = null;

                    try {
                        const localRes = await api.post('http://localhost:8000/transcribe', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                            timeout: 30000
                        });
                        transcriptText = localRes.data.text;
                        transcriptSegments = localRes.data.segments || [];
                        transcriptDuration = localRes.data.duration || null;
                        transcriptDurationFormatted = localRes.data.duration_formatted || null;
                        const depthRes = await api.post('/quiz/analyze-depth', { text: transcriptText });
                        isAcademic = depthRes.data?.isAcademic !== false;
                        academicFailureReason = depthRes.data?.reason;
                        if (depthRes.data?.keyTopics && depthRes.data.keyTopics.length > 0) {
                            smartTitle = depthRes.data.keyTopics.slice(0, 3).join(' & ');
                        }
                    } catch (_) {
                        const transcribeRes = await api.post('/quiz/transcribe', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        transcriptText = transcribeRes.data.text;
                        transcriptSegments = transcribeRes.data?.segments || [];
                        transcriptDuration = transcribeRes.data?.duration || null;
                        transcriptDurationFormatted = transcribeRes.data?.duration_formatted || null;
                        smartTitle = transcribeRes.data?.smartTitle || null;
                        durationLabel = transcribeRes.data?.durationLabel || null;
                        smartSourceName = transcribeRes.data?.sourceName || null;
                        isAcademic = transcribeRes.data?.isAcademic !== false;
                        academicFailureReason = transcribeRes.data?.reason;
                    }

                    if (!isAcademic) {
                        toast.error(academicFailureReason || 'Voice recording contains no assessable instructional content and was not added.', { id: toastId, duration: 6000 });
                        await markSessionCompleted(newSessionId);
                        await deleteSessionRecord(newSessionId);
                        return;
                    }

                    if (transcriptText && transcriptText.trim().length > 5) {
                        const recDate = new Date();
                        const timeStr = recDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const inputId = Math.random().toString();
                        recordedBlobsRef.current.set(inputId, {
                            blob: audioBlob,
                            mimeType: mimeType || audioBlob.type || 'audio/webm',
                            createdAt: recDate
                        });

                        const finalTitle = smartTitle || 'Lecture Recording';
                        const finalDuration = durationLabel || (transcriptDuration ? `${Math.round(transcriptDuration)}s` : '');
                        const finalName = smartSourceName || (finalDuration ? `${finalTitle} (${finalDuration})` : `${finalTitle} (${timeStr})`);

                        toast.success(`Speech transcribed: "${finalName}"`, { id: toastId });
                        setInputs(prev => [...prev, {
                            id: inputId,
                            type: 'voice',
                            content: transcriptText,
                            segments: transcriptSegments,
                            duration: transcriptDuration,
                            duration_formatted: transcriptDurationFormatted,
                            durationLabel: finalDuration,
                            smartTitle: finalTitle,
                            source_name: finalName,
                            hasRecordedBlob: true,
                            recordedAt: recDate.toISOString()
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
                    clearInterval(micTicker);
                    setTranscribing(false);
                    setTranscribeProgress(0);
                    setTranscribePhase('');
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
            toast('Recording cancelled', { icon: <Trash2 size={16} aria-hidden="true" /> });
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
            let transcriptSegments = [];
            let transcriptDuration = null;
            let transcriptDurationFormatted = null;
            try {
                const localRes = await api.post('http://localhost:8000/transcribe', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 30000
                });
                transcriptText = localRes.data.text;
                transcriptSegments = localRes.data.segments || [];
                transcriptDuration = localRes.data.duration || null;
                transcriptDurationFormatted = localRes.data.duration_formatted || null;
            } catch (_) {
                const transcribeRes = await api.post('/quiz/transcribe', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                transcriptText = transcribeRes.data.text;
                transcriptSegments = transcribeRes.data?.segments || [];
                transcriptDuration = transcribeRes.data?.duration || null;
                transcriptDurationFormatted = transcribeRes.data?.duration_formatted || null;
            }

            if (transcriptText && transcriptText.trim().length > 5) {
                const recDate = sess.createdAt ? new Date(sess.createdAt) : new Date();
                const timeStr = recDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const inputId = Math.random().toString();
                recordedBlobsRef.current.set(inputId, {
                    blob: blob,
                    mimeType: blob.type || 'audio/webm',
                    createdAt: recDate
                });
                toast.success('Recovered recording transcribed successfully!', { id: toastId });
                setInputs(prev => [...prev, {
                    id: inputId,
                    type: 'voice',
                    content: transcriptText,
                    segments: transcriptSegments,
                    duration: transcriptDuration,
                    duration_formatted: transcriptDurationFormatted,
                    source_name: `Recovered Recording (${timeStr})`,
                    hasRecordedBlob: true,
                    recordedAt: recDate.toISOString()
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
    const hasTranscribingAudio = inputs.some(inp => (inp.type === 'voice' || inp.type === 'audio') && inp.status === 'transcribing');

    const handleGenerateQuiz = async () => {
        if (inputs.length === 0 || isGenerating) {
            if (inputs.length === 0) toast.error('Please add at least one source input (document, voice recording, or text).');
            return;
        }

        if (hasTranscribingAudio) {
            toast.error('Please wait for lecture audio transcription to complete before generating the quiz.');
            return;
        }

        setSubmitting(true);

        const formData = new FormData();
        
        // 1. Live physical files currently in memory
        const liveFileInputs = inputs.filter(inp => inp.file && inp.type !== 'voice' && inp.type !== 'audio');
        liveFileInputs.forEach(inp => {
            formData.append('files', inp.file);
        });

        // 2. All document configurations (only actual document files or restored docket items, not pure text prompts)
        const docInputs = inputs.filter(inp => 
            inp.type !== 'voice' && 
            inp.type !== 'audio' && 
            inp.type !== 'text' && 
            (inp.file || inp.documentId)
        );
        const fileConfigs = docInputs.map(inp => ({
            name: inp.source_name,
            documentId: inp.documentId,
            startPage: inp.startPage || 1,
            endPage: inp.endPage || inp.maxPages || 1
        }));
        formData.append('file_configs', JSON.stringify(fileConfigs));

        formData.append('topic', inputs.map(i => i.source_name).join(', '));
        formData.append('questionCount', questionCount);
        formData.append('question_count', questionCount);
        formData.append('difficulty', difficulty);

        // 3. Text prompts: voice transcripts, text inputs, and fallback text for restored documents without live File
        const textInputs = inputs.filter(inp => {
            if (inp.type === 'voice' || inp.type === 'audio') return Boolean(inp.content);
            if (!inp.file && inp.content) return true;
            if (inp.type === 'text' && inp.content) return true;
            return false;
        });

        const structuredPrompts = textInputs.map(t => {
            const isVoice = (t.type === 'voice' || t.type === 'audio');
            let content = t.content;
            if (!isVoice && t.type !== 'text' && t.startPage && t.endPage && t.content) {
                const lines = t.content.split('\n');
                const totalLines = lines.length;
                const totalPages = t.maxPages || 1;
                const linesPerPage = Math.max(1, Math.ceil(totalLines / totalPages));
                const s = Math.max(0, (t.startPage - 1) * linesPerPage);
                const e = Math.min(totalLines, (t.endPage || totalPages) * linesPerPage);
                content = lines.slice(s, e).join('\n');
            }
            return {
                type: isVoice ? 'voice' : (t.type || 'text'),
                source_name: t.source_name,
                documentId: t.documentId || null,
                content: content,
                startPage: t.startPage || null,
                endPage: t.endPage || null
            };
        }).filter(item => item && item.content);

        formData.append('text_prompts', JSON.stringify(structuredPrompts));

        try {
            const res = await api.post('/quiz/generate', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 180000 
            });

            const { taskId } = res.data;
            if (!taskId) throw new Error('No taskId returned from server');
            setSubmitting(false);

            // Clean up docket cache for fresh subsequent runs
            try {
                localStorage.removeItem(storageKey);
                localStorage.removeItem('quiz_docket_inputs_guest');
            } catch (_) {}

            const serializedInputs = inputs.map(inp => ({
                id: inp.id,
                source_name: inp.source_name,
                type: inp.type,
                size: inp.size,
                startPage: inp.startPage || 1,
                endPage: inp.endPage || inp.maxPages || 1,
                snippet: (inp.content || '').slice(0, 300),
                wordCount: (inp.content || '').split(/\s+/).filter(Boolean).length
            }));

            // Navigate to dedicated Pipeline Output page during content processing
            navigate('/pipeline-output', {
                state: {
                    hasPipelineData: true,
                    status: 'PROCESSING',
                    taskId,
                    inputs: serializedInputs,
                    sourceNames: inputs.map(i => i.source_name),
                    isVoice: inputs.some(inp => inp.type === 'voice' || inp.type === 'audio'),
                    difficulty,
                    questionCount,
                    title: `Quiz: ${inputs[0]?.source_name || 'AI Generated Assessment'}`,
                    whatWasTaught,
                    keyTopics,
                    lectureWordCount
                }
            });

            setInputs([]);
        } catch (err) {
            console.error(err);
            const serverMsg = err.response?.data?.msg || err.response?.data?.error || (err.response?.data?.errors && err.response.data.errors.map(e => e.msg).join(', ')) || err.message;
            toast.error(serverMsg || 'Failed to start generation. Please try again.');
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
                    representationMode={representationMode}
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

                    <div className="flex items-center gap-3 flex-wrap">

                        {/* Interactive Teaching Depth Score Badge */}
                        {lectureDepth && (
                            <button
                                type="button"
                                onClick={() => setShowTeachingScoreModal(true)}
                                className="bg-purple-50 hover:bg-purple-100 border-2 border-purple-200 hover:border-purple-300 rounded-2xl px-4 py-2.5 flex items-center gap-3.5 shadow-xs transition-all cursor-pointer active:scale-95 group text-left"
                                title="Click to view exact rubric explanation & point deductions breakdown"
                            >
                                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-300/60 flex items-center justify-center text-purple-700 shrink-0 group-hover:scale-105 transition-transform">
                                    <Award size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[10px] font-black text-purple-900 uppercase tracking-widest">Teaching Depth Score</p>
                                        <span className="text-[9px] font-bold text-purple-700 bg-purple-200/70 px-1.5 py-0.2 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                            Why not 100? ℹ️
                                        </span>
                                    </div>
                                    <p className="text-sm font-black text-purple-800">
                                        {lectureDepth.rating || 'Comprehensive'} ({lectureDepth.score}/100)
                                    </p>
                                </div>
                                <div className="w-16 bg-purple-200 h-2 rounded-full overflow-hidden shrink-0 hidden sm:block">
                                    <div 
                                        className="bg-purple-600 h-full rounded-full transition-all duration-500" 
                                        style={{ width: `${lectureDepth.score}%` }} 
                                    />
                                </div>
                            </button>
                        )}
                    </div>
                </div>

                {pollError && (
                    <div className="mx-6 mt-4 px-5 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 font-bold text-xs uppercase tracking-wider">
                        <AlertCircle size={14} className="inline mr-1" aria-hidden="true" /> {pollError}
                    </div>
                )}

                {/* CRASH RECOVERY BANNER WITH DETAILED TIMESTAMPS & DISCARD */}
                {pendingRecoverySessions.length > 0 && (
                    <div className="mx-4 lg:mx-6 mt-4 p-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl flex flex-col gap-3 shadow-md">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
                            <div className="flex items-center gap-2.5">
                                <RefreshCw className="text-amber-600 animate-spin" size={18} />
                                <div>
                                    <p className="text-xs font-black text-amber-900 uppercase tracking-wider">
                                        Unsaved Recording Session{pendingRecoverySessions.length > 1 ? 's' : ''} Detected ({pendingRecoverySessions.length})
                                    </p>
                                    <p className="text-[10px] font-bold text-amber-700">
                                        Saved in your browser's local IndexedDB from a previous recording session (prior crash, tab closure, or network interruption).
                                    </p>
                                </div>
                            </div>
                            {pendingRecoverySessions.length > 1 && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        for (const sess of pendingRecoverySessions) {
                                            await deleteSessionRecord(sess.sessionId);
                                        }
                                        setPendingRecoverySessions([]);
                                        toast('All unsaved recordings discarded', { icon: <Trash2 size={16} aria-hidden="true" /> });
                                    }}
                                    className="text-[11px] font-bold text-amber-800 hover:text-red-600 hover:underline cursor-pointer transition-all self-end sm:self-auto"
                                >
                                    Discard All
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2.5 items-center">
                            {pendingRecoverySessions.map((sess, idx) => {
                                const dateObj = sess.createdAt ? new Date(sess.createdAt) : new Date();
                                const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

                                return (
                                    <div 
                                        key={sess.sessionId} 
                                        className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs shadow-sm"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-black text-amber-950 text-[11px]">
                                                <><Mic size={14} className="inline mr-1" aria-hidden="true" /> Recording #{idx + 1}</>
                                            </span>
                                            <span className="text-[10px] font-bold text-amber-800">
                                                {dateStr} at {timeStr}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 ml-2">
                                            <button
                                                type="button"
                                                onClick={() => handleRecoverSession(sess)}
                                                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                                            >
                                                Recover
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    await deleteSessionRecord(sess.sessionId);
                                                    setPendingRecoverySessions(prev => prev.filter(s => s.sessionId !== sess.sessionId));
                                                    toast('Recording discarded', { icon: <Trash2 size={16} aria-hidden="true" /> });
                                                }}
                                                title="Discard this recording"
                                                className="p-1 hover:bg-red-500/20 text-amber-800 hover:text-red-600 rounded-lg text-xs font-black transition-all cursor-pointer"
                                            >
                                                <XIcon size={16} aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
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
                                <div className="py-3 px-4 w-full max-w-md mx-auto bg-purple-50/90 border border-purple-200 rounded-2xl shadow-xs space-y-2.5">
                                    <div className="flex items-center justify-between text-xs font-black text-purple-950">
                                        <span className="flex items-center gap-2">
                                            <Loader2 size={15} className="animate-spin text-purple-600" />
                                            <span>{transcribePhase || 'Transcribing Lecture Speech...'}</span>
                                        </span>
                                        <span className="font-mono text-purple-700 font-extrabold">{transcribeProgress}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-purple-200/70 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 rounded-full transition-all duration-300"
                                            style={{ width: `${transcribeProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-purple-700 font-bold uppercase tracking-wider text-center">
                                        Whisper Large-v3 · Real-Time Acoustic Decoding & Pedagogy Analysis
                                    </p>
                                </div>
                            ) : recording ? (
                                <div className="flex flex-col items-center gap-3 py-1">
                                    <div className="flex flex-wrap items-center justify-center gap-2 font-mono font-bold text-xs">
                                        <span className="flex items-center gap-1.5 text-amber-900 bg-amber-100/80 px-3 py-1 rounded-full border border-amber-300">
                                            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                                            <span>{recordingPaused ? 'RECORDING PAUSED' : 'RECORDING LECTURE'}</span>
                                            <span className="font-mono font-black text-slate-800">({formatTime(recordingDuration)})</span>
                                        </span>
                                        {wakeLockActive && (
                                            <span className="flex items-center gap-1 text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 font-sans font-bold text-[10px]">
                                                <><Lightbulb size={14} className="inline mr-1" aria-hidden="true" /> Screen Keep-Alive Active (Laptop won't lock)</>
                                            </span>
                                        )}
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
                                            lectureFileInputRef.current.click();
                                        }}
                                        className="w-full px-5 py-3.5 text-left text-xs font-black text-[var(--text-primary)] hover:bg-[var(--bg-primary)] uppercase transition-all flex items-center gap-3 border-b border-[var(--border-color)]/50 cursor-pointer"
                                    >
                                        <Mic size={16} className="text-amber-600" /> Upload Lecture (.mp3, .wav, .m4a, .webm, .ogg, .txt)
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

                        <input 
                            type="file" 
                            ref={lectureFileInputRef}
                            multiple
                            onChange={handleLectureFileUpload} 
                            className="hidden"
                            accept=".mp3,.wav,.m4a,.webm,.ogg,.aac,.flac,.opus,.txt"
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
                                                        {inp.type === 'pdf' ? <FileText size={18} /> : (inp.type === 'voice' || inp.type === 'audio') ? <Mic size={18} /> : <FileCode size={18} />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs sm:text-sm font-black text-[var(--text-primary)] truncate">{inp.source_name}</p>
                                                        <p className="text-[9px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider">
                                                            {inp.type === 'voice' ? 'Audio Lecture' : inp.type}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {inp.type === 'voice' && (
                                                        <button
                                                            type="button"
                                                            disabled={isGenerating}
                                                            onClick={() => handleDownloadRecording(inp.id, inp.source_name)}
                                                            className="text-slate-500 hover:text-amber-600 p-2 hover:bg-amber-50 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title="Download original audio recording"
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                    )}
                                                    <button 
                                                        type="button" 
                                                        disabled={isGenerating}
                                                        onClick={() => handleRemoveInput(inp.id)}
                                                        className="text-red-500 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Remove input"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {inp.fetchingMetadata && (inp.type !== 'voice' && inp.type !== 'audio') && (
                                                <div className="text-[10px] font-black text-[var(--text-accent)] uppercase animate-pulse pt-2 border-t border-[var(--border-color)]/60">
                                                    <><Zap size={14} className="inline mr-1" aria-hidden="true" /> Reading document page length...</>
                                                </div>
                                            )}

                                            {/* Audio / Voice Ingestion Status & Retry Banner */}
                                            {(inp.type === 'voice' || inp.type === 'audio') && (
                                                <div className="pt-2 border-t border-[var(--border-color)]/60">
                                                    {inp.status === 'transcribing' ? (
                                                        <div className="bg-amber-50/90 p-3 rounded-xl border border-amber-200/80 space-y-2">
                                                            <div className="flex items-center justify-between text-[11px] font-black text-amber-900">
                                                                <span className="flex items-center gap-1.5">
                                                                    <Loader2 size={13} className="animate-spin text-amber-600" />
                                                                    <span>{inp.stepText || 'Transcribing with Whisper Large-v3...'}</span>
                                                                </span>
                                                                <span className="font-mono text-amber-700 font-extrabold">{inp.progress || 20}%</span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-amber-200/60 rounded-full overflow-hidden">
                                                                <div 
                                                                    className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-purple-600 transition-all duration-300 rounded-full"
                                                                    style={{ width: `${inp.progress || 20}%` }}
                                                                />
                                                            </div>
                                                            <div className="flex items-center justify-between text-[9px] text-amber-700/80 font-bold uppercase tracking-wider">
                                                                <span>{inp.phaseLabel || 'Whisper Speech Decoding'}</span>
                                                                <span>{inp.fileSizeMB ? `${inp.fileSizeMB} MB` : 'Audio'}</span>
                                                            </div>
                                                        </div>
                                                    ) : inp.status === 'error' ? (
                                                        <div className="flex items-center justify-between gap-2 bg-red-50/80 p-2.5 rounded-xl border border-red-200 text-red-700">
                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                <AlertCircle size={15} className="text-red-500 shrink-0" />
                                                                <span className="text-[10px] font-bold truncate" title={inp.errorMsg || 'Transcription failed'}>
                                                                    {inp.errorMsg || 'Transcription failed'}
                                                                </span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => retryAudioTranscription(inp.id)}
                                                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shrink-0 active:scale-95 shadow-xs"
                                                                title="Retry transcription in-place"
                                                            >
                                                                <RefreshCw size={11} /> Retry
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between gap-2 bg-emerald-50/60 p-2 rounded-xl border border-emerald-200/60 text-emerald-800">
                                                            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                                                                <CheckCircle size={13} className="text-emerald-600" />
                                                                Ready ({inp.content ? inp.content.trim().split(/\s+/).length : 0} words)
                                                            </span>
                                                            {inp.fileSizeMB && (
                                                                <span className="text-[10px] font-bold text-slate-500">
                                                                    {inp.fileSizeMB} MB
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {['pdf', 'docx', 'pptx', 'document'].includes(inp.type) && (
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

                        {/* 4. LECTURE CONTENT & ASSESSMENT SCOPE CARD (Any learning materials) */}
                        {inputs.length > 0 && (
                            <>
                                {depthLoading && (
                                    <div className="p-4 bg-orange-50/60 border border-orange-200/70 rounded-3xl flex items-center justify-center gap-3 text-xs text-orange-800 font-medium animate-pulse">
                                        <Loader2 size={16} className="animate-spin text-[#ea580c]" />
                                        <span>Analyzing pedagogical depth and assessment scope...</span>
                                    </div>
                                )}

                                {!depthLoading && depthError && (
                                    <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-3xl flex items-center justify-between gap-3 text-xs text-amber-800 shadow-2xs">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle size={16} className="text-amber-600 shrink-0" />
                                            <span>Pedagogical depth analysis is temporarily unavailable. Question generation will still operate normally using your materials.</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setDepthRetryCount(c => c + 1)}
                                            className="px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-amber-800 font-bold hover:bg-amber-100/60 active:scale-95 transition-all text-[11px] shrink-0 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                        >
                                            <RefreshCw size={12} />
                                            Retry
                                        </button>
                                    </div>
                                )}

                                {!depthLoading && !depthError && lectureDepth && lectureDepth.rating !== 'Non-Academic' && (
                                    <div className="p-4.5 bg-[#fff8f3] border-2 border-[#f5d0b5] rounded-3xl space-y-3.5 shadow-xs transition-all animate-in fade-in duration-200">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#f5d0b5]/70">
                                            <div className="flex items-center gap-2">
                                                <Sparkles size={16} className="text-[#ea580c] animate-pulse" />
                                                <span className="text-[11px] font-black text-[#c2410c] uppercase tracking-wider">
                                                    Teaching Depth: <span className="font-bold text-[#ea580c]">{(lectureDepth.rating || 'Comprehensive').toUpperCase()}</span>
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowTeachingScoreModal(true)}
                                                className="self-start sm:self-auto text-xs font-mono font-black text-[#9a3412] bg-white hover:bg-orange-100/80 px-3 py-1 rounded-full border border-[#f5d0b5] flex items-center gap-2 shadow-2xs transition-all cursor-pointer hover:scale-105 active:scale-95"
                                                title="Click to view exact rubric explanation & point deductions breakdown"
                                            >
                                                <span>Score: {lectureDepth.score}/100</span>
                                                <span className="text-[10px] text-orange-700 font-bold bg-orange-100 px-1.5 py-0.2 rounded-full flex items-center gap-1">
                                                    Why not 100? ℹ️
                                                </span>
                                            </button>
                                        </div>

                                        {/* 0. Intelligent Evidence-Grounded Lecture Title */}
                                        {lectureIntel?.title && (
                                            <div className="bg-white/95 p-3 rounded-2xl border border-orange-200/70 shadow-2xs space-y-1">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-[#c2410c] flex items-center gap-1.5">
                                                    <span>🏷️</span> Academic Subject Topic
                                                </p>
                                                <p className="text-xs font-bold text-slate-900 leading-snug">
                                                    {lectureIntel.title}
                                                </p>
                                            </div>
                                        )}

                                        {/* 1. What Was Taught (1-Line Pedagogical Overview) */}
                                        <div className="bg-white/95 p-3.5 rounded-2xl border border-orange-200/70 shadow-2xs space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-[#c2410c] flex items-center gap-1.5">
                                                <span>📖</span> What Was Taught
                                            </p>
                                            <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                                                {lectureIntel?.summary || whatWasTaught || `A comprehensive lecture exploring ${inputs.map(i => i.source_name).filter(Boolean)[0] || 'core concepts'} with detailed conceptual foundations, operational mechanisms, and step-by-step traces.`}
                                            </p>
                                        </div>

                                        {/* 2. Sequential Chapters Timeline */}
                                        {lectureIntel?.chapters && lectureIntel.chapters.length > 0 && (
                                            <div className="bg-white/95 p-3.5 rounded-2xl border border-orange-200/70 shadow-2xs space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-[#c2410c] flex items-center gap-1.5">
                                                    <span>📑</span> Sequential Chapters & Topics
                                                </p>
                                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                    {lectureIntel.chapters.map((ch, idx) => (
                                                        <div key={ch.id || idx} className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-bold text-slate-800">{idx + 1}. {ch.title}</span>
                                                                {ch.timestamp_start && (
                                                                    <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-full shrink-0">
                                                                        {ch.timestamp_start}{ch.timestamp_end ? ` - ${ch.timestamp_end}` : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {ch.summary && <p className="text-[11px] text-slate-600 leading-relaxed">{ch.summary}</p>}
                                                            {ch.key_concepts && ch.key_concepts.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 pt-0.5">
                                                                    {ch.key_concepts.map((kc, kci) => (
                                                                        <span key={kci} className="text-[9px] font-semibold bg-orange-100/70 text-orange-800 px-1.5 py-0.5 rounded border border-orange-200">
                                                                            {kc}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 3. Key Topics to be Assessed / Subtopics */}
                                        {((keyTopics && keyTopics.length > 0) || (detectedFocus && detectedFocus.length > 0)) && (
                                            <div className="bg-white/95 p-3.5 rounded-2xl border border-orange-200/70 shadow-2xs space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-[#c2410c] flex items-center gap-1.5">
                                                    <span>🎯</span> Key Concepts to be Assessed
                                                </p>
                                                <div className="flex flex-wrap gap-2 pt-0.5">
                                                    {(keyTopics && keyTopics.length > 0 ? keyTopics : detectedFocus).map((topic, i) => (
                                                        <span key={i} className="text-xs font-bold text-slate-700 bg-white hover:bg-orange-50/70 px-3 py-1 rounded-full border border-orange-200/80 shadow-2xs transition-colors flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-[#ea580c] shrink-0" />
                                                            <span>{topic}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 4. Observable Pedagogical Profile (Safeguard 2: Multi-Label Rubric) */}
                                        {lectureIntel?.pedagogicalCritique && (
                                             <div className="bg-white/95 p-3.5 rounded-2xl border border-orange-200/70 shadow-2xs space-y-2">
                                                 <p className="text-[10px] font-black uppercase tracking-wider text-[#c2410c] flex items-center gap-1.5">
                                                     <span>🎓</span> Observable Teaching Traits
                                                 </p>
                                                 <div className="flex flex-wrap gap-1.5">
                                                     {(lectureIntel.pedagogicalCritique.explanatoryDepth || []).map((tag, i) => (
                                                         <span key={i} className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                                                             {tag.replace(/_/g, ' ')}
                                                         </span>
                                                     ))}
                                                     {(lectureIntel.pedagogicalCritique.reasoningDepth || []).map((tag, i) => (
                                                         <span key={i} className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                             {tag.replace(/_/g, ' ')}
                                                         </span>
                                                     ))}
                                                     {(lectureIntel.pedagogicalCritique.practicalDemonstrations || []).map((tag, i) => (
                                                         <span key={i} className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                                                             {tag.replace(/_/g, ' ')}
                                                         </span>
                                                     ))}
                                                     {(lectureIntel.pedagogicalCritique.discourseStyle || []).map((tag, i) => (
                                                         <span key={i} className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                                                             {tag.replace(/_/g, ' ')}
                                                         </span>
                                                     ))}
                                                 </div>
                                                 {lectureIntel.pedagogicalCritique.limitationsOfExcerpt && (
                                                     <p className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                         ℹ️ {lectureIntel.pedagogicalCritique.limitationsOfExcerpt}
                                                     </p>
                                                 )}
                                             </div>
                                        )}

                                        {/* 5. Assessment Scope & Content Volume with 1-Click Apply */}
                                        <div className="bg-white/95 px-4 py-3 rounded-2xl border border-orange-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                                            <div className="flex items-center gap-2 text-slate-700">
                                                <span>📊</span>
                                                <span>Content Volume: <strong className="font-black text-[#c2410c]">{lectureWordCount > 0 ? lectureWordCount.toLocaleString() : (inputs.find(i => i.type === 'voice' || i.type === 'audio')?.content?.split(/\s+/)?.length || 0).toLocaleString()} words</strong></span>
                                            </div>
                                            
                                            <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap">
                                                <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                                                    <span>🎯</span> Recommended: <strong className="font-black text-[#c2410c]">{recommendedQuestions || `${recommendedQuestionCount || 5} Questions`}</strong>
                                                </span>
                                                
                                                {recommendedQuestionCount && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setQuestionCount(recommendedQuestionCount);
                                                            toast.success(`Applied recommended ${recommendedQuestionCount} questions!`, { icon: '🎯' });
                                                        }}
                                                        className="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                                                        title="Apply recommended question count into Question Count configuration"
                                                    >
                                                        <Zap size={13} />
                                                        <span>Apply {recommendedQuestionCount} Qs</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* 6. Pedagogical Depth Characteristics */}
                                        {lectureDepth.characteristics && (
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[10px] font-bold text-slate-600">
                                                <div className="bg-white/90 p-2 rounded-xl border border-orange-100 shadow-2xs text-center">
                                                    Concepts: <span className="font-black text-[#c2410c]">{lectureDepth.characteristics.conceptExplanation || 'Strong'}</span>
                                                </div>
                                                <div className="bg-white/90 p-2 rounded-xl border border-orange-100 shadow-2xs text-center">
                                                    Reasoning: <span className="font-black text-[#c2410c]">{lectureDepth.characteristics.reasoning || 'Light'}</span>
                                                </div>
                                                <div className="bg-white/90 p-2 rounded-xl border border-orange-100 shadow-2xs text-center">
                                                    Examples: <span className="font-black text-[#c2410c]">{lectureDepth.characteristics.examples || 'Present'}</span>
                                                </div>
                                                <div className="bg-white/90 p-2 rounded-xl border border-orange-100 shadow-2xs text-center">
                                                    Procedures: <span className="font-black text-[#c2410c]">{lectureDepth.characteristics.procedures || 'Strong'}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
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
                                                {level === 'Balanced' ? <><Scale size={14} className="inline mr-1" aria-hidden="true" /> Balanced</> : level}
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
                        disabled={inputs.length === 0 || isGenerating || hasTranscribingAudio}
                        onClick={handleGenerateQuiz}
                        className={`w-full py-4.5 px-8 font-black text-sm sm:text-base uppercase tracking-[0.15em] rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 border-2 cursor-pointer ${
                            inputs.length === 0 || isGenerating || hasTranscribingAudio
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
                        ) : hasTranscribingAudio ? (
                            <>
                                <Loader2 className="animate-spin text-white" size={20} />
                                <span className="!text-white font-black uppercase tracking-widest text-base" style={{ color: '#ffffff' }}>
                                    Transcribing Lecture Audio...
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
                                <XIcon size={18} />
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

            {/* TEACHING SCORE MODAL */}

            <TeachingScoreModal
                isOpen={showTeachingScoreModal}
                onClose={() => setShowTeachingScoreModal(false)}
                lectureDepth={lectureDepth}
                detectedFocus={detectedFocus}
                whatWasTaught={whatWasTaught}
                recommendedQuestions={recommendedQuestions}
                recommendedQuestionCount={recommendedQuestionCount}
                onApplyQuestionCount={(cnt) => {
                    setQuestionCount(cnt);
                    toast.success(`Applied recommended ${cnt} questions!`);
                }}
            />
        </DashboardLayout>
    );
}
