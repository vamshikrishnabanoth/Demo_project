import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import LiveRecordPanel from '../components/LiveRecordPanel';
import { Mic } from 'lucide-react';
import { uiTerminology } from '../utils/uiTerminology';

export default function CreateQuizVoice() {
    const navigate = useNavigate();

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
                            <span className="text-[var(--bg-accent)]">{uiTerminology.creationMethods.audio.toUpperCase()}</span>
                        </h1>
                        <p className="text-[var(--text-secondary)] mt-2 font-bold uppercase tracking-wider text-sm italic">Record your lecture to generate questions instantly</p>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Recording Area */}
                    <div className="bg-white/5 rounded-[3rem] border border-[var(--border-color)] p-12 ring-1 ring-white/5 relative overflow-hidden group shadow-2xl glass-panel">
                        <div className="relative z-10">
                            <LiveRecordPanel 
                                onQuestionsLoaded={handleQuestionsLoaded} 
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
