import React, { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AuthContext from '../context/AuthContext';
import {
    LayoutDashboard,
    LogOut,
    User,
    BookOpen,
    Menu,
    X,
} from 'lucide-react';
import { showSuccess, showConfirm } from '../utils/alerts';
import CinematicBackground from './CinematicBackground';
import { StatusBadge, UserProfileCard } from './UserIdentity';

export default function DashboardLayout({ children, role }) {
    const { logout, user } = useContext(AuthContext);
    const location  = useLocation();
    const navigate  = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = async () => {
        setMobileOpen(false);
        const result = await showConfirm('Log Out?', 'Are you sure you want to log out?');
        if (result.isConfirmed) {
            logout();
            await showSuccess('Logged Out', 'See you soon!', 1400);
            navigate('/login');
        }
    };

    const isActive = (path) => location.pathname === path;

    const teacherLinks = [
        { name: 'Home',       path: '/teacher-dashboard', icon: LayoutDashboard },
        { name: 'My Quizzes', path: '/my-quizzes',        icon: BookOpen },
    ];
    const studentLinks = [
        { name: 'Home',        path: '/student-dashboard', icon: LayoutDashboard },
        { name: 'Assessments', path: '/assessments',       icon: BookOpen },
    ];
    const adminLinks = [
        { name: 'Dashboard', path: '/admin-dashboard', icon: LayoutDashboard },
        { name: 'Users',     path: '/admin/users',     icon: User },
    ];

    const links =
        role === 'teacher' ? teacherLinks :
        role === 'student' ? studentLinks :
        role === 'admin'   ? adminLinks   : [];

    const homeUrl =
        role === 'teacher' ? '/teacher-dashboard' :
        role === 'admin'   ? '/admin-dashboard'   : '/student-dashboard';

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col transition-colors duration-500 relative overflow-x-hidden">
            <CinematicBackground />

            {/* ── TOP NAVBAR ──────────────────────────────────────────────── */}
            <header
                className="glass-panel sticky top-0 z-50 border-b-0 shadow-none"
                style={{ backdropFilter: 'blur(var(--blur-strength))' }}
                role="banner"
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20">

                        {/* Logo + Desktop Nav */}
                        <div className="flex items-center gap-8">
                            <Link
                                to={homeUrl}
                                className="flex-shrink-0 flex items-center gap-3 group"
                                aria-label="Go to home dashboard"
                            >
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

                            {/* Desktop navigation links */}
                            <nav className="hidden md:flex space-x-2" aria-label="Main navigation">
                                {links.map((link) => {
                                    const Icon  = link.icon;
                                    const active = isActive(link.path);
                                    return (
                                        <Link
                                            key={link.path}
                                            to={link.path}
                                            aria-current={active ? 'page' : undefined}
                                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-300 ${
                                                active
                                                    ? 'bg-[var(--bg-accent)] text-[var(--text-on-accent)] shadow-xl shadow-[var(--bg-accent)]/20'
                                                    : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                                            }`}
                                        >
                                            <Icon size={16} aria-hidden="true" />
                                            {link.name}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* Right actions */}
                        <div className="flex items-center gap-3">
                            <StatusBadge label="Live" />
                            <div className="hidden sm:block">
                                <UserProfileCard user={user} role={role} />
                            </div>

                            {/* Logout — desktop */}
                            <button
                                onClick={handleLogout}
                                className="hidden md:flex p-3 text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-400/10 rounded-2xl transition-all duration-300 border border-transparent hover:border-red-400/20"
                                aria-label="Log out"
                                title="Log out"
                            >
                                <LogOut size={20} aria-hidden="true" />
                            </button>

                            {/* Hamburger — mobile only */}
                            <button
                                onClick={() => setMobileOpen(o => !o)}
                                className="md:hidden p-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-2xl transition-all duration-300"
                                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                                aria-expanded={mobileOpen}
                                aria-controls="mobile-nav"
                            >
                                {mobileOpen
                                    ? <X size={22} aria-hidden="true" />
                                    : <Menu size={22} aria-hidden="true" />
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── MOBILE SLIDE-DOWN MENU ───────────────────────────────────── */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        id="mobile-nav"
                        key="mobile-nav"
                        initial={{ opacity: 0, y: -10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="md:hidden sticky top-20 z-40 overflow-hidden"
                        style={{
                            background: 'var(--bg-secondary)',
                            borderBottom: '1px solid var(--border-color)',
                            backdropFilter: 'blur(20px)',
                        }}
                        role="navigation"
                        aria-label="Mobile navigation"
                    >
                        <div className="px-4 py-4 space-y-1">
                            {links.map((link) => {
                                const Icon  = link.icon;
                                const active = isActive(link.path);
                                return (
                                    <Link
                                        key={link.path}
                                        to={link.path}
                                        onClick={() => setMobileOpen(false)}
                                        aria-current={active ? 'page' : undefined}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all duration-200 ${
                                            active
                                                ? 'bg-[var(--bg-accent)] text-[var(--text-on-accent)]'
                                                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                                        }`}
                                    >
                                        <Icon size={18} aria-hidden="true" />
                                        {link.name}
                                    </Link>
                                );
                            })}

                            {/* Divider */}
                            <div className="h-px bg-white/5 my-2" role="separator" />

                            {/* Mobile user info */}
                            <div className="px-4 py-2">
                                <p className="text-xs font-black uppercase tracking-widest text-white/30">
                                    {user?.username || 'User'}
                                </p>
                                <p className="text-[11px] text-white/20 font-semibold capitalize">{role}</p>
                            </div>

                            {/* Logout */}
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black uppercase tracking-widest text-red-400 hover:bg-red-400/10 transition-all duration-200"
                                aria-label="Log out"
                            >
                                <LogOut size={18} aria-hidden="true" />
                                Log Out
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
            <main
                className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10"
                id="main-content"
                tabIndex={-1}
            >
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    style={{ willChange: 'opacity, transform' }}
                >
                    {children}
                </motion.div>
            </main>

            {/* ── FOOTER ────────────────────────────────────────────────────── */}
            <footer
                className="py-8 text-center text-xs font-bold uppercase tracking-widest opacity-20 relative z-10"
                style={{ color: 'var(--text-secondary)' }}
                role="contentinfo"
            >
                © {new Date().getFullYear()} KMIT Quiz Platform — All rights reserved
            </footer>
        </div>
    );
}
