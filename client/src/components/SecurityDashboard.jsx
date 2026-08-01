import React, { useState, useMemo } from 'react';
import { 
    ShieldAlert, 
    ShieldCheck, 
    AlertTriangle, 
    Search, 
    X, 
    ChevronRight, 
    User, 
    Clock, 
    Activity, 
    Layers, 
    AlertOctagon,
    Copy,
    Maximize,
    Minimize,
    MousePointer,
    Terminal,
    ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Violation Mapping Helpers
export const VIOLATION_CONFIG = {
    WINDOW_BLUR: { label: 'Window Blur', icon: Minimize, color: '#ef4444' },
    TAB_SWITCH: { label: 'Tab Switch', icon: ExternalLink, color: '#f97316' },
    FULLSCREEN_EXIT: { label: 'Fullscreen Exit', icon: Maximize, color: '#eab308' },
    SPLIT_SCREEN: { label: 'Split Screen', icon: Layers, color: '#a855f7' },
    COPY: { label: 'Copy Action', icon: Copy, color: '#3b82f6' },
    PASTE: { label: 'Paste Action', icon: Copy, color: '#10b981' },
    DEVTOOLS: { label: 'DevTools Opened', icon: Terminal, color: '#111827' },
    RIGHT_CLICK: { label: 'Right Click / Context', icon: MousePointer, color: '#78350f' },
    OTHER: { label: 'Security Violation', icon: AlertTriangle, color: '#64748b' }
};

// ── RISK BADGE COMPONENT ───────────────────────────────────────────────────
export function RiskBadge({ level = 'LOW' }) {
    const config = {
        CRITICAL: { label: 'Critical', bg: 'bg-red-600/15 border-red-600/30 text-red-600 dark:text-red-400', dot: 'bg-red-600 animate-ping' },
        HIGH: { label: 'High', bg: 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
        MEDIUM: { label: 'Medium', bg: 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
        LOW: { label: 'Low', bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
    }[level.toUpperCase()] || { label: 'Low', bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600', dot: 'bg-emerald-500' };

    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border shadow-xs ${config.bg}`}>
            <span className={`w-2 h-2 rounded-full ${config.dot}`} />
            {config.label}
        </span>
    );
}

// ── ANALYTICS SUMMARY CARDS ─────────────────────────────────────────────────
export function AnalyticsCards({ students = [] }) {
    const metrics = useMemo(() => {
        const totalStudents = students.length;
        const studentsWithViolations = students.filter(s => s.totalViolations > 0).length;
        const criticalRisk = students.filter(s => s.riskLevel === 'CRITICAL' || s.riskLevel === 'HIGH').length;
        const totalViolations = students.reduce((acc, s) => acc + (s.totalViolations || 0), 0);
        const avgViolations = totalStudents ? (totalViolations / totalStudents).toFixed(1) : 0;
        const highestViolations = students.reduce((max, s) => Math.max(max, s.totalViolations || 0), 0);

        return [
            { label: 'Total Students', value: totalStudents, sub: 'Audited roster', icon: User, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Flags Detected', value: studentsWithViolations, sub: 'Students flagged', icon: ShieldAlert, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { label: 'Critical / High', value: criticalRisk, sub: 'Action required', icon: AlertOctagon, color: 'text-red-500', bg: 'bg-red-500/10' },
            { label: 'Total Incidents', value: totalViolations, sub: 'Security telemetry', icon: Activity, color: 'text-purple-500', bg: 'bg-purple-500/10' },
            { label: 'Avg Violations', value: avgViolations, sub: 'Per student average', icon: Layers, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
            { label: 'Peak Violations', value: highestViolations, sub: 'Single max count', icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-500/10' }
        ];
    }, [students]);

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
            {metrics.map((m, idx) => (
                <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{m.label}</span>
                        <div className={`p-2 rounded-xl ${m.bg} ${m.color}`}>
                            <m.icon size={16} />
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-[var(--text-primary)] tracking-tight">{m.value}</div>
                        <div className="text-[10px] font-bold text-[var(--text-secondary)] opacity-70 mt-0.5 truncate">{m.sub}</div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

// ── VIOLATION BREAKDOWN WITH ANIMATED BARS ─────────────────────────────────
export function ViolationBreakdown({ eventCounts = {} }) {
    const sortedViolations = useMemo(() => {
        return Object.entries(VIOLATION_CONFIG).map(([key, config]) => ({
            key,
            ...config,
            count: eventCounts[key] || 0
        })).sort((a, b) => b.count - a.count);
    }, [eventCounts]);

    const maxCount = useMemo(() => Math.max(...sortedViolations.map(v => v.count), 1), [sortedViolations]);

    return (
        <div className="space-y-2">
            {sortedViolations.map((v) => {
                const Icon = v.icon;
                const percentage = Math.min(100, Math.round((v.count / maxCount) * 100));

                return (
                    <div key={v.key} className="h-9 flex flex-col justify-center space-y-1 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-primary)]">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <div className="p-0.5 rounded" style={{ backgroundColor: `${v.color}20`, color: v.color }}>
                                    <Icon size={12} />
                                </div>
                                <span className="truncate">{v.label}</span>
                            </div>
                            <span className="px-1.5 py-0.2 rounded-md text-[10px] font-black shrink-0" style={{ backgroundColor: `${v.color}20`, color: v.color }}>
                                {v.count}
                            </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: v.color }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── CHEATING TIMELINE ────────────────────────────────────────────────────────
export function Timeline({ timeline = [] }) {
    if (!timeline.length) {
        return <p className="text-xs text-[var(--text-secondary)] italic p-2">No detailed timestamps recorded.</p>;
    }

    return (
        <div className="space-y-2 relative before:absolute before:left-2.5 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-[var(--border-color)]">
            {timeline.map((item, idx) => {
                const config = VIOLATION_CONFIG[item.type] || VIOLATION_CONFIG.OTHER;
                const Icon = config.icon;

                return (
                    <div key={idx} className="relative flex items-center justify-between gap-2 pl-6 py-1 pr-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[11px] shadow-2xs">
                        <div 
                            className="absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full flex items-center justify-center border bg-[var(--bg-secondary)]" 
                            style={{ borderColor: config.color, color: config.color }}
                        >
                            <div className="w-1 h-1 rounded-full" style={{ backgroundColor: config.color }} />
                        </div>
                        <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 min-w-0 truncate" style={{ color: config.color }}>
                            <Icon size={12} className="shrink-0" />
                            <span className="truncate">{config.label}</span>
                        </span>
                        <span className="text-[10px] font-mono font-bold text-[var(--text-secondary)] shrink-0 flex items-center gap-1">
                            <Clock size={10} />
                            {item.time}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// ── MAIN SECURITY DASHBOARD CONTAINER ──────────────────────────────────────
export function SecurityDashboard({ students = [] }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState('HIGHEST_VIOLATIONS');
    const [selectedStudent, setSelectedStudent] = useState(null);

    // Filter & Sort Logic
    const filteredStudents = useMemo(() => {
        return students
            .filter(student => {
                const matchesSearch = 
                    (student.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (student.rollNumber || '').toLowerCase().includes(searchQuery.toLowerCase());

                return matchesSearch;
            })
            .sort((a, b) => {
                if (sortOption === 'HIGHEST_VIOLATIONS') return b.totalViolations - a.totalViolations;
                if (sortOption === 'STUDENT_NAME') return a.studentName.localeCompare(b.studentName);
                return 0;
            });
    }, [students, searchQuery, sortOption]);

    return (
        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-[2rem] p-6 shadow-xl space-y-6">
            {/* Header Title */}
            <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-xs">
                        <ShieldAlert size={26} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                            Security Audit & <span className="text-red-500">Proctoring Telemetry</span>
                        </h2>
                        <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider mt-0.5">
                            Student-Centric Aggregated Violations & Security Analysis
                        </p>
                    </div>
                </div>
            </div>

            {/* Top Metrics Cards */}
            <AnalyticsCards students={students} />

            {/* Main Content: Table or In-Place Security Audit Details Panel */}
            {selectedStudent ? (
                /* IN-PLACE SECURITY AUDIT DETAILS PANEL */
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-6 space-y-6 shadow-sm">
                    {/* Header with Back & Top X Close Button */}
                    <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setSelectedStudent(null)} 
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] text-xs font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--bg-accent)] transition-all cursor-pointer"
                            >
                                <ChevronRight size={16} className="rotate-180" /> Back to Table
                            </button>
                            <div className="h-4 w-px bg-[var(--border-color)]" />
                            <h3 className="text-base font-black uppercase text-[var(--text-primary)] tracking-tight">Security Audit Details</h3>
                        </div>
                        <button 
                            onClick={() => setSelectedStudent(null)}
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] hover:bg-red-500/10 hover:text-red-500 transition-colors cursor-pointer"
                            aria-label="Close details"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Student Info Summary (No Risk Level or Risk Score) */}
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] p-4 rounded-xl flex items-center justify-between flex-wrap gap-4 shadow-xs">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[var(--bg-accent)]/10 text-[var(--text-accent)] font-black flex items-center justify-center text-sm">
                                {(selectedStudent.studentName || 'S').charAt(0)}
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-[var(--text-primary)]">{selectedStudent.studentName}</h4>
                                <p className="text-xs font-mono font-bold text-[var(--text-secondary)]">{selectedStudent.department} • Section {selectedStudent.section}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div>
                                <span className="text-[10px] font-black uppercase text-[var(--text-secondary)] block">Roll Number</span>
                                <span className="text-xs font-mono font-bold text-[var(--text-primary)]">{selectedStudent.rollNumber}</span>
                            </div>
                            <div className="h-8 w-px bg-[var(--border-color)]" />
                            <div>
                                <span className="text-[10px] font-black uppercase text-[var(--text-secondary)] block">Total Violations</span>
                                <span className="px-2.5 py-0.5 rounded-md bg-red-500/10 text-red-500 font-black text-xs border border-red-500/20 inline-block mt-0.5">
                                    {selectedStudent.totalViolations}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Breakdown & Timeline Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Violation Breakdown */}
                        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-4 space-y-3 shadow-xs">
                            <div className="pb-2 border-b border-[var(--border-color)] flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">Violation Breakdown</h4>
                                <span className="text-[10px] text-[var(--text-secondary)] font-bold">Frequency Count</span>
                            </div>
                            <ViolationBreakdown eventCounts={selectedStudent.eventCounts} />
                        </div>

                        {/* Incident Timeline */}
                        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-4 space-y-3 shadow-xs">
                            <div className="pb-2 border-b border-[var(--border-color)] flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">Incident Timeline</h4>
                                <span className="text-[10px] text-[var(--text-secondary)] font-bold">Chronological Logs</span>
                            </div>
                            <Timeline timeline={selectedStudent.timeline} />
                        </div>
                    </div>
                </div>
            ) : (
                /* MAIN STUDENT AUDIT TABLE VIEW */
                <>
                    {/* Search & Sort Bar */}
                    <div className="bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)] shadow-xs flex items-center justify-between flex-wrap gap-4">
                        {/* Search Bar */}
                        <div className="relative flex-1 min-w-[240px]">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                            <input
                                type="text"
                                placeholder="Search student name or roll number..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--bg-accent)] transition-all"
                            />
                        </div>

                        {/* Sort Dropdown */}
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value)}
                            className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--bg-accent)] cursor-pointer"
                        >
                            <option value="HIGHEST_VIOLATIONS">Sort by: Highest Violations</option>
                            <option value="STUDENT_NAME">Sort by: Student Name</option>
                        </select>
                    </div>

                    {/* Table (4 Columns: Student, Roll Number, Total Violations, Actions) */}
                    <div className="overflow-x-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xs">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
                                <tr>
                                    <th className="p-4 text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-widest">Student</th>
                                    <th className="p-4 text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-widest">Roll Number</th>
                                    <th className="p-4 text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-widest text-center">Total Violations</th>
                                    <th className="p-4 text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-color)]">
                                {filteredStudents.length > 0 ? (
                                    filteredStudents.map((student, idx) => (
                                        <tr 
                                            key={student.rollNumber || idx}
                                            className="hover:bg-[var(--bg-primary)]/50 transition-colors group cursor-pointer"
                                            onClick={() => setSelectedStudent(student)}
                                        >
                                            <td className="p-4 font-bold text-xs text-[var(--text-primary)]">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-[var(--bg-accent)]/10 text-[var(--text-accent)] font-black flex items-center justify-center text-xs">
                                                        {(student.studentName || 'S').charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--text-accent)] transition-colors">
                                                            {student.studentName}
                                                        </div>
                                                        <div className="text-[10px] text-[var(--text-secondary)]">
                                                            {student.department} • Sec {student.section}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 font-mono font-bold text-xs text-[var(--text-secondary)]">
                                                {student.rollNumber}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-black">
                                                    {student.totalViolations}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedStudent(student);
                                                    }}
                                                    className="px-3.5 py-2 bg-[var(--bg-accent)] hover:opacity-90 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider inline-flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
                                                >
                                                    <span>View Details</span>
                                                    <ChevronRight size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-xs font-bold text-[var(--text-secondary)] italic">
                                            No student cheating logs found matching the filter criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
