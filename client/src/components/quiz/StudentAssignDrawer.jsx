import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X as XIcon,
    Search,
    Users,
    UserCheck,
    Check,
    ChevronRight, ChevronDown,
    SlidersHorizontal,
    GraduationCap,
    CheckSquare,
    Loader2,
    Trash2,
    Sparkles
} from 'lucide-react';

export default function StudentAssignDrawer({ 
    quiz, 
    isOpen = true, 
    onClose, 
    onAssignSuccess, 
    initialGroups, 
    initialStudents, 
    onSave,
    inline = true 
}) {
    // Dynamic DB Filter Options
    const [branches, setBranches] = useState([]);
    const [sections, setSections] = useState([]);
    const [years, setYears] = useState([]);
    const [semesters, setSemesters] = useState([]);

    // Selection Filter State
    const [selectedBranches, setSelectedBranches] = useState([]);
    const [selectedSections, setSelectedSections] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('');

    // Accordion expand/collapse branch state
    const [expandedBranch, setExpandedBranch] = useState(null);

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

    // Load Initial DB-Driven Filter Options
    useEffect(() => {
        if (!isOpen) return;

        const loadFilterOptions = async () => {
            try {
                const [branchesRes, yearsRes, semestersRes] = await Promise.all([
                    api.get('/students/branches'),
                    api.get('/students/years'),
                    api.get('/students/semesters')
                ]);
                setBranches(branchesRes.data || []);
                setYears(yearsRes.data || []);
                setSemesters(semestersRes.data || []);
            } catch (err) {
                console.error('Error loading filters from database:', err);
            }
        };

        loadFilterOptions();

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

    // Dynamically Load Sections when Branches change
    useEffect(() => {
        if (!isOpen) return;

        const loadSections = async () => {
            try {
                const params = {};
                if (selectedBranches.length > 0) {
                    params.branch = selectedBranches;
                }
                const res = await api.get('/students/sections', { params });
                setSections(res.data || []);
            } catch (err) {
                console.error('Error loading sections:', err);
            }
        };

        loadSections();
    }, [selectedBranches, isOpen]);

    // Search and Filter Students (Debounced Querying)
    useEffect(() => {
        if (!isOpen) return;

        const delayDebounce = setTimeout(() => {
            fetchStudents(1, true);
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [searchQuery, selectedBranches, selectedSections, selectedYear, selectedSemester, isOpen]);

    const fetchStudents = async (pageNum = 1, isNewSearch = false) => {
        setLoadingStudents(true);
        try {
            const params = {
                q: searchQuery,
                page: pageNum,
                limit: 15
            };
            if (selectedBranches.length > 0) params.branch = selectedBranches;
            if (selectedSections.length > 0) params.section = selectedSections;
            if (selectedYear) params.year = selectedYear;
            if (selectedSemester) params.semester = selectedSemester;

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

    // Toggle Branch Selection
    const toggleBranchFilter = (branch) => {
        setSelectedBranches(prev =>
            prev.includes(branch) ? prev.filter(b => b !== branch) : [...prev, branch]
        );
        setSelectedSections([]);
    };

    // Toggle Section Selection
    const toggleSectionFilter = (section) => {
        setSelectedSections(prev =>
            prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
        );
    };

    // Add Entire Section / Group
    const assignGroup = (branch, section) => {
        const exists = assignedGroups.some(g => g.branch === branch && g.section === section);
        if (exists) {
            toast.error(`Group ${branch}-${section} is already targeted.`);
            return;
        }

        api.get('/students/search', {
            params: { branch, section, limit: 1 }
        }).then(res => {
            const count = res.data.pagination.total;
            setAssignedGroups(prev => [...prev, { branch, section, count }]);
            toast.success(`Targeted Entire ${branch}-${section} (${count} students)`);
        }).catch(err => {
            console.error(err);
            setAssignedGroups(prev => [...prev, { branch, section, count: 0 }]);
        });
    };

    const removeGroup = (branch, section) => {
        setAssignedGroups(prev => prev.filter(g => !(g.branch === branch && g.section === section)));
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
            if (selectedBranches.length > 0) params.branch = selectedBranches;
            if (selectedSections.length > 0) params.section = selectedSections;
            if (selectedYear) params.year = selectedYear;
            if (selectedSemester) params.semester = selectedSemester;

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
        setAssignedGroups([]);
        setAssignedStudents([]);
        toast.success('Cleared all targeted students & groups.');
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

    // Helper to get active targeting shortcut names
    const getShortcutTargets = () => {
        const shortcuts = [];
        selectedBranches.forEach(b => {
            if (selectedSections.length > 0) {
                selectedSections.forEach(sec => {
                    shortcuts.push({ label: `Target Entire ${b}-${sec}`, branch: b, section: sec });
                });
            } else {
                shortcuts.push({ label: `Target Entire ${b}`, branch: b, section: '' });
            }
        });
        return shortcuts;
    };

    // Inner Content (Shared between inline & modal layout)
    const content = (
        <div className="space-y-5">
            {/* Panel Top Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-xl text-[#ea580c] shrink-0">
                        <Users size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                            Advanced Student Targeting
                        </h3>
                        <p className="text-slate-500 font-semibold text-xs mt-0.5">
                            Target specific branches, sections, or hand-pick individual students from the directory.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 self-start sm:self-auto">
                    <span className="bg-orange-50 border border-orange-200 text-[#ea580c] px-3.5 py-1.5 rounded-full text-xs font-black shadow-2xs">
                        {calculateLiveTargetCount()} Targeted
                    </span>
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

            {/* Targeting Overview Card */}
            <div className="bg-orange-50/50 border border-orange-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <UserCheck size={16} className="text-[#ea580c]" />
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                            Active Targeting Overview
                        </h4>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-bold text-slate-600">
                            Total: <strong className="text-slate-900 font-black">{calculateLiveTargetCount()}</strong> students
                        </span>
                        {(assignedGroups.length > 0 || assignedStudents.length > 0) && (
                            <button
                                type="button"
                                onClick={clearAll}
                                className="text-[10px] font-black text-red-600 hover:text-red-700 uppercase tracking-widest flex items-center gap-1 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                            >
                                <Trash2 size={11} /> Clear All
                            </button>
                        )}
                    </div>
                </div>

                {/* Target Chips */}
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    {assignedGroups.map(g => (
                        <div
                            key={`grp-${g.branch}-${g.section}`}
                            className="inline-flex items-center gap-1.5 bg-white border border-orange-300 text-orange-900 rounded-lg px-2.5 py-1 text-xs font-bold shadow-2xs"
                        >
                            <Users size={12} className="text-[#ea580c] shrink-0" />
                            <span>{g.branch}-{g.section}</span>
                            <span className="text-[10px] text-orange-600 font-semibold">({g.count || 0})</span>
                            <button
                                type="button"
                                onClick={() => removeGroup(g.branch, g.section)}
                                className="text-slate-400 hover:text-red-600 transition-colors ml-0.5 cursor-pointer"
                                title={`Remove group ${g.branch}-${g.section}`}
                            >
                                <XIcon size={12} />
                            </button>
                        </div>
                    ))}

                    {assignedStudents.map(s => (
                        <div
                            key={`stud-${s.id}`}
                            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-bold shadow-2xs"
                        >
                            <div className="w-4 h-4 rounded-full bg-orange-100 text-[#ea580c] flex items-center justify-center text-[9px] font-black uppercase shrink-0">
                                {s.name ? s.name[0] : (s.username ? s.username[0] : 'S')}
                            </div>
                            <span>{s.username || s.name}</span>
                            {s.studentBranch && (
                                <span className="text-[10px] text-slate-400 font-medium">({s.studentBranch}-{s.section})</span>
                            )}
                            <button
                                type="button"
                                onClick={() => toggleStudentSelection(s)}
                                className="text-slate-400 hover:text-red-600 transition-colors ml-0.5 cursor-pointer"
                                title="Remove student"
                            >
                                <XIcon size={12} />
                            </button>
                        </div>
                    ))}

                    {assignedGroups.length === 0 && assignedStudents.length === 0 && (
                        <p className="text-slate-500 text-xs italic py-1">
                            No custom targets configured yet. Use the filters below or search students to target.
                        </p>
                    )}
                </div>
            </div>

            {/* Dynamic Branch-wise Structuring Accordions */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <SlidersHorizontal size={13} className="text-[#ea580c]" />
                        <span>Filter By Department & Section</span>
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400">Click a branch to filter or expand</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {branches.map(b => {
                        const isSelected = selectedBranches.includes(b);
                        const isExpanded = expandedBranch === b;

                        return (
                            <div
                                key={b}
                                className={`rounded-xl border transition-all p-3 ${
                                    isSelected
                                        ? 'bg-orange-50/40 border-orange-300'
                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => toggleBranchFilter(b)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                            isSelected
                                                ? 'bg-[#ea580c] text-white shadow-xs'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                    >
                                        <GraduationCap size={13} />
                                        <span>{b}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setExpandedBranch(isExpanded ? null : b)}
                                        className="text-[11px] font-bold text-[#ea580c] hover:text-[#c2410c] transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                        <span>{isExpanded ? 'Collapse' : 'Sem / Sec'}</span>
                                        <ChevronDown
                                            size={13}
                                            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className="pt-3 mt-3 border-t border-slate-200 space-y-3">
                                        {/* Semesters */}
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Semester</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {semesters.map(s => {
                                                    const isSemSelected = selectedSemester === s;
                                                    return (
                                                        <button
                                                            key={s}
                                                            type="button"
                                                            onClick={() => setSelectedSemester(isSemSelected ? '' : s)}
                                                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                                                isSemSelected
                                                                    ? 'bg-slate-900 text-white shadow-2xs'
                                                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                            }`}
                                                        >
                                                            Sem {s}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Sections */}
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sections</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {sections.length > 0 ? (
                                                    sections.map(sec => {
                                                        const isSecSelected = selectedSections.includes(sec);
                                                        return (
                                                            <button
                                                                key={sec}
                                                                type="button"
                                                                onClick={() => toggleSectionFilter(sec)}
                                                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                                                    isSecSelected
                                                                        ? 'bg-[#ea580c] text-white shadow-2xs'
                                                                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                                                }`}
                                                            >
                                                                Sec {sec}
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <p className="text-[11px] text-slate-400 italic">Select branch above to view sections</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Student Directory Search & Individual Picking */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <GraduationCap size={14} className="text-[#ea580c]" />
                        <span>Student Verification & Directory ({totalStudentsCount} Found)</span>
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
                        placeholder="Search student by name or roll number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-900 font-semibold placeholder:text-slate-400 focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-orange-500/10 transition-all text-xs"
                    />
                </div>

                {/* Contextual Shortcut Buttons */}
                {getShortcutTargets().length > 0 && (
                    <div className="flex flex-wrap gap-1.5 py-0.5">
                        {getShortcutTargets().map((sc, sci) => (
                            <button
                                key={sci}
                                type="button"
                                onClick={() => sc.section && assignGroup(sc.branch, sc.section)}
                                className="bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#ea580c] text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <Sparkles size={11} />
                                <span>Target Entire '{sc.branch}-{sc.section || 'All'}'</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Scrollable Student List */}
                <div
                    ref={listContainerRef}
                    onScroll={handleScroll}
                    className="bg-slate-50/60 border border-slate-200 rounded-xl max-h-[300px] overflow-y-auto p-2 space-y-1.5"
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
                                            {student.name || 'Enrolled Student'}
                                        </h5>
                                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                            {student.username} • <span className="text-slate-600">{student.studentBranch}-{student.section}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {isGroupSelected ? (
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-200 px-2 py-0.5 rounded">
                                            Group Targeted
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
                            <p className="text-[11px] text-slate-400 font-medium">Try adjusting your department or section filters above.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <p className="text-[11px] text-slate-500 font-medium">
                    Targeting will apply to this quiz's broadcast access.
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
                            <><Check size={14} /><span>Done & Apply ({calculateLiveTargetCount()} Students)</span></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    // If rendered inline: sits directly within the parent container without modal overlay!
    if (inline) {
        return (
            <div className="w-full bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs transition-all mt-3">
                {content}
            </div>
        );
    }

    // Modal fallback (if ever called as a modal, but with light clean theme)
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
