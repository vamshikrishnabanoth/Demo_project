import React, { useEffect, useRef, useState } from 'react';
import FormattedQuestionText from './FormattedQuestionText';

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

export default function FormattedOptionText({ optionText = '', className = '', textColor = '#0f172a' }) {
    const containerRef = useRef(null);
    const [katexLoaded, setKatexLoaded] = useState(false);

    const hasMath = optionText && (
        optionText.includes('$$') || 
        optionText.includes('$') || 
        optionText.includes('\\(') || 
        optionText.includes('\\[') ||
        optionText.includes('\\frac') ||
        optionText.includes('\\sqrt')
    );

    useEffect(() => {
        if (hasMath) {
            loadKaTeX().then(() => setKatexLoaded(true));
        }
    }, [hasMath]);

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
                console.error('KaTeX option rendering error:', err);
            }
        }
    }, [katexLoaded, optionText]);

    return (
        <div ref={containerRef} className={`w-full overflow-visible ${className}`}>
            <FormattedQuestionText
                questionText={optionText}
                showBadge={false}
                textClassName="text-sm sm:text-base md:text-lg font-medium leading-relaxed tracking-normal break-words whitespace-normal text-left"
                codeClassName="text-xs p-2.5 my-1"
            />
        </div>
    );
}
