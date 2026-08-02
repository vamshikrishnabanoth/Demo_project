import React from 'react';

const PremiumLoader = ({ message = "Synchronizing neural pathways..." }) => {
    // Elegant letter stagger variables
    const textLetters = Array.from(message);

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 relative overflow-hidden">
            {/* High-end ambient neon backdrop blur */}
            <div className="absolute w-[350px] h-[350px] rounded-full bg-[var(--bg-accent)]/10 blur-[100px] pointer-events-none -z-10 animate-pulse" />

            <div className="relative mb-6 flex items-center justify-center">
                <div className="loader"></div>

                {/* Floating Micro-nodes */}
                {[...Array(3)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-2 h-2 rounded-full bg-[var(--bg-accent)] animate-float-node"
                        style={{
                            top: `${20 + i * 30}%`,
                            left: `${15 + i * 35}%`,
                            boxShadow: "0 0 10px var(--bg-accent-glow)",
                            '--float-x': `${(i - 1) * 20}px`,
                            '--float-y': `${-10 - i * 5}px`,
                            '--float-duration': `${3 + i}s`,
                            '--float-delay': `${i * 0.5}s`
                        }}
                    />
                ))}
            </div>

            {/* Premium Animated Message */}
            <div className="mt-10 text-center space-y-3">
                <div className="flex flex-wrap justify-center font-black text-white italic uppercase tracking-[0.25em] text-xs sm:text-sm">
                    {textLetters.map((letter, index) => (
                        <span
                            key={index}
                            className="opacity-0 animate-fade-in-up"
                            style={{
                                '--animate-delay': `${0.04 * index + 0.03 * index}s`
                            }}
                        >
                            {letter === " " ? "\u00A0" : letter}
                        </span>
                    ))}
                </div>
                
                {/* Ambient loading bars */}
                <div className="flex gap-2 justify-center items-center">
                    {[0, 1, 2, 3].map(i => (
                        <div
                            key={i}
                            className="w-1 rounded-full animate-loading-bar-scale"
                            style={{
                                '--bar-delay': `${i * 0.15}s`
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PremiumLoader;
