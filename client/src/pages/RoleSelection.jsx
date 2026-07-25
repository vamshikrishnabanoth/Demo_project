import React, { useContext } from 'react';
import AuthContext from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Presentation, ShieldCheck, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassCard } from '../components/ui/Primitives';
import CinematicBackground from '../components/CinematicBackground';

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
            bg: 'bg-indigo-400/10',
            glowColor: 'rgba(129, 140, 248, 0.15)',
        },
        { 
            id: 'student', 
            title: 'Challenger', 
            desc: 'Enter the arena and climb ranks', 
            icon: GraduationCap, 
            color: 'text-[var(--text-accent)]',
            bg: 'bg-[var(--bg-accent)]/10',
            featured: true,
            glowColor: 'rgba(19, 62, 135, 0.2)',
        },
        { 
            id: 'admin', 
            title: 'Systems', 
            desc: 'Platform governance and control', 
            icon: ShieldCheck, 
            color: 'text-slate-400',
            bg: 'bg-white/10',
            glowColor: 'rgba(100, 116, 139, 0.12)',
        }
    ];

    // Staggered card entrance with scale bounce
    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15,
                delayChildren: 0.2,
            },
        },
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 30, scale: 0.92 },
        show: { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: {
                type: 'spring',
                stiffness: 200,
                damping: 20,
            },
        },
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] p-6 relative overflow-hidden">
            <CinematicBackground />

            {/* Ambient Background */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[var(--bg-accent)]/5 rounded-full blur-[150px] -mr-96 -mt-96" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[150px] -ml-80 -mb-80" />

                <div className="relative z-10 w-full max-w-6xl space-y-16">
                    {/* Header Hierarchy */}
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="text-center space-y-4"
                    >
                        <motion.div 
                            whileHover={{ scale: 1.1, rotate: [0, -3, 3, 0] }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-2xl mx-auto mb-6 p-2"
                        >
                            <img 
                                src="/logo.png" 
                                alt="KMIT Logo" 
                                className="w-full h-full object-contain" 
                                loading="eager"
                                decoding="async"
                            />
                        </motion.div>
                        <h1 className="text-3xl sm:text-5xl font-black text-white italic uppercase tracking-tighter">
                            SELECT <span className="text-[var(--text-accent)]">CLEARANCE</span>
                        </h1>
                        <p className="text-[var(--text-secondary)] font-black uppercase tracking-[0.4em] text-[10px] opacity-40 italic">Mission profile selection required</p>
                    </motion.div>

                    {/* Role Matrix — with staggered entrance */}
                    <motion.div 
                        className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center"
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                    >
                        {roles.map((role) => (
                            <motion.button
                                key={role.id}
                                variants={cardVariants}
                                whileHover={{ 
                                    y: -8, 
                                    scale: role.featured ? 1.08 : 1.04,
                                    transition: { type: 'spring', stiffness: 300, damping: 22 },
                                }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => handleRoleSelect(role.id)}
                                className={`group text-left h-full ${role.featured ? 'scale-105' : 'scale-100'}`}
                            >
                                <div className={`role-card-shimmer glass-panel p-10 rounded-[3rem] border border-[var(--border-color)] relative overflow-hidden group premium-transition h-full ${role.featured ? 'ring-2 ring-[var(--bg-accent)]/20' : ''}`}
                                    style={{
                                        transition: 'box-shadow 0.4s ease, border-color 0.3s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.boxShadow = `0 20px 60px -15px ${role.glowColor}, 0 0 40px -10px ${role.glowColor}`;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.boxShadow = '';
                                    }}
                                >
                                    {/* Ambient corner glow */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--bg-accent)]/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-[var(--bg-accent)]/10 transition-colors" />
                                    
                                    <div className="relative z-10">
                                        <motion.div 
                                            className={`w-16 h-16 ${role.bg} ${role.color} rounded-2xl flex items-center justify-center mb-10 transition-transform duration-500`}
                                            whileHover={{ scale: 1.15, rotate: 5 }}
                                        >
                                            <role.icon size={36} />
                                        </motion.div>
                                        <h2 className="text-xl font-black text-white italic uppercase tracking-tight mb-2">{role.title}</h2>
                                        <p className="text-[var(--text-secondary)] text-sm font-medium leading-relaxed mb-10 opacity-60 group-hover:opacity-100 transition-opacity">{role.desc}</p>
                                        
                                        <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${role.featured ? 'text-[var(--text-accent)]' : 'text-white/20'} group-hover:translate-x-2 transition-transform`}>
                                            INITIATE PORTAL <ChevronRight size={14} />
                                        </div>
                                    </div>
                                </div>
                            </motion.button>
                        ))}
                    </motion.div>

                    {/* Footer Policy */}
                    <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="text-center text-[9px] font-black uppercase tracking-[0.6em] text-white/10 italic"
                    >
                        Permanent identity association enforced
                    </motion.p>
                </div>
        </div>
    );
}
