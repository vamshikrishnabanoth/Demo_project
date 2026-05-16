import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

/**
 * EmptyState — reusable empty state component.
 * Used when a list/table has no data, no search results, or an error.
 * 
 * Props:
 *   icon         — Lucide icon component
 *   title        — Main heading
 *   description  — Supportive text
 *   action       — { label, to, onClick } — optional CTA button
 *   variant      — 'default' | 'search' | 'error'
 */
const EmptyState = ({
    icon: Icon,
    title,
    description,
    action,
    variant = 'default',
    className = '',
}) => {
    const colors = {
        default: {
            iconBg:     'bg-white/[0.03]',
            iconBorder: 'border-white/10',
            iconColor:  'text-white/20',
            glowColor:  'bg-[var(--bg-accent)]',
        },
        search: {
            iconBg:     'bg-white/[0.03]',
            iconBorder: 'border-white/10',
            iconColor:  'text-white/20',
            glowColor:  'bg-[var(--bg-accent)]',
        },
        error: {
            iconBg:     'bg-red-500/5',
            iconBorder: 'border-red-500/20',
            iconColor:  'text-red-400/60',
            glowColor:  'bg-red-500',
        },
    };

    const c = colors[variant] || colors.default;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={`flex flex-col items-center justify-center py-20 text-center px-6 ${className}`}
            role="status"
            aria-label={title}
        >
            {/* Icon */}
            <div className={`relative w-24 h-24 ${c.iconBg} border-2 ${c.iconBorder} rounded-[2rem] flex items-center justify-center mb-8`}>
                {/* Ambient glow */}
                <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className={`absolute inset-0 ${c.glowColor}/5 rounded-[2rem]`}
                />
                {Icon && <Icon size={40} className={`relative z-10 ${c.iconColor}`} aria-hidden="true" />}
            </div>

            {/* Text */}
            <h3 className="text-2xl font-black italic uppercase tracking-tight text-white mb-3">
                {title}
            </h3>
            {description && (
                <p className="text-sm font-semibold text-white/40 max-w-sm leading-relaxed mb-8">
                    {description}
                </p>
            )}

            {/* CTA */}
            {action && (
                action.to ? (
                    <Link
                        to={action.to}
                        className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-sm text-[var(--text-on-accent)] hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        style={{ background: 'var(--bg-accent)', boxShadow: '0 10px 30px var(--bg-accent-glow)' }}
                    >
                        {action.label}
                    </Link>
                ) : (
                    <button
                        onClick={action.onClick}
                        className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-sm text-[var(--text-on-accent)] hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        style={{ background: 'var(--bg-accent)', boxShadow: '0 10px 30px var(--bg-accent-glow)' }}
                    >
                        {action.label}
                    </button>
                )
            )}
        </motion.div>
    );
};

export default EmptyState;
