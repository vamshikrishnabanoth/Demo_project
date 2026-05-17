import React from 'react';
import { motion } from 'framer-motion';

export default function WaitingRoomLoader({ message = 'Joining Arena...' }) {
  const dots = Array.from({ length: 8 });
  const textLetters = Array.from(message);

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
      {/* Dynamic Cybernetic Ambient Backdrops */}
      <motion.div
        animate={{ 
          scale: [1, 1.4, 1], 
          opacity: [0.2, 0.45, 0.2],
          rotate: [0, 180, 360]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute w-[600px] h-[600px] rounded-full pointer-events-none -z-10"
        style={{ 
          background: 'radial-gradient(circle, var(--bg-accent-glow) 0%, transparent 60%)',
          filter: 'blur(50px)'
        }}
      />
      <motion.div
        animate={{ 
          scale: [1.2, 0.9, 1.2], 
          opacity: [0.15, 0.3, 0.15] 
        }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute w-[800px] h-[800px] rounded-full pointer-events-none -z-10"
        style={{ 
          background: 'radial-gradient(circle, var(--bg-accent-glow) 0%, transparent 75%)',
          filter: 'blur(80px)'
        }}
      />

      {/* Cyber Portal Wrapper */}
      <div className="relative flex items-center justify-center w-72 h-72">
        {/* Holographic Concentric Rings */}
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2 border-dashed"
            style={{ 
              borderColor: i === 1 ? 'var(--bg-accent)' : 'rgba(255,255,255,0.05)',
              width: i * 85, 
              height: i * 85,
              opacity: 0.8 / i
            }}
            animate={{ 
              rotate: i % 2 === 0 ? 360 : -360,
              scale: [1, 1.05, 1]
            }}
            transition={{ 
              rotate: { duration: 8 + i * 4, repeat: Infinity, ease: 'linear' },
              scale: { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }
            }}
          />
        ))}

        {/* Orbiting Quantum Data Nodes */}
        {dots.map((_, i) => {
          const angle = (i / dots.length) * 360;
          return (
            <motion.div
              key={i}
              className="absolute w-2.5 h-2.5 rounded-full"
              style={{ 
                background: i % 2 === 0 ? 'var(--bg-accent)' : 'var(--text-primary)',
                boxShadow: '0 0 15px var(--bg-accent-glow)' 
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 5 + i * 0.5, repeat: Infinity, ease: 'linear' }}
              transformTemplate={({ rotate }) =>
                `rotate(${rotate}) translateX(${95 + (i % 2) * 15}px) rotate(-${rotate})`
              }
            />
          );
        })}

        {/* Center Quantum Core (Premium Glassmorphic Shield) */}
        <motion.div
          animate={{ 
            scale: [0.95, 1.05, 0.95],
            boxShadow: [
              '0 0 30px var(--bg-accent-glow), inset 0 0 20px rgba(255,255,255,0.1)',
              '0 0 60px var(--bg-accent-glow), inset 0 0 30px rgba(255,255,255,0.2)',
              '0 0 30px var(--bg-accent-glow), inset 0 0 20px rgba(255,255,255,0.1)'
            ]
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="relative z-10 w-24 h-24 rounded-[2rem] flex items-center justify-center border border-white/10"
          style={{ 
            background: 'linear-gradient(135deg, var(--bg-accent-glow), rgba(255,255,255,0.03))',
            backdropFilter: 'blur(12px)'
          }}
        >
          <svg className="w-9 h-9 text-white drop-shadow-[0_2px_10px_var(--bg-accent-glow)] animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </motion.div>

        {/* High-frequency Laser connection lines */}
        {[0, 60, 120, 180, 240, 300].map((angle, i) => (
          <motion.div
            key={i}
            className="absolute h-px origin-left"
            style={{
              width: 90,
              background: 'linear-gradient(to right, var(--bg-accent), transparent)',
              rotate: angle,
              left: '50%',
              top: '50%',
              opacity: 0.15
            }}
            animate={{ 
              opacity: [0.05, 0.4, 0.05],
              scaleX: [0.8, 1.2, 0.8]
            }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* Modern Status Info Panel */}
      <motion.div
        variants={textContainer}
        initial="hidden"
        animate="visible"
        className="mt-12 text-center space-y-3"
      >
        <div className="flex flex-wrap justify-center font-black text-white italic uppercase tracking-[0.25em] text-lg sm:text-2xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
          {textLetters.map((letter, index) => (
            <motion.span key={index} variants={childLetter}>
              {letter === " " ? "\u00A0" : letter}
            </motion.span>
          ))}
        </div>

        {/* Connected state chips */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center justify-center gap-3 bg-white/5 border border-white/10 px-5 py-2.5 rounded-full w-fit mx-auto backdrop-blur-md"
        >
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">
            Telemetry Link • Live Room Active
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}

