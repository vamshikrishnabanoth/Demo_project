import React from 'react';
import {
    X, User, Mail, Calendar, BookOpen, Grid, BookMarked,
    Shield, Clock, KeyRound, Ban, Edit3, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function StatusBadge({ suspended, online }) {
    if (suspended)
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200"><span className="w-2 h-2 rounded-full bg-rose-500" />Suspended</span>;
    if (online)
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Online</span>;
    return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200"><span className="w-2 h-2 rounded-full bg-slate-400" />Offline</span>;
}

export default function StudentProfileModal({ student, onClose, onEdit, onSuspend }) {
    if (!student) return null;

    const initials = student.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || student.username.slice(0, 2).toUpperCase();

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

                <motion.div initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="relative z-10 w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">

                    {/* Banner */}
                    <div className="h-28 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 relative p-6 flex items-start justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-400 bg-sky-950/80 px-2.5 py-1 rounded-md border border-sky-800/50">
                            Student Profile Record
                        </span>
                        <button onClick={onClose} className="p-1.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Header Info */}
                    <div className="px-6 pb-6 pt-0 relative border-b border-slate-200">
                        <div className="flex items-end justify-between -mt-10 mb-3">
                            <div className="w-20 h-20 rounded-2xl bg-sky-600 border-4 border-white text-white font-black text-2xl flex items-center justify-center shadow-lg">
                                {initials}
                            </div>
                            <StatusBadge suspended={student.isSuspended} online={student.isOnline} />
                        </div>

                        <h2 className="text-xl font-black text-slate-900">{student.name || student.username}</h2>
                        <p className="text-xs text-sky-700 font-bold mt-0.5">Roll Number: {student.username}</p>
                        <p className="text-xs text-slate-500 font-medium">{student.email}</p>
                    </div>

                    {/* Details Grid */}
                    <div className="p-6 space-y-4 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Branch / Dept</span>
                                <span className="text-sm font-bold text-slate-900">{student.studentBranch || 'Unassigned'}</span>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Academic Year</span>
                                <span className="text-sm font-bold text-slate-900">Year {student.year || '1'}</span>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Semester</span>
                                <span className="text-sm font-bold text-slate-900">Sem {student.semester || '1'}</span>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Section</span>
                                <span className="text-sm font-bold text-slate-900">Section {student.section || 'A'}</span>
                            </div>
                        </div>

                        {/* Additional Record Info */}
                        <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-200/80 space-y-2 text-xs text-slate-700 font-medium">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Default Password:</span>
                                <code className="font-mono text-sky-800 font-bold bg-sky-100 px-2 py-0.5 rounded">{student.username}@kk</code>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Enrolled On:</span>
                                <span>{student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'N/A'}</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2">
                            <button onClick={() => { onClose(); onEdit(student); }}
                                className="flex-1 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 font-bold text-xs hover:bg-sky-100 cursor-pointer flex items-center justify-center gap-1.5">
                                <Edit3 size={14} /> Edit Profile
                            </button>
                            <button onClick={() => { onClose(); onSuspend(student); }}
                                className={`flex-1 py-2.5 rounded-xl border font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 ${student.isSuspended ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                <Ban size={14} /> {student.isSuspended ? 'Reactivate Student' : 'Suspend Account'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
