import React, { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';

export default function ResultsLoader({ message = 'Calculating Results...' }) {
  const [pct, setPct] = useState(0);
  const textLetters = Array.from(message);

  useEffect(() => {
    const id = setInterval(() => {
      setPct((p) => {
        if (p >= 98) { clearInterval(id); return p; }
        return p + Math.random() * 8;
      });
    }, 50);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white overflow-hidden select-none">
      {/* Background Soft Glow */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none bg-[var(--bg-accent)]/15 blur-3xl animate-soft-glow"
      />

      {/* Progress Ring Core */}
      <div className="relative flex items-center justify-center w-56 h-56">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="112"
            cy="112"
            r="100"
            stroke="#e2e8f0"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="112"
            cy="112"
            r="100"
            stroke="var(--bg-accent)"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray="628"
            style={{
              strokeDashoffset: 628 * (1 - Math.min(pct, 100) / 100),
              transition: 'stroke-dashoffset 0.1s linear',
            }}
            strokeLinecap="round"
          />
        </svg>

        {/* Center Content Card */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="p-2.5 bg-slate-100 rounded-2xl text-[var(--bg-accent)] mb-1 shadow-xs border border-slate-200">
            <Trophy size={24} />
          </div>
          <div className="text-4xl font-black italic tracking-tighter text-[#111111]">
            {Math.floor(pct)}%
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#555555]">
            Analyzing
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-8 w-64 h-2 rounded-full overflow-hidden bg-slate-100 border border-slate-200 p-0.5 shadow-inner">
        <div
          className="h-full rounded-full bg-[var(--bg-accent)]"
          style={{
            width: `${Math.min(pct, 100)}%`,
            transition: 'width 0.1s linear',
          }}
        />
      </div>

      {/* Status Title */}
      <div
        className="mt-6 text-center space-y-1.5"
      >
        <div className="flex flex-wrap justify-center font-black text-[#111111] italic uppercase tracking-[0.2em] text-lg sm:text-xl">
          {textLetters.map((letter, index) => (
            <span
              key={index}
              className="opacity-0 animate-fade-in-up"
              style={{
                '--animate-delay': `${0.04 * index + 0.03 * index}s`,
              }}
            >
              {letter === " " ? "\u00A0" : letter}
            </span>
          ))}
        </div>
        <p className="text-[10px] font-black text-[#555555] uppercase tracking-[0.25em]">
          Synthesizing Leaderboard & Analytics
        </p>
      </div>
    </div>
  );
}
