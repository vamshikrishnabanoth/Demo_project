import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    Sparkles, Edit3, ArrowRight, ArrowLeft, Cpu, 
    FileText, CheckCircle2, Zap, UploadCloud, Clock
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

export default function CreateQuizMode() {
    const navigate = useNavigate();

    return (
        <DashboardLayout role="teacher">
            <div className="w-full max-w-5xl mx-auto space-y-8 py-2 sm:py-6">

                {/* Top Navigation & Breadcrumb */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => navigate('/teacher-dashboard')}
                        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl shadow-2xs transition-all cursor-pointer"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Dashboard</span>
                    </button>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-sand)] text-[var(--text-accent)] border border-[var(--border-color)] text-[10px] font-black uppercase tracking-widest">
                        <Cpu size={14} />
                        <span>Assessment Creator</span>
                    </div>
                </div>

                {/* Page Header */}
                <div className="space-y-3">
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                        Choose Creation Mode
                    </h1>
                    <p className="text-sm sm:text-base font-semibold text-slate-600 max-w-2xl leading-relaxed">
                        Select how you want to build this assessment. Use our automated AI studio with multimodal evidence, or build questions manually with precision control.
                    </p>
                </div>

                {/* Mode Selection Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    
                    {/* Card 1: AI Creation Studio */}
                    <motion.div
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        onClick={() => navigate('/create-quiz/topic')}
                        className="group bg-white rounded-3xl p-7 sm:p-8 border-2 border-slate-200 hover:border-violet-500 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-36 h-36 bg-violet-100/50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none group-hover:scale-125 transition-transform" />

                        <div className="space-y-6 relative z-10">
                            {/* Card Header */}
                            <div className="flex items-center justify-between gap-3">
                                <div className="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-100 text-violet-700 flex items-center justify-center group-hover:bg-violet-600 group-hover:text-white transition-all shadow-xs">
                                    <Sparkles size={28} />
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-50 text-violet-700 border border-violet-200">
                                    <Zap size={11} /> Recommended
                                </span>
                            </div>

                            {/* Title & Description */}
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-slate-900 group-hover:text-violet-700 transition-colors tracking-tight">
                                    AI Creation Studio
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-600 font-semibold leading-relaxed">
                                    Generate complete, grounded assessments automatically from Syllabus Topics, PDF documents, lecture transcripts, or raw text prompts.
                                </p>
                            </div>

                            {/* Feature highlights */}
                            <div className="space-y-2.5 pt-2 border-t border-slate-100">
                                {[
                                    'Multimodal input: Topics, PDFs, Text & Voice',
                                    'Bloom\'s taxonomy & difficulty calibration (Level 1–5)',
                                    'Grounded evidence span citations for every question',
                                    'Automated distractor refinement & sanity checks'
                                ].map((feat, i) => (
                                    <div key={i} className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                                        <CheckCircle2 size={15} className="text-violet-600 shrink-0" />
                                        <span>{feat}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Card Action Button */}
                        <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-violet-700 font-black text-sm group-hover:text-violet-800">
                            <span>Open AI Studio</span>
                            <div className="w-10 h-10 rounded-xl bg-violet-50 group-hover:bg-violet-600 group-hover:text-white flex items-center justify-center transition-all">
                                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Card 2: Manual Quiz Builder */}
                    <motion.div
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        onClick={() => navigate('/create-quiz/text')}
                        className="group bg-white rounded-3xl p-7 sm:p-8 border-2 border-slate-200 hover:border-emerald-500 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-100/50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none group-hover:scale-125 transition-transform" />

                        <div className="space-y-6 relative z-10">
                            {/* Card Header */}
                            <div className="flex items-center justify-between gap-3">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
                                    <Edit3 size={28} />
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Clock size={11} /> Full Control
                                </span>
                            </div>

                            {/* Title & Description */}
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-slate-900 group-hover:text-emerald-700 transition-colors tracking-tight">
                                    Manual Quiz Builder
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-600 font-semibold leading-relaxed">
                                    Author custom questions and multiple-choice options from scratch, configure per-question timers, or paste Aiken/JSON batches.
                                </p>
                            </div>

                            {/* Feature highlights */}
                            <div className="space-y-2.5 pt-2 border-t border-slate-100">
                                {[
                                    'Full control over questions, options, and answers',
                                    'Custom per-question timers and point values',
                                    'Direct Aiken & JSON format bulk paste / upload',
                                    'Instant live interactive preview and validation'
                                ].map((feat, i) => (
                                    <div key={i} className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                                        <span>{feat}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Card Action Button */}
                        <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-emerald-700 font-black text-sm group-hover:text-emerald-800">
                            <span>Open Manual Builder</span>
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center transition-all">
                                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                            </div>
                        </div>
                    </motion.div>

                </div>

            </div>
        </DashboardLayout>
    );
}
