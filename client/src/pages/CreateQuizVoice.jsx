import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import LiveRecordPanel from '../components/LiveRecordPanel';
import LectureAnalyzerPanel from '../components/LectureAnalyzerPanel';
import { Mic, Sparkles, BookOpen, Layers } from 'lucide-react';
import { uiTerminology } from '../utils/uiTerminology';

export default function CreateQuizVoice() {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState('lecture_analyzer'); // 'lecture_analyzer' or 'quick_quiz'

    const handleQuestionsLoaded = (questions, title, agentReport) => {
        // Redirect to the editor with generated questions + full agent report
        navigate('/create-quiz/text', {
            state: {
                questions,
                title,
                duration:    10,
                source:      'generated',
                agentReport: agentReport || null,
            }
        });
    };

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-5xl mx-auto pb-20 relative">
                {/* Glowing background element for voice */}
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--bg-accent-glow)] rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse"></div>

                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tight italic uppercase flex items-center gap-3">
                            <span className="text-[var(--bg-accent)]">{uiTerminology.creationMethods.audio.toUpperCase()}</span>
                            <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 font-extrabold uppercase tracking-widest border border-purple-500/30 not-italic">
                                2-Task Lecture Engine
                            </span>
                        </h1>
                        <p className="text-[var(--text-secondary)] mt-1.5 font-bold uppercase tracking-wider text-xs italic">
                            Clean non-academic content, preserve student Q&A, and reconstruct pedagogical explanations
                        </p>
                    </div>

                    {/* Mode Toggle Switch */}
                    <div className="flex p-1 rounded-2xl bg-white/5 border border-white/10 self-start md:self-auto">
                        <button
                            onClick={() => setViewMode('lecture_analyzer')}
                            className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                                viewMode === 'lecture_analyzer'
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <BookOpen className="w-3.5 h-3.5" /> Lecture Understanding & Cleaner
                        </button>
                        <button
                            onClick={() => setViewMode('quick_quiz')}
                            className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                                viewMode === 'quick_quiz'
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Mic className="w-3.5 h-3.5" /> Quick Voice Quiz
                        </button>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Main Workspace Area */}
                    <div className="bg-white/5 rounded-[3rem] border border-[var(--border-color)] p-8 md:p-10 ring-1 ring-white/5 relative overflow-hidden shadow-2xl glass-panel">
                        <div className="relative z-10">
                            {viewMode === 'lecture_analyzer' ? (
                                <LectureAnalyzerPanel onQuestionsLoaded={handleQuestionsLoaded} />
                            ) : (
                                <LiveRecordPanel onQuestionsLoaded={handleQuestionsLoaded} />
                            )}
                        </div>
                        {/* Faded giant background mic icon */}
                        <Mic className="absolute -right-20 -bottom-20 opacity-[0.02] text-white pointer-events-none" size={420} />
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

