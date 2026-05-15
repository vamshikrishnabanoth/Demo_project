import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import api from '../utils/api';
import {
    Lock, Eye, EyeOff, CheckCircle, AlertCircle,
    User, Mail, Shield, Activity, Calendar, Hash, ArrowLeft
} from 'lucide-react';

export default function Profile() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    // Password form state
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
                    className="flex items-center gap-2 text-slate-500 hover:text-white font-black text-xs uppercase tracking-widest transition-colors"
                >
                    <ArrowLeft size={16} /> Back
                </button>

                {/* Profile Header */}
                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 flex items-center gap-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#ff6b00]/5 rounded-full blur-[100px] pointer-events-none" />

                    {/* Avatar */}
                    <div className="w-28 h-28 rounded-[1.5rem] bg-[#ff6b00] flex items-center justify-center shadow-2xl shadow-[#ff6b00]/30 shrink-0 relative z-10">
                        <User size={52} className="text-white" strokeWidth={1.5} />
                    </div>

                    {/* Info */}
                    <div className="relative z-10">
                        <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">
                            {user?.username || 'User'}
                        </h1>
                        <div className="flex items-center gap-4 mt-3 flex-wrap">
                            <span className="flex items-center gap-2 px-3 py-1 bg-[#ff6b00]/20 border border-[#ff6b00]/30 rounded-full text-[#ff6b00] text-xs font-black uppercase tracking-widest">
                                <Shield size={12} /> {role}
                            </span>
                            {user?.email && (
                                <span className="flex items-center gap-2 text-slate-400 text-sm font-bold">
                                    <Mail size={14} /> {user.email}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Two-column layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* ── Security Settings ─────────────────────────── */}
                    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2.5 bg-red-500/10 rounded-xl">
                                <Lock size={20} className="text-red-400" />
                            </div>
                            <div>
                                <p className="font-black text-white uppercase tracking-tight italic">Security</p>
                                <p className="text-[10px] text-[#ff6b00] font-black uppercase tracking-widest">Settings</p>
                            </div>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-5">
                            {/* Current Password */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                    Current Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showCurrent ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        className="w-full pl-5 pr-12 py-4 bg-white/5 border-2 border-transparent rounded-2xl focus:border-[#ff6b00] focus:bg-white/8 transition-all text-white font-bold placeholder:text-slate-700 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrent(v => !v)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                    >
                                        {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* New Password */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                    New Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showNew ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="Min. 6 characters"
                                        required
                                        className="w-full pl-5 pr-12 py-4 bg-white/5 border-2 border-transparent rounded-2xl focus:border-[#ff6b00] focus:bg-white/8 transition-all text-white font-bold placeholder:text-slate-700 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNew(v => !v)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                    >
                                        {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm New Password */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Repeat new password"
                                        required
                                        className={`w-full pl-5 pr-12 py-4 bg-white/5 border-2 rounded-2xl transition-all text-white font-bold placeholder:text-slate-700 outline-none
                                            ${confirmPassword && newPassword
                                                ? confirmPassword === newPassword
                                                    ? 'border-green-500/60 focus:border-green-500'
                                                    : 'border-red-500/60 focus:border-red-500'
                                                : 'border-transparent focus:border-[#ff6b00]'}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(v => !v)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
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
                                className="w-full flex items-center justify-center gap-3 bg-[#ff6b00] hover:bg-[#ff8533] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#ff6b00]/20 mt-2"
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
                    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2.5 bg-blue-500/10 rounded-xl">
                                <User size={20} className="text-blue-400" />
                            </div>
                            <div>
                                <p className="font-black text-white uppercase tracking-tight italic">Account</p>
                                <p className="text-[10px] text-[#ff6b00] font-black uppercase tracking-widest">Details</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {accountDetails.map(({ icon: Icon, label, value }) => (
                                <div key={label} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                                    <div className="flex items-center gap-3 text-slate-500">
                                        <Icon size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
                                    </div>
                                    <span className={`font-black text-sm text-right
                                        ${label === 'Account Status' ? 'text-green-400' : 'text-white'}`}>
                                        {value}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* System ID */}
                        <div className="mt-6 bg-white/3 border border-white/5 rounded-2xl p-5">
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">System ID</p>
                            <p className="text-slate-400 font-mono text-xs break-all">{user?.id || '—'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
