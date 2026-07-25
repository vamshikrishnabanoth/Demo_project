import React from 'react';
import { motion } from 'framer-motion';

export default function FileUploadLoader({ message = 'Processing File...' }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--bg-primary)] overflow-hidden">
      <motion.div
        animate={{ opacity: [0.08, 0.2, 0.08] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--bg-accent) 0%, transparent 70%)' }}
      />

      <div className="relative w-56 h-56 flex items-center justify-center z-10">
        {/* Document icon */}
        <motion.div
          className="relative w-28 h-36 rounded-xl flex flex-col items-center justify-center gap-2 overflow-hidden"
          style={{
            background: 'var(--bg-secondary)',
            border: '1.5px solid var(--bg-accent)',
            boxShadow: '0 0 24px var(--bg-accent-glow)',
          }}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Scan line */}
          <motion.div
            className="absolute left-0 right-0 h-0.5"
            style={{ background: 'var(--bg-accent)' }}
            animate={{ top: ['10%', '90%', '10%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.15)', width: `${80 - i * 15}%` }}
              animate={{ opacity: [0.3, 0.8, 0.3], scaleX: [0.95, 1, 0.95] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
          {/* Corner fold */}
          <div
            className="absolute top-0 right-0 w-5 h-5"
            style={{
              background: 'var(--bg-primary)',
              clipPath: 'polygon(100% 0, 0 0, 100% 100%)',
            }}
          />
        </motion.div>

        {/* Floating document particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2.5 rounded-sm"
            style={{ background: 'var(--bg-accent)', opacity: 0.5 }}
            animate={{
              x: [0, Math.cos((i / 6) * Math.PI * 2) * 70],
              y: [0, Math.sin((i / 6) * Math.PI * 2) * 60 - 20],
              opacity: [0, 0.7, 0],
              rotate: [0, 180],
              scale: [0.5, 1, 0.5],
            }}
            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4, ease: 'easeOut' }}
          />
        ))}

        {/* Animated Upload Indicator */}
        <div className="download-button mt-6 pointer-events-none">
          <div className="docs">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Uploading File...
          </div>
          <div className="download" style={{ transform: 'translateY(100%)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
        </div>

        {/* Upload arrow */}
        <motion.div
          className="absolute -top-4"
          animate={{ y: [-4, -12, -4], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--bg-accent)" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </motion.div>
      </div>

      {/* Progress morphing bar */}
      <div
        className="mt-8 w-56 h-1.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.07)' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'var(--bg-accent)' }}
          animate={{ x: ['-100%', '0%', '100%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
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
          Parsing document structure
        </p>
      </motion.div>
    </div>
  );
}
