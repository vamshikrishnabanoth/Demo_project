import React, { useState } from 'react';
import { X, Save, Loader2, AlertTriangle, ChevronDown, Eye, EyeOff, Plus, Edit3 } from 'lucide-react';
import { PremiumInput, PremiumButton } from '../ui/Primitives';
import api from '../../utils/api';

export default function UserModal({ user, onClose, onSave, isNew }) {
    const [form, setForm] = useState({
        username: user?.username || '',
        email:    user?.email    || '',
        password: '',
        role:     user?.role     || 'student',
    });
    const [showPw, setShowPw]   = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    const handleSubmit = async () => {
        if (!form.username || !form.email || (isNew && !form.password)) {
            setError('Please fill all required fields.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            if (isNew) {
                const res = await api.post('/admin/users', form);
                onSave(res.data, 'created');
            } else {
                const payload = { ...form };
                if (!payload.password) delete payload.password;
                const res = await api.put(`/admin/users/${user.id}`, payload);
                onSave(res.data, 'updated');
            }
        } catch (err) {
            setError(err.response?.data?.msg || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />
            
            <div className="relative glass-panel bg-[var(--bg-secondary)] border border-white/10 rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between p-8 border-b border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-[var(--bg-accent)]/10 rounded-2xl">
                            {isNew ? <Plus size={24} className="text-[var(--bg-accent)]" /> : <Edit3 size={24} className="text-[var(--bg-accent)]" />}
                        </div>
                        <div>
                            <h2 className="text-white font-black text-xl italic uppercase tracking-tighter">{isNew ? 'Provision' : 'Modify'} <span className="text-[var(--text-accent)]">User</span></h2>
                            <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mt-1">Core Database Management</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/20 hover:text-white transition p-2 hover:bg-white/5 rounded-xl"><X size={20} /></button>
                </div>

                <div className="p-8 space-y-6">
                    {error && (
                        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black p-4 rounded-2xl uppercase tracking-widest animate-pulse">
                            <AlertTriangle size={16} /> {error}
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-6">
                        <PremiumInput
                            label="Full Name"
                            placeholder="e.g. John Doe"
                            value={form.username}
                            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                        />
                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.3em] ml-4">Access Role</label>
                            <div className="relative group">
                                <select 
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-6 py-5 text-white font-black text-sm appearance-none cursor-pointer focus:outline-none focus:border-[var(--bg-accent)]/50 transition-all"
                                    value={form.role} 
                                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                                >
                                    <option value="student" className="bg-[#0a0a0b]">STUDENT</option>
                                    <option value="teacher" className="bg-[#0a0a0b]">TEACHER</option>
                                    <option value="admin"   className="bg-[#0a0a0b]">ADMIN</option>
                                    <option value="none"    className="bg-[#0a0a0b]">UNASSIGNED</option>
                                </select>
                                <ChevronDown size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-focus-within:text-[var(--text-accent)] transition-colors" />
                            </div>
                        </div>
                    </div>

                    <PremiumInput
                        label="Email Address"
                        placeholder="admin@kmit.in"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    />

                    <PremiumInput
                        label={isNew ? 'Account Password' : 'Reset Password'}
                        type={showPw ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        endIcon={showPw ? EyeOff : Eye}
                        onEndIconClick={() => setShowPw(p => !p)}
                    />
                </div>

                <div className="flex gap-4 p-8 pt-0">
                    <button 
                        onClick={onClose} 
                        className="flex-1 px-6 py-4 rounded-2xl border border-white/5 text-white/30 font-black text-xs uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all"
                    >
                        Abort
                    </button>
                    <PremiumButton 
                        onClick={handleSubmit} 
                        disabled={loading}
                        className="flex-1 py-4"
                        icon={loading ? Loader2 : Save}
                    >
                        {isNew ? 'PROVISION' : 'SAVE DATA'}
                    </PremiumButton>
                </div>
            </div>
        </div>
    );
}
