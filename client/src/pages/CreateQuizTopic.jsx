import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { 
    Book, Hash, Gauge, Sparkles, Loader2, Database, Sliders, 
    FileText, Plus, Trash2, Mic, Play, Square, CheckCircle, 
    Award, Check, AlertCircle, HelpCircle
} from 'lucide-react';
import AgentPipelineLoader from '../components/loaders/AgentPipelineLoader';
import toast from 'react-hot-toast';
import { uiTerminology } from '../utils/uiTerminology';

export default function CreateQuizTopic() {
    const [inputs, setInputs] = useState([]);
    const [textPrompt, setTextPrompt] = useState('');
    const [questionCount, setQuestionCount] = useState(5);
    const [difficulty, setDifficulty] = useState('Medium');
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    // Voice recording states
    const [recording, setRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);

    // Analysis states
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzedData, setAnalyzedData] = useState(null);
    const [topicWeights, setTopicWeights] = useState({});

    // Dynamic question flavor state (sums to 100)
    const [ratios, setRatios] = useState({
        theory: 50,
        code_debugging: 25,
        fill_blank: 25,
        scenario: 0
    });

    // ── Inline polling state ──────────────────────────────────────────────────
    const [polling, setPolling]       = useState(false);
    const [stage, setStage]           = useState(0);
    const [stageLabel, setStageLabel] = useState('Generating Questions');
    const [elapsed, setElapsed]       = useState(0);
    const [pollError, setPollError]   = useState(null);
    const pollIntervalRef = useRef(null);
    const startTimeRef    = useRef(null);
    const elapsedRef      = useRef(null);

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
        const otherFlavors = ['theory', 'code_debugging', 'fill_blank', 'scenario'].filter(f => f !== changedFlavor);
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

    // Live Microphone Recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            const chunks = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };
            recorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('file', blob, 'recording.webm');
                
                const toastId = toast.loading('Transcribing live voice recording offline...');
                try {
                    const transcribeRes = await api.post('/quiz/transcribe', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    toast.success('Speech transcribed successfully!', { id: toastId });
                    
                    if (transcribeRes.data && transcribeRes.data.text) {
                        setInputs(prev => [...prev, {
                            id: Math.random().toString(),
                            type: 'voice',
                            content: transcribeRes.data.text,
                            source_name: `Voice Transcript (${new Date().toLocaleTimeString()})`
                        }]);
                        setAnalyzedData(null); // Reset analysis
                    }
                } catch (err) {
                    toast.error('Failed to transcribe voice.', { id: toastId });
                }
            };
            recorder.start();
            setMediaRecorder(recorder);
            setRecording(true);
        } catch (err) {
            toast.error('Could not access microphone. Verify hardware permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder) {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            setRecording(false);
        }
    };

    // Add manual text prompts
    const handleAddTextPrompt = () => {
        if (!textPrompt.trim()) return;
        setInputs(prev => [...prev, {
            id: Math.random().toString(),
            type: 'text',
            content: textPrompt,
            source_name: `Text Prompt: "${textPrompt.substring(0, 20)}..."`
        }]);
        setTextPrompt('');
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
                source_name: file.name
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

    // Step 1: Pre-Analysis
    const handleAnalyzeSources = async () => {
        if (inputs.length === 0) return;
        setAnalyzing(true);
        const formData = new FormData();
        
        const fileInputs = inputs.filter(inp => inp.file);
        const textInputs = inputs.filter(inp => !inp.file);
        
        fileInputs.forEach(inp => {
            formData.append('files', inp.file);
        });
        
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
                setRatios({
                    theory: Math.round((rec.theory || 0) * 100),
                    code_debugging: Math.round((rec.code_debugging || 0) * 100),
                    fill_blank: Math.round((rec.fill_blank || 0) * 100),
                    scenario: Math.round((rec.scenario || 0) * 100),
                });
            }
            
            // Set topic weights matrix
            if (res.data.concepts) {
                const initialWeights = {};
                res.data.concepts.forEach(c => {
                    initialWeights[c.concept_tag] = c.weight_score;
                });
                setTopicWeights(initialWeights);
            }
        } catch (err) {
            console.error(err);
            const errMsg = err.response?.data?.message || 'Academic analysis failed. Please verify your content.';
            toast.error(errMsg, { id: toastId });
        } finally {
            setAnalyzing(false);
        }
    };

    const handleTopicWeightChange = (concept, value) => {
        setTopicWeights(prev => ({
            ...prev,
            [concept]: parseFloat(value)
        }));
    };

    const applyRecommendedRatios = () => {
        if (analyzedData && analyzedData.ai_recommendation) {
            const rec = analyzedData.ai_recommendation;
            setRatios({
                theory: Math.round((rec.theory || 0) * 100),
                code_debugging: Math.round((rec.code_debugging || 0) * 100),
                fill_blank: Math.round((rec.fill_blank || 0) * 100),
                scenario: Math.round((rec.scenario || 0) * 100),
            });
            toast.success('AI recommendations applied!');
        }
    };

    // Step 2: Generation Request
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (inputs.length === 0) return;

        setSubmitting(true);
        
        const targetRatiosPayload = {
            theory: ratios.theory / 100,
            code_debugging: ratios.code_debugging / 100,
            fill_blank: ratios.fill_blank / 100,
            scenario: ratios.scenario / 100
        };

        const formData = new FormData();
        const fileInputs = inputs.filter(inp => inp.file);
        const textInputs = inputs.filter(inp => !inp.file);
        
        fileInputs.forEach(inp => {
            formData.append('files', inp.file);
        });
        
        formData.append('topic', inputs.map(i => i.source_name).join(', '));
        formData.append('questionCount', questionCount);
        formData.append('difficulty', difficulty);
        formData.append('target_ratios', JSON.stringify(targetRatiosPayload));
        formData.append('text_prompts', JSON.stringify(textInputs.map(t => t.content)));
        
        if (analyzedData) {
            formData.append('topic_weights', JSON.stringify(topicWeights));
            formData.append('lobby_summary', analyzedData.lobby_summary || '');
            formData.append('ai_flashcards', JSON.stringify(analyzedData.ai_flashcards || []));
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
            <div className="max-w-7xl mx-auto pb-20 relative px-4 sm:px-6">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--bg-accent-glow)] rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse"></div>

                <div className="mb-10">
                    <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tight italic uppercase">
                        NotebookLM + Kahoot <span className="text-[var(--bg-accent)]">Workspace</span>
                    </h1>
                    <p className="text-[var(--text-secondary)] mt-2 font-bold uppercase tracking-wider text-sm italic">
                        Multi-modal curriculum generation. Upload PDFs, write prompts, record voice, and customize topic weights.
                    </p>
                </div>

                {pollError && (
                    <div className="mb-6 px-5 py-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 font-bold text-sm uppercase tracking-wider">
                        ⚠ {pollError}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* COLUMN 1: INGESTION HUB (lg:col-span-4) */}
                    <div className="lg:col-span-4 bg-white/5 rounded-[2.5rem] border border-[var(--border-color)] p-6 glass-panel space-y-6 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                                <h2 className="text-lg font-black text-[var(--text-primary)] uppercase italic">Inputs Docket</h2>
                                <span className="bg-white/10 text-[var(--text-primary)] px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">
                                    {inputs.length} Sources
                                </span>
                            </div>

                            {/* Inputs list */}
                            {inputs.length === 0 ? (
                                <div className="py-8 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center p-5 bg-black/10">
                                    <Database size={32} className="text-[var(--text-secondary)] mb-3 animate-bounce" />
                                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase">Docket is empty</p>
                                    <p className="text-[10px] text-[var(--text-secondary)]/50 mt-0.5 max-w-[180px]">Add text prompts, upload files, or record speech below</p>
                                </div>
                            ) : (
                                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                                    {inputs.map((inp) => (
                                        <div key={inp.id} className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/5 hover:border-[var(--bg-accent)] transition-all">
                                            <div className="flex items-center gap-2.5 truncate">
                                                <FileText size={16} className="text-[var(--bg-accent)] shrink-0" />
                                                <div className="truncate">
                                                    <p className="text-[11px] font-black text-[var(--text-primary)] uppercase truncate">{inp.source_name}</p>
                                                    <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase">{inp.type}</p>
                                                </div>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveInput(inp.id)}
                                                className="text-red-500 hover:text-red-400 p-1.5 hover:bg-white/5 rounded-full transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Source Adding Controls */}
                            <div className="mt-6 pt-5 border-t border-white/10 space-y-4">
                                {/* File Upload Button */}
                                <div>
                                    <label className="block text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Upload Files (PDF, Image, Docx)</label>
                                    <div className="relative group">
                                        <input 
                                            type="file" 
                                            multiple 
                                            onChange={handleFileUpload} 
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png"
                                        />
                                        <div className="p-3 bg-white/5 hover:bg-white/10 border border-dashed border-white/15 group-hover:border-[var(--bg-accent)] transition-all rounded-xl flex items-center justify-center gap-2">
                                            <Plus size={16} className="text-[var(--text-secondary)]" />
                                            <span className="text-[11px] font-black text-[var(--text-primary)] uppercase">Select Files</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Text Prompt Input */}
                                <div>
                                    <label className="block text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Write Text Prompt / Syllabus Point</label>
                                    <div className="flex gap-2">
                                        <textarea
                                            value={textPrompt}
                                            onChange={(e) => setTextPrompt(e.target.value)}
                                            placeholder="Write core curriculum guidelines..."
                                            rows={2}
                                            className="flex-1 p-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/30 focus:outline-none focus:border-[var(--bg-accent)] resize-none"
                                        />
                                        <button 
                                            type="button"
                                            onClick={handleAddTextPrompt}
                                            className="bg-[var(--bg-accent)] text-[var(--text-on-accent)] px-3 rounded-xl font-black text-[10px] uppercase italic tracking-wider shrink-0 hover:scale-105 active:scale-95 transition-all"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>

                                {/* Microphone live voice record */}
                                <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] font-black text-[var(--text-primary)] uppercase">Live Speech Input</p>
                                        <p className="text-[8px] text-[var(--text-secondary)] font-bold uppercase mt-0.5">Stream transcription offline</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={recording ? stopRecording : startRecording}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                            recording 
                                                ? 'bg-red-600 text-white animate-pulse' 
                                                : 'bg-white/10 hover:bg-white/15 text-[var(--text-primary)]'
                                        }`}
                                    >
                                        {recording ? <Square size={14} /> : <Mic size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Pre-Analysis CTA */}
                        <div className="pt-4 border-t border-white/10 mt-4">
                            <button
                                type="button"
                                onClick={handleAnalyzeSources}
                                disabled={inputs.length === 0 || analyzing}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-wider italic text-xs hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
                            >
                                {analyzing ? <Loader2 className="animate-spin" size={14} /> : <Database size={14} />}
                                {analyzing ? 'ANALYZING...' : 'ANALYZE CURRICULUM SOURCES'}
                            </button>
                        </div>
                    </div>

                    {/* COLUMN 2: TUNING MATRIX (lg:col-span-5) */}
                    <div className="lg:col-span-5 space-y-6">
                        {/* Core settings */}
                        <div className="bg-white/5 rounded-[2.5rem] border border-[var(--border-color)] p-6 glass-panel space-y-6">
                            <h2 className="text-lg font-black text-[var(--text-primary)] uppercase italic border-b border-white/10 pb-3">General Settings</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                                    <div className="bg-[var(--bg-accent)] w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-on-accent)]">
                                        <Hash size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">Question Count</p>
                                        <input
                                            type="number"
                                            min="1"
                                            max="20"
                                            value={questionCount}
                                            onChange={(e) => { const v = parseInt(e.target.value); setQuestionCount(isNaN(v) ? '' : v); }}
                                            className="bg-transparent border-none text-base font-black text-[var(--text-primary)] italic outline-none w-full"
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>

                                <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                                    <div className="bg-purple-600 w-10 h-10 rounded-lg flex items-center justify-center text-white">
                                        <Gauge size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">Difficulty</p>
                                        <select
                                            value={difficulty}
                                            onChange={(e) => setDifficulty(e.target.value)}
                                            className="bg-transparent border-none text-base font-black text-[var(--text-primary)] italic outline-none w-full appearance-none cursor-pointer"
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
                        </div>

                        {/* RAG curriculum concepts placeholder or slides */}
                        {!analyzedData ? (
                            <div className="bg-white/5 rounded-[2.5rem] border border-[var(--border-color)] p-8 glass-panel text-center text-[var(--text-secondary)] font-bold py-16 flex flex-col items-center justify-center uppercase space-y-3">
                                <AlertCircle size={32} className="text-blue-400 animate-pulse" />
                                <p className="text-xs max-w-xs leading-relaxed">Click &quot;Analyze Curriculum Sources&quot; on the left docket to extract curriculum concepts and ratios.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Extracted Topics / Stressed Topics Slider Matrix */}
                                <div className="bg-white/5 rounded-[2.5rem] border border-[var(--border-color)] p-6 glass-panel space-y-4">
                                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                        <div>
                                            <h2 className="text-base font-black text-[var(--text-primary)] uppercase italic">Curriculum Concepts Matrix</h2>
                                            <p className="text-[var(--text-secondary)] text-[8px] font-bold uppercase mt-0.5">Set concept weights to guide generation</p>
                                        </div>
                                        <Award className="text-blue-400" size={20} />
                                    </div>

                                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                        {analyzedData.concepts && analyzedData.concepts.length > 0 ? (
                                            analyzedData.concepts.map((concept, idx) => {
                                                const currentWeight = topicWeights[concept.concept_tag] ?? concept.weight_score;
                                                return (
                                                    <div key={idx} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all space-y-1.5">
                                                        <div className="flex justify-between font-black uppercase text-[10px]">
                                                            <span className="text-[var(--text-primary)] truncate max-w-[180px]">{concept.concept_tag}</span>
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
                                            <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase">No specific concepts isolated.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Dynamic Slider Mix */}
                                <div className="bg-white/5 rounded-[2.5rem] border border-[var(--border-color)] p-6 glass-panel space-y-4">
                                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                        <div>
                                            <h2 className="text-base font-black text-[var(--text-primary)] uppercase italic">Question Type Mix</h2>
                                            <p className="text-[var(--text-secondary)] text-[8px] font-bold uppercase mt-0.5">Customize composition of questions</p>
                                        </div>
                                        {analyzedData.ai_recommendation && (
                                            <button 
                                                type="button" 
                                                onClick={applyRecommendedRatios}
                                                className="px-2.5 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-full text-[9px] font-black uppercase italic hover:bg-blue-600/30 active:scale-95 transition-all flex items-center gap-1.5"
                                            >
                                                <Sparkles size={10} /> Auto-Mix
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-4 pt-2">
                                        <div className="space-y-1">
                                            <div className="flex justify-between font-black uppercase text-[10px] italic">
                                                <span className="text-blue-400">Theory MCQs</span>
                                                <span className="text-[var(--text-primary)] font-black">{ratios.theory}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={ratios.theory}
                                                onChange={(e) => handleSliderChange('theory', e.target.value)}
                                                className="w-full accent-blue-500 bg-white/10 h-2 rounded-lg appearance-none cursor-pointer"
                                                disabled={isLoading}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex justify-between font-black uppercase text-[10px] italic">
                                                <span className="text-purple-400">Code Debugging</span>
                                                <span className="text-[var(--text-primary)] font-black">{ratios.code_debugging}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={ratios.code_debugging}
                                                onChange={(e) => handleSliderChange('code_debugging', e.target.value)}
                                                className="w-full accent-purple-500 bg-white/10 h-2 rounded-lg appearance-none cursor-pointer"
                                                disabled={isLoading}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex justify-between font-black uppercase text-[10px] italic">
                                                <span className="text-amber-400">Fill-in-the-Blank</span>
                                                <span className="text-[var(--text-primary)] font-black">{ratios.fill_blank}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={ratios.fill_blank}
                                                onChange={(e) => handleSliderChange('fill_blank', e.target.value)}
                                                className="w-full accent-amber-500 bg-white/10 h-2 rounded-lg appearance-none cursor-pointer"
                                                disabled={isLoading}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex justify-between font-black uppercase text-[10px] italic">
                                                <span className="text-emerald-400">Scenario Challenges</span>
                                                <span className="text-[var(--text-primary)] font-black">{ratios.scenario}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={ratios.scenario}
                                                onChange={(e) => handleSliderChange('scenario', e.target.value)}
                                                className="w-full accent-emerald-500 bg-white/10 h-2 rounded-lg appearance-none cursor-pointer"
                                                disabled={isLoading}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* COLUMN 3: ACTION PANEL (lg:col-span-3) */}
                    <div className="lg:col-span-3 lg:sticky lg:top-6 space-y-6">
                        <div className="bg-white/5 rounded-[2.5rem] border border-[var(--border-color)] p-6 glass-panel space-y-6">
                            <h2 className="text-lg font-black text-white uppercase italic border-b border-white/10 pb-3">Session Control</h2>
                            
                            <div className="space-y-4">
                                {/* Sources indicator */}
                                <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-2">
                                        <Database size={16} className={inputs.length > 0 ? "text-green-400" : "text-amber-500"} />
                                        <span className="text-xs font-bold text-slate-300 uppercase">Active Sources</span>
                                    </div>
                                    <span className="text-xs font-black text-white uppercase">{inputs.length}</span>
                                </div>

                                {/* Analysis state check */}
                                <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={16} className={analyzedData ? "text-green-400" : "text-amber-500"} />
                                        <span className="text-xs font-bold text-slate-300 uppercase">Analysis Status</span>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                        analyzedData ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                    }`}>
                                        {analyzedData ? 'Analyzed' : 'Pending'}
                                    </span>
                                </div>

                                {/* Ratios state check */}
                                <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-2">
                                        <Sliders size={16} className="text-green-400" />
                                        <span className="text-xs font-bold text-slate-300 uppercase">Ratio Validation</span>
                                    </div>
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                                        100% OK
                                    </span>
                                </div>
                            </div>

                            {/* Golden Generate CTA */}
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={isLoading || inputs.length === 0}
                                    className="group w-full py-4 bg-[var(--bg-accent)] text-[var(--text-on-accent)] rounded-2xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-[var(--bg-accent-glow)] font-black text-sm italic uppercase tracking-wider active:scale-95 border-b-4 border-[var(--bg-accent-hover)] btn-cinematic flex items-center justify-center gap-2"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={14} />}
                                    {isLoading ? 'GENERATING...' : 'GENERATE HYBRID QUIZ'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
