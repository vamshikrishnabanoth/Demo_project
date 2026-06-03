import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Pause, Play, AlertCircle, Hash, BarChart3, Sparkles, X } from 'lucide-react';
import api from '../utils/api';
import AgentPipelineLoader from './loaders/AgentPipelineLoader';

export default function LiveRecordPanel({ onQuestionsLoaded }) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);

    // ── Config modal state (shown after recording stops) ───────────────────
    const [showConfig, setShowConfig] = useState(false);
    const [pendingBlob, setPendingBlob] = useState(null);
    const [questionCount, setQuestionCount] = useState(5);
    const [difficulty, setDifficulty] = useState('Medium');

    const mediaRecorderRef = useRef(null);
    const audioChunksRef   = useRef([]);
    const timerRef         = useRef(null);

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
                    if (onComplete) onComplete(result);
                } else if (status === 'FAILED' || status === 'EXPIRED' || status === 'NOT_FOUND') {
                    stopPolling();
                    const msg = e || 'Generation failed. Please try again.';
                    if (onError) onError(msg);
                }
            } catch (err) {
                console.warn('[VoicePoller] poll error:', err.message);
            }
        };

        doPoll();
        pollIntervalRef.current = setInterval(doPoll, 1500);
    }, [stopPolling]);
    // ─────────────────────────────────────────────────────────────────────────

    const isProcessing = uploading || polling;
    const displayError = error;

    // Timer logic
    useEffect(() => {
        if (isRecording && !isPaused) {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isRecording, isPaused]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);

            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current   = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };
            mediaRecorder.onstop = handleStop;

            mediaRecorder.start();
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
            setIsPaused(true);
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
        }
    };

    const handleStop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 1000) {
            setError('Recording too short. Please speak for at least a few seconds.');
            return;
        }
        // Instead of processing immediately, save the blob and show config modal
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
                timeout: 300000, // 5 minutes — large audio files (e.g. 42-min lectures) need time to upload
            });

            const { taskId } = res.data;
            if (!taskId) throw new Error('No taskId returned from server');

            setUploading(false);

            startPolling(taskId, {
                onComplete: (result) => {
                    if (result.questions && result.questions.length > 0) {
                        onQuestionsLoaded(result.questions, result.title || 'Live Lesson Quiz', result.agentReport);
                    } else {
                        setError('No questions were generated. Please try again with a longer recording.');
                    }
                },
                onError: (msg) => {
                    setError(msg || 'Failed to process audio. Ensure you are speaking clearly.');
                },
            });
        } catch (err) {
            console.error('Processing error:', err);
            setUploading(false);
            setError(err.response?.data?.msg || 'Failed to process audio. Please try again.');
        }
    };

    // Show full-screen loader during pipeline
    if (isProcessing) {
        return (
            <AgentPipelineLoader
                stage={stage}
                stageLabel={stageLabel}
                elapsed={elapsed}
                isVoice={true}
            />
        );
    }

    const difficulties = [
        { value: 'Easy', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20 hover:border-green-500/50', activeBg: 'bg-green-500/20 border-green-400 shadow-green-500/20' },
        { value: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20 hover:border-yellow-500/50', activeBg: 'bg-yellow-500/20 border-yellow-400 shadow-yellow-500/20' },
        { value: 'Hard', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20 hover:border-red-500/50', activeBg: 'bg-red-500/20 border-red-400 shadow-red-500/20' },
    ];

    return (
        <>
            {/* ── Config Modal (shown after recording stops) ─────────────── */}
            {showConfig && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}>
                    <div
                        className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl relative"
                        style={{ animation: 'fadeInUp 0.3s ease-out' }}
                    >
                        {/* Close button */}
                        <button
                            onClick={handleConfigCancel}
                            className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                        >
                            <X size={18} />
                        </button>

                        {/* Header */}
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-accent)]/20 border border-[var(--bg-accent)]/30 flex items-center justify-center">
                                <Sparkles size={28} className="text-[var(--text-accent)]" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-[var(--text-primary)] italic uppercase tracking-tight">Configure</h2>
                                <p className="text-[10px] font-black text-[var(--text-accent)] uppercase tracking-widest">Quiz Generation</p>
                            </div>
                        </div>

                        {/* Recording info */}
                        <div className="bg-white/5 rounded-2xl p-4 mb-8 flex items-center gap-3 border border-white/5">
                            <Mic size={16} className="text-[var(--text-accent)]" />
                            <span className="text-sm font-bold text-[var(--text-secondary)]">
                                Recording captured: <span className="text-[var(--text-primary)]">{formatTime(recordingTime)}</span>
                            </span>
                        </div>

                        {/* Question Count */}
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Hash size={16} className="text-[var(--text-accent)]" />
                                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                                    Number of Questions
                                </label>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min="1"
                                    max="20"
                                    value={questionCount}
                                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                                    className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-[var(--bg-accent)]"
                                />
                                <div className="w-16 h-16 rounded-2xl bg-[var(--bg-accent)]/20 border border-[var(--bg-accent)]/30 flex items-center justify-center">
                                    <span className="text-2xl font-black text-[var(--text-accent)] italic">{questionCount}</span>
                                </div>
                            </div>
                        </div>

                        {/* Difficulty */}
                        <div className="mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <BarChart3 size={16} className="text-[var(--text-accent)]" />
                                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                                    Difficulty Level
                                </label>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {difficulties.map((d) => (
                                    <button
                                        key={d.value}
                                        onClick={() => setDifficulty(d.value)}
                                        className={`py-4 rounded-2xl border-2 font-black text-sm uppercase tracking-widest transition-all ${
                                            difficulty === d.value
                                                ? `${d.activeBg} ${d.color} shadow-lg`
                                                : `${d.bg} text-white/50`
                                        }`}
                                    >
                                        {d.value}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleConfigConfirm}
                            className="w-full flex items-center justify-center gap-3 bg-[var(--bg-accent)] hover:bg-[var(--bg-accent-hover)] text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-[var(--bg-accent)]/30"
                        >
                            <Sparkles size={18} />
                            Generate Quiz
                        </button>
                    </div>
                </div>
            )}

            {/* ── Recording UI ──────────────────────────────────────────── */}
            <div className="bg-white/5 rounded-[2.5rem] border border-white/10 p-12 text-center space-y-8 overflow-hidden relative group transition-all hover:border-[#ff6b00]/30 shadow-2xl">
                <div className="space-y-4">
                    <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                        {isRecording ? (isPaused ? 'Recording Paused' : 'Listening to Lesson...') : 'Live Class Mode'}
                    </h3>
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">
                        Record your lecture in real-time and let AI generate the quiz instantly.
                    </p>
                </div>

                {/* Visualizer / Pulse */}
                <div className="relative py-10 flex justify-center">
                    {isRecording && !isPaused && (
                        <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-20 pointer-events-none">
                            {[...Array(20)].map((_, i) => (
                                <div
                                    key={i}
                                    className="w-1 bg-[#ff6b00] rounded-full animate-pulse"
                                    style={{
                                        height: `${Math.random() * 100 + 20}%`,
                                        animationDelay: `${i * 0.1}s`,
                                        animationDuration: '0.8s'
                                    }}
                                ></div>
                            ))}
                        </div>
                    )}

                    <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 relative z-10
                        ${isRecording ? (isPaused ? 'bg-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.3)]' : 'bg-red-500 animate-pulse shadow-[0_0_50px_rgba(239,68,68,0.5)]') : 'bg-white/5 border-2 border-white/10 text-slate-500'}
                    `}>
                        {isRecording ? (
                            isPaused ? <Play size={48} className="text-white ml-2" /> : <Mic size={48} className="text-white" />
                        ) : (
                            <Mic size={48} />
                        )}
                    </div>
                </div>

                <div className="text-5xl font-black text-white tracking-tighter tabular-nums">
                    {formatTime(recordingTime)}
                </div>

                <div className="flex justify-center gap-4">
                    {!isRecording ? (
                        <button
                            onClick={startRecording}
                            className="flex items-center gap-3 px-10 py-5 bg-[#ff6b00] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-[#ff6b00]/20 hover:scale-105 active:scale-95 transition-all"
                        >
                            <Mic size={20} />
                            Start Recording
                        </button>
                    ) : (
                        <>
                            {isPaused ? (
                                <button
                                    onClick={resumeRecording}
                                    className="flex items-center gap-3 px-8 py-5 bg-green-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-green-500/20 hover:scale-105 transition-all"
                                >
                                    <Play size={20} />
                                    Resume
                                </button>
                            ) : (
                                <button
                                    onClick={pauseRecording}
                                    className="flex items-center gap-3 px-8 py-5 bg-yellow-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-yellow-500/20 hover:scale-105 transition-all"
                                >
                                    <Pause size={20} />
                                    Pause
                                </button>
                            )}
                            <button
                                onClick={stopRecording}
                                className="flex items-center gap-3 px-8 py-5 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-500/20 hover:scale-105 transition-all"
                            >
                                <Square size={20} />
                                Stop & Generate
                            </button>
                        </>
                    )}
                </div>

                {displayError && (
                    <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 p-5 rounded-2xl text-red-500 animate-in fade-in">
                        <AlertCircle size={20} />
                        <p className="text-xs font-black uppercase tracking-wider">{displayError}</p>
                    </div>
                )}
            </div>

            {/* Animation keyframes */}
            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </>
    );
}
