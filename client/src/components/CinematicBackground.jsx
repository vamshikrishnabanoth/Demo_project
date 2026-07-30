import React from 'react';

/**
 * CinematicBackground
 * Pure CSS animated gradient mesh — GPU-composited, zero JS overhead.
 * Three layered blobs drift slowly to create organic ambient motion.
 * Automatically pauses on prefers-reduced-motion via CSS.
 */
const CinematicBackground = () => {
  return (
    <div
      className="cinematic-bg-container"
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        minWidth: '100vw',
        minHeight: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Layer 1: Top-left drift blob */}
      <div
        className="cinematic-mesh-layer"
        style={{
          position: 'absolute',
          inset: '-10%',
          width: '120%',
          height: '120%',
          background: 'radial-gradient(ellipse 80% 60% at 20% 30%, var(--aurora-glow-1, rgba(19, 62, 135, 0.22)), transparent 70%)',
          animation: 'meshDrift1 22s ease-in-out infinite alternate',
        }}
      />

      {/* Layer 2: Center-right drift blob */}
      <div
        className="cinematic-mesh-layer"
        style={{
          position: 'absolute',
          inset: '-10%',
          width: '120%',
          height: '120%',
          background: 'radial-gradient(ellipse 70% 80% at 75% 60%, var(--aurora-glow-2, rgba(37, 99, 235, 0.16)), transparent 70%)',
          animation: 'meshDrift2 28s ease-in-out infinite alternate',
          mixBlendMode: 'multiply',
        }}
      />

      {/* Layer 3: Bottom drift blob */}
      <div
        className="cinematic-mesh-layer"
        style={{
          position: 'absolute',
          inset: '-10%',
          width: '120%',
          height: '120%',
          background: 'radial-gradient(ellipse 60% 50% at 50% 85%, var(--aurora-glow-3, rgba(168, 197, 226, 0.25)), transparent 65%)',
          animation: 'meshDrift3 25s ease-in-out infinite alternate',
        }}
      />

      {/* Layer 4: Subtle aurora pulse overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(19, 62, 135, 0.04) 0%, transparent 40%, rgba(37, 99, 235, 0.03) 70%, transparent 100%)',
          animation: 'auroraPulse 8s ease-in-out infinite',
        }}
      />
    </div>
  );
};

export default React.memo(CinematicBackground);
