import React from 'react';

export default function MatchmakingLoader({ message = 'Finding Opponent...' }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--bg-primary)] overflow-hidden">
      {/* Dynamic energy streaks */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute h-px origin-center animate-streak-pulse"
          style={{
            width: '60%',
            background: 'linear-gradient(to right, transparent, var(--bg-accent), transparent)',
            top: '50%',
            left: '20%',
            '--streak-transform': `rotate(${i * 22.5}deg)`,
            '--streak-delay': `${i * 0.18}s`,
          }}
        />
      ))}

      {/* VS layout */}
      <div className="relative flex items-center gap-12 z-10">
        {/* Player 1 */}
        <div
          className="flex flex-col items-center gap-3 animate-shake-right"
        >
          <div
            className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-3xl font-black animate-glow-box-pulse"
            style={{
              background: 'var(--bg-accent)',
              color: 'var(--text-on-accent)',
            }}
          >
            ⚡
          </div>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Player</p>
        </div>

        {/* VS Badge */}
        <div className="relative flex items-center justify-center">
          <div
            className="absolute rounded-full animate-vs-glow"
            style={{ width: 80, height: 80, background: 'radial-gradient(circle, var(--bg-accent) 0%, transparent 70%)' }}
          />
          <span
            className="relative z-10 text-3xl font-black italic animate-vs-text-scale"
            style={{ color: 'var(--bg-accent)' }}
          >
            VS
          </span>
        </div>

        {/* Opponent (searching) */}
        <div
          className="flex flex-col items-center gap-3 animate-shake-left"
          style={{
            '--shake-delay': '0.4s'
          }}
        >
          <div
            className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center border-2 animate-border-pulse"
            style={{ borderStyle: 'dashed' }}
          >
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--bg-accent)', borderTopColor: 'transparent' }}
            />
          </div>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Searching...</p>
        </div>
      </div>

      {/* Timer pulse */}
      <div
        className="mt-10 text-center animate-opacity-pulse"
      >
        <p className="text-xs font-black uppercase tracking-[0.35em]" style={{ color: 'var(--bg-accent)' }}>
          ● MATCHMAKING ACTIVE
        </p>
      </div>

      <h2
        className="mt-4 text-xl font-black uppercase italic tracking-widest text-center opacity-0 animate-fade-in-up"
        style={{
          color: 'var(--text-primary)',
          '--animate-delay': '0.3s'
        }}
      >
        {message}
      </h2>
    </div>
  );
}
