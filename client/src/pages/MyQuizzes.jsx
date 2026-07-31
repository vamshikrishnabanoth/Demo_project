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

export default function MyQuizzes() {
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedQuizIds, setSelectedQuizIds] = useState([]);
    const [editingScheduleId, setEditingScheduleId] = useState(null);

    // Filters state
    const [filterType, setFilterType] = useState('All');
    const [filterYear, setFilterYear] = useState('All');
    const [filterBranch, setFilterBranch] = useState('All');
    const [filterSection, setFilterSection] = useState('All');

    const fetchQuizzes = async () => {
        try {
            const res = await api.get('/quiz/my-quizzes');
            setQuizzes(res.data);
        } catch (err) {
            console.error('Error fetching quizzes', err);
            toast.error('Could not load your quizzes. Please refresh.', {
                style: { background: '#1e293b', color: '#fff', borderRadius: '1rem' },
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuizzes();
    }, []);

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
                        <p className="text-[var(--text-secondary)] font-bold mt-2 text-xs sm:text-sm text-balance">Manage your knowledge assets</p>
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
            </div>

            <ScheduleEditModal
                isOpen={!!editingScheduleId}
                onClose={() => setEditingScheduleId(null)}
                quizId={editingScheduleId}
                onSuccess={fetchQuizzes}
            />
        </DashboardLayout>
    );
}
