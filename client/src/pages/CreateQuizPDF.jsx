// import { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import api from '../utils/api';
// import DashboardLayout from '../components/DashboardLayout';
// import { FileText, Upload, Loader2, CheckCircle, FilePlus, Hash, Activity } from 'lucide-react';

// export default function CreateQuizPDF() { hi
//     const [file, setFile] = useState(null);
//     const [questionCount, setQuestionCount] = useState(5);
//     const [difficulty, setDifficulty] = useState('Medium');
//     const [loading, setLoading] = useState(false);
//     const navigate = useNavigate();

//     const handleFileChange = (e) => {
//         setFile(e.target.files[0]);
//     };

//     const handleSubmit = async (e) => {
//         e.preventDefault();
//         if (!file) return;

//         setLoading(true);
//         try {
//             const formData = new FormData();
//             formData.append('file', file);
//             formData.append('type', 'file');
//             formData.append('questionCount', questionCount.toString());
//             formData.append('difficulty', difficulty);

//             const res = await api.post('/quiz/generate', formData, {
//                 headers: { 'Content-Type': 'multipart/form-data' }
//             });

//             navigate('/create-quiz/text', {
//                 state: {
//                     questions: res.data.questions,
//                     title: res.data.title || file.name.replace('.pdf', ''),
//                     duration: res.data.duration || 10
//                 }
//             });
//         } catch (err) {
//             console.error(err);
//             alert('Failed to generate quiz');
//         } finally {
//             setLoading(false);
//         }
//     };

//     return (
//         <DashboardLayout role="teacher">
//             <div className="max-w-4xl mx-auto pb-20 relative">
//                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#ff6b00]/5 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse"></div>

//                 <div className="mb-12 flex items-center justify-between">
//                     <div>
//                         <h1 className="text-4xl font-black text-white tracking-tight italic uppercase">
//                             AI <span className="text-[#ff6b00]">Document Parser</span>
//                         </h1>
//                         <p className="text-slate-400 mt-2 font-bold uppercase tracking-wider text-sm italic">Analyze Slides, Word docs, or Photos to generate questions</p>
//                     </div>
//                 </div>

//                 <form onSubmit={handleSubmit} className="space-y-12">
//                     <div className="bg-white/5 rounded-[3rem] border border-white/10 p-12 ring-1 ring-white/5 relative overflow-hidden group">
//                         <div className="relative z-10 space-y-10">
//                             <div className="space-y-6">
//                                 <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Document</label>
//                                 <div className="relative border-4 border-dashed border-white/10 rounded-[2.5rem] hover:border-[#ff6b00]/50 transition-all bg-white/5 group/upload">
//                                     <input
//                                         type="file"
//                                         accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png"
//                                         onChange={handleFileChange}
//                                         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
//                                         required
//                                     />
//                                     <div className="p-16 flex flex-col items-center gap-6">
//                                         {file ? (
//                                             <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
//                                                 <div className="bg-[#ff6b00] p-6 rounded-[1.5rem] text-white shadow-[0_10px_40px_rgba(255,107,0,0.3)]">
//                                                     <FilePlus size={48} />
//                                                 </div>
//                                                 <p className="font-black text-2xl text-white italic tracking-tighter">{file.name}</p>
//                                                 <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Ready for processing</p>
//                                             </div>
//                                         ) : (
//                                             <>
//                                                 <div className="bg-white/5 p-6 rounded-[1.5rem] text-slate-700 shadow-inner group-hover/upload:text-[#ff6b00] transition-colors">
//                                                     <Upload size={48} />
//                                                 </div>
//                                                 <div className="text-center">
//                                                     <p className="text-white font-black text-2xl italic tracking-tighter">DROP MATERIAL HERE</p>
//                                                     <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">PDF, DOCX, PPTX OR IMAGES (MAX 10MB)</p>
//                                                 </div>
//                                             </>
//                                         )}
//                                     </div>
//                                 </div>
//                             </div>

