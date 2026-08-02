import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertTriangle, Download, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../utils/api';

export default function BulkImportModal({ onClose, onSuccess }) {
    const [rawText, setRawText] = useState('');
    const [fileName, setFileName] = useState('');
    const [parsedData, setParsedData] = useState([]);
    const [errors, setErrors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Input/Upload, 2: Preview & Confirm

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result;
            if (typeof text === 'string') {
                setRawText(text);
                parseCSV(text);
            }
        };
        reader.readAsText(file);
    };

    const parseCSV = (content) => {
        const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) {
            toast.error('File is empty');
            return;
        }

        const data = [];
        const errs = [];

        // Check if first line is header
        const firstLine = lines[0].toLowerCase();
        const hasHeader = firstLine.includes('username') || firstLine.includes('roll') || firstLine.includes('email');
        const rows = hasHeader ? lines.slice(1) : lines;

        rows.forEach((line, idx) => {
            const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
            if (cols.length < 3) {
                errs.push(`Row ${idx + 1}: Insufficient columns. Minimum required: Username, Email, Password`);
                return;
            }

            // Expected schema: Username/Roll, Email, Password, Name, Branch, Section, Year, Semester
            const [username, email, password, name, studentBranch, section, year, semester] = cols;

            if (!username || !email || !password) {
                errs.push(`Row ${idx + 1}: Missing Username, Email or Password`);
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errs.push(`Row ${idx + 1}: Invalid email address (${email})`);
            } else {
                data.push({
                    username,
                    email,
                    password,
                    name: name || username,
                    studentBranch: studentBranch || 'CSE',
                    section: section || 'A',
                    year: year || '1',
                    semester: semester || '1'
                });
            }
        });

        setParsedData(data);
        setErrors(errs);
        setStep(2);
    };

    const handleImportSubmit = async () => {
        if (parsedData.length === 0) {
            toast.error('No valid student records to import');
            return;
        }
        setLoading(true);
        try {
            const res = await api.post('/admin/import', { students: parsedData });
            toast.success(res.data.msg || `Successfully imported ${res.data.successCount} students!`);
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Import failed');
        } finally {
            setLoading(false);
        }
    };

    const downloadSampleCSV = () => {
        const sample = `username,email,password,name,studentBranch,section,year,semester
21A91A0501,student501@kmit.in,Pass1234,Rahul Sharma,CSE,A,1,1
21A91A0502,student502@kmit.in,Pass1234,Priya Verma,CSE,B,1,1
21A91A0503,student503@kmit.in,Pass1234,Anish Kumar,ECE,A,2,3`;
        const blob = new Blob([sample], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sample_students_import.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

                <motion.div initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="relative z-10 w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
                    
                    {/* Modal Header */}
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-sky-100 border border-sky-200 text-sky-700">
                                <Upload size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900">Bulk Import Students</h3>
                                <p className="text-xs text-slate-500 font-medium">Upload CSV file or paste formatted student records</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto flex-1 space-y-5">
                        {step === 1 ? (
                            <>
                                <div className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-2xl p-8 text-center bg-slate-50/50 transition-all">
                                    <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" id="csv-upload" />
                                    <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-sky-600">
                                            <FileText size={24} />
                                        </div>
                                        <p className="text-sm font-bold text-slate-900 mt-2">Click to upload CSV file</p>
                                        <p className="text-xs text-slate-500 font-medium">Accepts .csv or text formatted files</p>
                                    </label>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Or Paste Raw CSV Data</label>
                                    <textarea value={rawText} onChange={(e) => setRawText(e.target.value)}
                                        rows={6} placeholder="username,email,password,name,branch,section,year,semester&#10;21A91A0501,student@kmit.in,pass123,Rahul,CSE,A,1,1"
                                        className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-900 transition-all" />
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <button onClick={downloadSampleCSV} className="flex items-center gap-2 text-xs font-bold text-sky-600 hover:text-sky-800 transition-all cursor-pointer">
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
                                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                                    <div className="flex items-center gap-2.5 text-emerald-800 text-xs font-bold">
                                        <CheckCircle2 size={16} />
                                        <span>Ready to import {parsedData.length} valid student record(s)</span>
                                    </div>
                                    <button onClick={() => setStep(1)} className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer">
                                        Change File
                                    </button>
                                </div>

                                {errors.length > 0 && (
                                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-1">
                                        <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                                            <AlertTriangle size={15} />
                                            <span>Skipped {errors.length} invalid line(s):</span>
                                        </div>
                                        <ul className="text-[11px] text-rose-700 list-disc list-inside max-h-24 overflow-y-auto space-y-0.5 font-medium">
                                            {errors.map((err, idx) => <li key={idx}>{err}</li>)}
                                        </ul>
                                    </div>
                                )}

                                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-700 sticky top-0">
                                            <tr>
                                                <th className="p-2.5">Roll No</th>
                                                <th className="p-2.5">Name</th>
                                                <th className="p-2.5">Email</th>
                                                <th className="p-2.5">Branch</th>
                                                <th className="p-2.5">Sec</th>
                                                <th className="p-2.5">Year/Sem</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                            {parsedData.map((row, i) => (
                                                <tr key={i} className="hover:bg-slate-50/50">
                                                    <td className="p-2.5 font-bold text-slate-900">{row.username}</td>
                                                    <td className="p-2.5">{row.name}</td>
                                                    <td className="p-2.5 text-slate-500">{row.email}</td>
                                                    <td className="p-2.5 font-semibold text-sky-700">{row.studentBranch}</td>
                                                    <td className="p-2.5">{row.section}</td>
                                                    <td className="p-2.5">Y{row.year} / S{row.semester}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                                    <button onClick={() => setStep(1)} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer">
                                        Back
                                    </button>
                                    <button onClick={handleImportSubmit} disabled={loading || parsedData.length === 0}
                                        className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer flex items-center gap-2 disabled:opacity-40">
                                        {loading ? <><Loader2 size={14} className="animate-spin" /> Importing...</> : `Confirm & Import ${parsedData.length} Students`}
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
