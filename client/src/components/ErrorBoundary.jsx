import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * ErrorBoundary — catches runtime errors from any child component.
 * Without this, a JS error crashes the entire app to a white screen.
 * Must be a class component (React requirement for componentDidCatch).
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, showDetails: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary] System Anomaly Detected:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div
                    className="min-h-screen flex items-center justify-center p-8 bg-[var(--bg-primary)] overflow-auto"
                >
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-2xl w-full text-center space-y-12"
                    >
                        {/* Icon Container */}
                        <div className="relative w-32 h-32 mx-auto">
                            <motion.div 
                                animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute inset-0 bg-red-500 rounded-full blur-3xl"
                            />
                            <div className="relative w-full h-full rounded-[2.5rem] bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-xl shadow-2xl">
                                <AlertTriangle size={56} className="text-red-500" />
                            </div>
                        </div>

                        {/* Message Header */}
                        <div className="space-y-4">
                            <h1 className="text-5xl font-black italic uppercase tracking-tighter text-white">
                                System <span className="text-red-500">Interrupted</span>
                            </h1>
                            <p className="text-white/40 font-bold uppercase tracking-[0.3em] text-[10px]">
                                Neural link stability compromised. Emergency protocols active.
                            </p>
                        </div>

                        {/* Diagnostics Section */}
                        <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-8 backdrop-blur-md shadow-2xl">
                            <div className="flex flex-col items-center gap-6">
                                <div className="space-y-2">
                                    <p className="text-white/70 font-black uppercase tracking-widest text-xs">Primary Anomaly</p>
                                    <p className="text-red-400 font-bold italic">{this.state.error?.message || 'Unknown Runtime Error'}</p>
                                </div>

                                <div className="w-full h-px bg-white/5" />

                                <div className="flex flex-wrap gap-4 justify-center w-full">
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all active:scale-95"
                                    >
                                        <RefreshCw size={14} /> Refresh Node
                                    </button>
                                    <button
                                        onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
                                        className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] bg-[var(--bg-accent)] text-black hover:scale-105 transition-all shadow-xl shadow-[var(--bg-accent)]/20 active:scale-95"
                                    >
                                        <Home size={14} /> Arena Home
                                    </button>
                                </div>

                                <button 
                                    onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                                    className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-white/50 transition-colors"
                                >
                                    {this.state.showDetails ? 'Hide Tactical Data' : 'View Tactical Data'}
                                </button>
                            </div>

                            {this.state.showDetails && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    className="mt-8 text-left"
                                >
                                    <pre className="text-[10px] text-red-400/50 bg-black/40 rounded-xl p-6 overflow-auto max-h-[300px] font-mono border border-white/5 whitespace-pre-wrap leading-relaxed">
                                        {this.state.error?.stack}
                                    </pre>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
