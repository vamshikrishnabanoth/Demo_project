import React, { useState, useEffect } from 'react';
import { X, User, Mail, Lock, Shield, GraduationCap, UserCheck, Briefcase, BookOpen, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const ROLE_CONFIGS = {
    student: {
        color:   'sky',
        icon:    GraduationCap,
        label:   'Student',
        bg:      'bg-sky-500/10',
        border:  'border-sky-500/30',
        accent:  'text-sky-400',
        button:  'bg-sky-600 hover:bg-sky-500 shadow-sky-500/25',
    },
    teacher: {
        color:   'emerald',
        icon:    UserCheck,
        label:   'Teacher',
        bg:      'bg-emerald-500/10',
        border:  'border-emerald-500/30',
        accent:  'text-emerald-400',
        button:  'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/25',
    },
    admin: {
        color:   'violet',
        icon:    Shield,
        label:   'Admin',
        bg:      'bg-violet-500/10',
        border:  'border-violet-500/30',
        accent:  'text-violet-400',
        button:  'bg-violet-600 hover:bg-violet-500 shadow-violet-500/25',
    },
    none: {
        color:   'slate',
        icon:    User,
        label:   'None',
        bg:      'bg-slate-500/10',
        border:  'border-slate-500/30',
        accent:  'text-slate-400',
        button:  'bg-slate-600 hover:bg-slate-500 shadow-slate-500/25',
    },
};

function FormField({ label, icon: Icon, children, accent = 'sky' }) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-widest">
                {Icon && <Icon size={11} className={`text-${accent}-400`} />}
                {label}
            </label>
            {children}
        </div>
    );
}

function Input({ value, onChange, placeholder, type = 'text', required, disabled }) {
    return (
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-2xl text-sm font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-sky-500/50 transition-all disabled:opacity-40"
        />
    );
}

function Select({ value, onChange, children }) {
    return (
        <select value={value} onChange={onChange}
            className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-2xl text-sm font-bold text-white focus:outline-none focus:border-sky-500/50 transition-all appearance-none cursor-pointer">
            {children}
        </select>
    );
}

