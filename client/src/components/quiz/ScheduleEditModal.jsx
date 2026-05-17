import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Calendar, Lock, AlertTriangle, CheckCircle, X } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function ScheduleEditModal({ isOpen, onClose, quizId, onSuccess }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusData, setStatusData] = useState(null);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && quizId) {
            fetchStatus();
        }
    }, [isOpen, quizId]);

    const fetchStatus = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get(`/quiz/${quizId}/schedule-status`);
            setStatusData(res.data);
            
            // Format dates for datetime-local input (YYYY-MM-DDThh:mm)
            if (res.data.startTime) {
                const start = new Date(res.data.startTime);
                setStartTime(start.toISOString().slice(0, 16));
            } else {
                setStartTime('');
            }
            if (res.data.endTime) {
                const end = new Date(res.data.endTime);
                setEndTime(end.toISOString().slice(0, 16));
            } else {
                setEndTime('');
            }
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to load schedule status');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setError('');
        
        if (startTime && endTime) {
            if (new Date(endTime) <= new Date(startTime)) {
                setError('End time must be after start time');
                return;
            }
        }

        setSaving(true);
        try {
            await api.patch(`/quiz/${quizId}/schedule`, {
                startTime: startTime || null,
                endTime: endTime || null
            });
            toast.success('Schedule updated successfully');
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to update schedule');
            toast.error(err.response?.data?.msg || 'Failed to update schedule');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />
                
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="relative w-full max-w-xl bg-[#0f172a] rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden glass-panel"
                >
                    {/* Header */}
                    <div className="p-8 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-[var(--bg-accent)]/20 p-3 rounded-2xl">
                                <Calendar className="text-[var(--text-accent)]" size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white italic tracking-wide uppercase">Edit Schedule</h2>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Quiz Timing Configuration</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-white/50 hover:text-white transition-colors bg-white/5 rounded-xl hover:bg-white/10">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-8 space-y-6">
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <div className="w-8 h-8 border-4 border-[var(--bg-accent)] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : statusData?.isLocked ? (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center space-y-4">
                                <Lock className="mx-auto text-red-500" size={32} />
                                <div>
                                    <h3 className="text-red-400 font-black italic uppercase text-lg">Schedule Locked</h3>
                                    <p className="text-red-300/80 text-sm mt-2">
                                        Schedule can no longer be edited because students have already joined or interacted with this quiz.
                                    </p>
                                </div>
                                <div className="flex justify-center gap-4 pt-4 border-t border-red-500/10 text-xs font-bold text-red-400/80">
                                    <span>{statusData.broadcastsCount} Broadcasts</span>
                                    <span>•</span>
                                    <span>{statusData.attemptsCount} Attempts</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Status Indicator */}
                                <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 px-4 py-3 rounded-xl">
                                    <CheckCircle className="text-green-500" size={18} />
                                    <span className="text-xs font-black text-green-400 uppercase tracking-widest">Schedule is Editable</span>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Start Time</label>
                                        <div className="relative">
                                            <input
                                                type="datetime-local"
                                                value={startTime}
                                                onChange={(e) => setStartTime(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-[var(--bg-accent)] transition-colors"
                                            />
                                            <Clock className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">End Time</label>
                                        <div className="relative">
                                            <input
                                                type="datetime-local"
                                                value={endTime}
                                                onChange={(e) => setEndTime(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-[var(--bg-accent)] transition-colors"
                                            />
                                            <Clock className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div className="flex items-start gap-3 text-red-400 bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                                        <span className="text-xs font-bold leading-relaxed">{error}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-white/5 bg-black/20 flex justify-end gap-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-300 hover:text-white transition-colors uppercase tracking-wider"
                        >
                            Cancel
                        </button>
                        {!loading && !statusData?.isLocked && (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-[var(--bg-accent)] text-[var(--text-on-accent)] px-8 py-2.5 rounded-xl font-black italic uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Saving...
                                    </>
                                ) : (
                                    'Save Schedule'
                                )}
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
