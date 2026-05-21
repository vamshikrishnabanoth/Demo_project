import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, CheckCircle, Zap, AlertTriangle } from 'lucide-react';
import { parseAiken } from '../../utils/parsers';
import { PremiumButton } from '../ui/Primitives';
import toast from 'react-hot-toast';

export default function AikenUploadPanel({ onQuestionsLoaded }) {
    const [dragOver, setDragOver] = useState(false);
    const [fileName, setFileName] = useState('');
    const [rawText, setRawText] = useState('');
    const [parsed, setParsed] = useState(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [fileError, setFileError] = useState('');
    const fileInputRef = useRef();

    const handleFile = (file) => {
        if (!file) return;
        if (!file.name.match(/\.(txt|aiken)$/i)) {
            const errMsg = 'Please upload a .txt or .aiken file.';
            setFileError(errMsg);
            toast.error(errMsg);
            setFileName('');
            setParsed(null);
            setPreviewOpen(false);
            return;
        }
        setFileName(file.name);
        setFileError('');
        setParsed(null);
        setPreviewOpen(false);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            setRawText(text);
            const result = parseAiken(text);
            
            if (!result.isValid) {
                const errorMsgStr = 'Invalid AIKEN format detected. Please check the uploaded file format.';
                setFileError(errorMsgStr);
                toast.error(errorMsgStr, {
                    duration: 6000,
                    id: 'aiken-upload-error'
                });
                return;
            }
            
            setParsed(result);
            setPreviewOpen(true);
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Format Guide */}
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-3xl p-8 backdrop-blur-xl">
                <div className="flex items-center gap-3 mb-4">
                    <FileText size={20} className="text-indigo-400" />
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">AIKEN Format Protocol</span>
                </div>
                <pre className="text-indigo-100/40 text-xs font-mono leading-relaxed whitespace-pre-wrap bg-black/20 p-4 rounded-xl border border-white/5">
                    {`What is the capital of France?\nA. Berlin\nB. Paris\nC. Madrid\nD. Rome\nANSWER: B`}
                </pre>
            </div>

            {/* Drop Zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileInputRef.current?.click()}
                className={`
                    relative border-4 border-dashed rounded-[3rem] p-16 text-center cursor-pointer transition-all duration-500
                    ${dragOver ? 'border-[var(--bg-accent)] bg-[var(--bg-accent)]/10 scale-[1.02]' : 'border-white/10 bg-white/[0.02] hover:border-[var(--bg-accent)]/30 hover:bg-white/[0.04]'}
                `}
            >
                <input ref={fileInputRef} type="file" accept=".txt,.aiken" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
                <div className="bg-white/5 w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-white/10">
                    <Upload size={32} className={dragOver ? 'text-[var(--text-accent)]' : 'text-white/20'} />
                </div>
                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-2">
                    {fileName || 'Drop Intelligence File'}
                </h3>
                <p className="text-white/30 text-[10px] font-black uppercase tracking-widest">Supports .txt & .aiken (Max 5MB)</p>
            </div>

            {fileError && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-[2rem] p-6 flex items-start gap-4 animate-in slide-in-from-top-2">
                    <AlertTriangle className="text-red-500 shrink-0 mt-1" size={20} />
                    <div className="text-left">
                        <p className="text-red-400 text-sm font-black uppercase tracking-wider mb-1">AIKEN Format Error</p>
                        <p className="text-red-300/80 text-xs font-medium leading-relaxed">{fileError}</p>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {previewOpen && parsed && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="glass-panel p-8 rounded-[2.5rem] border border-green-500/20 bg-green-500/5">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <CheckCircle className="text-green-500" size={20} />
                                    <span className="text-sm font-black text-white uppercase italic">{parsed.questions.length} Questions Decoded & Verified</span>
                                </div>
                                <PremiumButton variant="primary" onClick={() => onQuestionsLoaded(parsed.questions)}>
                                    Inject Questions
                                </PremiumButton>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
