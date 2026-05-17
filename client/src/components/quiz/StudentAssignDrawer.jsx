import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
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
    Square,
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

    // Real-Time DB Search
    const [searchQuery, setSearchQuery] = useState('');
    const [students, setStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [totalStudentsCount, setTotalStudentsCount] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    // Assignment Targeting State
    // assignedGroups: array of target groups e.g. [{ branch: 'CSE', section: 'A' }]
    const [assignedGroups, setAssignedGroups] = useState([]);
    // assignedStudents: array of selected individual student User records
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

    // Load Initial DB-Driven Filter Options (Only when drawer opens)
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

        // If quiz already has assignment metadata, load it
        if (quiz) {
            setAssignedGroups(quiz.assignedGroups || []);
            // For assigned students, we'll fetch details if they exist
            if (quiz.assignedStudents && quiz.assignedStudents.length > 0) {
                // Fetch the detailed list of selected students
                api.get(`/students/search`, {
                    params: { limit: 100 } // Fetch a solid preview
                }).then(res => {
                    const matched = res.data.students.filter(s => quiz.assignedStudents.includes(s.id));
                    setAssignedStudents(matched);
                }).catch(err => console.error(err));
            } else {
                setAssignedStudents([]);
            }
        } else {
            // Load staging details
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

    // Load next page on scroll
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
        setSelectedSections([]); // Reset sections when branches change to avoid mismatched filters
    };

    // Toggle Section Selection
    const toggleSectionFilter = (section) => {
        setSelectedSections(prev =>
            prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
        );
    };

    // Add Entire Section / Group
    const assignGroup = (branch, section) => {
        // Prevent duplicate groups
        const exists = assignedGroups.some(g => g.branch === branch && g.section === section);
        if (exists) {
            toast.error(`Group ${branch}-${section} is already targeted.`);
            return;
        }

        // Fetch section count from DB dynamically
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

    // Remove Group Target
    const removeGroup = (branch, section) => {
        setAssignedGroups(prev => prev.filter(g => !(g.branch === branch && g.section === section)));
    };

    // Toggle Individual Student Selection
    const toggleStudentSelection = (student) => {
        const isTargeted = assignedStudents.some(s => s.id === student.id);
        if (isTargeted) {
            setAssignedStudents(prev => prev.filter(s => s.id !== student.id));
        } else {
            setAssignedStudents(prev => [...prev, student]);
        }
    };

    // Bulk Select All Filtered Students (Manually Add all loaded to list)
    const selectAllFiltered = async () => {
        if (totalStudentsCount === 0) return;
        setLoadingStudents(true);
        try {
            // Fetch all matching records from search query up to a reasonable cap (e.g. 500)
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

            // Merge safely with existing targeted list
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

    // Clear All Selections
    const clearAll = () => {
        setAssignedGroups([]);
        setAssignedStudents([]);
        toast.success('Cleared all targeted targets.');
    };

    // Save Assignment
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

    // Calculate dynamic live total targeted count (deduplicating manually selected students who are already part of assigned groups)
    const calculateLiveTargetCount = () => {
        let groupCount = assignedGroups.reduce((acc, g) => acc + (g.count || 0), 0);
        
        // Find individual students who DO NOT fall inside the targeted assignedGroups
        const individualFiltered = assignedStudents.filter(s => {
            const isInGroup = assignedGroups.some(g => g.branch === s.studentBranch && g.section === s.section);
            return !isInGroup;
        });

        return groupCount + individualFiltered.length;
    };

    if (!isOpen) return null;

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
                <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-400/10 border border-amber-400/20 rounded-2xl text-amber-400">
                            <Users size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Student Targeting</h2>
                            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Assign: <span className="text-amber-400 italic">{quiz?.title}</span></p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-3 hover:bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-95"
                        aria-label="Close targeting drawer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8" onScroll={handleScroll}>
                    
                    {/* Database-Driven Dynamic Select Filters */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 italic">
                            <SlidersHorizontal size={14} className="text-amber-400" /> DB-Driven Filters
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Branch Selection Chips */}
                            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-3">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Branch (Multi)</p>
                                <div className="flex flex-wrap gap-2">
                                    {branches.map(b => (
                                        <button
                                            key={b}
                                            onClick={() => toggleBranchFilter(b)}
                                            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider italic transition-all ${selectedBranches.includes(b) ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20' : 'bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                                        >
                                            {b}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Section Selection Chips */}
                            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-3">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Section (Multi)</p>
                                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-2 custom-scrollbar">
                                    {sections.length > 0 ? (
                                        sections.map(s => (
                                            <button
                                                key={s}
                                                onClick={() => toggleSectionFilter(s)}
                                                className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${selectedSections.includes(s) ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                                            >
                                                SEC {s}
                                            </button>
                                        ))
                                    ) : (
                                        <p className="text-xs font-bold text-slate-600 italic">Select a branch first...</p>
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* Year & Semester Filter Dropdowns */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            
                            {/* Year Dropdown */}
                            <div className="relative">
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white font-black italic focus:outline-none focus:border-amber-400/50 appearance-none uppercase text-sm tracking-wide"
                                >
                                    <option value="" className="bg-[#0b0f19] text-slate-400">All Academic Years</option>
                                    {years.map(y => (
                                        <option key={y} value={y} className="bg-[#0b0f19] text-white">{y}</option>
                                    ))}
                                </select>
                                <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 rotate-90 pointer-events-none" size={16} />
                            </div>

                            {/* Semester Dropdown */}
                            <div className="relative">
                                <select
                                    value={selectedSemester}
                                    onChange={(e) => setSelectedSemester(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white font-black italic focus:outline-none focus:border-purple-500/50 appearance-none uppercase text-sm tracking-wide"
                                >
                                    <option value="" className="bg-[#0b0f19] text-slate-400">All Semesters</option>
                                    {semesters.map(s => (
                                        <option key={s} value={s} className="bg-[#0b0f19] text-white">{s}</option>
                                    ))}
                                </select>
                                <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 rotate-90 pointer-events-none" size={16} />
                            </div>

                        </div>
                    </div>

                    {/* Target Selected Preview Block */}
                    <div className="bg-white/[0.01] border border-white/10 rounded-[2rem] p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <UserCheck size={18} className="text-amber-400" />
                                <h4 className="text-sm font-black text-white uppercase tracking-wider italic">Targeting Overview</h4>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="bg-amber-400/10 border border-amber-400/20 text-amber-400 px-4 py-1.5 rounded-full text-xs font-black italic">
                                    {calculateLiveTargetCount()} DB Students Selected
                                </span>
                                {(assignedGroups.length > 0 || assignedStudents.length > 0) && (
                                    <button 
                                        onClick={clearAll} 
                                        className="text-xs font-black text-red-400 hover:text-red-300 uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                                    >
                                        <Trash2 size={12} /> Clear All
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Selection preview chips container */}
                        <div className="flex flex-wrap gap-2.5 max-h-36 overflow-y-auto custom-scrollbar p-1">
                            {assignedGroups.map(g => (
                                <div key={`grp-${g.branch}-${g.section}`} className="flex items-center gap-2 bg-gradient-to-r from-amber-400/10 to-amber-500/5 border border-amber-400/20 rounded-xl px-4 py-2 text-xs font-black text-white italic">
                                    <Users size={12} className="text-amber-400" />
                                    <span>{g.branch}-{g.section} ({g.count || 0} students)</span>
                                    <button 
                                        onClick={() => removeGroup(g.branch, g.section)}
                                        className="text-slate-400 hover:text-red-400 transition-colors ml-1 p-0.5"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}

                            {assignedStudents.map(s => (
                                <div key={`stud-${s.id}`} className="flex items-center gap-2 bg-gradient-to-r from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl px-4 py-2 text-xs font-black text-white italic">
                                    <div className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-[8px] font-bold uppercase shrink-0">
                                        {s.name ? s.name[0] : s.username[0]}
                                    </div>
                                    <span>{s.username}</span>
                                    <span className="opacity-40 font-medium text-[10px]">({s.studentBranch}-{s.section})</span>
                                    <button 
                                        onClick={() => toggleStudentSelection(s)}
                                        className="text-slate-400 hover:text-red-400 transition-colors ml-1 p-0.5"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}

                            {assignedGroups.length === 0 && assignedStudents.length === 0 && (
                                <p className="text-slate-600 text-xs font-bold italic py-2">No targets targeted yet. Use the filters or list below to select targets.</p>
                            )}
                        </div>
                    </div>

                    {/* Student List & Search Block */}
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 italic">
                                <GraduationCap size={16} className="text-purple-400" /> Individual Student Targeting
                            </h3>
                            {totalStudentsCount > 0 && (
                                <button 
                                    onClick={selectAllFiltered}
                                    className="bg-white/5 border border-white/10 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 self-start sm:self-auto"
                                >
                                    <CheckSquare size={12} /> Select All Filtered ({totalStudentsCount})
                                </button>
                            )}
                        </div>

                        {/* Sticky Search bar */}
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-400 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="SEARCH BY NAME, ROLL NUMBER, OR EMAIL..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-white font-black italic placeholder:text-slate-600 focus:outline-none focus:border-amber-400/30 transition-all text-sm uppercase tracking-tighter"
                            />
                        </div>

                        {/* Group Selection Shortcuts based on loaded filters */}
                        {selectedBranches.length > 0 && (
                            <div className="flex flex-wrap gap-2 py-2">
                                {selectedBranches.map(b => (
                                    <div key={`shortcut-${b}`} className="flex flex-wrap gap-2">
                                        {sections.map(sec => (
                                            <button
                                                key={`shortcut-${b}-${sec}`}
                                                onClick={() => assignGroup(b, sec)}
                                                className="bg-amber-400/5 hover:bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all italic flex items-center gap-1.5"
                                            >
                                                Target Entire {b}-{sec}
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Dynamic Infinite Scroll list */}
                        <div 
                            ref={listContainerRef}
                            className="bg-white/[0.01] border border-white/5 rounded-[2rem] max-h-96 overflow-y-auto custom-scrollbar p-2"
                        >
                            {students.map((student) => {
                                const isManuallySelected = assignedStudents.some(s => s.id === student.id);
                                const isGroupSelected = assignedGroups.some(g => g.branch === student.studentBranch && g.section === student.section);
                                const isSelected = isManuallySelected || isGroupSelected;

                                return (
                                    <div 
                                        key={student.id}
                                        onClick={() => !isGroupSelected && toggleStudentSelection(student)}
                                        className={`flex items-center justify-between p-4 rounded-2xl transition-all mb-2 cursor-pointer ${isGroupSelected ? 'bg-amber-400/5 border border-amber-400/10 opacity-70 cursor-not-allowed' : isManuallySelected ? 'bg-purple-500/10 border border-purple-500/20' : 'hover:bg-white/[0.03] border border-transparent'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Circular Avatar */}
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs shrink-0 shadow-lg ${isGroupSelected ? 'bg-amber-400/20 text-amber-300' : isManuallySelected ? 'bg-purple-600 text-white' : 'bg-white/5 text-slate-400'}`}>
                                                {student.name ? student.name[0] : student.username[0]}
                                            </div>
                                            <div>
                                                <h4 className="font-black text-white text-sm tracking-wide uppercase italic">
                                                    {student.name || 'Enrolled Student'}
                                                </h4>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                                                    {student.username} • <span className="text-slate-400 italic">{student.studentBranch}-{student.section}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Status Checkbox */}
                                        <div className="flex items-center gap-3">
                                            {isGroupSelected ? (
                                                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider italic bg-amber-400/10 px-3 py-1 rounded-lg border border-amber-400/20">
                                                    Section Targeted
                                                </span>
                                            ) : isManuallySelected ? (
                                                <div className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
                                                    <Check size={14} strokeWidth={3} />
                                                </div>
                                            ) : (
                                                <div className="w-6 h-6 rounded-lg border-2 border-slate-700 group-hover:border-slate-500 shrink-0"></div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {loadingStudents && (
                                <div className="flex items-center justify-center py-6 gap-3">
                                    <Loader2 className="animate-spin text-amber-400" size={16} />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest italic animate-pulse">Syncing student database...</span>
                                </div>
                            )}

                            {students.length === 0 && !loadingStudents && (
                                <div className="text-center py-12 space-y-2">
                                    <Users size={32} className="text-slate-700 mx-auto" />
                                    <h4 className="font-black text-slate-500 uppercase tracking-wider italic text-sm">No DB Students Found</h4>
                                    <p className="text-xs text-slate-600 font-bold">Verify that the filters match existing records in the database.</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer Save Actions */}
                <div className="p-8 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-4">
                    <button 
                        onClick={onClose}
                        className="bg-white/5 border border-white/10 hover:bg-white/10 text-white px-8 py-4 rounded-2xl font-black italic uppercase tracking-tighter text-sm transition-all active:scale-95"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSaveAssignment}
                        disabled={isSaving}
                        className="flex-1 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 px-8 py-4 rounded-2xl font-black italic uppercase tracking-tighter text-sm transition-all active:scale-95 shadow-xl shadow-amber-400/10 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="animate-spin" size={16} />
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
