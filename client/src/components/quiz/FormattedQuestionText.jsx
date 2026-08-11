import React from 'react';
import { Code, Terminal, Database, FileCode, Layers } from 'lucide-react';
import { parseQuestionContent } from '../../utils/questionFormatter';

const getLangIcon = (lang) => {
    switch ((lang || '').toLowerCase()) {
        case 'sql':
            return Database;
        case 'html':
        case 'css':
        case 'javascript':
            return FileCode;
        case 'cpp':
        case 'c':
        case 'java':
        case 'python':
        default:
            return Terminal;
    }
};

export default function FormattedQuestionText({
    questionText = '',
    className = '',
    textClassName = '',
    codeClassName = '',
    showBadge = true,
    dark = false
}) {
    if (!questionText) return null;

    const { hasCode, segments } = parseQuestionContent(questionText);

    return (
        <div className={`formatted-question-container w-full space-y-4 ${className}`}>
            {segments.map((segment, idx) => {
                if (segment.type === 'code') {
                    const LangIcon = getLangIcon(segment.language);
                    const langLabel = (segment.language || 'code').toUpperCase();

                    return (
                        <div 
                            key={idx} 
                            className={`my-4 relative rounded-2xl overflow-hidden border ${
                                dark ? 'border-slate-800 bg-[#090d16]' : 'border-slate-800 bg-[#0f172a]'
                            } shadow-xl text-left select-text group transition-all`}
                        >
                            {/* Code Header Bar */}
                            {showBadge && (
                                <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-[10px] font-black uppercase tracking-widest text-cyan-400 select-none">
                                    <div className="flex items-center gap-2">
                                        <LangIcon size={14} className="text-cyan-400" />
                                        <span>{langLabel}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 opacity-60 text-[9px] font-mono text-slate-400">
                                        <Layers size={11} />
                                        <span>SOURCE CODE</span>
                                    </div>
                                </div>
                            )}

                            {/* Main Code Block */}
                            <div className="relative overflow-x-auto">
                                <pre className={`question-code p-4 md:p-5 font-mono text-sm leading-relaxed overflow-x-auto text-slate-100 bg-transparent whitespace-pre select-text ${codeClassName}`}>
                                    <code className="font-mono whitespace-pre text-cyan-300 block">
                                        {segment.content}
                                    </code>
                                </pre>
                            </div>
                        </div>
                    );
                }

                // Text / Scenario / Normal Question Segment
                return (
                    <div 
                        key={idx}
                        className={`whitespace-pre-wrap break-words leading-relaxed select-text ${textClassName}`}
                    >
                        {segment.content}
                    </div>
                );
            })}
        </div>
    );
}
