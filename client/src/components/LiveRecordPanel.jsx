import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Pause, Play, AlertCircle, Hash, BarChart3, Sparkles, X, WifiOff, RefreshCw } from 'lucide-react';
import api from '../utils/api';
import AgentPipelineLoader from './loaders/AgentPipelineLoader';
import { 
    createSessionRecord, 
    saveAudioChunk, 
    reconstructSessionBlob, 
    getPendingSessions, 
    markSessionCompleted, 
    deleteSessionRecord 
} from '../utils/audioDB';
import { createTimerWorker } from '../utils/timerWorker';

export default function LiveRecordPanel({ onQuestionsLoaded }) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [pendingRecoverySessions, setPendingRecoverySessions] = useState([]);

    // ── Config modal state (shown after recording stops) ───────────────────
    const [showConfig, setShowConfig] = useState(false);
    const [pendingBlob, setPendingBlob] = useState(null);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [questionCount, setQuestionCount] = useState(5);
    const [difficulty, setDifficulty] = useState('Medium');

    const mediaRecorderRef = useRef(null);
    const audioChunksRef   = useRef([]);
    const chunkIndexRef    = useRef(0);
    const timerWorkerRef   = useRef(null);
    const currentSessionIdRef = useRef(null);

    // ── Inline polling state ──────────────────────────────────────────────────
    const [polling, setPolling]       = useState(false);
    const [stage, setStage]           = useState(0);
    const [stageLabel, setStageLabel] = useState('Transcribing Audio');
    const [elapsed, setElapsed]       = useState(0);
    const pollIntervalRef = useRef(null);
    const startTimeRef    = useRef(null);
    const elapsedRef      = useRef(null);

    const stopPolling = useCallback(() => {
        clearInterval(pollIntervalRef.current);
        clearInterval(elapsedRef.current);
        setPolling(false);
    }, []);

    const startPolling = useCallback((taskId, { onComplete, onError } = {}) => {
        setPolling(true);
        setStage(0);
        setStageLabel('Transcribing Audio');
        setElapsed(0);
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
                    if (result.questions && Array.isArray(result.questions)) {
                        result.questions = result.questions.map((q) => {
                            let opts = q.options;
                            if (!Array.isArray(opts)) {
                                if (opts && typeof opts === 'object') {
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
                            
                            let correctVal = q.correctAnswer || q.correct_answer || q.correct_ans || '';
                            if (correctVal === 'A' || correctVal === 'B' || correctVal === 'C' || correctVal === 'D') {
                                const idx = correctVal.charCodeAt(0) - 65;
                                correctVal = cleanOpts[idx] || '';
                            }
                            
                            return {
                                ...q,
                                question: q.question || q.questionText || '',
                                options: cleanOpts,
                                correctAnswer: correctVal,
                                explanation: q.explanation || '',
                            };
                        });
                    }
                    if (currentSessionIdRef.current) {
                        await markSessionCompleted(currentSessionIdRef.current);
                        await deleteSessionRecord(currentSessionIdRef.current);
                    }
                    onComplete(result);
                } else if (status === 'FAILED' || status === 'EXPIRED') {
                    stopPolling();
                    if (onError) onError(e || 'Audio processing failed.');
                }
            } catch (err) {
                console.warn('Polling error:', err);
            }
        };

        doPoll();
        pollIntervalRef.current = setInterval(doPoll, 1500);
    }, [stopPolling]);

    const isProcessing = uploading || polling;
    const displayError = error;

    // Listen to network state
    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
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

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            setError(null);

            const newSessionId = `live_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            currentSessionIdRef.current = newSessionId;
            setCurrentSessionId(newSessionId);
            chunkIndexRef.current = 0;

            await createSessionRecord(newSessionId, { title: 'Live Lecture Recording' });

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

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType,
                audioBitsPerSecond: 32000 // Low memory speech compression
            });

            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current   = [];

            mediaRecorder.ondataavailable = async (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                    const cIndex = chunkIndexRef.current++;
                    await saveAudioChunk({
                        sessionId: newSessionId,
                        chunkIndex: cIndex,
                        blobData: event.data,
                        timestamp: Date.now()
                    });
                }
            };

            mediaRecorder.onstop = handleStop;

            // Background Tab Resilient Web Worker Timer
            const worker = createTimerWorker();
            timerWorkerRef.current = worker;
            worker.onmessage = (e) => {
                if (e.data.type === 'tick') {
                    setRecordingTime(e.data.seconds);
                }
            };
            worker.postMessage({ command: 'start', seconds: 0 });

            mediaRecorder.start(10000); // 10-second chunking
            setIsRecording(true);
            setIsPaused(false);
            setRecordingTime(0);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            setError('Microphone access denied. Please check your browser permissions.');
        }
    };

    const pauseRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.pause();
            if (timerWorkerRef.current) timerWorkerRef.current.postMessage({ command: 'pause' });
            setIsPaused(true);
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.resume();
            if (timerWorkerRef.current) timerWorkerRef.current.postMessage({ command: 'resume' });
            setIsPaused(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            if (timerWorkerRef.current) {
                timerWorkerRef.current.postMessage({ command: 'stop' });
                timerWorkerRef.current.terminate();
                timerWorkerRef.current = null;
            }
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
        }
    };

    const handleStop = async () => {
        const sessionId = currentSessionIdRef.current;
        const audioBlob = await reconstructSessionBlob(sessionId, 'audio/webm');
        
        if (!audioBlob || audioBlob.size < 1000) {
            setError('Recording too short. Please speak for at least a few seconds.');
            if (sessionId) await deleteSessionRecord(sessionId);
            return;
        }
        
        setPendingBlob(audioBlob);
        setShowConfig(true);
    };

    const handleConfigConfirm = () => {
        if (!pendingBlob) return;
        setShowConfig(false);
        processAudio(pendingBlob);
    };

    const handleConfigCancel = () => {
        setShowConfig(false);
        setPendingBlob(null);
        if (currentSessionIdRef.current) {
            deleteSessionRecord(currentSessionIdRef.current);
        }
    };

    const processAudio = async (blob) => {
        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', blob, 'live_lesson.webm');
            formData.append('questionCount', questionCount.toString());
            formData.append('difficulty', difficulty);

            const res = await api.post('/quiz/generate-voice', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 300000, // 5 minutes timeout for 4-hour recordings
            });

            const { taskId } = res.data;
            if (!taskId) throw new Error('No taskId returned from server');

            setUploading(false);

            startPolling(taskId, {
                onComplete: (result) => {
                    if (result.questions && result.questions.length > 0) {
                        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        onQuestionsLoaded(result.questions, result.title || `Recording (${timeStr})`, result.agentReport);
                    } else {
                        setError('No questions were generated from the recording. Please try speaking for longer.');
                    }
                },
                onError: (msg) => {
                    setError(msg || 'Failed to generate quiz from recording.');
                },
            });
        } catch (err) {
            console.error('Error uploading voice:', err);
            setUploading(false);
            const msg = err.response?.data?.message || err.message || 'Failed to send audio to server.';
            setError(msg);
        }
    };

    const handleRecoverSession = async (sess) => {
        try {
            const blob = await reconstructSessionBlob(sess.sessionId);
            if (blob && blob.size >= 1000) {
                currentSessionIdRef.current = sess.sessionId;
                setPendingBlob(blob);
                setShowConfig(true);
                setPendingRecoverySessions(prev => prev.filter(s => s.sessionId !== sess.sessionId));
            } else {
                await deleteSessionRecord(sess.sessionId);
                setPendingRecoverySessions(prev => prev.filter(s => s.sessionId !== sess.sessionId));
            }
        } catch (e) {
            console.error('Failed crash recovery:', e);
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
            {/* Ambient Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                        <Mic size={22} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-100 tracking-tight">Live Class Voice Recorder</h2>
                        <p className="text-xs text-slate-400 font-medium">Memory-safe 4h background recording & offline resilience</p>
                    </div>
                </div>

                {isOffline && (
                    <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                        <WifiOff size={12} /> Offline - Recording saved locally
                    </span>
                )}
            </div>

            {/* Crash Recovery Notification */}
            {pendingRecoverySessions.length > 0 && (
                <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <RefreshCw className="text-amber-400 animate-spin" size={18} />
                        <span className="text-xs font-bold text-amber-200">Unsaved Recording Session Found</span>
                    </div>
                    {pendingRecoverySessions.map(sess => (
                        <button
                            key={sess.sessionId}
                            type="button"
                            onClick={() => handleRecoverSession(sess)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase rounded-lg transition-all"
                        >
                            Recover Session
                        </button>
                    ))}
                </div>
            )}

            {/* Pipeline Loader Overlay */}
            {isProcessing ? (
                <div className="py-8">
                    <AgentPipelineLoader 
                        stage={stage} 
                        stageLabel={stageLabel} 
                        elapsed={elapsed} 
                        isVoice={true} 
                    />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Error Banner */}
                    {displayError && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3 text-red-400 text-sm">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <div className="flex-1 font-medium">{displayError}</div>
                            <button 
                                onClick={() => setError(null)}
                                className="text-slate-400 hover:text-slate-200"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {/* Recording Display & Controls */}
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col items-center justify-center space-y-4">
                        {isRecording ? (
                            <>
                                <div className="flex items-center gap-3">
                                    <span className="relative flex h-4 w-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
                                    </span>
                                    <span className="font-mono text-3xl font-bold tracking-wider text-slate-100">
                                        {formatTime(recordingTime)}
                                    </span>
                                </div>

                                <p className="text-xs text-slate-400 font-medium">
                                    {isPaused ? 'Recording paused' : 'Recording in progress... (Chunks saved to IndexedDB)'}
                                </p>

                                <div className="flex items-center gap-3 pt-2">
                                    {isPaused ? (
                                        <button
                                            type="button"
                                            onClick={resumeRecording}
                                            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                                        >
                                            <Play size={16} /> Resume
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={pauseRecording}
                                            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                                        >
                                            <Pause size={16} /> Pause
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={stopRecording}
                                        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20 cursor-pointer"
                                    >
                                        <Square size={16} fill="currentColor" /> Stop & Generate Quiz
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="py-4 flex flex-col items-center gap-4">
                                <button
                                    type="button"
                                    onClick={startRecording}
                                    className="w-20 h-20 bg-gradient-to-tr from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 rounded-full flex items-center justify-center text-white shadow-xl shadow-purple-500/25 transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
                                >
                                    <Mic size={36} />
                                </button>
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-slate-200">Click to start recording your lecture</p>
                                    <p className="text-xs text-slate-400 mt-1">Supports 4-hour sessions, background tab switching & offline resilience</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Quiz Generation Configuration Modal */}
            {showConfig && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-md space-y-6 shadow-2xl relative">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Sparkles size={20} className="text-purple-400" />
                                Quiz Generation Settings
                            </h3>
                            <button
                                type="button"
                                onClick={handleConfigCancel}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Question Count */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Hash size={14} className="text-purple-400" /> Number of Questions: {questionCount}
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="30"
                                value={questionCount}
                                onChange={(e) => setQuestionCount(parseInt(e.target.value) || 5)}
                                className="w-full accent-purple-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                            />
                        </div>

                        {/* Difficulty */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <BarChart3 size={14} className="text-purple-400" /> Target Difficulty
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {['Balanced', 'Easy', 'Medium', 'Hard'].map((lvl) => (
                                    <button
                                        key={lvl}
                                        type="button"
                                        onClick={() => setDifficulty(lvl)}
                                        className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                                            difficulty === lvl
                                                ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/20'
                                                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-slate-200'
                                        }`}
                                    >
                                        {lvl}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={handleConfigCancel}
                                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
                            >
                                Discard Recording
                            </button>
                            <button
                                type="button"
                                onClick={handleConfigConfirm}
                                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all"
                            >
                                Generate MCQs
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
