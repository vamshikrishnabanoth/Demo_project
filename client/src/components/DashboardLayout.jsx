import React, { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import {
    LayoutDashboard,
    PlusCircle,
    BookOpen,
    LogOut,
    User,
    BarChart3,
    Settings
} from 'lucide-react';

export default function DashboardLayout({ children, role }) {
    const { logout, user } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path;

    const teacherLinks = [
        { name: 'Dashboard', path: '/teacher-dashboard', icon: LayoutDashboard },
        { name: 'My Quizzes', path: '/my-quizzes', icon: BookOpen },
        { name: 'Performance', path: '/performance', icon: BarChart3 },
    ];

    const studentLinks = [
        { name: 'Dashboard', path: '/student-dashboard', icon: LayoutDashboard },
        { name: 'Available Quizzes', path: '/student-dashboard', icon: BookOpen }, // Placeholder
    ];

    const adminLinks = [
        { name: 'Dashboard', path: '/admin-dashboard', icon: LayoutDashboard },
        { name: 'Users', path: '/admin/users', icon: User },
    ];

    let links = [];
    if (role === 'teacher') links = teacherLinks;
    else if (role === 'student') links = studentLinks;
    else if (role === 'admin') links = adminLinks;

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <div className="w-64 bg-white shadow-lg flex flex-col">
                <div className="p-6 border-b">
                    <h1 className="text-2xl font-bold text-indigo-600 flex items-center gap-2">
                        <span>✨</span> KMIT Khaoot
                    </h1>
                    <p className="text-xs text-gray-500 mt-1 capitalize">{role} Portal</p>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {links.map((link) => {
                        const Icon = link.icon;
                        return (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive(link.path)
                                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                <Icon size={20} />
                                {link.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t bg-gray-50">
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                            {user?.username?.[0]?.toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-gray-900 truncate">{user?.username}</p>
                            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <LogOut size={18} />
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <header className="bg-white shadow-sm p-4 flex justify-between items-center sm:hidden">
                    <span className="font-bold">KMIT Khaoot Platform</span>
                    {/* Mobile menu toggle would go here */}
                </header>
                <main className="p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
