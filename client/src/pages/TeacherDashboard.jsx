import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { 
    FileText, Type, Book, Cpu, Sparkles, Mic, ArrowRight, X as XIcon, Edit3,
    Activity, Radio, Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';

export default function TeacherDashboard() {
    const [showModal, setShowModal] = useState(false);
    const [activeLiveQuiz, setActiveLiveQuiz] = useState(null);
    const navigate = useNavigate();

    // Check for any currently active live quiz hosted by this teacher
    useEffect(() => {
        const fetchActive = async () => {
            try {
                const res = await api.get('/quiz/live/active-teacher');
                if (res.data?.activeQuiz) {
                    setActiveLiveQuiz(res.data.activeQuiz);
                }
            } catch (err) {
                console.error('Error fetching active live quiz:', err);
            }
        };
        fetchActive();
    }, []);

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
            <div className="w-full relative space-y-6">

                {/* ── ACTIVE LIVE CLASSROOM REVISIT BANNER ── */}
                {activeLiveQuiz && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-[2rem] p-6 sm:p-7 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-amber-300/40 relative overflow-hidden"
                    >
                        <div className="flex items-center gap-4 z-10">
                            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
                                <Radio size={28} className="text-white animate-spin" />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="bg-white text-orange-950 font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm">
                                        ⚡ Live Classroom In Progress
                                    </span>
                                    <span className="font-mono text-xs font-bold bg-black/30 px-3 py-0.5 rounded-md border border-white/20">
                                        PIN: {activeLiveQuiz.joinCode}
                                    </span>
                                </div>
                                <h3 className="text-xl font-black mt-1 text-white">
                                    {activeLiveQuiz.title}
                                </h3>
                                <p className="text-xs text-white/95 font-medium max-w-xl">
                                    You have a live room active right now! If you navigated back by mistake, click below to immediately resume question control, view student responses, and control the live room.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate(`/live-room-teacher/${activeLiveQuiz.joinCode}`)}
                            className="w-full md:w-auto px-7 py-4 rounded-2xl bg-white hover:bg-orange-50 text-orange-600 font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer shrink-0 z-10 border-none"
                        >
                            <Play size={18} className="fill-current text-orange-600" />
                            <span>Revisit &amp; Control Live Room</span>
                        </button>
                    </motion.div>
                )}

                <div className="space-y-4">
                    <div className="flex items-center gap-2.5 px-2">
                        <Cpu className="text-[var(--text-accent)]" size={18} />
                        <h2 className="text-xs font-black uppercase tracking-widest text-[#334155]">Universal AI Assessment Engine</h2>
                    </div>

                    <div className="bg-gradient-to-br from-white via-slate-50 to-[var(--accent-sand)]/50 border-2 border-[var(--border-color)] rounded-[2.5rem] p-8 sm:p-10 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative overflow-hidden">
                        <div className="space-y-4 max-w-2xl">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="p-3.5 rounded-2xl bg-[var(--bg-saffron)] text-white shadow-md">
                                    <Sparkles size={26} className="!text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
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

                        <button
                            onClick={() => setShowModal(true)}
                            className="bg-[var(--bg-saffron)] hover:bg-[var(--bg-saffron-hover)] text-white-force flex items-center gap-3 px-8 py-5 rounded-2xl active:scale-95 shadow-lg hover:shadow-xl transition-all shrink-0 cursor-pointer group border-none outline-none"
                            style={{ color: '#ffffff' }}
                        >
                            <span className="font-black text-sm tracking-wider uppercase" style={{ color: '#ffffff' }}>Create Quiz Now</span>
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform !text-white" style={{ color: '#ffffff' }} />
                        </button>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showModal && (
                    <div className="modal-overlay">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowModal(false)}
                            className="modal-backdrop"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            transition={{ type: 'spring', duration: 0.4 }}
                            className="modal-card w-full max-w-md"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="creation-mode-title"
                        >
                            <div className="modal-header bg-gradient-to-r from-white to-slate-50/80">
                                <h3 id="creation-mode-title" className="text-lg font-black text-slate-900 tracking-tight">
                                    Choose Creation Mode
                                </h3>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="modal-close-btn"
                                    aria-label="Close dialog"
                                >
                                    <XIcon size={16} />
                                </button>
                            </div>

                            <div className="p-5 sm:p-6 grid grid-cols-1 gap-2.5">
                                <div
                                    onClick={() => {
                                        setShowModal(false);
                                        navigate('/create-quiz/topic');
                                    }}
                                    className="group relative bg-white hover:bg-violet-50/60 border-2 border-slate-200 hover:border-violet-500 rounded-2xl px-4 py-3.5 flex items-center gap-3.5 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md active:scale-[0.98] select-none"
                                >
                                    <div className="p-2.5 rounded-xl bg-violet-50 border border-violet-100 text-violet-700 group-hover:bg-violet-600 group-hover:text-white transition-all duration-200 flex-shrink-0">
                                        <Sparkles size={18} />
                                    </div>
                                    <h4 className="font-extrabold text-slate-950 text-sm group-hover:text-violet-700 transition-colors flex-1">
                                        AI Creation Studio
                                    </h4>
                                    <ArrowRight size={16} className="text-slate-300 group-hover:translate-x-1 group-hover:text-violet-600 transition-all flex-shrink-0" />
                                </div>

                                <div
                                    onClick={() => {
                                        setShowModal(false);
                                        navigate('/create-quiz/text');
                                    }}
                                    className="group relative bg-white hover:bg-emerald-50/60 border-2 border-slate-200 hover:border-emerald-500 rounded-2xl px-4 py-3.5 flex items-center gap-3.5 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md active:scale-[0.98] select-none"
                                >
                                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-200 flex-shrink-0">
                                        <Edit3 size={18} />
                                    </div>
                                    <h4 className="font-extrabold text-slate-950 text-sm group-hover:text-emerald-700 transition-colors flex-1">
                                        Manual Quiz Builder
                                    </h4>
                                    <ArrowRight size={16} className="text-slate-300 group-hover:translate-x-1 group-hover:text-emerald-600 transition-all flex-shrink-0" />
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
}
