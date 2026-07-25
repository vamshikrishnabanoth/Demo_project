import React from 'react';
import { motion } from 'framer-motion';

function SkeletonBlock({ width = '100%', height = 20, className = '' }) {
  return (
    <div
      className={`shimmer-block rounded-xl ${className}`}
      style={{ width, height }}
    />
  );
}

export default function DashboardSkeletonLoader() {
  return (
    <div className="w-full min-h-screen p-6 space-y-8" style={{ background: 'var(--bg-primary)' }}>
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <SkeletonBlock width={48} height={48} className="rounded-2xl" />
        <div className="space-y-2 flex-1">
          <SkeletonBlock width="30%" height={18} />
          <SkeletonBlock width="20%" height={12} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl p-5 space-y-3"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          >
            <SkeletonBlock width={40} height={40} className="rounded-xl" />
            <SkeletonBlock width="60%" height={12} />
            <SkeletonBlock width="40%" height={22} />
          </motion.div>
        ))}
      </div>

      {/* Chart placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="rounded-3xl p-6 space-y-4"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
      >
        <SkeletonBlock width="25%" height={16} />
        <div className="flex items-end gap-2 h-32">
          {[60, 85, 40, 90, 70, 55, 75, 95, 50, 80].map((h, i) => (
            <motion.div
              key={i}
              className="flex-1 rounded-t-lg relative overflow-hidden"
              style={{ height: `${h}%`, background: 'rgba(255,255,255,0.05)' }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.5 + i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1], transformOrigin: 'bottom' }}
            >
              <motion.div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }}
                animate={{ x: ['-200%', '200%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: i * 0.1 }}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* List rows */}
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-4 p-4 rounded-2xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          >
            <SkeletonBlock width={40} height={40} className="rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock width="45%" height={14} />
              <SkeletonBlock width="30%" height={10} />
            </div>
            <SkeletonBlock width={60} height={28} className="rounded-xl" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
