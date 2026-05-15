import { useEffect, useState, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import AuthContext from './context/AuthContext';
import Login from './pages/Login';
import RoleSelection from './pages/RoleSelection';
import TeacherDashboard from './pages/TeacherDashboard';
import CreateQuizText from './pages/CreateQuizText';
import CreateQuizPDF from './pages/CreateQuizPDF';
import CreateQuizTopic from './pages/CreateQuizTopic';
import CreateQuizVoice from './pages/CreateQuizVoice';
import StudentDashboard from './pages/StudentDashboard';
import Assessments from './pages/Assessments';
import MyQuizzes from './pages/MyQuizzes';
import AttemptQuiz from './pages/AttemptQuiz';
import AssessmentAttempt from './pages/AssessmentAttempt';
import AssessmentReview from './pages/AssessmentReview';
import Profile from './pages/Profile';
import Performance from './pages/Performance';
import AdminDashboard from './pages/AdminDashboard';
import LiveRoomTeacher from './pages/LiveRoomTeacher';
import LiveRoomStudent from './pages/LiveRoomStudent';
import Leaderboard from './pages/Leaderboard';
import ProtectedRoute from './components/ProtectedRoute';
import { motion, AnimatePresence } from 'framer-motion';

// Page Wrapper for transitions
const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
);

const Home = () => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'none') return <Navigate to="/select-role" />;
  if (user.role === 'teacher') return <Navigate to="/teacher-dashboard" />;
  if (user.role === 'student') return <Navigate to="/student-dashboard" />;
  if (user.role === 'admin') return <Navigate to="/admin-dashboard" />;
  return <Navigate to="/login" />;
};

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/select-role" element={<PageTransition><ProtectedRoute allowNone={true}><RoleSelection /></ProtectedRoute></PageTransition>} />
        <Route path="/teacher-dashboard" element={<PageTransition><ProtectedRoute roles={['teacher']}><TeacherDashboard /></ProtectedRoute></PageTransition>} />
        <Route path="/create-quiz/text" element={<PageTransition><ProtectedRoute roles={['teacher']}><CreateQuizText /></ProtectedRoute></PageTransition>} />
        <Route path="/create-quiz/pdf" element={<PageTransition><ProtectedRoute roles={['teacher']}><CreateQuizPDF /></ProtectedRoute></PageTransition>} />
        <Route path="/create-quiz/topic" element={<PageTransition><ProtectedRoute roles={['teacher']}><CreateQuizTopic /></ProtectedRoute></PageTransition>} />
        <Route path="/create-quiz/voice" element={<PageTransition><ProtectedRoute roles={['teacher']}><CreateQuizVoice /></ProtectedRoute></PageTransition>} />
        <Route path="/performance" element={<PageTransition><ProtectedRoute roles={['teacher']}><Performance /></ProtectedRoute></PageTransition>} />
        <Route path="/my-quizzes" element={<PageTransition><ProtectedRoute roles={['teacher']}><MyQuizzes /></ProtectedRoute></PageTransition>} />
        <Route path="/student-dashboard" element={<PageTransition><ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute></PageTransition>} />
        <Route path="/assessments" element={<PageTransition><ProtectedRoute roles={['student']}><Assessments /></ProtectedRoute></PageTransition>} />
        <Route path="/quiz/attempt/:id" element={<PageTransition><ProtectedRoute roles={['student']}><AssessmentAttempt /></ProtectedRoute></PageTransition>} />
        <Route path="/quiz/review/:id" element={<PageTransition><ProtectedRoute roles={['student']}><AssessmentReview /></ProtectedRoute></PageTransition>} />
        <Route path="/admin-dashboard" element={<PageTransition><ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute></PageTransition>} />
        <Route path="/admin/users" element={<PageTransition><ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute></PageTransition>} />
        <Route path="/live-room-teacher/:joinCode" element={<PageTransition><ProtectedRoute roles={['teacher']}><LiveRoomTeacher /></ProtectedRoute></PageTransition>} />
        <Route path="/live-room-student/:joinCode" element={<PageTransition><ProtectedRoute roles={['student']}><LiveRoomStudent /></ProtectedRoute></PageTransition>} />
        <Route path="/leaderboard/:quizId" element={<PageTransition><ProtectedRoute roles={['student', 'teacher']}><Leaderboard /></ProtectedRoute></PageTransition>} />
        <Route path="/profile" element={<PageTransition><ProtectedRoute roles={['student', 'teacher', 'admin']}><Profile /></ProtectedRoute></PageTransition>} />
        <Route path="/" element={<Home />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)' } }} />
      <Router>
        <AnimatedRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
