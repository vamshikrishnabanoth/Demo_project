import { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
    X,
    Megaphone,
    Users,
    Clock,
    Lock,
    Eye,
    EyeOff,
    Check,
    Calendar,
    Send,
    Loader2,
    Pin
} from 'lucide-react';

export default function BroadcastModal({ quiz, isOpen, onClose, onBroadcastSuccess }) {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [scheduledFor, setScheduledFor] = useState('');
    const [isPinned, setIsPinned] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [audienceCount, setAudienceCount] = useState(0);

    // Escape Key listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Populate default text when quiz is loaded
    useEffect(() => {
        if (!quiz || !isOpen) return;

        setTitle(`Quiz Release: ${quiz.title}`);
        setMessage(
            `Dear Students,\n\nThe access details for the upcoming evaluation "${quiz.title}" are now available.\n\n📚 Topic: ${quiz.topic || 'General Assessment'}\n⏱️ Duration: ${quiz.duration || quiz.timerPerQuestion * quiz.questions?.length / 60 || 10} minutes\n\nPlease keep the access credentials secure and do not share them outside your group.`
        );

        // Fetch recipient count based on quiz targeting criteria
        const fetchAudienceCount = async () => {
            try {
                let totalCount = 0;
                
                // 1. Group Count
                if (quiz.assignedGroups && quiz.assignedGroups.length > 0) {
                    // Fetch for each group and aggregate
                    const groupCounts = await Promise.all(
                        quiz.assignedGroups.map(async (g) => {
                            const res = await api.get('/students/search', {
                                params: { branch: g.branch, section: g.section, limit: 1 }
                            });
                            return res.data.pagination.total;
                        })
                    );
                    totalCount += groupCounts.reduce((acc, c) => acc + c, 0);
                }

                // 2. Individual Manual Selection Count
                if (quiz.assignedStudents && quiz.assignedStudents.length > 0) {
                    // Deduplicate students who belong to targeted sections
                    const res = await api.get('/students/search', {
                        params: { limit: 100 }
                    });
                    const individualNotIntGroups = res.data.students.filter(s => {
                        const isInTargetGroup = quiz.assignedGroups?.some(
                            g => g.branch === s.studentBranch && g.section === s.section
                        );
                        return quiz.assignedStudents.includes(s.id) && !isInTargetGroup;
                    });
                    totalCount += individualNotIntGroups.length;
                }

                setAudienceCount(totalCount);
            } catch (err) {
                console.error(err);
                setAudienceCount(0);
            }
        };

        fetchAudienceCount();
    }, [quiz, isOpen]);

    const handleSendBroadcast = async () => {
        setIsSending(true);
        try {
            const payload = {
                quizId: quiz.id,
                title,
                message,
                isPinned,
                expiresAt: expiresAt || null,
                scheduledFor: scheduledFor || null
            };

            await api.post('/broadcast/send', payload);
            toast.success(scheduledFor ? 'Announcement scheduled successfully!' : 'Secure broadcast sent successfully!');
            if (onBroadcastSuccess) onBroadcastSuccess();
            onClose();
        } catch (err) {
            console.error('Error sending broadcast:', err);
            toast.error(err.response?.data?.error || 'Failed to dispatch secure broadcast.');
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md transition-opacity" 
                onClick={onClose}
            />

            {/* Modal Box */}
            <div className="relative w-full max-w-4xl bg-[#0b0f19] border border-white/10 rounded-[3rem] p-6 md:p-10 shadow-2xl flex flex-col md:flex-row gap-10 overflow-y-auto max-h-[95vh] custom-scrollbar">
                
                {/* Visual Accent Glow */}
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-amber-400/5 rounded-full blur-[100px] pointer-events-none -z-10 animate-pulse"></div>

                {/* Left Side: Composer Fields */}
                <div className="flex-1 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-400/10 border border-amber-400/20 rounded-2xl text-amber-400">
                            <Megaphone size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Broadcast Release</h2>
                            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Compose Announcement</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Title input */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Broadcast Title</label>
                            <input
                                type="text"
                                placeholder="E.G. QUIZ ACCESS CREDENTIALS..."
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white font-black italic placeholder:text-slate-700 focus:outline-none focus:border-amber-400/30 transition-all uppercase tracking-tight text-sm"
                            />
                        </div>

                        {/* Message input */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Announcement Instructions</label>
                            <textarea
                                rows={6}
                                placeholder="ENTER MESSAGE DETAILS..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-3xl py-4 px-6 text-white font-bold placeholder:text-slate-700 focus:outline-none focus:border-amber-400/30 transition-all text-sm custom-scrollbar"
                            />
                        </div>

                        {/* Expiration Date/Time */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Clock size={12} className="text-amber-400" /> Auto-Expire Broadcast (Optional)</label>
                                <input
                                    type="datetime-local"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white font-black focus:outline-none focus:border-amber-400/30 transition-all text-sm cursor-pointer"
                                />
                            </div>

                            {/* Schedule Date/Time */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Calendar size={12} className="text-purple-400" /> Schedule Release (Optional)</label>
                                <input
                                    type="datetime-local"
                                    value={scheduledFor}
                                    onChange={(e) => setScheduledFor(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white font-black focus:outline-none focus:border-purple-500/30 transition-all text-sm cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Pin Announcement Switch */}
                        <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <Pin size={18} className="text-amber-400" />
                                <div>
                                    <p className="text-xs font-black text-white uppercase italic tracking-wider">Pin Announcement</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Keep at top of student inbox</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPinned(!isPinned)}
                                className={`w-12 h-6 rounded-full transition-all flex items-center p-1 cursor-pointer ${isPinned ? 'bg-amber-400' : 'bg-white/10'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-slate-950 transition-all transform ${isPinned ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Side: High-End Live Card Preview */}
                <div className="w-full md:w-80 flex flex-col justify-between border-t md:border-t-0 md:border-l border-white/10 pt-8 md:pt-0 md:pl-8 space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 italic">
                            <Eye size={14} className="text-purple-400" /> SECURE PREVIEW
                        </h3>

                        {/* Live Announcement Card (Obsidian Aureate Card) */}
                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-[2rem] space-y-5 shadow-2xl relative overflow-hidden group">
                            
                            {/* Card Header */}
                            <div className="space-y-1">
                                <span className="bg-amber-400/10 border border-amber-400/20 text-amber-400 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest italic inline-block">
                                    QUIZ ACCESS NOTICE
                                </span>
                                <h4 className="text-lg font-black text-[var(--text-accent)] uppercase italic tracking-tighter mt-1 line-clamp-1">
                                    {quiz?.title}
                                </h4>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                    Topic: {quiz?.topic || 'General Evaluation'}
                                </p>
                            </div>

                            {/* Secure PIN Field */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">ACCESS PIN</p>
                                    <p className="text-xl font-black text-white tracking-widest mt-1">
                                        {showPin ? quiz?.joinCode : '••••••'}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setShowPin(!showPin)}
                                    className="p-2.5 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors"
                                >
                                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            {/* Dynamic recipients preview badge */}
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 italic bg-white/5 px-4 py-2.5 rounded-xl border border-white/5">
                                <Users size={12} className="text-amber-400" />
                                <span>{audienceCount} DB Recipient{audienceCount !== 1 ? 's' : ''}</span>
                            </div>

                            {/* Warning note */}
                            <div className="flex gap-2 text-[9px] text-red-400 font-bold uppercase tracking-wide leading-relaxed">
                                <Lock size={12} className="shrink-0 mt-0.5 text-red-500" />
                                <span>Strictly restricted to authorized targeting rules. PIN auto-expires with quiz status.</span>
                            </div>

                        </div>
                    </div>

                    {/* Send / Cancel Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={handleSendBroadcast}
                            disabled={isSending}
                            className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 py-4 rounded-2xl font-black italic uppercase tracking-tighter text-sm transition-all active:scale-95 shadow-xl shadow-amber-400/10 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                        >
                            {isSending ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    Dispatching...
                                </>
                            ) : (
                                <>
                                    <Send size={16} />
                                    Send Broadcast
                                </>
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white py-4 rounded-2xl font-black italic uppercase tracking-tighter text-sm transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                    </div>

                </div>

            </div>
        </div>
    );
}
