import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
    User, Mail, Calendar, BookOpen, Grid, BookMarked,
    Shield, Clock, KeyRound, Ban, Edit3, CheckCircle2,
    ArrowLeft, AlertTriangle, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { showConfirm } from '../utils/alerts';

function StatusBadge({ suspended, online }) {
    if (suspended) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-700 border-2 border-rose-300">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                Suspended
            </span>
        );
    }
    if (online) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border-2 border-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                Live Online
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-600 border-2 border-slate-300">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Offline
        </span>
    );
}

export default function AdminStudentProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [student, setStudent] = useState(location.state?.student || null);
    const [loading, setLoading] = useState(!location.state?.student);
    const [togglingSuspend, setTogglingSuspend] = useState(false);

    useEffect(() => {
        if (!student && id) {
            fetchStudent();
        }
    }, [id]);

    const fetchStudent = async () => {
        setLoading(true);
        try {
            // First try user detail endpoint
            const res = await api.get(`/admin/users/${id}`);
            if (res.data?.user) {
                setStudent(res.data.user);
            }
        } catch {
            // Fallback: search in student list
            try {
                const res = await api.get('/admin/students', { params: { search: id, limit: 1 } });
                const found = (res.data?.students || []).find(s => s.id === id || s.username === id);
                if (found) setStudent(found);
                else toast.error('Student profile record not found');
            } catch {
                toast.error('Failed to load student profile');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSuspend = async () => {
        if (!student) return;
        const willSuspend = !student.isSuspended;
        const confirmRes = await showConfirm(
            willSuspend ? 'Suspend Student Account?' : 'Reinstate Student Account?',
            willSuspend 
                ? `Are you sure you want to suspend ${student.name || student.username}? They will be blocked from taking quizzes.`
                : `Reinstate student account for ${student.name || student.username}?`,
            willSuspend ? 'Yes, Suspend' : 'Yes, Reinstate'
        );
        if (!confirmRes || !confirmRes.isConfirmed) return;

        setTogglingSuspend(true);
        try {
            await api.patch(`/admin/users/${student.id}/suspend`);
            setStudent(prev => ({ ...prev, isSuspended: !prev.isSuspended }));
            toast.success(willSuspend ? 'Student account suspended' : 'Student account reinstated');
        } catch {
            toast.error('Failed to update suspension status');
        } finally {
            setTogglingSuspend(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout role="admin">
                <div className="py-24 flex flex-col items-center justify-center gap-4 text-center">
                    <RefreshCw className="animate-spin text-[#ea580c]" size={36} />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Loading student profile record...
                    </p>
                </div>
            </DashboardLayout>
        );
    }

    if (!student) {
        return (
            <DashboardLayout role="admin">
                <div className="max-w-xl mx-auto py-16 text-center space-y-4">
                    <AlertTriangle size={48} className="mx-auto text-amber-500" />
                    <h2 className="text-2xl font-black text-slate-900">Student Record Not Found</h2>
                    <p className="text-sm text-slate-500">The requested student ID could not be located in the directory.</p>
                    <button
                        onClick={() => navigate('/admin-dashboard?tab=students')}
                        className="px-6 py-3 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-wider"
                    >
                        Back to Students Directory
                    </button>
                </div>
            </DashboardLayout>
        );
    }

    const initials = student.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || student.username?.slice(0, 2).toUpperCase() || 'ST';

    return (
        <DashboardLayout role="admin">
            <div className="space-y-6 max-w-5xl mx-auto pb-24">
                
                {/* Breadcrumbs */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <nav className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <Link to="/admin-dashboard" className="hover:text-slate-900 transition-colors">
                            Admin Center
                        </Link>
                        <span>/</span>
                        <Link to="/admin-dashboard?tab=students" className="hover:text-slate-900 transition-colors">
                            Students Directory
                        </Link>
                        <span>/</span>
                        <span className="text-slate-900 font-black">{student.name || student.username}</span>
                    </nav>

                    <button
                        onClick={() => navigate('/admin-dashboard?tab=students')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider border-2 border-slate-200 transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                        <ArrowLeft size={14} /> Back to Directory
                    </button>
                </div>

                {/* Profile Identity Hero Card */}
                <div className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                    {/* Header gradient banner */}
                    <div className="h-36 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 relative p-6 flex items-start justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-sky-400 bg-sky-950/80 px-3 py-1 rounded-lg border border-sky-800">
                            Verified Student Record
                        </span>
                        <StatusBadge suspended={student.isSuspended} online={student.isOnline} />
                    </div>

                    <div className="px-6 sm:px-8 pb-8 pt-0 relative">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 mb-6">
                            <div className="w-24 h-24 rounded-3xl bg-sky-600 border-4 border-white text-white font-black text-3xl flex items-center justify-center shadow-lg">
                                {initials}
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    onClick={() => navigate(`/admin/users/${student.id}/edit`, { state: { user: student, defaultRole: 'student' } })}
                                    className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm border-2 border-[#ea580c] cursor-pointer active:scale-95"
                                >
                                    <Edit3 size={15} /> Edit Student Details
                                </button>
                                <button
                                    onClick={handleToggleSuspend}
                                    disabled={togglingSuspend}
                                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider border-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${student.isSuspended ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'}`}
                                >
                                    <Ban size={15} /> {student.isSuspended ? 'Reactivate Account' : 'Suspend Account'}
                                </button>
                            </div>
                        </div>

                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">
                                {student.name || student.username}
                            </h1>
                            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 mt-1">
                                <span className="text-sky-700 font-mono">Roll No: {student.username}</span>
                                <span>•</span>
                                <span>{student.email || 'No email registered'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Academic Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                            Branch / Department
                        </span>
                        <p className="text-lg font-black text-slate-900">
                            {student.studentBranch || 'CSE'}
                        </p>
                    </div>

                    <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                            Academic Year
                        </span>
                        <p className="text-lg font-black text-slate-900">
                            Year {student.year || '1'}
                        </p>
                    </div>

                    <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                            Current Semester
                        </span>
                        <p className="text-lg font-black text-slate-900">
                            Semester {student.semester || '1'}
                        </p>
                    </div>

                    <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                            Class Section
                        </span>
                        <p className="text-lg font-black text-slate-900">
                            Section {student.section || 'A'}
                        </p>
                    </div>
                </div>

                {/* Additional Record & Credentials Details */}
                <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3">
                        Authentication & Enrollment Information
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-200 flex items-center justify-between">
                            <span className="font-bold text-slate-600">Standard Default Password:</span>
                            <code className="font-mono text-sky-900 font-black bg-sky-100 px-2.5 py-1 rounded-lg border border-sky-300">
                                {student.username}@kk
                            </code>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                            <span className="font-bold text-slate-600">Account Enrolled Date:</span>
                            <span className="font-black text-slate-900">
                                {student.createdAt ? new Date(student.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Verified Record'}
                            </span>
                        </div>
                    </div>
                </div>

            </div>
        </DashboardLayout>
    );
}
