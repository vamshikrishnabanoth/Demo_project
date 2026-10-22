import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Calendar, Lock, AlertTriangle, X as XIcon } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function ScheduleEditModal({ isOpen, onClose, quizId, onSuccess }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusData, setStatusData] = useState(null);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [error, setError] = useState('');
    const panelRef = useRef(null);

    useEffect(() => {
        if (isOpen && quizId) {
            fetchStatus();
        }
    }, [isOpen, quizId]);

    // Keyboard dismiss
    useEffect(() => {
        if (!isOpen) return;
        const handle = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handle);
        return () => window.removeEventListener('keydown', handle);
    }, [isOpen, onClose]);

    const formatToLocalDatetime = (date) => {
        if (!date) return '';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const parseLocalDatetime = (localStr) => {
        if (!localStr) return null;
        const [datePart, timePart] = localStr.split('T');
        if (!datePart || !timePart) return new Date(localStr);
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hours, minutes);
    };

    const fetchStatus = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get(`/quiz/${quizId}/schedule-status`);
            setStatusData(res.data);
            setStartTime(formatToLocalDatetime(res.data.startTime));
            setEndTime(formatToLocalDatetime(res.data.endTime));
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to load schedule status');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setError('');
        if (startTime && endTime) {
            const startObj = parseLocalDatetime(startTime);
            const endObj = parseLocalDatetime(endTime);
            if (endObj <= startObj) {
                setError('End time must be after start time');
                return;
            }
        }
        setSaving(true);
        try {
            await api.patch(`/quiz/${quizId}/schedule`, {
                startTime: startTime ? parseLocalDatetime(startTime).toISOString() : null,
                endTime: endTime ? parseLocalDatetime(endTime).toISOString() : null
            });
            toast.success('Schedule updated successfully');
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to update schedule');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                /* Non-blocking bottom-right floating drawer — no backdrop, no overlay */
                <motion.div
                    ref={panelRef}
                    key="schedule-drawer"
                    initial={{ opacity: 0, y: 40, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 40, scale: 0.97 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 340 }}
                    className="fixed bottom-6 right-6 z-50 w-full max-w-md"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Edit Quiz Schedule"
                >
                    <div className="bg-[#0f172a] border border-white/10 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] overflow-hidden">
                        {/* Header */}
                        <div className="px-6 pt-6 pb-4 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-[var(--bg-accent,#ea580c)]/20 p-2.5 rounded-2xl">
                                    <Calendar className="text-[var(--text-accent,#fb923c)]" size={20} />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-white uppercase tracking-wide">Edit Schedule</h2>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Quiz Timing</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 text-white/40 hover:text-white transition-colors bg-white/5 rounded-xl hover:bg-white/10 cursor-pointer"
                                aria-label="Close"
                            >
                                <XIcon size={18} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-5 space-y-4">
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <div className="w-7 h-7 border-3 border-[var(--bg-accent,#ea580c)] border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                <>
                                    {statusData?.isLocked && (
                                        <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-2xl flex items-start gap-3">
                                            <Lock size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-xs font-black text-amber-400 uppercase tracking-widest">Schedule Locked</p>
                                                <p className="text-[10px] font-medium text-slate-400 mt-1 leading-relaxed">
                                                    Students have already joined — timing cannot be modified.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Time</label>
                                        <div className="relative">
                                            <input
                                                type="datetime-local"
                                                value={startTime}
                                                onChange={(e) => setStartTime(e.target.value)}
                                                disabled={statusData?.isLocked}
                                                className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm outline-none focus:border-[var(--bg-accent,#ea580c)] transition-colors ${statusData?.isLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                                            />
                                            <Clock className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" size={15} />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End Time</label>
                                        <div className="relative">
                                            <input
                                                type="datetime-local"
                                                value={endTime}
                                                onChange={(e) => setEndTime(e.target.value)}
                                                disabled={statusData?.isLocked}
                                                className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm outline-none focus:border-[var(--bg-accent,#ea580c)] transition-colors ${statusData?.isLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                                            />
                                            <Clock className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" size={15} />
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="flex items-start gap-2.5 text-red-400 bg-red-500/10 p-3.5 rounded-xl border border-red-500/20">
                                            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                                            <span className="text-xs font-bold leading-relaxed">{error}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        {!loading && (
                            <div className="px-6 pb-6 flex justify-end gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-400 hover:text-white transition-colors uppercase tracking-wider cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || statusData?.isLocked}
                                    className={`bg-[var(--bg-accent,#ea580c)] text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 text-xs cursor-pointer ${(saving || statusData?.isLocked) ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Saving…
                                        </>
                                    ) : 'Save Schedule'}
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
