import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, HelpCircle } from 'lucide-react';
import CinematicBackground from '../components/CinematicBackground';

/* ── Floating question mark icons ────────────────────────────────────────── */
const FloatingQuestion = ({ top, left, size, delay, duration }) => (
    <motion.div
        className="floating-icon text-[var(--bg-accent)]"
        style={{ top, left }}
        initial={{ opacity: 0 }}
        animate={{
            opacity: [0, 0.06, 0.1, 0.06, 0],
            y: [0, -25, -10, -35, 0],
            rotate: [0, 15, -10, 20, 0],
        }}
        transition={{
            duration: duration || 10,
            repeat: Infinity,
            delay: delay || 0,
            ease: 'easeInOut',
        }}
    >
        <HelpCircle size={size} strokeWidth={1.2} />
    </motion.div>
);

export default function NotFound() {
    const navigate = useNavigate();

    const floatingQuestions = [
        { top: '10%', left: '12%', size: 40, delay: 0,   duration: 12 },
        { top: '20%', left: '80%', size: 28, delay: 1.5, duration: 10 },
        { top: '60%', left: '8%',  size: 32, delay: 3,   duration: 14 },
        { top: '70%', left: '85%', size: 36, delay: 2,   duration: 11 },
        { top: '35%', left: '90%', size: 22, delay: 4,   duration: 13 },
        { top: '85%', left: '50%', size: 26, delay: 1,   duration: 15 },
    ];

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
            style={{ background: 'var(--bg-primary)' }}
        >
            <CinematicBackground />

            {/* Scan Line Overlay */}
            <div className="scan-lines" />

            {/* Floating Question Marks */}
            {floatingQuestions.map((q, i) => (
                <FloatingQuestion key={i} {...q} />
            ))}

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 text-center space-y-8 px-6 max-w-lg"
            >
                {/* 404 Number — with glitch effect */}
                <motion.h1
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                    className="text-[10rem] md:text-[14rem] font-black italic leading-none tracking-tighter glitch-text"
                    data-text="404"
                    style={{ color: 'var(--text-accent)', textShadow: '0 0 60px var(--bg-accent-glow)' }}
                    aria-label="404 error"
                >
                    404
                </motion.h1>

                {/* Message */}
                <div className="space-y-4">
                    <motion.h2 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-3xl md:text-4xl font-black italic uppercase tracking-tight text-white"
                    >
                        Page Not Found
                    </motion.h2>
                    <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.35 }}
                        className="text-base text-white/50 font-semibold leading-relaxed"
                    >
                        This page doesn't exist or has been moved.<br />
                        Let's get you back on track.
                    </motion.p>
                </div>

                {/* Actions */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-col sm:flex-row gap-4 justify-center pt-4"
                >
                    <motion.button
                        whileHover={{ scale: 1.04, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate(-1)}
                        className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm bg-white border-2 border-[#0f172a] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bg-accent)] shadow-md"
                        style={{ color: '#0f172a' }}
                        aria-label="Go back to previous page"
                    >
                        <ArrowLeft size={18} className="text-[#0f172a]" style={{ color: '#0f172a' }} />
                        <span className="text-[#0f172a] font-black" style={{ color: '#0f172a' }}>Go Back</span>
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.04, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/')}
                        className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm text-[var(--text-on-accent)] hover:opacity-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        style={{ background: 'var(--bg-accent)', boxShadow: '0 10px 30px var(--bg-accent-glow)' }}
                        aria-label="Go to home page"
                    >
                        <Home size={18} />
                        Go Home
                    </motion.button>
                </motion.div>
            </motion.div>
        </div>
    );
}
