import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Search,
    Users,
    UserCheck,
    Check,
    ChevronRight,
    SlidersHorizontal,
    GraduationCap,
    CheckSquare,
    Loader2,
    Trash2
} from 'lucide-react';

export default function StudentAssignDrawer({ quiz, isOpen, onClose, onAssignSuccess, initialGroups, initialStudents, onSave }) {
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

    // Listen for Escape key to close
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

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
                setBranches(branchesRes.data);
                setYears(yearsRes.data);
                setSemesters(semestersRes.data);
            } catch (err) {
                console.error('Error loading filters from database:', err);
                toast.error('Could not load filters from database.');
            }
        };

        loadFilterOptions();

        if (quiz) {
            setAssignedGroups(quiz.assignedGroups || []);
            if (quiz.assignedStudents && quiz.assignedStudents.length > 0) {
                api.get(`/students/search`, {
                    params: { limit: 100 }
                }).then(res => {
                    const matched = res.data.students.filter(s => quiz.assignedStudents.includes(s.id));
                    setAssignedStudents(matched);
                }).catch(err => console.error(err));
            } else {
                setAssignedStudents([]);
            }
        } else {
            setAssignedGroups(initialGroups || []);
            if (initialStudents && initialStudents.length > 0) {
                api.get(`/students/search`, {
                    params: { limit: 100 }
                }).then(res => {
                    const matched = res.data.students.filter(s => initialStudents.includes(s.id));
                    setAssignedStudents(matched);
                }).catch(err => console.error(err));
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
                setSections(res.data);
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
                setStudents(newStudents);
            } else {
                setStudents(prev => [...prev, ...newStudents]);
            }

            setPage(pagination.page);
            setHasMore(pagination.page < pagination.pages);
            setTotalStudentsCount(pagination.total);
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
            const allMatched = res.data.students;

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
        toast.success('Cleared all targeted targets.');
    };

    const handleSaveAssignment = async () => {
        setIsSaving(true);
        try {
            const payload = {
                assignedGroups: assignedGroups.map(g => ({ branch: g.branch, section: g.section })),
                assignedStudents: assignedStudents.map(s => s.id)
            };

            if (onSave) {
                onSave(payload);
                toast.success('Assignment targeting staged successfully!');
                onClose();
                return;
            }

            await api.post(`/quiz/assign/${quiz.id}`, payload);
            toast.success('Assignment targeting saved successfully!');
            if (onAssignSuccess) onAssignSuccess();
            onClose();
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

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop Overlay */}
            <div 
                className="absolute inset-0 bg-[#020617]/80 backdrop-blur-md transition-opacity" 
                onClick={onClose}
            />

            {/* Sliding Drawer Container */}
            <div className="relative w-full max-w-3xl h-full bg-[#0b0f19] border-l border-white/10 shadow-2xl flex flex-col z-10 overflow-hidden">
                
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02] shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-400/10 border border-amber-400/20 rounded-2xl text-amber-400">
                            <Users size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Student Targeting</h2>
                            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-0.5">Assign: <span className="text-amber-400 italic">{quiz?.title || 'Active Quiz'}</span></p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2.5 hover:bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-95"
                        aria-label="Close targeting drawer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Main Content Area (Layout split to secure infinite scroll list viewport space) */}
                <div className="flex-1 flex flex-col overflow-hidden p-6 space-y-6">
                    
                    {/* Top Section: Filters and Targeting Preview (Scrolls internally up to 45% height) */}
                    <div className="space-y-6 overflow-y-auto max-h-[45vh] pr-2 custom-scrollbar shrink-0">
                        
                        {/* Dynamic Collapsible Hierarchical Filters */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 italic">
                                <SlidersHorizontal size={12} className="text-amber-400" /> Dynamic Branch-wise Structuring
                            </h3>
                            
                            <div className="space-y-3">
                                {branches.map(b => {
                                    const isSelected = selectedBranches.includes(b);
                                    const isExpanded = expandedBranch === b;

                                    return (
                                        <div key={b} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 transition-all hover:border-white/10">
                                            <div className="flex items-center justify-between">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleBranchFilter(b)}
                                                    className={`flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider italic transition-all ${isSelected ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                                >
                                                    <GraduationCap size={14} />
                                                    {b} Branch
                                                </button>
                                                
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedBranch(isExpanded ? null : b)}
                                                    className="text-[10px] font-black uppercase tracking-widest text-[var(--text-accent)] hover:text-white transition-colors"
                                                >
                                                    {isExpanded ? 'Collapse' : 'Structure Sem/Sec ↓'}
                                                </button>
                                            </div>

                                            {/* Structured Semester & Section selection below branch name */}
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    className="pl-4 border-l border-white/10 space-y-4 mt-4 overflow-hidden"
                                                >
                                                    {/* Semesters under this branch */}
                                                    <div className="space-y-2">
                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Select Semester</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {semesters.map(s => {
                                                                const isSemSelected = selectedSemester === s;
                                                                return (
                                                                    <button
                                                                        key={s}
                                                                        type="button"
                                                                        onClick={() => setSelectedSemester(isSemSelected ? '' : s)}
                                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${isSemSelected ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                                                    >
                                                                        Semester {s}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Sections under this branch */}
                                                    <div className="space-y-2">
                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Select Section</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {sections.length > 0 ? (
                                                                sections.map(sec => {
                                                                    const isSecSelected = selectedSections.includes(sec);
                                                                    return (
                                                                        <button
                                                                            key={sec}
                                                                            type="button"
                                                                            onClick={() => toggleSectionFilter(sec)}
                                                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${isSecSelected ? 'bg-purple-600 text-white shadow-md' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                                                        >
                                                                            Section {sec}
                                                                        </button>
                                                                    );
                                                                })
                                                            ) : (
                                                                <p className="text-[10px] font-bold text-slate-600 italic">Please select a branch above to display sections...</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Target Selected Overview Card */}
                        <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <UserCheck size={16} className="text-amber-400" />
                                    <h4 className="text-xs font-black text-white uppercase tracking-wider italic">Targeting Overview</h4>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="bg-amber-400/10 border border-amber-400/20 text-amber-400 px-3.5 py-1 rounded-full text-[10px] font-black italic">
                                        {calculateLiveTargetCount()} Targeted Students
                                    </span>
                                    {(assignedGroups.length > 0 || assignedStudents.length > 0) && (
                                        <button 
                                            onClick={clearAll} 
                                            className="text-[10px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest flex items-center gap-1 transition-colors"
                                        >
                                            <Trash2 size={12} /> Clear
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Group selection chips */}
                            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
                                {assignedGroups.map(g => (
                                    <div key={`grp-${g.branch}-${g.section}`} className="flex items-center gap-2 bg-gradient-to-r from-amber-400/10 to-amber-500/5 border border-amber-400/20 rounded-lg px-3 py-1.5 text-[10px] font-black text-white italic">
                                        <Users size={10} className="text-amber-400 shrink-0" />
                                        <span>{g.branch}-{g.section} ({g.count || 0} students)</span>
                                        <button 
                                            onClick={() => removeGroup(g.branch, g.section)}
                                            className="text-slate-400 hover:text-red-400 transition-colors ml-1"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}

                                {assignedStudents.map(s => (
                                    <div key={`stud-${s.id}`} className="flex items-center gap-2 bg-gradient-to-r from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-lg px-3 py-1.5 text-[10px] font-black text-white italic">
                                        <div className="w-3.5 h-3.5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-[7px] font-bold uppercase shrink-0">
                                            {s.name ? s.name[0] : s.username[0]}
                                        </div>
                                        <span>{s.username}</span>
                                        <span className="opacity-40 font-medium text-[8px]">({s.studentBranch}-{s.section})</span>
                                        <button 
                                            onClick={() => toggleStudentSelection(s)}
                                            className="text-slate-400 hover:text-red-400 transition-colors ml-1"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}

                                {assignedGroups.length === 0 && assignedStudents.length === 0 && (
                                    <p className="text-slate-600 text-[10px] font-bold italic py-1">No targets configured. Use the filters or scroll below to pick.</p>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Bottom Section: Expandable Search and Infinite Scroll Viewport (Takes up 100% of remaining height) */}
                    <div className="flex-1 flex flex-col overflow-hidden space-y-4">
                        
                        <div className="flex items-center justify-between shrink-0">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 italic">
                                <GraduationCap size={14} className="text-purple-400" /> Student Verification & Targeting
                            </h3>
                            {totalStudentsCount > 0 && (
                                <button 
                                    onClick={selectAllFiltered}
                                    className="bg-white/5 border border-white/10 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all active:scale-95 flex items-center gap-1"
                                >
                                    <CheckSquare size={10} /> Select All Filtered ({totalStudentsCount})
                                </button>
                            )}
                        </div>

                        {/* Sticky Search bar */}
                        <div className="relative group shrink-0">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-400 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="SEARCH BY STUDENT NAME OR ROLL NUMBER..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 pr-5 text-white font-black italic placeholder:text-slate-600 focus:outline-none focus:border-amber-400/30 transition-all text-xs uppercase tracking-wider"
                            />
                        </div>

                        {/* Contextual "Target Entire CSE-A" dynamic shortcut tags */}
                        {getShortcutTargets().length > 0 && (
                            <div className="flex flex-wrap gap-2 shrink-0 py-1">
                                {getShortcutTargets().map((sc, sci) => (
                                    <button
                                        key={sci}
                                        onClick={() => sc.section && assignGroup(sc.branch, sc.section)}
                                        className="bg-amber-400/5 hover:bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all italic flex items-center gap-1.5"
                                    >
                                        Target Entire '{sc.branch}-{sc.section || 'All'}'
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Custom viewport for Infinite Scroll Student List */}
                        <div 
                            ref={listContainerRef}
                            onScroll={handleScroll}
                            className="flex-1 bg-white/[0.01] border border-white/5 rounded-2xl overflow-y-auto custom-scrollbar p-2"
                        >
                            {students.map((student) => {
                                const isManuallySelected = assignedStudents.some(s => s.id === student.id);
                                const isGroupSelected = assignedGroups.some(g => g.branch === student.studentBranch && g.section === student.section);

                                return (
                                    <div 
                                        key={student.id}
                                        onClick={() => !isGroupSelected && toggleStudentSelection(student)}
                                        className={`flex items-center justify-between p-3.5 rounded-xl transition-all mb-2 cursor-pointer ${isGroupSelected ? 'bg-amber-400/5 border border-amber-400/10 opacity-70 cursor-not-allowed' : isManuallySelected ? 'bg-purple-500/10 border border-purple-500/20' : 'hover:bg-white/[0.03] border border-transparent'}`}
                                    >
                                        <div className="flex items-center gap-3.5">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs shrink-0 shadow-lg ${isGroupSelected ? 'bg-amber-400/20 text-amber-300' : isManuallySelected ? 'bg-purple-600 text-white' : 'bg-white/5 text-slate-400'}`}>
                                                {student.name ? student.name[0] : student.username[0]}
                                            </div>
                                            <div>
                                                <h4 className="font-black text-white text-xs tracking-wide uppercase italic">
                                                    {student.name || 'Enrolled Student'}
                                                </h4>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                                                    {student.username} • <span className="text-slate-400 italic">{student.studentBranch}-{student.section}</span>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {isGroupSelected ? (
                                                <span className="text-[8px] font-black text-amber-400 uppercase tracking-wider italic bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                                                    Targeted
                                                </span>
                                            ) : isManuallySelected ? (
                                                <div className="w-5 h-5 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
                                                    <Check size={12} strokeWidth={3} />
                                                </div>
                                            ) : (
                                                <div className="w-5 h-5 rounded-lg border-2 border-slate-700 shrink-0"></div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {loadingStudents && (
                                <div className="flex items-center justify-center py-6 gap-3">
                                    <Loader2 className="animate-spin text-amber-400" size={14} />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic animate-pulse">Syncing student database...</span>
                                </div>
                            )}

                            {students.length === 0 && !loadingStudents && (
                                <div className="text-center py-12 space-y-2">
                                    <Users size={28} className="text-slate-700 mx-auto" />
                                    <h4 className="font-black text-slate-500 uppercase tracking-wider italic text-[10px]">No DB Students Found</h4>
                                    <p className="text-[10px] text-slate-600 font-bold">Try adjusting your filters above.</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer Save Actions (Always pinned at bottom) */}
                <div className="p-6 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-4 shrink-0">
                    <button 
                        onClick={onClose}
                        className="bg-white/5 border border-white/10 hover:bg-white/10 text-white px-6 py-3.5 rounded-2xl font-black italic uppercase tracking-tighter text-xs transition-all active:scale-95"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSaveAssignment}
                        disabled={isSaving}
                        className="flex-1 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 px-6 py-3.5 rounded-2xl font-black italic uppercase tracking-tighter text-xs transition-all active:scale-95 shadow-xl shadow-amber-400/10 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="animate-spin" size={14} />
                                Saving Assignment...
                            </>
                        ) : (
                            <>
                                Save Assignment Target ({calculateLiveTargetCount()} Students)
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
