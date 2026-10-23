import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
    X as XIcon,
    Search,
    Users,
    Check,
    GraduationCap,
    CheckSquare,
    Loader2,
    Trash2
} from 'lucide-react';

export default function StudentAssignDrawer({ 
    quiz, 
    isOpen = true, 
    onClose, 
    onAssignSuccess, 
    initialGroups, 
    initialStudents, 
    onSave,
    inline = true,
    targetYear = '',
    targetBranch = '',
    targetSections = []
}) {
    // Real-Time DB Search
    const [searchQuery, setSearchQuery] = useState('');
    const [students, setStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [totalStudentsCount, setTotalStudentsCount] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    // Assignment Targeting State
    const [assignedGroups, setAssignedGroups] = useState([]);
    const [assignedStudents, setAssignedStudents] = useState([]);

    const [isSaving, setIsSaving] = useState(false);
    const listContainerRef = useRef(null);

    // Listen for Escape key to close (if modal mode)
    useEffect(() => {
        if (inline) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen && onClose) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, inline]);

    // Initialize state from quiz or props
    useEffect(() => {
        if (!isOpen) return;

        if (quiz) {
            setAssignedGroups(quiz.assignedGroups || []);
            if (quiz.assignedStudents && quiz.assignedStudents.length > 0) {
                api.get(`/students/search`, {
                    params: { limit: 100 }
                }).then(res => {
                    const matched = (res.data?.students || []).filter(s => quiz.assignedStudents.includes(s.id));
                    setAssignedStudents(matched);
                }).catch(err => console.error(err));
            } else {
                setAssignedStudents([]);
            }
        } else {
            setAssignedGroups(initialGroups || []);
            if (initialStudents && initialStudents.length > 0) {
                const hasObjects = typeof initialStudents[0] === 'object' && initialStudents[0]?.id;
                if (hasObjects) {
                    setAssignedStudents(initialStudents);
                } else {
                    api.get(`/students/search`, {
                        params: { limit: 100 }
                    }).then(res => {
                        const matched = (res.data?.students || []).filter(s => initialStudents.includes(s.id));
                        setAssignedStudents(matched);
                    }).catch(err => console.error(err));
                }
            } else {
                setAssignedStudents([]);
            }
        }
    }, [isOpen, quiz, initialGroups, initialStudents]);

    // Search and Filter Students (Debounced Querying based on active class targeting & search query)
    useEffect(() => {
        if (!isOpen) return;

        const delayDebounce = setTimeout(() => {
            fetchStudents(1, true);
        }, 250);

        return () => clearTimeout(delayDebounce);
    }, [searchQuery, targetBranch, targetSections, targetYear, isOpen]);

    const fetchStudents = async (pageNum = 1, isNewSearch = false) => {
        setLoadingStudents(true);
        try {
            const params = {
                q: searchQuery,
                page: pageNum,
                limit: 20
            };
            if (targetBranch) params.branch = targetBranch;
            if (targetSections && targetSections.length > 0) params.section = targetSections.join(',');
            if (targetYear) params.year = targetYear;

            const res = await api.get('/students/search', { params });
            const { students: newStudents, pagination } = res.data;

            if (isNewSearch) {
                setStudents(newStudents || []);
            } else {
                setStudents(prev => [...prev, ...(newStudents || [])]);
            }

            setPage(pagination?.page || 1);
            setHasMore((pagination?.page || 1) < (pagination?.pages || 1));
            setTotalStudentsCount(pagination?.total || 0);
        } catch (err) {
            console.error('Error fetching students:', err);
        } finally {
            setLoadingStudents(false);
        }
    };

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 50 && hasMore && !loadingStudents) {
            fetchStudents(page + 1, false);
        }
    };

    const toggleStudentSelection = (student) => {
        const isTargeted = assignedStudents.some(s => s.id === student.id);
        if (isTargeted) {
            setAssignedStudents(prev => prev.filter(s => s.id !== student.id));
        } else {
            setAssignedStudents(prev => [...prev, student]);
        }
    };

    const selectAllFiltered = async () => {
        if (totalStudentsCount === 0) return;
        setLoadingStudents(true);
        try {
            const params = {
                q: searchQuery,
                limit: 500
            };
            if (targetBranch) params.branch = targetBranch;
            if (targetSections && targetSections.length > 0) params.section = targetSections.join(',');
            if (targetYear) params.year = targetYear;

            const res = await api.get('/students/search', { params });
            const allMatched = res.data.students || [];

            setAssignedStudents(prev => {
                const existingIds = new Set(prev.map(s => s.id));
                const toAdd = allMatched.filter(s => !existingIds.has(s.id));
                return [...prev, ...toAdd];
            });

            toast.success(`Selected all ${allMatched.length} filtered students.`);
        } catch (err) {
            console.error(err);
            toast.error('Bulk selection failed.');
        } finally {
            setLoadingStudents(false);
        }
    };

    const clearAll = () => {
        setAssignedStudents([]);
        toast.success('Cleared all individually selected students.');
    };

    const handleSaveAssignment = async () => {
        setIsSaving(true);
        try {
            const payload = {
                assignedGroups: assignedGroups.map(g => ({ branch: g.branch, section: g.section, count: g.count || 0 })),
                assignedStudents: assignedStudents.map(s => typeof s === 'string' ? s : s.id)
            };

            if (onSave) {
                onSave({
                    assignedGroups,
                    assignedStudents
                });
                toast.success('Student targeting applied successfully!');
                if (onClose) onClose();
                return;
            }

            if (quiz?.id) {
                await api.post(`/quiz/assign/${quiz.id}`, payload);
                toast.success('Student targeting saved successfully!');
                if (onAssignSuccess) onAssignSuccess();
                if (onClose) onClose();
            }
        } catch (err) {
            console.error('Error saving assignments:', err);
            toast.error(err.response?.data?.msg || 'Could not save targeting parameters.');
        } finally {
            setIsSaving(false);
        }
    };

    const calculateLiveTargetCount = () => {
        let groupCount = assignedGroups.reduce((acc, g) => acc + (g.count || 0), 0);
        const individualFiltered = assignedStudents.filter(s => {
            const isInGroup = assignedGroups.some(g => g.branch === s.studentBranch && g.section === s.section);
            return !isInGroup;
        });
        return groupCount + individualFiltered.length;
    };

    if (!isOpen) return null;

    // Inner Content (Focused and free of redundant duplicate filters)
    const content = (
        <div className="space-y-4">
            {/* Panel Top Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-xl text-[#ea580c] shrink-0">
                        <Users size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                            Hand-Pick Individual Students
                        </h3>
                        <p className="text-slate-500 font-semibold text-xs mt-0.5">
                            Filter Scope: <strong className="text-slate-800">{targetYear ? `${targetYear}th Year` : 'All Years'} • {targetBranch || 'All Branches'} • {targetSections.length > 0 ? `Sec ${targetSections.join(', ')}` : 'All Sections'}</strong>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <span className="bg-orange-50 border border-orange-200 text-[#ea580c] px-3.5 py-1.5 rounded-full text-xs font-black shadow-2xs">
                        {assignedStudents.length} Students Picked
                    </span>
                    {assignedStudents.length > 0 && (
                        <button
                            type="button"
                            onClick={clearAll}
                            className="text-[10px] font-black text-red-600 hover:text-red-700 uppercase tracking-widest px-2.5 py-1 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors cursor-pointer flex items-center gap-1"
                            title="Clear all individually selected students"
                        >
                            <Trash2 size={11} />
                            <span>Clear Selection</span>
                        </button>
                    )}
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Collapse targeting details"
                            aria-label="Close targeting details"
                        >
                            <XIcon size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Student Directory Search & Individual Picking */}
            <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <GraduationCap size={14} className="text-[#ea580c]" />
                        <span>Enrolled Students Directory ({totalStudentsCount} Matching)</span>
                    </h4>
                    {totalStudentsCount > 0 && (
                        <button
                            type="button"
                            onClick={selectAllFiltered}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        >
                            <CheckSquare size={12} className="text-[#ea580c]" />
                            <span>Select All Filtered ({totalStudentsCount})</span>
                        </button>
                    )}
                </div>

                {/* Search Input */}
                <div className="relative group">
                    <Search
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ea580c] transition-colors"
                        size={16}
                    />
                    <input
                        type="text"
                        placeholder="Search student by name, roll number, or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-900 font-semibold placeholder:text-slate-400 focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-orange-500/10 transition-all text-xs"
                    />
                </div>

                {/* Scrollable Student List */}
                <div
                    ref={listContainerRef}
                    onScroll={handleScroll}
                    className="bg-slate-50/60 border border-slate-200 rounded-xl max-h-[320px] overflow-y-auto p-2 space-y-1.5"
                >
                    {students.map((student) => {
                        const isManuallySelected = assignedStudents.some(s => s.id === student.id);
                        const isGroupSelected = assignedGroups.some(g => g.branch === student.studentBranch && g.section === student.section);

                        return (
                            <div
                                key={student.id}
                                onClick={() => !isGroupSelected && toggleStudentSelection(student)}
                                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                                    isGroupSelected
                                        ? 'bg-slate-100 border-slate-200 opacity-70 cursor-not-allowed'
                                        : isManuallySelected
                                        ? 'bg-orange-50 border-orange-300 shadow-2xs cursor-pointer'
                                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                                            isGroupSelected
                                                ? 'bg-slate-200 text-slate-500'
                                                : isManuallySelected
                                                ? 'bg-[#ea580c] text-white shadow-xs'
                                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                                        }`}
                                    >
                                        {student.name ? student.name[0] : (student.username ? student.username[0] : 'S')}
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-slate-900 text-xs tracking-tight">
                                            {student.name || student.username}
                                        </h5>
                                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                            <span className="font-mono text-slate-700">{student.username}</span>
                                            {student.studentBranch && ` • ${student.studentBranch}`}
                                            {student.section && `-${student.section}`}
                                            {student.year && ` • ${student.year}`}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {isGroupSelected ? (
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-200 px-2 py-0.5 rounded">
                                            Class Targeted
                                        </span>
                                    ) : isManuallySelected ? (
                                        <div className="w-5 h-5 rounded-md bg-[#ea580c] text-white flex items-center justify-center shadow-2xs">
                                            <Check size={13} strokeWidth={3} />
                                        </div>
                                    ) : (
                                        <div className="w-5 h-5 rounded-md border-2 border-slate-300 bg-white hover:border-slate-400 transition-colors" />
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {loadingStudents && (
                        <div className="flex items-center justify-center py-5 gap-2.5">
                            <Loader2 className="animate-spin text-[#ea580c]" size={15} />
                            <span className="text-xs font-bold text-slate-500">Loading student directory...</span>
                        </div>
                    )}

                    {students.length === 0 && !loadingStudents && (
                        <div className="text-center py-8 space-y-1.5">
                            <Users size={24} className="text-slate-300 mx-auto" />
                            <h5 className="font-bold text-slate-600 text-xs">No Students Found</h5>
                            <p className="text-[11px] text-slate-400 font-medium">Try typing a student's roll number or name above.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <p className="text-[11px] text-slate-500 font-medium">
                    Selected students will have guaranteed access to this quiz.
                </p>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                        >
                            Collapse
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleSaveAssignment}
                        disabled={isSaving}
                        className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        {isSaving ? (
                            <><Loader2 className="animate-spin" size={14} /><span>Applying...</span></>
                        ) : (
                            <><Check size={14} /><span>Done & Apply ({assignedStudents.length} Students)</span></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    // If rendered inline: sits directly within the parent container without modal overlay
    if (inline) {
        return (
            <div className="w-full bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs transition-all mt-3">
                {content}
            </div>
        );
    }

    // Modal fallback (if ever called as a modal)
    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            />
            <div className="relative w-full max-w-2xl h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col z-10 overflow-y-auto p-6">
                {content}
            </div>
        </div>
    );
}
