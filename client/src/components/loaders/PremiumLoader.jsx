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

            <div className="relative mb-6 flex items-center justify-center">
                <div className="loader"></div>
            </div>

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

