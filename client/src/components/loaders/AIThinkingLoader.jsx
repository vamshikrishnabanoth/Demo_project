import React from 'react';
import { motion } from 'framer-motion';

const NODES = [
  { x: 50, y: 50 },
  { x: 20, y: 20 }, { x: 80, y: 20 },
  { x: 10, y: 60 }, { x: 50, y: 85 }, { x: 90, y: 60 },
  { x: 35, y: 40 }, { x: 65, y: 40 },
];

const CONNECTIONS = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
  [1, 6], [2, 7], [6, 3], [7, 4], [6, 7],
];

export default function AIThinkingLoader({ message = 'AI Generating Questions...' }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--bg-primary)] overflow-hidden">
      {/* Gradient background pulse */}
      <motion.div
        animate={{ opacity: [0.06, 0.18, 0.06] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, var(--bg-accent) 0%, transparent 65%)',
        }}
      />

      {/* Neural network SVG */}
      <div className="relative w-72 h-72">
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
          {/* Connection lines */}
          {CONNECTIONS.map(([a, b], i) => (
            <motion.line
              key={i}
              x1={NODES[a].x} y1={NODES[a].y}
              x2={NODES[b].x} y2={NODES[b].y}
              stroke="var(--bg-accent)"
              strokeWidth="0.4"
              animate={{ opacity: [0.1, 0.7, 0.1], pathLength: [0, 1, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
            />
          ))}

          {/* Flowing energy along connections */}
          {CONNECTIONS.map(([a, b], i) => (
            <motion.circle
              key={`p-${i}`}
              r="1.5"
              fill="var(--bg-accent)"
              animate={{
                cx: [NODES[a].x, NODES[b].x, NODES[a].x],
                cy: [NODES[a].y, NODES[b].y, NODES[a].y],
                opacity: [0, 1, 0],
              }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
            />
          ))}

          {/* Nodes */}
          {NODES.map((node, i) => (
            <g key={i}>
              <motion.circle
                cx={node.x} cy={node.y} r={i === 0 ? 5 : 3}
                fill="none"
                stroke="var(--bg-accent)"
                strokeWidth="0.6"
                animate={{ r: [i === 0 ? 5 : 3, i === 0 ? 6.5 : 4, i === 0 ? 5 : 3], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
              />
              <motion.circle
                cx={node.x} cy={node.y} r={i === 0 ? 2.5 : 1.2}
                fill="var(--bg-accent)"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
              />
            </g>
          ))}
        </svg>

        {/* Waveform at bottom */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-1 h-8">
          {[...Array(16)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 rounded-full flex-shrink-0"
              style={{ background: 'var(--bg-accent)' }}
              animate={{ height: ['4px', `${8 + Math.sin(i) * 14}px`, '4px'] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.08, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 text-center space-y-2"
      >
        <h2 className="text-xl font-black uppercase italic tracking-widest" style={{ color: 'var(--text-primary)' }}>
          {message}
        </h2>
        <p className="text-xs font-bold uppercase tracking-[0.35em]" style={{ color: 'var(--text-secondary)' }}>
          AI is thinking...
        </p>
      </motion.div>
    </div>
  );
}
