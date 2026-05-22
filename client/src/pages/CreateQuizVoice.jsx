import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import LiveRecordPanel from '../components/LiveRecordPanel';
import { Mic, Hash } from 'lucide-react';

export default function CreateQuizVoice() {
    const navigate = useNavigate();
    const [questionCount, setQuestionCount] = useState(5);

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
            <div className="max-w-4xl mx-auto pb-20 relative">
                {/* Glowing background element for voice */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--bg-accent-glow)] rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse"></div>

                <div className="mb-12 flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tight italic uppercase">
                            LIVE <span className="text-[var(--bg-accent)]">VOICE CREATOR</span>
                        </h1>
                        <p className="text-[var(--text-secondary)] mt-2 font-bold uppercase tracking-wider text-sm italic">Record your lecture to generate questions instantly</p>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Controls Row */}
                    <div className="flex justify-center">
                        <div className="bg-white/5 p-8 rounded-[2rem] border border-[var(--border-color)] flex items-center gap-6 w-full max-w-md shadow-2xl glass-panel">
                            <div className="bg-[var(--bg-accent)] w-16 h-16 rounded-2xl flex items-center justify-center text-[var(--text-on-accent)] shadow-xl">
                                <Hash size={32} />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1">Target Question Count</p>
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={questionCount}
                                    onChange={(e) => { const v = parseInt(e.target.value); setQuestionCount(isNaN(v) ? '' : v); }}
                                    className="bg-transparent border-none text-3xl font-black text-[var(--text-primary)] italic outline-none w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Recording Area */}
                    <div className="bg-white/5 rounded-[3rem] border border-[var(--border-color)] p-12 ring-1 ring-white/5 relative overflow-hidden group shadow-2xl glass-panel">
                        <div className="relative z-10">
                            <LiveRecordPanel 
                                onQuestionsLoaded={handleQuestionsLoaded} 
                                questionCount={questionCount}
                                difficulty="Medium"
                            />
                        </div>
                        {/* Faded giant icon in the background */}
                        <Mic className="absolute -right-20 -bottom-20 opacity-[0.03] text-white group-hover:rotate-12 transition-transform duration-700 pointer-events-none" size={400} />
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
