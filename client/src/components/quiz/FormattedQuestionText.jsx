import React, { useState } from 'react';
import { Terminal, Database, FileCode, Layers, Copy, Check, Maximize2, Minimize2, ChevronRight, ImageOff } from 'lucide-react';
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

/**
 * Safely renders text with basic formatting support:
 * - **bold**, *italic*, `inline code`
 * - Markdown images: ![alt](url)
 * - Line breaks preserved via whitespace-pre-wrap
 * Does NOT use dangerouslySetInnerHTML — all content is React elements.
 */
function SafeRichText({ content, className = '' }) {
    if (!content) return null;

    // Split by markdown images first
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = imageRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
        }
        parts.push({ type: 'image', alt: match[1], src: match[2] });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
        parts.push({ type: 'text', content: content.slice(lastIndex) });
    }

    return (
        <div className={className}>
            {parts.map((part, i) => {
                if (part.type === 'image') {
                    return <QuestionImage key={i} src={part.src} alt={part.alt} />;
                }
                return <FormattedTextSpan key={i} text={part.content} />;
            })}
        </div>
    );
}

/**
 * Renders inline formatting: **bold**, *italic*, `code`
 * Safe — no HTML injection.
 */
function FormattedTextSpan({ text }) {
    if (!text) return null;
    
    // Process inline formatting tokens
    const tokens = [];
    // Combined regex for **bold**, *italic*, and `code`
    const inlineRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
    let lastIdx = 0;
    let m;

    while ((m = inlineRegex.exec(text)) !== null) {
        if (m.index > lastIdx) {
            tokens.push({ type: 'plain', content: text.slice(lastIdx, m.index) });
        }
        if (m[2]) {
            tokens.push({ type: 'bold', content: m[2] });
        } else if (m[3]) {
            tokens.push({ type: 'italic', content: m[3] });
        } else if (m[4]) {
            tokens.push({ type: 'inlineCode', content: m[4] });
        }
        lastIdx = m.index + m[0].length;
    }
    if (lastIdx < text.length) {
        tokens.push({ type: 'plain', content: text.slice(lastIdx) });
    }

    if (tokens.length === 0) {
        return <span>{text}</span>;
    }

    return (
        <>
            {tokens.map((token, i) => {
                switch (token.type) {
                    case 'bold':
                        return <strong key={i} className="font-bold">{token.content}</strong>;
                    case 'italic':
                        return <em key={i}>{token.content}</em>;
                    case 'inlineCode':
                        return (
                            <code key={i} className="px-1.5 py-0.5 bg-slate-100 text-rose-600 rounded text-[0.85em] font-mono border border-slate-200">
                                {token.content}
                            </code>
                        );
                    default:
                        return <span key={i}>{token.content}</span>;
                }
            })}
        </>
    );
}

/**
 * Image component with loading state and error fallback.
 */
function QuestionImage({ src, alt }) {
    const [error, setError] = useState(false);

    if (error) {
        return (
            <div className="my-4 flex items-center gap-3 p-4 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-sm">
                <ImageOff size={20} className="flex-shrink-0 text-slate-400" />
                <span>Image could not be loaded{alt ? `: ${alt}` : ''}</span>
            </div>
        );
    }

    return (
        <div className="my-4 max-w-full">
            <img
                src={src}
                alt={alt || 'Question image'}
                onError={() => setError(true)}
                className="max-w-full h-auto rounded-xl border border-slate-200 shadow-sm"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
                loading="lazy"
            />
            {alt && <p className="text-xs text-slate-500 mt-1 italic">{alt}</p>}
        </div>
    );
}

