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
    Pin,
    GraduationCap,
    UserCheck,
    Shield
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import socket from '../utils/socket';
import { showSuccess, showConfirm } from '../utils/alerts';
import CinematicBackground from './CinematicBackground';
import { StatusBadge, UserProfileCard } from './UserIdentity';
import { useMediaQuery } from '../hooks/useMediaQuery';
import GlobalSearch from './GlobalSearch';
import { uiTerminology } from '../utils/uiTerminology';

import { prefetchRoute } from '../utils/routePrefetch';

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
        if (!user?.id) return;
        
        // Fetch student-specific broadcasts
        if (role === 'student') {
            fetchBroadcasts();
        }
        
        // Identify the user's socket connection to set isOnline in the database
        socket.emit('identify', user.id);

        const handleNewBroadcast = (broadcast) => {
            if (role !== 'student') return;
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

    // Prevent body scrolling and touch drag while mobile drawer is open
    React.useEffect(() => {
        if (mobileOpen || messagesOpen) {
            document.body.classList.add('sidebar-open');
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
            document.body.style.height = '100dvh';
        } else {
            document.body.classList.remove('sidebar-open');
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            document.body.style.height = '';
        }
        return () => {
            document.body.classList.remove('sidebar-open');
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            document.body.style.height = '';
        };
    }, [mobileOpen, messagesOpen]);

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
        { name: 'Profile',    path: '/profile',           icon: User },
    ];
    const studentLinks = [
        { name: 'Home',        path: '/student-dashboard', icon: LayoutDashboard },
        { name: 'Assessments', path: '/assessments',       icon: BookOpen },
        { name: 'History',     path: '/history',           icon: History },
        { name: 'Profile',     path: '/profile',           icon: User },
    ];
    const adminLinks = [
        { name: 'Dashboard', path: '/admin-dashboard', icon: LayoutDashboard },
        { name: 'Students',  path: '/admin/students',  icon: GraduationCap },
        { name: 'Teachers',  path: '/admin/teachers',  icon: UserCheck },
        { name: 'Admins',    path: '/admin/admins',    icon: Shield },
        { name: 'All Users', path: '/admin/users',     icon: User },
        { name: 'Profile',   path: '/profile',         icon: User },
    ];

    const links =
        role === 'teacher' ? teacherLinks :
        role === 'student' ? studentLinks :
        role === 'admin'   ? adminLinks   : [];

    const homeUrl =
        role === 'teacher' ? '/teacher-dashboard' :
        role === 'admin'   ? '/admin-dashboard'   : '/student-dashboard';

    return (
        <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col transition-colors duration-500 relative">
            <CinematicBackground />

            {/* ── TOP NAVBAR ──────────────────────────────────────────────── */}
            <header
                className="glass-panel dashboard-header border-b-0 shadow-none sticky top-0 z-[100] w-full max-w-full overflow-x-hidden"
                style={{ backdropFilter: 'blur(var(--blur-strength, 16px))' }}
                role="banner"
            >
                <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">

                        {/* Logo + Desktop Nav */}
                        <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 min-w-0">
                            <Link
                                to={homeUrl}
                                className="flex-shrink-0 flex items-center gap-2 group rounded-xl p-1 transition-all duration-180 ease-out hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-accent)]"
                                aria-label="Go to home dashboard"
                            >
                                <div className="bg-white p-1 rounded-xl shadow-sm overflow-hidden shrink-0 border border-white/20">
                                    <img 
                                        src="/logo.png" 
                                        alt="KMIT Logo" 
                                        className="h-7 sm:h-9 w-auto object-contain"
                                        loading="eager"
                                        decoding="async"
                                    />
                                </div>
                                <h1 className="text-sm sm:text-lg lg:text-xl font-black text-[var(--text-primary)] tracking-tighter italic shrink-0 leading-none">
                                    <span className="hidden xs:inline">KMIT </span>
                                    <span className="text-[var(--text-accent)]">KAHOOT</span>
                                </h1>
                            </Link>

                            {/* Desktop navigation links (>= 1024px) */}
                            {!isSmallScreen && (
                                <nav className="hidden lg:flex items-center gap-1.5" aria-label="Main navigation">
                                    {links.filter(link => link.path !== '/profile').map((link) => {
                                        const Icon  = link.icon;
                                        const active = isActive(link.path);
                                        return (
                                            <Link
                                                key={link.path}
                                                to={link.path}
                                                onMouseEnter={() => prefetchRoute(link.path)}
                                                aria-current={active ? 'page' : undefined}
                                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-180 ease-out border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-accent)] ${
                                                    active
                                                        ? 'bg-[var(--bg-accent)]/15 border-[var(--bg-accent)]/60 text-[var(--text-accent)] font-extrabold'
                                                        : 'bg-transparent border-transparent text-white/70 hover:bg-white/10 hover:border-white/20 hover:text-white hover:-translate-y-[1px]'
                                                }`}
                                            >
                                                <Icon size={16} aria-hidden="true" className={active ? 'text-[var(--text-accent)]' : 'text-white/60'} />
                                                <span>{link.name}</span>
                                            </Link>
                                        );
                                    })}
                                </nav>
                            )}
                        </div>

                        {/* Right actions — Prioritized for all screen sizes */}
                        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                            {/* Live Status Indicator */}
                            <StatusBadge label="Live" color="emerald" compact={isSmallScreen} />

                            {/* User Profile Action */}
                            <UserProfileCard user={user} role={role} compact={isSmallScreen} />

                            {/* Logout Action — Always Accessible */}
                            <button
                                onClick={handleLogout}
                                className="navbar-btn navbar-btn-logout focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                                aria-label="Log out"
                                title="Log out"
                            >
                                <LogOut size={16} aria-hidden="true" />
                                <span className="hidden md:inline">Logout</span>
                            </button>

                            {/* Mobile / Tablet Side Drawer Toggle */}
                            {isSmallScreen && (
                                <button
                                    onClick={() => setMobileOpen(!mobileOpen)}
                                    className="navbar-btn p-2 rounded-xl text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-accent)] shrink-0"
                                    aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
                                    aria-expanded={mobileOpen}
                                >
                                    {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
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
                    <div className="w-full max-w-[900px] mx-auto px-4 sm:px-6">
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
                            className="mobile-sidebar-drawer fixed top-0 right-0 w-[min(90vw,380px)] h-[100vh] h-[100dvh] max-h-[100vh] max-h-[100dvh] bg-[var(--bg-secondary)] border-l border-[var(--border-color)] z-[var(--z-drawer)] shadow-2xl flex flex-col p-5 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] select-none overflow-hidden"
                            role="navigation"
                        >
                            {/* Drawer Content Wrapper - Entire content scrollable if height is small */}
                            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain pr-1">
                                {/* Header */}
                                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)] mb-4 flex-shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white p-1 rounded-lg shadow-lg">
                                            <img src="/logo.png" alt="" className="h-6 w-auto" />
                                        </div>
                                        <span className="font-black text-sm uppercase italic tracking-tighter text-[var(--text-accent)]">Navigation</span>
                                    </div>
                                    <button 
                                        onClick={() => setMobileOpen(false)}
                                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-xl hover:bg-black/5"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>

                                {/* Navigation List */}
                                <div className="flex-1 py-1">
                                    <nav className="space-y-3" aria-label="Mobile navigation">
                                        {links.map((link) => {
                                            const Icon = link.icon;
                                            const active = isActive(link.path);
                                            return (
                                                <Link
                                                    key={link.path}
                                                    to={link.path}
                                                    onClick={() => setMobileOpen(false)}
                                                    className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-180 ease-out border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-accent)] ${
                                                        active
                                                            ? 'bg-[var(--bg-accent)]/15 border-[var(--bg-accent)]/60 text-[var(--text-accent)] font-extrabold'
                                                            : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] hover:-translate-y-[1px]'
                                                    }`}
                                                >
                                                    <Icon size={18} />
                                                    {link.name}
                                                </Link>
                                            );
                                        })}
                                    </nav>
                                </div>

                                {/* Drawer Footer — Active Session & Logout Pinned inside scrollable content container */}
                                <div className="pt-4 mt-auto border-t border-[var(--border-color)] space-y-3 flex-shrink-0">
                                    <div className="px-1">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-1">Active Session</p>
                                        <Link 
                                            to="/profile" 
                                            onClick={() => setMobileOpen(false)}
                                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--bg-primary)] border border-transparent hover:border-[var(--border-color)] transition-all duration-180 ease-out hover:-translate-y-[1px] group cursor-pointer"
                                        >
                                            <div className="w-9 h-9 rounded-lg bg-[var(--bg-accent)]/15 flex items-center justify-center text-[var(--text-accent)] border border-[var(--bg-accent)]/30 shrink-0">
                                                <User size={18} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--text-accent)] transition-colors">{user?.username || 'Pilot'}</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-accent)] opacity-80">{role}</p>
                                            </div>
                                        </Link>
                                    </div>

                                    <button
                                        onClick={handleLogout}
                                        className="w-full py-3 px-4 navbar-btn navbar-btn-logout rounded-xl font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2.5 transition-all duration-180 ease-out cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                                        aria-label="Log out"
                                    >
                                        <LogOut size={18} />
                                        <span>Logout</span>
                                    </button>
                                </div>
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
                            className="fixed top-0 right-0 h-full w-full sm:w-[450px] bg-[var(--bg-secondary)] border-l border-[var(--border-color)] z-[var(--z-drawer)] shadow-2xl flex flex-col p-6 overflow-hidden"
                            role="dialog"
                            aria-label="Student Announcement Inbox"
                        >
                            <div className="flex items-center justify-between pb-6 border-b border-[var(--border-color)] flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl text-[var(--text-accent)]">
                                        <MessageSquare size={20} />
                                    </div>
                                    <div>
                                        <span className="font-black text-lg uppercase italic tracking-tighter text-[var(--text-primary)]">Inbox</span>
                                        <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest mt-0.5">Secure Quiz Credentials</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setMessagesOpen(false)}
                                    className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Message Feed */}
                            <div className="flex-1 overflow-y-auto py-6 space-y-6 custom-scrollbar pr-1">
                                {/* Segmented Tab Controls for Read / Unread */}
                                <div className="grid grid-cols-2 p-1 bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-color)] mb-6">
                                    <button
                                        onClick={() => setInboxTab('unread')}
                                        className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${inboxTab === 'unread' ? 'bg-[var(--bg-accent)] text-[var(--text-on-accent)] shadow-lg shadow-[var(--bg-accent-glow)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        Unread
                                        {unreadCount > 0 && (
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${inboxTab === 'unread' ? 'bg-black/30 text-white' : 'bg-[var(--border-color)] text-[var(--text-accent)]'}`}>
                                                {unreadCount}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setInboxTab('read')}
                                        className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${inboxTab === 'read' ? 'bg-[var(--bg-accent)] text-[var(--text-on-accent)] shadow-lg shadow-[var(--bg-accent-glow)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        Read
                                    </button>
                                </div>

                                {/* Already Read count header for Read Tab */}
                                {inboxTab === 'read' && (broadcasts.length - unreadCount > 0) && (
                                    <div className="px-5 py-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                                        <span className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Archive Status
                                        </span>
                                        <span className="text-[var(--text-primary)]">
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
                                                className={`p-5 rounded-[1.8rem] border premium-transition relative overflow-hidden ${isUnread ? 'cursor-pointer bg-[var(--bg-secondary)] border-[var(--bg-accent)]/40 shadow-md shadow-[var(--bg-accent-glow)]' : 'cursor-default bg-[var(--bg-primary)] border-[var(--border-color)] opacity-80'}`}
                                            >
                                                {/* Unread circle */}
                                                {isUnread && (
                                                    <span className="absolute top-4 right-4 w-3.5 h-3.5 bg-[var(--bg-accent)] rounded-full border-2 border-[var(--bg-primary)]" />
                                                )}

                                                <div className="space-y-3">
                                                    <div>
                                                        <h4 className={`text-sm font-black italic uppercase tracking-wide truncate ${isUnread ? 'text-[var(--text-accent)]' : 'text-[var(--text-primary)]'}`}>
                                                            {b.title}
                                                        </h4>
                                                        <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider mt-0.5">
                                                            Received: {new Date(b.createdAt).toLocaleDateString()}
                                                        </p>
                                                    </div>

                                                    <p className="text-xs text-[var(--text-secondary)] font-medium whitespace-pre-wrap leading-relaxed">
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
                                                                        toast.error(err.response?.data?.msg || 'Join Quiz failed', {
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
                                                                className="btn-join-quiz-anim w-full py-2.5 bg-[var(--bg-accent)] text-[var(--text-on-accent)] rounded-xl font-black italic uppercase text-[10px] tracking-widest transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5 hover:opacity-90"
                                                            >
                                                                {uiTerminology.deployToArena.toUpperCase()} (PIN: {b.pin})
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-16 space-y-3">
                                        <MessageSquare size={36} className="text-[var(--text-secondary)] mx-auto opacity-40" />
                                        <h4 className="font-black text-[var(--text-secondary)] uppercase tracking-wider italic text-sm">
                                            No {inboxTab} Messages
                                        </h4>
                                        <p className="text-xs text-[var(--text-secondary)]/70 font-bold">
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
