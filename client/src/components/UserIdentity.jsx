import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, UserCheck, GraduationCap, User } from 'lucide-react';

/**
 * Global Status Badge (Format 1)
 * Used to indicate system/session status (e.g., LIVE)
 */
export const StatusBadge = ({ label = 'Live', color = 'emerald' }) => {
    const colorClasses = {
        emerald: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 font-bold',
        amber: 'bg-amber-500/15 border-amber-500/40 text-amber-700 font-bold',
        red: 'bg-red-500/15 border-red-500/40 text-red-700 font-bold',
    };

    const dotClasses = {
        emerald: 'bg-[#10b981] shadow-[0_0_10px_#10b981]',
        amber: 'bg-[#f59e0b] shadow-[0_0_10px_#f59e0b]',
        red: 'bg-[#ef4444] shadow-[0_0_10px_#ef4444]',
    };

    return (
        <div className={`hidden lg:flex items-center gap-2 px-3.5 py-1.5 border rounded-full ${colorClasses[color] || colorClasses.emerald}`}>
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse shrink-0 ${dotClasses[color] || dotClasses.emerald}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">{label}</span>
        </div>
    );
};

export const UserProfileCard = ({ user, role }) => {
    const location = useLocation();
    const isProfilePage = location.pathname === '/profile';
    
    const getRoleIcon = () => {
        switch (role?.toLowerCase()) {
            case 'admin': return <ShieldCheck size={18} strokeWidth={2.5} />;
            case 'teacher': return <UserCheck size={18} strokeWidth={2.5} className="pl-0.5" />;
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
                    className="w-9 h-9 rounded-full bg-[var(--bg-accent)] flex items-center justify-center text-[var(--text-on-accent)] font-black shadow-lg shadow-[var(--bg-accent)]/20 ring-2 ring-white/20 group-hover:scale-110 transition-transform duration-150 ease-out"
                    style={{ willChange: 'transform' }}
                >
                    {getRoleIcon()}
                </div>
                {/* Status Indicator (Format 1 Online Dot - High Contrast Green) */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#10b981] border-2 border-white shadow-md animate-pulse z-10" />
            </div>
            <div className="text-left">
                <p className="text-[11px] font-black text-[var(--text-primary)] leading-none group-hover:text-[var(--text-accent)] transition-colors duration-200">
                    {user?.username || 'Guest'}
                </p>
                <p className="text-[9px] text-[var(--text-accent)] font-black uppercase mt-1 tracking-[0.2em] opacity-80">
                    {role || 'System'}
                </p>
            </div>
        </Link>
    );
};
