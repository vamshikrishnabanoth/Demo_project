import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Sparkles, Shield, RefreshCw, Trophy, Zap, AlertTriangle, ArrowRight, 
    X as XIcon, CheckCircle, HelpCircle, Volume2, VolumeX, Home, Gamepad2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import api from '../utils/api';
import DashboardLayout from '../components/DashboardLayout';
import FormattedQuestionText from '../components/quiz/FormattedQuestionText';

// Dynamically generate the ladder based on total levels (question count)
function buildLadder(totalLevels) {
    const basePoints = [100, 200, 500, 800, 1200, 1800, 2500, 3200, 4000, 5000];
    return Array.from({ length: totalLevels }, (_, i) => {
        const level = totalLevels - i; // descending
        // Scale points evenly if fewer than 10 questions, otherwise use base
        const pointIdx = totalLevels <= 10
            ? Math.round(i * (basePoints.length - 1) / Math.max(totalLevels - 1, 1))
            : i;
        const points = basePoints[Math.min(pointIdx, basePoints.length - 1)];
        return { level, points, label: `Level ${level}` };
    });
}

const FALLBACK_QUESTIONS = [
    {
        questionText: "Which protocol operates at the Transport Layer of the OSI model to provide reliable, connection-oriented data transfer?",
        options: ["UDP", "IP", "TCP", "HTTP"],
        correctAnswer: "TCP",
        explanation: "TCP (Transmission Control Protocol) is connection-oriented and guarantees reliable, ordered Delivery of data streams."
    },
    {
        questionText: "What is the primary function of the Domain Name System (DNS) in computer networking?",
        options: [
            "Encapsulating packet headers for encryption",
            "Translating human-readable domain names to IP addresses",
            "Routing traffic between local subnets",
            "Assigning dynamic IP addresses to connected clients"
        ],
        correctAnswer: "Translating human-readable domain names to IP addresses",
        explanation: "DNS acts as the phonebook of the internet, resolving domain names (like google.com) to numeric IP addresses."
    },
    {
        questionText: "In cyber security, what does the acronym 'CIA' stand for regarding fundamental security goals?",
        options: [
            "Confidentiality, Integrity, Availability",
            "Control, Inspection, Authentication",
            "Cryptography, Intrusion, Access",
            "Centralization, Identification, Authorization"
        ],
        correctAnswer: "Confidentiality, Integrity, Availability",
        explanation: "The CIA Triad forms the bedrock of data security: Confidentiality (secrecy), Integrity (trustworthiness), and Availability (accessibility)."
    },
    {
        questionText: "Which SQL command is used to retrieve data from a relational database table based on specific filter criteria?",
        options: ["INSERT", "SELECT", "UPDATE", "DELETE"],
        correctAnswer: "SELECT",
        explanation: "The SELECT command query pulls data matching specified requirements from one or more database tables."
    },
    {
        questionText: "What type of data structure operates on a Last-In, First-Out (LIFO) model?",
        options: ["Queue", "Stack", "Binary Tree", "Linked List"],
        correctAnswer: "Stack",
        explanation: "A Stack is a LIFO structure where elements are added (pushed) and removed (popped) from the same end."
    },
    {
        questionText: "Which memory type serves as temporary high-speed data storage located closest to the CPU core?",
        options: ["RAM", "SSD", "Hard Disk Drive", "Cache Memory"],
        correctAnswer: "Cache Memory",
        explanation: "Cache memory (L1/L2/L3) is exceptionally fast SRAM located inside or next to the CPU to reduce memory access delays."
    },
    {
        questionText: "What does the HTTP 404 Status Code signify to a client browser request?",
        options: [
            "The client has successfully authenticated",
            "The requested resource was not found on the server",
            "The server has encountered an internal crash",
            "The client requires administrative permissions"
        ],
        correctAnswer: "The requested resource was not found on the server",
        explanation: "404 Not Found indicates that the host could communicate with the server, but the requested page or asset does not exist."
    },
    {
        questionText: "Which cryptographic algorithm represents a symmetric encryption standard widely adopted across global applications?",
        options: ["RSA", "AES", "Diffie-Hellman", "SHA-256"],
        correctAnswer: "AES",
        explanation: "AES (Advanced Encryption Standard) is a highly secure symmetric key algorithm, whereas RSA is asymmetric and SHA-256 is a hashing function."
    },
    {
        questionText: "What represents the main conceptual advantage of utilizing a Virtual Private Network (VPN)?",
        options: [
            "Increasing standard mechanical disk drive writing speeds",
            "Encrypting data payloads and masking network locations",
            "Eliminating the need for a hardware network router",
            "Compiling programming languages directly in parallel"
        ],
        correctAnswer: "Encrypting data payloads and masking network locations",
        explanation: "VPNs create a secure, encrypted tunnel over public networks, hiding the client's actual IP location from observers."
    },
    {
        questionText: "Which methodology defines an agile framework emphasizing collaborative sprints, daily standups, and incremental iterations?",
        options: ["Waterfall", "Scrum", "V-Model", "Spiral Model"],
        correctAnswer: "Scrum",
        explanation: "Scrum is an iterative agile methodology structured around short working sprints (usually 2-4 weeks) and daily standup check-ins."
    }
];

