import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import WaitingRoomLoader from './loaders/WaitingRoomLoader';

// Maps a role to its home route
const ROLE_HOME = {
    teacher: '/teacher-dashboard',
    student: '/student-dashboard',
    admin:   '/admin-dashboard',
};

const ProtectedRoute = ({ children, roles = [], allowNone = false }) => {
    const { user, loading } = useContext(AuthContext);

    // While auth is being restored from localStorage, show the premium WaitingRoomLoader
    if (loading) {
        return <WaitingRoomLoader message="Securing session..." />;
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
