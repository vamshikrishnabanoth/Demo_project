import React from 'react';
import { useContext } from 'react';
import AuthContext from '../context/AuthContext';

export default function AdminDashboard() {
    const { logout, user } = useContext(AuthContext);
    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p>Welcome, {user?.username}</p>
            <button onClick={logout} className="mt-4 bg-red-500 text-white px-4 py-2 rounded">Logout</button>
        </div>
    );
}
