import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { 
    Book, Hash, Gauge, Sparkles, Loader2, Database, Sliders, 
    FileText, FileCode, Plus, Trash2, Mic, Play, Square, CheckCircle, 
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

    const [interviewMode, setInterviewMode] = useState(false);
    const [questionStyle, setQuestionStyle] = useState('MIXED');
    const [ratios, setRatios] = useState({
        CONCEPTS_AND_DEFINITIONS: 20,
        COMPARISONS_AND_TRADEOFFS: 20,
        FORMULAS_AND_CALCULATIONS: 20,
        CASE_STUDIES_AND_SCENARIOS: 20,
        PRACTICAL_AND_LAB_TASKS: 20
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

        const keys = ['CONCEPTS_AND_DEFINITIONS', 'COMPARISONS_AND_TRADEOFFS', 'FORMULAS_AND_CALCULATIONS', 'CASE_STUDIES_AND_SCENARIOS', 'PRACTICAL_AND_LAB_TASKS'];
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
    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const newInputs = files.map(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            return {
                id: Math.random().toString(),
                type: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'txt'].includes(ext) ? 'image' : ext,
                file: file,
                source_name: file.name,
                startPage: 1,
                endPage: '',
                maxPages: null,
                fetchingMetadata: false
            };
        });

        setInputs(prev => [...prev, ...newInputs]);
        setAnalyzedData(null); // Reset analysis
        e.target.value = null; // reset file input

        // Asynchronously fetch metadata for each document
        for (const inputObj of newInputs) {
            const ext = inputObj.file.name.split('.').pop().toLowerCase();
            const isDoc = ['pdf', 'docx', 'pptx', 'ppt', 'xls', 'xlsx'].includes(ext);
            const isImageOrTxt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'txt'].includes(ext) ||
                                 inputObj.file.name.toLowerCase().includes('scan') ||
                                 inputObj.file.name.toLowerCase().includes('handwritten') ||
                                 inputObj.file.name.toLowerCase().includes('handwriting');

            if (isDoc && !isImageOrTxt) {
                setInputs(prev => prev.map(item => item.id === inputObj.id ? { ...item, fetchingMetadata: true } : item));
                const formData = new FormData();
                formData.append('file', inputObj.file);

                try {
                    const res = await api.post('/quiz/file-metadata', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    if (res.data && res.data.success) {
                        setInputs(prev => prev.map(item => item.id === inputObj.id ? { 
                            ...item, 
                            maxPages: res.data.totalCount, 
                            endPage: res.data.totalCount 
                        } : item));
                    }
                } catch (err) {
                    console.error('Error fetching file metadata:', err);
                    toast.error(`Failed to parse page count for ${inputObj.file.name}`);
                } finally {
                    setInputs(prev => prev.map(item => item.id === inputObj.id ? { ...item, fetchingMetadata: false } : item));
                }
            }
        }
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
                        CONCEPTS_AND_DEFINITIONS: Math.round((rec.CONCEPTS_AND_DEFINITIONS || rec.CORE_THEORY || 0) * 100),
                        COMPARISONS_AND_TRADEOFFS: Math.round((rec.COMPARISONS_AND_TRADEOFFS || rec.ANALYTICAL_REASONING || 0) * 100),
                        FORMULAS_AND_CALCULATIONS: Math.round((rec.FORMULAS_AND_CALCULATIONS || rec.NUMERICAL_DESIGN || 0) * 100),
                        CASE_STUDIES_AND_SCENARIOS: Math.round((rec.CASE_STUDIES_AND_SCENARIOS || rec.REAL_WORLD_APPLICATION || 0) * 100),
                        PRACTICAL_AND_LAB_TASKS: Math.round((rec.PRACTICAL_AND_LAB_TASKS || rec.IMPLEMENTATION_SYNTHESIS || 0) * 100)
                    };
                    let sumRec = Object.values(baseline).reduce((s, v) => s + v, 0);
                    if (sumRec !== 100 && sumRec > 0) {
                        const keys = Object.keys(baseline);
                        const maxKey = keys.reduce((a, b) => baseline[a] > baseline[b] ? a : b);
                        baseline[maxKey] += (100 - sumRec);
                    } else if (sumRec === 0) {
                        baseline.CONCEPTS_AND_DEFINITIONS = 20;
                        baseline.COMPARISONS_AND_TRADEOFFS = 20;
                        baseline.FORMULAS_AND_CALCULATIONS = 20;
                        baseline.CASE_STUDIES_AND_SCENARIOS = 20;
                        baseline.PRACTICAL_AND_LAB_TASKS = 20;
                    }
                    setAiBaselineRatios(baseline);
                    setRatios(baseline);
                } else {
                    const defaultBase = {
                        CONCEPTS_AND_DEFINITIONS: 20,
                        COMPARISONS_AND_TRADEOFFS: 20,
                        FORMULAS_AND_CALCULATIONS: 20,
                        CASE_STUDIES_AND_SCENARIOS: 20,
                        PRACTICAL_AND_LAB_TASKS: 20
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
            CONCEPTS_AND_DEFINITIONS: ratios.CONCEPTS_AND_DEFINITIONS <= 0 ? 0 : parseFloat((ratios.CONCEPTS_AND_DEFINITIONS / 100).toFixed(2)),
            COMPARISONS_AND_TRADEOFFS: ratios.COMPARISONS_AND_TRADEOFFS <= 0 ? 0 : parseFloat((ratios.COMPARISONS_AND_TRADEOFFS / 100).toFixed(2)),
            FORMULAS_AND_CALCULATIONS: ratios.FORMULAS_AND_CALCULATIONS <= 0 ? 0 : parseFloat((ratios.FORMULAS_AND_CALCULATIONS / 100).toFixed(2)),
            CASE_STUDIES_AND_SCENARIOS: ratios.CASE_STUDIES_AND_SCENARIOS <= 0 ? 0 : parseFloat((ratios.CASE_STUDIES_AND_SCENARIOS / 100).toFixed(2)),
            PRACTICAL_AND_LAB_TASKS: ratios.PRACTICAL_AND_LAB_TASKS <= 0 ? 0 : parseFloat((ratios.PRACTICAL_AND_LAB_TASKS / 100).toFixed(2))
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
        formData.append('question_count', questionCount);
        formData.append('difficulty', difficulty);
        formData.append('target_ratios', JSON.stringify(targetRatiosPayload));
        formData.append('text_prompts', JSON.stringify(textInputs.map(t => t.content)));
        formData.append('interview_mode', interviewMode ? 'true' : 'false');
        formData.append('question_style', questionStyle || 'MIXED');
        formData.append('assessment_style', questionStyle || 'MIXED');
        
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
                            taskId:          taskId,
                            questions:       result.questions,
                            title:           result.title || `Curriculum Quiz: ${inputs[0]?.source_name}`,
                            duration:        result.duration || 10,
                            source:          'generated',
                            agentReport:     result.agentReport || null,
                            finalValidation: result.finalValidation || null,
                            lobbySummary:    result.lobbySummary || null,
                            aiFlashcards:    result.aiFlashcards || null,
                            executionMessages: result.metadata?.executionMessages || []
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
                <div className="p-6 pb-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                    <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight italic uppercase">
                        Kahoot <span className="text-[var(--text-accent)]">AI Studio</span>
                    </h1>
                    <p className="text-[var(--text-secondary)] mt-1 font-bold uppercase tracking-wider text-xs italic">
                        Transform course material into gamified learning assessments.
                    </p>
                </div>

                {pollError && (
                    <div className="mx-6 mt-4 px-5 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 font-bold text-xs uppercase tracking-wider">
                        ⚠ {pollError}
                    </div>
                )}

                {/* UPPER SPLIT SCREEN WORKSPACE */}
                <div className="flex flex-col lg:flex-row flex-grow w-full bg-[var(--bg-primary)] gap-4 p-4 lg:p-6">
                    
                    {/* LEFT PANEL: Active Sources / Ingestion Container */}
                    <div className="w-full lg:w-1/2 xl:w-[520px] bg-[var(--bg-secondary)] backdrop-blur-md border border-[var(--border-color)] rounded-3xl p-5 lg:p-6 flex flex-col justify-between shrink-0 space-y-5 shadow-lg">
                        <div className="space-y-5">
                            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
                                <div className="flex items-center gap-2.5">
                                    <span className="px-2.5 py-1 bg-[var(--accent-sand)] text-[var(--text-accent)] border border-[var(--border-color)] rounded-lg text-[9px] font-black uppercase tracking-wider">Step 1</span>
                                    <h2 className="text-base font-black text-[var(--text-primary)] uppercase italic tracking-wide">Active Sources</h2>
                                </div>
                                <span className="bg-[var(--bg-primary)] text-[var(--text-primary)] px-3 py-1 rounded-full text-xs font-black uppercase border border-[var(--border-color)] shadow-xs">
                                    {inputs.length} {inputs.length === 1 ? 'Source' : 'Sources'}
                                </span>
                            </div>

                            {/* Dropdown trigger button */}
                            <div className="relative">
                                <button 
                                    type="button"
                                    onClick={() => setShowDropdown(prev => !prev)}
                                    className="w-full py-4 bg-white border-2 border-[var(--border-color)] hover:border-[var(--bg-accent)] text-[var(--text-accent)] rounded-2xl font-black uppercase text-xs italic tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.98] hover:bg-[var(--accent-sand)]/80"
                                >
                                    <Plus size={18} className="text-[var(--text-accent)]" /> Add Input
                                </button>
                                
                                {showDropdown && (
                                    <div className="absolute left-0 right-0 mt-2 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] rounded-2xl overflow-hidden shadow-2xl z-20">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowDropdown(false);
                                                fileInputRef.current.click();
                                            }}
                                            className="w-full px-5 py-3.5 text-left text-xs font-black text-[var(--text-primary)] hover:bg-[var(--bg-primary)] uppercase transition-all flex items-center gap-3 border-b border-[var(--border-color)]/50"
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
                                            className="w-full px-5 py-3.5 text-left text-xs font-black text-[var(--text-primary)] hover:bg-[var(--bg-primary)] uppercase transition-all flex items-center gap-3"
                                        >
                                            <Plus size={16} className="text-emerald-600" /> Enter Topic Context
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

                            {/* Ingested sources list */}
                            {inputs.length === 0 ? (
                                <div className="py-12 border-2 border-dashed border-[var(--border-color)] rounded-2xl flex flex-col items-center justify-center text-center p-6 bg-white space-y-2 shadow-xs">
                                    <Database size={32} className="text-[var(--text-accent)] opacity-80" />
                                    <p className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">Docket is empty</p>
                                    <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Upload curriculum guides or record audio lecture</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[45vh] overflow-y-auto premium-scrollbar pr-1">
                                    {inputs.map((inp) => (
                                        <div key={inp.id} className="p-4 bg-white rounded-2xl border-2 border-[var(--border-color)] shadow-sm space-y-3 hover:border-[var(--bg-accent)]/50 transition-all">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className="p-2.5 bg-[var(--bg-accent)]/10 rounded-xl text-[var(--text-accent)] shrink-0">
                                                        {inp.type === 'pdf' ? <FileText size={18} /> : inp.type === 'audio' ? <Mic size={18} /> : <FileCode size={18} />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs sm:text-sm font-black text-[var(--text-primary)] truncate">{inp.source_name}</p>
                                                        <p className="text-[9px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider">{inp.type}</p>
                                                    </div>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveInput(inp.id)}
                                                    className="text-red-500 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-all shrink-0"
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

                                            {/* Page range scoping selectors with clear, spacious input boxes */}
                                            {inp.file && !['jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'image', 'handwritten_scan'].includes(inp.type) && !inp.source_name.toLowerCase().includes('scan') && !inp.source_name.toLowerCase().includes('handwritten') && !inp.source_name.toLowerCase().includes('handwriting') && (
                                                <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-[var(--border-color)]/60 bg-slate-50 p-2.5 rounded-xl">
                                                     <div className="flex items-center gap-2">
                                                         <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                                             Start {(inp.type === 'pptx' || inp.type === 'ppt') ? 'Slide' : 'Page'}:
                                                         </span>
                                                         <input 
                                                             type="number" 
                                                             min="1" 
                                                             max={inp.maxPages || undefined}
                                                             value={inp.startPage || 1} 
                                                             onChange={(e) => {
                                                                 const rawVal = e.target.value;
                                                                 let val = Math.max(1, parseInt(rawVal) || 1);
                                                                 if (inp.maxPages && val > inp.maxPages) {
                                                                     val = inp.maxPages;
                                                                 }
                                                                 setInputs(prev => prev.map(item => item.id === inp.id ? { ...item, startPage: val } : item));
                                                                 setAnalyzedData(null);
                                                             }}
                                                             className="w-16 px-2 py-1 bg-white border-2 border-slate-300 rounded-lg text-xs font-black text-slate-800 text-center focus:border-[var(--bg-accent)] focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                                         />
                                                     </div>
                                                     <div className="flex items-center gap-2">
                                                         <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                                             End {(inp.type === 'pptx' || inp.type === 'ppt') ? 'Slide' : 'Page'}:
                                                         </span>
                                                         <input 
                                                             type="number" 
                                                             min="1"
                                                             max={inp.maxPages || undefined}
                                                             placeholder="All"
                                                             value={inp.endPage || ''} 
                                                             onChange={(e) => {
                                                                 const rawVal = e.target.value;
                                                                 let val = rawVal === '' ? undefined : parseInt(rawVal);
                                                                 if (val !== undefined) {
                                                                     val = Math.max(1, val);
                                                                     if (inp.maxPages && val > inp.maxPages) {
                                                                         val = inp.maxPages;
                                                                     }
                                                                 }
                                                                 setInputs(prev => prev.map(item => item.id === inp.id ? { ...item, endPage: val } : item));
                                                                 setAnalyzedData(null);
                                                             }}
                                                             className="w-16 px-2 py-1 bg-white border-2 border-slate-300 rounded-lg text-xs font-black text-slate-800 text-center focus:border-[var(--bg-accent)] focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
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

                    {/* RIGHT PANEL: Voice Recording Container */}
                    <div className="flex-1 bg-[var(--bg-secondary)] backdrop-blur-md border border-[var(--border-color)] rounded-3xl p-6 lg:p-10 flex flex-col items-center justify-center text-center relative min-h-[300px] shadow-lg">
                        <div className="absolute top-4 right-5">
                            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-[9px] font-black uppercase tracking-wider">Step 2 • Voice AI Context</span>
                        </div>

                        {/* Transcribing overlay */}
                        {transcribing && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[var(--bg-primary)]/90 backdrop-blur-sm rounded-3xl">
                                <div className="relative w-16 h-16 flex items-center justify-center">
                                    <div className="absolute inset-0 border-4 border-t-[var(--bg-accent)] border-[var(--border-color)] rounded-full animate-spin"></div>
                                    <Mic size={28} className="text-[var(--bg-accent)] animate-pulse" />
                                </div>
                                <p className="text-sm font-black text-[var(--text-primary)] uppercase italic tracking-wider animate-pulse">⚡ Transcribing Lecture Audio...</p>
                                <p className="text-[10px] text-[var(--text-secondary)] uppercase font-black tracking-widest mt-1.5 font-mono">Whisper is analyzing speech patterns locally on your machine</p>
                            </div>
                        )}

                        <div className="flex flex-col items-center justify-center text-center space-y-5 max-w-md w-full">
                            {/* Pulsing Mic Circle Button */}
                            <button
                                type="button"
                                onClick={recording ? stopRecording : startRecording}
                                disabled={analyzing || submitting}
                                className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center transition-all duration-300 relative group border-4 shadow-md ${
                                    recording
                                        ? recordingPaused
                                            ? 'bg-amber-50 border-amber-500 shadow-xl shadow-amber-500/20 scale-100'
                                            : 'bg-emerald-50 border-emerald-500 shadow-xl shadow-emerald-500/20 scale-105'
                                        : 'bg-white border-[var(--bg-accent)] hover:scale-105 active:scale-95 shadow-md shadow-[var(--bg-accent)]/20'
                                }`}
                            >
                                <Mic 
                                    size={38} 
                                    className={`transition-all duration-300 ${
                                        recording 
                                            ? recordingPaused 
                                                ? 'text-amber-500 scale-105' 
                                                : 'text-emerald-500 scale-110' 
                                            : 'text-[var(--text-accent)]'
                                    }`} 
                                    style={{ 
                                        color: recording ? (recordingPaused ? '#f59e0b' : '#10b981') : 'var(--text-accent)', 
                                        stroke: recording ? (recordingPaused ? '#f59e0b' : '#10b981') : 'var(--text-accent)', 
                                        transform: recording ? 'translateY(-4px)' : 'none' 
                                    }}
                                />
                                {recording && (
                                    <span className={`absolute bottom-2.5 text-[8px] font-black uppercase tracking-widest flex flex-col items-center gap-0.5 ${
                                        recordingPaused ? 'text-amber-600' : 'text-emerald-600'
                                    }`}>
                                        <span className="animate-pulse">{recordingPaused ? 'PAUSED' : 'RECORDING'}</span>
                                        <span className="text-[10px] text-slate-800 font-mono font-bold">{formatTime(recordingDuration)}</span>
                                    </span>
                                )}
                            </button>
                            
                            {/* Waveform Animation Visualizer */}
                            {recording && (
                                <div className="flex items-center gap-1.5 h-8 justify-center py-1">
                                    {[...Array(12)].map((_, i) => (
                                        <div 
                                            key={i} 
                                            className={`w-1.5 rounded-full transition-all duration-300 ${
                                                recordingPaused 
                                                    ? 'bg-amber-500 h-2 animate-none' 
                                                    : 'bg-emerald-500 h-8 animate-pulse'
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
                                <div className="flex items-center gap-3 pt-1 flex-wrap justify-center">
                                    {recordingPaused ? (
                                        <button
                                            type="button"
                                            onClick={resumeRecording}
                                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 !text-white text-white-force rounded-full text-xs font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-2 shadow-md shadow-emerald-600/30 border border-emerald-500"
                                            style={{ backgroundColor: '#059669', color: '#ffffff' }}
                                        >
                                            <PlayCircle size={16} className="!text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                                            <span className="!text-white font-black" style={{ color: '#ffffff' }}>RESUME</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={pauseRecording}
                                            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 !text-white text-white-force rounded-full text-xs font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-2 shadow-md shadow-amber-500/30 border border-amber-400"
                                            style={{ backgroundColor: '#f59e0b', color: '#ffffff' }}
                                        >
                                            <PauseCircle size={16} className="!text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                                            <span className="!text-white font-black" style={{ color: '#ffffff' }}>PAUSE</span>
                                        </button>
                                    )}
                                    
                                    <button
                                        type="button"
                                        onClick={stopRecording}
                                        className="px-5 py-2.5 bg-[var(--bg-accent)] hover:bg-[var(--bg-accent-hover)] !text-white text-white-force rounded-full text-xs font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-2 shadow-md border border-[var(--bg-accent)]"
                                        style={{ backgroundColor: 'var(--bg-accent)', color: 'var(--text-on-accent)' }}
                                    >
                                        <StopCircle size={16} className="!text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                                        <span className="!text-white font-black" style={{ color: '#ffffff' }}>STOP & SYNC</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={cancelRecording}
                                        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 !text-white text-white-force rounded-full text-xs font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-2 shadow-md shadow-red-600/30 border border-red-500"
                                        style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                                    >
                                        <Trash2 size={16} className="!text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                                        <span className="!text-white font-black" style={{ color: '#ffffff' }}>CANCEL</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <p className="text-xs sm:text-sm font-black text-[var(--text-primary)] uppercase italic tracking-wide">Tap microphone to record syllabus explanation</p>
                                    <p className="text-[9px] text-[var(--text-secondary)] uppercase font-black tracking-widest">Supports voice lectures or live mic inputs</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* BOTTOM EXECUTION FOOTER */}
                <div className="w-full bg-white border-t-2 border-[var(--border-color)] p-5 flex items-center justify-center shrink-0 shadow-lg">
                    <button
                        type="button"
                        disabled={inputs.length === 0 || analyzing || submitting}
                        onClick={handleStartWizard}
                        className={`w-full max-w-4xl py-4.5 px-8 font-black text-sm sm:text-base uppercase tracking-[0.15em] rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 border-2 ${
                            inputs.length === 0 || analyzing || submitting
                                ? 'bg-[var(--bg-saffron)]/80 text-white border-[var(--bg-saffron)] opacity-80 cursor-not-allowed'
                                : 'bg-[var(--bg-saffron)] hover:bg-[var(--bg-saffron-hover)] text-white border-[var(--bg-saffron)] cursor-pointer active:scale-[0.99] shadow-[var(--bg-saffron)]/30'
                        }`}
                        style={{ backgroundColor: 'var(--bg-accent)', color: 'var(--text-on-accent)' }}
                    >
                        {analyzing ? (
                            <Loader2 className="animate-spin text-white" size={20} />
                        ) : (
                            <Sparkles size={20} className="text-amber-300 animate-pulse" />
                        )}
                        <span className="!text-white font-black uppercase tracking-widest text-base" style={{ color: '#ffffff' }}>
                            {analyzing ? 'ANALYZING CURRICULUM...' : 'GENERATE'}
                        </span>
                    </button>
                </div>
            </div>

            {/* TEXT PROMPT MODAL POPUP — Premium Theme */}
            {showTextModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md select-none">
                    <div className="bg-gradient-to-br from-white via-slate-50 to-[var(--accent-sand)]/50 border-2 border-[var(--border-color)] rounded-[2.5rem] p-6 sm:p-8 w-full max-w-lg space-y-6 shadow-2xl relative overflow-hidden">
                        
                        {/* Modal Top Header Bar */}
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-[var(--accent-sand)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-accent)] shadow-xs">
                                    <FileText size={22} className="text-[var(--text-accent)]" />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-black text-[#0f172a] uppercase italic tracking-tight" style={{ color: '#0f172a' }}>
                                        {textModalType === 'description' ? 'Add Topic Description' : 'Enter Curriculum Context'}
                                    </h3>
                                    <p className="text-[11px] font-bold text-[#334155]" style={{ color: '#334155' }}>
                                        Provide text prompts or course topics for AI synthesis
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setShowTextModal(false)}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#334155] transition-all cursor-pointer"
                            >
                                <X size={18} className="text-[#334155]" />
                            </button>
                        </div>

                        {/* Input Textarea Container */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-black uppercase tracking-wider text-[#0f172a]" style={{ color: '#0f172a' }}>
                                    Topic Content / Syllabus Text
                                </label>
                                <span className="text-[10px] text-slate-400 font-bold">{textInputContent.length} chars</span>
                            </div>
                            <textarea
                                value={textInputContent}
                                onChange={(e) => setTextInputContent(e.target.value)}
                                placeholder={
                                    textModalType === 'description' 
                                        ? 'Enter a detailed summary or description of the syllabus topic...' 
                                        : 'Paste curriculum guides, textbook chapters, formula sheets, or syllabus points here...'
                                }
                                rows={6}
                                className="w-full p-4 bg-white border-2 border-slate-200 focus:border-[var(--bg-accent)] focus:ring-4 focus:ring-[var(--border-color)]/50 rounded-2xl text-xs sm:text-sm font-bold text-[#0f172a] placeholder:text-slate-400 outline-none resize-none shadow-inner transition-all leading-relaxed"
                                style={{ color: '#0f172a' }}
                                autoFocus
                            />
                        </div>

                        {/* Modal Bottom Action Controls */}
                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200/80">
                            <button
                                type="button"
                                onClick={() => setShowTextModal(false)}
                                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-[#334155] border border-slate-300 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                                style={{ color: '#334155' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAddTextInput}
                                disabled={!textInputContent.trim()}
                                className="px-8 py-3 bg-[var(--bg-saffron)] hover:bg-[var(--bg-saffron-hover)] disabled:opacity-50 disabled:cursor-not-allowed !text-white text-white-force rounded-2xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                                style={{ backgroundColor: 'var(--bg-accent)', color: 'var(--text-on-accent)' }}
                            >
                                <Plus size={16} className="!text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                                <span className="!text-white font-black" style={{ color: '#ffffff' }}>Add Input Source</span>
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
                                            {/* CONCEPTS_AND_DEFINITIONS */}
                                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                                                <input 
                                                    type="checkbox"
                                                    checked={ratios.CONCEPTS_AND_DEFINITIONS > 0}
                                                    readOnly
                                                    className="w-4 h-4 rounded border-white/10 text-blue-500 focus:ring-0 focus:ring-offset-0 bg-transparent shrink-0"
                                                />
                                                <span className="text-xs font-black uppercase text-white">Theory</span>
                                            </div>

                                            {/* COMPARISONS_AND_TRADEOFFS */}
                                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                                                <input 
                                                    type="checkbox"
                                                    checked={ratios.COMPARISONS_AND_TRADEOFFS > 0}
                                                    readOnly
                                                    className="w-4 h-4 rounded border-white/10 text-purple-500 focus:ring-0 focus:ring-offset-0 bg-transparent shrink-0"
                                                />
                                                <span className="text-xs font-black uppercase text-white">Analytical Reasoning</span>
                                            </div>

                                            {/* FORMULAS_AND_CALCULATIONS */}
                                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                                                <input 
                                                    type="checkbox"
                                                    checked={ratios.FORMULAS_AND_CALCULATIONS > 0}
                                                    readOnly
                                                    className="w-4 h-4 rounded border-white/10 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-transparent shrink-0"
                                                />
                                                <span className="text-xs font-black uppercase text-white">Numerical Design</span>
                                            </div>

                                            {/* CASE_STUDIES_AND_SCENARIOS */}
                                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                                                <input 
                                                    type="checkbox"
                                                    checked={ratios.CASE_STUDIES_AND_SCENARIOS > 0}
                                                    readOnly
                                                    className="w-4 h-4 rounded border-white/10 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-transparent shrink-0"
                                                />
                                                <span className="text-xs font-black uppercase text-white">Real-World Application</span>
                                            </div>

                                            {/* PRACTICAL_AND_LAB_TASKS */}
                                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center gap-3 col-span-2 justify-center">
                                                <input 
                                                    type="checkbox"
                                                    checked={ratios.PRACTICAL_AND_LAB_TASKS > 0}
                                                    readOnly
                                                    className="w-4 h-4 rounded border-white/10 text-rose-500 focus:ring-0 focus:ring-offset-0 bg-transparent shrink-0"
                                                />
                                                <span className="text-xs font-black uppercase text-white">
                                                    {isNonComputational ? "Design Optimization & Lab Tracing" : "Implementation & Synthesis"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-[var(--accent-sand)] border border-[var(--border-color)] p-4 rounded-xl flex items-center gap-2.5">
                                            <Sparkles size={16} className="text-[var(--text-accent)] shrink-0" />
                                            <p className="text-[10px] font-black uppercase text-[var(--text-accent)] tracking-wider">
                                                ✨ AI Recommended Layout calculated by token-density analysis
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                            <button
                                                type="button"
                                                onClick={() => setRatiosModified(true)}
                                                className="px-6 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-slate-600 transition-all"
                                            >
                                                Modify Layout
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setWizardStep(3)}
                                                className="px-6 py-2.5 bg-[var(--bg-saffron)] border border-[var(--bg-saffron)] text-white rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-[var(--bg-saffron-hover)] transition-all shadow-md"
                                            >
                                                Accept Layout
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                     <div className="space-y-4">
                                         <p className="text-xs font-black text-white uppercase italic">Customize Format Ratios</p>
                                         <div className="space-y-4">
                                              {/* CONCEPTS_AND_DEFINITIONS */}
                                              <div className="space-y-1">
                                                  <div className="flex justify-between font-black uppercase text-[10px] italic">
                                                      <span className="text-[var(--text-accent)]">Theory</span>
                                                      <span className="text-white">{ratios.CONCEPTS_AND_DEFINITIONS}%</span>
                                                  </div>
                                                  <input
                                                      type="range"
                                                      min="0"
                                                      max="100"
                                                      value={ratios.CONCEPTS_AND_DEFINITIONS}
                                                      onChange={(e) => handleSliderChange('CONCEPTS_AND_DEFINITIONS', e.target.value)}
                                                      className="w-full accent-[var(--bg-accent)] bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                                                  />
                                              </div>

                                              {/* COMPARISONS_AND_TRADEOFFS */}
                                              <div className="space-y-1">
                                                  <div className="flex justify-between font-black uppercase text-[10px] italic">
                                                      <span className="text-purple-400">Analytical Reasoning</span>
                                                      <span className="text-white">{ratios.COMPARISONS_AND_TRADEOFFS}%</span>
                                                  </div>
                                                  <input
                                                      type="range"
                                                      min="0"
                                                      max="100"
                                                      value={ratios.COMPARISONS_AND_TRADEOFFS}
                                                      onChange={(e) => handleSliderChange('COMPARISONS_AND_TRADEOFFS', e.target.value)}
                                                      className="w-full accent-purple-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                                                  />
                                              </div>

                                              {/* FORMULAS_AND_CALCULATIONS */}
                                              <div className="space-y-1">
                                                  <div className="flex justify-between font-black uppercase text-[10px] italic">
                                                      <span className="text-amber-400">Numerical Design</span>
                                                      <span className="text-white">{ratios.FORMULAS_AND_CALCULATIONS}%</span>
                                                  </div>
                                                  <input
                                                      type="range"
                                                      min="0"
                                                      max="100"
                                                      value={ratios.FORMULAS_AND_CALCULATIONS}
                                                      onChange={(e) => handleSliderChange('FORMULAS_AND_CALCULATIONS', e.target.value)}
                                                      className="w-full accent-amber-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                                                  />
                                              </div>

                                              {/* CASE_STUDIES_AND_SCENARIOS */}
                                              <div className="space-y-1">
                                                  <div className="flex justify-between font-black uppercase text-[10px] italic">
                                                      <span className="text-emerald-400">Real-World Application</span>
                                                      <span className="text-white">{ratios.CASE_STUDIES_AND_SCENARIOS}%</span>
                                                  </div>
                                                  <input
                                                      type="range"
                                                      min="0"
                                                      max="100"
                                                      value={ratios.CASE_STUDIES_AND_SCENARIOS}
                                                      onChange={(e) => handleSliderChange('CASE_STUDIES_AND_SCENARIOS', e.target.value)}
                                                      className="w-full accent-emerald-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                                                  />
                                              </div>

                                              {/* PRACTICAL_AND_LAB_TASKS */}
                                              <div className="space-y-1">
                                                  <div className="flex justify-between font-black uppercase text-[10px] italic">
                                                      <span className="text-rose-400">
                                                          {isNonComputational ? "Design Optimization & Lab Tracing" : "Implementation & Synthesis"}
                                                      </span>
                                                      <span className="text-white">{ratios.PRACTICAL_AND_LAB_TASKS}%</span>
                                                  </div>
                                                  <input
                                                      type="range"
                                                      min="0"
                                                      max="100"
                                                      value={ratios.PRACTICAL_AND_LAB_TASKS}
                                                      onChange={(e) => handleSliderChange('PRACTICAL_AND_LAB_TASKS', e.target.value)}
                                                      className="w-full accent-rose-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                                                  />
                                              </div>
                                          </div>

                                        <div className="flex justify-between pt-6 border-t border-white/10">
                                            <button
                                                type="button"
                                                onClick={() => setRatiosModified(false)}
                                                className="px-6 py-2.5 bg-white border-2 border-slate-400 !text-[#0f172a] rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-slate-100 transition-all"
                                                style={{ color: '#0f172a' }}
                                            >
                                                Back to AI Recs
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setWizardStep(3)}
                                                className="px-6 py-2.5 bg-[var(--bg-saffron)] text-white rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-[var(--bg-saffron-hover)] transition-all"
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
                                                        <span className={`${currentWeight > 0 ? 'text-[var(--text-accent)]' : 'text-red-500'}`}>
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
                                                        className="w-full accent-[var(--bg-accent)] bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
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
                                        className="px-6 py-2.5 bg-white border-2 border-slate-400 !text-[#0f172a] rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-slate-100 transition-all"
                                        style={{ color: '#0f172a' }}
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
