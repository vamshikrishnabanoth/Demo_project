import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation, Link } from 'react-router-dom';
import { 
    ChevronLeft, User, Mail, Lock, Shield, GraduationCap, 
    UserCheck, Briefcase, Eye, EyeOff, Save, KeyRound, 
    CheckCircle2, ArrowLeft, RefreshCw, AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import AuthContext from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { getSectionsForBranch } from '../utils/sectionUtils';

const BRANCH_OPTIONS = [
    { value: 'CSE', label: 'CSE (Computer Science & Engg)' },
    { value: 'CSM', label: 'CSM (CSE - AI & ML)' },
];

const YEAR_OPTIONS = [
    { value: '1', label: 'Year 1 (1st Year)' },
    { value: '2', label: 'Year 2 (2nd Year)' },
    { value: '3', label: 'Year 3 (3rd Year)' },
    { value: '4', label: 'Year 4 (4th Year)' },
];

const SEMESTER_OPTIONS = [
    { value: '1', label: 'Semester 1' },
    { value: '2', label: 'Semester 2' },
];

const FACULTY_DEPT_OPTIONS = [
    { value: 'CSE', label: 'CSE - Computer Science & Engg' },
    { value: 'CSM', label: 'CSM - AI & Machine Learning' },
];

const ROLE_CONFIGS = {
    student: {
        label: 'Student',
        tab: 'students',
        icon: GraduationCap,
        badgeBg: 'bg-sky-50 border-sky-200 text-sky-800',
        accentColor: 'sky',
        heading: 'Student Account',
        description: 'Configure student identity, branch, section, and academic year details.',
    },
    teacher: {
        label: 'Teacher',
        tab: 'teachers',
        icon: UserCheck,
        badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        accentColor: 'emerald',
        heading: 'Faculty Account',
        description: 'Configure teacher identity, credentials, and departmental affiliations.',
    },
    admin: {
        label: 'Admin',
        tab: 'admins',
        icon: Shield,
        badgeBg: 'bg-purple-50 border-purple-200 text-purple-800',
        accentColor: 'purple',
        heading: 'Administrator Account',
        description: 'Provision elevated system access, governance, and directory controls.',
    },
};

function FormField({ label, icon: Icon, required = false, hint, children }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
                    {Icon && <Icon size={14} className="text-slate-500 shrink-0" />}
                    <span>{label}</span>
                    {required && <span className="text-rose-500 font-bold">*</span>}
                </label>
                {hint && <span className="text-[11px] font-semibold text-slate-400">{hint}</span>}
            </div>
            {children}
        </div>
    );
}

function Input({ value, onChange, placeholder, type = 'text', required = false, disabled = false, rightElement = null, error = null }) {
    return (
        <div className="relative w-full">
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                className={`w-full min-h-[44px] px-4 py-2.5 bg-white border ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : 'border-slate-300 focus:border-slate-900 focus:ring-slate-900/10'} rounded-xl text-sm font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 transition-all disabled:opacity-40 disabled:bg-slate-50 ${rightElement ? 'pr-11' : ''}`}
            />
            {rightElement && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                    {rightElement}
                </div>
            )}
            {error && <p className="text-[11px] text-rose-600 mt-1 font-semibold">{error}</p>}
        </div>
    );
}

import CustomSelect from '../components/admin/CustomSelect';

function SelectInput({ value, onChange, options, disabled = false }) {
    return (
        <CustomSelect
            value={value}
            onChange={onChange}
            options={options}
            disabled={disabled}
        />
    );
}

