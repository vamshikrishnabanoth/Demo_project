import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { FileText, Type, Book, Cpu, Sparkles, Mic, ArrowRight } from 'lucide-react';

export default function TeacherDashboard() {
    return (
        <DashboardLayout role="teacher">
            <div className="max-w-[100rem] mx-auto px-6 py-6 relative">
                {/* Universal AI Creation Studio — Single Unified Input Option */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2.5 px-2">
                        <Cpu className="text-[var(--text-accent)]" size={18} />
                        <h2 className="text-xs font-black uppercase tracking-widest text-[#334155]">Universal AI Assessment Engine</h2>
                    </div>

                    {/* Informational Container Card (Non-clickable container) */}
                    <div className="bg-gradient-to-br from-white via-slate-50 to-[var(--accent-sand)]/50 border-2 border-[var(--border-color)] rounded-[2.5rem] p-8 sm:p-10 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative overflow-hidden">
                        <div className="space-y-4 max-w-2xl">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="p-3.5 rounded-2xl bg-[var(--bg-saffron)] text-white text-white-force shadow-md">
                                    <Sparkles size={26} className="!text-white text-white-force" style={{ color: '#ffffff', stroke: '#ffffff' }} />
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

                            {/* Input Types Badges */}
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

                        {/* Actual Clickable Button */}
                        <Link
                            to="/create-quiz/topic"
                            className="bg-[var(--bg-saffron)] hover:bg-[var(--bg-saffron-hover)] text-white-force teacher-launch-btn flex items-center gap-3 px-8 py-5 rounded-2xl active:scale-95 shadow-lg hover:shadow-xl transition-all shrink-0 cursor-pointer group"
                            style={{ color: '#ffffff' }}
                        >
                            <span className="font-black text-sm tracking-wider uppercase" style={{ color: '#ffffff' }}>Create Quiz Now</span>
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform !text-white" style={{ color: '#ffffff' }} />
                        </Link>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