export default function CyberQuest() {
    const location = useLocation();
    const navigate = useNavigate();

    // ── Load questions from routing state or use premium fallback list ────────
    const rawQuestions = location.state?.questions || FALLBACK_QUESTIONS;
    const topicTitle = location.state?.title || 'System Core Matrix';

    // ── Normalize questions (no arbitrary cap — use all teacher-provided questions) ──
    const questions = rawQuestions.map((q) => ({
        questionText: q.questionText || '',
        options: Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: q.correctAnswer || '',
        explanation: q.explanation || 'No concept description supplied.'
    }));

    // Total number of levels = total number of questions
    const totalLevels = questions.length;

    // Dynamic score ladder based on actual question count
    const LADDER = buildLadder(totalLevels);

    // ── GAME STATE ───────────────────────────────────────────────────────────
    const [gameStatus, setGameStatus] = useState('start'); // 'start' | 'playing' | 'victory' | 'gameover'
    const [sessionId, setSessionId] = useState(() => {
        return crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2, 15) + Date.now().toString(36));
    });
    const hasSubmitted = useRef(false);
    const [currentLevel, setCurrentLevel] = useState(1);
    const [score, setScore] = useState(0);

    // Lifeline Tracking
    const [used5050, setUsed5050] = useState(false);
    const [usedShield, setUsedShield] = useState(false);
    const [usedSkip, setUsedSkip] = useState(false);

    // Active Lifeline State for current question
    const [shieldActive, setShieldActive] = useState(false);
    const [eliminatedOptions, setEliminatedOptions] = useState([]);
    
    // UI Helpers
    const [selectedOption, setSelectedOption] = useState(null);
    const [feedbackState, setFeedbackState] = useState(null); // 'correct' | 'incorrect' | 'shield-blocked'
    const [userAnswers, setUserAnswers] = useState({});
    const [muted, setMuted] = useState(false);

    const activeQuestion = questions[currentLevel - 1] || questions[0];

    const quizId = location.state?.quizId;

    // Submit Gamification Score & Assessment Result
    useEffect(() => {
        if ((gameStatus === 'victory' || gameStatus === 'gameover') && !hasSubmitted.current) {
            hasSubmitted.current = true;
            const answeredCorrectly = gameStatus === 'victory' ? totalLevels : Math.max(0, currentLevel - 1);
            
            // 1. Submit gamification score
            api.post('/students/game-score', {
                gameType: 'cyber_quest',
                correctAnswers: answeredCorrectly,
                totalQuestions: totalLevels,
                duration: 0, // CyberQuest is untimed
                sessionId: sessionId
            }).catch(err => console.error('Failed to save score:', err));

            // 2. If launched as an official quiz assessment, submit to quiz engine
            if (quizId) {
                const payloadAnswers = questions.map((q, idx) => ({
                    selectedOption: userAnswers[idx] || (idx < answeredCorrectly ? q.correctAnswer : ''),
                    timeTaken: 0
                }));
                api.post('/quiz/submit', {
                    quizId,
                    answers: payloadAnswers
                }).catch(err => console.error('Failed to submit quiz attempt:', err));
            }
        }
    }, [gameStatus, currentLevel, sessionId, quizId, questions, userAnswers]);

    // ── Synthesized Sound Effects ──────────────────────────────────────────
    const playSound = useCallback((type) => {
        if (muted) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            
            if (type === 'correct') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                osc.start();
                osc.stop(ctx.currentTime + 0.3);
            } else if (type === 'wrong') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(130, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(90, ctx.currentTime + 0.4);
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                osc.start();
                osc.stop(ctx.currentTime + 0.4);
            } else if (type === 'shield') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(550, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(250, ctx.currentTime + 0.5);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                osc.start();
                osc.stop(ctx.currentTime + 0.5);
            } else if (type === 'levelUp') {
                const now = ctx.currentTime;
                [330, 440, 554, 660, 880].forEach((f, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.frequency.setValueAtTime(f, now + i * 0.07);
                    gain.gain.setValueAtTime(0.08, now + i * 0.07);
                    gain.gain.exponentialRampToValueAtTime(0.005, now + i * 0.07 + 0.2);
                    osc.start(now + i * 0.07);
                    osc.stop(now + i * 0.07 + 0.2);
                });
            }
        } catch (e) {
            console.warn('Synth error:', e);
        }
    }, [muted]);

    // ── Celebration Confetti Loops ──────────────────────────────────────────
    const triggerVictoryConfetti = () => {
        const duration = 4.5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 35, spread: 360, ticks: 60, zIndex: 100 };
        const randomInRange = (min, max) => Math.random() * (max - min) + min;

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            const particleCount = 40 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 220);
    };

    // ── Handle Option Selection ──────────────────────────────────────────────
    const handleSelectOption = (option) => {
        if (feedbackState !== null) return; // block multiple fast clicks
        setSelectedOption(option);
        setUserAnswers(prev => ({ ...prev, [currentLevel - 1]: option }));

        const isCorrect = option === activeQuestion.correctAnswer;

        if (isCorrect) {
            setFeedbackState('correct');
            playSound('correct');
            confetti({ particleCount: 25, spread: 40, origin: { y: 0.8 } });

            // Calculate score addition based on level points
            const currentPoints = LADDER.find(l => l.level === currentLevel)?.points || 100;

            setTimeout(() => {
                setScore(prev => prev + currentPoints);
                
                // Midpoint milestone confetti
                const midpoint = Math.ceil(totalLevels / 2);
                if (currentLevel === midpoint) {
                    confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
                    playSound('levelUp');
                }

                if (currentLevel < totalLevels) {
                    setCurrentLevel(prev => prev + 1);
                    // Reset single question state
                    setSelectedOption(null);
                    setFeedbackState(null);
                    setEliminatedOptions([]);
                } else {
                    // Win game!
                    setGameStatus('victory');
                    playSound('levelUp');
                    triggerVictoryConfetti();
                }
            }, 1800);

        } else {
            // Incorrect choice
            if (shieldActive) {
                setFeedbackState('shield-blocked');
                playSound('shield');
                
                // Eliminate the selected incorrect choice
                setEliminatedOptions(prev => [...prev, option]);

                setTimeout(() => {
                    setFeedbackState(null);
                    setSelectedOption(null);
                    setShieldActive(false); // Shield consumed
                    setUsedShield(true);    // Lifeline burned out
                }, 2000);

            } else {
                setFeedbackState('incorrect');
                playSound('wrong');

                setTimeout(() => {
                    setGameStatus('gameover');
                }, 2000);
            }
        }
    };

    // ── Active Lifelines ─────────────────────────────────────────────────────
    const trigger5050 = () => {
        if (used5050 || feedbackState !== null) return;

        const options = activeQuestion.options;
        const correct = activeQuestion.correctAnswer;
        const incorrects = options.filter(o => o !== correct);

        // Randomly select one incorrect option to keep
        const keepIncorrect = incorrects[Math.floor(Math.random() * incorrects.length)];
        
        // Eliminate the rest
        const toEliminate = incorrects.filter(o => o !== keepIncorrect);
        setEliminatedOptions(toEliminate);
        setUsed5050(true);
    };

    const triggerShield = () => {
        if (usedShield || shieldActive || feedbackState !== null) return;
        setShieldActive(true);
        playSound('shield');
    };

    const triggerSkip = () => {
        if (usedSkip || feedbackState !== null) return;

        setFeedbackState('correct');
        playSound('correct');
        setUserAnswers(prev => ({ ...prev, [currentLevel - 1]: activeQuestion.correctAnswer }));
        const currentPoints = LADDER.find(l => l.level === currentLevel)?.points || 100;
        setUsedSkip(true);

        setTimeout(() => {
            setScore(prev => prev + currentPoints);
            
            if (currentLevel < totalLevels) {
                setCurrentLevel(prev => prev + 1);
                setSelectedOption(null);
                setFeedbackState(null);
                setEliminatedOptions([]);
                setShieldActive(false);
            } else {
                setGameStatus('victory');
                playSound('levelUp');
                triggerVictoryConfetti();
            }
        }, 1200);
    };

    // ── Game Reset ───────────────────────────────────────────────────────────
    const handleReset = () => {
        setCurrentLevel(1);
        setScore(0);
        setUsed5050(false);
        setUsedShield(false);
        setUsedSkip(false);
        setShieldActive(false);
        setEliminatedOptions([]);
        setSelectedOption(null);
        setFeedbackState(null);
        const uuid = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2, 15) + Date.now().toString(36));
        setSessionId(uuid);
        hasSubmitted.current = false;
        setGameStatus('playing');
        playSound('levelUp');
    };

    return (
        <div className="min-h-screen bg-[#060913] text-white font-inter relative overflow-hidden flex flex-col justify-between py-6 selection:bg-cyan-500 selection:text-black">
            
            {/* Cyber Glows */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[160px] pointer-events-none -mr-64 -mt-64" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none -ml-64 -mb-64" />

            {/* HEADER BAR */}
            <header className="max-w-7xl mx-auto w-full px-6 flex justify-between items-center border-b border-white/10 pb-4 relative z-50">
                <div className="flex items-center gap-3">
                    <div className="bg-cyan-500/10 border border-cyan-400/30 w-10 h-10 rounded-lg flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                        <Zap size={20} />
                    </div>
                    <div>
                        <h1 className="text-md sm:text-lg font-black tracking-tight uppercase italic leading-none" style={{ color: '#ffffff' }}>
                            <span style={{ color: '#ffffff' }}>Cyber </span><span className="text-cyan-400" style={{ color: '#22d3ee', textShadow: '0 0 10px rgba(6,182,212,0.6)' }}>Quest</span>
                        </h1>
                        <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: '#cbd5e1' }}>Topic: {topicTitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setMuted(!muted)}
                        className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all border border-white/15 text-white font-bold"
                        title={muted ? 'Unmute game sound' : 'Mute game sound'}
                    >
                        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <button 
                        onClick={() => navigate('/student-dashboard')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all border border-white/15 font-bold uppercase tracking-wider text-xs italic text-white"
                    >
                        <Home size={14} /> Exit
                    </button>
                </div>
            </header>

            {/* MAIN GAME VIEW INTERACTION */}
            <main className="max-w-7xl mx-auto w-full px-6 flex-1 flex items-center justify-center my-6 relative z-10">
                <AnimatePresence mode="wait">
                    
                    {/* 1. START SCREEN */}
                    {gameStatus === 'start' && (
                        <motion.div
                            key="start-screen"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="max-w-xl w-full text-center space-y-8 bg-[#0e1424]/95 backdrop-blur-2xl border border-cyan-500/30 rounded-[3rem] p-12 shadow-[0_30px_100px_rgba(0,0,0,0.8)] relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-purple-600/10 pointer-events-none" />
                            <div className="relative z-10 space-y-6">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                                    className="w-24 h-24 rounded-full border-2 border-cyan-400 bg-cyan-500/10 flex items-center justify-center mx-auto text-cyan-400 shadow-[0_0_40px_rgba(6,182,212,0.4)]"
                                >
                                    <Trophy size={48} />
                                </motion.div>
                                
                                <div className="space-y-2">
                                    <h2 className="text-4xl sm:text-5xl font-black italic uppercase tracking-tighter">
                                        <span className="text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">CYBER</span> <span className="text-cyan-400 drop-shadow-[0_0_25px_rgba(6,182,212,0.6)]">QUEST</span>
                                    </h2>
                                    <p className="text-slate-300 font-bold uppercase tracking-[0.3em] text-xs">The Ultimate Progressive MCQ Battle</p>
                                </div>

                                <div className="p-5 rounded-2xl bg-[#13192b] border border-white/10 text-left text-xs leading-relaxed text-slate-200 max-w-sm mx-auto space-y-3">
                                    <p className="font-black text-center uppercase tracking-wider text-cyan-400 text-sm mb-1 flex items-center justify-center gap-2"><Gamepad2 size={16} aria-hidden="true" /> Game Manual</p>
                                    <p><Shield size={14} className="inline mr-1" aria-hidden="true" /> <b>{totalLevels} Progressive Levels:</b> Harder questions mean more points.</p>
                                    <p><XIcon size={14} className="inline mr-1" aria-hidden="true" /> <b>One Mistake Ends the Game:</b> UNLESS you activate the Shield.</p>
                                    <p><Sparkles size={14} className="inline mr-1" aria-hidden="true" /> <b>3 Cyber Lifelines:</b> 50:50, Shield, and Skip can be used once each.</p>
                                </div>

                                <button
                                    onClick={() => { setGameStatus('playing'); playSound('levelUp'); }}
                                    className="w-full h-16 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white font-black text-xl italic uppercase tracking-[0.2em] shadow-[0_15px_40px_rgba(6,182,212,0.4)] border border-cyan-400/50 hover:scale-[1.03] active:scale-95 transition-all cursor-pointer"
                                >
                                    Start Cyber Quest
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* 2. PLAYING SCREEN */}
                    {gameStatus === 'playing' && (
                        <motion.div
                            key="playing-view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full grid grid-cols-1 lg:grid-cols-4 gap-8 items-stretch"
                        >
                            {/* Question and Lifelines Panel (Left 3 columns) */}
                            <div className="lg:col-span-3 flex flex-col justify-between gap-6">
                                
                                {/* Question Card */}
                                <div className="bg-[#0e1424]/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 md:p-10 flex-1 flex flex-col justify-between shadow-[0_25px_80px_rgba(0,0,0,0.6)] relative overflow-hidden group">
                                    <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-cyan-500/20 text-cyan-300 font-black text-[11px] uppercase tracking-widest px-3 py-1 rounded-md border border-cyan-400/40 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                                                Level {currentLevel}
                                            </span>
                                            <span className="text-xs text-slate-200 font-bold uppercase tracking-widest">
                                                Tier: {currentLevel <= 3 ? 'Easy' : currentLevel <= 6 ? 'Medium' : currentLevel <= 8 ? 'Hard' : 'Expert'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-slate-300 font-black uppercase tracking-widest">Accumulated Score</span>
                                            <span className="font-mono text-xl font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">{score} pts</span>
                                        </div>
                                    </div>

                                    <div className="my-4">
                                        <FormattedQuestionText
                                            questionText={activeQuestion.questionText}
                                            textClassName="text-xl sm:text-2xl font-black leading-snug text-white tracking-tight"
                                            dark={true}
                                        />
                                    </div>

                                    {/* Glassmorphic Option Buttons Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                        {activeQuestion.options.map((option, idx) => {
                                            const isSelected = selectedOption === option;
                                            const isCorrectChoice = option === activeQuestion.correctAnswer;
                                            const isEliminated = eliminatedOptions.includes(option);

                                            // Determine Option Colors based on state
                                            let cardStyle = 'border-slate-700 bg-[#121829] hover:border-cyan-400 hover:bg-[#1a233b] text-white font-bold shadow-md';
                                            if (isEliminated) {
                                                cardStyle = 'border-white/5 bg-transparent opacity-20 pointer-events-none text-white/40';
                                            } else if (feedbackState === 'correct') {
                                                if (isCorrectChoice) cardStyle = 'border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)] font-bold';
                                                else if (isSelected) cardStyle = 'border-white/5 bg-white/[0.01] opacity-30 text-white/50';
                                            } else if (feedbackState === 'incorrect') {
                                                if (isCorrectChoice) cardStyle = 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold';
                                                else if (isSelected) cardStyle = 'border-red-500 bg-red-500/20 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.25)] font-bold';
                                            } else if (feedbackState === 'shield-blocked') {
                                                if (isSelected) cardStyle = 'border-amber-500 bg-amber-500/20 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse';
                                            }

                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => !isEliminated && handleSelectOption(option)}
                                                    disabled={feedbackState !== null || isEliminated}
                                                    className={`p-5 rounded-2xl border text-left font-semibold text-sm transition-all duration-300 flex items-center justify-between cursor-pointer h-auto ${cardStyle}`}
                                                >
                                                    <span className="flex gap-3 items-center min-w-0 flex-1">
                                                        <span className="font-mono uppercase text-cyan-400 font-black text-xs border border-cyan-400/40 px-2 py-0.5 rounded bg-cyan-950/50 shrink-0">
                                                            {['A', 'B', 'C', 'D'][idx]}
                                                        </span>
                                                        <span className="break-words whitespace-normal min-w-0 text-white font-bold text-base">{option}</span>
                                                    </span>
                                                    {feedbackState === 'correct' && isCorrectChoice && <CheckCircle size={16} className="text-emerald-400 shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Explanation System */}
                                    <AnimatePresence>
                                        {(feedbackState === 'correct' || feedbackState === 'incorrect') && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="mt-6 p-4 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-200 flex gap-3 items-start"
                                            >
                                                <HelpCircle size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-black uppercase tracking-wider text-cyan-400 mb-1">Concept Matrix Breakdown</p>
                                                    <p>{activeQuestion.explanation}</p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Interactive Lifelines Panel */}
                                <div className="bg-[#0e1424]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 shadow-lg flex flex-col md:flex-row gap-4 items-center justify-between">
                                    <div className="text-center md:text-left">
                                        <h4 className="font-black text-xs uppercase tracking-widest text-slate-200">Available Cyber Lifelines</h4>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Utilize each emergency lifeline once per game</p>
                                    </div>

                                    <div className="flex gap-4 w-full md:w-auto">
                                        
                                        {/* 50:50 Lifeline */}
                                        <button
                                            onClick={trigger5050}
                                            disabled={used5050 || feedbackState !== null}
                                            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl border font-bold text-xs uppercase tracking-wider italic transition-all duration-300 cursor-pointer ${
                                                used5050 
                                                    ? 'border-white/5 bg-transparent text-slate-600 cursor-not-allowed opacity-30'
                                                    : 'border-cyan-400/50 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-black hover:scale-[1.02] shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                                            }`}
                                        >
                                            <RefreshCw size={14} /> 50:50
                                        </button>

                                        {/* Shield Lifeline */}
                                        <button
                                            onClick={triggerShield}
                                            disabled={usedShield || shieldActive || feedbackState !== null}
                                            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl border font-bold text-xs uppercase tracking-wider italic transition-all duration-300 cursor-pointer ${
                                                usedShield
                                                    ? 'border-white/5 bg-transparent text-slate-600 cursor-not-allowed opacity-30'
                                                    : shieldActive 
                                                        ? 'border-amber-400 bg-amber-500/30 text-amber-200 font-black animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                                                        : 'border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-black hover:scale-[1.02] shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                                            }`}
                                        >
                                            <Shield size={14} /> {shieldActive ? 'Shield Active' : 'Shield'}
                                        </button>

                                        {/* Skip Lifeline */}
                                        <button
                                            onClick={triggerSkip}
                                            disabled={usedSkip || feedbackState !== null}
                                            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl border font-bold text-xs uppercase tracking-wider italic transition-all duration-300 cursor-pointer ${
                                                usedSkip
                                                    ? 'border-white/5 bg-transparent text-slate-600 cursor-not-allowed opacity-30'
                                                    : 'border-purple-400/50 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-black hover:scale-[1.02] shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                                            }`}
                                        >
                                            <Sparkles size={14} /> Skip
                                        </button>

                                    </div>
                                </div>

                            </div>

                            {/* Animated Progression Points Ladder (Right 1 column) */}
                            <div className="bg-[#0e1424]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden group">
                                <div className="border-b border-white/10 pb-4 mb-4">
                                    <h4 className="font-black text-xs uppercase tracking-widest text-slate-200 text-center">Score Escalation Ladder</h4>
                                </div>

                                <div className="flex-1 flex flex-col gap-2.5 justify-center">
                                    {LADDER.map((item) => {
                                        const isActive = item.level === currentLevel;
                                        const isCompleted = item.level < currentLevel;

                                        let stepStyle = 'border-white/10 bg-white/5 text-slate-300 font-bold hover:text-white hover:bg-white/10';
                                        if (isActive) {
                                            stepStyle = 'border-cyan-400 bg-cyan-500/20 text-white font-black shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50 scale-[1.02]';
                                        } else if (isCompleted) {
                                            stepStyle = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-bold';
                                        }

                                        return (
                                            <motion.div
                                                key={item.level}
                                                animate={{
                                                    scale: isActive ? 1.03 : 1
                                                }}
                                                className={`py-2 px-4 rounded-xl border flex justify-between items-center text-[11px] uppercase tracking-wider transition-all duration-300 ${stepStyle}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    {isActive && <Zap size={10} className="text-[var(--text-accent)] animate-pulse" />}
                                                    {isCompleted && <CheckCircle size={10} className="text-emerald-400" />}
                                                    <span>{item.label}</span>
                                                </span>
                                                <span className="font-mono text-[10px] font-black">{item.points} pts</span>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>

                        </motion.div>
                    )}

                    {/* 3. VICTORY SCREEN */}
                    {gameStatus === 'victory' && (
                        <motion.div
                            key="victory-screen"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="max-w-xl w-full text-center space-y-8 backdrop-blur-2xl rounded-[3rem] p-12 relative overflow-hidden"
                            style={{ background: '#041a0e', border: '1px solid rgba(16,185,129,0.4)', boxShadow: '0 30px 100px rgba(16,185,129,0.2)' }}
                        >
                            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(16,185,129,0.12), transparent)' }} />
                            
                            <div className="relative z-10 space-y-6">
                                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto" style={{ border: '2px solid #10b981', background: 'rgba(16,185,129,0.1)', color: '#34d399', boxShadow: '0 0 40px rgba(16,185,129,0.4)' }}>
                                    <Trophy size={48} />
                                </div>

                                <div className="space-y-2">
                                    <h2 className="text-4xl sm:text-5xl font-black italic uppercase tracking-tighter" style={{ color: '#10b981', textShadow: '0 0 30px rgba(16,185,129,0.7), 0 0 60px rgba(16,185,129,0.3)' }}>
                                        QUEST CHAMPION!
                                    </h2>
                                    <p className="font-bold uppercase tracking-[0.2em] text-[11px]" style={{ color: '#e2e8f0' }}>You have successfully conquered all {totalLevels} security matrix grids</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto my-6">
                                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}>
                                        <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Final Points</p>
                                        <p className="text-2xl font-mono font-black mt-1" style={{ color: '#34d399' }}>{score}</p>
                                    </div>
                                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}>
                                        <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Completed</p>
                                        <p className="text-2xl font-mono font-black mt-1" style={{ color: '#ffffff' }}>{totalLevels} / {totalLevels}</p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    {quizId ? (
                                        <>
                                            <button
                                                onClick={() => navigate(`/report/${quizId}`)}
                                                className="flex-1 h-14 rounded-2xl font-black text-sm italic uppercase tracking-wider hover:scale-[1.03] active:scale-95 transition-all cursor-pointer"
                                                style={{ background: '#10b981', color: '#000000', border: '1px solid #34d399', boxShadow: '0 10px 25px rgba(16,185,129,0.4)' }}
                                            >
                                                View Report
                                            </button>
                                            <button
                                                onClick={() => navigate('/assessments')}
                                                className="flex-1 h-14 rounded-2xl font-black text-sm italic uppercase tracking-wider active:scale-95 transition-all cursor-pointer hover:opacity-90"
                                                style={{ background: '#334155', color: '#ffffff', border: '1px solid #475569', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
                                            >
                                                Games Arena
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={handleReset}
                                                className="flex-1 h-14 rounded-2xl font-black text-sm italic uppercase tracking-wider hover:scale-[1.03] active:scale-95 transition-all cursor-pointer"
                                                style={{ background: '#10b981', color: '#000000', border: '1px solid #34d399', boxShadow: '0 10px 25px rgba(16,185,129,0.4)' }}
                                            >
                                                Play Again
                                            </button>
                                            <button
                                                onClick={() => navigate('/student-dashboard')}
                                                className="flex-1 h-14 rounded-2xl font-black text-sm italic uppercase tracking-wider active:scale-95 transition-all cursor-pointer hover:opacity-90"
                                                style={{ background: '#334155', color: '#ffffff', border: '1px solid #475569', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
                                            >
                                                Dashboard
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* 4. GAME OVER SCREEN */}
                    {gameStatus === 'gameover' && (
                        <motion.div
                            key="gameover-screen"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="max-w-xl w-full text-center space-y-8 backdrop-blur-2xl rounded-[3rem] p-12 relative overflow-hidden"
                            style={{ background: '#1a0505', border: '1px solid rgba(239,68,68,0.4)', boxShadow: '0 30px 100px rgba(239,68,68,0.25)' }}
                        >
                            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(239,68,68,0.12), transparent)' }} />
                            
                            <div className="relative z-10 space-y-6">
                                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto animate-pulse" style={{ border: '2px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#f87171', boxShadow: '0 0 40px rgba(239,68,68,0.4)' }}>
                                    <AlertTriangle size={48} />
                                </div>

                                <div className="space-y-2">
                                    <h2 className="text-4xl sm:text-5xl font-black italic uppercase tracking-tighter" style={{ color: '#ff4444', textShadow: '0 0 30px rgba(239,68,68,0.7), 0 0 60px rgba(239,68,68,0.3)' }}>
                                        SYSTEM CRASH!
                                    </h2>
                                    <p className="font-bold uppercase tracking-[0.2em] text-[11px]" style={{ color: '#e2e8f0' }}>Your neural matrix connection has collapsed</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto my-6">
                                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}>
                                        <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Acquired Score</p>
                                        <p className="text-2xl font-mono font-black mt-1" style={{ color: '#f87171' }}>{score}</p>
                                    </div>
                                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}>
                                        <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Highest Level</p>
                                        <p className="text-2xl font-mono font-black mt-1" style={{ color: '#ffffff' }}>Level {currentLevel}</p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    {quizId ? (
                                        <>
                                            <button
                                                onClick={() => navigate(`/report/${quizId}`)}
                                                className="flex-1 h-14 rounded-2xl font-black text-sm italic uppercase tracking-wider hover:scale-[1.03] active:scale-95 transition-all cursor-pointer"
                                                style={{ background: '#ef4444', color: '#ffffff', border: '1px solid #f87171', boxShadow: '0 10px 25px rgba(239,68,68,0.4)' }}
                                            >
                                                View Report
                                            </button>
                                            <button
                                                onClick={() => navigate('/assessments')}
                                                className="flex-1 h-14 rounded-2xl font-black text-sm italic uppercase tracking-wider active:scale-95 transition-all cursor-pointer hover:opacity-90"
                                                style={{ background: '#334155', color: '#ffffff', border: '1px solid #475569', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
                                            >
                                                Games Arena
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={handleReset}
                                                className="flex-1 h-14 rounded-2xl font-black text-sm italic uppercase tracking-wider hover:scale-[1.03] active:scale-95 transition-all cursor-pointer"
                                                style={{ background: '#ef4444', color: '#ffffff', border: '1px solid #f87171', boxShadow: '0 10px 25px rgba(239,68,68,0.4)' }}
                                            >
                                                Retry Quest
                                            </button>
                                            <button
                                                onClick={() => navigate('/student-dashboard')}
                                                className="flex-1 h-14 rounded-2xl font-black text-sm italic uppercase tracking-wider active:scale-95 transition-all cursor-pointer hover:opacity-90"
                                                style={{ background: '#334155', color: '#ffffff', border: '1px solid #475569', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
                                            >
                                                Dashboard
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </main>

            {/* STATUS ROW footer */}
            <footer className="max-w-7xl mx-auto w-full px-6 flex justify-between items-center border-t border-white/5 pt-4 text-[9px] text-slate-500 font-bold uppercase tracking-widest relative z-50">
                <span>Cyber Quest Engine v1.0.0</span>
                <span>Active Encapsulation Secure</span>
            </footer>

        </div>
    );
}
