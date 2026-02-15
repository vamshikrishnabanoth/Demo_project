import React, { useContext } from 'react';
import AuthContext from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function RoleSelection() {
    const { setRole } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleRoleSelect = async (role) => {
        try {
            await setRole(role);
            if (role === 'teacher') navigate('/teacher-dashboard');
            if (role === 'student') navigate('/student-dashboard');
            if (role === 'admin') navigate('/admin-dashboard');
        } catch (err) {
            console.error(err);
            alert('Error setting role');
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 space-y-8">
            <h1 className="text-3xl font-bold">Select Your Role</h1>
            <p className="text-gray-600">This action cannot be undone.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button
                    onClick={() => handleRoleSelect('teacher')}
                    className="p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow flex flex-col items-center space-y-4 border hover:border-indigo-500 w-64"
                >
                    <span className="text-4xl">👨‍🏫</span>
                    <h2 className="text-xl font-semibold">Teacher</h2>
                    <p className="text-center text-gray-500 text-sm">Create quizzes and manage students</p>
                </button>
                <button
                    onClick={() => handleRoleSelect('student')}
                    className="p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow flex flex-col items-center space-y-4 border hover:border-indigo-500 w-64"
                >
                    <span className="text-4xl">🎓</span>
                    <h2 className="text-xl font-semibold">Student</h2>
                    <p className="text-center text-gray-500 text-sm">Join quizzes and track progress</p>
                </button>
                <button
                    onClick={() => handleRoleSelect('admin')}
                    className="p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow flex flex-col items-center space-y-4 border hover:border-indigo-500 w-64"
                >
                    <span className="text-4xl">👮</span>
                    <h2 className="text-xl font-semibold">Admin</h2>
                    <p className="text-center text-gray-500 text-sm">Manage system and users</p>
                </button>
            </div>
        </div>
    );
}
