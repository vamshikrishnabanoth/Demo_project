import React, { useState, useEffect, useContext } from 'react';
import { X, User, Mail, Lock, Shield, GraduationCap, UserCheck, Briefcase, KeyRound, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import AuthContext from '../../context/AuthContext';
import { getSectionsForBranch } from '../../utils/sectionUtils';

const ROLE_CONFIGS = {
    student: {
        icon: GraduationCap,
        label: 'Student',
        badgeBg: 'bg-sky-50 border-sky-300 text-sky-700',
        dividerColor: 'border-sky-200',
        dividerText: 'text-sky-600',
        button: 'bg-sky-700 hover:bg-sky-800 text-white',
    },
    teacher: {
        icon: UserCheck,
        label: 'Teacher',
        badgeBg: 'bg-emerald-50 border-emerald-300 text-emerald-700',
        dividerColor: 'border-emerald-200',
        dividerText: 'text-emerald-600',
        button: 'bg-emerald-700 hover:bg-emerald-800 text-white',
    },
    admin: {
        icon: Shield,
        label: 'Admin',
        badgeBg: 'bg-violet-50 border-violet-300 text-violet-700',
        dividerColor: 'border-violet-200',
        dividerText: 'text-violet-600',
        button: 'bg-violet-700 hover:bg-violet-800 text-white',
    },
    none: {
        icon: User,
        label: 'None',
        badgeBg: 'bg-slate-100 border-slate-300 text-slate-700',
        dividerColor: 'border-slate-200',
        dividerText: 'text-slate-500',
        button: 'bg-slate-700 hover:bg-slate-800 text-white',
    },
};

function FormField({ label, icon: Icon, required, children }) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {Icon && <Icon size={12} className="text-slate-500" />}
                <span>{label}</span>
                {required && <span className="text-rose-500 font-bold ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

function Input({ value, onChange, placeholder, type = 'text', required, disabled, rightElement }) {
    return (
        <div className="relative">
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all disabled:opacity-40 disabled:bg-slate-50"
            />
            {rightElement && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                    {rightElement}
                </div>
            )}
        </div>
    );
}

function Select({ value, onChange, children }) {
    return (
        <select value={value} onChange={onChange}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all appearance-none cursor-pointer">
            {children}
        </select>
    );
}

export default function UserModal({ isNew, user = null, defaultRole = 'student', onClose, onSave }) {
    const { user: currentUser, updateUser } = useContext(AuthContext);
    const [tab, setTab] = useState('details'); // 'details' | 'reset-password'
    const [showPassword, setShowPassword] = useState(false);

    // Reliable determination of whether creating new user or editing existing user
    const isNewUser = isNew !== undefined ? isNew : !user;

    const activeRole = user?.role || defaultRole || 'student';

    const [form, setForm] = useState({
        username: user?.username || '',
        email: user?.email || '',
        password: '',
        name: user?.name || '',
        role: activeRole,
        studentBranch: user?.studentBranch || 'CSE',
        section: user?.section || 'A',
        year: user?.year || '1',
        semester: user?.semester || '1',
        academicYear: user?.academicYear || '2025-2026',
        department: user?.studentBranch || user?.department || 'CSE',
    });

    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (user) {
            setForm({
                username: user.username || '',
                email: user.email || '',
                password: '',
                name: user.name || '',
                role: user.role || defaultRole || 'student',
                studentBranch: user.studentBranch || 'CSE',
                section: user.section || 'A',
                year: user.year || '1',
                semester: user.semester || '1',
                academicYear: user.academicYear || '2025-2026',
                department: user.studentBranch || user.department || 'CSE',
            });
        } else {
            setForm({
                username: '',
                email: '',
                password: '',
                name: '',
                role: defaultRole || 'student',
                studentBranch: 'CSE',
                section: 'A',
                year: '1',
                semester: '1',
                academicYear: '2025-2026',
                department: 'CSE',
            });
        }
        setErrors({});
    }, [user, defaultRole]);

    const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

    const isStudent = form.role === 'student';
    const isTeacher = form.role === 'teacher';

    const validate = () => {
        const e = {};
        if (!form.username.trim()) {
            e.username = isStudent ? 'Roll No / Username is required' : isTeacher ? 'Faculty ID / Username is required' : 'Username is required';
        }
        if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            e.email = 'Valid email address is required';
        }
        if (isNewUser && !form.password.trim()) {
            e.password = 'Password is required';
        } else if (isNewUser && form.password.trim().length < 6) {
            e.password = 'Password must be at least 6 characters';
        }
        return e;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const v = validate();
        if (Object.keys(v).length) { setErrors(v); return; }
        setErrors({});
        setSaving(true);

        const payload = {
            username: form.username.trim(),
            email: form.email.trim(),
            name: form.name.trim() || null,
            role: form.role,
        };

        if (form.password && form.password.trim()) {
            payload.password = form.password.trim();
        }

        if (isStudent) {
            payload.studentBranch = form.studentBranch || 'CSE';
            payload.section = form.section || 'A';
            payload.year = String(form.year || '1');
            payload.semester = String(form.semester || '1');
            payload.academicYear = form.academicYear || '2025-2026';
        } else if (isTeacher) {
            payload.studentBranch = form.department || form.studentBranch || 'CSE';
        }

        try {
            let res;
            if (isNewUser) {
                res = await api.post('/admin/users', payload);
                toast.success(`${ROLE_CONFIGS[form.role]?.label || 'User'} created successfully!`);
                onSave(res.data, 'created');
            } else {
                res = await api.put(`/admin/users/${user.id}`, payload);
                toast.success('User updated successfully!');
                
                if (user?.id === currentUser?.id) {
                    updateUser(res.data);
                }

                onSave(res.data, 'updated');
            }
        } catch (err) {
            const msg = err.response?.data?.msg || 'Operation failed';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordResetSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await api.post(`/admin/users/${user.id}/reset-password`);
            toast.success(res.data.msg || `Password reset for ${user.username}!`);
            setTab('details');
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Password reset failed');
        } finally {
            setSaving(false);
        }
    };

    const roleConfig = ROLE_CONFIGS[form.role] || ROLE_CONFIGS.student;
    const RoleIcon = roleConfig.icon;

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
                    className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[24px] bg-white border border-slate-200 shadow-[0_24px_80px_rgba(0,0,0,0.15)]"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}>

                    {/* Header */}
                    <div className="sticky top-0 z-10 px-6 pt-6 pb-4 border-b border-slate-200 bg-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl border ${roleConfig.badgeBg}`}>
                                <RoleIcon size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                                    {isNewUser ? `Add New ${roleConfig.label}` : `Edit ${roleConfig.label}`}
                                </h2>
                                {!isNewUser ? (
                                    <p className="text-[11px] text-slate-500 font-semibold">@{user?.username}</p>
                                ) : (
                                    <p className="text-[11px] text-slate-500 font-medium">
                                        Fill in required details for {roleConfig.label.toLowerCase()} account
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {!isNewUser && (
                                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                                    <button onClick={() => setTab('details')}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${tab === 'details' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}>
                                        Details
                                    </button>
                                    <button onClick={() => setTab('reset-password')}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${tab === 'reset-password' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500'}`}>
                                        Reset Pass
                                    </button>
                                </div>
                            )}
                            <button onClick={onClose}
                                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    {tab === 'reset-password' && !isNewUser ? (
                        <form onSubmit={handlePasswordResetSubmit} className="p-6 space-y-4">
                            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                                <h4 className="font-extrabold flex items-center gap-1.5"><KeyRound size={15} /> Reset User Password</h4>
                                <p className="font-medium">Reset password for account <span className="font-bold">@{user?.username}</span> strictly to default format: <code className="font-bold bg-amber-100 px-1.5 py-0.5 rounded">{user?.username}@kk</code>.</p>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setTab('details')} className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs">Cancel</button>
                                <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-rose-700 text-white font-bold text-xs disabled:opacity-40">
                                    {saving ? 'Resetting...' : 'Confirm Default Password Reset'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">

                            {/* Core Required Fields */}
                            <div className="grid grid-cols-2 gap-4">
                                <FormField 
                                    label={isStudent ? "Roll No. / Username" : isTeacher ? "Faculty ID / Username" : "Username"} 
                                    icon={User}
                                    required
                                >
                                    <div>
                                        <Input 
                                            value={form.username} 
                                            onChange={set('username')} 
                                            placeholder={isStudent ? "e.g. 21A91A0501" : isTeacher ? "e.g. T101 or faculty_cse" : "Username"} 
                                            required 
                                        />
                                        {errors.username && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.username}</p>}
                                    </div>
                                </FormField>
                                
                                <FormField label="Full Name" icon={User}>
                                    <Input 
                                        value={form.name} 
                                        onChange={set('name')} 
                                        placeholder={isStudent ? "e.g. John Doe" : isTeacher ? "e.g. Dr. Jane Smith" : "Full name"} 
                                    />
                                </FormField>
                            </div>

                            <FormField label="Email Address" icon={Mail} required>
                                <div>
                                    <Input 
                                        value={form.email} 
                                        onChange={set('email')} 
                                        placeholder={isStudent ? "student@kmit.in" : isTeacher ? "teacher@kmit.in" : "admin@kmit.in"} 
                                        type="email" 
                                        required 
                                    />
                                    {errors.email && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.email}</p>}
                                </div>
                            </FormField>

                            <FormField label={isNewUser ? "Password" : "New Password (leave blank to keep current)"} icon={Lock} required={isNewUser}>
                                <div>
                                    <Input 
                                        value={form.password} 
                                        onChange={set('password')} 
                                        placeholder={isNewUser ? "Minimum 6 characters" : "Leave blank to keep current"} 
                                        type={showPassword ? "text" : "password"} 
                                        required={isNewUser}
                                        rightElement={
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="text-slate-400 hover:text-slate-600 focus:outline-none p-1 cursor-pointer"
                                                title={showPassword ? "Hide Password" : "Show Password"}
                                            >
                                                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                            </button>
                                        }
                                    />
                                    {errors.password && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.password}</p>}
                                </div>
                            </FormField>

                            {/* Student-specific details */}
                            {isStudent && (
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`flex-1 h-px ${roleConfig.dividerColor} border-t`} />
                                        <span className={`text-[10px] font-extrabold uppercase tracking-widest ${roleConfig.dividerText}`}>
                                            Student Academic Details
                                        </span>
                                        <div className={`flex-1 h-px ${roleConfig.dividerColor} border-t`} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField label="Branch / Dept" required>
                                            <Select value={form.studentBranch} onChange={(e) => {
                                                const newBranch = e.target.value;
                                                const secs = getSectionsForBranch(newBranch);
                                                setForm(prev => ({
                                                    ...prev,
                                                    studentBranch: newBranch,
                                                    department: newBranch,
                                                    section: secs.includes(prev.section) ? prev.section : secs[0]
                                                }));
                                            }}>
                                                <option value="CSE">CSE (Computer Science & Engg)</option>
                                                <option value="CSM">CSM (CSE - AI & ML)</option>
                                                <option value="CSD">CSD (CSE - Data Science)</option>
                                                <option value="ECE">ECE (Electronics & Comm)</option>
                                                <option value="IT">IT (Information Tech)</option>
                                                <option value="EEE">EEE (Electrical & Electronics)</option>
                                                <option value="CIVIL">CIVIL Engineering</option>
                                                <option value="MECH">MECH Engineering</option>
                                            </Select>
                                        </FormField>

                                        <FormField label="Section" required>
                                            <Select value={form.section} onChange={set('section')}>
                                                {getSectionsForBranch(form.studentBranch).map(s => (
                                                    <option key={s} value={s}>Section {s}</option>
                                                ))}
                                            </Select>
                                        </FormField>

                                        <FormField label="Year" required>
                                            <Select value={form.year} onChange={set('year')}>
                                                <option value="1">Year 1 (1st Year)</option>
                                                <option value="2">Year 2 (2nd Year)</option>
                                                <option value="3">Year 3 (3rd Year)</option>
                                                <option value="4">Year 4 (4th Year)</option>
                                            </Select>
                                        </FormField>

                                        <FormField label="Semester" required>
                                            <Select value={form.semester} onChange={set('semester')}>
                                                <option value="1">Semester 1</option>
                                                <option value="2">Semester 2</option>
                                            </Select>
                                        </FormField>
                                    </div>
                                </div>
                            )}

                            {/* Teacher-specific details */}
                            {isTeacher && (
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`flex-1 h-px ${roleConfig.dividerColor} border-t`} />
                                        <span className={`text-[10px] font-extrabold uppercase tracking-widest ${roleConfig.dividerText}`}>
                                            Faculty Department Details
                                        </span>
                                        <div className={`flex-1 h-px ${roleConfig.dividerColor} border-t`} />
                                    </div>

                                    <FormField label="Department / Branch" icon={Briefcase} required>
                                        <Select value={form.department} onChange={set('department')}>
                                            <option value="CSE">CSE - Computer Science & Engg</option>
                                            <option value="ECE">ECE - Electronics & Comm</option>
                                            <option value="EEE">EEE - Electrical & Electronics</option>
                                            <option value="IT">IT - Information Tech</option>
                                            <option value="CSM">CSM - AI & Machine Learning</option>
                                            <option value="CSD">CSD - Data Science</option>
                                        </Select>
                                    </FormField>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-3 pt-4">
                                <button 
                                    type="button" 
                                    onClick={onClose}
                                    className="flex-1 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={saving}
                                    className={`flex-1 py-2.5 rounded-xl ${roleConfig.button} text-white font-bold text-sm transition-all shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2`}
                                >
                                    {saving ? (
                                        <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving...</>
                                    ) : (
                                        isNewUser ? `Create ${roleConfig.label}` : 'Save Changes'
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
