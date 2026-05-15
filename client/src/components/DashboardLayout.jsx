import React, { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import AuthContext from '../context/AuthContext';
import {
    LayoutDashboard,
    LogOut,
    User,
    BarChart3,
    BookOpen,
    UserCheck,
    GraduationCap,
    ShieldCheck
} from 'lucide-react';
import { showSuccess, showConfirm } from '../utils/alerts';
import CinematicBackground from './CinematicBackground';

export default function DashboardLayout({ children, role }) {
    const { logout, user } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = async () => {
        const result = await showConfirm('End Session?', 'Are you sure you want to log out of the arena?');
        if (result.isConfirmed) {
            logout();
            showSuccess('Logged Out', 'See you soon, Champion!');
            navigate('/login');
        }
    };

    const isActive = (path) => location.pathname === path;

    const teacherLinks = [
        { name: 'Home', path: '/teacher-dashboard', icon: LayoutDashboard },
        { name: 'My Quizzes', path: '/my-quizzes', icon: BookOpen },
        { name: 'Performance', path: '/performance', icon: BarChart3 },
    ];

    const studentLinks = [
        { name: 'Home', path: '/student-dashboard', icon: LayoutDashboard },
        { name: 'Assessments', path: '/assessments', icon: BookOpen },
    ];

    const adminLinks = [
        { name: 'Dashboard', path: '/admin-dashboard', icon: LayoutDashboard },
        { name: 'Users', path: '/admin/users', icon: User },
    ];

    let links = [];
    if (role === 'teacher') links = teacherLinks;
    else if (role === 'student') links = studentLinks;
    else if (role === 'admin') links = adminLinks;

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col transition-colors duration-500 relative overflow-x-hidden">
            {/* Cinematic Background System */}
            <CinematicBackground />

            {/* Top Navbar */}
            <header className="glass-panel sticky top-0 z-50 border-b-0 shadow-none !backdrop-blur-[24px]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20">
                        {/* Logo & Branding */}
                        <div className="flex items-center gap-8">
                            <Link to={role === 'teacher' ? '/teacher-dashboard' : role === 'admin' ? '/admin-dashboard' : '/student-dashboard'} className="flex-shrink-0 flex items-center gap-3 group">
                                <motion.div 
                                    whileHover={{ scale: 1.05, rotate: 5 }}
                                    className="bg-white p-1 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] overflow-hidden"
                                >
                                    <img src="/logo.png" alt="KMIT Logo" className="h-10 w-auto object-contain" />
                                </motion.div>
                                <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tighter italic">
                                    KMIT <span className="text-[var(--text-accent)] drop-shadow-[0_0_10px_var(--bg-accent-glow)]">KAHOOT</span>
                                </h1>
                            </Link>

                            {/* Navigation Links */}
                            <nav className="hidden md:flex space-x-2">
                                {links.map((link) => {
                                    const Icon = link.icon;
                                    const active = isActive(link.path);
                                    return (
                                        <Link
                                            key={link.path}
                                            to={link.path}
                                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-500 btn-cinematic ${active
                                                ? 'bg-[var(--bg-accent)] text-[var(--text-on-accent)] shadow-xl shadow-[var(--bg-accent)]/20'
                                                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                                                }`}
                                        >
                                            <Icon size={18} className={active ? 'animate-pulse' : ''} />
                                            {link.name}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* User Actions */}
                        <div className="flex items-center gap-4">
                            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Live</span>
                            </div>

                            <Link
                                to="/profile"
                                className="hidden sm:flex items-center gap-3 px-5 py-2.5 bg-white/[0.03] rounded-2xl border border-white/5 hover:border-[var(--text-accent)]/50 hover:bg-white/5 transition-all duration-500 cursor-pointer group btn-cinematic"
                                title="View Profile"
                            >
                                <div className="relative">
                                    <div className="w-9 h-9 rounded-full bg-[var(--bg-accent)] flex items-center justify-center text-[var(--text-on-accent)] font-black shadow-lg shadow-[var(--bg-accent)]/20 ring-2 ring-white/10 group-hover:scale-110 transition-transform">
                                        {role === 'teacher' ? <UserCheck size={18} /> : role === 'student' ? <GraduationCap size={18} /> : role === 'admin' ? <ShieldCheck size={18} /> : <User size={18} />}
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[var(--bg-secondary)] shadow-sm animate-pulse" />
                                </div>
                                <div className="text-left">
                                    <p className="text-[11px] font-black text-[var(--text-primary)] leading-none group-hover:text-[var(--text-accent)] transition-colors">{user?.username}</p>
                                    <p className="text-[9px] text-[var(--text-accent)] font-black uppercase mt-1 tracking-[0.2em] opacity-60">{role}</p>
                                </div>
                            </Link>

                            <button
                                onClick={handleLogout}
                                className="p-3 text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-400/10 rounded-2xl transition-all duration-500 border border-transparent hover:border-red-400/20 btn-cinematic"
                                title="Logout"
                            >
                                <LogOut size={22} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                    {children}
                </motion.div>
            </main>

            {/* Bottom Branding */}
            <footer className="py-8 text-center text-[var(--text-secondary)] text-[10px] font-black uppercase tracking-[0.5em] opacity-30 relative z-10">
                &copy; {new Date().getFullYear()} KMIT Educational Arena • Zero-Trust Assessment Infrastructure
            </footer>
        </div>
    );
}
