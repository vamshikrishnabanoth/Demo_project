import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Mic, Upload, FileAudio, Square, Pause, Play, Sparkles, CheckCircle2, AlertCircle, 
  Clock, Users, BookOpen, HelpCircle, Layers, FileText, Download, Copy, RefreshCw, 
  Filter, ChevronDown, ChevronRight, ArrowRight, ShieldCheck, Cpu, Check, 
  Volume2, Info, Printer, Lightbulb, MessageSquareQuote, CheckSquare, BarChart2
} from 'lucide-react';
import api from '../utils/api';
import { 
  createSessionRecord, 
  saveAudioChunk, 
  reconstructSessionBlob, 
  getPendingSessions, 
  markSessionCompleted, 
  deleteSessionRecord 
} from '../utils/audioDB';
import { createTimerWorker } from '../utils/timerWorker';

export default function LectureAnalyzerPanel({ onQuestionsLoaded }) {
  // Input mode: 'record', 'upload', or 'text'
  const [inputMode, setInputMode] = useState('record');
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadFile, setUploadFile] = useState(null);
  const [rawTextTranscript, setRawTextTranscript] = useState('');
  
  // Processing & Polling state
  const [processing, setProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [stageLabel, setStageLabel] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [copiedNote, setCopiedNote] = useState(false);
  
  // Active Analysis Results
  const [analysisData, setAnalysisData] = useState(null);
  const [activeTab, setActiveTab] = useState('reconstructed'); // 'reconstructed', 'transcript', 'qa', 'notes', 'quiz'
  const [transcriptFilter, setTranscriptFilter] = useState('all'); // 'all', 'lecture', 'questions', 'clarifications', 'excluded'
  const [showOnlyCleaned, setShowOnlyCleaned] = useState(true);
  const [expandedConceptIdx, setExpandedConceptIdx] = useState(0);

  // Quiz Generation from Lecture
  const [quizDifficulty, setQuizDifficulty] = useState('Medium');
  const [quizCount, setQuizCount] = useState(5);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizGenStage, setQuizGenStage] = useState('');

  // Refs
  const mediaRecorderRef = useRef(null);
  const chunkIndexRef = useRef(0);
  const timerWorkerRef = useRef(null);
  const currentSessionIdRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const elapsedRef = useRef(null);
  const fileInputRef = useRef(null);

  // Stop polling helper
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    setProcessing(false);
  }, []);

  // Format seconds to mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Clean up workers on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      if (timerWorkerRef.current) {
        timerWorkerRef.current.postMessage({ command: 'stop' });
        timerWorkerRef.current.terminate();
      }
    };
  }, [stopPolling]);

  // ── 1. Recording Handlers (4-Hour Memory Safe) ──────────────────────────────
  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const sessionId = `lecture_rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      currentSessionIdRef.current = sessionId;
      chunkIndexRef.current = 0;

      await createSessionRecord(sessionId, { name: 'Live Lecture Recording' });

      // Initialize Worker for background time tracking
      const worker = createTimerWorker();
      timerWorkerRef.current = worker;
      worker.onmessage = (e) => {
        if (e.data.type === 'tick') setRecordingTime(e.data.seconds);
      };
      worker.postMessage({ command: 'start', seconds: 0 });

      // Supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0 && currentSessionIdRef.current) {
          const idx = chunkIndexRef.current++;
          await saveAudioChunk(currentSessionIdRef.current, idx, e.data);
        }
      };

      // 3-second chunk interval for memory safety
      mediaRecorder.start(3000);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
    } catch (err) {
      console.error('Microphone error:', err);
      setError('Could not access microphone. Please ensure microphone permissions are granted.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerWorkerRef.current) timerWorkerRef.current.postMessage({ command: 'pause' });
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      if (timerWorkerRef.current) timerWorkerRef.current.postMessage({ command: 'resume' });
    }
  };

  const stopRecordingAndAnalyze = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (timerWorkerRef.current) {
      timerWorkerRef.current.postMessage({ command: 'stop' });
      timerWorkerRef.current.terminate();
      timerWorkerRef.current = null;
    }

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    setIsRecording(false);
    setIsPaused(false);

    // Short buffer for final chunk write
    await new Promise((r) => setTimeout(r, 600));

    const sessionId = currentSessionIdRef.current;
    const audioBlob = await reconstructSessionBlob(sessionId, 'audio/webm');

    if (!audioBlob || audioBlob.size < 1000) {
      setError('Recording too short. Please speak or record for at least 5 seconds.');
      if (sessionId) await deleteSessionRecord(sessionId);
      return;
    }

    processLectureAudio(audioBlob);
  };

  // ── 2. Processing & Polling Pipeline ─────────────────────────────────────────
  const processLectureAudio = async (audioBlobOrFile) => {
    setProcessing(true);
    setError(null);
    setCurrentStage(0);
    setStageLabel('Uploading & Inspecting Lecture Audio');
    setElapsed(0);

    startTimeRef.current = Date.now();
    elapsedRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    try {
      const formData = new FormData();
      if (audioBlobOrFile instanceof Blob || audioBlobOrFile instanceof File) {
        formData.append('file', audioBlobOrFile, 'lecture_recording.webm');
      }

      const res = await api.post('/quiz/analyze-lecture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
      });

      const { taskId } = res.data;
      if (!taskId) throw new Error('No taskId returned from server');

      pollAnalysisStatus(taskId);
    } catch (err) {
      console.error('Lecture analysis submission error:', err);
      stopPolling();
      const msg = err.response?.data?.msg || err.message || 'Failed to submit lecture recording.';
      setError(msg);
    }
  };

  const processLectureText = async () => {
    if (!rawTextTranscript || rawTextTranscript.trim().length < 20) {
      setError('Please paste a lecture transcript of at least 20 characters.');
      return;
    }

    setProcessing(true);
    setError(null);
    setCurrentStage(0);
    setStageLabel('Classifying Transcript & Reconstructing Lecture');
    setElapsed(0);

    startTimeRef.current = Date.now();
    elapsedRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    try {
      const res = await api.post('/quiz/analyze-lecture', {
        text: rawTextTranscript,
      });

      const { taskId } = res.data;
      if (!taskId) throw new Error('No taskId returned from server');

      pollAnalysisStatus(taskId);
    } catch (err) {
      console.error('Transcript submission error:', err);
      stopPolling();
      const msg = err.response?.data?.msg || err.message || 'Failed to analyze transcript.';
      setError(msg);
    }
  };

  const pollAnalysisStatus = (taskId) => {
    const doPoll = async () => {
      try {
        const res = await api.get(`/quiz/lecture-analysis/${taskId}`);
        const { status, stage, stageLabel: sLabel, result, error: e } = res.data;

        if (stage !== undefined) setCurrentStage(stage);
        if (sLabel) setStageLabel(sLabel);

        if (status === 'COMPLETED' && result) {
          stopPolling();
          setAnalysisData(result.analysis);
          setActiveTab('reconstructed');
          if (currentSessionIdRef.current) {
            await markSessionCompleted(currentSessionIdRef.current);
            await deleteSessionRecord(currentSessionIdRef.current);
          }
        } else if (status === 'FAILED' || status === 'EXPIRED') {
          stopPolling();
          setError(e || 'Lecture analysis failed. Please try again.');
        }
      } catch (pollErr) {
        console.warn('Analysis polling warning:', pollErr);
      }
    };

    doPoll();
    pollIntervalRef.current = setInterval(doPoll, 1800);
  };

  // ── 3. Quiz Generation from Cleaned Lecture ───────────────────────────────────
  const handleGenerateQuizFromLecture = async () => {
    if (!analysisData) return;
    setGeneratingQuiz(true);
    setError(null);
    setQuizGenStage('Drafting assessment questions from cleaned lecture...');

    try {
      const payload = {
        cleanedTranscript: analysisData.cleaned_transcript,
        concepts: analysisData.pedagogical_reconstruction?.concepts || [],
        title: analysisData.pedagogical_reconstruction?.main_topic || 'Lecture Assessment',
        questionCount: quizCount,
        difficulty: quizDifficulty,
      };

      const res = await api.post('/quiz/generate-from-lecture', payload);
      const { taskId } = res.data;

      // Poll quiz generation task
      const quizPoll = setInterval(async () => {
        try {
          const statusRes = await api.get(`/quiz/generate/status/${taskId}`);
          const { status, stageLabel: sl, result, error: qErr } = statusRes.data;
          if (sl) setQuizGenStage(sl);

          if (status === 'COMPLETED' && result) {
            clearInterval(quizPoll);
            setGeneratingQuiz(false);
            if (onQuestionsLoaded && result.questions) {
              onQuestionsLoaded(
                result.questions,
                result.title || analysisData.pedagogical_reconstruction?.main_topic || 'Lecture Quiz',
                result.agentReport
              );
            }
          } else if (status === 'FAILED') {
            clearInterval(quizPoll);
            setGeneratingQuiz(false);
            setError(qErr || 'Failed to generate quiz from lecture.');
          }
        } catch (e) {
          console.warn('Quiz poll error:', e);
        }
      }, 1500);
    } catch (err) {
      setGeneratingQuiz(false);
      setError(err.response?.data?.msg || err.message || 'Quiz generation failed.');
    }
  };

  // ── 4. Export & Copy Handlers ────────────────────────────────────────────────
  const copyRevisionNotes = () => {
    if (!analysisData?.pedagogical_reconstruction?.revision_notes) return;
    const notes = analysisData.pedagogical_reconstruction.revision_notes;
    const text = notes.map(n => `### ${n.heading}\n${n.bullet_points.map(b => `- ${b}`).join('\n')}\n${n.key_formula_or_rule ? `> ${n.key_formula_or_rule}` : ''}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopiedNote(true);
    setTimeout(() => setCopiedNote(false), 2500);
  };

  const downloadMarkdownNotes = () => {
    if (!analysisData) return;
    const recon = analysisData.pedagogical_reconstruction;
    const mdContent = `# Lecture Study Guide: ${recon.main_topic || 'Lecture Notes'}
**Duration**: ${analysisData.inspection?.duration_formatted || 'N/A'} | **Academic Purity**: ${analysisData.statistics?.academic_purity_percentage || 100}%

## 1. Learning Objectives & Core Problem
- **Objective**: ${recon.learning_objective || 'N/A'}
- **Core Motivation**: ${recon.core_problem_and_motivation || 'N/A'}

## 2. Reconstructed Pedagogical Sequence
${(recon.logical_learning_flow || []).map(s => `${s.step}. **${s.phase}**: ${s.title} (${s.timestamp})\n   ${s.description}`).join('\n')}

## 3. Deep Concept Explanations
${(recon.concepts || []).map(c => `### ${c.concept_name}
- **Definition**: ${c.definition}
- **Why Needed**: ${c.why_needed}
- **Lecturer Example**: ${c.lecturers_example?.text || 'N/A'} [${c.lecturers_example?.timestamp || ''}]
- **Intuitive Analogy**: ${c.simpler_intuitive_example || 'N/A'}
- **Key Exam Takeaway**: ${c.key_takeaway || 'N/A'}
- **Common Pitfall**: ${c.common_confusion || 'N/A'}`).join('\n\n')}

## 4. Student Questions & Clarifications
${(recon.student_qa_register || []).map(q => `- **[${q.timestamp}] Student Question**: ${q.question}\n  **Teacher Answer**: ${q.answer}`).join('\n\n')}

## 5. Revision Notes
${(recon.revision_notes || []).map(n => `### ${n.heading}\n${n.bullet_points.map(b => `- ${b}`).join('\n')}\n${n.key_formula_or_rule ? `> ${n.key_formula_or_rule}` : ''}`).join('\n\n')}

## 6. Cleaned Academic Transcript
\`\`\`
${analysisData.cleaned_transcript || ''}
\`\`\`
`;

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(recon.main_topic || 'lecture_study_guide').replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered segments for Transcript tab
  const getFilteredSegments = () => {
    if (!analysisData?.segment_classifications) return [];
    const segs = analysisData.segment_classifications;
    if (transcriptFilter === 'lecture') return segs.filter(s => s.category === 'actual_lecture');
    if (transcriptFilter === 'questions') return segs.filter(s => s.category === 'student_question');
    if (transcriptFilter === 'clarifications') return segs.filter(s => s.category === 'teacher_clarification');
    if (transcriptFilter === 'excluded') return segs.filter(s => !s.keep_in_clean_transcript);
    return segs;
  };

  // Pipeline stages metadata
  const STAGES = [
    { label: 'Audio Ingestion & Time-Alignment', desc: 'Whisper neural transcription preserving timestamp boundaries', icon: <Volume2 className="w-5 h-5" /> },
    { label: '8-Class Segment Classification', desc: 'Classifying lecture, student questions, and non-academic chatter', icon: <Filter className="w-5 h-5" /> },
    { label: 'Non-Academic Filtering', desc: 'Removing greetings, jokes, and classroom management', icon: <ShieldCheck className="w-5 h-5" /> },
    { label: 'Pedagogical Lecture Reconstruction', desc: 'Structuring sequence, concept deep-dives & source attribution', icon: <BookOpen className="w-5 h-5" /> },
  ];

  return (
    <div className="w-full text-slate-100 font-sans">
      {/* ── ERROR DISPLAY ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
          <div className="flex-1 text-sm leading-relaxed">{error}</div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">×</button>
        </div>
      )}

      {/* ── PROCESSING SCREEN ─────────────────────────────────────────────────── */}
      {processing && (
        <div className="p-8 rounded-3xl bg-slate-900/90 border border-purple-500/20 backdrop-blur-xl shadow-2xl relative overflow-hidden text-center space-y-6">
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-purple-600/20 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>

          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/30 animate-pulse">
            <Cpu className="w-10 h-10 text-white animate-spin" style={{ animationDuration: '8s' }} />
          </div>

          <div>
            <h3 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-indigo-200 to-white">
              Two-Task Lecture Understanding Engine
            </h3>
            <p className="text-purple-300/80 text-sm mt-1 font-medium">{stageLabel || 'Executing AI Pipeline…'}</p>
            <p className="text-slate-400 text-xs mt-1">Elapsed Time: {formatTime(elapsed)}</p>
          </div>

          {/* Stepper */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 max-w-3xl mx-auto pt-4 text-left">
            {STAGES.map((stg, i) => {
              const isDone = currentStage > i;
              const isCurrent = currentStage === i;
              return (
                <div 
                  key={i} 
                  className={`p-3.5 rounded-2xl border transition-all duration-300 ${
                    isDone 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                      : isCurrent 
                        ? 'bg-purple-500/15 border-purple-500/50 text-purple-200 ring-1 ring-purple-500/30 shadow-lg shadow-purple-500/10'
                        : 'bg-white/5 border-white/5 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span>{stg.icon}</span>
                    {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {isCurrent && <div className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />}
                  </div>
                  <div className="text-xs font-bold">{stg.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-tight">{stg.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── INPUT SELECTION (Shown when not processing & no analysis yet) ──────── */}
      {!processing && !analysisData && (
        <div className="space-y-6">
          {/* Mode Switcher Tabs */}
          <div className="flex p-1.5 rounded-2xl bg-white/5 border border-white/10 max-w-md mx-auto">
            <button
              onClick={() => setInputMode('record')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                inputMode === 'record'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mic className="w-4 h-4" /> Live Lecture Recorder
            </button>
            <button
              onClick={() => setInputMode('upload')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                inputMode === 'upload'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileAudio className="w-4 h-4" /> Upload Audio File
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                inputMode === 'text'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" /> Paste Transcript
            </button>
          </div>

          {/* Mode 1: Live Lecture Audio Recorder */}
          {inputMode === 'record' && (
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-md text-center space-y-6">
              <div className="max-w-md mx-auto">
                <div className="text-4xl font-mono font-bold tracking-wider text-slate-100 mb-2">
                  {formatTime(recordingTime)}
                </div>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
                  {isRecording ? (isPaused ? 'Recording Paused' : 'Listening to Lecture…') : 'Ready to record live lecture'}
                </p>
              </div>

              {/* Animated Visualizer Circle */}
              <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                {isRecording && !isPaused && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                    <div className="absolute inset-2 rounded-full bg-indigo-500/30 animate-pulse" />
                  </>
                )}
                <div className={`w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${
                  isRecording 
                    ? isPaused 
                      ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-300' 
                      : 'bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-purple-500/40' 
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:text-purple-300 hover:border-purple-500/40'
                }`}>
                  <Mic className={`w-12 h-12 ${isRecording && !isPaused ? 'animate-bounce' : ''}`} />
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4 pt-2">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="py-3 px-8 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Mic className="w-4 h-4" /> Start Lecture Recording
                  </button>
                ) : (
                  <>
                    <button
                      onClick={isPaused ? resumeRecording : pauseRecording}
                      className="py-3 px-6 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-sm border border-white/10 flex items-center gap-2 transition-all"
                    >
                      {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
                      {isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      onClick={stopRecordingAndAnalyze}
                      className="py-3 px-8 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
                    >
                      <Square className="w-4 h-4 fill-white" /> Stop & Understand Lecture
                    </button>
                  </>
                )}
              </div>

              <div className="text-[11px] text-slate-400 max-w-md mx-auto pt-2">
                🛡️ <strong>4-Hour Memory Safe & Offline Resilient</strong>: Audio is streamed to local IndexedDB every 3 seconds to protect against browser crashes and tab switching.
              </div>
            </div>
          )}

          {/* Mode 2: Audio File Upload */}
          {inputMode === 'upload' && (
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-md text-center space-y-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setUploadFile(e.target.files[0]);
                  }
                }}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    setUploadFile(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-purple-500/30 hover:border-purple-500/60 rounded-3xl p-10 cursor-pointer bg-purple-500/5 hover:bg-purple-500/10 transition-all space-y-4 group"
              >
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 group-hover:bg-purple-500/20 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-300 transition-all">
                  <Upload className="w-8 h-8 group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-200">
                    {uploadFile ? uploadFile.name : 'Drag and drop your lecture recording here'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {uploadFile 
                      ? `${(uploadFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for AI analysis` 
                      : 'Supports MP3, WAV, M4A, WEBM, OGG (Up to 200MB / ~2.5 hours)'}
                  </p>
                </div>
                {!uploadFile && (
                  <button className="py-2 px-5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-semibold">
                    Browse Audio File
                  </button>
                )}
              </div>

              {uploadFile && (
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setUploadFile(null)}
                    className="py-2.5 px-5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold"
                  >
                    Choose Different File
                  </button>
                  <button
                    onClick={() => processLectureAudio(uploadFile)}
                    className="py-2.5 px-8 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" /> Start Lecture Understanding Pipeline
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mode 3: Paste Raw Transcript */}
          {inputMode === 'text' && (
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Raw Transcript or Classroom Notes
                </label>
                <span className="text-[11px] text-slate-400">Timestamps like [00:14:22] are automatically preserved</span>
              </div>
              <textarea
                value={rawTextTranscript}
                onChange={(e) => setRawTextTranscript(e.target.value)}
                placeholder="Example:&#10;00:00:10 - Teacher: Good morning everyone. Today we are discussing Binary Search Trees.&#10;00:01:25 - Student: Sir, is tomorrow a holiday?&#10;00:01:30 - Teacher: I don't know, check with office. So in a BST, every left child is smaller..."
                rows={8}
                className="w-full p-4 rounded-2xl bg-black/40 border border-white/10 text-slate-200 text-xs font-mono focus:outline-none focus:border-purple-500/60 transition-all"
              />
              <div className="flex justify-end">
                <button
                  onClick={processLectureText}
                  className="py-3 px-8 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Clean & Reconstruct Lecture
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ANALYSIS RESULTS STUDY SUITE ───────────────────────────────────────── */}
      {!processing && analysisData && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Header Summary Banner */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900/60 border border-purple-500/20 backdrop-blur-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Two-Task Analysis Complete
                  </span>
                  <span className="text-xs text-slate-400">• Duration: {analysisData.inspection?.duration_formatted || '00:00:00'}</span>
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  {analysisData.pedagogical_reconstruction?.main_topic || 'Analyzed Lecture'}
                </h2>
                <p className="text-xs text-slate-300 line-clamp-2 max-w-2xl">
                  {analysisData.pedagogical_reconstruction?.learning_objective || 'Core educational understanding and reconstructed pedagogical flow.'}
                </p>
              </div>

              {/* Stat Badges */}
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center min-w-[90px]">
                  <div className="text-lg font-black text-emerald-400">
                    {analysisData.statistics?.academic_purity_percentage || 100}%
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Purity</div>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center min-w-[90px]">
                  <div className="text-lg font-black text-purple-300">
                    {analysisData.statistics?.retained_academic_segments || 0}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Academic Segs</div>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center min-w-[90px]">
                  <div className="text-lg font-black text-amber-300">
                    {analysisData.statistics?.student_questions_count || 0}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Student Q&A</div>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-4 mt-4 border-t border-white/5 text-xs">
              <button
                onClick={copyRevisionNotes}
                className="py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center gap-1.5 transition-all"
              >
                {copiedNote ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedNote ? 'Copied Notes!' : 'Copy Summary'}
              </button>
              <button
                onClick={downloadMarkdownNotes}
                className="py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Download Study Guide (.md)
              </button>
              <button
                onClick={() => {
                  setAnalysisData(null);
                  setRawTextTranscript('');
                  setUploadFile(null);
                }}
                className="py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center gap-1.5 transition-all ml-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Analyze Another Recording
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/10">
            <button
              onClick={() => setActiveTab('reconstructed')}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'reconstructed'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <BookOpen className="w-4 h-4" /> 🎓 Reconstructed Lecture & Concepts
            </button>
            <button
              onClick={() => setActiveTab('transcript')}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'transcript'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Layers className="w-4 h-4" /> 🧹 Cleaned vs. Full Transcript
            </button>
            <button
              onClick={() => setActiveTab('qa')}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'qa'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <MessageSquareQuote className="w-4 h-4" /> ❓ Student Q&A ({analysisData.pedagogical_reconstruction?.student_qa_register?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'notes'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <FileText className="w-4 h-4" /> 📝 Revision Notes & Formulas
            </button>
            <button
              onClick={() => setActiveTab('quiz')}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'quiz'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
              }`}
            >
              <Sparkles className="w-4 h-4" /> 🎯 Generate Assessment
            </button>
          </div>

          {/* ── TAB 1: RECONSTRUCTED LECTURE & CONCEPTS ────────────────────────── */}
          {activeTab === 'reconstructed' && (
            <div className="space-y-6">
              {/* Pedagogical Motivation Box */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
                <div className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" /> Core Problem & Motivation
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {analysisData.pedagogical_reconstruction?.core_problem_and_motivation}
                </p>
              </div>

              {/* Logical Learning Sequence Timeline */}
              {analysisData.pedagogical_reconstruction?.logical_learning_flow?.length > 0 && (
                <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Compass className="w-4 h-4 text-purple-400" /> Optimal Pedagogical Flow
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {analysisData.pedagogical_reconstruction.logical_learning_flow.map((step, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1 relative">
                        <div className="flex items-center justify-between text-[10px] text-purple-300 font-bold">
                          <span>STEP {step.step || idx + 1}</span>
                          <span className="text-slate-400 font-mono">{step.timestamp}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-100">{step.title}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-3 leading-snug">{step.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Concept Deep-Dives with Source Attribution */}
              <div className="space-y-4">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-400" /> Concept Deep-Dives with Source Attribution
                  </span>
                  <span className="text-[11px] text-slate-400">
                    🟢 From Lecture • 🟡 Inferred • 🔵 Additional AI Note
                  </span>
                </div>

                <div className="space-y-3">
                  {(analysisData.pedagogical_reconstruction?.concepts || []).map((concept, cIdx) => {
                    const isExpanded = expandedConceptIdx === cIdx;
                    return (
                      <div 
                        key={cIdx} 
                        className="rounded-2xl bg-slate-900/70 border border-white/10 overflow-hidden transition-all"
                      >
                        <div 
                          onClick={() => setExpandedConceptIdx(isExpanded ? -1 : cIdx)}
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-300">
                              {cIdx + 1}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-100">{concept.concept_name}</h4>
                              <p className="text-xs text-slate-400 line-clamp-1">{concept.definition}</p>
                            </div>
                          </div>
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </div>

                        {isExpanded && (
                          <div className="p-6 pt-0 border-t border-white/5 space-y-4 text-xs">
                            {/* Definition & Why Needed */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
                              <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
                                <div className="font-bold text-purple-300">Formal Definition</div>
                                <div className="text-slate-300 leading-relaxed">{concept.definition}</div>
                              </div>
                              <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
                                <div className="font-bold text-indigo-300">Why It Is Needed</div>
                                <div className="text-slate-300 leading-relaxed">{concept.why_needed}</div>
                              </div>
                            </div>

                            {/* Examples */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-1">
                                <div className="font-bold text-purple-200 flex items-center justify-between">
                                  <span>Lecturer's Example</span>
                                  {concept.lecturers_example?.timestamp && (
                                    <span className="font-mono text-[10px] text-purple-300 bg-purple-500/30 px-1.5 py-0.5 rounded">
                                      {concept.lecturers_example.timestamp}
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-300">{concept.lecturers_example?.text || 'Standard lecture trace.'}</div>
                              </div>
                              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                                <div className="font-bold text-blue-200">Simpler Intuitive Analogy</div>
                                <div className="text-slate-300">{concept.simpler_intuitive_example || 'Concrete mental model.'}</div>
                              </div>
                            </div>

                            {/* Source Attribution Cards */}
                            {concept.source_attributions?.length > 0 && (
                              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                                <div className="font-bold text-slate-300 text-[11px]">Source Attribution Breakdown</div>
                                <div className="space-y-1.5">
                                  {concept.source_attributions.map((sa, sIdx) => {
                                    const isFromLecture = sa.type === 'from_lecture';
                                    const isInferred = sa.type === 'inferred';
                                    return (
                                      <div key={sIdx} className="flex items-start gap-2 text-[11px] leading-relaxed">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex-shrink-0 mt-0.5 ${
                                          isFromLecture
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                            : isInferred
                                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                        }`}>
                                          {isFromLecture ? `From Lecture ${sa.timestamp ? `[${sa.timestamp}]` : ''}` : isInferred ? 'Inferred' : 'AI Explanation'}
                                        </span>
                                        <span className="text-slate-300">{sa.text}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Takeaways and Pitfalls */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-slate-300">
                                <span className="font-bold text-emerald-300">Key Exam Takeaway: </span>
                                {concept.key_takeaway}
                              </div>
                              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-slate-300">
                                <span className="font-bold text-amber-300">Common Confusion: </span>
                                {concept.common_confusion}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: CLEANED VS FULL TRANSCRIPT ─────────────────────────────── */}
          {activeTab === 'transcript' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-white/10 text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setTranscriptFilter('all')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      transcriptFilter === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All Segments
                  </button>
                  <button
                    onClick={() => setTranscriptFilter('lecture')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      transcriptFilter === 'lecture' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🟢 Actual Lecture
                  </button>
                  <button
                    onClick={() => setTranscriptFilter('questions')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      transcriptFilter === 'questions' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🟣 Student Questions
                  </button>
                  <button
                    onClick={() => setTranscriptFilter('clarifications')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      transcriptFilter === 'clarifications' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🔵 Clarifications
                  </button>
                  <button
                    onClick={() => setTranscriptFilter('excluded')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      transcriptFilter === 'excluded' ? 'bg-red-600/80 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🔴 Excluded (Admin/Humor/Noise)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(analysisData.cleaned_transcript || '');
                      setCopiedNote(true);
                      setTimeout(() => setCopiedNote(false), 2000);
                    }}
                    className="py-1 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center gap-1 font-semibold"
                  >
                    {copiedNote ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    Copy Cleaned Transcript
                  </button>
                </div>
              </div>

              {/* Segment List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {getFilteredSegments().map((seg, sIdx) => {
                  const isKept = seg.keep_in_clean_transcript;
                  const cat = seg.category || 'actual_lecture';
                  return (
                    <div
                      key={sIdx}
                      className={`p-3 rounded-xl border text-xs leading-relaxed transition-all ${
                        isKept
                          ? cat === 'student_question'
                            ? 'bg-purple-950/20 border-purple-500/30 text-purple-200'
                            : cat === 'teacher_clarification'
                              ? 'bg-blue-950/20 border-blue-500/30 text-blue-200'
                              : 'bg-slate-900/60 border-white/5 text-slate-200'
                          : 'bg-red-950/10 border-red-500/20 text-slate-500 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-purple-300 font-bold">{seg.timestamp}</span>
                          <span className="font-bold text-slate-300">{seg.speaker}:</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          isKept
                            ? cat === 'student_question'
                              ? 'bg-purple-500/20 text-purple-300'
                              : cat === 'teacher_clarification'
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                          {isKept ? cat.replace('_', ' ') : `Excluded: ${seg.reason || 'Non-academic'}`}
                        </span>
                      </div>
                      <div className="pl-4 border-l border-white/10">{seg.original_text}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TAB 3: STUDENT Q&A REGISTER ──────────────────────────────────── */}
          {activeTab === 'qa' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400">
                Preserved student doubts and teacher clarifications extracted verbatim or summarized with exact lecture timestamps.
              </div>

              {(analysisData.pedagogical_reconstruction?.student_qa_register || []).length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-900/40 border border-white/10 text-center text-xs text-slate-400">
                  No active student questions were detected in this lecture recording.
                </div>
              ) : (
                <div className="space-y-3">
                  {analysisData.pedagogical_reconstruction.student_qa_register.map((qa, qIdx) => (
                    <div key={qIdx} className="p-5 rounded-2xl bg-slate-900/70 border border-purple-500/20 space-y-3 text-xs">
                      <div className="flex items-center justify-between text-purple-300 font-bold">
                        <span className="flex items-center gap-1.5">
                          <HelpCircle className="w-4 h-4 text-purple-400" /> Student Question #{qIdx + 1}
                        </span>
                        <span className="font-mono text-[10px] bg-purple-500/20 px-2 py-0.5 rounded text-purple-200">
                          {qa.timestamp}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-100 font-medium">
                        "{qa.question}"
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Teacher Clarification:
                        </div>
                        <div className="text-slate-300 pl-4 border-l-2 border-emerald-500/40 leading-relaxed">
                          {qa.answer}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 4: REVISION NOTES & FORMULAS ──────────────────────────────── */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">High-yield pedagogical revision bullet points & core formulas</span>
                <button
                  onClick={downloadMarkdownNotes}
                  className="py-1.5 px-3 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-semibold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Export Markdown (.md)
                </button>
              </div>

              <div className="space-y-4">
                {(analysisData.pedagogical_reconstruction?.revision_notes || []).map((note, nIdx) => (
                  <div key={nIdx} className="p-5 rounded-2xl bg-slate-900/70 border border-white/10 space-y-3 text-xs">
                    <h4 className="text-sm font-bold text-purple-300">{note.heading}</h4>
                    <ul className="space-y-1.5 text-slate-300 list-disc pl-5 leading-relaxed">
                      {note.bullet_points.map((bp, bIdx) => (
                        <li key={bIdx}>{bp}</li>
                      ))}
                    </ul>
                    {note.key_formula_or_rule && (
                      <div className="p-3 rounded-xl bg-black/40 border border-purple-500/30 text-purple-200 font-mono text-[11px]">
                        {note.key_formula_or_rule}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB 5: GENERATE ASSESSMENT ────────────────────────────────────── */}
          {activeTab === 'quiz' && (
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-emerald-500/30 space-y-6 text-center max-w-xl mx-auto">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-300 mb-3">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-white">Generate Assessment from Cleaned Lecture</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Creates exam-grade questions grounded strictly in the cleaned lecture concepts and teacher explanations.
                </p>
              </div>

              {generatingQuiz ? (
                <div className="p-6 rounded-2xl bg-black/40 border border-emerald-500/20 space-y-3">
                  <div className="w-8 h-8 mx-auto border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <div className="text-xs font-bold text-emerald-300">{quizGenStage}</div>
                  <div className="text-[10px] text-slate-400">Grounded exclusively on verified lecture evidence</div>
                </div>
              ) : (
                <div className="space-y-4 text-left text-xs">
                  {/* Difficulty Selector */}
                  <div>
                    <label className="font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Difficulty Level</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Easy', 'Medium', 'Hard'].map((diff) => (
                        <button
                          key={diff}
                          onClick={() => setQuizDifficulty(diff)}
                          className={`py-2 rounded-xl font-bold border transition-all text-center ${
                            quizDifficulty === diff
                              ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question Count */}
                  <div>
                    <label className="font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Number of Questions</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[5, 10, 15].map((cnt) => (
                        <button
                          key={cnt}
                          onClick={() => setQuizCount(cnt)}
                          className={`py-2 rounded-xl font-bold border transition-all text-center ${
                            quizCount === cnt
                              ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {cnt} Questions
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateQuizFromLecture}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Sparkles className="w-4 h-4" /> Generate Cleaned Lecture Assessment
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
