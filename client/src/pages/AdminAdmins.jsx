import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    Shield, Search, Edit3, Trash2, Ban, RefreshCw, Plus, X, Crown, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import AuthContext from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import UserModal from '../components/admin/UserModal';
import { showConfirm, showSuccess } from '../utils/alerts';

function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-white/10 rounded-xl ${className}`} />;
}

function StatusBadge({ suspended, online }) {
    if (suspended)
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />Suspended</span>;
    if (online)
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Online</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-white/5 text-white/40 border border-white/10"><span className="w-1.5 h-1.5 rounded-full bg-white/30" />Offline</span>;
}

const timeAgo = (date) => {
    if (!date) return 'Never';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

export default function AdminAdmins() {
    const { user: currentUser } = useContext(AuthContext);
    const [admins,  setAdmins]  = useState([]);
    const [loading, setLoading] = useState(false);
    const [modal,   setModal]   = useState(null);

    const [search,   setSearch]   = useState('');
    const [debSearch, setDebSearch] = useState('');
    const [statusF,  setStatusF]  = useState('');

    useEffect(() => {
        const t = setTimeout(() => setDebSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    const fetchAdmins = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/admins', { params: { search: debSearch, status: statusF } });
            setAdmins(res.data.admins || []);
        } catch {
            try {
                const res2 = await api.get('/admin/users', { params: { role: 'admin', search: debSearch, all: 'true' } });
                setAdmins(Array.isArray(res2.data) ? res2.data : (res2.data.users || []));
            } catch { toast.error('Failed to load admins'); }
        } finally { setLoading(false); }
    }, [debSearch, statusF]);

    useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

    const handleDelete = async (a) => {
        if (a.id === currentUser?.id) { toast.error('You cannot delete your own account.'); return; }
        const r = await showConfirm('Delete Admin?', `Permanently delete admin ${a.name || a.username}? This is irreversible.`, 'Delete');
        if (r.isConfirmed) {
            try {
                await api.delete(`/admin/users/${a.id}`);
                setAdmins(prev => prev.filter(x => x.id !== a.id));
                showSuccess('Deleted', 'Admin account removed.');
            } catch { toast.error('Delete failed'); }
        }
    };

    const handleSuspend = async (a) => {
        if (a.id === currentUser?.id) { toast.error('You cannot suspend yourself.'); return; }
        const action = a.isSuspended ? 'Reinstate' : 'Suspend';
        const r = await showConfirm(`${action} Admin?`, `${action} ${a.name || a.username}?`, action);
        if (r.isConfirmed) {
            try {
                const res = await api.put(`/admin/users/suspend/${a.id}`);
                setAdmins(prev => prev.map(x => x.id === a.id ? { ...x, ...res.data } : x));
                showSuccess('Updated', `Admin ${a.isSuspended ? 'reinstated' : 'suspended'}.`);
            } catch { toast.error('Action failed'); }
        }
    };

    const handleSave = (saved, action) => {
        if (action === 'created') setAdmins(prev => [...prev, saved]);
        else setAdmins(prev => prev.map(x => x.id === saved.id ? saved : x));
        setModal(null);
    };

    const hasFilters = debSearch || statusF;
    const filtered = admins;

    return (
        <DashboardLayout role="admin">
            <div className="space-y-6 pb-20 max-w-[100rem] mx-auto">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/20"><Shield size={24} className="text-violet-400" /></div>
                        <div>
                            <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">System <span className="text-violet-400">Admins</span></h1>
                            <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mt-0.5">{admins.length} Administrator Accounts</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={fetchAdmins} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"><RefreshCw size={15} /></button>
                        <button onClick={() => setModal({ isNew: true })}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-violet-500/20 cursor-pointer active:scale-95">
                            <Plus size={15} /> New Admin
                        </button>
                    </div>
                </motion.div>

                {/* Filters */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                    className="rounded-3xl bg-white/[0.04] border border-white/[0.08] p-5 flex flex-wrap gap-3 items-center">
                    <div className="flex-1 min-w-56 relative">
                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search admins..."
                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 transition-all" />
                    </div>
                    <select value={statusF} onChange={e => setStatusF(e.target.value)}
                        className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-black text-white/70 focus:outline-none cursor-pointer appearance-none">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </select>
                    {hasFilters && (
                        <button onClick={() => { setSearch(''); setStatusF(''); }}
                            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-black text-xs uppercase tracking-wider cursor-pointer hover:bg-rose-500/20 transition-all">
                            <X size={13} /> Clear
                        </button>
                    )}
                </motion.div>

                {/* Warning */}
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                    <Lock size={14} className="text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-400/80 font-bold leading-relaxed">
                        Admin accounts have full system access. Only create admin accounts for trusted users. You cannot suspend or delete your own account.
                    </p>
                </div>

                {/* Admin Cards */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {loading
                        ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52" />)
                        : filtered.length === 0
                            ? <div className="col-span-full py-20 text-center text-white/20 text-xs font-bold uppercase tracking-widest">No admins found</div>
                            : filtered.map(a => {
                                const isSelf = a.id === currentUser?.id;
                                return (
                                    <motion.div key={a.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                        className={`relative rounded-3xl bg-white/[0.04] border p-5 flex flex-col gap-4 group transition-all hover:bg-white/[0.07] ${isSelf ? 'border-violet-500/40 shadow-lg shadow-violet-500/10' : 'border-white/[0.08] hover:border-violet-500/20'}`}>
                                        {isSelf && (
                                            <div className="absolute top-4 right-4">
                                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">You</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg">
                                                <Crown size={20} className="text-white" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-white">{a.name || a.username}</p>
                                                <p className="text-[10px] text-white/30 font-bold">@{a.username}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <p className="text-[11px] text-white/50 truncate">{a.email}</p>
                                            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
                                                Last login: <span className="text-violet-400">{timeAgo(a.lastLogin)}</span>
                                            </p>
                                            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
                                                Joined: <span className="text-white/50">{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}</span>
                                            </p>
                                        </div>
                                        <div className="mt-auto"><StatusBadge suspended={a.isSuspended} online={a.isOnline} /></div>
                                        {!isSelf && (
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pt-2 border-t border-white/[0.06]">
                                                <button onClick={() => setModal({ isNew: false, user: a })}
                                                    className="flex-1 py-2 rounded-xl bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1">
                                                    <Edit3 size={11} /> Edit
                                                </button>
                                                <button onClick={() => handleSuspend(a)}
                                                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1 ${a.isSuspended ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`}>
                                                    <Ban size={11} /> {a.isSuspended ? 'Reinstate' : 'Suspend'}
                                                </button>
                                                <button onClick={() => handleDelete(a)}
                                                    className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 cursor-pointer transition-all flex items-center justify-center">
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })
                    }
                </motion.div>
            </div>

            {modal && (
                <UserModal isNew={modal.isNew} user={modal.user} defaultRole="admin" onClose={() => setModal(null)} onSave={handleSave} />
            )}
        </DashboardLayout>
    );
}
