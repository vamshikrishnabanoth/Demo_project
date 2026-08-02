import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import api from '../utils/api';
import AuthContext from './AuthContext';

const AdminContext = createContext(null);

export const AdminProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const [stats, setStats] = useState({
        totalUsers: 0,
        students: 0,
        teachers: 0,
        admins: 0,
        activeToday: 0,
        onlineNow: 0,
        recentActivity: [],
        charts: {
            branchDistribution: [],
            yearDistribution: [],
            semesterDistribution: []
        }
    });
    const [loadingStats, setLoadingStats] = useState(true);

    const fetchStats = useCallback(async () => {
        if (!user || user.role !== 'admin') return;
        try {
            const res = await api.get('/admin/dashboard');
            setStats(res.data);
        } catch (err) {
            console.error('[AdminContext] Failed to fetch dashboard stats:', err);
        } finally {
            setLoadingStats(false);
        }
    }, [user]);

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchStats();
            // Polling interval every 60 seconds for live sync
            const interval = setInterval(fetchStats, 60000);
            return () => clearInterval(interval);
        }
    }, [user, fetchStats]);

    // Global trigger for any CRUD operation in students/teachers/admins/users
    const invalidate = useCallback(() => {
        fetchStats();
    }, [fetchStats]);

    return (
        <AdminContext.Provider value={{
            stats,
            loadingStats,
            refreshStats: fetchStats,
            invalidate
        }}>
            {children}
        </AdminContext.Provider>
    );
};

export const useAdmin = () => useContext(AdminContext);

export default AdminContext;
