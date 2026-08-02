import React, { useState } from 'react';
import {
    X, Upload, FileText, CheckCircle2, AlertTriangle,
    Download, ArrowRight, Loader2, Info, Hash, User,
    Mail, BookOpen, Layers, Grid, Calendar, BookMarked
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../utils/api';

// Mandatory fields schema shown to the user
const FIELD_SCHEMA = [
    { key: 'rollNumber', label: 'Roll Number',   icon: Hash,       example: '24BD1A0501', required: true  },
    { key: 'name',       label: 'Student Name',  icon: User,       example: 'Rahul Sharma', required: true },
    { key: 'email',      label: 'Email',          icon: Mail,       example: '24bd1a0501@kmit.in', required: true },
    { key: 'branch',     label: 'Branch',         icon: BookOpen,   example: 'CSE', required: true },
    { key: 'year',       label: 'Year',           icon: Calendar,   example: '1', required: true },
    { key: 'section',    label: 'Section',        icon: Grid,       example: 'A', required: true },
    { key: 'semester',   label: 'Semester',       icon: BookMarked, example: '1', required: true },
];

export default function BulkImportModal({ onClose, onSuccess }) {
    const [rawText, setRawText] = useState('');
    const [fileName, setFileName] = useState('');
    const [parsedData, setParsedData] = useState([]);
    const [errors, setErrors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1 = Upload, 2 = Preview

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target?.result;
            if (typeof text === 'string') {
                setRawText(text);
                parseCSV(text);
            }
        };
        reader.readAsText(file);
    };

    const parseCSV = (content) => {
        const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) { toast.error('File is empty'); return; }

        const data = [];
        const errs = [];

        // Detect header row
        const firstLower = lines[0].toLowerCase();
        const hasHeader = firstLower.includes('roll') || firstLower.includes('name') || firstLower.includes('email');
        const rows = hasHeader ? lines.slice(1) : lines;

        rows.forEach((line, idx) => {
            const rowNum = idx + (hasHeader ? 2 : 1);
            const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));

            // Expected columns: rollNumber, name, email, branch, year, section, semester
            const [rollNumber, name, email, branch, year, section, semester] = cols;

            const missing = [];
            if (!rollNumber) missing.push('Roll Number');
            if (!name)       missing.push('Name');
            if (!email)      missing.push('Email');
            if (!branch)     missing.push('Branch');
            if (!year)       missing.push('Year');
            if (!section)    missing.push('Section');
            if (!semester)   missing.push('Semester');

            if (missing.length > 0) {
                errs.push(`Row ${rowNum}: Missing mandatory field(s) — ${missing.join(', ')}`);
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errs.push(`Row ${rowNum}: Invalid email (${email})`);
                return;
            }

            if (!['1','2','3','4'].includes(String(year))) {
                errs.push(`Row ${rowNum}: Year must be 1, 2, 3 or 4 (got "${year}")`);
                return;
            }

            if (!['1','2','3','4','5','6','7','8'].includes(String(semester))) {
                errs.push(`Row ${rowNum}: Semester must be 1–8 (got "${semester}")`);
                return;
            }

            // Auto-generate password as rollNumber@kk
            data.push({
                username: rollNumber,
                name,
                email,
                studentBranch: branch,
                year: String(year),
                section,
                semester: String(semester),
                password: `${rollNumber}@kk`,
                role: 'student'
            });
        });

        setParsedData(data);
        setErrors(errs);
        setStep(2);
    };

    const handleImportSubmit = async () => {
        if (parsedData.length === 0) { toast.error('No valid student records to import'); return; }
        setLoading(true);
        try {
            const res = await api.post('/admin/import', { students: parsedData });
            toast.success(res.data.msg || `Successfully imported ${res.data.successCount} students!`);
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Import failed. Please check your CSV and try again.');
        } finally {
            setLoading(false);
        }
    };

    const downloadSampleCSV = () => {
        const header = 'rollNumber,name,email,branch,year,section,semester';
        const rows = [
            '24BD1A0501,Rahul Sharma,24bd1a0501@kmit.in,CSE,1,A,1',
            '24BD1A0502,Priya Verma,24bd1a0502@kmit.in,CSE,1,B,1',
            '24BD1A0503,Anish Kumar,24bd1a0503@kmit.in,ECE,2,A,3',
            '24BD1A0504,Sneha Reddy,24bd1a0504@kmit.in,IT,3,C,5',
        ];
        const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'KMIT_students_import_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

                <motion.div initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="relative z-10 w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">

                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-sky-50/60 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-sky-100 border border-sky-200 text-sky-700">
                                <Upload size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900">Bulk Import Students</h3>
                                <p className="text-xs text-slate-500 font-medium">Upload a CSV file — passwords auto-set to <code className="bg-slate-100 px-1 rounded">[rollnumber]@kk</code></p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 p-6 space-y-5">
                        {step === 1 ? (
                            <>
                                {/* Mandatory Fields Schema */}
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden">
                                    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-white">
                                        <Info size={14} className="text-sky-600 shrink-0" />
                                        <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Required CSV Column Order</span>
                                        <span className="ml-auto text-[10px] font-bold text-rose-600 uppercase tracking-wider">All fields mandatory</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-y divide-slate-200">
                                        {FIELD_SCHEMA.map((f, i) => {
                                            const Icon = f.icon;
                                            return (
                                                <div key={f.key} className="p-3 flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-black text-slate-400">#{i + 1}</span>
                                                        <Icon size={11} className="text-sky-600" />
                                                        <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">{f.label}</span>
                                                        <span className="text-[9px] font-bold text-rose-500 ml-auto">*</span>
                                                    </div>
                                                    <code className="text-[10px] text-slate-500 font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded-md truncate">{f.example}</code>
                                                </div>
                                            );
                                        })}
                                        {/* 8th cell: auto password note */}
                                        <div className="p-3 flex flex-col gap-1 bg-emerald-50/50">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-black text-slate-400">#8</span>
                                                <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">Password</span>
                                                <span className="text-[9px] font-bold text-emerald-600 ml-auto">Auto</span>
                                            </div>
                                            <code className="text-[10px] text-emerald-700 font-mono bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">[roll]@kk</code>
                                        </div>
                                    </div>
                                </div>

                                {/* File Upload Drop Zone */}
                                <div className="border-2 border-dashed border-sky-300 hover:border-sky-500 rounded-2xl p-8 text-center bg-sky-50/30 transition-all">
                                    <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" id="csv-upload" />
                                    <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                        <div className="w-14 h-14 rounded-2xl bg-white border border-sky-200 shadow-sm flex items-center justify-center text-sky-600">
                                            <FileText size={28} />
                                        </div>
                                        <p className="text-sm font-bold text-slate-900 mt-1">
                                            {fileName ? `📄 ${fileName}` : 'Click to Upload CSV File'}
                                        </p>
                                        <p className="text-xs text-slate-500 font-medium">Accepts .csv · UTF-8 encoding</p>
                                    </label>
                                </div>

                                {/* Paste Raw CSV */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Or Paste Raw CSV Data</label>
                                    <textarea
                                        value={rawText}
                                        onChange={(e) => setRawText(e.target.value)}
                                        rows={5}
                                        placeholder={`rollNumber,name,email,branch,year,section,semester\n24BD1A0501,Rahul Sharma,24bd1a0501@kmit.in,CSE,1,A,1`}
                                        className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-sky-500 transition-all placeholder:text-slate-400 resize-none"
                                    />
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-between pt-1">
                                    <button onClick={downloadSampleCSV}
                                        className="flex items-center gap-2 text-xs font-bold text-sky-600 hover:text-sky-800 transition-all cursor-pointer hover:underline">
                                        <Download size={14} /> Download Sample Template
                                    </button>
                                    <button onClick={() => parseCSV(rawText)} disabled={!rawText.trim()}
                                        className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all disabled:opacity-40 cursor-pointer flex items-center gap-2">
                                        Preview Records <ArrowRight size={14} />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Summary Banner */}
                                <div className={`flex items-center justify-between rounded-xl p-3.5 ${parsedData.length > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
                                    <div className={`flex items-center gap-2.5 text-xs font-bold ${parsedData.length > 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                                        <CheckCircle2 size={16} />
                                        <span>{parsedData.length} valid record(s) ready · {errors.length} skipped</span>
                                    </div>
                                    <button onClick={() => { setStep(1); setParsedData([]); setErrors([]); }}
                                        className={`text-xs font-bold hover:underline cursor-pointer ${parsedData.length > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                        Change File
                                    </button>
                                </div>

                                {/* Password note */}
                                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                                    <Info size={13} className="text-amber-600 shrink-0" />
                                    <p className="text-xs font-semibold text-amber-800">
                                        Passwords will be auto-set to <strong>[roll number]@kk</strong> (e.g. <code>24BD1A0501@kk</code>). Students can change it after first login.
                                    </p>
                                </div>

                                {/* Error list */}
                                {errors.length > 0 && (
                                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-1.5">
                                        <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                                            <AlertTriangle size={14} />
                                            <span>Skipped {errors.length} invalid row(s):</span>
                                        </div>
                                        <ul className="text-[11px] text-rose-700 list-disc list-inside max-h-24 overflow-y-auto space-y-0.5 font-medium">
                                            {errors.map((err, idx) => <li key={idx}>{err}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {/* Preview Table */}
                                {parsedData.length > 0 && (
                                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                                <tr>
                                                    <th className="p-2.5 font-extrabold text-slate-700">#</th>
                                                    <th className="p-2.5 font-extrabold text-slate-700">Roll No.</th>
                                                    <th className="p-2.5 font-extrabold text-slate-700">Name</th>
                                                    <th className="p-2.5 font-extrabold text-slate-700">Email</th>
                                                    <th className="p-2.5 font-extrabold text-slate-700">Branch</th>
                                                    <th className="p-2.5 font-extrabold text-slate-700">Yr/Sec/Sem</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                                {parsedData.map((row, i) => (
                                                    <tr key={i} className="hover:bg-slate-50/60">
                                                        <td className="p-2.5 text-slate-400 font-bold">{i + 1}</td>
                                                        <td className="p-2.5 font-bold text-sky-700">{row.username}</td>
                                                        <td className="p-2.5 font-semibold text-slate-900">{row.name}</td>
                                                        <td className="p-2.5 text-slate-500 truncate max-w-[140px]">{row.email}</td>
                                                        <td className="p-2.5 font-bold text-emerald-700">{row.studentBranch}</td>
                                                        <td className="p-2.5">Y{row.year} / {row.section} / Sem{row.semester}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Confirm Buttons */}
                                <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                                    <button onClick={() => { setStep(1); setParsedData([]); setErrors([]); }}
                                        className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer">
                                        ← Back
                                    </button>
                                    <button onClick={handleImportSubmit} disabled={loading || parsedData.length === 0}
                                        className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 transition-all">
                                        {loading
                                            ? <><Loader2 size={14} className="animate-spin" /> Importing...</>
                                            : `✅ Confirm & Import ${parsedData.length} Student${parsedData.length !== 1 ? 's' : ''}`}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
