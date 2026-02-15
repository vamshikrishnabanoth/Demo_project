import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import { FileText, Type, Book, Cpu, BarChart3, Users, PlayCircle } from 'lucide-react';

export default function TeacherDashboard() {
    const [stats, setStats] = useState({ totalQuizzes: 0, totalAttempts: 0, averageScore: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/quiz/stats');

                // API now returns array of quiz stats, calculate summary
                const quizArray = res.data || [];
                const totalQuizzes = quizArray.length;
                const totalAttempts = quizArray.reduce((sum, quiz) => sum + quiz.completionCount, 0);
                const averageScore = quizArray.length > 0
                    ? quizArray.reduce((sum, quiz) => sum + quiz.averageScore, 0) / quizArray.length
                    : 0;

                setStats({ totalQuizzes, totalAttempts, averageScore });
            } catch (err) {
                console.error('Error fetching dashboard stats', err);
                setStats({ totalQuizzes: 0, totalAttempts: 0, averageScore: 0 });
            } finally {
                // Done
            }
        };
        fetchStats();
    }, []);

    const creationOptions = [
        {
            title: 'From Text',
            description: 'Paste text/Manual questions.',
            icon: Type,
            color: 'bg-blue-500',
            path: '/create-quiz/text'
        },
        {
            title: 'From PDF',
            description: 'Upload a PDF document.',
            icon: FileText,
            color: 'bg-red-500',
            path: '/create-quiz/pdf'
        },
        {
            title: 'From Topic',
            description: 'AI generates from topic.',
            icon: Book,
            color: 'bg-green-500',
            path: '/create-quiz/topic'
        },
        {
            title: 'Advanced AI',
            description: 'Customize everything.',
            icon: Cpu,
            color: 'bg-purple-500',
            path: '/create-quiz/advanced'
        }
    ];

    return (
        <DashboardLayout role="teacher">
            <div className="space-y-8 pb-12">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 font-outfit">Main Dashboard</h1>
                    <p className="text-gray-500 mt-2">Welcome back! Here's a quick overview of your quiz activity.</p>
                </div>

                {/* Quick Stats Banner */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-blue-100 text-sm font-medium uppercase tracking-wide">Total Quizzes</p>
                                <p className="text-4xl font-black mt-2">{stats.totalQuizzes}</p>
                            </div>
                            <BarChart3 size={48} className="opacity-20" />
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-green-100 text-sm font-medium uppercase tracking-wide">Total Attempts</p>
                                <p className="text-4xl font-black mt-2">{stats.totalAttempts}</p>
                            </div>
                            <Users size={48} className="opacity-20" />
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-purple-100 text-sm font-medium uppercase tracking-wide">Avg Score</p>
                                <p className="text-4xl font-black mt-2">{Math.round(stats.averageScore)}</p>
                            </div>
                            <PlayCircle size={48} className="opacity-20" />
                        </div>
                    </div>
                </div>

                {/* Quiz Creation Options */}
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Quiz</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {creationOptions.map((option, idx) => {
                            const Icon = option.icon;
                            return (
                                <Link
                                    key={idx}
                                    to={option.path}
                                    className="group bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-indigo-500 hover:shadow-xl transition-all duration-300 cursor-pointer"
                                >
                                    <div className={`${option.color} w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                        <Icon className="text-white" size={28} />
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-lg mb-2">{option.title}</h3>
                                    <p className="text-gray-500 text-sm">{option.description}</p>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Quick Links */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">My Quizzes</h2>
                        <p className="text-gray-600 text-sm mb-4">
                            View and manage all your created quizzes, including join codes for live rooms.
                        </p>
                        <Link to="/my-quizzes" className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                            View My Quizzes
                        </Link>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Performance</h2>
                        <p className="text-gray-600 text-sm mb-4">
                            View detailed analytics and student performance across all your quizzes.
                        </p>
                        <Link to="/performance" className="inline-block bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-colors">
                            View Performance
                        </Link>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
