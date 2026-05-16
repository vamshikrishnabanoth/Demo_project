import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PremiumError = ({ 
    title = "System Anomaly Detected", 
    message = "The requested data stream could not be established. Please verify your tactical coordinates.", 
    onBack, 
    onRetry 
}) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full text-center space-y-8"
            >
                {/* Cinematic Error Icon */}
                <div className="relative mx-auto w-24 h-24">
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            opacity: [0.3, 0.6, 0.3] 
                        }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="absolute inset-0 bg-rose-500/20 rounded-full blur-2xl"
                    />
                    <div className="relative z-10 w-full h-full bg-gradient-to-br from-rose-500/20 to-transparent border border-rose-500/30 rounded-[2rem] flex items-center justify-center backdrop-blur-xl">
                        <AlertTriangle size={40} className="text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]" />
                    </div>
                </div>

                {/* Typography */}
                <div className="space-y-3">
                    <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">
                        {title}
                    </h2>
                    <p className="text-[var(--text-secondary)] font-medium leading-relaxed opacity-60">
                        {message}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    {onRetry && (
                        <button 
                            onClick={onRetry}
                            className="w-full sm:w-auto px-8 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2 btn-press"
                        >
                            <RefreshCw size={14} className="text-[var(--text-accent)]" /> Re-sync Stream
                        </button>
                    )}
                    <button 
                        onClick={onBack || (() => navigate(-1))}
                        className="w-full sm:w-auto px-8 py-3.5 bg-[var(--bg-accent)] text-[var(--text-on-accent)] rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[var(--bg-accent-hover)] transition-all shadow-xl shadow-[var(--bg-accent-glow)] flex items-center justify-center gap-2 btn-press"
                    >
                        <ArrowLeft size={14} /> Return to Base
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default PremiumError;
