import React, { useState, useEffect } from 'react';
import { X, User, Mail, Lock, Shield, GraduationCap, UserCheck, Briefcase, BookOpen, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const ROLE_CONFIGS = {
    student: {
        icon:    GraduationCap,
        label:   'Student',
        activeBg:    'bg-sky-50 border-sky-300 text-sky-700',
        inactiveBg:  'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700',
        dividerColor:'border-sky-200',
        dividerText: 'text-sky-600',
        button:  'bg-sky-700 hover:bg-sky-800',
    },
    teacher: {
        icon:    UserCheck,
        label:   'Teacher',
        activeBg:    'bg-emerald-50 border-emerald-300 text-emerald-700',
        inactiveBg:  'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700',
        dividerColor:'border-emerald-200',
        dividerText: 'text-emerald-600',
        button:  'bg-emerald-700 hover:bg-emerald-800',
    },
    admin: {
        icon:    Shield,
        label:   'Admin',
        activeBg:    'bg-violet-50 border-violet-300 text-violet-700',
        inactiveBg:  'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700',
        dividerColor:'border-violet-200',
        dividerText: 'text-violet-600',
        button:  'bg-violet-700 hover:bg-violet-800',
    },
    none: {
        icon:    User,
        label:   'None',
        activeBg:    'bg-slate-100 border-slate-400 text-slate-700',
        inactiveBg:  'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700',
        dividerColor:'border-slate-200',
        dividerText: 'text-slate-500',
        button:  'bg-slate-700 hover:bg-slate-800',
    },
};

function FormField({ label, icon: Icon, children }) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                {Icon && <Icon size={11} className="text-slate-500" />}
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
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-all disabled:opacity-40 disabled:bg-slate-50"
        />
    );
}

function Select({ value, onChange, children }) {
    return (
        <select value={value} onChange={onChange}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900 transition-all appearance-none cursor-pointer">
            {children}
        </select>
    );
}

export default function UserModal({ isNew, user = null, defaultRole = 'student', onClose, onSave }) {
    const [form, setForm] = useState({
        username:      '',
        email:         '',
        password:      '',
        name:          '',
        role:          defaultRole,
        studentBranch: '',
        section:       '',
        year:          '',
        semester:      '',
        department:    '',
        subjects:      '',
        employeeId:    '',
    });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (user) {
            setForm({
                username:      user.username      || '',
                email:         user.email         || '',
                password:      '',
                name:          user.name          || '',
                role:          user.role          || defaultRole,
                studentBranch: user.studentBranch || '',
                section:       user.section       || '',
                year:          user.year          || '',
                semester:      user.semester      || '',
                department:    user.department    || '',
                subjects:      user.subjects      || '',
                employeeId:    user.employeeId    || '',
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
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    onClick={onClose} />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.94, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 16 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[24px] bg-white border border-slate-200 shadow-[0_24px_80px_rgba(0,0,0,0.15)]"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}>

                    {/* Header */}
                    <div className="sticky top-0 z-10 px-6 pt-6 pb-5 border-b border-slate-200/80 bg-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl border ${roleConfig.activeBg}`}>
                                <RoleIcon size={18} />
                            </div>
                            <div>
                                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                                    {isNew ? `Add ${roleConfig.label}` : `Edit ${roleConfig.label}`}
                                </h2>
                                {!isNew && <p className="text-[11px] text-slate-500 font-medium">@{user?.username}</p>}
                            </div>
                        </div>
                        <button onClick={onClose}
                            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer">
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
                                            className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all cursor-pointer text-[10px] font-bold uppercase tracking-wider ${form.role === r ? cfg.activeBg : cfg.inactiveBg}`}>
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
                                    {errors.username && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.username}</p>}
                                </div>
                            </FormField>
                            <FormField label="Full Name" icon={User}>
                                <Input value={form.name} onChange={set('name')} placeholder="Full name (optional)" />
                            </FormField>
                        </div>

                        <FormField label="Email Address" icon={Mail}>
                            <div>
                                <Input value={form.email} onChange={set('email')} placeholder="user@kmit.in" type="email" required />
                                {errors.email && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.email}</p>}
                            </div>
                        </FormField>

                        <FormField label={isNew ? 'Password' : 'New Password (leave blank to keep)'} icon={Lock}>
                            <div>
                                <Input value={form.password} onChange={set('password')} placeholder={isNew ? 'Minimum 6 characters' : 'Leave blank to keep current'} type="password" required={isNew} />
                                {errors.password && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.password}</p>}
                            </div>
                        </FormField>

                        {/* Student-specific fields */}
                        {isStudent && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
                                <div className={`flex items-center gap-2 pt-1`}>
                                    <div className={`flex-1 h-px ${roleConfig.dividerColor} border-t`} />
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${roleConfig.dividerText}`}>Student Details</span>
                                    <div className={`flex-1 h-px ${roleConfig.dividerColor} border-t`} />
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
                                            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={String(n)}>Sem {n}</option>)}
                                        </Select>
                                    </FormField>
                                </div>
                            </motion.div>
                        )}

                        {/* Teacher-specific fields */}
                        {isTeacher && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
                                <div className="flex items-center gap-2 pt-1">
                                    <div className={`flex-1 h-px ${roleConfig.dividerColor} border-t`} />
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${roleConfig.dividerText}`}>Teacher Details</span>
                                    <div className={`flex-1 h-px ${roleConfig.dividerColor} border-t`} />
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
                                className="flex-1 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all cursor-pointer">
                                Cancel
                            </button>
                            <button type="submit" disabled={saving}
                                className={`flex-1 py-2.5 rounded-xl ${roleConfig.button} text-white font-bold text-sm transition-all shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2`}>
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
