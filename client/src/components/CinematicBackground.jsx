import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Hexagon, Circle, Shield, Cpu, Zap, Activity } from 'lucide-react';
import ParticleEngine from './ParticleEngine';
import { useMediaQuery } from '../hooks/useMediaQuery';

/**
 * CinematicBackground
 * Cinematic layered background system.
 * - Disabled on mobile to save GPU
 * - Respects prefers-reduced-motion accessibility setting
 */
const CinematicBackground = () => {
  const isMobile            = useMediaQuery('(max-width: 767px)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  // Memoize floating symbols so positions don't re-randomize on re-render
  const floatingSymbols = useMemo(() => [
    { icon: Hexagon,  size: 40, delay: 0  },
    { icon: Shield,   size: 30, delay: 2  },
    { icon: Cpu,      size: 35, delay: 4  },
    { icon: Zap,      size: 25, delay: 6  },
    { icon: Activity, size: 30, delay: 8  },
    { icon: Circle,   size: 20, delay: 10 },
  ], []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[var(--bg-primary)]">

      {/* ─── LAYER 1: AURORA WAVES ─────────────────────────────────────────── */}
      <div className="absolute inset-0 opacity-40 mix-blend-screen overflow-hidden">
        <div
          className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] blur-[80px]"
          style={{
            background: 'radial-gradient(circle at 20% 30%, var(--aurora-glow-1) 0%, transparent 50%), radial-gradient(circle at 80% 70%, var(--aurora-glow-2) 0%, transparent 50%)',
            animation: 'aurora 30s infinite alternate',
          }}
        />
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{
            background: 'radial-gradient(circle at 50% 50%, var(--aurora-glow-2) 0%, transparent 70%)',
            animation: 'pulse 15s infinite alternate',
          }}
        />
      </div>

      {/* ─── LAYER 2: PARTICLE ENGINE (skip on mobile or reduced motion) ─── */}
      {!isMobile && !prefersReducedMotion && <ParticleEngine />}

      {/* ─── LAYER 3: FLOATING TECH SYMBOLS (skip on mobile / reduced motion) */}
      {!isMobile && !prefersReducedMotion && (
        <div className="absolute inset-0" aria-hidden="true">
          {floatingSymbols.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={i}
                initial={{
                  x: `${(i * 17 + 5) % 100}%`, // Deterministic — not Math.random()
                  y: `${(i * 13 + 10) % 100}%`,
                  rotate: 0,
                  opacity: 0,
                }}
                animate={{
                  y: [null, '-100px', '100px', '0px'],
                  x: [null, '50px', '-50px', '0px'],
                  rotate: [0, 360],
                  opacity: [0, 0.08, 0.04],
                }}
                transition={{
                  duration: 30 + i * 3,     // Deterministic — not Math.random()
                  repeat: Infinity,
                  delay: item.delay,
                  ease: 'linear',
                }}
                className="absolute text-[var(--bg-accent)]"
              >
                <Icon size={item.size} strokeWidth={1} />
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── LAYER 4: VIGNETTE & DEPTH ────────────────────────────────────── */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
      {/* Subtle global blur only on desktop */}
      {!isMobile && <div className="absolute inset-0 backdrop-blur-[1px]" />}

      {/* ─── KEYFRAMES ──────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes aurora {
          0%   { transform: rotate(0deg)  scale(1);   }
          50%  { transform: rotate(5deg)  scale(1.1); }
          100% { transform: rotate(-5deg) scale(1);   }
        }
      `}</style>
    </div>
  );
};

export default React.memo(CinematicBackground);
