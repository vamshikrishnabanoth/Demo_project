import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import api from '../utils/api';
import {
    Lock, Eye, EyeOff, CheckCircle, AlertCircle,
    User, Mail, Shield, Activity, Calendar, Hash, ArrowLeft,
    UserCheck, GraduationCap, ShieldCheck
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function Profile() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
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

    const accountDetails = user?.role === 'student' ? [
        { icon: User, label: 'Name', value: user?.name || '—' },
        { icon: Hash, label: 'Roll Number', value: user?.username || '—' },
        { icon: GraduationCap, label: 'Section', value: user?.section || '—' },
        { icon: GraduationCap, label: 'Year', value: user?.year || '—' },
        { icon: GraduationCap, label: 'Department', value: user?.studentBranch || '—' },
    ] : [
        { icon: User, label: 'Full Name', value: user?.name || user?.username || '—' },
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
                    className="group flex items-center gap-3 px-6 py-3 bg-white border-2 border-[#0f172a] rounded-full font-black text-xs uppercase tracking-[0.2em] transition-all btn-press w-fit shadow-md hover:border-[var(--bg-accent)]"
                    style={{ color: '#0f172a' }}
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform text-[#0f172a]" style={{ color: '#0f172a' }} /> 
                    <span className="text-[#0f172a] font-black" style={{ color: '#0f172a' }}>BACK TO SYSTEM</span>
                </button>

                {/* Profile Header */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.5rem] p-10 flex items-center gap-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[var(--bg-accent)]/5 rounded-full blur-[100px] pointer-events-none" />

                    {/* Avatar */}
                    <div className="w-28 h-28 rounded-[2rem] bg-[var(--bg-accent)] flex items-center justify-center shadow-2xl shadow-[var(--bg-accent)]/30 shrink-0 relative z-10 overflow-hidden">
                        {role === 'teacher' ? (
                            <UserCheck size={52} className="text-white pl-1" strokeWidth={1.75} />
                        ) : role === 'student' ? (
                            <GraduationCap size={52} className="text-white" strokeWidth={1.75} />
                        ) : role === 'admin' ? (
                            <ShieldCheck size={52} className="text-white" strokeWidth={1.75} />
                        ) : (
                            <User size={52} className="text-white" strokeWidth={1.75} />
                        )}
                    </div>

                    {/* Info */}
                    <div className="relative z-10">
                        <h1 className="text-4xl font-black text-[var(--text-primary)] italic uppercase tracking-tighter">
                            {user?.name || user?.username || 'User'}
                        </h1>
                        <div className="flex items-center gap-4 mt-3 flex-wrap">
                            <span className="flex items-center gap-2 px-3 py-1 bg-[var(--bg-accent)]/20 border border-[var(--bg-accent)]/30 rounded-full text-[var(--text-accent)] text-xs font-black uppercase tracking-widest">
                                <Shield size={12} /> {role}
                            </span>
                            {user?.email && user.email !== user.username && (
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
                                        className="w-full pl-5 pr-12 py-4 bg-white border-2 border-[var(--border-color)] rounded-2xl focus:border-[var(--bg-accent)] transition-all text-[var(--text-primary)] font-bold placeholder:text-slate-400 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrent(v => !v)}
                                        className="eye-toggle absolute right-4 top-1/2 -translate-y-1/2 text-slate-900 hover:text-black transition-all p-1"
                                        title={showCurrent ? "Hide password" : "Show password"}
                                    >
                                        {showCurrent ? <EyeOff size={20} className="text-slate-900 stroke-[2.5]" /> : <Eye size={20} className="text-slate-900 stroke-[2.5]" />}
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
                                        className="w-full pl-5 pr-12 py-4 bg-white border-2 border-[var(--border-color)] rounded-2xl focus:border-[var(--bg-accent)] transition-all text-[var(--text-primary)] font-bold placeholder:text-slate-400 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNew(v => !v)}
                                        className="eye-toggle absolute right-4 top-1/2 -translate-y-1/2 text-slate-900 hover:text-black transition-all p-1"
                                        title={showNew ? "Hide password" : "Show password"}
                                    >
                                        {showNew ? <EyeOff size={20} className="text-slate-900 stroke-[2.5]" /> : <Eye size={20} className="text-slate-900 stroke-[2.5]" />}
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
                                        className={`w-full pl-5 pr-12 py-4 bg-white border-2 rounded-2xl transition-all text-[var(--text-primary)] font-bold placeholder:text-slate-400 outline-none
                                            ${confirmPassword && newPassword
                                                ? confirmPassword === newPassword
                                                    ? 'border-green-500 focus:border-green-600'
                                                    : 'border-red-500 focus:border-red-600'
                                                : 'border-[var(--border-color)] focus:border-[var(--bg-accent)]'}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(v => !v)}
                                        className="eye-toggle absolute right-4 top-1/2 -translate-y-1/2 text-slate-900 hover:text-black transition-all p-1"
                                        title={showConfirm ? "Hide password" : "Show password"}
                                    >
                                        {showConfirm ? <EyeOff size={20} className="text-slate-900 stroke-[2.5]" /> : <Eye size={20} className="text-slate-900 stroke-[2.5]" />}
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
                                className="w-full flex items-center justify-center gap-3 bg-[var(--bg-accent)] hover:bg-[var(--bg-accent-hover)] !text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[var(--bg-accent)]/20 mt-2"
                                style={{ color: '#ffffff' }}
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2" style={{ color: '#ffffff' }}>
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

                </div>
            </div>

        </DashboardLayout>
    );
}
