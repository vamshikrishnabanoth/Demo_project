import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import {
    Shield, Search, Edit3, Trash2, Ban, RefreshCw, Plus, X as XIcon, Crown, Lock, Mail, Clock, ChevronDown
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import AuthContext from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import DashboardLayout from '../components/DashboardLayout';
import UserModal from '../components/admin/UserModal';
import { showConfirm, showSuccess } from '../utils/alerts';

function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-slate-200/80 rounded-xl ${className}`} />;
}

function CustomSelect({ value, onChange, options, placeholder = 'Select', ariaLabel }) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    const selectedOption = options.find(option => option.value === value) || { value: '', label: placeholder };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            setIsOpen(false);
            return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const currentIndex = options.findIndex(option => option.value === value);
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            const nextIndex = (currentIndex + direction + options.length) % options.length;
            onChange(options[nextIndex].value);
            setIsOpen(true);
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsOpen(prev => !prev);
        }
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                onClick={() => setIsOpen(prev => !prev)}
                onKeyDown={handleKeyDown}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-left text-[11px] font-black uppercase tracking-wider text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-all duration-200 hover:border-slate-400 hover:shadow-[0_8px_18px_rgba(15,23,42,0.04)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
                <span className="truncate">{selectedOption.label}</span>
                <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-[0_18px_36px_rgba(15,23,42,0.08)] ring-1 ring-slate-100">
                    <ul role="listbox" aria-label={ariaLabel} className="py-1.5">
                        {options.map((option) => {
                            const isSelected = option.value === value;
                            return (
                                <li key={option.value || 'empty'} className="px-1.5">
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider transition-all duration-200 ${
                                            isSelected ? 'bg-[#ea580c] text-white' : 'text-slate-700 hover:bg-orange-50 hover:text-[#c2410c]'
                                        }`}
                                    >
                                        <span>{option.label}</span>
                                        {isSelected && (
                                            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                                                <path d="M5 10.5L8.2 13.7L15 6.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}

function StatusBadge({ suspended, online }) {
    if (suspended)
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Suspended</span>;
    if (online)
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Online</span>;
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Offline</span>;
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
    const { invalidate } = useAdmin();

    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState(null);

    const [search, setSearch] = useState('');
    const [debSearch, setDebSearch] = useState('');
    const [statusF, setStatusF] = useState('');

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
            toast.error('Failed to load system administrators');
        } finally { setLoading(false); }
    }, [debSearch, statusF]);

    useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

    const handleDelete = async (a) => {
        if (a.id === currentUser?.id) { toast.error('You cannot delete your own account.'); return; }
        const r = await showConfirm('Delete Admin?', `Permanently delete admin ${a.name || a.username}?`, 'Delete');
        if (r.isConfirmed) {
            try {
                await api.delete(`/admin/users/${a.id}`);
                setAdmins(prev => prev.filter(x => x.id !== a.id));
                invalidate();
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
                invalidate();
                showSuccess('Updated', `Admin ${a.isSuspended ? 'reinstated' : 'suspended'}.`);
            } catch { toast.error('Action failed'); }
        }
    };

    const handleSave = () => {
        fetchAdmins();
        invalidate();
        setModal(null);
    };

    const hasFilters = debSearch || statusF;

    return (
        <DashboardLayout role="admin">
            <div className="space-y-6 pb-20 max-w-[100rem] mx-auto">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-200/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-violet-100 border border-violet-200 text-violet-700"><Shield size={24} /></div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">System Administrators</h1>
                            <p className="text-slate-500 text-xs font-medium mt-0.5">{admins.length} Super Administrator Accounts</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={fetchAdmins} className="admin-cta bg-white text-slate-700 hover:bg-slate-50">
                            <RefreshCw size={15} />
                        </button>
                        <button onClick={() => setModal({ isNew: true })} className="admin-cta bg-[#ea580c] text-white border-[#ea580c] hover:bg-[#c2410c]">
                            <Plus size={15} /> New Admin
                        </button>
                    </div>
                </motion.div>

                {/* Filters */}
                <div className="admin-toolbar">
                    <div className="flex-1 min-w-56 relative">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search admins by name or email..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-all" />
                    </div>
                    <CustomSelect
                        value={statusF}
                        onChange={(value) => setStatusF(value)}
                        ariaLabel="Filter administrators by status"
                        placeholder="All Status"
                        options={[{ value: '', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]}
                    />
                    {hasFilters && (
                        <button onClick={() => { setSearch(''); setStatusF(''); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs cursor-pointer hover:bg-rose-100">
                            <XIcon size={13} /> Clear
                        </button>
                    )}
                </div>

                {/* Security Warning */}
                <div className="flex items-start gap-3 p-4 rounded-[18px] bg-amber-50 border border-amber-200">
                    <Lock size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 font-semibold leading-relaxed">
                        Admin accounts have full system permissions. Only create admin accounts for trusted users. You cannot delete your own active account.
                    </p>
                </div>

                {/* Admin Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52" />)
                    ) : admins.length === 0 ? (
                        <div className="col-span-full py-16 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">No admin accounts found</div>
                    ) : (
                        admins.map(a => {
                            const isSelf = a.id === currentUser?.id;
                            return (
                                <div key={a.id} className={`relative rounded-[18px] bg-white border p-5 flex flex-col gap-4 group transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] ${isSelf ? 'border-violet-300 shadow-[0_4px_20px_rgba(124,58,237,0.10)]' : 'border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)]'}`}>
                                    {isSelf && (
                                        <div className="absolute top-4 right-4">
                                            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">You</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-xs">
                                            <Crown size={20} className="text-white" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">{a.name || a.username}</p>
                                            <p className="text-[11px] text-slate-500 font-medium">@{a.username}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 text-xs text-slate-600 font-medium">
                                        {a.email && <div className="flex items-center gap-2 truncate"><Mail size={12} className="text-slate-400" />{a.email}</div>}
                                        <div className="flex items-center gap-2">
                                            <Clock size={12} className="text-slate-400" />
                                            <span>Last login: <span className="text-violet-700 font-bold">{timeAgo(a.lastLogin)}</span></span>
                                        </div>
                                    </div>
                                    <div><StatusBadge suspended={a.isSuspended} online={a.isOnline} /></div>
                                    {!isSelf && (
                                        <div className="flex items-center gap-2 pt-3 border-t border-slate-200/80">
                                            <button onClick={() => setModal({ isNew: false, user: a })} className="flex-1 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-300 hover:bg-indigo-200 hover:border-indigo-400 text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1">
                                                <Edit3 size={12} className="text-indigo-700" /> Edit
                                            </button>
                                            <button onClick={() => handleSuspend(a)} className={`flex-1 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1 ${a.isSuspended ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'}`}>
                                                <Ban size={12} /> {a.isSuspended ? 'Reinstate' : 'Suspend'}
                                            </button>
                                            <button onClick={() => handleDelete(a)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 cursor-pointer transition-all flex items-center justify-center">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {modal && <UserModal isNew={modal.isNew !== undefined ? modal.isNew : !modal.user} user={modal.user} defaultRole="admin" onClose={() => setModal(null)} onSave={handleSave} />}
        </DashboardLayout>
    );
}