//                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
//                                 <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 flex items-center gap-6">
//                                     <div className="bg-[#ff6b00] w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl">
//                                         <Hash size={32} />
//                                     </div>
//                                     <div className="flex-1">
//                                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Question Count</p>
//                                         <input
//                                             type="number"
//                                             min="1"
//                                             max="20"
//                                             value={questionCount}
//                                             onChange={(e) => setQuestionCount(parseInt(e.target.value))}
//                                             className="bg-transparent border-none text-2xl font-black text-white italic outline-none w-full"
//                                         />
//                                     </div>
//                                 </div>
//                                 <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 flex items-center gap-6">
//                                     <div className="bg-purple-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl">
//                                         <Activity size={32} />
//                                     </div>
//                                     <div className="flex-1">
//                                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Difficulty</p>
//                                         <select
//                                             value={difficulty}
//                                             onChange={(e) => setDifficulty(e.target.value)}
//                                             className="bg-transparent border-none text-2xl font-black text-white italic outline-none w-full appearance-none cursor-pointer"
//                                         >
//                                             <option value="Easy" className="text-black">Easy</option>
//                                             <option value="Medium" className="text-black">Medium</option>
//                                             <option value="Thinkable" className="text-black">Thinkable</option>
//                                             <option value="Hard" className="text-black">Hard</option>
//                                         </select>
//                                     </div>
//                                 </div>
//                             </div>
//                         </div>
//                         <FileText className="absolute -right-20 -bottom-20 opacity-[0.03] text-white group-hover:rotate-12 transition-transform duration-700" size={400} />
//                     </div>

//                     <div className="flex justify-center pt-8">
//                         <button
//                             type="submit"
//                             disabled={loading || !file}
//                             className="group flex items-center gap-6 bg-[#ff6b00] text-white px-20 py-8 rounded-[2.5rem] hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xl shadow-[#ff6b00]/20 font-black text-3xl italic uppercase tracking-tighter active:scale-95 border-b-8 border-[#cc5500]"
//                         >
//                             {loading ? <Loader2 className="animate-spin" size={32} /> : <CheckCircle size={32} />}
//                             {loading ? 'PARSING MATERIAL...' : 'ANALYZE DOCUMENT'}
//                         </button>
//                     </div>
//                 </form>
//             </div>
//         </DashboardLayout>
//     );
// }

import { useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { FileText, Upload, CheckCircle, FilePlus, Hash, Activity, Loader2, Send } from 'lucide-react';
import AgentPipelineLoader from '../components/loaders/AgentPipelineLoader';
import toast from 'react-hot-toast';
import { uiTerminology } from '../utils/uiTerminology';

export default function CreateQuizPDF() {
    const [file, setFile] = useState(null);
    const [questionCount, setQuestionCount] = useState(5);
    const [difficulty, setDifficulty] = useState('Medium');
    const [submitting, setSubmitting] = useState(false);
    const [startPage, setStartPage] = useState(1);
    const [endPage, setEndPage] = useState('');
    const [maxPages, setMaxPages] = useState(null);
    const [fetchingMetadata, setFetchingMetadata] = useState(false);
    const navigate = useNavigate();

    // Dynamic question flavor state (sums to 100)
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
        const fileName = (file?.name || '').toLowerCase();
        return keywords.some(kw => fileName.includes(kw));
    }, [file]);

    const isImageOrTextScan = useMemo(() => {
        if (!file) return false;
        const ext = file.name.split('.').pop().toLowerCase();
        const nameLower = file.name.toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'txt'].includes(ext) || nameLower.includes('scan') || nameLower.includes('handwritten') || nameLower.includes('handwriting');
    }, [file]);

    const fileLabel = useMemo(() => {
        if (!file) return "Page";
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'pptx' || ext === 'ppt') return "Slide";
        return "Page";
    }, [file]);

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

    // ── Inline polling state ────────────────────────────────────────────────
    const [polling, setPolling]       = useState(false);
    const [stage, setStage]           = useState(0);
    const [stageLabel, setStageLabel] = useState('Generating Questions');
    const [elapsed, setElapsed]       = useState(0);
    const [pollError, setPollError]   = useState(null);
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
    // ───────────────────────────────────────────────────────────────────────

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setMaxPages(null);

        const ext = selectedFile.name.split('.').pop().toLowerCase();
        const isDoc = ['pdf', 'docx', 'pptx', 'ppt', 'xls', 'xlsx'].includes(ext);
        const isImageOrTxt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'txt'].includes(ext) ||
                             selectedFile.name.toLowerCase().includes('scan') ||
                             selectedFile.name.toLowerCase().includes('handwritten') ||
                             selectedFile.name.toLowerCase().includes('handwriting');

        if (isDoc && !isImageOrTxt) {
            setFetchingMetadata(true);
            const formData = new FormData();
            formData.append('file', selectedFile);
            try {
                const res = await api.post('/quiz/file-metadata', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (res.data && res.data.success) {
                    setMaxPages(res.data.totalCount);
                    setEndPage(res.data.totalCount);
                }
            } catch (err) {
                console.error('Error fetching file metadata:', err);
                toast.error('Failed to parse document page count.');
            } finally {
                setFetchingMetadata(false);
            }
        } else {
            setEndPage('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) return;

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'file');
            formData.append('questionCount', questionCount.toString());
            formData.append('difficulty', difficulty);
            formData.append('startPage', startPage.toString());
            formData.append('endPage', (endPage || '999').toString());

            const targetRatiosPayload = {
                CONCEPTS_AND_DEFINITIONS: ratios.CONCEPTS_AND_DEFINITIONS / 100,
                COMPARISONS_AND_TRADEOFFS: ratios.COMPARISONS_AND_TRADEOFFS / 100,
                FORMULAS_AND_CALCULATIONS: ratios.FORMULAS_AND_CALCULATIONS / 100,
                CASE_STUDIES_AND_SCENARIOS: ratios.CASE_STUDIES_AND_SCENARIOS / 100,
                PRACTICAL_AND_LAB_TASKS: ratios.PRACTICAL_AND_LAB_TASKS / 100
            };
            formData.append('target_ratios', JSON.stringify(targetRatiosPayload));

            const res = await api.post('/quiz/generate', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 30000, // only wait for taskId
            });

            const { taskId } = res.data;
            if (!taskId) throw new Error('No taskId returned from server');

            startPolling(taskId, {
                onComplete: (result) => {
                    navigate('/create-quiz/text', {
                        state: {
                            questions:       result.questions,
                            title:           result.title || file.name.replace(/\.[^/.]+$/, ''),
                            duration:        result.duration || 10,
                            source:          'generated',
                            agentReport:     result.agentReport || null,
                            finalValidation: result.finalValidation || null,
                            executionMessages: result.metadata?.executionMessages || []
                        },
                    });
                },
                onError: (msg) => {
                    toast.error(msg || 'Generation failed. Please try again.');
                    setSubmitting(false);
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
                />
            )}
            <div className="max-w-4xl mx-auto pb-20 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--bg-accent-glow)] rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse"></div>

                <div className="mb-12 flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tight italic uppercase">
                            <span className="text-[var(--bg-accent)]">{uiTerminology.creationMethods.files.toUpperCase()}</span>
                        </h1>
                        <p className="text-[var(--text-secondary)] mt-2 font-bold uppercase tracking-wider text-sm italic">Analyze Slides, Word docs, or Photos to generate questions</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-12">
                    <div className="bg-white/5 rounded-[3rem] border border-[var(--border-color)] p-12 ring-1 ring-white/5 relative overflow-hidden group glass-panel">
                        <div className="relative z-10 space-y-10">
                            <div className="space-y-6">
                                <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Select Document</label>
                                <div className="relative border-4 border-dashed border-[var(--border-color)] rounded-[2.5rem] hover:border-[var(--bg-accent)]/50 transition-all bg-white/5 group/upload">
                                    {!file && (
                                        <input
                                            type="file"
                                            accept=".pdf,.docx,.pptx,.ppt,.txt,.jpg,.jpeg,.png,.gif,.webp"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                            required
                                        />
                                    )}
                                    <div className="p-16 flex flex-col items-center gap-6">
                                        {file ? (
                                            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300 z-30 pointer-events-auto">
                                                <div className="bg-[var(--bg-accent)] p-6 rounded-[1.5rem] text-[var(--text-on-accent)] shadow-[0_10px_40px_var(--bg-accent-glow)]">
                                                    <FilePlus size={48} />
                                                </div>
                                                <p className="font-black text-2xl text-[var(--text-primary)] italic tracking-tighter">
                                                    {isImageOrTextScan ? "Handwritten Notes / Text Source" : file.name}
                                                </p>
                                                <p className="text-[var(--text-secondary)] font-bold uppercase tracking-widest text-xs">
                                                    {isImageOrTextScan ? file.name : "Ready for processing"}
                                                </p>
                                                
                                                {fetchingMetadata && (
                                                    <p className="text-[10px] text-purple-400 font-black uppercase tracking-widest animate-pulse mt-2">
                                                        ⚡ Reading document page length...
                                                    </p>
                                                )}

                                                {/* Start/End page selectors inside card */}
                                                {!isImageOrTextScan && (
                                                    <div className="mt-4 flex gap-4 items-center bg-white/5 p-4 rounded-xl border border-white/5">
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Start {fileLabel}</label>
                                                            <input 
                                                                type="number" 
                                                                min="1" 
                                                                max={maxPages || undefined}
                                                                value={startPage} 
                                                                onChange={(e) => {
                                                                    let val = parseInt(e.target.value) || 1;
                                                                    val = Math.max(1, val);
                                                                    if (maxPages && val > maxPages) {
                                                                        val = maxPages;
                                                                    }
                                                                    setStartPage(val);
                                                                }}
                                                                className="w-20 bg-slate-900 border border-white/10 rounded px-2 py-1 text-white text-xs font-bold" 
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">End {fileLabel}</label>
                                                            <input 
                                                                type="number" 
                                                                min="1" 
                                                                max={maxPages || undefined}
                                                                value={endPage} 
                                                                placeholder="All"
                                                                onChange={(e) => {
                                                                    const rawVal = e.target.value;
                                                                    if (rawVal === '') {
                                                                        setEndPage('');
                                                                    } else {
                                                                        let val = parseInt(rawVal) || 1;
                                                                        val = Math.max(1, val);
                                                                        if (maxPages && val > maxPages) {
                                                                            val = maxPages;
                                                                        }
                                                                        setEndPage(val);
                                                                    }
                                                                }}
                                                                className="w-20 bg-slate-900 border border-white/10 rounded px-2 py-1 text-white text-xs font-bold" 
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                <button 
                                                    type="button" 
                                                    onClick={() => { setFile(null); setStartPage(1); setEndPage(''); setMaxPages(null); }} 
                                                    className="mt-2 text-xs font-black uppercase text-red-500 hover:text-red-400 border border-red-500/20 px-4 py-2 rounded-xl hover:bg-red-500/5 transition-all"
                                                >
                                                    Remove File
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="download-button mt-4">
                                                    <div className="docs">
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                                            <polyline points="14 2 14 8 20 8" />
                                                        </svg>
                                                        Upload Document
                                                    </div>
                                                    <div className="download">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="7 10 12 15 17 10" />
                                                            <line x1="12" y1="15" x2="12" y2="3" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[var(--text-primary)] font-black text-2xl italic tracking-tighter">DROP MATERIAL HERE</p>
                                                    <p className="text-[var(--text-secondary)] font-bold uppercase tracking-widest text-xs mt-2">PDF, DOCX, PPTX OR IMAGES (MAX 10MB)</p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-white/5 p-8 rounded-[2rem] border border-[var(--border-color)] flex items-center gap-6 glass-panel">
                                    <div className="bg-[var(--bg-accent)] w-16 h-16 rounded-2xl flex items-center justify-center text-[var(--text-on-accent)] shadow-xl">
                                        <Hash size={32} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1">Question Count</p>
                                        <input
                                            type="number"
                                            min="1"
                                            max="20"
                                            value={questionCount}
                                            onChange={(e) => { const v = parseInt(e.target.value); setQuestionCount(isNaN(v) ? '' : v); }}
                                            className="bg-transparent border-none text-2xl font-black text-[var(--text-primary)] italic outline-none w-full"
                                        />
                                    </div>
                                </div>
                                <div className="bg-white/5 p-8 rounded-[2rem] border border-[var(--border-color)] flex items-center gap-6 glass-panel">
                                    <div className="bg-purple-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl">
                                        <Activity size={32} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1">Difficulty</p>
                                        <select
                                            value={difficulty}
                                            onChange={(e) => setDifficulty(e.target.value)}
                                            className="bg-transparent border-none text-2xl font-black text-[var(--text-primary)] italic outline-none w-full appearance-none cursor-pointer"
                                        >
                                            <option value="Easy" style={{ color: '#ffffff', backgroundColor: '#0f172a' }}>Easy</option>
                                            <option value="Medium" style={{ color: '#ffffff', backgroundColor: '#0f172a' }}>Medium</option>
                                            <option value="Thinkable" style={{ color: '#ffffff', backgroundColor: '#0f172a' }}>Thinkable</option>
                                            <option value="Hard" style={{ color: '#ffffff', backgroundColor: '#0f172a' }}>Hard</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/5 p-8 rounded-[2rem] border border-[var(--border-color)] glass-panel space-y-4">
                                <p className="text-xs font-black text-[var(--text-secondary)] uppercase italic">Question Distribution</p>
                                <div className="space-y-4">
                                    {/* CONCEPTS_AND_DEFINITIONS */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between font-black uppercase text-[10px] italic">
                                            <span className="text-blue-400">Theory</span>
                                            <span className="text-[var(--text-primary)]">{ratios.CONCEPTS_AND_DEFINITIONS}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={ratios.CONCEPTS_AND_DEFINITIONS}
                                            onChange={(e) => handleSliderChange('CONCEPTS_AND_DEFINITIONS', e.target.value)}
                                            className="w-full accent-blue-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>

                                    {/* COMPARISONS_AND_TRADEOFFS */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between font-black uppercase text-[10px] italic">
                                            <span className="text-purple-400">Analytical Reasoning</span>
                                            <span className="text-[var(--text-primary)]">{ratios.COMPARISONS_AND_TRADEOFFS}%</span>
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
                                            <span className="text-[var(--text-primary)]">{ratios.FORMULAS_AND_CALCULATIONS}%</span>
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
                                            <span className="text-[var(--text-primary)]">{ratios.CASE_STUDIES_AND_SCENARIOS}%</span>
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
                                            <span className="text-[var(--text-primary)]">{ratios.PRACTICAL_AND_LAB_TASKS}%</span>
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
                            </div>
                        </div>
                        <FileText className="absolute -right-20 -bottom-20 opacity-[0.03] text-white group-hover:rotate-12 transition-transform duration-700" size={400} />
                    </div>

                    <div className="flex justify-center pt-8">
                        <button
                            type="submit"
                            disabled={isLoading || !file}
                            className={`button-fly button-fly-reversed ${isLoading ? 'is-loading' : ''} disabled:opacity-80 disabled:cursor-not-allowed`}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    <span>PUBLISHING...</span>
                                </>
                            ) : (
                                <>
                                    <span>PUBLISH</span>
                                    <div className="svg-wrapper">
                                        <Send size={18} />
                                    </div>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
