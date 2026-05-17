import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function ResultsLoader({ message = 'Calculating Results...' }) {
  const [pct, setPct] = useState(0);
  const textLetters = Array.from(message);

  useEffect(() => {
    const id = setInterval(() => {
      setPct((p) => {
        if (p >= 98) { clearInterval(id); return p; }
        return p + Math.random() * 5;
      });
    }, 70);
    return () => clearInterval(id);
  }, []);

  const segments = 16;

  const textContainer = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: 0.03, delayChildren: 0.05 * i },
    }),
  };

  const childLetter = {
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', damping: 12, stiffness: 200 },
    },
    hidden: { opacity: 0, y: 10 },
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--bg-primary)] overflow-hidden">
      {/* Background cyber grid / scan wave */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--bg-accent-glow),transparent_70%)]" />
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute bottom-0 left-0 right-0 h-1.5"
            style={{ 
              background: 'linear-gradient(to right, transparent, var(--bg-accent), transparent)', 
              bottom: i * 12, 
              opacity: 0.2 - i * 0.05 
            }}
            animate={{ scaleX: [0.7, 1.1, 0.7], x: ['-20%', '20%', '-20%'] }}
            transition={{ duration: 4 + i * 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 }}
          />
        ))}
      </div>

      {/* Cybernetic Progress Core */}
      <div className="relative flex items-center justify-center w-64 h-64">
        {/* Rotating segmented outer ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0"
        >
          {Array.from({ length: segments }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute top-0 left-1/2 origin-bottom"
              style={{
                width: 3.5,
                height: 26,
                marginLeft: -1.75,
                background: 'var(--bg-accent)',
                borderRadius: 99,
                rotate: `${(i / segments) * 360}deg`,
                transformOrigin: '50% 128px',
                opacity: i % 4 === 0 ? 1 : 0.25,
                boxShadow: i % 4 === 0 ? '0 0 10px var(--bg-accent-glow)' : 'none'
              }}
              animate={{ opacity: i % 4 === 0 ? [1, 0.4, 1] : [0.25, 0.9, 0.25] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: (i / segments) * 1.5 }}
            />
          ))}
        </motion.div>

        {/* Outer rotating neon shadow ring */}
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-4 rounded-full border border-dashed border-[var(--bg-accent)]/20 shadow-[0_0_30px_var(--bg-accent-glow)]"
        />

        {/* Conic scanning sweep gradient */}
        <motion.div
          className="absolute rounded-full"
          style={{
            inset: 22,
            background: 'conic-gradient(from 0deg, var(--bg-accent) 0deg, transparent 75deg)',
            opacity: 0.35,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />

        {/* Micro data core particles */}
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-[var(--bg-accent)]"
            style={{ boxShadow: '0 0 12px var(--bg-accent-glow)' }}
            animate={{
              x: [0, (Math.cos((i / 10) * Math.PI * 2) * 75)],
              y: [0, (Math.sin((i / 10) * Math.PI * 2) * 75)],
              opacity: [0, 1, 0],
              scale: [0, 1.2, 0],
            }}
            transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.22, ease: 'easeOut' }}
          />
        ))}

        {/* Center Percentage Matrix (Futuristic HUD) */}
        <div className="relative z-10 text-center bg-white/[0.02] border border-white/10 rounded-[3rem] w-36 h-36 flex flex-col items-center justify-center backdrop-blur-md shadow-2xl">
          <motion.div
            className="text-5xl font-black italic tracking-tighter"
            style={{ 
              color: 'var(--bg-accent)', 
              textShadow: '0 0 25px var(--bg-accent-glow)' 
            }}
          >
            {Math.floor(pct)}%
          </motion.div>
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 mt-1">
            Analyzing
          </div>
        </div>
      </div>

      {/* Cybernetic Progress Bar */}
      <div className="mt-12 w-72 h-2 rounded-full overflow-hidden bg-white/5 border border-white/10 relative p-0.5">
        <motion.div
          className="h-full rounded-full bg-[var(--bg-accent)]"
          style={{ width: `${pct}%`, boxShadow: '0 0 15px var(--bg-accent-glow)' }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {/* Futuristic Status Title Panel */}
      <motion.div
        variants={textContainer}
        initial="hidden"
        animate="visible"
        className="mt-8 text-center space-y-2"
      >
        <div className="flex flex-wrap justify-center font-black text-white italic uppercase tracking-[0.25em] text-lg sm:text-xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
          {textLetters.map((letter, index) => (
            <motion.span key={index} variants={childLetter}>
              {letter === " " ? "\u00A0" : letter}
            </motion.span>
          ))}
        </div>
        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">
          Synthesizing Leaderboard & Analytics
        </p>
      </motion.div>
    </div>
  );
}

