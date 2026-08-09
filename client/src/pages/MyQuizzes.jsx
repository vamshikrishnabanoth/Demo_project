import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { showConfirm, showError } from '../utils/alerts';
import toast from 'react-hot-toast';
import { cleanQuizTitle } from '../utils/cleanTitle';
import {
    FileText,
    CheckCircle,
    Check,
    Clock,
    Trash2,
    AlertCircle,
    XCircle,
    Activity,
    ExternalLink,
    Trophy,
    Search,
    Calendar,
    HelpCircle,
    Play,
    Users,
    Megaphone,
    CalendarRange,
    Lock,
    Copy
} from 'lucide-react';
import EmptyState from '../components/EmptyState';
import ScheduleEditModal from '../components/quiz/ScheduleEditModal';

import { useApiQuery } from '../hooks/useApiQuery';

export default function MyQuizzes() {
    const { data: quizzesData, loading, refetch } = useApiQuery('/quiz/my-quizzes');
    const quizzes = quizzesData || [];

    const [activeMainTab, setActiveMainTab] = useState('quizzes'); // 'quizzes' or 'saved'
    const [savedTemplates, setSavedTemplates] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedQuizIds, setSelectedQuizIds] = useState([]);
    const [editingScheduleId, setEditingScheduleId] = useState(null);

    // Section Broadcast Modal state
    const [broadcastModal, setBroadcastModal] = useState({
        isOpen: false,
        template: null,
        branch: 'CSE',
        year: '3',
        semester: '1',
        section: 'A'
    });

    // Filters state
    const [filterType, setFilterType] = useState('All');
    const [filterYear, setFilterYear] = useState('All');
    const [filterBranch, setFilterBranch] = useState('All');
    const [filterSection, setFilterSection] = useState('All');

    const fetchQuizzes = () => refetch();

    const fetchSavedTemplates = async () => {
        try {
            const res = await api.get('/quiz/templates');
            setSavedTemplates(res.data || []);
        } catch (err) {
            console.error('Error fetching templates:', err);
        }
    };

    useEffect(() => {
        fetchSavedTemplates();
    }, []);

    const handleCloneAndBroadcast = async () => {
        if (!broadcastModal.template) return;
        const toastId = toast.loading(`Launching live session for ${broadcastModal.branch} Sec ${broadcastModal.section}...`);
        try {
            const targetGroup = [{
                branch: broadcastModal.branch,
                year: broadcastModal.year,
                semester: broadcastModal.semester,
                section: broadcastModal.section
            }];
            const res = await api.post(`/quiz/templates/${broadcastModal.template.id}/instantiate`, {
                title: `${broadcastModal.template.title} (${broadcastModal.branch}-${broadcastModal.section})`,
                assignedGroups: targetGroup
            });
            toast.success(`Live quiz session active! PIN: ${res.data.joinCode}`, { id: toastId });
            setBroadcastModal({ isOpen: false, template: null, branch: 'CSE', year: '3', semester: '1', section: 'A' });
            refetch();
            setActiveMainTab('quizzes');
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Failed to launch live quiz.', { id: toastId });
        }
    };

    const handleDeleteTemplate = async (templateId, title) => {
        const result = await showConfirm(
            'Delete Saved Template?',
            `"${title}" will be permanently removed from your Saved Quizzes repository.`,
            'Yes, Delete'
        );
        if (!result.isConfirmed) return;
        try {
            await api.delete(`/quiz/${templateId}`);
            setSavedTemplates(prev => prev.filter(t => t.id !== templateId));
            toast.success('Saved template deleted');
        } catch (err) {
            toast.error('Failed to delete template');
        }
    };

    const updateQuizMode = async (quizId, mode) => {
        try {
            let payload = {};
            if (mode === 'assessment') payload = { isActive: true,  isLive: false };
            else if (mode === 'live')  payload = { isActive: true,  isLive: true  };
            else if (mode === 'close') payload = { isActive: false };

            const res = await api.put(`/quiz/${quizId}`, payload);
            setQuizzes(quizzes.map(q => q.id === quizId ? res.data : q));
        } catch (err) {
            console.error('Error updating quiz mode', err);
            showError('Update Failed', err.response?.data?.msg || 'Could not update quiz mode.');
        }
    };

    const toggleQuizSelection = (quizId) => {
        setSelectedQuizIds(prev => 
            prev.includes(quizId) ? prev.filter(id => id !== quizId) : [...prev, quizId]
        );
    };

    const toggleSelectAll = () => {
        if (selectedQuizIds.length === filteredQuizzes.length) {
            setSelectedQuizIds([]);
        } else {
            setSelectedQuizIds(filteredQuizzes.map(q => q.id));
        }
    };

    const handleDelete = async (quizId, quizTitle) => {
        const result = await showConfirm(
            'Delete Quiz?',
            `"${quizTitle}" and all its results will be permanently removed.`,
            'Yes, Delete'
        );
        if (!result.isConfirmed) return;

        try {
            await api.delete(`/quiz/${quizId}`);
            setQuizzes(quizzes.filter(q => q.id !== quizId));
            setSelectedQuizIds(prev => prev.filter(id => id !== quizId));
            toast.success('Quiz deleted successfully');
        } catch (err) {
            console.error('Error deleting quiz', err);
            const errorMsg = err.response?.data?.msg || err.response?.data?.message || 'Could not delete this quiz. Please try again.';
            showError('Delete Failed', errorMsg);
        }
    };

    const handleBulkDelete = async () => {
        const count = selectedQuizIds.length;
        const result = await showConfirm(
            'Delete Selected Quizzes?',
            `Are you sure you want to permanently delete these ${count} quizzes and all their results?`,
            'Yes, Delete All'
        );
        if (!result.isConfirmed) return;

        const toastId = toast.loading(`Deleting ${count} quizzes...`);
        try {
            await Promise.all(selectedQuizIds.map(id => api.delete(`/quiz/${id}`)));
            setQuizzes(prev => prev.filter(q => !selectedQuizIds.includes(q.id)));
            setSelectedQuizIds([]);
            toast.success('Selected quizzes deleted successfully', { id: toastId });
        } catch (err) {
            console.error('Error in bulk delete', err);
            const errorMsg = err.response?.data?.msg || err.response?.data?.message || 'Failed to delete some quizzes. Please try again.';
            toast.error(errorMsg, { id: toastId });
        }
    };

    const filteredQuizzes = quizzes.filter(quiz => {
        const matchesSearch = quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            quiz.topic?.toLowerCase().includes(searchTerm.toLowerCase());
            
        let matchesType = true;
        if (filterType === 'Live') matchesType = quiz.isLive && quiz.isActive;
        else if (filterType === 'Assessment') matchesType = !quiz.isLive && quiz.isAssessment && quiz.isActive;
        else if (filterType === 'Closed') matchesType = !quiz.isActive;
        
        let matchesYear = true;
        let matchesBranch = true;
        let matchesSection = true;
        
        if (quiz.assignedGroups) {
            try {
                const groups = typeof quiz.assignedGroups === 'string' ? JSON.parse(quiz.assignedGroups) : quiz.assignedGroups;
                if (filterYear !== 'All' && groups.year && groups.year !== filterYear) matchesYear = false;
                if (filterBranch !== 'All' && groups.branch && groups.branch !== filterBranch) matchesBranch = false;
                if (filterSection !== 'All' && groups.section && groups.section !== filterSection) matchesSection = false;
            } catch (e) {
                if (filterYear !== 'All' || filterBranch !== 'All' || filterSection !== 'All') {
                    matchesYear = false;
                }
            }
        } else if (filterYear !== 'All' || filterBranch !== 'All' || filterSection !== 'All') {
            matchesYear = false;
        }
        
        return matchesSearch && matchesType && matchesYear && matchesBranch && matchesSection;
    });

    return (
        <DashboardLayout role="teacher">
            <div className="space-y-12 pb-20 relative">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--bg-accent)]/5 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse"></div>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-hero-fluid font-black text-[var(--text-primary)] italic tracking-tight">Quiz <span className="text-[var(--text-accent)]">Library</span></h1>
                        <p className="text-[var(--text-secondary)] font-bold mt-2 text-xs sm:text-sm text-balance">Manage your knowledge assets and saved templates</p>
                    </div>

                    <div className="relative w-full md:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--text-accent)] transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Search library..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-[var(--border-color)] rounded-2xl py-4 pl-12 pr-6 text-[var(--text-primary)] font-black italic placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--bg-accent)]/20 focus:border-[var(--bg-accent)] transition-all tracking-tight"
                        />
                    </div>
                </div>

                {/* Main Tabs Navigation */}
                <div className="flex gap-4 border-b border-[var(--border-color)] pb-2">
                    <button
                        onClick={() => setActiveMainTab('quizzes')}
                        className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer ${
                            activeMainTab === 'quizzes'
                                ? 'bg-[var(--bg-accent)] text-white shadow-lg'
                                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                        }`}
                    >
                        Active &amp; Created Sessions ({filteredQuizzes.length})
                    </button>
                    <button
                        onClick={() => setActiveMainTab('saved')}
                        className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer ${
                            activeMainTab === 'saved'
                                ? 'bg-amber-500 text-white shadow-lg'
                                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                        }`}
                    >
                        💾 Saved Quizzes Repository ({savedTemplates.length})
                    </button>
                </div>



                {loading ? (
                    <div className="bg-white rounded-[3rem] border border-[var(--border-color)] p-12 sm:p-24 flex flex-col items-center justify-center gap-8 ring-1 ring-[var(--border-color)]">
                        <div className="relative w-16 h-16">
                            <div className="premium-spinner-ring"></div>
                            <div className="premium-spinner-ring"></div>
                            <div className="premium-spinner-ring"></div>
                        </div>
                        <p className="font-black text-[var(--text-primary)] italic uppercase tracking-[0.3em] text-sm animate-pulse mt-4 text-center">
                            Syncing with KMIT database...
                        </p>
                    </div>
                ) : filteredQuizzes.length > 0 ? (
                    <div className="space-y-6">
                        {/* Selection & Bulk Actions Control Header */}
                        {selectedQuizIds.length > 0 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-3xl px-8 py-4 shadow-md">
                                <button
                                    onClick={toggleSelectAll}
                                    className="flex items-center gap-3 text-[var(--text-primary)] font-black italic uppercase tracking-wider text-xs transition-all select-none"
                                >
                                    <div className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all duration-200 ${selectedQuizIds.length === filteredQuizzes.length ? 'bg-[var(--bg-accent)] border-[var(--bg-accent)] text-white' : 'bg-white border-[var(--border-color)] text-transparent'}`}>
                                        <Check size={16} className={selectedQuizIds.length === filteredQuizzes.length ? 'opacity-100 text-white font-bold' : 'opacity-0'} />
                                    </div>
                                    {selectedQuizIds.length === filteredQuizzes.length ? 'Deselect All' : 'Select All'}
                                </button>
                                
                                <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                    <span className="text-[var(--text-primary)] font-black italic uppercase tracking-widest text-xs">
                                        {selectedQuizIds.length} {selectedQuizIds.length === 1 ? 'Quiz' : 'Quizzes'} Selected
                                    </span>
                                    <button
                                        onClick={handleBulkDelete}
                                        className="bg-red-600 text-white border border-red-700 px-6 py-2.5 rounded-xl font-black italic uppercase tracking-tighter transition-all hover:bg-red-700 active:scale-95 flex items-center gap-2 text-xs shadow-md"
                                    >
                                        <Trash2 size={14} /> Delete Selected
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-6 sm:gap-8">
                            {filteredQuizzes.map((quiz) => (
                                <div key={quiz.id} className="bg-[var(--bg-secondary)] rounded-3xl sm:rounded-[3rem] border border-[var(--border-color)] p-5 sm:p-8 lg:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-10 hover:border-[var(--bg-accent)] transition-all group relative overflow-hidden shadow-xl">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 z-10 w-full min-w-0">
                                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start shrink-0">
                                            {/* Individual Checkbox Selection */}
                                            <button
                                                onClick={() => toggleQuizSelection(quiz.id)}
                                                className="flex items-center justify-center cursor-pointer shrink-0 focus:outline-none transition-transform active:scale-90"
                                                aria-label={selectedQuizIds.includes(quiz.id) ? "Deselect quiz" : "Select quiz"}
                                            >
                                                <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all duration-200 ${selectedQuizIds.includes(quiz.id) ? 'bg-[var(--bg-accent)] border-[var(--bg-accent)] text-white scale-110 shadow-md' : 'bg-white border-[var(--border-color)] hover:border-[var(--bg-accent)]'}`}>
                                                    <Check size={18} className={selectedQuizIds.includes(quiz.id) ? 'opacity-100 text-white font-black' : 'opacity-0'} />
                                                </div>
                                            </button>

                                            <div className={`p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] transition-all group-hover:scale-110 shrink-0 shadow-xl ${quiz.isActive ? 'bg-[var(--bg-accent)] text-white' : 'bg-[var(--bg-accent)]/15 text-[var(--text-accent)] border border-[var(--border-color)]'}`}>
                                                <FileText className="w-7 h-7 sm:w-10 sm:h-10" />
                                            </div>
                                        </div>

                                        <div className="space-y-3 min-w-0 flex-1 w-full">
                                            <div className="space-y-1 min-w-0 w-full">
                                                <div className="flex items-center gap-3 flex-wrap min-w-0 w-full">
                                                    <div className="w-full min-w-0 py-1">
                                                        <h3 className="text-xl sm:text-3xl font-black text-[var(--text-accent)] tracking-tight italic leading-snug break-words transition-colors" title={cleanQuizTitle(quiz.title)}>
                                                            {cleanQuizTitle(quiz.title)}
                                                        </h3>
                                                    </div>
                                                    {/* Lock badge for published (immutable) quizzes */}
                                                    {quiz.isLocked && (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-600/30 text-amber-800 text-[10px] font-black uppercase tracking-widest shrink-0">
                                                            <Lock size={10} /> Published · Read-only
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[var(--text-secondary)] font-bold uppercase tracking-widest text-xs italic">{quiz.topic || 'General Knowledge'}</p>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 sm:gap-x-8 sm:gap-y-4">
                                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[var(--text-secondary)] italic bg-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-[var(--border-color)]">
                                                    <Calendar size={14} className="text-[var(--text-accent)]" /> {new Date(quiz.createdAt).toLocaleDateString()}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[var(--text-secondary)] italic bg-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-[var(--border-color)]">
                                                    <HelpCircle size={14} className="text-[var(--text-accent)]" /> {quiz.questions?.length || 0} Questions
                                                </div>
                                                <div className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] italic ${quiz.isActive ? 'text-green-700 border-green-500/30 bg-green-500/10' : 'text-slate-700 border-[var(--border-color)] bg-white'}`}>
                                                    <div className={`w-2 h-2 rounded-full ${quiz.isActive ? 'bg-green-600 animate-pulse' : 'bg-slate-500'}`}></div>
                                                    {quiz.isActive ? (quiz.isLive ? 'LIVE' : 'ASSESSMENT') : 'OFFLINE'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 z-10 w-full lg:w-auto">
                                        <div className="flex flex-col sm:flex-row items-center gap-4 bg-[var(--bg-primary)] p-4 rounded-[2.5rem] border border-[var(--border-color)] w-full lg:w-auto shadow-inner">
                                            {/* Performance Stats */}
                                            <div className="flex items-center gap-6 px-6 py-2 border-r border-[var(--border-color)] hidden sm:flex">
                                                <div className="text-center">
                                                    <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest leading-none mb-1">Avg Score</p>
                                                    <p className="text-lg font-black text-[var(--text-primary)] italic">{(quiz.averageScore || 0).toFixed(0)}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest leading-none mb-1">Students</p>
                                                    <p className="text-lg font-black text-[var(--text-accent)] italic">{quiz.completionCount || 0}</p>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                                {quiz.isAssessment ? (
                                                    <>
                                                        {quiz.isActive ? (
                                                            <button
                                                                onClick={() => updateQuizMode(quiz.id, 'close')}
                                                                className="flex-1 sm:flex-none bg-red-600 !text-white border border-red-700 px-6 py-3 rounded-2xl font-black italic uppercase tracking-tighter transition-all hover:bg-red-700 active:scale-95 flex items-center justify-center gap-2 text-sm shadow-md"
                                                                style={{ color: '#ffffff' }}
                                                            >
                                                                <XCircle size={18} /> Close
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => updateQuizMode(quiz.id, 'assessment')}
                                                                className="flex-1 sm:flex-none bg-[var(--bg-accent)] !text-white border border-[var(--bg-accent-hover)] px-6 py-3 rounded-2xl font-black italic uppercase tracking-tighter transition-all hover:bg-[var(--bg-accent-hover)] active:scale-95 flex items-center justify-center gap-2 text-sm shadow-md"
                                                                style={{ color: '#ffffff' }}
                                                            >
                                                                <Play size={18} /> Reopen
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        {quiz.status !== 'finished' && (
                                                            <Link
                                                                to={`/live-room-teacher/${quiz.joinCode}`}
                                                                className="flex-1 sm:flex-none bg-[var(--bg-accent)] !text-white px-6 py-3 rounded-2xl font-black italic uppercase tracking-tighter transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-[var(--bg-accent)]/20 text-sm"
                                                                style={{ color: '#ffffff' }}
                                                            >
                                                                <ExternalLink size={18} /> Room
                                                            </Link>
                                                        )}
                                                    </>
                                                )}
                                                    
                                                {quiz.isAssessment && (
                                                    <button
                                                        onClick={() => setEditingScheduleId(quiz.id)}
                                                        className="flex-1 sm:flex-none bg-blue-600 !text-white border border-blue-700 px-6 py-3 rounded-2xl font-black italic uppercase tracking-tighter transition-all hover:bg-blue-700 active:scale-95 flex items-center justify-center gap-2 text-sm shadow-md"
                                                        style={{ color: '#ffffff' }}
                                                        title="Edit Schedule"
                                                    >
                                                        <CalendarRange size={18} /> Schedule
                                                    </button>
                                                )}

                                                <Link
                                                    to={`/analytics/quiz/${quiz.id}`}
                                                    className="flex-1 sm:flex-none bg-[var(--bg-accent)] !text-white border border-[var(--bg-accent-hover)] px-6 py-3 rounded-2xl font-black italic uppercase tracking-tighter transition-all hover:bg-[var(--bg-accent-hover)] active:scale-95 flex items-center justify-center gap-2 text-sm shadow-md"
                                                    style={{ color: '#ffffff' }}
                                                    title="View Analytics Dashboard"
                                                >
                                                    <Activity size={18} /> Analytics
                                                </Link>

                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(quiz.id, quiz.title)}
                                                    className="p-3 !text-white bg-red-600 hover:bg-red-700 border border-red-700 rounded-xl transition-all group/del shrink-0 shadow-sm active:scale-95"
                                                    style={{ color: '#ffffff' }}
                                                    aria-label={`Delete quiz: ${quiz.title}`}
                                                    title={quiz.isLocked ? 'Delete (published quiz — admin may be required)' : 'Delete Quiz'}
                                                >
                                                    <Trash2 size={20} className="group-hover/del:scale-110 transition-transform" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mini Leaderboard Removed as per request */}

                                    <div className="absolute -right-20 -bottom-20 opacity-[0.02] text-white group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
                                        <Activity size={300} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <EmptyState 
                        icon={FileText}
                        title="Library Empty"
                        message={searchTerm ? `No results match "${searchTerm}".` : "Your knowledge base is waiting for its first entry. Let's create something extraordinary."}
                        action={!searchTerm && (
                            <Link to="/teacher-dashboard" className="bg-[var(--bg-accent)] text-white px-12 py-5 rounded-[2rem] font-black italic uppercase tracking-tighter hover:scale-105 transition-all shadow-2xl shadow-[var(--bg-accent)]/20 btn-glow">
                                Build First Quiz
                            </Link>
                        )}
                    />
                )}

                {/* Saved Quizzes Repository Tab View */}
                {activeMainTab === 'saved' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-black text-slate-800 uppercase italic">Saved Quiz Templates</h2>
                            <p className="text-xs text-slate-500 font-bold">Reusable base templates across sections and academic sessions</p>
                        </div>

                        {savedTemplates.length === 0 ? (
                            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3 shadow-xs">
                                <p className="text-slate-400 font-black text-xs uppercase tracking-widest">No saved quiz templates found</p>
                                <p className="text-slate-600 text-xs font-medium">Create a quiz and click "💾 Save Quiz Template" in the top header to store reusable templates here!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {savedTemplates.map(tpl => (
                                    <div key={tpl.id} className="bg-white rounded-3xl border-2 border-amber-200 p-6 space-y-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-black uppercase tracking-wider">Template</span>
                                                <span className="text-[10px] font-bold text-slate-500">{Array.isArray(tpl.questions) ? tpl.questions.length : 0} Questions</span>
                                            </div>
                                            <h3 className="text-lg font-black text-slate-900 leading-snug">{tpl.title}</h3>
                                            <p className="text-xs text-slate-500 line-clamp-2">{tpl.description || 'Saved Quiz Template for infinite re-broadcasting.'}</p>
                                        </div>

                                        <div className="pt-4 border-t border-slate-100 flex items-center gap-2">
                                            <button
                                                onClick={() => setBroadcastModal({ isOpen: true, template: tpl, branch: 'CSE', year: '3', semester: '1', section: 'A' })}
                                                className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                                            >
                                                <Megaphone size={14} /> Clone &amp; Broadcast
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTemplate(tpl.id, tpl.title)}
                                                className="p-3 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 cursor-pointer transition-all"
                                                title="Delete Template"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ScheduleEditModal
                isOpen={!!editingScheduleId}
                onClose={() => setEditingScheduleId(null)}
                quizId={editingScheduleId}
                onSuccess={fetchQuizzes}
            />

            {/* Section-Specific Broadcast Modal */}
            {broadcastModal.isOpen && broadcastModal.template && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={() => setBroadcastModal(m => ({ ...m, isOpen: false }))} />
                    
                    <div className="relative bg-white border-2 border-slate-200 rounded-[2.5rem] w-full max-w-lg shadow-2xl p-8 space-y-6 animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl">
                                    <Megaphone size={24} />
                                </div>
                                <div>
                                    <h2 className="font-black text-lg text-slate-900 uppercase italic">
                                        Section-Specific <span className="text-amber-600">Broadcasting</span>
                                    </h2>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                        Target Live Session
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setBroadcastModal(m => ({ ...m, isOpen: false }))} className="p-2 hover:bg-slate-100 rounded-xl cursor-pointer">
                                <span className="text-slate-400 font-bold text-lg">✕</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Target Department / Branch</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-xs"
                                    value={broadcastModal.branch}
                                    onChange={e => setBroadcastModal(m => ({ ...m, branch: e.target.value }))}
                                >
                                    <option value="CSE">CSE</option>
                                    <option value="ECE">ECE</option>
                                    <option value="EEE">EEE</option>
                                    <option value="IT">IT</option>
                                    <option value="CSM">CSM</option>
                                    <option value="CSD">CSD</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Year</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-xs"
                                        value={broadcastModal.year}
                                        onChange={e => setBroadcastModal(m => ({ ...m, year: e.target.value }))}
                                    >
                                        <option value="1">Year 1</option>
                                        <option value="2">Year 2</option>
                                        <option value="3">Year 3</option>
                                        <option value="4">Year 4</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Semester</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-xs"
                                        value={broadcastModal.semester}
                                        onChange={e => setBroadcastModal(m => ({ ...m, semester: e.target.value }))}
                                    >
                                        <option value="1">Sem 1</option>
                                        <option value="2">Sem 2</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Target Section</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-xs font-black"
                                        value={broadcastModal.section}
                                        onChange={e => setBroadcastModal(m => ({ ...m, section: e.target.value }))}
                                    >
                                        <option value="A">Section A</option>
                                        <option value="B">Section B</option>
                                        <option value="C">Section C</option>
                                        <option value="D">Section D</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-medium">
                                🎯 <strong>Targeting Info:</strong> Only students enrolled in <strong>{broadcastModal.branch} - Year {broadcastModal.year} - Section {broadcastModal.section}</strong> will receive live push notifications &amp; live room access.
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setBroadcastModal(m => ({ ...m, isOpen: false }))} className="px-5 py-3 border border-slate-200 rounded-xl font-bold text-xs cursor-pointer">
                                Cancel
                            </button>
                            <button
                                onClick={handleCloneAndBroadcast}
                                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg cursor-pointer"
                            >
                                <Megaphone size={16} /> Broadcast to Section {broadcastModal.section}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
