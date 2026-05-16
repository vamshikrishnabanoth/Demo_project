import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, Home, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * PremiumError — A high-end, cinematic error state component.
 * Replaces basic text-heavy error messages with a tactical dashboard aesthetic.
 */
const PremiumError = ({ 
    title = "System Anomaly", 
    message = "The tactical uplink has been interrupted or the resource no longer exists.", 
    onRetry,
    showHome = true
}) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-500/10 rounded-full blur-[120px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-xl w-full space-y-12 relative z-10"
            >
                {/* Tactical Icon Hierarchy */}
                <div className="relative w-32 h-32 mx-auto">
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            opacity: [0.1, 0.3, 0.1]
                        }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 bg-red-500 rounded-[2.5rem] blur-2xl"
                    />
                    <div className="relative w-full h-full rounded-[2.5rem] bg-[var(--bg-secondary)] border border-red-500/30 flex items-center justify-center backdrop-blur-xl shadow-2xl overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent" />
                        <ShieldAlert size={64} className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                    </div>
                </div>

                {/* Message Content */}
                <div className="space-y-4">
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <h1 className="text-5xl font-black italic uppercase tracking-tighter text-white leading-none">
                            {title.split(' ')[0]} <span className="text-red-500">{title.split(' ').slice(1).join(' ')}</span>
                        </h1>
                        <div className="mt-4 flex items-center justify-center gap-3">
                            <div className="h-px w-8 bg-red-500/30" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500/60">Protocol Failure</p>
                            <div className="h-px w-8 bg-red-500/30" />
                        </div>
                    </motion.div>

                    <motion.p 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-[var(--text-secondary)] font-bold text-lg leading-relaxed max-w-md mx-auto"
                    >
                        {message}
                    </motion.p>
                </div>

                {/* Action Matrix */}
                <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex flex-wrap justify-center gap-4"
                >
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="group flex items-center gap-3 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all active:scale-95"
                        >
                            <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                            Re-establish Link
                        </button>
                    )}
                    
                    {showHome && (
                        <button
                            onClick={() => navigate('/')}
                            className="flex items-center gap-3 px-10 py-4 rounded-2xl bg-red-600 text-white font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all shadow-xl shadow-red-600/20 active:scale-95"
                        >
                            <Home size={18} />
                            Abort to Dashboard
                        </button>
                    )}
                </motion.div>

                {/* Technical Coordinates */}
                <div className="pt-8 opacity-20">
                    <p className="text-[9px] font-mono uppercase tracking-[0.5em] text-white">
                        ERR_TACTICAL_TIMEOUT // NODE_404_ANOMALY
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default PremiumError;
