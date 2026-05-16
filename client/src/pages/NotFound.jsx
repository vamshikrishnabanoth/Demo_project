import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, Search } from 'lucide-react';
import CinematicBackground from '../components/CinematicBackground';

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
            style={{ background: 'var(--bg-primary)' }}
        >
            <CinematicBackground />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 text-center space-y-8 px-6 max-w-lg"
            >
                {/* 404 Number */}
                <motion.h1
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                    className="text-[10rem] md:text-[14rem] font-black italic leading-none tracking-tighter"
                    style={{ color: 'var(--text-accent)', textShadow: '0 0 60px var(--bg-accent-glow)' }}
                    aria-label="404 error"
                >
                    404
                </motion.h1>

                {/* Message */}
                <div className="space-y-4">
                    <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tight text-white">
                        Page Not Found
                    </h2>
                    <p className="text-base text-white/50 font-semibold leading-relaxed">
                        This page doesn't exist or has been moved.<br />
                        Let's get you back on track.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bg-accent)]"
                        aria-label="Go back to previous page"
                    >
                        <ArrowLeft size={18} />
                        Go Back
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm text-[var(--text-on-accent)] hover:opacity-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        style={{ background: 'var(--bg-accent)', boxShadow: '0 10px 30px var(--bg-accent-glow)' }}
                        aria-label="Go to home page"
                    >
                        <Home size={18} />
                        Go Home
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
