import React from 'react';
import { motion } from 'framer-motion';

export default function MatchmakingLoader({ message = 'Finding Opponent...' }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--bg-primary)] overflow-hidden">
      {/* Dynamic energy streaks */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-px origin-center"
          style={{
            width: '60%',
            background: 'linear-gradient(to right, transparent, var(--bg-accent), transparent)',
            rotate: `${i * 22.5}deg`,
            top: '50%',
            left: '20%',
          }}
          animate={{ opacity: [0, 0.5, 0], scaleX: [0.5, 1.2, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
        />
      ))}

      {/* VS layout */}
      <div className="relative flex items-center gap-12 z-10">
        {/* Player 1 */}
        <motion.div
          animate={{ x: [0, 6, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-3"
        >
          <motion.div
            className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-3xl font-black"
            style={{
              background: 'var(--bg-accent)',
              boxShadow: '0 0 30px var(--bg-accent-glow)',
              color: 'var(--text-on-accent)',
            }}
            animate={{ boxShadow: ['0 0 20px var(--bg-accent-glow)', '0 0 50px var(--bg-accent-glow)', '0 0 20px var(--bg-accent-glow)'] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            ⚡
          </motion.div>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Player</p>
        </motion.div>

        {/* VS Badge */}
        <div className="relative flex items-center justify-center">
          <motion.div
            className="absolute rounded-full"
            style={{ width: 80, height: 80, background: 'radial-gradient(circle, var(--bg-accent) 0%, transparent 70%)' }}
            animate={{ scale: [0.8, 1.4, 0.8], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <motion.span
            className="relative z-10 text-3xl font-black italic"
            style={{ color: 'var(--bg-accent)' }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            VS
          </motion.span>
        </div>

        {/* Opponent (searching) */}
        <motion.div
          animate={{ x: [0, -6, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          className="flex flex-col items-center gap-3"
        >
          <motion.div
            className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center border-2"
            style={{ borderColor: 'var(--bg-accent)', borderStyle: 'dashed' }}
            animate={{ borderColor: ['var(--bg-accent)', 'var(--text-secondary)', 'var(--bg-accent)'] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <motion.div
              className="w-8 h-8 rounded-full border-2 border-t-transparent"
              style={{ borderColor: 'var(--bg-accent)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Searching...</p>
        </motion.div>
      </div>

      {/* Timer pulse */}
      <motion.div
        className="mt-10 text-center"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <p className="text-xs font-black uppercase tracking-[0.35em]" style={{ color: 'var(--bg-accent)' }}>
          ● MATCHMAKING ACTIVE
        </p>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-4 text-xl font-black uppercase italic tracking-widest text-center"
        style={{ color: 'var(--text-primary)' }}
      >
        {message}
      </motion.h2>
    </div>
  );
}
