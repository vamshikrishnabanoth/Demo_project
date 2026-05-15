import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Hexagon, Circle, Shield, Cpu, Zap, Activity } from 'lucide-react';

import ParticleEngine from './ParticleEngine';

/**
 * CinematicBackground
 * A high-end animation system featuring:
 * 1. Aurora light waves
 * 2. High-fidelity Particle Engine (Fore, Mid, Back layers)
 * 3. Parallax Tech symbols
 * 4. Adaptive theme-aware colors
 */
const CinematicBackground = () => {
  // Parallax shapes (Gaming/Tech themed)
  const floatingSymbols = [
    { icon: Hexagon, size: 40, delay: 0 },
    { icon: Shield, size: 30, delay: 2 },
    { icon: Cpu, size: 35, delay: 4 },
    { icon: Zap, size: 25, delay: 6 },
    { icon: Activity, size: 30, delay: 8 },
    { icon: Circle, size: 20, delay: 10 },
  ];

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[var(--bg-primary)]">
      {/* ─── LAYER 1: CINEMATIC AURORA WAVES ────────────────────────────── */}
      <div className="absolute inset-0 opacity-40 mix-blend-screen overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] 
             bg-[radial-gradient(circle_at_20%_30%,var(--bg-accent)_0%,transparent_50%),radial-gradient(circle_at_80%_70%,#4F46E5_0%,transparent_50%)]
             animate-[aurora_30s_infinite_alternate] blur-[80px]" 
        />
        <div className="absolute top-0 left-0 w-full h-full 
             bg-[radial-gradient(circle_at_50%_50%,rgba(26,122,122,0.1)_0%,transparent_70%)]
             animate-[pulse_15s_infinite_alternate]" 
        />
      </div>

      {/* ─── LAYER 2: HIGH-FIDELITY PARTICLE ENGINE ─────────────────────── */}
      <ParticleEngine />

      {/* ─── LAYER 3: PARALLAX TECH SYMBOLS ─────────────────────────────── */}
      <div className="absolute inset-0">
        {floatingSymbols.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={i}
              initial={{ 
                x: Math.random() * 100 + "%", 
                y: Math.random() * 100 + "%",
                rotate: 0,
                opacity: 0
              }}
              animate={{
                y: [null, "-100px", "100px", "0px"],
                x: [null, "50px", "-50px", "0px"],
                rotate: [0, 360],
                opacity: [0, 0.08, 0.04]
              }}
              transition={{
                duration: Math.random() * 20 + 30,
                repeat: Infinity,
                delay: item.delay,
                ease: "linear"
              }}
              className="absolute text-[var(--bg-accent)]"
            >
              <Icon size={item.size} strokeWidth={1} />
            </motion.div>
          );
        })}
      </div>

      {/* ─── LAYER 4: VIGNETTE & DEPTH ──────────────────────────────────── */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
      <div className="absolute inset-0 backdrop-blur-[1px]" />
      
      {/* ─── GLOBAL AURORA ANIMATIONS ──────────────────────────────────── */}
      <style>{`
        @keyframes aurora {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(5deg) scale(1.1); }
          100% { transform: rotate(-5deg) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default CinematicBackground;
