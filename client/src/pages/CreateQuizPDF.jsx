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

import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { FileText, Upload, CheckCircle, FilePlus, Hash, Activity, Loader2 } from 'lucide-react';
import AgentPipelineLoader from '../components/loaders/AgentPipelineLoader';
import toast from 'react-hot-toast';
import { uiTerminology } from '../utils/uiTerminology';

export default function CreateQuizPDF() {
    const [file, setFile] = useState(null);
    const [questionCount, setQuestionCount] = useState(5);
    const [difficulty, setDifficulty] = useState('Medium');
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

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

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
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
                                    <input
                                        type="file"
                                        accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                        required
                                    />
                                    <div className="p-16 flex flex-col items-center gap-6">
                                        {file ? (
                                            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                                                <div className="bg-[var(--bg-accent)] p-6 rounded-[1.5rem] text-[var(--text-on-accent)] shadow-[0_10px_40px_var(--bg-accent-glow)]">
                                                    <FilePlus size={48} />
                                                </div>
                                                <p className="font-black text-2xl text-[var(--text-primary)] italic tracking-tighter">{file.name}</p>
                                                <p className="text-[var(--text-secondary)] font-bold uppercase tracking-widest text-xs">Ready for processing</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="bg-white/5 p-6 rounded-[1.5rem] text-[var(--text-secondary)] shadow-inner group-hover/upload:text-[var(--bg-accent)] transition-colors">
                                                    <Upload size={48} />
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
                        </div>
                        <FileText className="absolute -right-20 -bottom-20 opacity-[0.03] text-white group-hover:rotate-12 transition-transform duration-700" size={400} />
                    </div>

                    <div className="flex justify-center pt-8">
                        <button
                            type="submit"
                            disabled={isLoading || !file}
                            className="group flex items-center gap-6 bg-[var(--bg-accent)] text-[var(--text-on-accent)] px-20 py-8 rounded-[2.5rem] hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xl shadow-[var(--bg-accent-glow)] font-black text-3xl italic uppercase tracking-tighter active:scale-95 border-b-8 border-[var(--bg-accent-hover)] btn-cinematic"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={32} /> : <CheckCircle size={32} />}
                            {isLoading ? 'PARSING MATERIAL...' : 'ANALYZE DOCUMENT'}
                        </button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