export default function AdminUserForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const { user: currentUser, updateUser } = useContext(AuthContext);

    const isEditMode = Boolean(id);
    const passedRole = searchParams.get('role') || location.state?.defaultRole || location.state?.user?.role || 'student';
    
    const [role, setRole] = useState(passedRole);
    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        name: '',
        studentBranch: 'CSE',
        section: 'A',
        year: '1',
        semester: '1',
        academicYear: '2025-2026',
        department: 'CSE',
    });

    const [loadingData, setLoadingData] = useState(isEditMode && !location.state?.user);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    const [resettingPw, setResettingPw] = useState(false);

    // Pre-populate if state was passed or fetch if direct deep-link
    useEffect(() => {
        if (location.state?.user) {
            const u = location.state.user;
            setRole(u.role || passedRole);
            setForm({
                username: u.username || '',
                email: u.email || '',
                password: '',
                name: u.name || '',
                studentBranch: u.studentBranch || 'CSE',
                section: u.section || 'A',
                year: u.year || '1',
                semester: u.semester || '1',
                academicYear: u.academicYear || '2025-2026',
                department: u.studentBranch || u.department || 'CSE',
            });
            setLoadingData(false);
        } else if (isEditMode) {
            let isMounted = true;
            const fetchUser = async () => {
                setLoadingData(true);
                try {
                    const res = await api.get('/admin/users', { params: { search: id } });
                    const match = res.data?.users?.find(item => item.id === id) || res.data?.users?.[0];
                    if (match && isMounted) {
                        setRole(match.role || 'student');
                        setForm({
                            username: match.username || '',
                            email: match.email || '',
                            password: '',
                            name: match.name || '',
                            studentBranch: match.studentBranch || 'CSE',
                            section: match.section || 'A',
                            year: match.year || '1',
                            semester: match.semester || '1',
                            academicYear: match.academicYear || '2025-2026',
                            department: match.studentBranch || match.department || 'CSE',
                        });
                    }
                } catch (err) {
                    console.error('Failed to load user for edit:', err);
                    toast.error('Could not load user data');
                } finally {
                    if (isMounted) setLoadingData(false);
                }
            };
            fetchUser();
            return () => { isMounted = false; };
        } else {
            setRole(passedRole);
        }
    }, [id, isEditMode, location.state, passedRole]);

    const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
    const setDirect = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

    const isStudent = role === 'student';
    const isTeacher = role === 'teacher';
    const activeConfig = ROLE_CONFIGS[role] || ROLE_CONFIGS.student;
    const RoleIcon = activeConfig.icon;

    const returnTab = activeConfig.tab;
    const returnUrl = `/admin-dashboard?tab=${returnTab}`;

    const validate = () => {
        const e = {};
        if (!form.username.trim()) {
            e.username = isStudent ? 'Roll No / Username is required' : isTeacher ? 'Faculty ID / Username is required' : 'Username is required';
        }
        if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            e.email = 'Valid email address is required';
        }
        if (!isEditMode && !form.password.trim()) {
            e.password = 'Password is required';
        } else if (!isEditMode && form.password.trim().length < 6) {
            e.password = 'Password must be at least 6 characters';
        }
        return e;
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        const v = validate();
        if (Object.keys(v).length) {
            setErrors(v);
            toast.error('Please review the highlighted fields');
            return;
        }
        setErrors({});
        setSaving(true);

        const payload = {
            username: form.username.trim(),
            email: form.email.trim(),
            name: form.name.trim() || null,
            role,
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
            if (isEditMode) {
                const res = await api.put(`/admin/users/${id}`, payload);
                toast.success('User updated successfully!');
                if (id === currentUser?.id) {
                    updateUser(res.data);
                }
            } else {
                const endpoint = role === 'student' ? '/admin/students' :
                                 role === 'teacher' ? '/admin/teachers' :
                                 role === 'admin'   ? '/admin/admins' :
                                 '/admin/users';
                await api.post(endpoint, payload);
                toast.success(`${activeConfig.label} account created successfully!`);
            }
            navigate(returnUrl);
        } catch (err) {
            const msg = err.response?.data?.msg || err.response?.data?.error || 'Operation failed';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleQuickPasswordReset = async () => {
        if (!id) return;
        setResettingPw(true);
        try {
            const res = await api.post(`/admin/users/${id}/reset-password`);
            toast.success(res.data.msg || `Password reset for @${form.username}!`);
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Password reset failed');
        } finally {
            setResettingPw(false);
        }
    };

    if (loadingData) {
        return (
            <DashboardLayout role="admin">
                <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                    <RefreshCw className="animate-spin text-[#ea580c]" size={36} />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Loading User Information...</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="admin">
            <div className="max-w-5xl mx-auto space-y-6 pb-24">
                
                {/* ── Breadcrumb Navigation (Instant Back Without Reload) ── */}
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
                    <Link to="/admin-dashboard" className="hover:text-slate-700 transition-colors">
                        Admin Command Center
                    </Link>
                    <span>/</span>
                    <Link to={returnUrl} className="hover:text-slate-700 transition-colors">
                        {activeConfig.label}s Directory
                    </Link>
                    <span>/</span>
                    <span className="text-[#ea580c] font-black">
                        {isEditMode ? `Edit @${form.username || 'User'}` : `Add New ${activeConfig.label}`}
                    </span>
                </div>

                {/* ── Header Card ── */}
                <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => navigate(returnUrl)}
                            className="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all cursor-pointer shrink-0 border border-slate-200 active:scale-95"
                            title="Back to Directory"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${activeConfig.badgeBg}`}>
                                    <RoleIcon size={14} />
                                    {activeConfig.label}
                                </span>
                                {isEditMode && (
                                    <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                                        ID: {id?.slice(0, 8)}...
                                    </span>
                                )}
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                                {isEditMode ? `Edit ${activeConfig.label}: ${form.name || form.username}` : `Create New ${activeConfig.label}`}
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-600 font-semibold mt-0.5">
                                {activeConfig.description}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Main Form Form Body ── */}
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Card 1: Role Selection & Identity */}
                    <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div>
                                <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">1. Account Role & Identity</h2>
                                <p className="text-xs text-slate-500 font-semibold">Select the organizational role and primary account credentials.</p>
                            </div>
                        </div>

                        {/* Role Switcher Tabs */}
                        {!isEditMode && (
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-wider text-slate-700">Select Role</label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {Object.entries(ROLE_CONFIGS).map(([rKey, rCfg]) => {
                                        const RIcon = rCfg.icon;
                                        const isSelected = role === rKey;
                                        return (
                                            <button
                                                key={rKey}
                                                type="button"
                                                onClick={() => {
                                                    setRole(rKey);
                                                    setErrors({});
                                                }}
                                                className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer text-left ${
                                                    isSelected 
                                                        ? 'border-[#ea580c] bg-orange-50/50 shadow-sm' 
                                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                                }`}
                                            >
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                                                    isSelected ? 'bg-[#ea580c] text-white border-[#ea580c]' : 'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                    <RIcon size={20} />
                                                </div>
                                                <div>
                                                    <p className={`text-xs font-black uppercase tracking-wider ${isSelected ? 'text-[#c2410c]' : 'text-slate-800'}`}>
                                                        {rCfg.label}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 font-medium">
                                                        {rKey === 'student' ? 'Access quizzes & arena' : rKey === 'teacher' ? 'Author & host classes' : 'Complete system controls'}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Form Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <FormField 
                                label={isStudent ? "Roll Number / Student ID" : isTeacher ? "Faculty ID / Username" : "Admin Username"} 
                                icon={User}
                                required
                                hint={isStudent ? "e.g. 21A91A0501" : isTeacher ? "e.g. T101 or prof_smith" : "Unique handle"}
                            >
                                <Input 
                                    value={form.username} 
                                    onChange={set('username')} 
                                    placeholder={isStudent ? "21A91A0501" : isTeacher ? "faculty_cse" : "admin_user"} 
                                    required 
                                    error={errors.username}
                                />
                            </FormField>

                            <FormField label="Full Name" icon={User} hint="Display name">
                                <Input 
                                    value={form.name} 
                                    onChange={set('name')} 
                                    placeholder={isStudent ? "e.g. John Doe" : isTeacher ? "e.g. Dr. Jane Smith" : "Administrator"} 
                                />
                            </FormField>

                            <FormField label="Email Address" icon={Mail} required hint="Official institutional email">
                                <Input 
                                    value={form.email} 
                                    onChange={set('email')} 
                                    placeholder={isStudent ? "student@kmit.in" : isTeacher ? "faculty@kmit.in" : "admin@kmit.in"} 
                                    type="email" 
                                    required 
                                    error={errors.email}
                                />
                            </FormField>

                            <FormField 
                                label={isEditMode ? "Change Password (Optional)" : "Account Password"} 
                                icon={Lock} 
                                required={!isEditMode}
                                hint={isEditMode ? "Leave empty to keep current" : "Min 6 characters"}
                            >
                                <Input 
                                    value={form.password} 
                                    onChange={set('password')} 
                                    placeholder={isEditMode ? "•••••••• (Unchanged)" : "Enter account password"} 
                                    type={showPassword ? "text" : "password"} 
                                    required={!isEditMode}
                                    error={errors.password}
                                    rightElement={
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="text-slate-400 hover:text-slate-600 focus:outline-none p-1 cursor-pointer"
                                            title={showPassword ? "Hide Password" : "Show Password"}
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    }
                                />
                            </FormField>
                        </div>
                    </div>

                    {/* Card 2: Academic & Department Context */}
                    {isStudent && (
                        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div>
                                    <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">2. Student Academic Details</h2>
                                    <p className="text-xs text-slate-500 font-semibold">Assign student to specific classes for live quiz and exam broadcasting.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                                <FormField label="Branch / Department" required>
                                    <SelectInput 
                                        value={form.studentBranch} 
                                        onChange={(newBranch) => {
                                            const secs = getSectionsForBranch(newBranch);
                                            setForm(prev => ({
                                                ...prev,
                                                studentBranch: newBranch,
                                                department: newBranch,
                                                section: secs.includes(prev.section) ? prev.section : secs[0]
                                            }));
                                        }}
                                        options={BRANCH_OPTIONS}
                                    />
                                </FormField>

                                <FormField label="Section" required>
                                    <SelectInput 
                                        value={form.section} 
                                        onChange={(val) => setDirect('section', val)}
                                        options={getSectionsForBranch(form.studentBranch).map(s => ({ value: s, label: `Section ${s}` }))}
                                    />
                                </FormField>

                                <FormField label="Academic Year" required>
                                    <SelectInput 
                                        value={form.year} 
                                        onChange={(val) => setDirect('year', val)}
                                        options={YEAR_OPTIONS}
                                    />
                                </FormField>

                                <FormField label="Semester" required>
                                    <SelectInput 
                                        value={form.semester} 
                                        onChange={(val) => setDirect('semester', val)}
                                        options={SEMESTER_OPTIONS}
                                    />
                                </FormField>
                            </div>
                        </div>
                    )}

                    {isTeacher && (
                        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div>
                                    <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">2. Faculty Department Context</h2>
                                    <p className="text-xs text-slate-500 font-semibold">Assign faculty to their teaching branch and department.</p>
                                </div>
                            </div>

                            <div className="max-w-md">
                                <FormField label="Department / Branch" icon={Briefcase} required>
                                    <SelectInput 
                                        value={form.department} 
                                        onChange={(val) => {
                                            setDirect('department', val);
                                            setDirect('studentBranch', val);
                                        }}
                                        options={FACULTY_DEPT_OPTIONS}
                                    />
                                </FormField>
                            </div>
                        </div>
                    )}

                    {/* Card 3: Quick Password Reset (For Edit Mode Only) */}
                    {isEditMode && (
                        <div className="bg-amber-50/70 border-2 border-amber-200 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
                                    <KeyRound size={18} className="text-amber-700" />
                                    <span>One-Click Default Password Reset</span>
                                </div>
                                <p className="text-xs text-amber-800 font-medium">
                                    Instantly reset password to default format <code className="font-bold bg-amber-100 px-2 py-0.5 rounded text-amber-950 font-mono">{form.username || 'user'}@kk</code>.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleQuickPasswordReset}
                                disabled={resettingPw}
                                className="px-5 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                            >
                                {resettingPw ? 'Resetting...' : 'Reset to Default'}
                            </button>
                        </div>
                    )}

                    {/* ── Bottom Pinned Action Bar ── */}
                    <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-xs text-slate-500 font-semibold">
                            {isEditMode ? 'Save your changes to update user directory records immediately.' : 'Provisioning creates the credentials and allows user to login instantly.'}
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={() => navigate(returnUrl)}
                                className="flex-1 sm:flex-none px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider border-2 border-slate-200 transition-all cursor-pointer active:scale-95 shadow-xs"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm border-2 border-[#ea580c] cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <RefreshCw className="animate-spin text-amber-300" size={16} />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} />
                                        <span>{isEditMode ? 'Save Changes' : `Provision ${activeConfig.label}`}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                </form>
            </div>
        </DashboardLayout>
    );
}
