import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { FileText, Upload, Loader2, CheckCircle, FilePlus, Hash } from 'lucide-react';

export default function CreateQuizPDF() {
    const [title, setTitle] = useState('');
    const [file, setFile] = useState(null);
    const [questionCount, setQuestionCount] = useState(5);
    const [difficulty, setDifficulty] = useState('Medium');
    const [timer, setTimer] = useState(30);
    const [duration, setDuration] = useState(0); // Global duration in minutes
    const [loading, setLoading] = useState(false);
    const [isLive, setIsLive] = useState(false);

    const navigate = useNavigate();

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) return alert('Please select a file');

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('pdf', file);
            formData.append('title', title || file.name.replace('.pdf', ''));
            formData.append('type', 'pdf');
            formData.append('questionCount', questionCount.toString());
            formData.append('difficulty', difficulty);
            formData.append('difficulty', difficulty);
            formData.append('timerPerQuestion', timer.toString());
            formData.append('duration', duration.toString());
            formData.append('isLive', isLive.toString());

            const res = await api.post('/quiz/create', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (isLive) {
                navigate(`/live-room-teacher/${res.data.joinCode}`);
            } else {
                navigate('/teacher-dashboard');
                alert('Quiz Generated from PDF Successfully!');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to generate quiz');
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-2xl mx-auto py-8">
                <div className="mb-8 flex items-center gap-3">
                    <div className="bg-red-100 p-2 rounded-lg">
                        <FileText className="text-red-600" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Create from PDF</h1>
                        <p className="text-gray-500">Upload a document to generate questions.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="relative bg-white rounded-2xl shadow-lg border-2 border-red-50 p-8 space-y-8">


                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Quiz Title (Optional)</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-4 border-none bg-gray-50 rounded-xl focus:ring-2 focus:ring-red-500"
                            placeholder="e.g. Chapter 1 Review"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-100">
                            <label className="flex items-center gap-2 text-sm font-bold text-blue-800 mb-3 uppercase tracking-wide">
                                <Hash size={18} /> Questions
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value={questionCount}
                                onChange={(e) => setQuestionCount(parseInt(e.target.value) || 0)}
                                className="w-full p-4 border-2 border-blue-200 bg-white rounded-xl focus:ring-2 focus:ring-blue-500 font-black text-xl text-blue-900"
                                required
                            />
                        </div>

                        <div className="bg-purple-50 p-6 rounded-2xl border-2 border-purple-100">
                            <label className="flex items-center gap-2 text-sm font-bold text-purple-800 mb-3 uppercase tracking-wide">
                                Difficulty Level
                            </label>
                            <select
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value)}
                                className="w-full p-4 border-2 border-purple-200 bg-white rounded-xl focus:ring-2 focus:ring-purple-500 font-bold text-lg text-purple-900"
                            >
                                <option value="Easy">Easy</option>
                                <option value="Medium">Medium</option>
                                <option value="Thinkable">Thinkable</option>
                                <option value="Hard">Hard</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-orange-50 p-6 rounded-2xl border-2 border-orange-100">
                        <label className="flex items-center gap-2 text-sm font-bold text-orange-800 mb-3 uppercase tracking-wide">
                            Timer per Question (Seconds)
                        </label>
                        <input
                            type="number"
                            min="10"
                            max="300"
                            value={timer}
                            onChange={(e) => setTimer(parseInt(e.target.value) || 0)}
                            className="w-full p-4 border-2 border-orange-200 bg-white rounded-xl focus:ring-2 focus:ring-orange-500 font-black text-xl text-orange-900"
                            required
                        />
                    </div>



                    <div className="bg-orange-50 p-6 rounded-2xl border-2 border-orange-100">
                        <label className="flex items-center gap-2 text-sm font-bold text-orange-800 mb-3 uppercase tracking-wide">
                            Global Timer (Minutes)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="180"
                            value={duration}
                            onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                            className="w-full p-4 border-2 border-orange-200 bg-white rounded-xl focus:ring-2 focus:ring-orange-500 font-black text-xl text-orange-900"
                            placeholder="0 = No Limit"
                        />
                        <p className="text-xs text-orange-600 mt-2">Optional: Overrides per-question timer if set {'>'} 0</p>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">Select Document</label>
                        <div className="relative border-2 border-dashed border-gray-200 rounded-2xl hover:border-red-400 transition-colors bg-gray-50/50">
                            <input
                                type="file"
                                accept=".pdf"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                required
                            />
                            <div className="p-12 flex flex-col items-center gap-4">
                                {file ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="bg-red-50 p-4 rounded-full text-red-600">
                                            <FilePlus size={40} />
                                        </div>
                                        <p className="font-bold text-gray-900">{file.name}</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="bg-white p-4 rounded-full text-gray-400 shadow-sm">
                                            <Upload size={40} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-gray-700 font-bold">Click to upload or drag and drop</p>
                                            <p className="text-xs text-gray-400 mt-1 uppercase">PDF only (Max 10MB)</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Live Room Option */}
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-2xl border-2 border-indigo-100">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isLive}
                                onChange={(e) => setIsLive(e.target.checked)}
                                className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                            />
                            <div>
                                <span className="font-bold text-gray-900 text-lg">Create Live Room</span>
                                <p className="text-sm text-gray-600 mt-1">Students join with a code and take the quiz together in real-time</p>
                            </div>
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !file}
                        className="w-full flex items-center justify-center gap-3 bg-red-600 text-white px-8 py-5 rounded-2xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl hover:shadow-2xl font-black text-xl uppercase tracking-widest mt-4"
                    >
                        {loading ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={24} />}
                        {loading ? 'Processing Document...' : (isLive ? 'Create Live Room' : 'Generate AI Quiz')}
                    </button>
                </form>
            </div >
        </DashboardLayout >
    );
}
