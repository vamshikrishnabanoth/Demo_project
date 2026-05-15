import React from 'react';
import { motion } from 'framer-motion';

const CARDS = [0, 1, 2, 3, 4];

export default function FlashcardLoader({ message = 'Assembling Flashcards...' }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--bg-primary)] overflow-hidden">
      <motion.div
        animate={{ opacity: [0.08, 0.22, 0.08] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--bg-accent) 0%, transparent 70%)' }}
      />

      {/* Card stack assembly animation */}
      <div className="relative w-72 h-48">
        {CARDS.map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-2xl border flex items-center justify-center"
            style={{
              width: '100%',
              height: '100%',
              borderColor: 'var(--bg-accent)',
              background: `rgba(${i * 12}, ${i * 8}, ${i * 15}, 0.6)`,
              backdropFilter: 'blur(8px)',
              boxShadow: i === CARDS.length - 1 ? '0 0 30px var(--bg-accent-glow)' : 'none',
            }}
            initial={{ y: -160, opacity: 0, rotateX: 90 }}
            animate={{
              y: -i * 6,
              opacity: 1,
              rotateX: 0,
              scale: 1 - i * 0.04,
            }}
            transition={{
              delay: i * 0.15,
              duration: 0.7,
              ease: [0.16, 1, 0.3, 1],
              repeat: Infinity,
              repeatDelay: 2.5,
              repeatType: 'loop',
            }}
          >
            {i === 0 && (
              <div className="text-center p-6">
                <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Flashcard {CARDS.length}
                </div>
                <motion.div
                  className="h-2 rounded-full"
                  style={{ background: 'var(--bg-accent)', width: '80%', margin: '0 auto' }}
                  animate={{ scaleX: [0, 1, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            )}
          </motion.div>
        ))}

        {/* Glowing border on top card */}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ border: '1.5px solid var(--bg-accent)', boxShadow: '0 0 20px var(--bg-accent-glow)' }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-12 text-center space-y-2"
      >
        <h2 className="text-xl font-black uppercase italic tracking-widest" style={{ color: 'var(--text-primary)' }}>
          {message}
        </h2>
        <p className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: 'var(--text-secondary)' }}>
          Building your study stack
        </p>
      </motion.div>
    </div>
  );
}
