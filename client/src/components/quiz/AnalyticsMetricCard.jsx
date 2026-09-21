import React from 'react';

/**
 * Disciplined Semantic Color Palette for Analytics KPI Cards:
 * - Blue: Participants / Attendance
 * - Teal: Average Score / Performance
 * - Orange: Highest Score / Top Achievement (KMIT Brand)
 * - Violet: Total Questions / Assessment Scope
 *
 * Explicit styles are used to preserve isolation from global theme overrides.
 */
const COLOR_CONFIG = {
    blue: {
        border: 'border-[#bfdbfe]/70 hover:border-[#60a5fa]',
        topLine: 'bg-[#3b82f6]',
        iconBg: 'bg-[#eff6ff]',
        iconBorder: 'border-[#bfdbfe]',
        iconColor: 'text-[#2563eb]',
        labelColor: 'text-[#1d4ed8]',
        numberColor: 'text-[#1e3a8a]',
        shadow: 'shadow-[0_2px_10px_rgba(37,99,235,0.05)] hover:shadow-[0_8px_20px_rgba(37,99,235,0.12)]',
    },
    teal: {
        border: 'border-[#99f6e4]/70 hover:border-[#2dd4bf]',
        topLine: 'bg-[#14b8a6]',
        iconBg: 'bg-[#f0fdfa]',
        iconBorder: 'border-[#99f6e4]',
        iconColor: 'text-[#0d9488]',
        labelColor: 'text-[#0f766e]',
        numberColor: 'text-[#134e4a]',
        shadow: 'shadow-[0_2px_10px_rgba(13,148,136,0.05)] hover:shadow-[0_8px_20px_rgba(13,148,136,0.12)]',
    },
    orange: {
        border: 'border-[#fed7aa]/80 hover:border-[#fb923c]',
        topLine: 'bg-[#ea580c]',
        iconBg: 'bg-[#fff7ed]',
        iconBorder: 'border-[#fed7aa]',
        iconColor: 'text-[#ea580c]',
        labelColor: 'text-[#c2410c]',
        numberColor: 'text-[#7c2d12]',
        shadow: 'shadow-[0_2px_10px_rgba(234,88,12,0.05)] hover:shadow-[0_8px_20px_rgba(234,88,12,0.12)]',
    },
    violet: {
        border: 'border-[#ddd6fe]/70 hover:border-[#a78bfa]',
        topLine: 'bg-[#8b5cf6]',
        iconBg: 'bg-[#f5f3ff]',
        iconBorder: 'border-[#ddd6fe]',
        iconColor: 'text-[#7c3aed]',
        labelColor: 'text-[#6d28d9]',
        numberColor: 'text-[#4c1d95]',
        shadow: 'shadow-[0_2px_10px_rgba(124,58,237,0.05)] hover:shadow-[0_8px_20px_rgba(124,58,237,0.12)]',
    },
};

export default function AnalyticsMetricCard({
    title,
    value,
    icon: Icon,
    color = 'blue',
    className = '',
}) {
    const config = COLOR_CONFIG[color] || COLOR_CONFIG.blue;

    return (
        <div
            className={`relative bg-white border ${config.border} rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4 ${config.shadow} transition-all duration-200 ease-out overflow-hidden group h-full min-h-[105px] select-none ${className}`}
        >
            {/* Subtle left accent bar */}
            <div
                className={`absolute top-0 left-0 bottom-0 w-[3px] ${config.topLine} opacity-80`}
                aria-hidden="true"
            />

            {/* Compact Icon Container (40–44px) */}
            <div
                className={`shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${config.iconBg} border ${config.iconBorder} ${config.iconColor} flex items-center justify-center group-hover:scale-105 transition-transform duration-200 ml-0.5`}
            >
                {Icon && <Icon size={20} strokeWidth={2.2} />}
            </div>

            {/* Content: Label & Prominent Value */}
            <div className="flex flex-col gap-1 min-w-0 flex-1">
                <p
                    className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${config.labelColor} truncate leading-tight`}
                >
                    {title}
                </p>
                <p
                    className={`text-2xl sm:text-[1.75rem] font-black italic tracking-tight leading-none ${config.numberColor} truncate`}
                >
                    {value}
                </p>
            </div>
        </div>
    );
}
