import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, UserCheck, GraduationCap, User } from 'lucide-react';

/**
 * Global Status Badge (Format 1)
 * Used to indicate system/session status (e.g., LIVE)
 */
export const StatusBadge = ({ label = 'Live', color = 'emerald' }) => {
    const colorClasses = {
        emerald: 'bg-emerald-50 border-emerald-200/80 text-emerald-700 font-bold',
        amber: 'bg-amber-50 border-amber-200/80 text-amber-700 font-bold',
        red: 'bg-red-50 border-red-200/80 text-red-700 font-bold',
    };

    const dotClasses = {
        emerald: 'bg-[#10b981] shadow-[0_0_8px_#10b981]',
        amber: 'bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]',
        red: 'bg-[#ef4444] shadow-[0_0_8px_#ef4444]',
    };

    return (
        <div className={`hidden lg:flex items-center gap-2 px-3 py-1 border rounded-full shadow-2xs ${colorClasses[color] || colorClasses.emerald}`}>
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse shrink-0 ${dotClasses[color] || dotClasses.emerald}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">{label}</span>
        </div>
    );
};

export const UserProfileCard = ({ user, role }) => {
    const getRoleIcon = () => {
        switch (role?.toLowerCase()) {
            case 'admin': return <ShieldCheck size={16} strokeWidth={2.5} />;
            case 'teacher': return <UserCheck size={16} strokeWidth={2.5} />;
            case 'student': return <GraduationCap size={16} strokeWidth={2.5} />;
            default: return <User size={16} strokeWidth={2.5} />;
        }
    };

    const displayName = user?.name || user?.username || 'STUDENT';
    const displayRole = role === 'admin' ? 'ADMIN' : (role || 'STUDENT');

    return (
        <Link
            to="/profile"
            className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border transition-all duration-200 cursor-pointer group shadow-2xs bg-white/90 border-slate-200/90 hover:bg-slate-100/90 hover:border-slate-300 text-slate-900"
            title="View Profile"
        >
            <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-black shadow-xs transition-transform duration-150 group-hover:scale-105 bg-slate-900 text-white">
                    {getRoleIcon()}
                </div>
                {/* High-Contrast Green Indicator Dot on Profile Avatar */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#10b981] border-2 border-white shadow-xs z-10 animate-pulse" />
            </div>
            <div className="text-left pr-1">
                <p className="text-[11px] font-black uppercase tracking-tight leading-none transition-colors duration-200 text-slate-900 group-hover:text-black">
                    {displayName}
                </p>
                <p className="text-[9px] font-black uppercase tracking-widest mt-0.5 text-slate-500">
                    {displayRole}
                </p>
            </div>
        </Link>
    );
};
