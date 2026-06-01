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

const ProtectedRoute = ({ children, roles = [], allowNone = false }) => {
    const { user, loading, authError, retryAuth } = useContext(AuthContext);

    console.log('[DIAGNOSTIC-ROUTE] Evaluating ProtectedRoute:', {
        pathname: window.location.pathname,
        loading,
        userPresent: !!user,
        userRole: user?.role || null,
        requiredRoles: roles,
        allowNone,
        authErrorPresent: !!authError
    });

    // While auth is being restored from localStorage, show the premium WaitingRoomLoader
    if (loading) {
        console.log('[DIAGNOSTIC-ROUTE] Auth state is currently LOADING. Render WaitingRoomLoader.');
        return <WaitingRoomLoader message="Securing session..." />;
    }

    // If a connection or server cold start error occurred during hydration, display the connection error page
    if (authError && localStorage.getItem('token')) {
        console.warn('[DIAGNOSTIC-ROUTE] Auth hydration failed due to server/network issue. Presenting ConnectionErrorPage.');
        return <ConnectionErrorPage error={authError} onRetry={retryAuth} />;
    }

    // Not logged in → go to login
    if (!user) {
        console.warn(`[DIAGNOSTIC-ROUTE] Access Denied! No authenticated user. Redirecting /login. Stack trace:`, new Error().stack);
        return <Navigate to="/login" replace />;
    }

    // Role-selection page: redirect already-assigned users to their dashboard
    if (allowNone) {
        if (user.role !== 'none') {
            const redirectPath = ROLE_HOME[user.role] ?? '/login';
            console.log(`[DIAGNOSTIC-ROUTE] User already assigned role "${user.role}". Redirecting to dashboard: ${redirectPath}`);
            return <Navigate to={redirectPath} replace />;
        }
        console.log('[DIAGNOSTIC-ROUTE] User has role "none", allowing selection component.');
        return children;
    }

    // Role not set yet → force role selection
    if (user.role === 'none') {
        console.warn('[DIAGNOSTIC-ROUTE] User has not completed role selection. Forcing select-role.');
        return <Navigate to="/select-role" replace />;
    }

    // Wrong role → redirect to their correct dashboard
    if (roles.length > 0 && !roles.includes(user.role)) {
        const fallbackPath = ROLE_HOME[user.role] ?? '/login';
        console.warn(`[DIAGNOSTIC-ROUTE] Role Mismatch! Required: [${roles.join(',')}], User has: "${user.role}". Redirecting to correct role dashboard: ${fallbackPath}`);
        return <Navigate to={fallbackPath} replace />;
    }

    console.log(`[DIAGNOSTIC-ROUTE] Access Approved! Rendering child component.`);
    return children;
};

export default ProtectedRoute;
