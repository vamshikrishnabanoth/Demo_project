import React, { useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';
import axios from 'axios';
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
    admin:   { label: 'ADMIN',   color: 'text-red-400',   bg: 'bg-red-400/10',   border: 'border-red-400/30',   icon: ShieldCheck },
    teacher: { label: 'TEACHER', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30', icon: UserCheck },
    student: { label: 'STUDENT', color: 'text-sky-400',   bg: 'bg-sky-400/10',   border: 'border-sky-400/30',   icon: GraduationCap },
    none:    { label: 'NONE',    color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/30', icon: Users },
};

const RoleBadge = ({ role }) => {
    const meta = ROLE_META[role] || ROLE_META.none;
    const Icon = meta.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${meta.color} ${meta.bg} border ${meta.border} shadow-sm`}>
            <Icon size={12} /> {meta.label}
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
    const [roleFilter, setRoleFilter] = useState('all');
    const [modal, setModal] = useState(null);

    // Textbook management states
    const [ingestedDocs, setIngestedDocs] = useState([]);
    const [sourceName, setSourceName] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [ingesting, setIngesting] = useState(false);

    // CSV Roster Import states
    const [csvText, setCsvText] = useState('');
    const [importing, setImporting] = useState(false);

    const fetchStats = useCallback(async () => {
        try { const res = await api.get('/admin/stats'); setStats(res.data); }
        catch (err) { console.error('Stats fetch failed', err); }
    }, []);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try { const res = await api.get('/admin/users'); setUsers(res.data); }
        catch (err) { console.error('Users fetch failed', err); }
        finally { setLoading(false); }
    }, []);

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

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchesSearch = u.username.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
            const matchesRole = roleFilter === 'all' || u.role === roleFilter;
            return matchesSearch && matchesRole;
        });
    }, [users, search, roleFilter]);

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
                const res = await axios.post('http://localhost:8000/admin/ingest', payload);
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
                
                {/* Global Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Total Entities', value: stats.total, icon: Users, color: 'text-white' },
                        { label: 'Active Teachers', value: stats.teachers, icon: UserCheck, color: 'text-amber-400' },
                        { label: 'Active Students', value: stats.students, icon: GraduationCap, color: 'text-sky-400' },
                        { label: 'System Admins', value: stats.admins, icon: Shield, color: 'text-red-400' },
                    ].map((s, i) => (
                        <GlassCard key={i} className="!p-8">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 bg-white/5 rounded-2xl ${s.color}`}>
                                    <s.icon size={24} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Operational</span>
                            </div>
                            <h3 className="text-4xl font-black text-white italic tracking-tighter">{s.value}</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mt-1">{s.label}</p>
                        </GlassCard>
                    ))}
                </div>

                {/* Tab Selector buttons */}
                <div className="flex gap-4 border-b border-white/5 pb-4">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-wider text-xs transition-all ${
                            activeTab === 'users' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'
                        }`}
                    >
                        <Users size={16} /> User Directory
                    </button>
                    <button
                        onClick={() => setActiveTab('knowledge')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-wider text-xs transition-all ${
                            activeTab === 'knowledge' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'
                        }`}
                    >
                        <Database size={16} /> AI Knowledge Hub
                    </button>
                    <button
                        onClick={() => setActiveTab('operations')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-wider text-xs transition-all ${
                            activeTab === 'operations' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'
                        }`}
                    >
                        <Rocket size={16} /> Academic Operations
                    </button>
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
                                <PremiumButton variant="secondary" icon={RefreshCw} onClick={fetchUsers} className="!px-6">Sync</PremiumButton>
                                <PremiumButton variant="primary" icon={Plus} onClick={() => setModal({ isNew: true })}>Provision</PremiumButton>
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
                                            {filteredUsers.map((u) => (
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
                                                            <div className={`w-12 h-12 rounded-2xl ${ROLE_META[u.role]?.bg || 'bg-white/5'} flex items-center justify-center ${ROLE_META[u.role]?.color || 'text-white/20'} border ${ROLE_META[u.role]?.border || 'border-white/10'} shadow-lg group-hover:scale-110 transition-all duration-300`}>
                                                                {React.createElement(ROLE_META[u.role]?.icon || Users, { size: 24 })}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className={`font-bold tracking-tight ${u.isSuspended ? 'text-white/40' : 'text-white'}`}>{u.username}</p>
                                                                    {u.isSuspended && (
                                                                        <span className="text-[8px] bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded font-black uppercase tracking-widest border border-red-500/30">
                                                                            Suspended
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-col gap-0.5">
                                                                    <p className="text-xs text-white/50 font-medium">{u.email}</p>
                                                                    {u.role === 'student' && (u.studentBranch || u.section) && (
                                                                        <p className="text-[10px] text-[var(--text-accent)] font-black uppercase tracking-widest opacity-60">
                                                                            {u.studentBranch || '—'} / {u.section || '—'} {u.year ? `/ YEAR ${u.year}` : ''}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-6 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${u.isOnline ? 'bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-white/10'}`} />
                                                            <span className={`text-[10px] font-black uppercase tracking-widest ${u.isOnline ? 'text-green-500' : 'text-white/40'}`}>
                                                                {u.isOnline ? 'Active' : 'Offline'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-6 px-4 text-center">
                                                        <RoleBadge role={u.role} />
                                                    </td>
                                                    <td className="py-6 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-3">
                                                            <button 
                                                                onClick={() => setModal({ isNew: false, user: u })}
                                                                className="p-3 text-indigo-400 bg-indigo-400/5 hover:bg-indigo-400/10 border border-indigo-400/20 hover:border-indigo-400/40 rounded-xl transition-all shadow-sm active:scale-90"
                                                                title="Edit Entity"
                                                            >
                                                                <Edit3 size={18} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleSuspend(u)}
                                                                disabled={u.id === currentUser?.id}
                                                                className={`p-3 rounded-xl transition-all border shadow-sm active:scale-90 disabled:opacity-30 ${u.isSuspended ? 'text-red-500 bg-red-500/10 border-red-500/30' : 'text-amber-500 bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10 hover:border-amber-500/40'}`}
                                                                title={u.isSuspended ? "Reinstate Access" : "Suspend Access"}
                                                            >
                                                                <Ban size={18} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDelete(u)}
                                                                disabled={u.id === currentUser?.id}
                                                                className="p-3 text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/40 rounded-xl transition-all shadow-sm active:scale-90 disabled:opacity-30"
                                                                title="Purge Identity"
                                                            >
                                                                <Trash2 size={18} />
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
                                {!loading && filteredUsers.length === 0 && (
                                    <div className="py-20 text-center text-white/20 font-black uppercase tracking-widest text-xs">
                                        No entities found in database
                                    </div>
                                )}
                            </div>
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
                                    <div className="p-3 bg-blue-600/10 text-blue-400 rounded-2xl">
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
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold placeholder:text-slate-600 outline-none focus:border-blue-500 transition-all text-sm uppercase"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Select Document File (.pdf, .docx, .pptx, .txt)</label>
                                        <input
                                            type="file"
                                            accept=".pdf,.docx,.pptx,.txt"
                                            required
                                            onChange={(e) => setSelectedFile(e.target.files[0])}
                                            className="w-full text-slate-400 font-bold text-xs uppercase cursor-pointer file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-blue-600/20 file:text-blue-400 file:cursor-pointer hover:file:bg-blue-600/30"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={ingesting || !selectedFile || !sourceName.trim()}
                                        className="w-full mt-4 flex items-center justify-center gap-2 bg-blue-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest disabled:opacity-50 hover:bg-blue-700 transition-all shadow-lg"
                                    >
                                        {ingesting ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                        {ingesting ? 'INGESTING...' : 'INGEST INTO DB'}
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
                                className="w-full mt-6 flex items-center justify-center gap-2 bg-red-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg active:scale-95 border-b-4 border-red-800"
                            >
                                <Rocket size={16} /> Execute Year Level Promotion
                            </button>
                        </GlassCard>

                        {/* CSV Roster batch import */}
                        <GlassCard className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-purple-600/10 text-purple-400 rounded-2xl">
                                    <FileSpreadsheet size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white italic uppercase tracking-wider">Roster Batch CSV Import</h2>
                                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Register student entities in bulk</p>
                                </div>
                            </div>

                            <form onSubmit={handleCsvImportSubmit} className="space-y-4 pt-2">
                                <div>
                                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">CSV Format Template (No Headers, comma separated):</label>
                                    <div className="bg-black/30 p-3 rounded-lg font-mono text-[10px] text-slate-400 select-all">
                                        username,email,password,studentBranch,section,year
                                    </div>
                                </div>

                                <textarea
                                    rows="6"
                                    placeholder="kmit_student1,student1@kmit.in,Password123,CSE,A,1&#10;kmit_student2,student2@kmit.in,Password123,IT,B,1"
                                    value={csvText}
                                    onChange={(e) => setCsvText(e.target.value)}
                                    required
                                    className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-xs placeholder:text-slate-700 outline-none focus:border-purple-500 transition-all"
                                />

                                <button
                                    type="submit"
                                    disabled={importing || !csvText.trim()}
                                    className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest disabled:opacity-50 hover:bg-purple-700 transition-all shadow-lg"
                                >
                                    {importing ? <Loader2 className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
                                    {importing ? 'IMPORTING ROSTER...' : 'BATCH IMPORT STUDENTS'}
                                </button>
                            </form>
                        </GlassCard>
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
