import { motion } from 'framer-motion';

const PremiumLoader = ({ message = "Synchronizing neural pathways..." }) => {
    // Elegant letter stagger variables
    const textLetters = Array.from(message);
    const textContainer = {
        hidden: { opacity: 0 },
        visible: (i = 1) => ({
            opacity: 1,
            transition: { staggerChildren: 0.03, delayChildren: 0.04 * i },
        }),
    };
    const childLetter = {
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: "spring",
                damping: 12,
                stiffness: 200,
            },
        },
        hidden: {
            opacity: 0,
            y: 10,
        },
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 relative overflow-hidden">
            {/* High-end ambient neon backdrop blur */}
            <div className="absolute w-[350px] h-[350px] rounded-full bg-[var(--bg-accent)]/10 blur-[100px] pointer-events-none -z-10 animate-pulse" />

            <div className="relative w-36 h-36 flex items-center justify-center">
                {/* Outer Glassmorphic Hexagonal Pulsing Border */}
                <motion.div
                    animate={{ 
                        rotate: 360,
                        borderRadius: ["42% 58% 70% 30% / 45% 45% 55% 55%", "70% 30% 52% 48% / 60% 40% 60% 40%", "42% 58% 70% 30% / 45% 45% 55% 55%"]
                    }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border border-[var(--bg-accent)]/30 bg-gradient-to-tr from-[var(--bg-accent)]/5 via-transparent to-[var(--bg-accent)]/10 shadow-[0_0_50px_var(--bg-accent-glow)] backdrop-blur-sm"
                />

                {/* Counter-rotating Cyber Ring */}
                <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-4 border-2 border-dashed border-white/5 border-t-[var(--bg-accent)]/50 border-r-[var(--bg-accent)]/20 rounded-full"
                />

                {/* Futuristic Morphing Center Core */}
                <motion.div
                    animate={{ 
                        scale: [0.95, 1.1, 0.95],
                        boxShadow: [
                            "0 0 20px var(--bg-accent-glow), inset 0 0 15px rgba(255,255,255,0.1)",
                            "0 0 45px var(--bg-accent-glow), inset 0 0 25px rgba(255,255,255,0.2)",
                            "0 0 20px var(--bg-accent-glow), inset 0 0 15px rgba(255,255,255,0.1)"
                        ]
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--bg-accent)] to-[var(--text-accent)]/80 flex items-center justify-center relative overflow-hidden"
                >
                    {/* Gloss Reflection Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent pointer-events-none" />
                    
                    {/* Core Symbol */}
                    <svg className="w-7 h-7 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 2 7 12 12 22 7 12 2 17 4.5 7 9.5" />
                        <polyline points="2 17 12 22 22 17" />
                        <polyline points="2 12 12 17 22 12" />
                    </svg>
                </motion.div>

                {/* Floating Micro-nodes */}
                {[...Array(3)].map((_, i) => (
                    <motion.div
                        key={i}
                        animate={{
                            y: [0, -10 - i * 5, 0],
                            x: [0, (i - 1) * 20, 0],
                            opacity: [0.3, 1, 0.3],
                            scale: [1, 1.3, 1]
                        }}
                        transition={{
                            duration: 3 + i,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.5
                        }}
                        className="absolute w-2 h-2 rounded-full bg-[var(--bg-accent)]"
                        style={{
                            top: `${20 + i * 30}%`,
                            left: `${15 + i * 35}%`,
                            boxShadow: "0 0 10px var(--bg-accent-glow)"
                        }}
                    />
                ))}
            </div>

            {/* Premium Animated Message */}
            <motion.div
                variants={textContainer}
                initial="hidden"
                animate="visible"
                className="mt-10 text-center space-y-3"
            >
                <motion.div className="flex flex-wrap justify-center font-black text-white italic uppercase tracking-[0.25em] text-xs sm:text-sm">
                    {textLetters.map((letter, index) => (
                        <motion.span key={index} variants={childLetter}>
                            {letter === " " ? "\u00A0" : letter}
                        </motion.span>
                    ))}
                </motion.div>
                
                {/* Ambient loading bars */}
                <div className="flex gap-2 justify-center items-center">
                    {[0, 1, 2, 3].map(i => (
                        <motion.div
                            key={i}
                            animate={{ 
                                height: [6, 20, 6],
                                backgroundColor: ["rgba(255,255,255,0.1)", "var(--bg-accent)", "rgba(255,255,255,0.1)"]
                            }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                            className="w-1 rounded-full"
                        />
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default PremiumLoader;

