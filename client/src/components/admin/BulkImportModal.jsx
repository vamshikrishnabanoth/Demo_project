import React, { useState } from 'react';
import {
    X, Upload, FileText, CheckCircle2, AlertTriangle,
    Download, ArrowRight, Loader2, Info, Hash, User,
    Mail, BookOpen, Grid, Calendar, BookMarked, Phone,
    Heart, ShieldCheck, CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const REQUIRED_FIELDS = [
    { name: 'Roll Number', key: 'rollNumber', icon: Hash, example: '24BD1A0501' },
    { name: 'Full Name',   key: 'name',       icon: User, example: 'Rahul Sharma' },
    { name: 'Email',       key: 'email',      icon: Mail, example: '24bd1a0501@kmit.in' },
    { name: 'Branch',      key: 'branch',     icon: BookOpen, example: 'CSE' },
    { name: 'Year',        key: 'year',       icon: Calendar, example: '1' },
    { name: 'Semester',    key: 'semester',   icon: BookMarked, example: '1' },
    { name: 'Section',     key: 'section',    icon: Grid, example: 'A' },
];

const OPTIONAL_FIELDS = [
    { name: 'Phone Number', key: 'phone', icon: Phone, example: '9876543210' },
    { name: 'Gender',       key: 'gender', icon: Heart, example: 'Male' },
    { name: 'Date of Admission', key: 'admissionDate', example: '2024-08-01' },
    { name: 'Status',       key: 'status', example: 'active' },
];

export default function BulkImportModal({ onClose, onSuccess }) {
    const [rawText, setRawText] = useState('');
    const [fileName, setFileName] = useState('');
    const [validStudents, setValidStudents] = useState([]);
    const [validationErrors, setValidationErrors] = useState([]);
    const [validating, setValidating] = useState(false);
    const [importing, setImporting] = useState(false);
    const [step, setStep] = useState(1); // 1 = Upload, 2 = Validation Results

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target?.result;
            if (typeof text === 'string') {
                setRawText(text);
                runValidation(text);
            }
        };
        reader.readAsText(file);
    };

    const parseTextToObjects = (content) => {
        const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return [];

        const firstLower = lines[0].toLowerCase();
        const hasHeader = firstLower.includes('roll') || firstLower.includes('username') || firstLower.includes('email');
        const rows = hasHeader ? lines.slice(1) : lines;

        return rows.map((line) => {
            const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
            return {
                rollNumber: cols[0],
                name:       cols[1],
                email:      cols[2],
                branch:     cols[3],
                year:       cols[4],
                semester:   cols[5],
                section:    cols[6],
                phone:      cols[7] || '',
                gender:     cols[8] || '',
                admissionDate: cols[9] || '',
                status:     cols[10] || 'active'
            };
        });
    };

    const runValidation = async (contentToValidate) => {
        const text = contentToValidate || rawText;
        if (!text.trim()) {
            toast.error('Please upload or paste CSV data to validate');
            return;
        }

        const parsedRows = parseTextToObjects(text);
        if (parsedRows.length === 0) {
            toast.error('No rows found in file');
            return;
        }

        setValidating(true);
        try {
            const res = await api.post('/admin/import/validate', { students: parsedRows });
            setValidStudents(res.data.valid || []);
            setValidationErrors(res.data.invalid || []);
            setStep(2);
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Validation failed');
        } finally {
            setValidating(false);
        }
    };

    const handleExecuteImport = async () => {
        if (validStudents.length === 0) {
            toast.error('No valid student records to import');
            return;
        }
        setImporting(true);
        try {
            const res = await api.post('/admin/import', { students: validStudents });
            toast.success(res.data.msg || `Successfully imported ${res.data.successCount} students!`);
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Import execution failed');
        } finally {
            setImporting(false);
        }
    };

    const downloadSampleCSV = () => {
        const header = 'RollNumber,Name,Email,Branch,Year,Semester,Section,Phone,Gender,DateOfAdmission,Status';
        const sampleRow = '24BD1A0501,Rahul Sharma,24bd1a0501@kmit.in,CSE,1,1,A,9876543210,Male,2024-08-01,active';
        const blob = new Blob([[header, sampleRow].join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'KMIT_Student_Import_Template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

                <motion.div initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="relative z-10 w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">

                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-200 bg-sky-50/70 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-sky-100 border border-sky-200 text-sky-700">
                                <Upload size={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900">Bulk Student Import Portal</h3>
                                <p className="text-xs text-slate-500 font-medium">Enterprise University Data Ingestion — Mandatory Field Validation Enabled</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 p-6 space-y-5">
                        {step === 1 ? (
                            <>
                                {/* Required & Optional Columns Schema Display */}
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                            <Info size={14} className="text-sky-600" /> Mandatory & Optional Column Format
                                        </h4>
                                        <button onClick={downloadSampleCSV} className="text-xs font-bold text-sky-700 hover:underline flex items-center gap-1.5 cursor-pointer">
                                            <Download size={13} /> Download CSV Template
                                        </button>
                                    </div>

                                    {/* Required List */}
                                    <div>
                                        <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1.5">Required Fields (Must be non-empty & valid):</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                            {REQUIRED_FIELDS.map(f => (
                                                <div key={f.key} className="p-2 bg-white border border-rose-200 rounded-xl text-[11px]">
                                                    <span className="font-extrabold text-slate-900">{f.name}</span>
                                                    <span className="text-rose-500 font-bold ml-1">*</span>
                                                    <p className="text-[10px] text-slate-400 font-mono truncate">{f.example}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Optional List */}
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Optional Fields:</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                            {OPTIONAL_FIELDS.map(f => (
                                                <div key={f.key} className="p-2 bg-white border border-slate-200 rounded-xl text-[11px]">
                                                    <span className="font-semibold text-slate-700">{f.name}</span>
                                                    <p className="text-[10px] text-slate-400 font-mono truncate">{f.example}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* File Drop Zone */}
                                <div className="border-2 border-dashed border-sky-300 hover:border-sky-500 rounded-2xl p-7 text-center bg-sky-50/20 transition-all">
                                    <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" id="csv-upload" />
                                    <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                        <div className="w-12 h-12 rounded-2xl bg-white border border-sky-200 shadow-xs flex items-center justify-center text-sky-600">
                                            <FileText size={24} />
                                        </div>
                                        <p className="text-sm font-bold text-slate-900 mt-1">
                                            {fileName ? `📄 ${fileName}` : 'Click to Upload CSV / Excel File'}
                                        </p>
                                        <p className="text-xs text-slate-500 font-medium">Accepts CSV formatted text files</p>
                                    </label>
                                </div>

                                {/* Paste Raw CSV */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Or Paste Raw CSV Lines</label>
                                    <textarea
                                        value={rawText}
                                        onChange={e => setRawText(e.target.value)}
                                        rows={5}
                                        placeholder={`RollNumber,Name,Email,Branch,Year,Semester,Section,Phone\n24BD1A0501,Rahul Sharma,24bd1a0501@kmit.in,CSE,1,1,A,9876543210`}
                                        className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-sky-500 transition-all resize-none"
                                    />
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <button onClick={downloadSampleCSV} className="text-xs font-bold text-sky-700 hover:underline flex items-center gap-1.5 cursor-pointer">
                                        <Download size={14} /> Download Sample Template
                                    </button>
                                    <button onClick={() => runValidation()} disabled={validating || !rawText.trim()}
                                        className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40">
                                        {validating ? <><Loader2 size={14} className="animate-spin" /> Validating...</> : <>Validate Batch <ArrowRight size={14} /></>}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Validation Summary Banner */}
                                <div className={`p-4 rounded-2xl border flex items-center justify-between ${validStudents.length > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 size={20} className={validStudents.length > 0 ? 'text-emerald-600' : 'text-rose-600'} />
                                        <div>
                                            <h4 className="text-sm font-extrabold text-slate-900">
                                                ✔ {validStudents.length} student(s) ready to import
                                            </h4>
                                            {validationErrors.length > 0 && (
                                                <p className="text-xs text-rose-700 font-semibold mt-0.5">
                                                    ⚠️ {validationErrors.length} invalid row(s) flagged and excluded
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={() => setStep(1)} className="text-xs font-bold text-slate-700 hover:underline cursor-pointer">
                                        Change Data
                                    </button>
                                </div>

                                {/* Validation Errors Table (if any) */}
                                {validationErrors.length > 0 && (
                                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
                                        <div className="flex items-center gap-2 text-rose-900 text-xs font-extrabold">
                                            <AlertTriangle size={15} />
                                            <span>Validation Failures ({validationErrors.length} rows):</span>
                                        </div>
                                        <div className="max-h-36 overflow-y-auto space-y-1">
                                            {validationErrors.map((err, idx) => (
                                                <div key={idx} className="p-2 rounded-lg bg-white border border-rose-200 text-xs flex items-center justify-between">
                                                    <span className="font-extrabold text-rose-900">Row #{err.rowNum}: {err.rollNumber || err.name || 'Unknown'}</span>
                                                    <span className="text-rose-700 font-semibold">{err.reasons}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Valid Students Preview */}
                                {validStudents.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Valid Import Queue ({validStudents.length} records):</p>
                                        <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-700 sticky top-0">
                                                    <tr>
                                                        <th className="p-2.5">#</th>
                                                        <th className="p-2.5">Roll No</th>
                                                        <th className="p-2.5">Name</th>
                                                        <th className="p-2.5">Email</th>
                                                        <th className="p-2.5">Branch</th>
                                                        <th className="p-2.5">Yr/Sem/Sec</th>
                                                        <th className="p-2.5">Auto Password</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                                    {validStudents.map((s, i) => (
                                                        <tr key={i} className="hover:bg-slate-50">
                                                            <td className="p-2.5 text-slate-400 font-bold">{i + 1}</td>
                                                            <td className="p-2.5 font-bold text-sky-700">{s.username}</td>
                                                            <td className="p-2.5 font-semibold text-slate-900">{s.name}</td>
                                                            <td className="p-2.5 text-slate-500 truncate max-w-[140px]">{s.email}</td>
                                                            <td className="p-2.5 font-bold text-emerald-700">{s.studentBranch}</td>
                                                            <td className="p-2.5">Y{s.year} / S{s.semester} / {s.section}</td>
                                                            <td className="p-2.5 font-mono text-emerald-700 bg-emerald-50 rounded">{s.password}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between pt-2">
                                    <button onClick={() => setStep(1)} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer">
                                        ← Back to Upload
                                    </button>
                                    <button onClick={handleExecuteImport} disabled={importing || validStudents.length === 0}
                                        className="px-8 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-40">
                                        {importing ? <><Loader2 size={16} className="animate-spin" /> Ingesting Data...</> : <>Import Students ({validStudents.length}) <ArrowRight size={15} /></>}
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
