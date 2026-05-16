import React, { useContext } from 'react';
import AuthContext from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Presentation, ShieldCheck, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassCard } from '../components/ui/Primitives';

export default function RoleSelection() {
    const { setRole } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleRoleSelect = async (role) => {
        try {
            await setRole(role);
            const routes = { teacher: '/teacher-dashboard', student: '/student-dashboard', admin: '/admin-dashboard' };
            navigate(routes[role] || '/');
        } catch (err) {
            console.error(err);
        }
    };

    const roles = [
        { 
            id: 'teacher', 
            title: 'Educator', 
            desc: 'Forge quizzes and track engagement', 
            icon: Presentation, 
            color: 'text-indigo-400',
            bg: 'bg-indigo-400/10'
        },
        { 
            id: 'student', 
            title: 'Challenger', 
            desc: 'Enter the arena and climb ranks', 
            icon: GraduationCap, 
            color: 'text-[var(--text-accent)]',
            bg: 'bg-[var(--bg-accent)]/10',
            featured: true
        },
        { 
            id: 'admin', 
            title: 'Systems', 
            desc: 'Platform governance and control', 
            icon: ShieldCheck, 
            color: 'text-slate-400',
            bg: 'bg-white/10'
        }
    ];

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] p-6 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[var(--bg-accent)]/5 rounded-full blur-[150px] -mr-96 -mt-96" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[150px] -ml-80 -mb-80" />

                <div className="relative z-10 w-full max-w-6xl space-y-16">
                    {/* Header Hierarchy */}
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center space-y-4"
                    >
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-2xl mx-auto mb-6 p-2">
                            <img src="/logo.png" alt="KMIT Logo" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-black text-white italic uppercase tracking-tighter">
                            SELECT <span className="text-[var(--text-accent)]">CLEARANCE</span>
                        </h1>
                        <p className="text-[var(--text-secondary)] font-black uppercase tracking-[0.4em] text-[10px] opacity-40 italic">Mission profile selection required</p>
                    </motion.div>

                    {/* Role Matrix */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                        {roles.map((role, idx) => (
                            <motion.button
                                key={role.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                onClick={() => handleRoleSelect(role.id)}
                                className={`group text-left h-full ${role.featured ? 'scale-105' : 'scale-100'}`}
                            >
                                <GlassCard className={`h-full !p-10 hover:border-[var(--bg-accent)]/40 transition-all duration-300 ${role.featured ? 'ring-2 ring-[var(--bg-accent)]/20' : ''}`}>
                                    <div className={`w-16 h-16 ${role.bg} ${role.color} rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform duration-500`}>
                                        <role.icon size={36} />
                                    </div>
                                    <h2 className="text-xl font-black text-white italic uppercase tracking-tight mb-2">{role.title}</h2>
                                    <p className="text-[var(--text-secondary)] text-sm font-medium leading-relaxed mb-10 opacity-60 group-hover:opacity-100 transition-opacity">{role.desc}</p>
                                    
                                    <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${role.featured ? 'text-[var(--text-accent)]' : 'text-white/20'} group-hover:translate-x-2 transition-transform`}>
                                        INITIATE PORTAL <ChevronRight size={14} />
                                    </div>
                                </GlassCard>
                            </motion.button>
                        ))}
                    </div>

                    {/* Footer Policy */}
                    <p className="text-center text-[9px] font-black uppercase tracking-[0.6em] text-white/10 italic">
                        Permanent identity association enforced
                    </p>
                </div>
        </div>
    );
}
