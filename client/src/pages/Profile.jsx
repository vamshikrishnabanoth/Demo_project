import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import api from '../utils/api';
import {
    Lock, Eye, EyeOff, CheckCircle, AlertCircle,
    User, Mail, Shield, Activity, Calendar, Hash, ArrowLeft,
    UserCheck, GraduationCap, ShieldCheck, Palette, Type, Check
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function Profile() {
    const { user, theme, setTheme, font, setFont } = useContext(AuthContext);
    const navigate = useNavigate();

    const themes = [
        { id: 'celestial', name: 'Celestial Gold', color: '#D7AC28' },
        { id: 'imperial', name: 'Imperial Arena', color: '#B371E0' },
        { id: 'drakor', name: 'Drakor', color: '#C0192A' },
    ];

    const fonts = [
        { id: 'segoe', name: 'Segoe UI', css: 'font-sans' },
        { id: 'helvetica', name: 'Helvetica', css: 'font-sans' },
        { id: 'arial', name: 'Arial', css: 'font-sans' },
        { id: 'verdana', name: 'Verdana', css: 'font-sans' },
        { id: 'georgia', name: 'Georgia', css: 'font-serif' },
        { id: 'times', name: 'Times New Roman', css: 'font-serif' },
        { id: 'courier', name: 'Courier New', css: 'font-mono' },
    ];
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const role = user?.role || 'student';

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setSuccess('');
        setError('');

        if (newPassword !== confirmPassword) {
            return setError('New password and confirmation do not match.');
        }
        if (newPassword.length < 6) {
            return setError('New password must be at least 6 characters.');
        }

        setLoading(true);
        try {
            const res = await api.put('/auth/change-password', { currentPassword, newPassword });
            setSuccess(res.data.msg || 'Password updated successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to update password. Try again.');
        } finally {
            setLoading(false);
        }
    };

    const memberSince = user?.createdAt
        ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';

    const accountDetails = [
        { icon: User, label: 'Full Name', value: user?.username || '—' },
        { icon: Hash, label: 'Roll Number', value: user?.username || '—' },
        { icon: Mail, label: 'Email', value: user?.email || '—' },
        { icon: Shield, label: 'Role', value: (user?.role || '—').toUpperCase() },
        { icon: Activity, label: 'Account Status', value: 'ACTIVE' },
        { icon: Calendar, label: 'Member Since', value: memberSince },
    ];

    return (
        <DashboardLayout role={role}>
            <div className="max-w-5xl mx-auto pb-20 space-y-10">

                {/* Back */}
                <button
                    onClick={() => navigate(-1)}
                    className="group flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/5 rounded-full text-white/40 hover:text-[var(--text-accent)] hover:border-[var(--text-accent)]/30 hover:bg-white/[0.05] font-black text-[10px] uppercase tracking-[0.3em] transition-all btn-press w-fit"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
                    BACK TO SYSTEM
                </button>

                {/* Profile Header */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.5rem] p-10 flex items-center gap-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[var(--bg-accent)]/5 rounded-full blur-[100px] pointer-events-none" />

                    {/* Avatar */}
                    <div className="w-28 h-28 rounded-[1.5rem] bg-[var(--bg-accent)] flex items-center justify-center shadow-2xl shadow-[var(--bg-accent)]/30 shrink-0 relative z-10">
                        {role === 'teacher' ? (
                            <UserCheck size={52} className="text-white" strokeWidth={1.5} />
                        ) : role === 'student' ? (
                            <GraduationCap size={52} className="text-white" strokeWidth={1.5} />
                        ) : role === 'admin' ? (
                            <ShieldCheck size={52} className="text-white" strokeWidth={1.5} />
                        ) : (
                            <User size={52} className="text-white" strokeWidth={1.5} />
                        )}
                    </div>

                    {/* Info */}
                    <div className="relative z-10">
                        <h1 className="text-4xl font-black text-[var(--text-primary)] italic uppercase tracking-tighter">
                            {user?.username || 'User'}
                        </h1>
                        <div className="flex items-center gap-4 mt-3 flex-wrap">
                            <span className="flex items-center gap-2 px-3 py-1 bg-[var(--bg-accent)]/20 border border-[var(--bg-accent)]/30 rounded-full text-[var(--text-accent)] text-xs font-black uppercase tracking-widest">
                                <Shield size={12} /> {role}
                            </span>
                            {user?.email && (
                                <span className="flex items-center gap-2 text-[var(--text-secondary)] text-sm font-bold">
                                    <Mail size={14} /> {user.email}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Two-column layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* ── Security Settings ─────────────────────────── */}
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.5rem] p-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2.5 bg-red-500/10 rounded-xl">
                                <Lock size={20} className="text-red-400" />
                            </div>
                            <div>
                                <p className="font-black text-[var(--text-primary)] uppercase tracking-tight italic">Security</p>
                                <p className="text-[10px] text-[var(--text-accent)] font-black uppercase tracking-widest">Settings</p>
                            </div>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-5">
                            {/* Current Password */}
                            <div>
                                <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                                    Current Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showCurrent ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        className="w-full pl-5 pr-12 py-4 bg-white/[0.04] border-2 border-white/5 rounded-2xl focus:border-[var(--bg-accent)] focus:bg-white/[0.08] transition-all text-[var(--text-primary)] font-bold placeholder:text-white/30 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrent(v => !v)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400 transition-all"
                                    >
                                        {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* New Password */}
                            <div>
                                <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                                    New Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showNew ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="Min. 6 characters"
                                        required
                                        className="w-full pl-5 pr-12 py-4 bg-white/[0.04] border-2 border-white/5 rounded-2xl focus:border-[var(--bg-accent)] focus:bg-white/[0.08] transition-all text-[var(--text-primary)] font-bold placeholder:text-white/30 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNew(v => !v)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400 transition-all"
                                    >
                                        {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm New Password */}
                            <div>
                                <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Repeat new password"
                                        required
                                        className={`w-full pl-5 pr-12 py-4 bg-white/[0.04] border-2 rounded-2xl transition-all text-[var(--text-primary)] font-bold placeholder:text-white/30 outline-none
                                            ${confirmPassword && newPassword
                                                ? confirmPassword === newPassword
                                                    ? 'border-green-500/60 focus:border-green-500'
                                                    : 'border-red-500/60 focus:border-red-500'
                                                : 'border-white/5 focus:border-[var(--bg-accent)]'}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(v => !v)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400 transition-all"
                                    >
                                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {confirmPassword && newPassword && confirmPassword !== newPassword && (
                                    <p className="text-red-400 text-xs font-bold mt-1 flex items-center gap-1">
                                        <AlertCircle size={12} /> Passwords do not match
                                    </p>
                                )}
                            </div>

                            {/* Feedback */}
                            {error && (
                                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-3">
                                    <AlertCircle size={16} className="text-red-400 shrink-0" />
                                    <p className="text-red-400 text-sm font-bold">{error}</p>
                                </div>
                            )}
                            {success && (
                                <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-2xl px-5 py-3">
                                    <CheckCircle size={16} className="text-green-400 shrink-0" />
                                    <p className="text-green-400 text-sm font-bold">{success}</p>
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-3 bg-[var(--bg-accent)] hover:bg-[var(--bg-accent-hover)] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[var(--bg-accent)]/20 mt-2"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Updating...
                                    </span>
                                ) : (
                                    <><Lock size={16} /> Update Password</>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* ── Account Details ───────────────────────────── */}
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.5rem] p-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2.5 bg-blue-500/10 rounded-xl">
                                <User size={20} className="text-blue-400" />
                            </div>
                            <div>
                                <p className="font-black text-[var(--text-primary)] uppercase tracking-tight italic">Account</p>
                                <p className="text-[10px] text-[var(--text-accent)] font-black uppercase tracking-widest">Details</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {accountDetails.map(({ icon: Icon, label, value }) => (
                                <div key={label} className="flex items-center justify-between py-3 border-b border-[var(--border-color)] last:border-0 cursor-not-allowed group">
                                    <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                                        <Icon size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
                                    </div>
                                    <span className={`font-black text-sm text-right
                                        ${label === 'Account Status' ? 'text-green-400' : 'text-[var(--text-primary)]'}`}>
                                        {value}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* System ID */}
                        <div className="mt-10 pt-10 border-t border-[var(--border-color)] cursor-not-allowed">
                            <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2">System Identifier</p>
                            <p className="text-[var(--text-secondary)] opacity-40 font-mono text-xs break-all">{user?.id || '—'}</p>
                        </div>
                    </div>

                    {/* ── UI Preferences ───────────────────────────── */}
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.5rem] p-10 lg:col-span-2 shadow-xl">
                        <div className="mb-10">
                            <h3 className="text-2xl font-black text-[var(--text-primary)] italic uppercase tracking-tight">Interface <span className="text-[var(--text-accent)]">Customization</span></h3>
                            <p className="text-[var(--text-secondary)] text-sm mt-1">Personalize your experience with custom themes and typography</p>
                        </div>
                        <div className="flex flex-col lg:flex-row gap-16">

                            {/* Theme Selection */}
                            <div className="flex-1 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-amber-500/10 rounded-xl">
                                        <Palette size={20} className="text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="font-black text-[var(--text-primary)] uppercase tracking-tight italic">Theme</p>
                                        <p className="text-[10px] text-[var(--text-accent)] font-black uppercase tracking-widest">Selection</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {themes.map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => setTheme(t.id)}
                                            className={`group relative h-32 rounded-[2rem] border-2 transition-all overflow-hidden flex flex-col items-center justify-center p-6 btn-press
                                                ${theme === t.id 
                                                    ? 'border-[var(--text-accent)] bg-white/[0.05] shadow-2xl shadow-[var(--text-accent)]/20' 
                                                    : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10'}`}
                                        >
                                            {/* Accent Glow Backdrop */}
                                            <div 
                                                className={`absolute inset-0 opacity-10 transition-opacity group-hover:opacity-20 pointer-events-none ${theme === t.id ? 'opacity-30' : ''}`}
                                                style={{ background: `radial-gradient(circle at 50% 50%, ${t.color}, transparent 80%)` }}
                                            />
                                            
                                            {/* Stylized Icon Container */}
                                            <div 
                                                className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-xl group-hover:scale-110 transition-transform"
                                                style={{ backgroundColor: `${t.color}20`, border: `1px solid ${t.color}40` }}
                                            >
                                                <Palette size={28} style={{ color: t.color }} />
                                            </div>
                                            
                                            <span className="relative z-10 text-[10px] font-black uppercase tracking-[0.2em] text-white text-center">
                                                {t.name}
                                            </span>

                                            {theme === t.id && (
                                                <motion.div 
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="absolute top-4 right-4 bg-[var(--bg-accent)] text-white p-1.5 rounded-full shadow-lg"
                                                >
                                                    <Check size={12} />
                                                </motion.div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Font Selection */}
                            <div className="flex-1 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-500/10 rounded-xl">
                                        <Type size={20} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="font-black text-[var(--text-primary)] uppercase tracking-tight italic">Typography</p>
                                        <p className="text-[10px] text-[var(--text-accent)] font-black uppercase tracking-widest">Font Style</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {fonts.map((f) => (
                                        <button
                                            key={f.id}
                                            onClick={() => setFont(f.id)}
                                            className={`p-3 rounded-xl border-2 transition-all text-center relative
                                                ${font === f.id ? 'border-[var(--text-accent)] bg-[var(--text-accent)]/10 shadow-lg shadow-[var(--text-accent)]/10' : 'border-[var(--border-color)] hover:bg-[var(--glass-bg)] hover:border-[var(--text-secondary)]/30'}`}
                                        >
                                            <p className={`text-xs font-bold text-[var(--text-primary)] truncate`}>{f.name}</p>
                                            <p 
                                                className="text-[11px] text-[var(--text-secondary)] mt-2 italic"
                                                style={{ fontFamily: `var(--font-${f.id}, var(--app-font))` }}
                                            >
                                                Aa Bb Cc 123
                                            </p>
                                            {font === f.id && (
                                                <div className="absolute -top-2 -right-2 bg-[var(--bg-accent)] text-white p-0.5 rounded-full shadow-lg">
                                                    <Check size={8} />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </DashboardLayout>
    );
}
