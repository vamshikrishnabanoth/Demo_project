import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { 
    FileText, Type, Book, Cpu, Sparkles, Mic, ArrowRight,
    Activity, Radio, Play, Pencil, MinusCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { showConfirm } from '../utils/alerts';

export default function TeacherDashboard() {
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

    const handleEndRoom = async () => {
        if (!activeLiveQuiz) return;
        const result = await showConfirm(
            'End Live Classroom?',
            `Conclude the active live room for "${activeLiveQuiz.title}"? Students will no longer be able to answer questions and the room will be closed.`,
            'Yes, End Room'
        );
        if (!result.isConfirmed) return;
        try {
            await api.post(`/quiz/${activeLiveQuiz.id || activeLiveQuiz._id}/end`);
            setActiveLiveQuiz(null);
            toast.success('Live room ended successfully.');
        } catch (err) {
            try {
                await api.put(`/quiz/${activeLiveQuiz.id || activeLiveQuiz._id}`, { isActive: false, isLive: false, status: 'finished' });
                setActiveLiveQuiz(null);
                toast.success('Live room ended successfully.');
            } catch (err2) {
                toast.error(err.response?.data?.msg || err2.response?.data?.msg || 'Failed to end live room.');
            }
        }
    };

    return (
        <DashboardLayout role="teacher">
            <div className="w-full relative space-y-6">

                {/* ── ACTIVE LIVE CLASSROOM REVISIT BANNER ── */}
                {activeLiveQuiz && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full bg-gradient-to-r from-orange-50/70 via-white to-amber-50/40 rounded-[2rem] p-6 sm:p-7 text-[#0f172a] shadow-[0_8px_30px_rgba(234,88,12,0.08)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-2 border-orange-200/90 relative overflow-hidden"
                    >
                        <div className="flex items-center gap-4 z-10">
                            <div className="w-14 h-14 rounded-2xl bg-[#ea580c] text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-500/25 border border-orange-400/40">
                                <Radio size={28} className="text-white animate-pulse" />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 bg-orange-100/90 text-[#c2410c] border border-orange-200/90 font-black text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full shadow-2xs">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#ea580c] animate-ping" />
                                        ⚡ Live Classroom In Progress
                                    </span>
                                    <span className="font-mono text-xs font-black bg-slate-900 text-white px-3 py-1 rounded-lg border border-slate-800 tracking-wider shadow-2xs">
                                        PIN: {activeLiveQuiz.joinCode}
                                    </span>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black mt-1 text-[#0f172a] tracking-tight">
                                    {activeLiveQuiz.title}
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-600 font-semibold max-w-xl leading-relaxed mt-1">
                                    You have a live room active right now! If you navigated back by mistake, click below to immediately resume question control, view student responses, or advance questions.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto shrink-0 z-10">
                            <button
                                onClick={() => navigate(`/live-room-teacher/${activeLiveQuiz.joinCode}`)}
                                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[#ea580c] hover:bg-[#c2410c] text-white font-black text-xs uppercase tracking-wider shadow-md hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
                            >
                                <Play size={16} className="fill-white text-white" />
                                <span>Revisit Live Room</span>
                            </button>
                            <button
                                onClick={() => navigate('/create-quiz/text', {
                                    state: {
                                        editMode: true,
                                        editQuizId: activeLiveQuiz.id || activeLiveQuiz._id,
                                        editJoinCode: activeLiveQuiz.joinCode,
                                        questions: Array.isArray(activeLiveQuiz.questions) ? activeLiveQuiz.questions : [],
                                        title: activeLiveQuiz.title || '',
                                        timerPerQuestion: activeLiveQuiz.timerPerQuestion || 30,
                                        accessType: activeLiveQuiz.accessType || 'private',
                                        assignedGroups: activeLiveQuiz.assignedGroups || [],
                                        assignedStudents: activeLiveQuiz.assignedStudents || [],
                                    }
                                })}
                                className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-black text-xs uppercase tracking-wider shadow-sm hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                title="Edit questions, delete duplicates, or manage assigned students"
                            >
                                <Pencil size={15} />
                                <span>Edit Live Quiz</span>
                            </button>
                            <button
                                onClick={handleEndRoom}
                                className="w-full sm:w-auto px-4 py-3.5 rounded-2xl bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 font-black text-xs uppercase tracking-wider shadow-xs hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                title="End this live classroom"
                            >
                                <MinusCircle size={15} className="text-rose-600" />
                                <span>End Room</span>
                            </button>
                        </div>
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
                            onClick={() => navigate('/create-quiz')}
                            className="bg-[var(--bg-saffron)] hover:bg-[var(--bg-saffron-hover)] text-white-force flex items-center gap-3 px-8 py-5 rounded-2xl active:scale-95 shadow-lg hover:shadow-xl transition-all shrink-0 cursor-pointer group border-none outline-none"
                            style={{ color: '#ffffff' }}
                        >
                            <span className="font-black text-sm tracking-wider uppercase" style={{ color: '#ffffff' }}>Create Quiz Now</span>
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform !text-white" style={{ color: '#ffffff' }} />
                        </button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
