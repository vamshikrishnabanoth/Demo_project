import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import socket from '../../utils/socket';
import toast from 'react-hot-toast';
import { uiTerminology } from '../../utils/uiTerminology';
import {
    Megaphone,
    Clock,
    Lock,
    Eye,
    EyeOff,
    Copy,
    Check,
    Play,
    Bell,
    CheckCheck,
    Pin,
    Calendar,
    Sparkles,
    ShieldAlert
} from 'lucide-react';

export default function StudentBroadcasts({ onDirectJoin }) {
    const [broadcasts, setBroadcasts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [revealedPins, setRevealedPins] = useState({}); // broadcastId -> boolean
    const [copiedStates, setCopiedStates] = useState({}); // broadcastId -> boolean
    const [now, setNow] = useState(new Date());

    // Update countdown timer every second
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const fetchBroadcasts = async () => {
        try {
            const res = await api.get('/broadcast/student');
            setBroadcasts(res.data);
        } catch (err) {
            console.error('Error fetching secure announcements:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBroadcasts();

        // Listen for real-time secure releases
        socket.on('new_broadcast', (newB) => {
            // Trigger beautiful standard alert
            toast.custom((t) => (
                <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-[#0b0f19]/95 border border-amber-400/30 backdrop-blur-xl p-5 rounded-[2rem] flex items-start gap-4 shadow-2xl relative overflow-hidden`}>
                    <div className="absolute top-0 left-0 w-2 h-full bg-amber-400"></div>
                    <div className="p-3 bg-amber-400/10 border border-amber-400/20 rounded-2xl text-amber-400 shrink-0">
                        <Megaphone size={20} />
                    </div>
                    <div className="flex-1 space-y-1">
                        <p className="text-xs font-black text-amber-400 uppercase tracking-widest">SECURE ACCESS BROADCAST</p>
                        <p className="text-sm font-black text-white uppercase italic tracking-tighter">{newB.title}</p>
                        <p className="text-xs text-slate-400 line-clamp-2">{newB.message}</p>
                    </div>
                </div>
            ), { duration: 6000 });

            // Refresh announcement box
            fetchBroadcasts();
        });

        return () => {
            socket.off('new_broadcast');
        };
    }, []);

    // Toggle PIN Visibility
    const togglePinVisibility = (id) => {
        setRevealedPins(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Copy Access PIN
    const copyToClipboard = (id, pin) => {
        if (!pin || pin === 'EXPIRED') return;
        navigator.clipboard.writeText(pin);
        setCopiedStates(prev => ({ ...prev, [id]: true }));
        toast.success('Access PIN copied to clipboard!');
        setTimeout(() => {
            setCopiedStates(prev => ({ ...prev, [id]: false }));
        }, 2000);
    };

    // Mark Broadcast Announcement as Read
    const markAsRead = async (id) => {
        try {
            await api.post(`/broadcast/read/${id}`);
            setBroadcasts(prev => prev.map(b => b.id === id ? { ...b, isRead: true } : b));
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    };

    // Helper: Format Countdown Time
    const getCountdown = (expiresAt) => {
        if (!expiresAt) return null;
        const expiry = new Date(expiresAt);
        const diff = expiry - now;
        if (diff <= 0) return 'EXPIRED';

        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);

        if (mins > 60) {
            const hrs = Math.floor(mins / 60);
            return `${hrs}h ${mins % 60}m`;
        }

        return `${mins}m ${secs}s`;
    };

    if (loading) {
        return (
            <div className="bg-white/[0.01] border border-white/5 p-8 rounded-[3rem] flex items-center justify-center gap-3">
                <span className="premium-spinner-ring w-6 h-6"></span>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs italic animate-pulse">Syncing secure broadcast feed...</p>
            </div>
        );
    }

    // Filter active pinned vs unpinned for perfect Discord/Teams organization
    const pinnedBroadcasts = broadcasts.filter(b => b.isPinned);
    const unpinnedBroadcasts = broadcasts.filter(b => !b.isPinned);
    const orderedBroadcasts = [...pinnedBroadcasts, ...unpinnedBroadcasts];

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-400/10 border border-amber-400/20 rounded-xl text-amber-400">
                        <Bell size={18} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Secure Releases</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Authorized class announcements</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="bg-white/5 border border-white/5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400 italic">
                        {broadcasts.filter(b => !b.isRead).length} Unread
                    </span>
                </div>
            </div>

            {/* Announcements Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {orderedBroadcasts.map((b) => {
                    const countdown = getCountdown(b.expiresAt);
                    const isExpired = countdown === 'EXPIRED' || b.pin === 'EXPIRED' || b.isExpired;
                    const isRead = b.isRead;
                    const isPinned = b.isPinned;
                    const isRevealed = revealedPins[b.id];
                    const isCopied = copiedStates[b.id];

                    return (
                        <div 
                            key={b.id}
                            onClick={() => !isRead && markAsRead(b.id)}
                            className={`bg-[var(--bg-secondary)] border p-6 rounded-[2.5rem] flex flex-col justify-between gap-6 hover:border-[var(--bg-accent)]/30 transition-all group relative overflow-hidden shadow-2xl ${isPinned ? 'border-amber-400/20' : 'border-[var(--border-color)]'}`}
                        >
                            
                            {/* Pinned visual accent line */}
                            {isPinned && <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400"></div>}

                            {/* Card Header */}
                            <div className="space-y-4 relative z-10">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        {isPinned && (
                                            <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full italic">
                                                <Pin size={8} /> Pinned
                                            </span>
                                        )}
                                        {!isRead && (
                                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                                        )}
                                    </div>

                                    {/* Timer/Expiration Badge */}
                                    {b.expiresAt && (
                                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider italic ${isExpired ? 'text-red-400 bg-red-400/10 border border-red-400/20' : 'text-amber-400 bg-amber-400/10 border border-amber-400/20'}`}>
                                            <Clock size={10} />
                                            <span>{isExpired ? 'Expired' : countdown}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <h4 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none group-hover:text-[var(--text-accent)] transition-colors">
                                        {b.title}
                                    </h4>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                        Instructor: <span className="text-slate-400 italic">{b.senderName}</span>
                                    </p>
                                </div>

                                <p className="text-xs text-slate-400 font-medium leading-relaxed whitespace-pre-line bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
                                    {b.message}
                                </p>
                            </div>

                            {/* Access PIN Card & Actions */}
                            <div className="space-y-4 relative z-10">
                                
                                {/* Target PIN Release card */}
                                <div className={`border p-4 rounded-2xl flex items-center justify-between gap-4 transition-all ${isExpired ? 'bg-red-500/5 border-red-500/10' : 'bg-white/5 border-white/10'}`}>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                            {isExpired ? <ShieldAlert size={10} className="text-red-500" /> : <Lock size={10} className="text-amber-400" />}
                                            SECURE PIN RELEASE
                                        </p>
                                        <p className={`text-xl font-black tracking-widest mt-1 uppercase ${isExpired ? 'text-red-400 italic text-sm mt-2' : 'text-white'}`}>
                                            {isExpired ? 'ACCESS RESTRICTED' : isRevealed ? b.pin : '••••••'}
                                        </p>
                                    </div>
                                    
                                    {!isExpired && (
                                        <div className="flex items-center gap-1.5">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    togglePinVisibility(b.id);
                                                }}
                                                className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors"
                                                title={isRevealed ? "Hide PIN" : "Reveal PIN"}
                                            >
                                                {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    copyToClipboard(b.id, b.pin);
                                                }}
                                                className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors"
                                                title="Copy PIN"
                                            >
                                                {isCopied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Direct Arena Sync Button */}
                                {!isExpired && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onDirectJoin) onDirectJoin(b.pin);
                                        }}
                                        className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 py-3.5 rounded-2xl font-black italic uppercase tracking-[0.2em] text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-amber-400/5 group/btn"
                                    >
                                        <Sparkles size={12} className="animate-pulse" />
                                        {uiTerminology.deployToArena.toUpperCase()}
                                    </button>
                                )}

                            </div>

                            {/* Mini background symbol decoration */}
                            <div className="absolute -right-16 -bottom-16 opacity-[0.01] text-white group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
                                <Megaphone size={160} />
                            </div>

                        </div>
                    );
                })}
            </div>

            {broadcasts.length === 0 && (
                <div className="bg-white/[0.01] border border-white/5 p-16 rounded-[3rem] text-center space-y-4">
                    <Megaphone size={40} className="text-slate-700 mx-auto" />
                    <div className="space-y-1">
                        <h4 className="font-black text-white uppercase italic tracking-tighter">No Active Releases</h4>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">Verified broadcast release log is currently empty</p>
                    </div>
                </div>
            )}

        </div>
    );
}
