import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const PremiumLoader = ({ message = "Synchronizing neural pathways..." }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] p-8">
            <div className="relative">
                {/* Outer Ring */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="w-24 h-24 border-2 border-[var(--bg-accent)]/10 border-t-[var(--bg-accent)] rounded-full"
                />
                
                {/* Inner Ring */}
                <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-2 border-2 border-white/5 border-b-[var(--bg-accent)]/40 rounded-full"
                />

                {/* Center Pulse */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="text-[var(--text-accent)]"
                    >
                        <Sparkles size={32} fill="currentColor" />
                    </motion.div>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 text-center space-y-2"
            >
                <p className="font-black text-white italic uppercase tracking-[0.3em] text-sm animate-pulse">
                    {message}
                </p>
                <div className="flex gap-1.5 justify-center">
                    {[0, 1, 2].map(i => (
                        <motion.div
                            key={i}
                            animate={{ opacity: [0.2, 1, 0.2] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                            className="w-1.5 h-1.5 bg-[var(--bg-accent)] rounded-full"
                        />
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default PremiumLoader;
