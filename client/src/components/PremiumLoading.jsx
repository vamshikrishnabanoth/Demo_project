import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, Zap } from 'lucide-react';

export default function PremiumLoading({ message = "Synchronizing..." }) {
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--bg-primary)] overflow-hidden">
            {/* Background Glows */}
            <motion.div 
                animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3]
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute w-[600px] h-[600px] bg-[var(--bg-accent)]/10 rounded-full blur-[120px] pointer-events-none"
            />
            <motion.div 
                animate={{ 
                    scale: [1.2, 1, 1.2],
                    opacity: [0.2, 0.4, 0.2]
                }}
                transition={{ duration: 5, repeat: Infinity }}
                className="absolute w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"
            />

            <div className="relative flex flex-col items-center">
                {/* Logo / Concentric Ring Loader Animation */}
                <div className="mb-10 relative flex items-center justify-center">
                    <div className="loader"></div>
                </div>

                {/* Progress Indicator */}
                <div className="flex flex-col items-center space-y-6">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: 240 }}
                        transition={{ duration: 2, ease: "easeInOut" }}
                        className="h-1.5 bg-[var(--bg-accent)]/20 rounded-full overflow-hidden w-60 border border-white/5"
                    >
                        <motion.div 
                            animate={{ 
                                x: [-240, 240]
                            }}
                            transition={{ 
                                duration: 1.5, 
                                repeat: Infinity, 
                                ease: "easeInOut" 
                            }}
                            className="h-full w-full bg-gradient-to-r from-transparent via-[var(--bg-accent)] to-transparent"
                        />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center"
                    >
                        <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-widest italic mb-2">
                            {message}
                        </h3>
                        <div className="flex items-center justify-center gap-2 text-[var(--text-secondary)] text-xs font-bold uppercase tracking-widest">
                            <Loader2 size={14} className="animate-spin" />
                            Establishing Secure Connection
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Bottom Text */}
            <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                transition={{ delay: 1 }}
                className="absolute bottom-12 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.6em]"
            >
                KMIT Educational Arena // System 2.0
            </motion.p>
        </div>
    );
}
