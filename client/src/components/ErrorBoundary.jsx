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
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        // In production: send to error tracking (Sentry, etc.)
        console.error('[ErrorBoundary] Caught error:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div
                    className="min-h-screen flex items-center justify-center p-8"
                    style={{ background: 'var(--bg-primary)' }}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="max-w-md w-full text-center space-y-8"
                    >
                        {/* Icon */}
                        <motion.div
                            animate={{ rotate: [0, -5, 5, -5, 0] }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            className="w-24 h-24 mx-auto rounded-[2rem] bg-red-500/10 border border-red-500/20 flex items-center justify-center"
                        >
                            <AlertTriangle size={48} className="text-red-400" />
                        </motion.div>

                        {/* Message */}
                        <div className="space-y-3">
                            <h1 className="text-3xl font-black italic uppercase tracking-tight text-white">
                                Something went wrong
                            </h1>
                            <p className="text-sm font-semibold text-white/50 leading-relaxed">
                                An unexpected error occurred. Your session is safe — try refreshing the page.
                            </p>
                            {/* Error detail in dev */}
                            {import.meta.env.DEV && this.state.error && (
                                <pre className="text-left text-xs text-red-400/70 bg-red-500/5 border border-red-500/10 rounded-2xl p-4 overflow-auto max-h-32 mt-4">
                                    {this.state.error.toString()}
                                </pre>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => window.location.reload()}
                                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-sm bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all"
                                aria-label="Refresh page"
                            >
                                <RefreshCw size={16} />
                                Refresh
                            </button>
                            <button
                                onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
                                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-sm text-[var(--text-on-accent)] transition-all"
                                style={{ background: 'var(--bg-accent)' }}
                                aria-label="Go to home page"
                            >
                                <Home size={16} />
                                Go Home
                            </button>
                        </div>
                    </motion.div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
