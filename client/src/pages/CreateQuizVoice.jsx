import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import LiveRecordPanel from '../components/LiveRecordPanel';
import { Mic, UploadCloud, FileAudio, CheckCircle, AlertCircle } from 'lucide-react';
import { uiTerminology } from '../utils/uiTerminology';
import api from '../utils/api';
import AgentPipelineLoader from '../components/loaders/AgentPipelineLoader';

export default function CreateQuizVoice() {
    const navigate = useNavigate();
    const [mode, setMode] = useState('record'); // 'record' | 'upload'
    
    // File upload state
    const [audioFile, setAudioFile] = useState(null);
    const [questionCount, setQuestionCount] = useState(5);
    const [difficulty, setDifficulty] = useState('Medium');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);

    // Polling state for file upload
    const [polling, setPolling] = useState(false);
    const [stage, setStage] = useState(0);
    const [stageLabel, setStageLabel] = useState('Transcribing Audio');
    const [elapsed, setElapsed] = useState(0);

    const handleQuestionsLoaded = (questions, title, agentReport, lectureDepth) => {
        // Redirect to the editor with generated questions + full agent report
        navigate('/create-quiz/text', {
            state: {
                questions,
                title,
                duration:    10,
                source:      'generated',
                isVoice:     true,
                agentReport: agentReport || null,
                lectureDepth: lectureDepth || null,
            }
        });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAudioFile(file);
            setError(null);
        }
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!audioFile) {
            setError('Please select an audio file to upload.');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', audioFile);
            formData.append('questionCount', questionCount.toString());
            formData.append('difficulty', difficulty);

            const res = await api.post('/quiz/generate-voice', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 300000,
            });

            const { taskId } = res.data;
            if (!taskId) throw new Error('No taskId returned from server');

            setUploading(false);
            setPolling(true);
            setStage(0);
            setStageLabel('Transcribing Audio');

            const startTime = Date.now();
            const elapsedTimer = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);

            const pollTimer = setInterval(async () => {
                try {
                    const statusRes = await api.get(`/quiz/generate/status/${taskId}`);
                    const { status, stage: s, stageLabel: sl, result, error: errMsg } = statusRes.data;
                    if (s !== undefined) setStage(s);
                    if (sl) setStageLabel(sl);

                    if (status === 'COMPLETED' && result) {
                        clearInterval(pollTimer);
                        clearInterval(elapsedTimer);
                        setPolling(false);
                        if (result.questions && result.questions.length > 0) {
                            handleQuestionsLoaded(result.questions, result.title || audioFile.name.replace(/\.[^/.]+$/, ''), result.agentReport, result.lectureDepth);
                        } else {
                            setError('No questions were generated from the recording. Please try an audio file with clearer speech.');
                        }
                    } else if (status === 'FAILED') {
                        clearInterval(pollTimer);
                        clearInterval(elapsedTimer);
                        setPolling(false);
                        setError(errMsg || 'Failed to generate quiz from audio file.');
                    }
                } catch (pollErr) {
                    console.warn('Polling error:', pollErr.message);
                }
            }, 2000);
        } catch (err) {
            console.error('Audio upload error:', err);
            setUploading(false);
            setError(err.response?.data?.message || err.response?.data?.msg || err.message || 'Failed to upload audio file.');
        }
    };

    return (
        <DashboardLayout role="teacher">
            {polling && (
                <AgentPipelineLoader
                    stage={stage}
                    stageLabel={stageLabel}
                    elapsed={elapsed}
                />
            )}
            <div className="max-w-4xl mx-auto pb-20 relative">
                {/* Glowing background element for voice */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--bg-accent-glow)] rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse"></div>

                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tight italic uppercase">
                            <span className="text-[var(--bg-accent)]">{uiTerminology.creationMethods.audio.toUpperCase()}</span>
                        </h1>
                        <p className="text-[var(--text-secondary)] mt-2 font-bold uppercase tracking-wider text-sm italic">
                            Record live or upload your lecture recording to generate questions instantly
                        </p>
                    </div>

                    {/* Mode Toggle Tabs */}
                    <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1.5 self-start">
                        <button
                            type="button"
                            onClick={() => { setMode('record'); setError(null); }}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                                mode === 'record'
                                    ? 'bg-[var(--bg-accent)] text-white shadow-lg shadow-[var(--bg-accent)]/30'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Mic size={16} /> Live Record
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMode('upload'); setError(null); }}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                                mode === 'upload'
                                    ? 'bg-[var(--bg-accent)] text-white shadow-lg shadow-[var(--bg-accent)]/30'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <UploadCloud size={16} /> Upload Audio File
                        </button>
                    </div>
                </div>

                <div className="space-y-8">
                    {mode === 'record' ? (
                        <div className="bg-white/5 rounded-[3rem] border border-[var(--border-color)] p-12 ring-1 ring-white/5 relative overflow-hidden group shadow-2xl glass-panel">
                            <div className="relative z-10">
                                <LiveRecordPanel 
                                    onQuestionsLoaded={handleQuestionsLoaded} 
                                />
                            </div>
                            <Mic className="absolute -right-20 -bottom-20 opacity-[0.03] text-white group-hover:rotate-12 transition-transform duration-700 pointer-events-none" size={400} />
                        </div>
                    ) : (
                        <div className="bg-white/5 rounded-[3rem] border border-[var(--border-color)] p-12 ring-1 ring-white/5 relative overflow-hidden group shadow-2xl glass-panel">
                            <form onSubmit={handleUploadSubmit} className="relative z-10 space-y-8">
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tight uppercase italic mb-1">
                                        Upload Lecture Recording
                                    </h2>
                                    <p className="text-xs text-slate-400 font-medium">
                                        Supported formats: MP3, WAV, M4A, WEBM, OGG, AAC, FLAC (up to 500MB)
                                    </p>
                                </div>

                                {error && (
                                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3 text-red-300 text-sm">
                                        <AlertCircle size={18} className="shrink-0 text-red-400" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* File Drop Area */}
                                <div className="relative border-4 border-dashed border-[var(--border-color)] rounded-[2.5rem] hover:border-[var(--bg-accent)]/50 transition-all bg-white/5 group/upload">
                                    <input
                                        type="file"
                                        accept=".mp3,.wav,.m4a,.webm,.ogg,.aac,.flac,audio/*"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                    />
                                    <div className="p-16 flex flex-col items-center gap-4 text-center">
                                        {audioFile ? (
                                            <>
                                                <div className="bg-[var(--bg-accent)] p-5 rounded-[1.5rem] text-white shadow-xl shadow-[var(--bg-accent)]/30 animate-in zoom-in duration-200">
                                                    <FileAudio size={40} />
                                                </div>
                                                <div>
                                                    <p className="font-black text-xl text-white italic tracking-tight">{audioFile.name}</p>
                                                    <p className="text-slate-400 text-xs mt-1">{(audioFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for AI processing</p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="p-5 bg-white/5 rounded-[1.5rem] text-slate-400 group-hover/upload:text-[var(--bg-accent)] transition-colors">
                                                    <UploadCloud size={40} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white text-base">Click or drag & drop audio file here</p>
                                                    <p className="text-slate-500 text-xs mt-1">Lecture audio will be transcribed using Whisper AI</p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Question Count & Difficulty Controls */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                                            Questions to Generate
                                        </label>
                                        <select
                                            value={questionCount}
                                            onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                                            className="w-full bg-transparent border-none text-xl font-black text-white italic outline-none cursor-pointer"
                                        >
                                            <option value={3} className="text-black">3 Questions</option>
                                            <option value={5} className="text-black">5 Questions</option>
                                            <option value={10} className="text-black">10 Questions</option>
                                            <option value={15} className="text-black">15 Questions</option>
                                        </select>
                                    </div>

                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                                            Assessment Difficulty
                                        </label>
                                        <select
                                            value={difficulty}
                                            onChange={(e) => setDifficulty(e.target.value)}
                                            className="w-full bg-transparent border-none text-xl font-black text-white italic outline-none cursor-pointer"
                                        >
                                            <option value="Easy" className="text-black">Easy</option>
                                            <option value="Medium" className="text-black">Medium</option>
                                            <option value="Hard" className="text-black">Hard</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex justify-center pt-4">
                                    <button
                                        type="submit"
                                        disabled={uploading || polling || !audioFile}
                                        className="group flex items-center gap-4 bg-[var(--bg-accent)] text-white px-16 py-6 rounded-[2rem] hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xl font-black text-2xl italic uppercase tracking-tighter active:scale-95"
                                    >
                                        <CheckCircle size={28} />
                                        {uploading ? 'UPLOADING...' : 'GENERATE QUESTIONS'}
                                    </button>
                                </div>
                            </form>
                            <UploadCloud className="absolute -right-20 -bottom-20 opacity-[0.03] text-white group-hover:rotate-12 transition-transform duration-700 pointer-events-none" size={400} />
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}

