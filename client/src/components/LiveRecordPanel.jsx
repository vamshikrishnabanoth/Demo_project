import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Pause, Play, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import api from '../utils/api';

export default function LiveRecordPanel({ onQuestionsLoaded, questionCount = 5, difficulty = 'Medium' }) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);

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
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
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
        
        processAudio(audioBlob);
    };

    const processAudio = async (blob) => {
        setProcessing(true);
        setError(null);
        
        try {
            const formData = new FormData();
            formData.append('file', blob, 'live_lesson.webm');
            formData.append('questionCount', questionCount.toString());
            formData.append('difficulty', difficulty);

            const res = await api.post('/quiz/generate-voice', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.questions && res.data.questions.length > 0) {
                onQuestionsLoaded(res.data.questions, res.data.title || 'Live Lesson Quiz');
            } else {
                throw new Error('No questions generated');
            }
        } catch (err) {
            console.error('Processing error:', err);
            setError(err.response?.data?.msg || 'Failed to process audio. Ensure you are speaking clearly.');
        } finally {
            setProcessing(false);
        }
    };

    return (
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
                        disabled={processing}
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

            {processing && (
                <div className="flex flex-col items-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-4">
                    <Loader2 className="animate-spin text-[#ff6b00]" size={40} />
                    <div className="space-y-1">
                        <p className="text-[#ff6b00] font-black text-sm uppercase tracking-widest flex items-center gap-2 justify-center">
                            <Sparkles size={16} /> AI is filtering & generating...
                        </p>
                        <p className="text-slate-500 text-xs font-bold uppercase">This takes about 10-15 seconds</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 p-5 rounded-2xl text-red-500 animate-in shake-in">
                    <AlertCircle size={20} />
                    <p className="text-xs font-black uppercase tracking-wider">{error}</p>
                </div>
            )}
        </div>
    );
}
