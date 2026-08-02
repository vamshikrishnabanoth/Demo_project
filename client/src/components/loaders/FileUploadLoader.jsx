import React from 'react';

export default function FileUploadLoader({ message = 'Processing File...' }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--bg-primary)] overflow-hidden">
      <div
        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none animate-glow-pulse"
        style={{ background: 'radial-gradient(circle, var(--bg-accent) 0%, transparent 70%)' }}
      />

      <div className="relative w-56 h-56 flex items-center justify-center z-10">
        {/* Document icon */}
        <div
          className="relative w-28 h-36 rounded-xl flex flex-col items-center justify-center gap-2 overflow-hidden animate-doc-bob"
          style={{
            background: 'var(--bg-secondary)',
            border: '1.5px solid var(--bg-accent)',
            boxShadow: '0 0 24px var(--bg-accent-glow)',
          }}
        >
          {/* Scan line */}
          <div
            className="absolute left-0 right-0 h-0.5 animate-scan-line"
            style={{ background: 'var(--bg-accent)' }}
          />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-1.5 rounded-full animate-line-pulse"
              style={{
                background: 'rgba(255,255,255,0.15)',
                width: `${80 - i * 15}%`,
                '--line-delay': `${i * 0.3}s`,
              }}
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
        </div>

        {/* Floating document particles */}
        {[...Array(6)].map((_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          const px = Math.cos(angle) * 70;
          const py = Math.sin(angle) * 60 - 20;
          return (
            <div
              key={i}
              className="absolute w-2 h-2.5 rounded-sm animate-particle-explode"
              style={{
                background: 'var(--bg-accent)',
                opacity: 0.5,
                '--p-x': `${px}px`,
                '--p-y': `${py}px`,
                '--p-delay': `${i * 0.4}s`,
              }}
            />
          );
        })}

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
        <div
          className="absolute -top-4 animate-arrow-bob"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--bg-accent)" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </div>
      </div>

      {/* Progress morphing bar */}
      <div
        className="mt-8 w-56 h-1.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.07)' }}
      >
        <div
          className="h-full rounded-full animate-progress-slide"
          style={{ background: 'var(--bg-accent)', width: '100%' }}
        />
      </div>

      <div
        className="mt-6 text-center space-y-1 opacity-0 animate-fade-in-up"
        style={{
          '--animate-delay': '0.3s'
        }}
      >
        <h2 className="text-xl font-black uppercase italic tracking-widest" style={{ color: 'var(--text-primary)' }}>
          {message}
        </h2>
        <p className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: 'var(--text-secondary)' }}>
          Parsing document structure
        </p>
      </div>
    </div>
  );
}
