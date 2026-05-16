import React from 'react';
import { motion } from 'framer-motion';

/**
 * PremiumButton
 * A production-grade button with built-in cinematic hover, tap, and glow effects.
 */
export const PremiumButton = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  disabled = false,
  icon: Icon = null,
  type = 'button'
}) => {
  const variants = {
    primary: 'bg-[var(--bg-accent)] text-[var(--text-on-accent)] shadow-lg active:shadow-inner',
    secondary: 'bg-white/5 text-white border border-white/10 hover:bg-white/10',
    danger: 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20',
    ghost: 'bg-transparent text-[var(--text-secondary)] hover:text-white hover:bg-white/5'
  };

  return (
    <motion.button
      type={type}
      whileHover={!disabled ? { scale: 1.01, translateY: -1 } : {}}
      whileTap={!disabled ? { scale: 0.98, translateY: 0 } : {}}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      onClick={onClick}
      disabled={disabled}
      className={`
        relative px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest 
        flex items-center justify-center gap-3 premium-transition
        disabled:opacity-40 disabled:cursor-not-allowed
        btn-cinematic ${variants[variant]} ${className}
      `}
    >
      {Icon && <Icon size={18} className="pointer-events-none" />}
      <span className="relative z-10 pointer-events-none">{children}</span>
    </motion.button>
  );
};

/**
 * PremiumInput
 * A specialized input with zero-jitter focus states and premium typography.
 */
export const PremiumInput = ({ 
  label, 
  placeholder, 
  value, 
  onChange, 
  type = 'text', 
  className = '',
  icon: Icon = null,
  endIcon: EndIcon = null,
  onEndIconClick = null,
  ...props 
}) => {
  return (
    <div className="space-y-3 w-full">
      {label && (
        <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.3em] ml-4">
          {label}
        </label>
      )}
      <div className="relative group">
        {Icon && (
          <div className={`absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none transition-colors ${value ? 'text-[var(--text-accent)] opacity-100' : 'text-white/40'} group-focus-within:text-[var(--text-accent)]`}>
            <Icon size={18} />
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`
            w-full bg-white/[0.03] border border-white/5 rounded-2xl py-5 
            ${Icon ? 'pl-14' : 'pl-6'} ${EndIcon ? 'pr-14' : 'pr-6'} 
            text-white font-black tracking-wide focus:outline-none 
            focus:border-[var(--bg-accent)]/50 focus:bg-white/[0.08] 
            premium-transition input-no-jitter ${className}
          `}
          {...props}
        />
        {EndIcon && (
          <div className="absolute inset-y-0 right-0 pr-6 flex items-center">
            {onEndIconClick ? (
              <button
                type="button"
                onClick={onEndIconClick}
                className={`transition-all active:scale-90 ${value ? 'text-[var(--text-accent)] opacity-100' : 'text-white/60 hover:text-white'}`}
              >
                <EndIcon size={18} className="drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]" />
              </button>
            ) : (
              <div className={value ? 'text-[var(--text-accent)] opacity-100' : 'text-white/60'}>
                <EndIcon size={18} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * GlassCard
 * A cinematic container with backdrop blur, depth-borders, and ambient lighting.
 */
export const GlassCard = ({ children, className = '', hover = true }) => {
  return (
    <motion.div
      whileHover={hover ? { y: -5, transition: { duration: 0.25 } } : {}}
      className={`
        glass-panel p-8 sm:p-12 rounded-[3rem] border border-white/5 
        relative overflow-hidden group premium-transition ${className}
      `}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-white/10 transition-colors" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};
