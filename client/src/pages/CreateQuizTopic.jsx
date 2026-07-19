import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { 
    Book, Hash, Gauge, Sparkles, Loader2, Database, Sliders, 
    FileText, Plus, Trash2, Mic, Play, Square, CheckCircle, 
    Award, Check, AlertCircle, HelpCircle, X, ChevronRight,
    PauseCircle, PlayCircle, StopCircle, Trash, CheckSquare
} from 'lucide-react';
import AgentPipelineLoader from '../components/loaders/AgentPipelineLoader';
import toast from 'react-hot-toast';

export default function CreateQuizTopic() {
    const [inputs, setInputs] = useState([]);
    const [textPrompt, setTextPrompt] = useState('');
    const [questionCount, setQuestionCount] = useState(5);
    const [difficulty, setDifficulty] = useState('Medium');
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    // Voice recording states
    const [recording, setRecording] = useState(false);
    const [recordingPaused, setRecordingPaused] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const audioChunksRef = useRef([]);
    const backgroundWorkerRef = useRef(null);
    const wakeLockRef = useRef(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [transcribing, setTranscribing] = useState(false);

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

    useEffect(() => {
        let interval = null;
        if (recording && !recordingPaused) {
            interval = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [recording, recordingPaused]);

    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
                console.log('🔒 System Wake Lock activated. Laptop will not sleep.');
            }
        } catch (err) {
            console.warn(`Failed to lock system power state: ${err.message}`);
        }
    };

    const releaseWakeLock = useCallback(() => {
        if (wakeLockRef.current !== null) {
            wakeLockRef.current.release()
                .then(() => {
                    wakeLockRef.current = null;
                    console.log('🔓 System Wake Lock released.');
                })
                .catch(err => {
                    console.error('Error releasing wake lock:', err);
                });
        }
    }, []);

    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
                try {
                    if ('wakeLock' in navigator) {
                        wakeLockRef.current = await navigator.wakeLock.request('screen');
                        console.log('🔒 System Wake Lock re-acquired.');
                    }
                } catch (err) {
                    console.warn(`Failed to re-acquire wake lock: ${err.message}`);
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (backgroundWorkerRef.current) {
                backgroundWorkerRef.current.terminate();
            }
            if (wakeLockRef.current) {
                wakeLockRef.current.release().catch(() => {});
            }
        };
    }, []);

    // Dropdown / Modal Input states
    const [showDropdown, setShowDropdown] = useState(false);
    const [showTextModal, setShowTextModal] = useState(false);
    const [textModalType, setTextModalType] = useState('context'); // 'context' | 'description'
    const [textInputContent, setTextInputContent] = useState('');

    // Wizard modal states
    const [showWizard, setShowWizard] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [ratiosModified, setRatiosModified] = useState(false);

    // Analysis states
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzedData, setAnalyzedData] = useState(null);
    const [topicWeights, setTopicWeights] = useState({});

    // Dynamic question flavor state (sums to 100)
    const [ratios, setRatios] = useState({
        CORE_THEORY: 20,
        ANALYTICAL_REASONING: 20,
        NUMERICAL_DESIGN: 20,
        REAL_WORLD_APPLICATION: 20,
        IMPLEMENTATION_SYNTHESIS: 20
    });
    const [aiBaselineRatios, setAiBaselineRatios] = useState(null);

    // Dynamic Branch UI Filter: check if course context is non-computational
    const isNonComputational = useMemo(() => {
        const keywords = ['mechanical', 'civil', 'chemical', 'structural', 'fluid', 'thermodynamic', 'material', 'drawing', 'concrete', 'machine', 'lab tracing', 'cad', 'optimiz', 'piping', 'construction', 'concrete', 'soil', 'geology', 'geotechnical', 'surveying'];
        const titleText = (analyzedData?.extractedTitle || '').toLowerCase();
        
        const names = inputs.map(inp => (inp.source_name || '').toLowerCase()).join(' ');
        const promptText = inputs.map(inp => (inp.content || '').toLowerCase()).join(' ');
        
        const combined = `${titleText} ${names} ${promptText}`;
        return keywords.some(kw => combined.includes(kw));
    }, [analyzedData, inputs, showWizard]);

    // ── Inline polling state ──────────────────────────────────────────────────
    const [polling, setPolling]       = useState(false);
    const [stage, setStage]           = useState(0);
    const [stageLabel, setStageLabel] = useState('Generating Questions');
    const [elapsed, setElapsed]       = useState(0);
    const [pollError, setPollError]   = useState(null);
    const pollIntervalRef = useRef(null);
    const startTimeRef    = useRef(null);
    const elapsedRef      = useRef(null);

    const fileInputRef = useRef(null);

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
                                questionText: q.questionText || q.prompt_text || q.question || '',
                                options: cleanOpts,
                                correctAnswer: correctVal,
                                concept_tag: q.concept_tag || q.sub_topic || result.title || 'Curriculum Concept',
                                points: q.points || 10
                            };
                        });
                    }
                    if (onComplete) onComplete(result);
                } else if (status === 'FAILED' || status === 'EXPIRED' || status === 'NOT_FOUND') {
                    stopPolling();
                    const msg = e || 'Generation failed. Please try again.';
                    setPollError(msg);
                    if (onError) onError(msg);
                }
            } catch (err) {
                console.warn('[Poller] poll error:', err.message);
            }
        };

        doPoll();
        pollIntervalRef.current = setInterval(doPoll, 1500);
    }, [stopPolling]);

    // Handle interconnected slider changes enforcing 100% total sum
    const handleSliderChange = (changedFlavor, newValue) => {
        const val = Math.min(100, Math.max(0, parseInt(newValue) || 0));
        
        // Zero-Out Safety Check: Calculate sum if this change goes through
        const potentialRatios = { ...ratios, [changedFlavor]: val };
        const potentialSum = Object.values(potentialRatios).reduce((s, v) => s + v, 0);
        if (potentialSum === 0) {
            // Prevent total lock-up state by returning early if all values would sum to 0%
            return;
        }

        const keys = ['CORE_THEORY', 'ANALYTICAL_REASONING', 'NUMERICAL_DESIGN', 'REAL_WORLD_APPLICATION', 'IMPLEMENTATION_SYNTHESIS'];
        const otherFlavors = keys.filter(f => f !== changedFlavor);
        const currentOthersSum = otherFlavors.reduce((sum, f) => sum + ratios[f], 0);
        const remaining = 100 - val;

        let newRatios = { ...ratios, [changedFlavor]: val };

        if (currentOthersSum === 0) {
            const equalShare = remaining / otherFlavors.length;
            otherFlavors.forEach(f => {
                newRatios[f] = equalShare;
            });
        } else {
            otherFlavors.forEach(f => {
                newRatios[f] = (ratios[f] / currentOthersSum) * remaining;
            });
        }

        let newRatiosInt = {};
        Object.keys(newRatios).forEach(k => {
            newRatiosInt[k] = Math.round(newRatios[k]);
        });

        let sum = Object.values(newRatiosInt).reduce((s, v) => s + v, 0);
        let diff = 100 - sum;

        if (diff !== 0) {
            const adjustKey = otherFlavors.sort((a, b) => newRatiosInt[b] - newRatiosInt[a])[0];
            newRatiosInt[adjustKey] = Math.max(0, newRatiosInt[adjustKey] + diff);
        }

        setRatios(newRatiosInt);
    };

    // Live Microphone Recording Logic
    const startRecording = async () => {
        try {
            // Reset timer duration and loader
            setRecordingDuration(0);
            setTranscribing(false);

            // 1. Activate Wake Lock
            await requestWakeLock();

            // 2. Initialize Web Worker thread
            backgroundWorkerRef.current = new Worker('/audioWorker.js');

            // 3. Request user microphone permissions
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // 4. Configure MediaRecorder
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunksRef.current = [];
            
            backgroundWorkerRef.current.postMessage({ type: 'START' });

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    // Send raw chunk to background worker instantly
                    backgroundWorkerRef.current?.postMessage({ type: 'DATA_AVAILABLE', data: e.data });
                }
            };

            // Handle voice compilation from worker
            backgroundWorkerRef.current.onmessage = async (e) => {
                if (e.data.type === 'RECORDING_COMPLETE') {
                    const blob = e.data.blob;
                    const formData = new FormData();
                    formData.append('file', blob, 'recording.webm');
                    
                    const toastId = toast.loading('Transcribing live voice recording...');
                    try {
                        let transcriptText = "";
                        let localOnline = false;

                        // Check if the local Python service is running directly on localhost
                        try {
                            const ping = await fetch('http://localhost:8000/', { mode: 'cors' });
                            if (ping.ok) localOnline = true;
                        } catch (_) {
                            localOnline = false;
                        }

                        if (localOnline) {
                            console.log('⚡ Local Python Service detected! Sending audio directly to localhost to avoid proxy timeouts...');
                            const localRes = await fetch('http://localhost:8000/transcribe', {
                                method: 'POST',
                                body: formData,
                                mode: 'cors'
                            });
                            
                            if (localRes.ok) {
                                const data = await localRes.json();
                                transcriptText = data.text || "";
                            } else {
                                throw new Error('Local service transcription error.');
                            }
                        } else {
                            console.log('☁️ Local service not found on localhost. Routing via Render cloud backend...');
                            const transcribeRes = await api.post('/quiz/transcribe', formData, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                            });
                            transcriptText = transcribeRes.data.text;
                        }

                        if (transcriptText && transcriptText.trim().length > 5) {
                            toast.success('Speech transcribed successfully!', { id: toastId });
                            setInputs(prev => [...prev, {
                                id: Math.random().toString(),
                                type: 'voice',
                                content: transcriptText,
                                source_name: `Voice Transcript (${new Date().toLocaleTimeString()})`
                            }]);
                            setAnalyzedData(null); // Reset analysis
                        } else {
                            toast.error('Could not capture clear speech. Please try speaking closer to the mic.', { id: toastId });
                        }
                    } catch (err) {
                        console.error('Transcription failed:', err);
                        toast.error('Failed to transcribe voice: ' + (err.response?.data?.msg || err.message), { id: toastId });
                    } finally {
                        setTranscribing(false); // SHUT TRANSCRIBING LOADER
                    }
                    
                    // Terminate the background worker when compile completes
                    if (backgroundWorkerRef.current) {
                        backgroundWorkerRef.current.terminate();
                        backgroundWorkerRef.current = null;
                    }
                }
            };

            recorder.start(1000); // Forces chunk updates every 1 second
            setMediaRecorder(recorder);
            setRecording(true);
            setRecordingPaused(false);
        } catch (err) {
            toast.error('Could not access microphone. Verify hardware permissions.');
            releaseWakeLock();
        }
    };

    const pauseRecording = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.pause();
            setRecordingPaused(true);
        }
    };

    const resumeRecording = () => {
        if (mediaRecorder && mediaRecorder.state === 'paused') {
            mediaRecorder.resume();
            setRecordingPaused(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorder) {
            setTranscribing(true); // START TRANSCRIBING LOADER
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            
            // Signal the Web Worker to stop and assemble the blob
            backgroundWorkerRef.current?.postMessage({ type: 'STOP' });

            // Release wake lock
            releaseWakeLock();

            setRecording(false);
            setRecordingPaused(false);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorder) {
            setTranscribing(false);
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());

            // Terminate background worker instantly
            if (backgroundWorkerRef.current) {
                backgroundWorkerRef.current.terminate();
                backgroundWorkerRef.current = null;
            }

            // Release wake lock
            releaseWakeLock();

            setRecording(false);
            setRecordingPaused(false);
            toast.success('Recording discarded.');
        }
    };

    // Add manual text prompts / descriptions
    const handleAddTextInput = () => {
        if (!textInputContent.trim()) return;
        setInputs(prev => [...prev, {
            id: Math.random().toString(),
            type: 'text',
            content: textInputContent,
            source_name: textModalType === 'description'
                ? `Description: "${textInputContent.substring(0, 20)}..."`
                : `Context: "${textInputContent.substring(0, 20)}..."`
        }]);
        setTextInputContent('');
        setShowTextModal(false);
        setAnalyzedData(null); // Reset analysis
    };

    // Add file uploads
    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const newInputs = files.map(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            return {
                id: Math.random().toString(),
                type: ['jpg', 'jpeg', 'png'].includes(ext) ? 'image' : ext,
                file: file,
                source_name: file.name,
                startPage: 1,
                endPage: 999
            };
        });

        setInputs(prev => [...prev, ...newInputs]);
        setAnalyzedData(null); // Reset analysis
        e.target.value = null; // reset file input
    };

    const handleRemoveInput = (id) => {
        setInputs(prev => prev.filter(inp => inp.id !== id));
        setAnalyzedData(null); // Reset analysis
    };

    // Trigger analysis + launch wizard modal flow
    const handleStartWizard = async () => {
        if (inputs.length === 0) return;
        if (!analyzedData) {
            setAnalyzing(true);
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
            formData.append('text_prompts', JSON.stringify(textInputs.map(t => t.content)));
            
            const toastId = toast.loading('Analyzing curriculum sources & computing token density...');
            try {
                const res = await api.post('/quiz/analyze-sources', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                
                toast.success('RAG Source analysis complete!', { id: toastId });
                setAnalyzedData(res.data);
                
                // Set default sliders from recommendations
                if (res.data.ai_recommendation) {
                    const rec = res.data.ai_recommendation;
                    const baseline = {
                        CORE_THEORY: Math.round((rec.CORE_THEORY || 0) * 100),
                        ANALYTICAL_REASONING: Math.round((rec.ANALYTICAL_REASONING || 0) * 100),
                        NUMERICAL_DESIGN: Math.round((rec.NUMERICAL_DESIGN || 0) * 100),
                        REAL_WORLD_APPLICATION: Math.round((rec.REAL_WORLD_APPLICATION || 0) * 100),
                        IMPLEMENTATION_SYNTHESIS: Math.round((rec.IMPLEMENTATION_SYNTHESIS || 0) * 100)
                    };
                    let sumRec = Object.values(baseline).reduce((s, v) => s + v, 0);
                    if (sumRec !== 100 && sumRec > 0) {
                        const keys = Object.keys(baseline);
                        const maxKey = keys.reduce((a, b) => baseline[a] > baseline[b] ? a : b);
                        baseline[maxKey] += (100 - sumRec);
                    } else if (sumRec === 0) {
                        baseline.CORE_THEORY = 20;
                        baseline.ANALYTICAL_REASONING = 20;
                        baseline.NUMERICAL_DESIGN = 20;
                        baseline.REAL_WORLD_APPLICATION = 20;
                        baseline.IMPLEMENTATION_SYNTHESIS = 20;
                    }
                    setAiBaselineRatios(baseline);
                    setRatios(baseline);
                } else {
                    const defaultBase = {
                        CORE_THEORY: 20,
                        ANALYTICAL_REASONING: 20,
                        NUMERICAL_DESIGN: 20,
                        REAL_WORLD_APPLICATION: 20,
                        IMPLEMENTATION_SYNTHESIS: 20
                    };
                    setAiBaselineRatios(defaultBase);
                    setRatios(defaultBase);
                }
                
                // Set topic weights matrix
                if (res.data.concepts) {
                    const initialWeights = {};
                    res.data.concepts.forEach(c => {
                        initialWeights[c.concept_tag] = c.weight_score;
                    });
                    setTopicWeights(initialWeights);
                }

                setShowWizard(true);
                setWizardStep(1);
            } catch (err) {
                console.error(err);
                const errMsg = err.response?.data?.message || err.response?.data?.msg || 'Academic analysis failed. Please verify your content.';
                toast.error(errMsg, { id: toastId });
            } finally {
                setAnalyzing(false);
            }
        } else {
            setShowWizard(true);
            setWizardStep(1);
        }
    };

    const handleTopicWeightChange = (concept, value) => {
        setTopicWeights(prev => ({
            ...prev,
            [concept]: parseFloat(value)
        }));
    };

    // Submit generation
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (inputs.length === 0) return;

        setSubmitting(true);
        
        const targetRatiosPayload = {
            CORE_THEORY: ratios.CORE_THEORY <= 0 ? 0 : parseFloat((ratios.CORE_THEORY / 100).toFixed(2)),
            ANALYTICAL_REASONING: ratios.ANALYTICAL_REASONING <= 0 ? 0 : parseFloat((ratios.ANALYTICAL_REASONING / 100).toFixed(2)),
            NUMERICAL_DESIGN: ratios.NUMERICAL_DESIGN <= 0 ? 0 : parseFloat((ratios.NUMERICAL_DESIGN / 100).toFixed(2)),
            REAL_WORLD_APPLICATION: ratios.REAL_WORLD_APPLICATION <= 0 ? 0 : parseFloat((ratios.REAL_WORLD_APPLICATION / 100).toFixed(2)),
            IMPLEMENTATION_SYNTHESIS: ratios.IMPLEMENTATION_SYNTHESIS <= 0 ? 0 : parseFloat((ratios.IMPLEMENTATION_SYNTHESIS / 100).toFixed(2))
        };

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
        formData.append('difficulty', difficulty);
        formData.append('target_ratios', JSON.stringify(targetRatiosPayload));
        formData.append('text_prompts', JSON.stringify(textInputs.map(t => t.content)));
        
        if (analyzedData) {
            formData.append('topic_weights', JSON.stringify(topicWeights));
            formData.append('lobby_summary', analyzedData.lobby_summary || '');
            formData.append('ai_flashcards', JSON.stringify(analyzedData.ai_flashcards || []));
            formData.append('isolated_narratives', JSON.stringify(analyzedData.isolated_narratives || []));
        }

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
                    navigate('/create-quiz/text', {
                        state: {
                            questions:       result.questions,
                            title:           result.title || `Curriculum Quiz: ${inputs[0]?.source_name}`,
                            duration:        result.duration || 10,
                            source:          'generated',
                            agentReport:     result.agentReport || null,
                            finalValidation: result.finalValidation || null,
                            lobbySummary:    result.lobbySummary || null,
                            aiFlashcards:    result.aiFlashcards || null
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

    const isLoading = submitting || polling;

    return (
        <DashboardLayout role="teacher">
            {isLoading && (
                <AgentPipelineLoader
                    stage={stage}
                    stageLabel={stageLabel}
                    elapsed={elapsed}
                    isVoice={false}
                />
            )}
            
            <div className="flex flex-col min-h-[calc(100vh-6.5rem)] w-full">
                
                {/* Header branding */}
                <div className="p-6 pb-2 border-b border-white/5 bg-slate-950/20">
                    <h1 className="text-3xl font-black text-white tracking-tight italic uppercase">
                        NotebookLM + Kahoot <span className="text-[var(--bg-accent)]">Workspace</span>
                    </h1>
                    <p className="text-[var(--text-secondary)] mt-1 font-bold uppercase tracking-wider text-[10px] italic">
                        Ingest curriculum documents, audio lectures, or text context to launch smart quizzes.
                    </p>
                </div>

                {pollError && (
                    <div className="mx-6 mt-4 px-5 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 font-bold text-xs uppercase tracking-wider">
                        ⚠ {pollError}
                    </div>
                )}

                {/* UPPER SPLIT SCREEN WORKSPACE */}
                <div className="flex flex-col lg:flex-row flex-grow w-full bg-slate-950/10">
                    
                    {/* LEFT PANEL: Ingestion Sidebar (25% or fixed width) */}
                    <div className="w-full lg:w-80 bg-slate-900/30 backdrop-blur-md border-r border-white/10 p-6 flex flex-col justify-between shrink-0 space-y-6">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between pb-3 border-b border-white/10">
                                <h2 className="text-sm font-black text-white uppercase italic">Active Sources</h2>
                                <span className="bg-white/10 text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase">
                                    {inputs.length} Sources
                                </span>
                            </div>

                            {/* Dropdown Add Input Selection */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowDropdown(!showDropdown)}
                                    className="w-full py-3 bg-[var(--bg-accent)] hover:bg-[var(--bg-accent-hover)] text-white rounded-xl font-black uppercase text-xs italic tracking-wider flex items-center justify-center gap-2 transition-all"
                                >
                                    <Plus size={16} /> Add Input
                                </button>
                                
                                {showDropdown && (
                                    <div className="absolute left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowDropdown(false);
                                                fileInputRef.current.click();
                                            }}
                                            className="w-full px-4 py-3 text-left text-xs font-black text-white hover:bg-white/5 uppercase transition-all flex items-center gap-2.5"
                                        >
                                            <FileText size={14} className="text-blue-400" /> Upload Document
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowDropdown(false);
                                                setTextModalType('description');
                                                setTextInputContent('');
                                                setShowTextModal(true);
                                            }}
                                            className="w-full px-4 py-3 text-left text-xs font-black text-white hover:bg-white/5 uppercase transition-all flex items-center gap-2.5"
                                        >
                                            <Plus size={14} className="text-purple-400" /> Add Short Description
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowDropdown(false);
                                                setTextModalType('context');
                                                setTextInputContent('');
                                                setShowTextModal(true);
                                            }}
                                            className="w-full px-4 py-3 text-left text-xs font-black text-white hover:bg-white/5 uppercase transition-all flex items-center gap-2.5"
                                        >
                                            <Plus size={14} className="text-emerald-400" /> Enter Topic Context
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Hidden file input */}
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                multiple 
                                onChange={handleFileUpload} 
                                className="hidden"
                                accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png"
                            />

                            {/* Ingested sources itemizer */}
                            {inputs.length === 0 ? (
                                <div className="py-10 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center p-4 bg-black/10">
                                    <Database size={24} className="text-slate-500 mb-2" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Docket is empty</p>
                                    <p className="text-[8px] text-slate-500 uppercase mt-0.5">Upload curriculum guides or record audio lecture</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                    {inputs.map((inp) => (
                                        <div key={inp.id} className="flex flex-col p-3 bg-white/5 rounded-xl border border-white/5 hover:border-[var(--bg-accent)] transition-all gap-2 animate-in fade-in slide-in-from-bottom duration-300">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 truncate">
                                                    <FileText size={14} className="text-[var(--bg-accent)] shrink-0" />
                                                    <div className="truncate">
                                                        <p className="text-[10px] font-black text-white uppercase truncate">{inp.source_name}</p>
                                                        <p className="text-[8px] font-bold text-slate-500 uppercase">{inp.type}</p>
                                                    </div>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveInput(inp.id)}
                                                    className="text-red-500 hover:text-red-400 p-1 hover:bg-white/5 rounded-full transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            {/* Page range scoping selectors inside the card */}
                                            {inp.file && inp.type !== 'image' && (
                                                <div className="flex items-center gap-3 mt-1 pt-2 border-t border-white/5">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase">Start:</span>
                                                        <input 
                                                            type="number" 
                                                            min="1" 
                                                            value={inp.startPage || 1} 
                                                            onChange={(e) => {
                                                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                                                setInputs(prev => prev.map(item => item.id === inp.id ? { ...item, startPage: val } : item));
                                                                setAnalyzedData(null);
                                                            }}
                                                            className="w-12 bg-slate-900 border border-white/10 rounded px-1 py-0.5 text-white text-[9px] font-bold" 
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase">End:</span>
                                                        <input 
                                                            type="number" 
                                                            min="1" 
                                                            value={inp.endPage || 999} 
                                                            onChange={(e) => {
                                                                const val = Math.max(1, parseInt(e.target.value) || 999);
                                                                setInputs(prev => prev.map(item => item.id === inp.id ? { ...item, endPage: val } : item));
                                                                setAnalyzedData(null);
                                                            }}
                                                            className="w-12 bg-slate-900 border border-white/10 rounded px-1 py-0.5 text-white text-[9px] font-bold" 
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Status tracker */}
                        <div className="pt-4 border-t border-white/15">
                            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-slate-400">
                                <span className={`w-2 h-2 rounded-full ${inputs.length > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                                {inputs.length > 0 ? `${inputs.length} active syllabus source(s)` : 'No active sources'}
                            </div>
                        </div>
                    </div>

                    {/* CENTER STAGE: Premium audio recorder & speech workspace */}
                    <div className="flex-grow p-12 flex flex-col items-center justify-center relative min-h-[450px]">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--bg-accent-glow)] rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse"></div>

                        {transcribing && (
                            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center text-center p-6 z-30">
                                <div className="relative w-24 h-24 mb-4 flex items-center justify-center">
                                    <div className="absolute inset-0 border-4 border-t-[var(--bg-accent)] border-white/5 rounded-full animate-spin"></div>
                                    <Mic size={36} className="text-[var(--bg-accent)] animate-pulse" />
                                </div>
                                <p className="text-sm font-black text-white uppercase italic tracking-wider animate-pulse">⚡ Transcribing Lecture Audio...</p>
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1.5 font-mono">Whisper is analyzing speech patterns locally on your machine</p>
                            </div>
                        )}

                        <div className="flex flex-col items-center justify-center text-center space-y-6 max-w-lg">
                            {/* Pulsing Mic Circle Button */}
                            <button
                                type="button"
                                onClick={recording ? stopRecording : startRecording}
                                disabled={analyzing || submitting}
                                className={`w-48 h-48 rounded-full flex flex-col items-center justify-center transition-all duration-700 relative group border ${
                                    recording
                                        ? 'bg-red-500/10 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.3)] animate-pulse'
                                        : 'bg-white/5 border-white/10 hover:border-[var(--bg-accent)] hover:bg-white/10 shadow-[0_0_30px_rgba(255,255,255,0.02)]'
                                }`}
                            >
                                <Mic 
                                    size={64} 
                                    className={`transition-all duration-500 ${
                                        recording ? 'text-red-500 scale-110' : 'text-slate-300 group-hover:text-[var(--text-accent)]'
                                    }`} 
                                    style={{ transform: recording ? 'translateY(-12px)' : 'none' }}
                                />
                                {recording && (
                                    <span className="absolute bottom-4 text-[10px] font-black text-red-500 uppercase tracking-widest flex flex-col items-center gap-0.5">
                                        <span className="animate-pulse">{recordingPaused ? 'PAUSED' : 'RECORDING'}</span>
                                        <span className="text-[12px] text-white font-mono">{formatTime(recordingDuration)}</span>
                                    </span>
                                )}
                            </button>
                            
                            {/* Waveform Animation Visualizer */}
                            {recording && (
                                <div className="flex items-center gap-1.5 h-10 justify-center py-2">
                                    {[...Array(12)].map((_, i) => (
                                        <div 
                                            key={i} 
                                            className={`w-1.5 bg-red-500 rounded-full transition-all duration-300 ${
                                                recordingPaused ? 'h-2 animate-none' : 'h-10 animate-pulse'
                                            }`}
                                            style={{ 
                                                animationDelay: `${i * 100}ms`,
                                                animationDuration: `${0.6 + (i % 3) * 0.2}s`
                                            }}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Voice tactile controllers */}
                            {recording ? (
                                <div className="flex items-center gap-4 pt-2">
                                    {recordingPaused ? (
                                        <button
                                            type="button"
                                            onClick={resumeRecording}
                                            className="px-5 py-2 bg-green-600/20 border border-green-500/30 text-green-400 rounded-full text-xs font-black uppercase tracking-wider hover:bg-green-600/30 active:scale-95 transition-all flex items-center gap-2"
                                        >
                                            <PlayCircle size={14} /> Resume
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={pauseRecording}
                                            className="px-5 py-2 bg-amber-600/20 border border-amber-500/30 text-amber-400 rounded-full text-xs font-black uppercase tracking-wider hover:bg-amber-600/30 active:scale-95 transition-all flex items-center gap-2"
                                        >
                                            <PauseCircle size={14} /> Pause
                                        </button>
                                    )}
                                    
                                    <button
                                        type="button"
                                        onClick={stopRecording}
                                        className="px-5 py-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-full text-xs font-black uppercase tracking-wider hover:bg-blue-600/30 active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <StopCircle size={14} /> Stop & Sync
                                    </button>

                                    <button
                                        type="button"
                                        onClick={cancelRecording}
                                        className="px-5 py-2 bg-red-600/20 border border-red-500/30 text-red-400 rounded-full text-xs font-black uppercase tracking-wider hover:bg-red-600/30 active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <Trash2 size={14} /> Cancel
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <p className="text-sm font-black text-white uppercase italic tracking-wide">Tap microphone to record syllabus explanation</p>
                                    <p className="text-[10px] text-slate-400/60 uppercase font-black tracking-widest">Supports voice lectures or live mic inputs</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* BOTTOM EXECUTION FOOTER */}
                <div className="w-full bg-slate-900/50 backdrop-blur-lg border-t border-white/10 p-5 flex items-center justify-center shrink-0">
                    <button
                        type="button"
                        disabled={inputs.length === 0 || analyzing || submitting}
                        onClick={handleStartWizard}
                        className="w-full max-w-4xl py-4 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-black text-lg italic uppercase tracking-wider rounded-2xl shadow-xl shadow-yellow-500/10 hover:scale-[1.01] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 btn-cinematic"
                    >
                        {analyzing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                        {analyzing ? 'ANALYZING CURRICULUM...' : 'GENERATE HYBRID QUIZ'}
                    </button>
                </div>
            </div>

            {/* TEXT PROMPT MODAL POPUP */}
            {showTextModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-6 w-full max-w-md space-y-4 shadow-2xl relative">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h3 className="text-sm font-black text-white uppercase italic">
                                {textModalType === 'description' ? 'Add Topic Description' : 'Enter Curriculum Context'}
                            </h3>
                            <button 
                                type="button" 
                                onClick={() => setShowTextModal(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <textarea
                            value={textInputContent}
                            onChange={(e) => setTextInputContent(e.target.value)}
                            placeholder={
                                textModalType === 'description' 
                                    ? 'Enter a brief summary or description of the syllabus topic...' 
                                    : 'Paste curriculum guides, textbook chapters, or syllabus points here...'
                            }
                            rows={6}
                            className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[var(--bg-accent)] resize-none"
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowTextModal(false)}
                                className="px-4 py-2 border border-white/10 text-white rounded-lg text-[10px] font-black uppercase hover:bg-white/5 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAddTextInput}
                                className="px-4 py-2 bg-[var(--bg-accent)] text-white rounded-lg text-[10px] font-black uppercase hover:bg-[var(--bg-accent-hover)] transition-all"
                            >
                                Add Input
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SEQUENTIAL WIZARD DIALOGUE OVERLAY */}
            {showWizard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-xl space-y-6 text-left relative overflow-hidden shadow-2xl">
                        
                        {/* Header step progress */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <div>
                                <h3 className="text-xl font-black text-white uppercase italic">
                                    {wizardStep === 1 && 'Step 1: General Constraints'}
                                    {wizardStep === 2 && 'Step 2: AI Formats & Styles'}
                                    {wizardStep === 3 && 'Step 3: Topic Stress Matrix'}
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                                    Wizard Progress: Step {wizardStep} of 3
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowWizard(false)}
                                className="p-2 bg-white/5 hover:bg-red-500/10 rounded-full text-slate-400 hover:text-red-500 transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* STEP 1: CONSTRAINTS */}
                        {wizardStep === 1 && (
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    {/* Question Count */}
                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                                        <div className="bg-[var(--bg-accent)] w-12 h-12 rounded-xl flex items-center justify-center text-[var(--text-on-accent)]">
                                            <Hash size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Question Count</p>
                                            <input
                                                type="number"
                                                min="1"
                                                max="20"
                                                value={questionCount}
                                                onChange={(e) => { const v = parseInt(e.target.value); setQuestionCount(isNaN(v) ? '' : v); }}
                                                className="bg-transparent border-none text-xl font-black text-white italic outline-none w-full"
                                                disabled={isLoading}
                                            />
                                        </div>
                                    </div>

                                    {/* Difficulty */}
                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                                        <div className="bg-purple-600 w-12 h-12 rounded-xl flex items-center justify-center text-white">
                                            <Gauge size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Difficulty</p>
                                            <select
                                                value={difficulty}
                                                onChange={(e) => setDifficulty(e.target.value)}
                                                className="bg-transparent border-none text-xl font-black text-white italic outline-none w-full appearance-none cursor-pointer text-white bg-slate-900"
                                                disabled={isLoading}
                                            >
                                                <option value="Easy" style={{ color: '#ffffff', backgroundColor: '#0f172a' }}>Easy</option>
                                                <option value="Medium" style={{ color: '#ffffff', backgroundColor: '#0f172a' }}>Medium</option>
                                                <option value="Thinkable" style={{ color: '#ffffff', backgroundColor: '#0f172a' }}>Thinkable</option>
                                                <option value="Hard" style={{ color: '#ffffff', backgroundColor: '#0f172a' }}>Hard</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setWizardStep(2)}
                                        className="px-8 py-3 bg-[var(--bg-accent)] text-white rounded-xl font-black uppercase text-xs italic tracking-wider hover:bg-[var(--bg-accent-hover)] transition-all flex items-center gap-2"
                                    >
                                        Continue <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: AI FORMATS & STYLES */}
                        {wizardStep === 2 && (
                            <div className="space-y-6">
                                {!ratiosModified ? (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* CORE_THEORY */}
                                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                                                <input 
                                                    type="checkbox"
                                                    checked={ratios.CORE_THEORY > 0}
                                                    readOnly
                                                    className="w-4 h-4 rounded border-white/10 text-blue-500 focus:ring-0 focus:ring-offset-0 bg-transparent shrink-0"
                                                />
                                                <span className="text-xs font-black uppercase text-white">Theory</span>
                                            </div>

                                            {/* ANALYTICAL_REASONING */}
                                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                                                <input 
                                                    type="checkbox"
                                                    checked={ratios.ANALYTICAL_REASONING > 0}
                                                    readOnly
                                                    className="w-4 h-4 rounded border-white/10 text-purple-500 focus:ring-0 focus:ring-offset-0 bg-transparent shrink-0"
                                                />
                                                <span className="text-xs font-black uppercase text-white">Analytical Reasoning</span>
                                            </div>

                                            {/* NUMERICAL_DESIGN */}
                                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                                                <input 
                                                    type="checkbox"
                                                    checked={ratios.NUMERICAL_DESIGN > 0}
                                                    readOnly
                                                    className="w-4 h-4 rounded border-white/10 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-transparent shrink-0"
                                                />
                                                <span className="text-xs font-black uppercase text-white">Numerical Design</span>
                                            </div>

                                            {/* REAL_WORLD_APPLICATION */}
                                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                                                <input 
                                                    type="checkbox"
                                                    checked={ratios.REAL_WORLD_APPLICATION > 0}
                                                    readOnly
                                                    className="w-4 h-4 rounded border-white/10 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-transparent shrink-0"
                                                />
                                                <span className="text-xs font-black uppercase text-white">Real-World Application</span>
                                            </div>

                                            {/* IMPLEMENTATION_SYNTHESIS */}
                                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center gap-3 col-span-2 justify-center">
                                                <input 
                                                    type="checkbox"
                                                    checked={ratios.IMPLEMENTATION_SYNTHESIS > 0}
                                                    readOnly
                                                    className="w-4 h-4 rounded border-white/10 text-rose-500 focus:ring-0 focus:ring-offset-0 bg-transparent shrink-0"
                                                />
                                                <span className="text-xs font-black uppercase text-white">
                                                    {isNonComputational ? "Design Optimization & Lab Tracing" : "Implementation & Synthesis"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-xl flex items-center gap-2.5">
                                            <Sparkles size={16} className="text-blue-400 shrink-0" />
                                            <p className="text-[10px] font-black uppercase text-blue-400 tracking-wider">
                                                ✨ AI Recommended Layout calculated by token-density analysis
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                            <button
                                                type="button"
                                                onClick={() => setRatiosModified(true)}
                                                className="px-6 py-2.5 border border-white/10 text-white rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-white/5 transition-all"
                                            >
                                                Modify Layout
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setWizardStep(3)}
                                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-blue-500 transition-all"
                                            >
                                                Accept Layout
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                     <div className="space-y-4">
                                         <p className="text-xs font-black text-white uppercase italic">Customize Format Ratios</p>
                                         <div className="space-y-4">
                                              {/* CORE_THEORY */}
                                              <div className="space-y-1">
                                                  <div className="flex justify-between font-black uppercase text-[10px] italic">
                                                      <span className="text-blue-400">Theory</span>
                                                      <span className="text-white">{ratios.CORE_THEORY}%</span>
                                                  </div>
                                                  <input
                                                      type="range"
                                                      min="0"
                                                      max="100"
                                                      value={ratios.CORE_THEORY}
                                                      onChange={(e) => handleSliderChange('CORE_THEORY', e.target.value)}
                                                      className="w-full accent-blue-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                                                  />
                                              </div>

                                              {/* ANALYTICAL_REASONING */}
                                              <div className="space-y-1">
                                                  <div className="flex justify-between font-black uppercase text-[10px] italic">
                                                      <span className="text-purple-400">Analytical Reasoning</span>
                                                      <span className="text-white">{ratios.ANALYTICAL_REASONING}%</span>
                                                  </div>
                                                  <input
                                                      type="range"
                                                      min="0"
                                                      max="100"
                                                      value={ratios.ANALYTICAL_REASONING}
                                                      onChange={(e) => handleSliderChange('ANALYTICAL_REASONING', e.target.value)}
                                                      className="w-full accent-purple-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                                                  />
                                              </div>

                                              {/* NUMERICAL_DESIGN */}
                                              <div className="space-y-1">
                                                  <div className="flex justify-between font-black uppercase text-[10px] italic">
                                                      <span className="text-amber-400">Numerical Design</span>
                                                      <span className="text-white">{ratios.NUMERICAL_DESIGN}%</span>
                                                  </div>
                                                  <input
                                                      type="range"
                                                      min="0"
                                                      max="100"
                                                      value={ratios.NUMERICAL_DESIGN}
                                                      onChange={(e) => handleSliderChange('NUMERICAL_DESIGN', e.target.value)}
                                                      className="w-full accent-amber-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                                                  />
                                              </div>

                                              {/* REAL_WORLD_APPLICATION */}
                                              <div className="space-y-1">
                                                  <div className="flex justify-between font-black uppercase text-[10px] italic">
                                                      <span className="text-emerald-400">Real-World Application</span>
                                                      <span className="text-white">{ratios.REAL_WORLD_APPLICATION}%</span>
                                                  </div>
                                                  <input
                                                      type="range"
                                                      min="0"
                                                      max="100"
                                                      value={ratios.REAL_WORLD_APPLICATION}
                                                      onChange={(e) => handleSliderChange('REAL_WORLD_APPLICATION', e.target.value)}
                                                      className="w-full accent-emerald-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                                                  />
                                              </div>

                                              {/* IMPLEMENTATION_SYNTHESIS */}
                                              <div className="space-y-1">
                                                  <div className="flex justify-between font-black uppercase text-[10px] italic">
                                                      <span className="text-rose-400">
                                                          {isNonComputational ? "Design Optimization & Lab Tracing" : "Implementation & Synthesis"}
                                                      </span>
                                                      <span className="text-white">{ratios.IMPLEMENTATION_SYNTHESIS}%</span>
                                                  </div>
                                                  <input
                                                      type="range"
                                                      min="0"
                                                      max="100"
                                                      value={ratios.IMPLEMENTATION_SYNTHESIS}
                                                      onChange={(e) => handleSliderChange('IMPLEMENTATION_SYNTHESIS', e.target.value)}
                                                      className="w-full accent-rose-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                                                  />
                                              </div>
                                          </div>

                                        <div className="flex justify-between pt-6 border-t border-white/10">
                                            <button
                                                type="button"
                                                onClick={() => setRatiosModified(false)}
                                                className="px-6 py-2.5 border border-white/10 text-white rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-white/5 transition-all"
                                            >
                                                Back to AI Recs
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setWizardStep(3)}
                                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-blue-500 transition-all"
                                            >
                                                Continue to Step 3
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STEP 3: TOPIC STRESSING */}
                        {wizardStep === 3 && (
                            <div className="space-y-6">
                                <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
                                    {analyzedData && analyzedData.concepts && analyzedData.concepts.length > 0 ? (
                                        analyzedData.concepts.map((concept, idx) => {
                                            const currentWeight = topicWeights[concept.concept_tag] ?? concept.weight_score;
                                            return (
                                                <div key={idx} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all space-y-1.5">
                                                    <div className="flex justify-between font-black uppercase text-[10px]">
                                                        <span className="text-white truncate max-w-[200px]">{concept.concept_tag}</span>
                                                        <span className={`${currentWeight > 0 ? 'text-blue-400' : 'text-red-500'}`}>
                                                            {currentWeight > 0 ? `Stress: ${currentWeight.toFixed(1)}` : 'DISABLED'}
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0.0"
                                                        max="1.0"
                                                        step="0.1"
                                                        value={currentWeight}
                                                        onChange={(e) => handleTopicWeightChange(concept.concept_tag, e.target.value)}
                                                        className="w-full accent-blue-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-xs text-slate-400 font-bold uppercase">No extracted concepts to stress.</p>
                                    )}
                                </div>

                                <div className="flex justify-between pt-4 border-t border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => setWizardStep(2)}
                                        className="px-6 py-2.5 border border-white/10 text-white rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-white/5 transition-all"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { setShowWizard(false); handleSubmit(e); }}
                                        className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-black uppercase text-[10px] tracking-wider hover:scale-105 transition-all"
                                    >
                                        Confirm & Launch Quiz Room
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
