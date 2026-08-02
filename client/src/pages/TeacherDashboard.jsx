import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { 
    FileText, Type, Book, Cpu, Sparkles, Mic, ArrowRight, X, Edit3 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TeacherDashboard() {
    const [showModal, setShowModal] = useState(false);
    const navigate = useNavigate();

    // Close on Escape key press
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setShowModal(false);
            }
        };
        if (showModal) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal]);

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-[100rem] mx-auto px-6 py-6 relative">
                {/* Universal AI Creation Studio — Single Unified Input Option */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2.5 px-2">
                        <Cpu className="text-[var(--text-accent)]" size={18} />
                        <h2 className="text-xs font-black uppercase tracking-widest text-[#334155]">Universal AI Assessment Engine</h2>
                    </div>

                    {/* Informational Container Card (Non-clickable container) */}
                    <div className="bg-gradient-to-br from-white via-slate-50 to-[var(--accent-sand)]/50 border-2 border-[var(--border-color)] rounded-[2.5rem] p-8 sm:p-10 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative overflow-hidden">
                        <div className="space-y-4 max-w-2xl">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="p-3.5 rounded-2xl bg-[var(--bg-saffron)] text-white text-white-force shadow-md">
                                    <Sparkles size={26} className="!text-white text-white-force" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                                </div>
                                <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-[var(--accent-sand)] text-[var(--text-accent)] border border-[var(--border-color)]">
                                    All-In-One Multimodal Input Studio
                                </span>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-2xl sm:text-3xl font-black text-[#0f172a] italic tracking-tight" style={{ color: '#0f172a' }}>
                                    Universal <span className="text-[var(--text-accent)]">AI Quiz Creator</span>
                                </h3>
                                <p className="text-sm font-bold text-[#334155] leading-relaxed" style={{ color: '#334155' }}>
                                    Generate comprehensive assessments from any input format — Syllabus Topics, PDF Documents, Raw Text Prompts, Voice Recordings, or Video Content.
                                </p>
                            </div>

                            {/* Input Types Badges */}
                            <div className="flex flex-wrap gap-2 pt-2">
                                {[
                                    { label: 'Topics & Concepts', icon: Book },
                                    { label: 'PDFs & Documents', icon: FileText },
                                    { label: 'Raw Text & Code', icon: Type },
                                    { label: 'Voice & Lectures', icon: Mic }
                                ].map((inputItem, i) => (
                                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-white border border-slate-300 text-[#0f172a] shadow-2xs">
                                        <inputItem.icon size={14} className="text-[var(--text-accent)]" />
                                        <span>{inputItem.label}</span>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Button triggering modal */}
                        <button
                            onClick={() => setShowModal(true)}
                            className="bg-[var(--bg-saffron)] hover:bg-[var(--bg-saffron-hover)] text-white-force teacher-launch-btn flex items-center gap-3 px-8 py-5 rounded-2xl active:scale-95 shadow-lg hover:shadow-xl transition-all shrink-0 cursor-pointer group border-none outline-none"
                            style={{ color: '#ffffff' }}
                        >
                            <span className="font-black text-sm tracking-wider uppercase" style={{ color: '#ffffff' }}>Create Quiz Now</span>
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform !text-white" style={{ color: '#ffffff' }} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Premium Create Quiz Selection Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop with Blur */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowModal(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                        />

                        {/* Modal Dialog Card */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            transition={{ type: 'spring', duration: 0.4 }}
                            className="bg-white border-2 border-slate-200 w-full max-w-3xl rounded-[2.5rem] shadow-2xl relative overflow-hidden z-10 flex flex-col p-6 sm:p-8 md:p-10 gap-6"
                        >
                            {/* Close Button */}
                            <button
                                onClick={() => setShowModal(false)}
                                className="absolute top-6 right-6 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 transition-all cursor-pointer border-none outline-none"
                                aria-label="Close dialog"
                            >
                                <X size={18} />
                            </button>

                            {/* Header */}
                            <div className="space-y-1">
                                <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-violet-50 text-violet-700 border border-violet-200">
                                    Assessment Studio
                                </span>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                                    Choose Creation Mode
                                </h3>
                                <p className="text-xs font-semibold text-slate-500">
                                    Select how you would like to build and configure your assessment quiz.
                                </p>
                            </div>

                            {/* Cards Container */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                {/* Card 1: AI Creation Studio */}
                                <div
                                    onClick={() => {
                                        setShowModal(false);
                                        navigate('/create-quiz/topic');
                                    }}
                                    className="group relative bg-gradient-to-br from-slate-50 to-white hover:from-white hover:to-white border-2 border-slate-200 hover:border-violet-500 rounded-3xl p-6 flex flex-col gap-4 transition-all duration-300 cursor-pointer shadow-xs hover:shadow-xl active:scale-[0.98] select-none text-left"
                                >
                                    {/* Accent background glow */}
                                    <div className="absolute inset-0 bg-violet-600/[0.01] rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

                                    <div className="flex items-center justify-between">
                                        <div className="p-3 rounded-2xl bg-violet-50 border border-violet-100 text-violet-700 group-hover:bg-violet-600 group-hover:text-white transition-all duration-300">
                                            <Sparkles size={22} />
                                        </div>
                                        <ArrowRight size={16} className="text-slate-400 group-hover:translate-x-1 group-hover:text-violet-600 transition-all" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-extrabold text-slate-950 text-base group-hover:text-violet-700 transition-colors">
                                            AI Creation Studio
                                        </h4>
                                        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                                            Auto-generate high-quality quizzes from topics, raw text description, PDFs, or lecture recordings.
                                        </p>
                                    </div>
                                    <div className="mt-auto pt-2 flex flex-wrap gap-1">
                                        {['Topics', 'PDFs', 'Voice', 'Whisper'].map((tag) => (
                                            <span key={tag} className="text-[9px] font-black uppercase tracking-wider bg-slate-100 group-hover:bg-violet-50 group-hover:text-violet-700 px-2 py-0.5 rounded-md text-slate-600 transition-colors">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Card 2: Manual Quiz Builder */}
                                <div
                                    onClick={() => {
                                        setShowModal(false);
                                        navigate('/create-quiz/text');
                                    }}
                                    className="group relative bg-gradient-to-br from-slate-50 to-white hover:from-white hover:to-white border-2 border-slate-200 hover:border-emerald-500 rounded-3xl p-6 flex flex-col gap-4 transition-all duration-300 cursor-pointer shadow-xs hover:shadow-xl active:scale-[0.98] select-none text-left"
                                >
                                    {/* Accent background glow */}
                                    <div className="absolute inset-0 bg-emerald-600/[0.01] rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

                                    <div className="flex items-center justify-between">
                                        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                                            <Edit3 size={22} />
                                        </div>
                                        <ArrowRight size={16} className="text-slate-400 group-hover:translate-x-1 group-hover:text-emerald-600 transition-all" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-extrabold text-slate-950 text-base group-hover:text-emerald-700 transition-colors">
                                            Manual Quiz Builder
                                        </h4>
                                        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                                            Build custom quizzes manually, write questions & answers, upload Aiken files, or edit templates.
                                        </p>
                                    </div>
                                    <div className="mt-auto pt-2 flex flex-wrap gap-1">
                                        {['Aiken Format', 'JSON Paste', 'Manual Matrix'].map((tag) => (
                                            <span key={tag} className="text-[9px] font-black uppercase tracking-wider bg-slate-100 group-hover:bg-emerald-50 group-hover:text-emerald-700 px-2 py-0.5 rounded-md text-slate-600 transition-colors">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
}
