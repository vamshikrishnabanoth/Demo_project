import { Suspense, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import AuthContext from './context/AuthContext';
import { AnimatePresence } from 'framer-motion';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import NavigationProgress from './components/NavigationProgress';
import NavigationSkeleton from './components/NavigationSkeleton';
import lazyWithSuspense from './utils/lazyWithSuspense';
import {
    PageTransition,
    FadeTransition,
    SlideUpTransition,
} from './components/PageTransition';

const NotFound = lazyWithSuspense(() => import('./pages/NotFound'));

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
const Login             = lazyWithSuspense(() => import('./pages/Login'));
const RoleSelection     = lazyWithSuspense(() => import('./pages/RoleSelection'));
const TeacherDashboard  = lazyWithSuspense(() => import('./pages/TeacherDashboard'));
const CreateQuizText    = lazyWithSuspense(() => import('./pages/CreateQuizText'));
const CreateQuizPDF     = lazyWithSuspense(() => import('./pages/CreateQuizPDF'));
const CreateQuizTopic   = lazyWithSuspense(() => import('./pages/CreateQuizTopic'));
const CreateQuizVoice   = lazyWithSuspense(() => import('./pages/CreateQuizVoice'));
const StudentDashboard  = lazyWithSuspense(() => import('./pages/StudentDashboard'));
const Assessments       = lazyWithSuspense(() => import('./pages/Assessments'));
const MyQuizzes         = lazyWithSuspense(() => import('./pages/MyQuizzes'));
const AttemptQuiz       = lazyWithSuspense(() => import('./pages/AttemptQuiz'));
const QuizAttemptSelector = lazyWithSuspense(() => import('./pages/QuizAttemptSelector'));
const AssessmentReview  = lazyWithSuspense(() => import('./pages/AssessmentReview'));
const Profile           = lazyWithSuspense(() => import('./pages/Profile'));
const AdminDashboard    = lazyWithSuspense(() => import('./pages/AdminDashboard'));
const LiveRoomTeacher   = lazyWithSuspense(() => import('./pages/LiveRoomTeacher'));
const LiveRoomStudent   = lazyWithSuspense(() => import('./pages/LiveRoomStudent'));
const Leaderboard       = lazyWithSuspense(() => import('./pages/Leaderboard'));
const AssessmentsHistory = lazyWithSuspense(() => import('./pages/AssessmentsHistory'));
const AssessmentReport  = lazyWithSuspense(() => import('./pages/AssessmentReport'));
const QuizAnalytics     = lazyWithSuspense(() => import('./pages/QuizAnalytics'));
const QuestionAnalysis  = lazyWithSuspense(() => import('./pages/QuestionAnalysis'));
const AnimationPreview  = lazyWithSuspense(() => import('./pages/AnimationPreview'));
const CyberQuest        = lazyWithSuspense(() => import('./pages/CyberQuest'));
const SprintArena       = lazyWithSuspense(() => import('./pages/SprintArena'));
const MatchUpArena      = lazyWithSuspense(() => import('./pages/MatchUpArena'));

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
                    <Route path="/animation-preview" element={<AnimationPreview />} />
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
                    <Route path="/analytics/quiz/:id" element={<PageTransition><ProtectedRoute roles={['teacher', 'admin']}><QuizAnalytics /></ProtectedRoute></PageTransition>} />
                    <Route path="/analytics/question/:quizId/:questionIndex" element={<SlideUpTransition><ProtectedRoute roles={['teacher', 'admin']}><QuestionAnalysis /></ProtectedRoute></SlideUpTransition>} />

                    {/* Student pages */}
                    <Route path="/student-dashboard"  element={<PageTransition><ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute></PageTransition>} />
                    <Route path="/assessments"         element={<PageTransition><ProtectedRoute roles={['student']}><Assessments /></ProtectedRoute></PageTransition>} />
                    <Route path="/quiz/attempt/:id"    element={<FadeTransition><ProtectedRoute roles={['student']}><QuizAttemptSelector /></ProtectedRoute></FadeTransition>} />
                    <Route path="/quiz/review/:id"     element={<SlideUpTransition><ProtectedRoute roles={['student']}><AssessmentReview /></ProtectedRoute></SlideUpTransition>} />
                    <Route path="/history"            element={<PageTransition><ProtectedRoute roles={['student']}><AssessmentsHistory /></ProtectedRoute></PageTransition>} />
                    <Route path="/report/:id"         element={<SlideUpTransition><ProtectedRoute roles={['student']}><AssessmentReport /></ProtectedRoute></SlideUpTransition>} />
                    <Route path="/live-room-student/:joinCode" element={<FadeTransition><ProtectedRoute roles={['student']}><LiveRoomStudent /></ProtectedRoute></FadeTransition>} />
                    <Route path="/cyber-quest"        element={<FadeTransition><ProtectedRoute roles={['student']}><CyberQuest /></ProtectedRoute></FadeTransition>} />
                    <Route path="/sprint-arena"       element={<FadeTransition><ProtectedRoute roles={['student']}><SprintArena /></ProtectedRoute></FadeTransition>} />
                    <Route path="/match-up-arena"     element={<FadeTransition><ProtectedRoute roles={['student']}><MatchUpArena /></ProtectedRoute></FadeTransition>} />

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
                    duration: 4000,
                    style: {
                        background: 'rgba(15, 23, 42, 0.95)',
                        backdropFilter: 'blur(12px)',
                        color: '#ffffff',
                        borderRadius: '24px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: '16px',
                        fontWeight: '700',
                        padding: '18px 28px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(255, 255, 255, 0.02)',
                        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        letterSpacing: '-0.01em',
                        maxWidth: '480px',
                        minWidth: '350px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                    },
                    success: {
                        style: {
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 25px rgba(16, 185, 129, 0.2)',
                            background: 'linear-gradient(to right, rgba(16, 185, 129, 0.05), rgba(15, 23, 42, 0.95))',
                        },
                        iconTheme: {
                            primary: '#10b981',
                            secondary: '#090d16',
                        }
                    },
                    error: {
                        style: {
                            border: '1px solid rgba(244, 63, 94, 0.35)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 25px rgba(244, 63, 94, 0.2)',
                            background: 'linear-gradient(to right, rgba(244, 63, 94, 0.05), rgba(15, 23, 42, 0.95))',
                        },
                        iconTheme: {
                            primary: '#f43f5e',
                            secondary: '#090d16',
                        }
                    }
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