export default function FormattedQuestionText({
    questionText = '',
    className = '',
    textClassName = '',
    codeClassName = '',
    showBadge = true,
    dark = false
}) {
    const [copiedIdx, setCopiedIdx] = useState(null);
    const [expandedIdx, setExpandedIdx] = useState(null);

    if (!questionText) return null;

    const { hasCode, segments } = parseQuestionContent(questionText);

    const handleCopy = (content, idx) => {
        if (!content) return;
        navigator.clipboard.writeText(content);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
    };

    return (
        <div className={`formatted-question-container w-full space-y-4 ${className}`}>
            {segments.map((segment, idx) => {
                if (segment.type === 'code') {
                    const LangIcon = getLangIcon(segment.language);
                    const langLabel = (segment.language || 'code').toUpperCase();
                    const lines = segment.content ? segment.content.split('\n') : [];
                    const isExpanded = expandedIdx === idx;

                    return (
                        <React.Fragment key={idx}>
                            {/* Standard In-Page Code Container */}
                            <div 
                                className={`my-3 sm:my-4 relative rounded-xl sm:rounded-2xl overflow-hidden border ${
                                    dark ? 'border-slate-800 bg-[#090d16]' : 'border-slate-800 bg-[#0f172a]'
                                } shadow-xl text-left select-text group transition-all w-full max-w-full code-scroll-fade`}
                            >
                                {/* Code Header Bar */}
                                {showBadge && (
                                    <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-[10px] font-black uppercase tracking-widest text-cyan-400 select-none">
                                        <div className="flex items-center gap-2">
                                            <LangIcon size={14} className="text-cyan-400 shrink-0" />
                                            <span>{langLabel}</span>
                                            <span className="opacity-40 font-mono text-[9px] text-slate-400">
                                                ({lines.length} {lines.length === 1 ? 'line' : 'lines'})
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 sm:gap-3">
                                            {/* Mobile Scroll Visual Hint */}
                                            <div className="hidden sm:flex md:hidden items-center gap-1 opacity-50 text-[9px] font-mono text-slate-400">
                                                <span>Scroll</span>
                                                <ChevronRight size={10} />
                                            </div>

                                            {/* 1-Click Copy Raw Code Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(segment.content, idx)}
                                                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-all text-[9px] font-bold font-mono border border-cyan-500 cursor-pointer active:scale-95 shadow-sm"
                                                title="Copy Code"
                                            >
                                                {copiedIdx === idx ? (
                                                    <>
                                                        <Check size={12} className="text-white shrink-0" />
                                                        <span className="text-white hidden sm:inline">COPIED</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy size={12} className="text-white shrink-0" />
                                                        <span className="text-white hidden sm:inline">COPY</span>
                                                    </>
                                                )}
                                            </button>

                                            {/* Mobile Code Fullscreen Reader Mode Toggle */}
                                            <button
                                                type="button"
                                                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                                                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all text-[9px] font-bold font-mono border border-indigo-500 cursor-pointer active:scale-95 shadow-sm"
                                                title="Toggle Fullscreen View"
                                            >
                                                <Maximize2 size={12} className="text-white shrink-0" />
                                                <span className="hidden sm:inline text-white">EXPAND</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Main Code Block with Left Gutter Line Numbers */}
                                <div className="relative overflow-x-auto w-full max-w-full">
                                    <pre className={`question-code p-3 sm:p-4 md:p-5 font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto text-slate-100 bg-transparent whitespace-pre select-text ${codeClassName}`}>
                                        <code className="font-mono whitespace-pre text-cyan-300 block code-line-table">
                                            {lines.map((lineStr, lineIdx) => (
                                                <div key={lineIdx} className="code-line-row">
                                                    <span className="code-line-number">{lineIdx + 1}</span>
                                                    <span className="code-line-content">{lineStr}</span>
                                                </div>
                                            ))}
                                        </code>
                                    </pre>
                                </div>
                            </div>

                            {/* Fullscreen Code Overlay Reader Mode Modal */}
                            {isExpanded && (
                                <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md p-4 sm:p-8 flex flex-col justify-between animate-in fade-in duration-200">
                                    <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                                        <div className="flex items-center gap-3">
                                            <LangIcon size={18} className="text-cyan-400 shrink-0" />
                                            <span className="text-xs font-black uppercase tracking-widest text-cyan-400 font-mono">
                                                {langLabel} READER MODE ({lines.length} Lines)
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(segment.content, idx)}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold font-mono border border-cyan-500 cursor-pointer shadow-md active:scale-95 transition-all"
                                            >
                                                {copiedIdx === idx ? <Check size={15} className="text-white" /> : <Copy size={15} className="text-white" />}
                                                <span className="text-white">{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setExpandedIdx(null)}
                                                className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all border border-rose-500 cursor-pointer shadow-md active:scale-95"
                                                title="Close Reader Mode"
                                            >
                                                <Minimize2 size={18} className="text-white" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-auto my-4 bg-[#090d16] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl">
                                        <pre className="question-code font-mono text-sm leading-relaxed overflow-x-auto text-slate-100 whitespace-pre">
                                            <code className="font-mono whitespace-pre text-cyan-300 block code-line-table">
                                                {lines.map((lineStr, lineIdx) => (
                                                    <div key={lineIdx} className="code-line-row">
                                                        <span className="code-line-number">{lineIdx + 1}</span>
                                                        <span className="code-line-content">{lineStr}</span>
                                                    </div>
                                                ))}
                                            </code>
                                        </pre>
                                    </div>

                                    <div className="text-center pt-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                                        Press Minimize or click outside to return to exam view
                                    </div>
                                </div>
                            )}
                        </React.Fragment>
                    );
                }

                // Text / Scenario / Normal Question Segment — with safe rich text rendering
                return (
                    <SafeRichText
                        key={idx}
                        content={segment.content}
                        className={`whitespace-pre-wrap break-words leading-relaxed select-text ${textClassName}`}
                    />
                );
            })}
        </div>
    );
}

// Export for reuse in other components
export { SafeRichText, QuestionImage };
