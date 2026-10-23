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
                    className="min-h-screen flex items-center justify-center p-6 sm:p-8 bg-slate-50 text-slate-900 overflow-auto"
                >
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-2xl w-full text-center space-y-8"
                    >
                        {/* Icon Container */}
                        <div className="relative w-28 h-28 mx-auto">
                            <motion.div 
                                animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.3, 0.15] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute inset-0 bg-red-500 rounded-full blur-2xl"
                            />
                            <div className="relative w-full h-full rounded-[2rem] bg-white border border-red-200 flex items-center justify-center shadow-lg">
                                <AlertTriangle size={48} className="text-red-500" />
                            </div>
                        </div>

                        {/* Message Header */}
                        <div className="space-y-2">
                            <h1 className="text-4xl sm:text-5xl font-black italic uppercase tracking-tighter text-slate-900">
                                System <span className="text-red-600">Interrupted</span>
                            </h1>
                            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs">
                                Session stability compromised. Emergency recovery active.
                            </p>
                        </div>

                        {/* Diagnostics Section */}
                        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 sm:p-8 shadow-xl">
                            <div className="flex flex-col items-center gap-6">
                                <div className="space-y-2 w-full text-center">
                                    <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Primary Anomaly</p>
                                    <p className="text-red-600 font-bold italic text-sm">{this.state.error?.message || 'Unknown Runtime Error'}</p>
                                </div>

                                <div className="w-full h-px bg-slate-100" />

                                <div className="flex flex-wrap gap-4 justify-center w-full">
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[11px] bg-slate-100 border border-slate-300 text-slate-800 hover:bg-slate-200 transition-all active:scale-95 cursor-pointer shadow-xs"
                                    >
                                        <RefreshCw size={14} /> Refresh Page
                                    </button>
                                    <button
                                        onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
                                        className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[11px] bg-[#ea580c] text-white hover:brightness-105 transition-all shadow-md active:scale-95 cursor-pointer"
                                    >
                                        <Home size={14} /> Dashboard Home
                                    </button>
                                </div>

                                <button 
                                    onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                                    className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                >
                                    {this.state.showDetails ? 'Hide Diagnostics' : 'View Diagnostics'}
                                </button>
                            </div>

                            {this.state.showDetails && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    className="mt-6 text-left"
                                >
                                    <pre className="text-[11px] text-slate-700 bg-slate-50 rounded-xl p-4 overflow-auto max-h-[250px] font-mono border border-slate-200 whitespace-pre-wrap leading-relaxed">
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
