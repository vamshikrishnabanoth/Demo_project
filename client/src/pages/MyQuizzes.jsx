import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { showConfirm, showError } from '../utils/alerts';
import { getSectionsForBranch } from '../utils/sectionUtils';
import toast from 'react-hot-toast';
import { cleanQuizTitle } from '../utils/cleanTitle';
import {
    FileText,
    Check,
    Trash2,
    XCircle,
    Activity,
    ExternalLink,
    Search,
    Calendar,
    HelpCircle,
    Play,
    Users,
    Megaphone,
    CalendarRange,
    Lock,
    Bookmark,
    Eye,
    Plus,
    Sparkles,
    ChevronRight,
    Layers,
    Clock,
    Award
} from 'lucide-react';
import EmptyState from '../components/EmptyState';
import ScheduleEditModal from '../components/quiz/ScheduleEditModal';
import { useApiQuery } from '../hooks/useApiQuery';

export default function MyQuizzes() {
    const navigate = useNavigate();
    const { data: quizzesData, loading, refetch } = useApiQuery('/quiz/my-quizzes');
    const [quizzes, setQuizzes] = useState([]);
    
    useEffect(() => {
        if (quizzesData) {
            setQuizzes(quizzesData);
        }
    }, [quizzesData]);

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

    const handlePreviewTemplate = (tpl) => {
        let questionsList = tpl.questions;
        if (typeof questionsList === 'string') {
            try {
                questionsList = JSON.parse(questionsList);
            } catch (e) {
                questionsList = [];
            }
        }
        navigate('/create-quiz/text', {
            state: {
                questions: questionsList,
                title: tpl.title,
                duration: tpl.duration || 10,
                timerPerQuestion: tpl.timerPerQuestion || 30,
                isAssessment: tpl.isAssessment || false,
                source: 'template',
                isTemplate: true
            }
        });
    };

    const handlePreviewQuiz = async (quiz) => {
        let questionsList = quiz.questions;
        if (!questionsList || !Array.isArray(questionsList) || questionsList.length === 0) {
            const toastId = toast.loading('Fetching quiz details...');
            try {
                const res = await api.get(`/quiz/${quiz.id}`);
                questionsList = res.data?.questions || [];
                toast.dismiss(toastId);
            } catch (err) {
                toast.error('Failed to load quiz questions.', { id: toastId });
                return;
            }
        }
        navigate('/create-quiz/text', {
            state: {
                questions: questionsList,
                title: quiz.title,
                duration: quiz.duration || 10,
                timerPerQuestion: quiz.timerPerQuestion || 30,
                isAssessment: quiz.isAssessment || false,
                source: 'quiz',
                isTemplate: true
            }
        });
    };

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
            toast.success('Quiz mode updated');
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
        else if (filterType === 'Offline') matchesType = !quiz.isActive;
        
        return matchesSearch && matchesType;
    });

    const activeSessionsCount = quizzes.filter(q => q.isActive).length;
    const totalCompletions = quizzes.reduce((sum, q) => sum + (q.completionCount || 0), 0);

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-[100rem] mx-auto px-6 py-6 space-y-8">
                
                {/* Header & Quick Action */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-[2.5rem] p-8 sm:p-10 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2 z-10">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-400">
                            <Sparkles size={16} />
                            <span>Assessment Management Hub</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black italic tracking-tight">
                            Quiz &amp; Assessment <span className="text-amber-400">Library</span>
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm max-w-2xl font-medium">
                            Step-by-step assessment management: Preview questions, edit configurations, launch live room PINs, and monitor student performance.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 z-10 shrink-0">
                        <button
                            onClick={() => navigate('/teacher-dashboard')}
                            className="px-6 py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 cursor-pointer transition-all border-none outline-none"
                        >
                            <Plus size={18} />
                            <span>Create New Quiz</span>
                        </button>
                    </div>

                    <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-10 pointer-events-none">
                        <FileText size={320} />
                    </div>
                </div>

                {/* ── STEP-BY-STEP WORKFLOW BANNER ────────────────────────────────────────── */}
                <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                            <Layers size={16} className="text-amber-500" />
                            Step-by-Step Teacher Workflow
                        </h2>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                            3-Step Guide
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Step 1 */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white font-black flex items-center justify-center text-sm shrink-0 shadow-sm">
                                1
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">Build / Select</h3>
                                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                                    Generate via AI Studio or pick a saved template from your repository.
                                </p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center text-sm shrink-0 shadow-sm">
                                2
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-extrabold text-xs text-indigo-950 uppercase tracking-wide">Preview &amp; Edit</h3>
                                <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                                    Click <span className="font-bold text-amber-700">Preview</span> on any card to review questions, answers, timers &amp; mode options.
                                </p>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center text-sm shrink-0 shadow-sm">
                                3
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">Publish &amp; Analyze</h3>
                                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                                    Click <span className="font-bold text-emerald-700">Publish</span> or <span className="font-bold text-emerald-700">Room</span> to start live PIN sessions &amp; track analytics.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── METRICS OVERVIEW CARDS ────────────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Total Quizzes</span>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-black text-slate-900">{quizzes.length}</span>
                            <FileText size={20} className="text-slate-400" />
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Active Sessions</span>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-black text-emerald-600">{activeSessionsCount}</span>
                            <Play size={20} className="text-emerald-500" />
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Saved Templates</span>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-black text-amber-600">{savedTemplates.length}</span>
                            <Bookmark size={20} className="text-amber-500" />
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Student Attempts</span>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-black text-indigo-600">{totalCompletions}</span>
                            <Users size={20} className="text-indigo-500" />
                        </div>
                    </div>
                </div>

                {/* ── TAB & SEARCH CONTROLS ────────────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    {/* Tab Segment Selector */}
                    <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-1 shrink-0">
                        <button
                            onClick={() => setActiveMainTab('quizzes')}
                            className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                                activeMainTab === 'quizzes'
                                    ? 'bg-white text-slate-900 shadow-md'
                                    : 'text-slate-600 hover:text-slate-950'
                            }`}
                        >
                            <FileText size={15} />
                            <span>Active &amp; Created ({filteredQuizzes.length})</span>
                        </button>
                        <button
                            onClick={() => setActiveMainTab('saved')}
                            className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                                activeMainTab === 'saved'
                                    ? 'bg-amber-500 text-white shadow-md'
                                    : 'text-slate-600 hover:text-slate-950'
                            }`}
                        >
                            <Bookmark size={15} />
                            <span>Saved Repository ({savedTemplates.length})</span>
                        </button>
                    </div>

                    {/* Search & Filter Controls */}
                    <div className="flex flex-wrap items-center gap-3 flex-1 justify-end">
                        {activeMainTab === 'quizzes' && (
                            <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-2xs">
                                {['All', 'Live', 'Assessment', 'Offline'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setFilterType(type)}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                                            filterType === type 
                                                ? 'bg-slate-900 text-white' 
                                                : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="relative min-w-[220px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search quizzes..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* ── TAB 1: ACTIVE & CREATED SESSIONS ──────────────────────────────────── */}
                {activeMainTab === 'quizzes' && (
                    <div className="space-y-6">
                        {/* Selection & Bulk Actions Control Header */}
                        {selectedQuizIds.length > 0 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 text-white border border-slate-800 rounded-2xl px-6 py-3 shadow-md">
                                <button
                                    onClick={toggleSelectAll}
                                    className="flex items-center gap-3 font-black uppercase tracking-wider text-xs cursor-pointer select-none"
                                >
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedQuizIds.length === filteredQuizzes.length ? 'bg-amber-500 border-amber-500 text-white' : 'bg-transparent border-slate-600'}`}>
                                        <Check size={14} className={selectedQuizIds.length === filteredQuizzes.length ? 'opacity-100 font-bold' : 'opacity-0'} />
                                    </div>
                                    {selectedQuizIds.length === filteredQuizzes.length ? 'Deselect All' : 'Select All'}
                                </button>
                                
                                <div className="flex items-center gap-6">
                                    <span className="font-bold text-xs">
                                        {selectedQuizIds.length} Selected
                                    </span>
                                    <button
                                        onClick={handleBulkDelete}
                                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold uppercase text-xs flex items-center gap-2 shadow-sm cursor-pointer"
                                    >
                                        <Trash2 size={14} /> Delete Selected
                                    </button>
                                </div>
                            </div>
                        )}

                        {loading ? (
                            <div className="bg-white rounded-3xl border border-slate-200 p-16 flex flex-col items-center justify-center gap-4 text-center">
                                <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="font-black text-xs text-slate-500 uppercase tracking-widest">Loading quiz library...</p>
                            </div>
                        ) : filteredQuizzes.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4">
                                {filteredQuizzes.map((quiz) => (
                                    <div key={quiz.id} className="bg-white rounded-3xl border-2 border-slate-200 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:border-amber-400 transition-all shadow-xs hover:shadow-md">
                                        
                                        {/* Left Info Column */}
                                        <div className="flex items-start gap-4 flex-1 min-w-0">
                                            <button
                                                onClick={() => toggleQuizSelection(quiz.id)}
                                                className="mt-1 cursor-pointer shrink-0"
                                            >
                                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedQuizIds.includes(quiz.id) ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-50 border-slate-300'}`}>
                                                    <Check size={14} className={selectedQuizIds.includes(quiz.id) ? 'opacity-100' : 'opacity-0'} />
                                                </div>
                                            </button>

                                            <div className="space-y-2 flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                                                        {quiz.topic || 'General Topic'}
                                                    </span>
                                                    
                                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                                                        quiz.isActive 
                                                            ? (quiz.isLive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200')
                                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                                    }`}>
                                                        {quiz.isActive ? (quiz.isLive ? 'LIVE SESSION' : 'ASSESSMENT EXAM') : 'OFFLINE'}
                                                    </span>

                                                    {quiz.isLocked && (
                                                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                                            <Lock size={10} /> Published
                                                        </span>
                                                    )}
                                                </div>

                                                <h3 
                                                    onClick={() => handlePreviewQuiz(quiz)}
                                                    className="text-lg sm:text-xl font-black text-slate-900 cursor-pointer hover:text-amber-600 transition-colors leading-snug break-words"
                                                >
                                                    {cleanQuizTitle(quiz.title)}
                                                </h3>

                                                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
                                                    <span className="flex items-center gap-1.5">
                                                        <Calendar size={14} className="text-amber-500" />
                                                        {new Date(quiz.createdAt).toLocaleDateString()}
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <HelpCircle size={14} className="text-amber-500" />
                                                        {quiz.questions?.length || 0} Questions
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <Users size={14} className="text-indigo-500" />
                                                        {quiz.completionCount || 0} Students
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Actions Column — Clean Step-by-Step Buttons */}
                                        <div className="flex flex-wrap items-center gap-2 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                                            
                                            {/* STEP 1: PREVIEW BUTTON */}
                                            <button
                                                type="button"
                                                onClick={() => handlePreviewQuiz(quiz)}
                                                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
                                                title="Step 1: Preview quiz questions & rules"
                                            >
                                                <Eye size={15} />
                                                <span>Preview</span>
                                            </button>

                                            {/* STEP 2: ROOM / LAUNCH BUTTON */}
                                            {quiz.isAssessment ? (
                                                <button
                                                    onClick={() => updateQuizMode(quiz.id, quiz.isActive ? 'close' : 'assessment')}
                                                    className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-sm flex items-center gap-1.5 cursor-pointer transition-all ${
                                                        quiz.isActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
                                                    }`}
                                                >
                                                    {quiz.isActive ? <XCircle size={15} /> : <Play size={15} />}
                                                    <span>{quiz.isActive ? 'Close Exam' : 'Reopen Exam'}</span>
                                                </button>
                                            ) : (
                                                quiz.status !== 'finished' && (
                                                    <Link
                                                        to={`/live-room-teacher/${quiz.joinCode}`}
                                                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
                                                    >
                                                        <ExternalLink size={15} />
                                                        <span>Room PIN</span>
                                                    </Link>
                                                )
                                            )}

                                            {/* STEP 3: SCHEDULE & ANALYTICS */}
                                            {quiz.isAssessment && (
                                                <button
                                                    onClick={() => setEditingScheduleId(quiz.id)}
                                                    className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                                                    title="Edit schedule"
                                                >
                                                    <CalendarRange size={15} />
                                                    <span>Schedule</span>
                                                </button>
                                            )}

                                            <Link
                                                to={`/analytics/quiz/${quiz.id}`}
                                                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                                                title="View Analytics"
                                            >
                                                <Activity size={15} />
                                                <span>Analytics</span>
                                            </Link>

                                            {/* DELETE */}
                                            <button
                                                onClick={() => handleDelete(quiz.id, quiz.title)}
                                                className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 cursor-pointer transition-all"
                                                title="Delete Quiz"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                icon={FileText}
                                title="Library Empty"
                                message={searchTerm ? `No quizzes match "${searchTerm}".` : "No quizzes found. Create your first AI-generated assessment now!"}
                                action={!searchTerm && (
                                    <button 
                                        onClick={() => navigate('/teacher-dashboard')}
                                        className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-xs tracking-wider cursor-pointer shadow-md"
                                    >
                                        Build First Quiz
                                    </button>
                                )}
                            />
                        )}
                    </div>
                )}

                {/* ── TAB 2: SAVED QUIZ TEMPLATES REPOSITORY ────────────────────────────── */}
                {activeMainTab === 'saved' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Saved Quiz Templates</h2>
                                <p className="text-xs text-slate-500 font-medium">Reusable templates stored for infinite section re-broadcasting</p>
                            </div>
                        </div>

                        {savedTemplates.length === 0 ? (
                            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3 shadow-2xs">
                                <Bookmark size={36} className="mx-auto text-amber-500 opacity-60" />
                                <p className="text-slate-800 font-extrabold text-sm uppercase tracking-wider">No Saved Templates</p>
                                <p className="text-slate-500 text-xs max-w-md mx-auto">
                                    When editing a quiz, click <strong>"Save Quiz Template"</strong> in the top header to store reusable base templates here!
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {savedTemplates.map(tpl => {
                                    const questionCount = Array.isArray(tpl.questions) 
                                        ? tpl.questions.length 
                                        : (typeof tpl.questions === 'string' ? JSON.parse(tpl.questions || '[]').length : 0);
                                    return (
                                        <div key={tpl.id} className="bg-white rounded-3xl border-2 border-amber-200 p-6 space-y-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                                            <div className="space-y-2 cursor-pointer group/card" onClick={() => handlePreviewTemplate(tpl)}>
                                                <div className="flex items-center justify-between">
                                                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-black uppercase tracking-wider">Saved Template</span>
                                                    <span className="text-[10px] font-bold text-slate-500">{questionCount} Questions</span>
                                                </div>
                                                <h3 className="text-lg font-black text-slate-900 leading-snug group-hover/card:text-amber-600 transition-colors">{tpl.title}</h3>
                                                <p className="text-xs text-slate-500 line-clamp-2">{tpl.description || 'Saved Quiz Template for infinite section broadcasting.'}</p>
                                            </div>

                                            <div className="pt-4 border-t border-slate-100 flex items-center gap-2">
                                                {/* STEP 1 PREVIEW & PUBLISH */}
                                                <button
                                                    onClick={() => handlePreviewTemplate(tpl)}
                                                    className="flex-1 py-3 px-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                                                    title="Preview quiz questions before creating room"
                                                >
                                                    <Eye size={15} /> Preview &amp; Publish
                                                </button>

                                                {/* DIRECT BROADCAST */}
                                                <button
                                                    onClick={() => setBroadcastModal({ isOpen: true, template: tpl, branch: 'CSE', year: '3', semester: '1', section: 'A' })}
                                                    className="py-3 px-3 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                                                    title="Directly launch live session"
                                                >
                                                    <Megaphone size={15} /> Broadcast
                                                </button>

                                                {/* DELETE */}
                                                <button
                                                    onClick={() => handleDeleteTemplate(tpl.id, tpl.title)}
                                                    className="p-3 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 cursor-pointer transition-all"
                                                    title="Delete Template"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
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
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setBroadcastModal(m => ({ ...m, isOpen: false }))} />
                    
                    <div className="relative bg-white border-2 border-slate-200 rounded-[2.5rem] w-full max-w-lg shadow-2xl p-8 space-y-6 animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl">
                                    <Megaphone size={24} />
                                </div>
                                <div>
                                    <h2 className="font-black text-lg text-slate-900 uppercase">
                                        Section <span className="text-amber-600">Broadcasting</span>
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
                                <label className="block text-xs font-bold text-slate-600 mb-1">Target Branch</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-xs"
                                    value={broadcastModal.branch}
                                    onChange={e => setBroadcastModal(m => ({ ...m, branch: e.target.value }))}
                                >
                                    <option value="CSE">CSE</option>
                                    <option value="CSM">CSM</option>
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
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Section</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-xs"
                                        value={broadcastModal.section}
                                        onChange={e => setBroadcastModal(m => ({ ...m, section: e.target.value }))}
                                    >
                                        {getSectionsForBranch(broadcastModal.branch).map(sec => (
                                            <option key={sec} value={sec}>Section {sec}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-medium">
                                🎯 <strong>Targeting Info:</strong> Students in <strong>{broadcastModal.branch} - Year {broadcastModal.year} - Section {broadcastModal.section}</strong> will receive live access.
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
