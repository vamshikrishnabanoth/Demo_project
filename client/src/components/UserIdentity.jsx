import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, UserCheck, GraduationCap, User } from 'lucide-react';

/**
 * Global Status Badge (Format 1)
 * Used to indicate system/session status (e.g., LIVE)
 */
export const StatusBadge = ({ label = 'Live', color = 'emerald' }) => {
    const colorClasses = {
        emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
        amber: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
        red: 'bg-red-500/10 border-red-500/20 text-red-500',
    };

    const dotClasses = {
        emerald: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
        amber: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
        red: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    };

    return (
        <div className={`hidden lg:flex items-center gap-2 px-3 py-1.5 border rounded-full ${colorClasses[color] || colorClasses.emerald}`}>
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${dotClasses[color] || dotClasses.emerald}`} />
            <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
        </div>
    );
};

export const UserProfileCard = ({ user, role }) => {
    const location = window.location.pathname;
    const isProfilePage = location === '/profile';
    
    const getRoleIcon = () => {
        switch (role?.toLowerCase()) {
            case 'admin': return <ShieldCheck size={18} strokeWidth={2.5} />;
            case 'teacher': return <UserCheck size={18} strokeWidth={2.5} />;
            case 'student': return <GraduationCap size={18} strokeWidth={2.5} />;
            default: return <User size={18} strokeWidth={2.5} />;
        }
    };

    return (
        <Link
            to="/profile"
            className={`hidden sm:flex items-center gap-3 px-5 py-2.5 rounded-2xl border transition-[background-color,border-color,box-shadow] duration-200 cursor-pointer group
                ${isProfilePage 
                    ? 'bg-[var(--bg-accent)]/10 border-[var(--bg-accent)] shadow-[0_0_20px_var(--bg-accent-glow)]' 
                    : 'bg-white/[0.05] border-white/10 hover:border-[var(--text-accent)] hover:bg-white/10'
                }`}
            style={{ transform: 'translate3d(0,0,0)', willChange: 'background-color, border-color' }}
            title={isProfilePage ? "Current Location: Profile" : "View Profile"}
        >
            <div className="relative">
                <div 
                    className="w-9 h-9 rounded-full bg-[var(--bg-accent)] flex items-center justify-center text-[var(--text-on-accent)] font-black shadow-lg shadow-[var(--bg-accent)]/20 ring-2 ring-white/10 group-hover:scale-110 transition-transform duration-150 ease-out"
                    style={{ willChange: 'transform' }}
                >
                    {getRoleIcon()}
                </div>
                {/* Status Indicator (Format 1 Online Dot) */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[var(--bg-secondary)] shadow-sm animate-pulse" />
            </div>
            <div className="text-left">
                <p className="text-[11px] font-black text-[var(--text-primary)] leading-none group-hover:text-[var(--text-accent)] transition-colors duration-200">
                    {user?.username || 'Guest'}
                </p>
                <p className="text-[9px] text-[var(--text-accent)] font-black uppercase mt-1 tracking-[0.2em] opacity-60">
                    {role || 'System'}
                </p>
            </div>
        </Link>
    );
};
