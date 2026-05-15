import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function ResultsLoader({ message = 'Calculating Results...' }) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPct((p) => {
        if (p >= 95) { clearInterval(id); return p; }
        return p + Math.random() * 4;
      });
    }, 80);
    return () => clearInterval(id);
  }, []);

  const segments = 12;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--bg-primary)] overflow-hidden">
      {/* Background wave */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute bottom-0 left-0 right-0 h-1 rounded-full"
            style={{ background: 'var(--bg-accent)', bottom: i * 8, opacity: 0.15 - i * 0.04 }}
            animate={{ scaleX: [0.8, 1.05, 0.8], x: ['-5%', '5%', '-5%'] }}
            transition={{ duration: 3 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
          />
        ))}
      </div>

      <div className="relative flex items-center justify-center w-56 h-56">
        {/* Rotating segmented ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0"
        >
          {Array.from({ length: segments }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute top-0 left-1/2 origin-bottom"
              style={{
                width: 3,
                height: 24,
                marginLeft: -1.5,
                background: 'var(--bg-accent)',
                borderRadius: 4,
                rotate: `${(i / segments) * 360}deg`,
                transformOrigin: '50% 112px',
                opacity: i % 3 === 0 ? 1 : 0.3,
              }}
              animate={{ opacity: i % 3 === 0 ? [1, 0.3, 1] : [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: (i / segments) * 1.2 }}
            />
          ))}
        </motion.div>

        {/* Scan sweep */}
        <motion.div
          className="absolute rounded-full"
          style={{
            inset: 16,
            background: 'conic-gradient(from 0deg, var(--bg-accent) 0deg, transparent 60deg)',
            opacity: 0.25,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
        />

        {/* Floating data particles */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--bg-accent)' }}
            animate={{
              x: [0, (Math.cos((i / 8) * Math.PI * 2) * 60)],
              y: [0, (Math.sin((i / 8) * Math.PI * 2) * 60)],
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
            }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.25, ease: 'easeOut' }}
          />
        ))}

        {/* Center percentage */}
        <div className="relative z-10 text-center">
          <motion.div
            className="text-4xl font-black italic"
            style={{ color: 'var(--bg-accent)' }}
          >
            {Math.floor(pct)}%
          </motion.div>
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            Processing
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="mt-8 w-64 h-1.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'var(--bg-accent)', width: `${pct}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 text-center space-y-1"
      >
        <h2 className="text-xl font-black uppercase italic tracking-widest" style={{ color: 'var(--text-primary)' }}>
          {message}
        </h2>
        <p className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: 'var(--text-secondary)' }}>
          Calculating your results
        </p>
      </motion.div>
    </div>
  );
}
