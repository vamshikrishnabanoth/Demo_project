import React from 'react';
import { motion } from 'framer-motion';

export default function WaitingRoomLoader({ message = 'Joining Arena...' }) {
  const dots = Array.from({ length: 6 });
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--bg-primary)] overflow-hidden">
      {/* Ambient glow */}
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--bg-accent) 0%, transparent 70%)' }}
      />

      <div className="relative flex items-center justify-center w-64 h-64">
        {/* Pulsing rings */}
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border"
            style={{ borderColor: 'var(--bg-accent)', width: i * 80, height: i * 80 }}
            animate={{ scale: [1, 1.12, 1], opacity: [0.6 / i, 0.15, 0.6 / i] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
          />
        ))}

        {/* Orbiting participant dots */}
        {dots.map((_, i) => {
          const angle = (i / dots.length) * 360;
          return (
            <motion.div
              key={i}
              className="absolute w-3 h-3 rounded-full"
              style={{ background: 'var(--bg-accent)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 4 + i * 0.3, repeat: Infinity, ease: 'linear' }}
              transformTemplate={({ rotate }) =>
                `rotate(${rotate}) translateX(90px) rotate(-${rotate})`
              }
            />
          );
        })}

        {/* Center icon */}
        <motion.div
          animate={{ scale: [1, 1.08, 1], boxShadow: ['0 0 0px var(--bg-accent)', '0 0 40px var(--bg-accent)', '0 0 0px var(--bg-accent)'] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="relative z-10 w-20 h-20 rounded-[1.5rem] flex items-center justify-center"
          style={{ background: 'var(--bg-accent)' }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-on-accent)" strokeWidth="2" strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </motion.div>

        {/* Connection lines */}
        {[45, 135, 225, 315].map((angle, i) => (
          <motion.div
            key={i}
            className="absolute h-px origin-left"
            style={{
              width: 70,
              background: 'linear-gradient(to right, var(--bg-accent), transparent)',
              rotate: angle,
              left: '50%',
              top: '50%',
            }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.4 }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-10 text-center space-y-2"
      >
        <h2 className="text-2xl font-black uppercase italic tracking-widest" style={{ color: 'var(--text-primary)' }}>
          {message}
        </h2>
        <div className="flex items-center justify-center gap-2">
          {[0, 0.2, 0.4].map((d, i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--bg-accent)' }}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1, repeat: Infinity, delay: d }}
            />
          ))}
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: 'var(--text-secondary)' }}>
          Connected & Ready
        </p>
      </motion.div>
    </div>
  );
}
