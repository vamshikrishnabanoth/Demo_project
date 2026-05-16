import { lazy, Suspense, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import AuthContext from './context/AuthContext';
import { AnimatePresence } from 'framer-motion';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import NavigationProgress from './components/NavigationProgress';
import NavigationSkeleton from './components/NavigationSkeleton';
import {
    PageTransition,
    FadeTransition,
    SlideUpTransition,
} from './components/PageTransition';

const NotFound = lazy(() => import('./pages/NotFound'));

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
const Login             = lazy(() => import('./pages/Login'));
const RoleSelection     = lazy(() => import('./pages/RoleSelection'));
const TeacherDashboard  = lazy(() => import('./pages/TeacherDashboard'));
const CreateQuizText    = lazy(() => import('./pages/CreateQuizText'));
const CreateQuizPDF     = lazy(() => import('./pages/CreateQuizPDF'));
const CreateQuizTopic   = lazy(() => import('./pages/CreateQuizTopic'));
const CreateQuizVoice   = lazy(() => import('./pages/CreateQuizVoice'));
const StudentDashboard  = lazy(() => import('./pages/StudentDashboard'));
const Assessments       = lazy(() => import('./pages/Assessments'));
const MyQuizzes         = lazy(() => import('./pages/MyQuizzes'));
const AttemptQuiz       = lazy(() => import('./pages/AttemptQuiz'));
const AssessmentAttempt = lazy(() => import('./pages/AssessmentAttempt'));
const AssessmentReview  = lazy(() => import('./pages/AssessmentReview'));
const Profile           = lazy(() => import('./pages/Profile'));
const AdminDashboard    = lazy(() => import('./pages/AdminDashboard'));
const LiveRoomTeacher   = lazy(() => import('./pages/LiveRoomTeacher'));
const LiveRoomStudent   = lazy(() => import('./pages/LiveRoomStudent'));
const Leaderboard       = lazy(() => import('./pages/Leaderboard'));

// ─── Home redirect ────────────────────────────────────────────────────────────
const Home = () => {
    const { user, loading } = useContext(AuthContext);
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    const homes = { teacher: '/teacher-dashboard', student: '/student-dashboard', admin: '/admin-dashboard' };
    if (user.role === 'none') return <Navigate to="/select-role" replace />;
    return <Navigate to={homes[user.role] ?? '/login'} replace />;
};

// ─── Animated Routes ──────────────────────────────────────────────────────────
// KEY CHANGE: mode="sync" instead of mode="wait"
//   "wait" = old page must FULLY EXIT before new page starts entering
//             → adds 120ms of dead time on EVERY navigation
//   "sync" = exit + enter run simultaneously
//             → navigation feels instant, half the perceived duration
function AnimatedRoutes() {
    const location = useLocation();

    return (
        <>
            {/* Top progress bar — gives instant feedback before JS even starts rendering */}
            <NavigationProgress />

            <AnimatePresence mode="sync">
                <Routes location={location} key={location.pathname}>
                    {/* Auth pages — fullscreen, fade only */}
                    <Route path="/login"       element={<FadeTransition><Login /></FadeTransition>} />
                    <Route path="/select-role" element={<FadeTransition><ProtectedRoute allowNone><RoleSelection /></ProtectedRoute></FadeTransition>} />

                    {/* Teacher pages — standard slide transition */}
                    <Route path="/teacher-dashboard" element={<PageTransition><ProtectedRoute roles={['teacher']}><TeacherDashboard /></ProtectedRoute></PageTransition>} />
                    <Route path="/create-quiz/text"  element={<PageTransition><ProtectedRoute roles={['teacher']}><CreateQuizText /></ProtectedRoute></PageTransition>} />
                    <Route path="/create-quiz/pdf"   element={<PageTransition><ProtectedRoute roles={['teacher']}><CreateQuizPDF /></ProtectedRoute></PageTransition>} />
                    <Route path="/create-quiz/topic" element={<PageTransition><ProtectedRoute roles={['teacher']}><CreateQuizTopic /></ProtectedRoute></PageTransition>} />
                    <Route path="/create-quiz/voice" element={<PageTransition><ProtectedRoute roles={['teacher']}><CreateQuizVoice /></ProtectedRoute></PageTransition>} />
                    <Route path="/my-quizzes"        element={<PageTransition><ProtectedRoute roles={['teacher']}><MyQuizzes /></ProtectedRoute></PageTransition>} />
                    <Route path="/live-room-teacher/:joinCode" element={<FadeTransition><ProtectedRoute roles={['teacher']}><LiveRoomTeacher /></ProtectedRoute></FadeTransition>} />

                    {/* Student pages */}
                    <Route path="/student-dashboard"  element={<PageTransition><ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute></PageTransition>} />
                    <Route path="/assessments"         element={<PageTransition><ProtectedRoute roles={['student']}><Assessments /></ProtectedRoute></PageTransition>} />
                    <Route path="/quiz/attempt/:id"    element={<FadeTransition><ProtectedRoute roles={['student']}><AssessmentAttempt /></ProtectedRoute></FadeTransition>} />
                    <Route path="/quiz/review/:id"     element={<SlideUpTransition><ProtectedRoute roles={['student']}><AssessmentReview /></ProtectedRoute></SlideUpTransition>} />
                    <Route path="/live-room-student/:joinCode" element={<FadeTransition><ProtectedRoute roles={['student']}><LiveRoomStudent /></ProtectedRoute></FadeTransition>} />

                    {/* Admin pages */}
                    <Route path="/admin-dashboard" element={<PageTransition><ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute></PageTransition>} />
                    <Route path="/admin/users"     element={<PageTransition><ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute></PageTransition>} />

                    {/* Shared pages — leaderboard gets slide-up (feels like arrival) */}
                    <Route path="/leaderboard/:quizId" element={<SlideUpTransition><ProtectedRoute roles={['student', 'teacher']}><Leaderboard /></ProtectedRoute></SlideUpTransition>} />
                    <Route path="/profile"             element={<PageTransition><ProtectedRoute roles={['student', 'teacher', 'admin']}><Profile /></ProtectedRoute></PageTransition>} />

                    <Route path="/" element={<Home />} />

                    {/* 404 — catches ALL unmatched routes */}
                    <Route path="*" element={<FadeTransition><NotFound /></FadeTransition>} />
                </Routes>
            </AnimatePresence>
        </>
    );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
function App() {
    return (
        <AuthProvider>
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: '#1e293b',
                        color: '#fff',
                        borderRadius: '1rem',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '14px',
                    },
                }}
            />
            <Router>
                {/* ErrorBoundary catches runtime JS errors — prevents white screen crashes */}
                <ErrorBoundary>
                    <Suspense fallback={<NavigationSkeleton />}>
                        <AnimatedRoutes />
                    </Suspense>
                </ErrorBoundary>
            </Router>
        </AuthProvider>
    );
}

export default App;