export default function UserModal({ isNew, user = null, defaultRole = 'student', onClose, onSave }) {
    const [form, setForm] = useState({
        username:     '',
        email:        '',
        password:     '',
        name:         '',
        role:         defaultRole,
        // Student fields
        studentBranch: '',
        section:      '',
        year:         '',
        semester:     '',
        // Teacher fields
        department:   '',
        subjects:     '',
        employeeId:   '',
    });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (user) {
            setForm({
                username:      user.username     || '',
                email:         user.email        || '',
                password:      '',
                name:          user.name         || '',
                role:          user.role         || defaultRole,
                studentBranch: user.studentBranch|| '',
                section:       user.section      || '',
                year:          user.year         || '',
                semester:      user.semester     || '',
                department:    user.department   || '',
                subjects:      user.subjects     || '',
                employeeId:    user.employeeId   || '',
            });
        }
    }, [user, defaultRole]);

    const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

    const validate = () => {
        const e = {};
        if (!form.username.trim()) e.username = 'Username is required';
        if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email is required';
        if (isNew && !form.password.trim()) e.password = 'Password is required';
        if (isNew && form.password.trim().length < 6) e.password = 'Password must be at least 6 characters';
        return e;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const v = validate();
        if (Object.keys(v).length) { setErrors(v); return; }
        setErrors({});
        setSaving(true);
        const payload = { ...form };
        if (!isNew && !payload.password.trim()) delete payload.password;
        try {
            let res;
            if (isNew) {
                res = await api.post('/admin/users', payload);
                toast.success(`${ROLE_CONFIGS[form.role]?.label || 'User'} created successfully!`);
                onSave(res.data, 'created');
            } else {
                res = await api.put(`/admin/users/${user.id}`, payload);
                toast.success('User updated successfully!');
                onSave(res.data, 'updated');
            }
        } catch (err) {
            const msg = err.response?.data?.msg || 'Operation failed';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const roleConfig = ROLE_CONFIGS[form.role] || ROLE_CONFIGS.student;
    const RoleIcon   = roleConfig.icon;
    const isStudent  = form.role === 'student';
    const isTeacher  = form.role === 'teacher';

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/70 backdrop-blur-md"
                    onClick={onClose} />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0f1729] border border-white/10 shadow-2xl"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>

                    {/* Header */}
                    <div className={`sticky top-0 z-10 px-6 pt-6 pb-5 border-b border-white/[0.06] bg-[#0f1729] flex items-center justify-between`}>
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-2xl ${roleConfig.bg} border ${roleConfig.border}`}>
                                <RoleIcon size={20} className={roleConfig.accent} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white italic uppercase tracking-tighter">
                                    {isNew ? `Add ${roleConfig.label}` : `Edit ${roleConfig.label}`}
                                </h2>
                                {!isNew && <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">@{user?.username}</p>}
                            </div>
                        </div>
                        <button onClick={onClose}
                            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all cursor-pointer">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">

                        {/* Role Selector */}
                        <FormField label="Role" icon={Shield}>
                            <div className="grid grid-cols-4 gap-2">
                                {Object.entries(ROLE_CONFIGS).map(([r, cfg]) => {
                                    const Ic = cfg.icon;
                                    return (
                                        <button key={r} type="button" onClick={() => setForm(p => ({ ...p, role: r }))}
                                            className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border transition-all cursor-pointer text-[10px] font-black uppercase tracking-wider ${form.role === r ? `${cfg.bg} ${cfg.border} ${cfg.accent}` : 'border-white/[0.08] text-white/30 hover:border-white/20 hover:text-white/60'}`}>
                                            <Ic size={16} />{cfg.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </FormField>

                        {/* Core Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="Username / Roll No." icon={User}>
                                <div>
                                    <Input value={form.username} onChange={set('username')} placeholder="e.g. 21A91A0501" required />
                                    {errors.username && <p className="text-[10px] text-rose-400 mt-1 font-bold">{errors.username}</p>}
                                </div>
                            </FormField>
                            <FormField label="Full Name" icon={User}>
                                <Input value={form.name} onChange={set('name')} placeholder="Full name (optional)" />
                            </FormField>
                        </div>

                        <FormField label="Email Address" icon={Mail}>
                            <div>
                                <Input value={form.email} onChange={set('email')} placeholder="user@kmit.in" type="email" required />
                                {errors.email && <p className="text-[10px] text-rose-400 mt-1 font-bold">{errors.email}</p>}
                            </div>
                        </FormField>

                        <FormField label={isNew ? 'Password' : 'New Password (leave blank to keep)'} icon={Lock}>
                            <div>
                                <Input value={form.password} onChange={set('password')} placeholder={isNew ? 'Minimum 6 characters' : 'Leave blank to keep current'} type="password" required={isNew} />
                                {errors.password && <p className="text-[10px] text-rose-400 mt-1 font-bold">{errors.password}</p>}
                            </div>
                        </FormField>

                        {/* Student-specific fields */}
                        {isStudent && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
                                <div className="flex items-center gap-2 pt-1">
                                    <div className="flex-1 h-px bg-sky-500/20" />
                                    <span className="text-[9px] font-black text-sky-400/60 uppercase tracking-widest">Student Details</span>
                                    <div className="flex-1 h-px bg-sky-500/20" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField label="Branch">
                                        <Input value={form.studentBranch} onChange={set('studentBranch')} placeholder="e.g. CSE, ECE, EEE" />
                                    </FormField>
                                    <FormField label="Section">
                                        <Input value={form.section} onChange={set('section')} placeholder="e.g. A, B, C" />
                                    </FormField>
                                    <FormField label="Year">
                                        <Select value={form.year} onChange={set('year')}>
                                            <option value="">Select Year</option>
                                            <option value="1">1st Year</option>
                                            <option value="2">2nd Year</option>
                                            <option value="3">3rd Year</option>
                                            <option value="4">4th Year</option>
                                        </Select>
                                    </FormField>
                                    <FormField label="Semester">
                                        <Select value={form.semester} onChange={set('semester')}>
                                            <option value="">Select Semester</option>
                                            {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={String(n)}>Sem {n}</option>)}
                                        </Select>
                                    </FormField>
                                </div>
                            </motion.div>
                        )}

                        {/* Teacher-specific fields */}
                        {isTeacher && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
                                <div className="flex items-center gap-2 pt-1">
                                    <div className="flex-1 h-px bg-emerald-500/20" />
                                    <span className="text-[9px] font-black text-emerald-400/60 uppercase tracking-widest">Teacher Details</span>
                                    <div className="flex-1 h-px bg-emerald-500/20" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField label="Department" icon={Briefcase}>
                                        <Input value={form.department} onChange={set('department')} placeholder="e.g. CSE, ECE" />
                                    </FormField>
                                    <FormField label="Employee ID" icon={Hash}>
                                        <Input value={form.employeeId} onChange={set('employeeId')} placeholder="e.g. KMIT-T-001" />
                                    </FormField>
                                </div>
                                <FormField label="Subjects (comma-separated)" icon={BookOpen}>
                                    <Input value={form.subjects} onChange={set('subjects')} placeholder="e.g. DBMS, OS, CN" />
                                </FormField>
                            </motion.div>
                        )}

                        {/* Submit */}
                        <div className="flex items-center gap-3 pt-2">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-black text-sm uppercase tracking-wider hover:bg-white/10 transition-all cursor-pointer">
                                Cancel
                            </button>
                            <button type="submit" disabled={saving}
                                className={`flex-1 py-3 rounded-2xl ${roleConfig.button} text-white font-black text-sm uppercase tracking-wider transition-all shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2`}>
                                {saving
                                    ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving...</>
                                    : isNew ? `Create ${roleConfig.label}` : 'Save Changes'
                                }
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
