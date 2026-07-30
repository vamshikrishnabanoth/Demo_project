import React, { useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';
import {
    Users, Shield, Ban, Activity, LayoutDashboard,
    Plus, Trash2, Edit3, Search, RefreshCw, UserCheck, 
    GraduationCap, ShieldCheck, Loader2, AlertTriangle, Home,
    Database, Upload, Rocket, FileSpreadsheet, Sparkles, Book
} from 'lucide-react';
import { showSuccess, showConfirm, showError } from '../utils/alerts';
import DashboardLayout from '../components/DashboardLayout';
import { PremiumButton, PremiumInput, GlassCard } from '../components/ui/Primitives';
import UserModal from '../components/admin/UserModal';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const ROLE_META = {
    admin:   { 
        label: 'ADMIN',   
        color: 'text-blue-900',   
        bg: 'bg-blue-100',   
        border: 'border-blue-300',   
        icon: ShieldCheck,
        avatarBg: 'bg-blue-600',
        avatarColor: 'text-white',
        avatarBorder: 'border-blue-700'
    },
    teacher: { 
        label: 'TEACHER', 
        color: 'text-amber-950', 
        bg: 'bg-amber-100', 
        border: 'border-amber-300', 
        icon: UserCheck,
        avatarBg: 'bg-amber-500',
        avatarColor: 'text-white',
        avatarBorder: 'border-amber-600'
    },
    student: { 
        label: 'STUDENT', 
        color: 'text-emerald-950',   
        bg: 'bg-emerald-100',   
        border: 'border-emerald-300',   
        icon: GraduationCap,
        avatarBg: 'bg-emerald-600',
        avatarColor: 'text-white',
        avatarBorder: 'border-emerald-700'
    },
    none:    { 
        label: 'NONE',    
        color: 'text-slate-800', 
        bg: 'bg-slate-200', 
        border: 'border-slate-300', 
        icon: Users,
        avatarBg: 'bg-slate-700',
        avatarColor: 'text-white',
        avatarBorder: 'border-slate-800'
    },
};

const RoleBadge = ({ role }) => {
    const meta = ROLE_META[role] || ROLE_META.none;
    const Icon = meta.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider ${meta.color} ${meta.bg} border-2 ${meta.border} shadow-xs`}>
            <Icon size={14} strokeWidth={2.5} /> {meta.label}
        </span>
    );
};

export default function AdminDashboard() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user: currentUser } = useContext(AuthContext);
    
    // Tab controller: 'users', 'knowledge', 'operations'
    const [activeTab, setActiveTab] = useState('users');

    const [stats, setStats] = useState({ total: 0, teachers: 0, students: 0, admins: 0 });
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [modal, setModal] = useState(null);

    // Pagination states
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 20;

    // Textbook management states
    const [ingestedDocs, setIngestedDocs] = useState([]);
    const [sourceName, setSourceName] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [ingesting, setIngesting] = useState(false);

    // CSV Roster Import states
    const [csvText, setCsvText] = useState('');
    const [importing, setImporting] = useState(false);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // Reset to page 1 on new search query
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchStats = useCallback(async () => {
        try { const res = await api.get('/admin/stats'); setStats(res.data); }
        catch (err) { console.error('Stats fetch failed', err); }
    }, []);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/users', {
                params: {
                    page,
                    limit,
                    search: debouncedSearch,
                    role: roleFilter
                }
            });

            if (res.data && Array.isArray(res.data.users)) {
                setUsers(res.data.users);
                setTotalPages(res.data.totalPages || 1);
                setTotalCount(res.data.totalCount || 0);
            } else if (Array.isArray(res.data)) {
                // Fallback for unpaginated format
                setUsers(res.data);
                setTotalPages(1);
                setTotalCount(res.data.length);
            }
        } catch (err) {
            console.error('Users fetch failed', err);
        } finally {
            setLoading(false);
        }
    }, [page, limit, debouncedSearch, roleFilter]);

    const fetchIngestedDocs = useCallback(async () => {
        try {
            const res = await api.get('/quiz/documents');
            setIngestedDocs(res.data || []);
        } catch (err) {
            console.error('Failed to fetch textbooks:', err.message);
        }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);
    useEffect(() => { fetchUsers(); }, [fetchUsers]);
    useEffect(() => { fetchIngestedDocs(); }, [fetchIngestedDocs]);

    useEffect(() => {
        const handleStatusChange = ({ userId, isOnline }) => {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, isOnline } : u));
        };
        socket.on('user_status_change', handleStatusChange);
        return () => socket.off('user_status_change', handleStatusChange);
    }, []);

    const handleSave = (savedUser, action) => {
        if (action === 'created') setUsers(prev => [savedUser, ...prev]);
        else setUsers(prev => prev.map(u => u.id === savedUser.id ? savedUser : u));
        fetchStats();
        setModal(null);
        showSuccess('System Updated', `User data synchronized successfully.`);
    };

    const handleDelete = async (u) => {
        if (u.id === currentUser?.id) return;
        const result = await showConfirm('Wipe Entity?', `Deleting ${u.username} is permanent. Continue?`, 'Confirm Erasure');
        if (result.isConfirmed) {
            try {
                await api.delete(`/admin/users/${u.id}`);
                setUsers(prev => prev.filter(usr => usr.id !== u.id));
                fetchStats();
                showSuccess('Purged', 'User removed from central database.');
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleSuspend = async (u) => {
        if (u.id === currentUser?.id) return;
        const action = u.isSuspended ? 'Reinstate' : 'Suspend';
        const result = await showConfirm(
            `${action} Access?`, 
            `Are you sure you want to ${action.toLowerCase()} ${u.username}?`, 
            action
        );
        
        if (result.isConfirmed) {
            try {
                const res = await api.put(`/admin/users/suspend/${u.id}`);
                setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, ...res.data } : usr));
                showSuccess('Synchronized', `User ${u.username} ${!u.isSuspended ? 'suspended' : 'reinstated'} successfully.`);
            } catch (err) {
                console.error(err);
            }
        }
    };

    // Promote student year levels
    const handlePromoteSeniors = async () => {
        const result = await showConfirm(
            'Batch Year Promotion?',
            'WARNING: This increases all students\' years by 1. Year 4 seniors will graduate and be deleted from active rosters. This action is irreversible.',
            'Confirm Promotion'
        );

        if (result.isConfirmed) {
            const toastId = toast.loading('Promoting academic years...');
            try {
                const res = await api.post('/admin/promote');
                toast.success(res.data.msg || 'Academic year promotion complete!', { id: toastId });
                fetchUsers();
                fetchStats();
            } catch (err) {
                toast.error(err.response?.data?.msg || 'Promotion failed.', { id: toastId });
            }
        }
    };

    // Parse and submit CSV Student Roster import
    const handleCsvImportSubmit = async (e) => {
        e.preventDefault();
        if (!csvText.trim()) return;

        setImporting(true);
        const lines = csvText.split('\n');
        const students = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            // Skip CSV Header line if present
            if (i === 0 && line.toLowerCase().includes('email')) continue;

            const parts = line.split(',');
            if (parts.length >= 3) {
                students.push({
                    username: parts[0]?.trim(),
                    email: parts[1]?.trim(),
                    password: parts[2]?.trim(),
                    studentBranch: parts[3]?.trim() || null,
                    section: parts[4]?.trim() || null,
                    year: parts[5]?.trim() || '1'
                });
            }
        }

        if (students.length === 0) {
            toast.error('No valid student records found. Check format: username,email,password,...');
            setImporting(false);
            return;
        }

        const toastId = toast.loading(`Importing ${students.length} students...`);
        try {
            const res = await api.post('/admin/import', { students });
            toast.success(`Success! Imported ${res.data.successCount} students. Failures: ${res.data.failureCount}`, { id: toastId });
            setCsvText('');
            fetchUsers();
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Import failed.', { id: toastId });
        } finally {
            setImporting(false);
        }
    };

    // Read file as base64 and ingest textbook
    const handleTextbookIngestSubmit = async (e) => {
        e.preventDefault();
        if (!selectedFile || !sourceName.trim()) return;

        setIngesting(true);
        const toastId = toast.loading(`Ingesting "${sourceName}" into pgvector store...`);

        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const base64Data = reader.result.split(',')[1];
                const fileType = selectedFile.name.split('.').pop().toLowerCase();

                const payload = {
                    source: sourceName,
                    type: fileType,
                    content: `base64:${base64Data}`,
                    metadata: {
                        uploadedBy: currentUser?.username,
                        fileSize: selectedFile.size
                    }
                };

                // Post directly to the local Python AI RAG server
                const res = await api.post('http://localhost:8000/admin/ingest', payload);
                toast.success(res.data.message || `Ingested "${sourceName}" successfully!`, { id: toastId });
                
                setSourceName('');
                setSelectedFile(null);
                // Reset file input element
                e.target.reset();
                fetchIngestedDocs();
            } catch (err) {
                console.error(err);
                const errMsg = err.response?.data?.detail || 'Failed to connect to Python AI Ingestion engine.';
                toast.error(errMsg, { id: toastId });
            } finally {
                setIngesting(false);
            }
        };
        reader.readAsDataURL(selectedFile);
    };

    return (
        <DashboardLayout role="admin">
            <div className="space-y-12 pb-20 max-w-[100rem] mx-auto">
                
                {/* Global Compact Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    {[
                        { label: 'Total Entities', value: stats.total, icon: Users, color: 'text-[var(--text-accent)]', bg: 'bg-[var(--accent-sand)] border border-[var(--border-color)]' },
                        { label: 'Active Teachers', value: stats.teachers, icon: UserCheck, color: 'text-amber-700', bg: 'bg-amber-50 border border-amber-200' },
                        { label: 'Active Students', value: stats.students, icon: GraduationCap, color: 'text-sky-700', bg: 'bg-sky-50 border border-sky-200' },
                        { label: 'System Admins', value: stats.admins, icon: Shield, color: 'text-red-700', bg: 'bg-red-50 border border-red-200' },
                    ].map((s, i) => (
                        <div key={i} className="bg-white border-2 border-[var(--border-color)] p-4 sm:p-5 rounded-2xl shadow-xs hover:shadow-md hover:border-[var(--bg-accent)] transition-all duration-300 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-[#334155]" style={{ color: '#334155' }}>{s.label}</p>
                                <h3 className="text-2xl sm:text-3xl font-black text-[#0f172a] italic tracking-tight mt-0.5" style={{ color: '#0f172a' }}>{s.value}</h3>
                            </div>
                            <div className={`p-2.5 rounded-xl ${s.bg} ${s.color} shrink-0`}>
                                <s.icon size={20} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Tab Selector Buttons with Crisp Borders & Defined Background Colors */}
                <div className="flex gap-3 sm:gap-4 flex-wrap pb-2">
                    {[
                        { id: 'users', label: 'User Directory', icon: Users },
                        { id: 'knowledge', label: 'AI Knowledge Hub', icon: Database },
                        { id: 'operations', label: 'Academic Operations', icon: Rocket },
                    ].map((tab) => {
                        const isActive = activeTab === tab.id;
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-black uppercase tracking-wider text-xs sm:text-sm border-2 transition-all duration-200 cursor-pointer shadow-sm active:scale-95 ${
                                    isActive
                                        ? 'bg-[var(--bg-saffron)] hover:bg-[var(--bg-saffron-hover)] text-white border-[var(--bg-saffron)] shadow-md !text-white text-white-force'
                                        : 'bg-white/90 hover:bg-white text-[#0f172a] hover:text-[var(--text-accent)] border-[var(--border-color)] hover:border-[var(--bg-accent)]'
                                }`}
                                style={isActive ? { backgroundColor: 'var(--bg-accent)', color: '#ffffff', borderColor: 'var(--bg-accent)' } : { backgroundColor: '#ffffff', color: '#0f172a', borderColor: 'var(--border-color)' }}
                            >
                                <Icon size={18} className={isActive ? '!text-white' : 'text-[var(--text-accent)]'} style={isActive ? { color: '#ffffff', stroke: '#ffffff' } : { color: 'var(--text-accent)' }} />
                                <span className={isActive ? '!text-white font-black' : 'font-black text-[#0f172a]'} style={isActive ? { color: '#ffffff' } : { color: '#0f172a' }}>
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Tab: Users */}
                {activeTab === 'users' && (
                    <GlassCard className="!p-0 overflow-visible">
                        <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-[var(--bg-accent)]/10 rounded-2xl">
                                    <Activity size={24} className="text-[var(--text-accent)]" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Command <span className="text-[var(--text-accent)]">Central</span></h2>
                                    <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mt-1">Identity & Clearance Management</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <PremiumButton variant="primary" icon={RefreshCw} onClick={fetchUsers} className="!px-6 !text-white bg-[var(--bg-accent)]">Sync</PremiumButton>
                                <PremiumButton variant="primary" icon={Plus} onClick={() => setModal({ isNew: true })} className="!text-white">Provision</PremiumButton>
                            </div>
                        </div>

                        <div className="p-8 space-y-8">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1">
                                    <PremiumInput 
                                        icon={Search} 
                                        placeholder="SEARCH DATABASE..." 
                                        value={search} 
                                        onChange={e => setSearch(e.target.value)} 
                                    />
                                </div>
                                <div className="md:w-64">
                                    <select 
                                        className="w-full h-[62px] bg-[var(--bg-primary)] border border-white/5 rounded-2xl px-6 text-white font-black text-xs uppercase tracking-widest focus:outline-none focus:border-[var(--bg-accent)]/50 transition-all appearance-none cursor-pointer"
                                        value={roleFilter} 
                                        onChange={e => setRoleFilter(e.target.value)}
                                    >
                                        <option value="all" className="bg-[var(--bg-primary)]">ALL ROLES</option>
                                        <option value="student" className="bg-[var(--bg-primary)]">STUDENTS ONLY</option>
                                        <option value="teacher" className="bg-[var(--bg-primary)]">TEACHERS ONLY</option>
                                        <option value="admin" className="bg-[var(--bg-primary)]">ADMINS ONLY</option>
                                    </select>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr>
                                            <th className="table-header-premium">Identity</th>
                                            <th className="table-header-premium">Status</th>
                                            <th className="table-header-premium text-center">Clearance</th>
                                            <th className="table-header-premium text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        <AnimatePresence>
                                            {users.map((u) => (
                                                <motion.tr 
                                                    key={u.id}
                                                    layout
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="group hover:bg-white/[0.02] transition-colors"
                                                >
                                                    <td className="py-6 px-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 text-[#334155] flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors duration-200">
                                                                {React.createElement(ROLE_META[u.role]?.icon || Users, { size: 18, strokeWidth: 2, className: 'text-[#334155]' })}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className={`font-bold tracking-tight text-sm ${u.isSuspended ? 'text-slate-400 line-through' : 'text-[#0f172a]'}`} style={{ color: u.isSuspended ? '#94a3b8' : '#0f172a' }}>{u.username}</p>
                                                                    {u.isSuspended && (
                                                                        <span className="text-[9px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md font-black uppercase tracking-widest border border-rose-300">
                                                                            Suspended
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-col gap-0.5">
                                                                    <p className="text-xs text-[#334155] font-medium" style={{ color: '#334155' }}>{u.email}</p>
                                                                    {u.role === 'student' && (u.studentBranch || u.section) && (
                                                                        <p className="text-[10px] text-[var(--text-accent)] font-black uppercase tracking-widest">
                                                                            {u.studentBranch || '—'} / {u.section || '—'} {u.year ? `/ YEAR ${u.year}` : ''}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-6 px-4">
                                                        {u.isSuspended ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 shadow-xs">
                                                                <span className="w-2 h-2 rounded-full bg-rose-600" /> Suspended
                                                            </span>
                                                        ) : u.isOnline ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-xs">
                                                                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> Active
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300 shadow-xs">
                                                                <span className="w-2 h-2 rounded-full bg-slate-400" /> Offline
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-6 px-4 text-center">
                                                        <RoleBadge role={u.role} />
                                                    </td>
                                                    <td className="py-6 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-2.5">
                                                            {/* Edit Action Button */}
                                                            <button 
                                                                onClick={() => setModal({ isNew: false, user: u })}
                                                                className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 shadow-xs active:scale-95 cursor-pointer group hover:scale-105"
                                                                style={{
                                                                    color: 'var(--btn-edit)',
                                                                    borderColor: 'var(--btn-edit)',
                                                                    borderWidth: '2px',
                                                                    backgroundColor: 'transparent'
                                                                }}
                                                                title="Edit Entity"
                                                                aria-label="Edit User"
                                                            >
                                                                <Edit3 size={18} strokeWidth={2.25} className="transition-transform group-hover:scale-110" />
                                                            </button>

                                                            {/* Suspend / Reinstate Action Button */}
                                                            <button 
                                                                onClick={() => handleSuspend(u)}
                                                                disabled={u.id === currentUser?.id}
                                                                className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 shadow-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer group hover:scale-105"
                                                                style={{
                                                                    color: u.isSuspended ? '#10b981' : 'var(--btn-suspend)',
                                                                    borderColor: u.isSuspended ? '#10b981' : 'var(--btn-suspend)',
                                                                    borderWidth: '2px',
                                                                    backgroundColor: 'transparent'
                                                                }}
                                                                title={u.isSuspended ? "Reinstate Access" : "Suspend Access"}
                                                                aria-label={u.isSuspended ? "Reinstate Access" : "Suspend Access"}
                                                            >
                                                                <Ban size={18} strokeWidth={2.25} className="transition-transform group-hover:rotate-12 group-hover:scale-110" />
                                                            </button>

                                                            {/* Delete Action Button */}
                                                            <button 
                                                                onClick={() => handleDelete(u)}
                                                                disabled={u.id === currentUser?.id}
                                                                className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 shadow-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer group hover:scale-105"
                                                                style={{
                                                                    color: 'var(--btn-delete)',
                                                                    borderColor: 'var(--btn-delete)',
                                                                    borderWidth: '2px',
                                                                    backgroundColor: 'transparent'
                                                                }}
                                                                title="Purge Identity"
                                                                aria-label="Delete User"
                                                            >
                                                                <Trash2 size={18} strokeWidth={2.25} className="transition-transform group-hover:scale-110" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                    </tbody>
                                </table>

                                {loading && (
                                    <div className="py-20 flex flex-col items-center justify-center gap-4 text-white/20">
                                        <Loader2 className="animate-spin" size={40} />
                                        <span className="text-xs font-black uppercase tracking-[0.3em]">Downloading Identities...</span>
                                    </div>
                                )}
                                {!loading && users.length === 0 && (
                                    <div className="py-20 text-center text-white/20 font-black uppercase tracking-widest text-xs">
                                        No entities found in database
                                    </div>
                                )}
                            </div>

                            {/* Pagination Controls Footer */}
                            {!loading && totalPages > 0 && (
                                <div className="flex items-center justify-between border-t border-white/5 pt-6 px-4 flex-wrap gap-4">
                                    <p className="text-xs text-[#334155] font-black uppercase tracking-wider" style={{ color: '#334155' }}>
                                        Showing Page <span className="text-[var(--text-accent)]">{page}</span> of <span className="text-[var(--text-accent)]">{totalPages}</span> ({totalCount} Total Entities)
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page <= 1}
                                            className="px-5 py-2.5 rounded-xl bg-white/10 text-white font-black text-xs uppercase tracking-wider border border-white/10 hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            &larr; Previous
                                        </button>
                                        <span className="px-4 py-2 bg-[var(--bg-accent)] text-white text-xs font-black rounded-xl">
                                            {page} / {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={page >= totalPages}
                                            className="px-5 py-2.5 rounded-xl bg-white/10 text-white font-black text-xs uppercase tracking-wider border border-white/10 hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            Next &rarr;
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </GlassCard>
                )}

                {/* Tab: AI Knowledge Hub */}
                {activeTab === 'knowledge' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Ingestion Panel */}
                        <div className="lg:col-span-1">
                            <GlassCard className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-[var(--bg-accent)]/10 text-[var(--text-accent)] rounded-2xl">
                                        <Upload size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-white italic uppercase tracking-wider">Ingest textbook</h2>
                                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Feed the pgvector RAG store</p>
                                    </div>
                                </div>

                                <form onSubmit={handleTextbookIngestSubmit} className="space-y-4 pt-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Knowledge Source ID / Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. OS_Chapter_3_Syllabus"
                                            value={sourceName}
                                            onChange={(e) => setSourceName(e.target.value)}
                                            required
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold placeholder:text-slate-600 outline-none focus:border-[var(--bg-accent)] transition-all text-sm uppercase"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Select Document File (.pdf, .docx, .pptx, .txt)</label>
                                        <input
                                            type="file"
                                            accept=".pdf,.docx,.pptx,.txt"
                                            required
                                            onChange={(e) => setSelectedFile(e.target.files[0])}
                                            className="w-full text-slate-400 font-bold text-xs uppercase cursor-pointer file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-[var(--bg-accent)]/20 file:text-[var(--text-accent)] file:cursor-pointer hover:file:bg-[var(--bg-accent)]/30"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={ingesting || !selectedFile || !sourceName.trim()}
                                        className="w-full mt-4 flex items-center justify-center gap-2 bg-[var(--bg-saffron)] hover:bg-[var(--bg-saffron-hover)] disabled:cursor-not-allowed !text-white text-white-force font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg cursor-pointer opacity-100"
                                    >
                                        {ingesting ? (
                                            <Loader2 className="animate-spin !text-white" size={18} style={{ color: '#ffffff' }} />
                                        ) : (
                                            <Sparkles size={18} className="!text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                                        )}
                                        <span className="!text-white font-black uppercase tracking-widest" style={{ color: '#ffffff' }}>
                                            {ingesting ? 'INGESTING...' : 'INGEST INTO DB'}
                                        </span>
                                    </button>
                                </form>
                            </GlassCard>
                        </div>

                        {/* Ingested Documents List */}
                        <div className="lg:col-span-2">
                            <GlassCard className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-2xl">
                                        <Database size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-white italic uppercase tracking-wider">AI syllabus library</h2>
                                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Available materials for RAG</p>
                                    </div>
                                </div>

                                {ingestedDocs.length === 0 ? (
                                    <div className="py-20 text-center text-white/20 font-black uppercase tracking-widest text-xs">
                                        No materials have been ingested yet
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {ingestedDocs.map((doc, idx) => (
                                            <div key={idx} className="p-5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                                                <div className="flex items-center gap-4 overflow-hidden">
                                                    <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl">
                                                        <Book size={20} />
                                                    </div>
                                                    <span className="font-bold text-sm text-white uppercase truncate">{doc}</span>
                                                </div>
                                                <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded border border-emerald-400/30">Vectorized</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </GlassCard>
                        </div>
                    </div>
                )}

                {/* Tab: Academic Operations */}
                {activeTab === 'operations' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Year level promotion */}
                        <GlassCard className="space-y-6 flex flex-col justify-between">
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-red-600/10 text-red-400 rounded-2xl">
                                        <Rocket size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-white italic uppercase tracking-wider">Academic Year level promotion</h2>
                                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">End of semester student upgrade</p>
                                    </div>
                                </div>

                                <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider leading-relaxed">
                                    ⚠ CRITICAL WARNING: Promoting student year levels will increase all student entities' year field values by 1 (e.g. Year 1 ➔ Year 2). Year 4 graduating seniors will be permanently wiped out from the active system database. Please ensure you have backup copies of academic profiles.
                                </div>
                            </div>

                            <button
                                onClick={handlePromoteSeniors}
                                className="w-full mt-6 flex items-center justify-center gap-2.5 bg-red-600 hover:bg-red-700 hover:scale-[1.01] hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95 !text-white text-white-force font-black py-4 px-6 rounded-2xl text-xs sm:text-sm uppercase tracking-widest transition-all duration-200 shadow-md hover:shadow-xl hover:shadow-red-600/40 border-b-4 border-red-800 hover:border-red-900 cursor-pointer group"
                                style={{ color: '#ffffff' }}
                            >
                                <Rocket size={18} className="!text-white group-hover:scale-115 group-hover:-rotate-12 transition-transform duration-200" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                                <span className="!text-white font-black uppercase tracking-widest" style={{ color: '#ffffff' }}>
                                    EXECUTE YEAR LEVEL PROMOTION
                                </span>
                            </button>
                        </GlassCard>

                        {/* CSV Roster batch import — Vibrant Purple Theme Container */}
                        <div className="bg-gradient-to-br from-white via-purple-50/30 to-purple-100/40 border-2 border-purple-300 rounded-[2.5rem] p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3.5 bg-purple-100 border border-purple-300 text-purple-700 rounded-2xl shadow-xs">
                                        <FileSpreadsheet size={24} className="text-purple-700" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-[#0f172a] italic uppercase tracking-wider" style={{ color: '#0f172a' }}>
                                            Roster Batch CSV Import
                                        </h2>
                                        <p className="text-purple-700 text-[10px] font-black uppercase tracking-widest mt-0.5" style={{ color: '#7c3aed' }}>
                                            Register student entities in bulk
                                        </p>
                                    </div>
                                </div>

                                <form onSubmit={handleCsvImportSubmit} className="space-y-4 pt-1">
                                    <div>
                                        <label className="block text-[10px] font-black text-[#334155] uppercase tracking-widest mb-1.5" style={{ color: '#334155' }}>
                                            CSV Format Template (No Headers, comma separated):
                                        </label>
                                        <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-xl font-mono text-xs text-purple-900 font-bold select-all shadow-xs">
                                            username,email,password,studentBranch,section,year
                                        </div>
                                    </div>

                                    <textarea
                                        rows="6"
                                        placeholder="kmit_student1,student1@kmit.in,Password123,CSE,A,1&#10;kmit_student2,student2@kmit.in,Password123,IT,B,1"
                                        value={csvText}
                                        onChange={(e) => setCsvText(e.target.value)}
                                        required
                                        className="w-full p-4 bg-white border-2 border-purple-200 focus:border-purple-600 focus:ring-4 focus:ring-purple-100 rounded-2xl text-purple-950 font-mono text-xs font-bold placeholder:text-purple-300 outline-none transition-all shadow-inner leading-relaxed"
                                        style={{ color: '#2e1065' }}
                                    />

                                    <button
                                        type="submit"
                                        disabled={importing || !csvText.trim()}
                                        className="w-full flex items-center justify-center gap-2.5 bg-purple-600 hover:bg-purple-700 hover:scale-[1.01] hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 !text-white text-white-force font-black py-4 px-6 rounded-2xl text-xs sm:text-sm uppercase tracking-widest transition-all duration-200 shadow-md hover:shadow-xl hover:shadow-purple-600/40 border-b-4 border-purple-900 hover:border-purple-950 cursor-pointer group"
                                        style={{ color: '#ffffff' }}
                                    >
                                        {importing ? (
                                            <Loader2 className="animate-spin !text-white" size={18} style={{ color: '#ffffff' }} />
                                        ) : (
                                            <FileSpreadsheet size={18} className="!text-white group-hover:scale-115 group-hover:rotate-6 transition-transform duration-200" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                                        )}
                                        <span className="!text-white font-black uppercase tracking-widest" style={{ color: '#ffffff' }}>
                                            {importing ? 'IMPORTING ROSTER...' : 'BATCH IMPORT STUDENTS'}
                                        </span>
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {modal && (
                    <UserModal 
                        isNew={modal.isNew} 
                        user={modal.user} 
                        onClose={() => setModal(null)} 
                        onSave={handleSave} 
                    />
                )}
            </div>
        </DashboardLayout>
    );
}
