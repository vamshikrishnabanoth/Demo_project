import React from 'react';
import { motion } from 'framer-motion';
import { WifiOff, RefreshCw, Server, ShieldAlert } from 'lucide-react';

export default function ConnectionErrorPage({ error, onRetry }) {
    const [isRetrying, setIsRetrying] = React.useState(false);

    const handleRetry = async () => {
        setIsRetrying(true);
        try {
            await onRetry();
        } catch (e) {
            console.error('[ConnectionErrorPage] Retry failed:', e);
        } finally {
            setIsRetrying(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary,#090d16)] flex items-center justify-center p-6 relative overflow-hidden font-inter">
            {/* Holographic Concentric Ambient Glows */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div 
                    animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.15, 0.3, 0.15]
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute w-[600px] h-[600px] rounded-full -top-40 -left-40 pointer-events-none"
                    style={{ 
                        background: 'radial-gradient(circle, var(--bg-accent-glow, rgba(0,240,255,0.15)) 0%, transparent 70%)',
                        filter: 'blur(60px)'
                    }}
                />
                <motion.div 
                    animate={{ 
                        scale: [1.2, 1, 1.2],
                        opacity: [0.1, 0.25, 0.1]
                    }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                    className="absolute w-[800px] h-[800px] rounded-full -bottom-80 -right-80 pointer-events-none"
                    style={{ 
                        background: 'radial-gradient(circle, var(--bg-accent-glow, rgba(0,240,255,0.1)) 0%, transparent 75%)',
                        filter: 'blur(85px)'
                    }}
                />
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-md w-full relative z-10 space-y-10 text-center"
            >
                {/* Visual Telemetry Core */}
                <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.15, 1],
                            opacity: [0.3, 0.6, 0.3],
                            boxShadow: [
                                '0 0 30px rgba(239, 68, 68, 0.2), inset 0 0 15px rgba(239, 68, 68, 0.1)',
                                '0 0 50px rgba(239, 68, 68, 0.4), inset 0 0 25px rgba(239, 68, 68, 0.2)',
                                '0 0 30px rgba(239, 68, 68, 0.2), inset 0 0 15px rgba(239, 68, 68, 0.1)'
                            ]
                        }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute inset-0 rounded-[2.5rem] border border-red-500/20 bg-red-500/5 backdrop-blur-xl"
                    />
                    <WifiOff size={48} className="text-red-500 relative z-10 drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]" />
                </div>

                {/* System Title */}
                <div className="space-y-3">
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">
                        Link <span className="text-red-500">Suspended</span>
                    </h1>
                    <p className="text-white/40 font-black uppercase tracking-[0.3em] text-[9px]">
                        Telemetry Synchronization Interrupted
                    </p>
                </div>

                {/* Diagnostics Panel */}
                <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="space-y-6 text-left">
                        <div className="space-y-1.5">
                            <span className="text-white/30 font-black uppercase tracking-wider text-[8px] flex items-center gap-1.5">
                                <Server size={10} /> Connectivity Status
                            </span>
                            <p className="text-slate-300 font-bold text-sm leading-snug">
                                The academic server is waking up (Render cold start) or is currently offline due to a network interruption.
                            </p>
                        </div>

                        <div className="w-full h-px bg-white/5" />

                        <div className="space-y-1.5">
                            <span className="text-white/30 font-black uppercase tracking-wider text-[8px] flex items-center gap-1.5">
                                <ShieldAlert size={10} /> Diagnostic Payload
                            </span>
                            <pre className="text-[10px] text-red-400 bg-black/40 rounded-xl p-3 border border-white/5 font-mono overflow-x-auto truncate">
                                {error?.message || 'Server connection timed out'}
                            </pre>
                        </div>
                    </div>

                    <button
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className="mt-8 w-full h-14 bg-gradient-to-r from-red-600 to-orange-500 text-white font-black italic uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-3 transition-all duration-300 active:scale-95 disabled:opacity-50 hover:shadow-[0_0_25px_rgba(239,68,68,0.35)] shadow-lg"
                    >
                        <RefreshCw size={16} className={isRetrying ? 'animate-spin' : ''} />
                        {isRetrying ? 'Synchronizing Link...' : 'Re-establish Link'}
                    </button>
                </div>

                {/* Footer system details */}
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white/20 italic">
                    Telecommunication Gateway v1.2 • SECURE
                </p>
            </motion.div>
        </div>
    );
}
