import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, UserCheck, GraduationCap, User } from 'lucide-react';

/**
 * Global Status Badge
 * Responsive badge indicating system/session status (e.g. LIVE)
 */
export const StatusBadge = ({ label = 'Live', color = 'emerald', compact = false }) => {
    const colorClasses = {
        emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold',
        amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold',
        red: 'bg-red-500/10 border-red-500/30 text-red-400 font-bold',
    };

    const dotClasses = {
        emerald: 'bg-emerald-500',
        amber: 'bg-amber-500',
        red: 'bg-red-500',
    };

    return (
        <div 
            className={`inline-flex items-center gap-1.5 rounded-full border transition-all duration-180 ease-out select-none shrink-0 ${
                compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px] sm:px-3 sm:py-1 sm:text-xs'
            } ${colorClasses[color] || colorClasses.emerald}`}
            title={`System status: ${label}`}
            aria-label={`Status: ${label}`}
        >
            <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-pulse shrink-0 ${dotClasses[color] || dotClasses.emerald}`} />
            <span className="font-black uppercase tracking-wider">{label}</span>
        </div>
    );
};

export const UserProfileCard = ({ user, role, compact = false }) => {
    const location = useLocation();
    const isProfilePage = location.pathname === '/profile';
    
    const getRoleIcon = () => {
        switch (role?.toLowerCase()) {
            case 'admin': return <ShieldCheck size={16} strokeWidth={2.5} />;
            case 'teacher': return <UserCheck size={16} strokeWidth={2.5} />;
            case 'student': return <GraduationCap size={16} strokeWidth={2.5} />;
            default: return <User size={16} strokeWidth={2.5} />;
        }
    };

    const userName = user?.name || user?.username || 'Guest';

    return (
        <Link
            to="/profile"
            className={`inline-flex items-center gap-2.5 rounded-xl border transition-all duration-180 ease-out cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-accent)] focus-visible:ring-offset-2 ${
                compact ? 'p-1.5' : 'px-3 py-1.5 sm:px-4 sm:py-2'
            } ${
                isProfilePage 
                    ? 'bg-[var(--bg-accent)]/15 border-[var(--bg-accent)] text-[var(--text-accent)]' 
                    : 'bg-white/[0.04] border-white/10 text-[var(--text-primary)] hover:bg-white/[0.08] hover:border-white/25 hover:-translate-y-[1px]'
            }`}
            aria-label={`Profile for ${userName}`}
            title={isProfilePage ? "Current Location: Profile" : `View Profile (${userName})`}
        >
            <div className="relative shrink-0 flex items-center justify-center">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[var(--bg-accent)] flex items-center justify-center text-[var(--text-on-accent)] font-black">
                    {getRoleIcon()}
                </div>
                <div 
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-[var(--bg-primary)] shrink-0" 
                    title="Online"
                />
            </div>

            {!compact && (
                <div className="text-left hidden md:block min-w-0">
                    <p className="text-xs font-bold text-[var(--text-primary)] leading-tight truncate max-w-[110px] xl:max-w-[160px]">
                        {userName}
                    </p>
                    <p className="text-[9px] text-[var(--text-accent)] font-black uppercase tracking-widest opacity-90 leading-tight">
                        {role === 'admin' ? 'Admin' : role || 'User'}
                    </p>
                </div>
            )}
        </Link>
    );
};

