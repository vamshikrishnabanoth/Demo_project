/**
 * Route prefetching map — pre-downloads page JS chunks on mouse hover
 */

const routeMap = {
    '/student-dashboard': () => import('../pages/StudentDashboard'),
    '/teacher-dashboard': () => import('../pages/TeacherDashboard'),
    '/admin-dashboard': () => import('../pages/AdminDashboard'),
    '/assessments': () => import('../pages/Assessments'),
    '/my-quizzes': () => import('../pages/MyQuizzes'),
    '/history': () => import('../pages/AssessmentsHistory'),
    '/profile': () => import('../pages/Profile'),
    '/create-quiz-text': () => import('../pages/CreateQuizText'),
    '/create-quiz-pdf': () => import('../pages/CreateQuizPDF'),
    '/create-quiz-topic': () => import('../pages/CreateQuizTopic'),
    '/create-quiz-voice': () => import('../pages/CreateQuizVoice'),
    '/attempt-selector': () => import('../pages/QuizAttemptSelector'),
    '/cyber-quest': () => import('../pages/CyberQuest'),
    '/sprint-arena': () => import('../pages/SprintArena'),
    '/matchup-arena': () => import('../pages/MatchUpArena'),
};

const prefetchedRoutes = new Set();

export function prefetchRoute(path) {
    if (!path) return;
    // Extract base route path without search params or trailing slash
    const basePath = path.split('?')[0].replace(/\/$/, '');
    
    if (prefetchedRoutes.has(basePath)) return;
    
    if (routeMap[basePath]) {
        prefetchedRoutes.add(basePath);
        routeMap[basePath]().catch(err => {
            console.warn(`[Prefetch] Error prefetching route ${basePath}:`, err);
            prefetchedRoutes.delete(basePath);
        });
    }
}
