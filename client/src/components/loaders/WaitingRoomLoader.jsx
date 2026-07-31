import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export default function WaitingRoomLoader({ message = 'Joining Arena...' }) {
  const textLetters = Array.from(message);

  const textContainer = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: 0.04, delayChildren: 0.05 * i },
    }),
  };

  const childLetter = {
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', damping: 14, stiffness: 220 },
    },
    hidden: { opacity: 0, y: 12 },
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white overflow-hidden select-none">
      {/* Background Soft Glow */}
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1], 
          opacity: [0.15, 0.35, 0.15]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute w-[450px] h-[450px] rounded-full pointer-events-none bg-[var(--bg-accent)]/15 blur-3xl"
      />

      {/* Main Loader Core */}
      <div className="relative flex items-center justify-center w-48 h-48">
        {/* Smooth outer pulsing ring */}
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 rounded-full border-2 border-dashed border-[var(--bg-accent)]/40"
        />

        {/* Inner spinning accent arc */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-3 rounded-full border-4 border-transparent border-t-[var(--bg-accent)] border-r-[var(--bg-accent)]"
        />

        {/* Center Card Icon */}
        <div className="relative z-10 w-20 h-20 rounded-2xl bg-[var(--bg-accent)] flex items-center justify-center shadow-lg border-2 border-white text-white">
          <Sparkles size={36} className="animate-pulse" />
        </div>
      </div>

      {/* Animated Text Title */}
      <motion.div
        variants={textContainer}
        initial="hidden"
        animate="visible"
        className="mt-8 text-center space-y-3"
      >
        <div className="flex flex-wrap justify-center font-black text-[#111111] italic uppercase tracking-[0.2em] text-xl sm:text-2xl">
          {textLetters.map((letter, index) => (
            <motion.span key={index} variants={childLetter}>
              {letter === " " ? "\u00A0" : letter}
            </motion.span>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2.5 bg-slate-100 border border-slate-200 px-5 py-2 rounded-full w-fit mx-auto shadow-xs">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-black text-[#555555] uppercase tracking-[0.2em]">
            Connecting to Arena Session
          </span>
        </div>
      </motion.div>
    </div>
  );
}
