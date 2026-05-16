import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { motion } from 'framer-motion';

// Maps a role to its home route
const ROLE_HOME = {
    teacher: '/teacher-dashboard',
    student: '/student-dashboard',
    admin:   '/admin-dashboard',
};

const ProtectedRoute = ({ children, roles = [], allowNone = false }) => {
    const { user, loading } = useContext(AuthContext);

    // While auth is being restored from localStorage, show a minimal spinner
    // (not "Loading..." text — that's jarring and looks broken)
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
                <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-6 h-6 rounded-full bg-[var(--bg-accent)]"
                />
            </div>
        );
    }

    // Not logged in → go to login
    if (!user) return <Navigate to="/login" replace />;

    // Role-selection page: redirect already-assigned users to their dashboard
    if (allowNone) {
        if (user.role !== 'none') {
            return <Navigate to={ROLE_HOME[user.role] ?? '/login'} replace />;
        }
        return children;
    }

    // Role not set yet → force role selection
    if (user.role === 'none') return <Navigate to="/select-role" replace />;

    // Wrong role → redirect to their correct dashboard
    if (roles.length > 0 && !roles.includes(user.role)) {
        return <Navigate to={ROLE_HOME[user.role] ?? '/login'} replace />;
    }

    return children;
};

export default ProtectedRoute;
