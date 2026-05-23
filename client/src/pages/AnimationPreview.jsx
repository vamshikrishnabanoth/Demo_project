import LiveQuizWaitAnimation from '../components/loaders/LiveQuizWaitAnimation';

const variants = {
    'waiting-room': {
        variant: 'waiting-room',
        readyCount: 5,
        joiningCount: 2,
        detail: '5 students ready... 2 more joining!'
    },
    'synchronizing-answers': {
        variant: 'synchronizing-answers',
        detail: 'Real-time sync active'
    },
    'loading-next-question': {
        variant: 'loading-next-question',
        detail: 'Awaiting host command...'
    },
    'quiz-starting': {
        variant: 'quiz-starting',
        timeLeft: 7,
        detail: 'Synchronizing session...'
    },
    'waiting-submissions': {
        variant: 'waiting-submissions',
        answeredCount: 18,
        totalStudents: 24,
        detail: '18 of 24 answered'
    }
};

export default function AnimationPreview() {
    const params = new URLSearchParams(window.location.search);
    const selected = params.get('variant') || 'waiting-room';

    return (
        <main className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] grid place-items-center p-8 overflow-hidden">
            <LiveQuizWaitAnimation {...variants[selected]} />
        </main>
    );
}
