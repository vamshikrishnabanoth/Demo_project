import React, { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AuthContext from '../context/AuthContext';
import {
    LayoutDashboard,
    LogOut,
    User,
    BookOpen,
    History,
    Menu,
    X,
    MessageSquare,
    Pin
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import socket from '../utils/socket';
import { showSuccess, showConfirm } from '../utils/alerts';
import CinematicBackground from './CinematicBackground';
import { StatusBadge, UserProfileCard } from './UserIdentity';
import { useMediaQuery } from '../hooks/useMediaQuery';
import GlobalSearch from './GlobalSearch';

export default function DashboardLayout({ children, role }) {
    const { logout, user } = useContext(AuthContext);
    const location  = useLocation();
    const navigate  = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);
    // Breakpoint shifted to 1024px (lg) to provide spacious vertical nav for tablets
    const isSmallScreen = useMediaQuery('(max-width: 1023px)');
    
    // Student Broadcast State
    const [messagesOpen, setMessagesOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [broadcasts, setBroadcasts] = useState([]);
    const [inboxTab, setInboxTab] = useState('unread');

    const fetchBroadcasts = async () => {
        if (role !== 'student' || !user?.id) return;
        try {
            const res = await api.get('/broadcast/student');
            setBroadcasts(res.data);
            const unread = res.data.filter(b => !b.isRead).length;
            setUnreadCount(unread);
        } catch (err) {
            console.error('Error loading announcements:', err);
        }
    };

    React.useEffect(() => {
        if (role !== 'student' || !user?.id) return;
        
        fetchBroadcasts();
        socket.emit('identify', user.id);

        const handleNewBroadcast = (broadcast) => {
            toast.success(`📢 New Announcement: ${broadcast.title}`, {
                style: {
                    background: '#161618',
                    color: '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: '1rem',
                    fontFamily: 'Inter',
                    fontWeight: 'bold'
                },
                icon: '📢'
            });
            fetchBroadcasts();
        };

        socket.on('new_broadcast', handleNewBroadcast);
        return () => {
            socket.off('new_broadcast', handleNewBroadcast);
        };
    }, [role, user]);

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
        { name: 'History',     path: '/history',           icon: History },
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
                className="glass-panel sticky top-0 z-[100] border-b-0 shadow-none"
                style={{ backdropFilter: 'blur(var(--blur-strength))' }}
                role="banner"
            >
                <div className="layout-container">
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
                                    <img 
                                        src="/logo.png" 
                                        alt="KMIT Logo" 
                                        className="h-10 w-auto object-contain"
                                        loading="eager"
                                        decoding="async"
                                    />
                                </motion.div>
                                <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tighter italic">
                                    KMIT <span className="text-[var(--text-accent)] drop-shadow-[0_0_10px_var(--bg-accent-glow)]">KAHOOT</span>
                                </h1>
                            </Link>

                            {/* Desktop navigation links — only on large screens */}
                            {!isSmallScreen && (
                                <nav className="flex space-x-2" aria-label="Main navigation">
                                    {links.map((link) => {
                                        const Icon  = link.icon;
                                        const active = isActive(link.path);
                                        return (
                                            <Link
                                                key={link.path}
                                                to={link.path}
                                                aria-current={active ? 'page' : undefined}
                                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest premium-transition border ${
                                                    active
                                                        ? 'bg-[var(--bg-accent)]/10 border-[var(--bg-accent)] text-white shadow-[0_0_20px_var(--bg-accent-glow)]'
                                                        : 'bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                                                }`}
                                            >
                                                <Icon size={16} aria-hidden="true" />
                                                {link.name}
                                            </Link>
                                        );
                                    })}
                                </nav>
                            )}
                        </div>

                        {/* Right actions */}
                        <div className="flex items-center gap-3">
                            {location.pathname !== '/teacher-dashboard' && <GlobalSearch />}
                            {/* Essentials Only on Mobile */}
                            {!isSmallScreen && <StatusBadge label="Live" />}
                            
                            {role === 'student' && (
                                <button
                                    onClick={() => setMessagesOpen(true)}
                                    className="p-3 bg-white/5 text-[var(--text-secondary)] hover:text-[var(--text-accent)] hover:bg-[var(--table-row-hover)] rounded-2xl premium-transition border border-transparent hover:border-[var(--border-color)] relative active:scale-95"
                                    aria-label="Messages"
                                    title="View Announcements"
                                >
                                    <MessageSquare size={20} />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-[var(--bg-accent)] text-[var(--text-on-accent)] font-black rounded-full flex items-center justify-center text-[10px] shadow-[0_0_15px_var(--bg-accent-glow)] border-2 border-[var(--bg-primary)] animate-pulse">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>
                            )}

                            {!isSmallScreen && (
                                <div className="flex items-center gap-3">
                                    <UserProfileCard user={user} role={role} />
                                    <button
                                        onClick={handleLogout}
                                        className="p-3 text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-400/10 rounded-2xl premium-transition border border-transparent hover:border-red-400/20"
                                        aria-label="Log out"
                                        title="Log out"
                                    >
                                        <LogOut size={20} aria-hidden="true" />
                                    </button>
                                </div>
                            )}

                            {/* Premium Side Drawer Toggle */}
                            {isSmallScreen && (
                                <button
                                    onClick={() => setMobileOpen(true)}
                                    className="p-3 bg-white/5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-2xl premium-transition border border-white/5 active:scale-95"
                                    aria-label="Open side menu"
                                >
                                    <Menu size={24} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* ── DEDICATED TOP SEARCH SECTION (ISOLATED) ──────────────────── */}
            {location.pathname === '/teacher-dashboard' && (
                <div 
                    className="w-full relative z-[90] bg-[var(--bg-primary)]/85 backdrop-blur-[18px]"
                    style={{
                        paddingTop: '24px',
                        paddingBottom: '24px',
                        marginBottom: '32px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
                    }}
                >
                    <div className="w-full max-w-[900px] mx-auto px-6">
                        <GlobalSearch variant="dashboard" />
                    </div>
                </div>
            )}

            {/* ── PREMIUM SIDE DRAWER (MOBILE/TABLET) ───────────────────────── */}
            <AnimatePresence>
                {(isSmallScreen && mobileOpen) && (
                    <>
                        {/* Backdrop Overlay */}
                        <motion.div
                            key="drawer-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setMobileOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[var(--z-overlay)] cursor-pointer"
                        />

                        {/* Sidebar Drawer */}
                        <motion.div
                            key="drawer-content"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-[280px] bg-[var(--bg-secondary)] border-l border-white/10 z-[var(--z-drawer)] shadow-2xl flex flex-col p-6 overflow-y-auto"
                            role="navigation"
                        >
                            <div className="flex items-center justify-between mb-8 flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white p-1 rounded-lg shadow-lg">
                                        <img src="/logo.png" alt="" className="h-6 w-auto" />
                                    </div>
                                    <span className="font-black text-sm uppercase italic tracking-tighter text-[var(--text-accent)]">Menu</span>
                                </div>
                                <button 
                                    onClick={() => setMobileOpen(false)}
                                    className="p-2 text-white/30 hover:text-white transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Navigation List — Vertical Stack */}
                            <nav className="space-y-4 mb-8" aria-label="Mobile navigation">
                                {links.map((link) => {
                                    const Icon = link.icon;
                                    const active = isActive(link.path);
                                    return (
                                        <Link
                                            key={link.path}
                                            to={link.path}
                                            onClick={() => setMobileOpen(false)}
                                            className={`flex items-center gap-4 px-6 py-5 rounded-[1.5rem] text-sm font-black uppercase tracking-[0.15em] premium-transition border ${
                                                active
                                                    ? 'bg-[var(--bg-accent)]/10 border-[var(--bg-accent)] text-white shadow-[0_0_20px_var(--bg-accent-glow)]'
                                                    : 'bg-white/5 border-white/5 text-white/40 hover:text-white'
                                            }`}
                                        >
                                            <Icon size={20} />
                                            {link.name}
                                        </Link>
                                    );
                                })}


                            </nav>

                            {/* Drawer Footer — Profile & Logout Integrated */}
                            <div className="mt-auto pt-6 border-t border-white/5 space-y-4 flex-shrink-0">
                                <div className="px-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-3">Active Session</p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[var(--bg-accent)]/20 flex items-center justify-center text-[var(--text-accent)] border border-[var(--bg-accent)]/30">
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white truncate w-32">{user?.username || 'Pilot'}</p>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-accent)] opacity-50">{role}</p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl bg-red-500/10 text-red-500 text-sm font-black uppercase tracking-widest hover:bg-red-500/20 transition-all border border-red-500/20"
                                >
                                    <LogOut size={20} />
                                    Log Out
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── MESSAGES SIDE DRAWER (STUDENT INBOX) ───────────────────────── */}
            <AnimatePresence>
                {(role === 'student' && messagesOpen) && (
                    <>
                        {/* Backdrop Overlay */}
                        <motion.div
                            key="msg-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setMessagesOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[var(--z-overlay)] cursor-pointer"
                        />

                        {/* Sidebar Message Drawer */}
                        <motion.div
                            key="msg-content"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-full sm:w-[450px] bg-[#0b0f19] border-l border-white/10 z-[var(--z-drawer)] shadow-2xl flex flex-col p-6 overflow-hidden"
                            role="dialog"
                            aria-label="Student Announcement Inbox"
                        >
                            <div className="flex items-center justify-between pb-6 border-b border-white/10 flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-[var(--table-row-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-accent)]">
                                        <MessageSquare size={20} />
                                    </div>
                                    <div>
                                        <span className="font-black text-lg uppercase italic tracking-tighter text-white">Inbox</span>
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5">Secure Quiz Credentials</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setMessagesOpen(false)}
                                    className="p-2 text-slate-400 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Message Feed */}
                            <div className="flex-1 overflow-y-auto py-6 space-y-6 custom-scrollbar pr-1">
                                {/* Segmented Tab Controls for Read / Unread */}
                                <div className="grid grid-cols-2 p-1 bg-white/5 rounded-2xl border border-white/5 mb-6">
                                    <button
                                        onClick={() => setInboxTab('unread')}
                                        className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${inboxTab === 'unread' ? 'bg-[var(--bg-accent)] text-[var(--text-on-accent)] shadow-lg shadow-[var(--bg-accent-glow)]' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Unread
                                        {unreadCount > 0 && (
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${inboxTab === 'unread' ? 'bg-black/50 text-[var(--text-accent)]' : 'bg-[var(--table-row-hover)] text-[var(--text-accent)]'}`}>
                                                {unreadCount}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setInboxTab('read')}
                                        className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${inboxTab === 'read' ? 'bg-[var(--bg-accent)] text-[var(--text-on-accent)] shadow-lg shadow-[var(--bg-accent-glow)]' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Read
                                    </button>
                                </div>

                                {/* Already Read count header for Read Tab */}
                                {inboxTab === 'read' && (broadcasts.length - unreadCount > 0) && (
                                    <div className="px-5 py-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                                        <span className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            Archive Status
                                        </span>
                                        <span className="text-white/60">
                                            {broadcasts.length - unreadCount} Read Announcements
                                        </span>
                                    </div>
                                )}

                                {broadcasts.filter(b => {
                                    const isUnread = !b.isRead;
                                    return inboxTab === 'unread' ? isUnread : !isUnread;
                                }).length > 0 ? (
                                    broadcasts.filter(b => {
                                        const isUnread = !b.isRead;
                                        return inboxTab === 'unread' ? isUnread : !isUnread;
                                    }).map((b) => {
                                        const isUnread = !b.isRead;
                                        return (
                                            <div 
                                                key={b.id}
                                                onClick={async () => {
                                                    if (isUnread) {
                                                        // 1. Instantly decrement unreadCount badge counter!
                                                        setUnreadCount(prev => Math.max(0, prev - 1));
                                                        
                                                        // 2. Set isRead to true in local state
                                                        setBroadcasts(prev => prev.map(item => {
                                                            if (item.id === b.id) {
                                                                return {
                                                                    ...item,
                                                                    isRead: true
                                                                };
                                                            }
                                                            return item;
                                                        }));

                                                        try {
                                                            await api.post(`/broadcast/read/${b.id}`);
                                                            fetchBroadcasts(); // Sync up in background
                                                        } catch (err) {
                                                            console.error(err);
                                                            fetchBroadcasts(); // Rollback if error
                                                        }
                                                    }
                                                }}
                                                className={`p-5 rounded-[1.8rem] border premium-transition relative overflow-hidden ${isUnread ? 'cursor-pointer bg-gradient-to-r from-[var(--table-row-hover)] to-[var(--glass-bg)] border-[var(--border-color)] shadow-lg shadow-[var(--bg-accent-glow)]' : 'cursor-default bg-white/[0.01] border-white/5 opacity-80'}`}
                                            >
                                                {/* Unread circle */}
                                                {isUnread && (
                                                    <span className="absolute top-4 right-4 w-3.5 h-3.5 bg-[var(--bg-accent)] rounded-full border-2 border-[var(--bg-primary)]" />
                                                )}

                                                <div className="space-y-3">
                                                    <div>
                                                        <h4 className={`text-sm font-black italic uppercase tracking-wide truncate ${isUnread ? 'text-[var(--text-accent)]' : 'text-white'}`}>
                                                            {b.title}
                                                        </h4>
                                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                                                            Received: {new Date(b.createdAt).toLocaleDateString()}
                                                        </p>
                                                    </div>

                                                    <p className="text-xs text-slate-300 font-medium whitespace-pre-wrap leading-relaxed">
                                                        {b.message}
                                                    </p>

                                                    {/* Direct join arena sync link */}
                                                    {b.pin && b.pin !== 'EXPIRED' && (
                                                        <div className="pt-2">
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    try {
                                                                        await api.post('/quiz/join', { code: b.pin });
                                                                        toast.success('Connection established!', {
                                                                            style: {
                                                                                background: 'var(--bg-secondary)',
                                                                                color: 'var(--text-primary)',
                                                                                border: '1px solid var(--border-color)',
                                                                                borderRadius: '1rem',
                                                                                fontFamily: 'Inter'
                                                                            }
                                                                        });
                                                                        setMessagesOpen(false);
                                                                        navigate(`/live-room-student/${b.pin}`);
                                                                    } catch (err) {
                                                                        toast.error(err.response?.data?.msg || 'Neural link failed', {
                                                                            style: {
                                                                                background: 'rgba(239, 68, 68, 0.1)',
                                                                                color: '#ef4444',
                                                                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                                                                borderRadius: '1rem',
                                                                                fontFamily: 'Inter'
                                                                            }
                                                                        });
                                                                    }
                                                                }}
                                                                className="w-full py-2.5 bg-[var(--bg-accent)] text-[var(--text-on-accent)] rounded-xl font-black italic uppercase text-[10px] tracking-widest transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5 hover:opacity-90"
                                                            >
                                                                SYNC TO ARENA (PIN: {b.pin})
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-16 space-y-3">
                                        <MessageSquare size={36} className="text-slate-700 mx-auto" />
                                        <h4 className="font-black text-slate-500 uppercase tracking-wider italic text-sm">
                                            No {inboxTab} Messages
                                        </h4>
                                        <p className="text-xs text-slate-600 font-bold">
                                            {inboxTab === 'unread' 
                                                ? "You've read all received announcements!" 
                                                : "You haven't read any announcements yet."}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
            <main
                className="flex-1 w-full max-w-[100rem] mx-auto px-4 sm:px-8 lg:px-10 py-6 sm:py-10 relative z-[var(--z-base)]"
                id="main-content"
                tabIndex={-1}
            >
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    style={{ willChange: 'opacity, transform' }}
                >
                    <React.Suspense fallback={
                        <div className="flex items-center justify-center py-20">
                            <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="w-12 h-12 border-4 border-[var(--bg-accent)]/20 border-t-[var(--bg-accent)] rounded-full"
                            />
                        </div>
                    }>
                        {children}
                    </React.Suspense>
                </motion.div>
            </main>

            {/* ── FOOTER ────────────────────────────────────────────────────── */}
            <footer
                className="py-8 text-center text-xs font-bold uppercase tracking-widest opacity-40 relative z-10"
                style={{ color: 'var(--text-secondary)' }}
                role="contentinfo"
            >
                © {new Date().getFullYear()} KMIT Quiz Platform — All rights reserved
            </footer>
        </div>
    );
}
