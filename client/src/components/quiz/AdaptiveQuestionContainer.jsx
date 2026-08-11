import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Code, FileText, Sigma, Minimize2 } from 'lucide-react';
import FormattedQuestionText from './FormattedQuestionText';
import { parseQuestionContent } from '../../utils/questionFormatter';

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

export default function AdaptiveQuestionContainer({ questionText = '' }) {
    const containerRef = useRef(null);
    const [katexLoaded, setKatexLoaded] = useState(false);
    const [zoomFormula, setZoomFormula] = useState(null);
    
    // Content type analysis using questionFormatter
    const parsedInfo = parseQuestionContent(questionText);
    const hasCode = parsedInfo.hasCode;
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

    // Styled Scrollbar CSS
    const customScrollbarClass = "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 scrollbar-thumb-rounded";

    return (
        <div ref={containerRef} className="w-full flex flex-col gap-4 text-[#0f172a]">
            {/* Header Badge/Banner indicating content type */}
            <div className="flex items-center justify-between opacity-60 text-[9px] font-black uppercase tracking-[0.2em] mb-1">
                <div className="flex items-center gap-2 text-slate-600">
                    {hasCode && <Code size={13} className="text-cyan-600" />}
                    {hasMath && <Sigma size={13} className="text-purple-600" />}
                    {isLong && <FileText size={13} className="text-amber-600" />}
                    <span>
                        {isMixed 
                            ? 'Hybrid Syntactic Model' 
                            : hasCode 
                            ? 'Code Analysis Construct' 
                            : hasMath 
                            ? 'Formula Expression' 
                            : isLong 
                            ? 'Scenario Briefing' 
                            : 'Theory Assessment'}
                    </span>
                </div>
            </div>

            {/* Adaptive Question Content Area */}
            <div className="w-full transition-all duration-300 h-auto overflow-visible">
                <FormattedQuestionText
                    questionText={questionText}
                    textClassName="text-lg md:text-xl font-bold text-[#0f172a] leading-relaxed"
                />
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
