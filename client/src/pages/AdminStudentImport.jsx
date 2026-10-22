import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Upload, FileText, CheckCircle2, AlertTriangle,
    Download, ArrowRight, Loader2, Info, Hash, User,
    Mail, BookOpen, Grid, Calendar, BookMarked, Phone,
    Heart, ChevronLeft, ArrowLeft, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';

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

export default function AdminStudentImport() {
    const navigate = useNavigate();
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
            navigate('/admin-dashboard?tab=students');
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
        <DashboardLayout role="admin">
            <div className="space-y-6 max-w-6xl mx-auto pb-24">
                
                {/* Breadcrumbs */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <nav className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <Link to="/admin-dashboard" className="hover:text-slate-900 transition-colors">
                            Admin Center
                        </Link>
                        <span>/</span>
                        <Link to="/admin-dashboard?tab=students" className="hover:text-slate-900 transition-colors">
                            Students Directory
                        </Link>
                        <span>/</span>
                        <span className="text-slate-900 font-black">Bulk CSV Import</span>
                    </nav>

                    <button
                        onClick={() => navigate('/admin-dashboard?tab=students')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider border-2 border-slate-200 transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                        <ArrowLeft size={14} /> Back to Directory
                    </button>
                </div>

                {/* Header Banner */}
                <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-sky-100 border-2 border-sky-200 text-sky-700 flex items-center justify-center shrink-0">
                            <Upload size={28} />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-sky-700 bg-sky-50 px-2.5 py-1 rounded-md border border-sky-200">
                                Step {step} of 2 • {step === 1 ? 'Data Ingestion' : 'Validation & Commit'}
                            </span>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                                Bulk Student Import Portal
                            </h1>
                            <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                Ingest student records directly into the institution directory with automated validation.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={downloadSampleCSV}
                        className="px-5 py-3 rounded-2xl bg-white hover:bg-slate-50 text-sky-700 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-2 border-sky-200 transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                        <Download size={16} /> Download CSV Template
                    </button>
                </div>

                {step === 1 ? (
                    <div className="space-y-6">
                        
                        {/* Schema Guidelines Card */}
                        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                    <Info size={16} className="text-sky-600" />
                                    Required Columns & Format
                                </h2>
                                <span className="text-xs text-rose-600 font-bold">* Mandatory fields</span>
                            </div>

                            <div>
                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2.5">
                                    Required Columns (All 7 must exist in CSV):
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                                    {REQUIRED_FIELDS.map(f => {
                                        const Icon = f.icon;
                                        return (
                                            <div key={f.key} className="p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl">
                                                <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                                                    <Icon size={14} className="text-sky-600" />
                                                    <span>{f.name}</span>
                                                    <span className="text-rose-500 font-black">*</span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-mono mt-1 truncate">
                                                    e.g. {f.example}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2.5">
                                    Optional Columns:
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    {OPTIONAL_FIELDS.map(f => (
                                        <div key={f.key} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                                            <span className="text-xs font-bold text-slate-700">{f.name}</span>
                                            <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                                                e.g. {f.example}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* File Dropzone Card */}
                        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                Upload File or Paste Lines
                            </h2>

                            <div className="border-2 border-dashed border-sky-300 hover:border-sky-500 rounded-3xl p-8 sm:p-12 text-center bg-sky-50/20 transition-all cursor-pointer">
                                <input 
                                    type="file" 
                                    accept=".csv,.txt" 
                                    onChange={handleFileUpload} 
                                    className="hidden" 
                                    id="csv-file-upload-page" 
                                />
                                <label htmlFor="csv-file-upload-page" className="cursor-pointer flex flex-col items-center gap-3">
                                    <div className="w-16 h-16 rounded-2xl bg-white border-2 border-sky-200 shadow-sm flex items-center justify-center text-sky-600">
                                        <FileText size={32} />
                                    </div>
                                    <div>
                                        <p className="text-base font-black text-slate-900">
                                            {fileName ? fileName : 'Click to select or drop CSV file here'}
                                        </p>
                                        <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                            Accepts standard UTF-8 comma-separated value (.csv) files
                                        </p>
                                    </div>
                                </label>
                            </div>

                            {/* Direct Paste */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                                    Or Paste CSV Content Directly
                                </label>
                                <textarea
                                    value={rawText}
                                    onChange={e => setRawText(e.target.value)}
                                    rows={6}
                                    placeholder={`RollNumber,Name,Email,Branch,Year,Semester,Section\n24BD1A0501,Rahul Sharma,24bd1a0501@kmit.in,CSE,1,1,A\n24BD1A0502,Priya Patel,24bd1a0502@kmit.in,CSE,1,1,A`}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition-all resize-y"
                                />
                            </div>

                            {/* Action Row */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => navigate('/admin-dashboard?tab=students')}
                                    className="px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider border-2 border-slate-200 transition-all cursor-pointer active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => runValidation()}
                                    disabled={validating || !rawText.trim()}
                                    className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm border-2 border-[#ea580c] cursor-pointer active:scale-95 disabled:opacity-50"
                                >
                                    {validating ? (
                                        <>
                                            <RefreshCw className="animate-spin text-amber-300" size={16} />
                                            <span>Validating Rows...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Validate CSV Batch</span>
                                            <ArrowRight size={16} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="space-y-6">
                        
                        {/* Validation Result Stats Banner */}
                        <div className={`p-6 sm:p-8 rounded-3xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${validStudents.length > 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${validStudents.length > 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                                    <CheckCircle2 size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">
                                        {validStudents.length} Valid Student Record{validStudents.length === 1 ? '' : 's'} Ready to Ingest
                                    </h3>
                                    {validationErrors.length > 0 && (
                                        <p className="text-xs text-rose-700 font-bold mt-1 flex items-center gap-1.5">
                                            <AlertTriangle size={14} />
                                            <span>{validationErrors.length} invalid row(s) flagged and excluded from import.</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="px-5 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-black uppercase tracking-wider border-2 border-slate-300 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                            >
                                Re-upload / Edit Data
                            </button>
                        </div>

                        {/* Error Breakdown Card */}
                        {validationErrors.length > 0 && (
                            <div className="bg-white border-2 border-rose-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b border-rose-100 pb-3">
                                    <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider flex items-center gap-2">
                                        <AlertTriangle size={16} className="text-rose-600" />
                                        Validation Errors ({validationErrors.length} rows)
                                    </h4>
                                    <span className="text-[11px] text-rose-600 font-semibold">These rows will be skipped</span>
                                </div>
                                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                    {validationErrors.map((err, idx) => (
                                        <div key={idx} className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <span className="font-black text-rose-950 font-mono">
                                                Row #{err.rowNum}: {err.rollNumber || err.name || 'Unnamed'}
                                            </span>
                                            <span className="text-rose-700 font-semibold">{err.reasons}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Valid Students Queue Card */}
                        {validStudents.length > 0 && (
                            <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                        Valid Students Ingestion Queue ({validStudents.length} records)
                                    </h4>
                                    <span className="text-xs text-emerald-700 font-bold">Default password generated automatically</span>
                                </div>

                                <div className="border-2 border-slate-100 rounded-2xl overflow-hidden overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-100 border-b-2 border-slate-200 font-black text-slate-700 uppercase tracking-wider">
                                            <tr>
                                                <th className="p-3">#</th>
                                                <th className="p-3">Roll No</th>
                                                <th className="p-3">Full Name</th>
                                                <th className="p-3">Email Address</th>
                                                <th className="p-3">Branch</th>
                                                <th className="p-3">Yr / Sem / Sec</th>
                                                <th className="p-3">Password</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y-2 divide-slate-100 font-bold text-slate-800">
                                            {validStudents.map((s, i) => (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-3 text-slate-400">{i + 1}</td>
                                                    <td className="p-3 font-black text-sky-700 font-mono">{s.username}</td>
                                                    <td className="p-3 text-slate-900 uppercase italic">{s.name}</td>
                                                    <td className="p-3 text-slate-500 font-medium">{s.email}</td>
                                                    <td className="p-3">
                                                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black uppercase">
                                                            {s.studentBranch}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 font-bold text-slate-700">Y{s.year} / S{s.semester} / Sec {s.section}</td>
                                                    <td className="p-3">
                                                        <code className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                            {s.password}
                                                        </code>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Action Bar */}
                        <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider border-2 border-slate-200 transition-all cursor-pointer active:scale-95"
                            >
                                <ChevronLeft size={16} /> Back to Upload
                            </button>

                            <button
                                type="button"
                                onClick={handleExecuteImport}
                                disabled={importing || validStudents.length === 0}
                                className="flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm border-2 border-[#ea580c] cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                {importing ? (
                                    <>
                                        <RefreshCw className="animate-spin text-amber-300" size={16} />
                                        <span>Ingesting Students...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} />
                                        <span>Commit & Ingest {validStudents.length} Students</span>
                                    </>
                                )}
                            </button>
                        </div>

                    </div>
                )}

            </div>
        </DashboardLayout>
    );
}
