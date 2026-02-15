import { useState, useEffect } from 'react';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { FileText, Send, CheckCircle, Clock, Trash2, AlertCircle } from 'lucide-react';

export default function MyQuizzes() {
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchQuizzes = async () => {
        try {
            const res = await api.get('/quiz/my-quizzes');
            setQuizzes(res.data);
        } catch (err) {
            console.error('Error fetching quizzes', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuizzes();
    }, []);

    const togglePublish = async (quizId) => {
        try {
            const res = await api.put(`/quiz/publish/${quizId}`, {});
            setQuizzes(quizzes.map(q => q._id === quizId ? res.data : q));
        } catch (err) {
            console.error('Error publishing quiz', err);
            alert('Failed to update status');
        }
    };

    const handleDelete = async (quizId) => {
        if (!window.confirm('Are you sure you want to delete this quiz? All results will be permanently removed.')) {
            return;
        }

        try {
            await api.delete(`/quiz/${quizId}`);
            setQuizzes(quizzes.filter(q => q._id !== quizId));
            alert('Quiz deleted successfully');
        } catch (err) {
            console.error('Error deleting quiz', err);
            alert('Failed to delete quiz');
        }
    };

    return (
        <DashboardLayout role="teacher">
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 font-outfit">My Quizzes</h1>
                    <p className="text-gray-500 mt-2">Manage your quiz visibility and student access.</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                        <div className="flex items-center gap-2 text-gray-500 font-medium text-sm">
                            <FileText size={18} />
                            <span>Total: {quizzes.length} Quizzes</span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-20">
                            <div className="animate-spin text-indigo-600 inline-block mb-4">
                                <Clock size={32} />
                            </div>
                            <p className="text-gray-500">Loading your content...</p>
                        </div>
                    ) : quizzes.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {quizzes.map((quiz) => (
                                <div key={quiz._id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-xl ${quiz.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                            <FileText size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">{quiz.title}</h3>
                                            <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                                <span className="flex items-center gap-1"><Clock size={12} /> {new Date(quiz.createdAt).toLocaleDateString()}</span>
                                                <span>•</span>
                                                <span>{quiz.questions?.length || 0} Questions</span>
                                                <span>•</span>
                                                <span className={`font-bold px-2 py-0.5 rounded ${quiz.isActive ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                                                    {quiz.isActive ? 'LIVE' : 'DRAFT'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => togglePublish(quiz._id)}
                                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${quiz.isActive
                                                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'
                                                }`}
                                        >
                                            {quiz.isActive ? <CheckCircle size={18} /> : <Send size={18} />}
                                            {quiz.isActive ? 'Active' : 'Send to Students'}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(quiz._id)}
                                            className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            title="Delete Quiz"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 text-gray-400">
                            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertCircle size={40} className="opacity-20" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">No quizzes found</h3>
                            <p className="max-w-xs mx-auto text-sm mt-2">You haven't created any quizzes yet. Start creating to see them here!</p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
