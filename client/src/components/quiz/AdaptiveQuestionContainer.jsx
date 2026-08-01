import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Code, FileText, Sigma, Minimize2 } from 'lucide-react';

// Dynamically load KaTeX CDN
const loadKaTeX = () => {
    return new Promise((resolve) => {
        if (window.katex && window.renderMathInElement) {
            resolve(window.katex);
            return;
        }
        
        let script = document.getElementById('katex-cdn-script');
        if (!script) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
            document.head.appendChild(link);

            script = document.createElement('script');
            script.id = 'katex-cdn-script';
            script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js';
            script.onload = () => {
                const autoRenderScript = document.createElement('script');
                autoRenderScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js';
                autoRenderScript.onload = () => {
                    resolve(window.katex);
                };
                document.head.appendChild(autoRenderScript);
            };
            document.head.appendChild(script);
        } else {
            const interval = setInterval(() => {
                if (window.katex && window.renderMathInElement) {
                    clearInterval(interval);
                    resolve(window.katex);
                }
            }, 100);
        }
    });
};

export default function AdaptiveQuestionContainer({ questionText }) {
    const containerRef = useRef(null);
    const [katexLoaded, setKatexLoaded] = useState(false);
    const [zoomFormula, setZoomFormula] = useState(null);
    
    // Detect content type
    const hasCode = questionText.includes('```') || questionText.includes('<pre>') || questionText.includes('<code>');
    const hasMath = questionText.includes('$$') || questionText.includes('$') || questionText.includes('\\(') || questionText.includes('\\[') || questionText.includes('\\begin{');
    const isLong = questionText.length > 250 || questionText.split('\n').length > 5;
    const isMixed = (hasCode && hasMath) || (hasCode && isLong) || (hasMath && isLong);

    // Initialize KaTeX if needed
    useEffect(() => {
        if (hasMath) {
            loadKaTeX().then(() => {
                setKatexLoaded(true);
            });
        }
    }, [hasMath]);

    // Render formulas after loading
    useEffect(() => {
        if (katexLoaded && containerRef.current) {
            try {
                window.renderMathInElement(containerRef.current, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false
                });
            } catch (err) {
                console.error('KaTeX rendering error:', err);
            }
        }
    }, [katexLoaded, questionText]);

    // Parse Markdown-like structure
    const parseContent = (text) => {
        if (!text) return [];
        
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        const htmlCodeRegex = /<pre><code>([\s\S]*?)<\/code><\/pre>/g;
        const mathBlockRegex = /\$\$([\s\S]*?)\$\$/g;
        
        const matches = [];
        let match;
        
        // Find markdown code blocks
        codeBlockRegex.lastIndex = 0;
        while ((match = codeBlockRegex.exec(text)) !== null) {
            matches.push({
                type: 'code',
                lang: match[1] || 'plaintext',
                content: match[2],
                index: match.index,
                length: match[0].length
            });
        }
        
        // Find HTML code blocks
        htmlCodeRegex.lastIndex = 0;
        while ((match = htmlCodeRegex.exec(text)) !== null) {
            matches.push({
                type: 'code',
                lang: 'html',
                content: match[1],
                index: match.index,
                length: match[0].length
            });
        }
        
        // Find block math
        mathBlockRegex.lastIndex = 0;
        while ((match = mathBlockRegex.exec(text)) !== null) {
            matches.push({
                type: 'math-block',
                content: match[1],
                index: match.index,
                length: match[0].length
            });
        }
        
        matches.sort((a, b) => a.index - b.index);
        
        const segments = [];
        let lastIdx = 0;
        
        for (const m of matches) {
            if (m.index < lastIdx) continue;
            
            if (m.index > lastIdx) {
                segments.push({
                    type: 'text',
                    content: text.substring(lastIdx, m.index)
                });
            }
            
            segments.push(m);
            lastIdx = m.index + m.length;
        }
        
        if (lastIdx < text.length) {
            segments.push({
                type: 'text',
                content: text.substring(lastIdx)
            });
        }
        
        return segments;
    };

    const segments = parseContent(questionText);

    // Styled Scrollbar CSS
    const customScrollbarClass = "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 scrollbar-thumb-rounded";

    return (
        <div ref={containerRef} className="w-full flex flex-col gap-4 text-white">
            {/* Header Badge/Banner indicating content type */}
            <div className="flex items-center justify-between opacity-50 text-[9px] font-black uppercase tracking-[0.2em] mb-1">
                <div className="flex items-center gap-2">
                    {hasCode && <Code size={12} className="text-cyan-400" />}
                    {hasMath && <Sigma size={12} className="text-purple-400" />}
                    {isLong && <FileText size={12} className="text-amber-400" />}
                    <span>
                        {isMixed 
                            ? 'Hybrid Syntactic Model' 
                            : hasCode 
                            ? 'Code analysis construct' 
                            : hasMath 
                            ? 'Formula expression' 
                            : isLong 
                            ? 'Scenario Briefing' 
                            : 'Theory Assessment'}
                    </span>
                </div>
                </div>
            </div>

            {/* Adaptive Question Content Area */}
            <div 
                className={`w-full transition-all duration-300 h-auto overflow-visible ${
                    isLong ? 'pr-2 rounded-2xl border border-white/5 bg-white/[0.01] p-4' : ''
                }`}
                style={{ scrollBehavior: 'smooth' }}
            >
                {/* Render sequential hybrid layout */}
                {segments.map((segment, idx) => {
                    if (segment.type === 'code') {
                        return (
                            <div key={idx} className="my-4 relative group">
                                <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/5 rounded text-[8px] text-white/40 uppercase tracking-widest font-black pointer-events-none">
                                    {segment.lang}
                                </div>
                                <pre className={`bg-black/40 border border-white/15 rounded-xl p-4 font-mono text-sm leading-relaxed overflow-x-auto ${customScrollbarClass} h-auto`}>
                                    <code className="text-cyan-300 block select-text font-mono whitespace-pre">{segment.content.trim()}</code>
                                </pre>
                            </div>
                        );
                    } else if (segment.type === 'math-block') {
                        return (
                            <div key={idx} className="my-6 relative group bg-white/[0.02] border border-white/5 rounded-xl p-6 flex flex-col items-center justify-center">
                                {/* Formula Scroller for wide screen formulas */}
                                <div className={`w-full overflow-x-auto text-center py-2 ${customScrollbarClass}`}>
                                    <div className="inline-block min-w-full text-center text-lg md:text-xl font-medium tracking-wide">
                                        {`$$${segment.content}$$`}
                                    </div>
                                </div>
                                {/* Zoom Action Button */}
                                <button 
                                    type="button"
                                    onClick={() => setZoomFormula(segment.content)}
                                    className="absolute bottom-2 right-2 p-1.5 bg-white/5 hover:bg-[var(--bg-accent)] text-white/50 hover:text-white rounded-lg transition-all scale-75 group-hover:scale-100 opacity-0 group-hover:opacity-100 cursor-pointer shadow-lg"
                                    title="Zoom Formula"
                                >
                                    <Maximize2 size={14} />
                                </button>
                            </div>
                        );
                    } else {
                        // Plain Text Segment: let it wrap normally. We preserve line breaks.
                        return (
                            <p 
                                key={idx} 
                                className="text-xl md:text-2xl font-black italic uppercase tracking-tight leading-snug break-words whitespace-pre-wrap select-text mb-2 text-[#0f172a]"
                                style={{ fontFamily: 'var(--app-font), sans-serif', color: '#0f172a' }}
                            >
                                {segment.content}
                            </p>
                        );
                    }
                })}
            </div>

            {/* Formula Zoom Overlay Modal */}
            <AnimatePresence>
                {zoomFormula && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[var(--z-overlay,999)] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-[var(--bg-secondary,#0f1929)] border border-[var(--bg-accent)] rounded-[2.5rem] p-8 md:p-12 max-w-4xl w-full relative shadow-2xl overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--bg-accent)]/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
                            
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                                <h3 className="font-black text-xs text-white/40 uppercase tracking-[0.2em] italic">Formula Zoom Array</h3>
                                <button 
                                    type="button"
                                    onClick={() => setZoomFormula(null)}
                                    className="p-2 bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 rounded-xl transition-all cursor-pointer"
                                >
                                    <Minimize2 size={18} />
                                </button>
                            </div>

                            {/* Render Zoomed Formula */}
                            <div className={`w-full overflow-x-auto py-12 flex justify-center items-center ${customScrollbarClass}`}>
                                <div className="text-2xl md:text-4xl text-center text-white font-medium select-all">
                                    {`$$${zoomFormula}$$`}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
