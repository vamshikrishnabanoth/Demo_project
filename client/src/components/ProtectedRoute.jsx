import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import WaitingRoomLoader from './loaders/WaitingRoomLoader';
import ConnectionErrorPage from './ConnectionErrorPage';

// Maps a role to its home route
const ROLE_HOME = {
    teacher: '/teacher-dashboard',
    student: '/student-dashboard',
    admin:   '/admin-dashboard',
};

const isDev = import.meta.env.DEV;

const ProtectedRoute = ({ children, roles = [], allowNone = false }) => {
    const { user, loading, authError, retryAuth } = useContext(AuthContext);

    // While auth is being restored from localStorage, show the premium WaitingRoomLoader
    if (loading) {
        return <WaitingRoomLoader message="Securing session..." />;
    }

    // If a connection or server cold start error occurred during hydration, display the connection error page
    if (authError && localStorage.getItem('token')) {
        if (isDev) console.warn('[ProtectedRoute] Auth hydration failed:', authError);
        return <ConnectionErrorPage error={authError} onRetry={retryAuth} />;
    }

    // Not logged in → go to login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Role-selection page: redirect already-assigned users to their dashboard
    if (allowNone) {
        if (user.role !== 'none') {
            const redirectPath = ROLE_HOME[user.role] ?? '/login';
            return <Navigate to={redirectPath} replace />;
        }
        return children;
    }

    // Role not set yet → force role selection
    if (user.role === 'none') {
        return <Navigate to="/select-role" replace />;
    }

    // Wrong role → redirect to their correct dashboard
    if (roles.length > 0 && !roles.includes(user.role)) {
        const fallbackPath = ROLE_HOME[user.role] ?? '/login';
        if (isDev) console.warn(`[ProtectedRoute] Role mismatch. Required: [${roles.join(',')}], User has: "${user.role}". Redirecting to ${fallbackPath}`);
        return <Navigate to={fallbackPath} replace />;
    }

    return children;
};

export default ProtectedRoute;
