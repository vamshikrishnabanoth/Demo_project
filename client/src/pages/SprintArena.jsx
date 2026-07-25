import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Zap, Clock, Trophy, Play, RotateCw, Home, AlertTriangle, 
    Volume2, VolumeX, CheckCircle2, XCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import api from '../utils/api';

const FALLBACK_QUESTIONS = [
    {
        questionText: "Which TCP/IP protocol is used to securely transfer files over a network tunnel?",
        options: ["FTP", "SFTP", "HTTP", "TELNET"],
        correctAnswer: "SFTP",
        explanation: "SFTP (SSH File Transfer Protocol) provides secure file transmission over an encrypted SSH connection."
    },
    {
        questionText: "What represents the main conceptual advantage of utilizing a Relational Database (RDBMS)?",
        options: [
            "Infinite physical write speeds",
            "Structured queries and foreign key integrity",
            "No syntax validations are required",
            "Hardware routers are completely bypassed"
        ],
        correctAnswer: "Structured queries and foreign key integrity",
        explanation: "Relational databases enforce constraints, references, and schemas, allowing structured querying (SQL)."
    },
    {
        questionText: "What represents the primary vulnerability target in an SQL Injection attack?",
        options: [
            "Hardware cooling system faults",
            "Unsanitized client queries compiled as commands",
            "Missing firewall rules on local subnets",
            "Wireless encryption algorithm flaws"
        ],
        correctAnswer: "Unsanitized client queries compiled as commands",
        explanation: "SQL injection occurs when user inputs are concatenated directly into SQL queries, letting attackers execute arbitrary commands."
    },
    {
        questionText: "Which encryption key scheme does HTTPS utilize to establish a secure browser connection?",
        options: [
            "Symmetric cryptography only",
            "Asymmetric handshakes to exchange symmetric session keys",
            "No keys, only hashing algorithms",
            "Hardware token keys only"
        ],
        correctAnswer: "Asymmetric handshakes to exchange symmetric session keys",
        explanation: "HTTPS combines asymmetric encryption (SSL/TLS handshake) with high-efficiency symmetric cryptography for the data transfer session."
    },
    {
        questionText: "What type of malware is explicitly designed to lock data systems and demand payment?",
        options: ["Adware", "Trojan Horse", "Ransomware", "Spyware"],
        correctAnswer: "Ransomware",
        explanation: "Ransomware encrypts target files and folders, requiring a digital payment (usually cryptocurrency) for the decryption key."
    },
    {
        questionText: "Which HTML5 tag is strictly utilized to define high-level descriptive table rows?",
        options: ["<td>", "<tr>", "<th>", "<table>"],
        correctAnswer: "<tr>",
        explanation: "<tr> defines a table row, <th> defines table headers, and <td> defines table cells."
    },
    {
        questionText: "What represents a fundamental operational characteristic of a RESTful API architecture?",
        options: [
            "Always stateful server sessions",
            "Stateless communication over standard HTTP",
            "Direct hardware registry access",
            "Requires active mechanical local storage"
        ],
        correctAnswer: "Stateless communication over standard HTTP",
        explanation: "RESTful architecture uses stateless, standardized HTTP requests (GET, POST, PUT, DELETE) to manage system resources."
    },
    {
        questionText: "In git, which command downloads all latest commits from a remote server without merging them?",
        options: ["git push", "git pull", "git fetch", "git clone"],
        correctAnswer: "git fetch",
        explanation: "git fetch downloads objects and refs from another repository without altering your active local workspace."
    },
    {
        questionText: "Which data structure follows a strict First-In, First-Out (FIFO) queue layout?",
        options: ["Stack", "Queue", "Binary Search Tree", "Hash Map"],
        correctAnswer: "Queue",
        explanation: "A Queue works on a FIFO basis, where items are appended to the tail (enqueue) and pulled from the head (dequeue)."
    },
    {
        questionText: "What represents the main conceptual advantage of adopting Docker Container virtualization?",
        options: [
            "Avoids standard networking firewalls",
            "Ensures identical software execution environments across platforms",
            "Optimizes database writing triggers mechanically",
            "Eliminating compile bugs automatically"
        ],
        correctAnswer: "Ensures identical software execution environments across platforms",
        explanation: "Docker bundles code and all dependencies into a lightweight container, guaranteeing consistent deployment anywhere."
    }
];

export default function SprintArena() {
    const location = useLocation();
    const navigate = useNavigate();

    // ── Load questions from routing state or use fallback CS questions ────────
    const rawQuestions = location.state?.questions || FALLBACK_QUESTIONS;
    const topicTitle = location.state?.title || 'System Core Matrix';

    // Normalize
    const questions = rawQuestions.slice(0, 10).map((q) => ({
        questionText: q.questionText || '',
        options: Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: q.correctAnswer || '',
        explanation: q.explanation || 'No concept description supplied.'
    }));

    // ── GAME STATE ───────────────────────────────────────────────────────────
    const [gameStatus, setGameStatus] = useState('start'); // 'start' | 'playing' | 'gameover'
    const [sessionId, setSessionId] = useState(() => {
        return crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2, 15) + Date.now().toString(36));
    });
    const hasSubmitted = useRef(false);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [timer, setTimer] = useState(45); // Starts at 45 seconds
    const [score, setScore] = useState(0);

    const [correctAnswers, setCorrectAnswers] = useState(0);
    const [wrongAnswers, setWrongAnswers] = useState(0);

    // UI Animations
    const [shakeCard, setShakeCard] = useState(false);
    const [flashRed, setFlashRed] = useState(false);
    const [floatingTexts, setFloatingTexts] = useState([]); // Array of floating indicator tags
    const [selectedOption, setSelectedOption] = useState(null);
    const [feedbackType, setFeedbackType] = useState(null); // 'correct' | 'wrong'
    const [muted, setMuted] = useState(false);

    const activeQuestion = questions[currentQuestion] || questions[0];

    // Refs to keep track of values inside interval loops
    const timerRef = useRef(timer);
    const statusRef = useRef(gameStatus);

    useEffect(() => { timerRef.current = timer; }, [timer]);
    useEffect(() => { statusRef.current = gameStatus; }, [gameStatus]);

    // Submit Gamification Score — raw metrics only (anti-cheat: backend computes XP)
    useEffect(() => {
        if (gameStatus === 'gameover' && !hasSubmitted.current) {
            hasSubmitted.current = true;
            api.post('/students/game-score', {
                gameType: 'sprint_arena',
                correctAnswers: correctAnswers,
                totalQuestions: correctAnswers + wrongAnswers,
                duration: Math.round(60 - timer), // time elapsed in seconds
                wrongAnswers: wrongAnswers,
                sessionId: sessionId
            }).catch(err => console.error('Failed to save score:', err));
        }
    }, [gameStatus, correctAnswers, wrongAnswers, timer, sessionId]);

    // ── Synthesized Audio Synthesis ──────────────────────────────────────────
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
                osc.frequency.setValueAtTime(520, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1040, ctx.currentTime + 0.25);
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
                osc.start();
                osc.stop(ctx.currentTime + 0.25);
            } else if (type === 'wrong') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(110, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(70, ctx.currentTime + 0.35);
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
                osc.start();
                osc.stop(ctx.currentTime + 0.35);
            } else if (type === 'tick') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                gain.gain.setValueAtTime(0.05, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
                osc.start();
                osc.stop(ctx.currentTime + 0.05);
            } else if (type === 'gameover') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.6);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
                osc.start();
                osc.stop(ctx.currentTime + 0.6);
            }
        } catch (e) {
            console.warn('Synth failed:', e);
        }
    }, [muted]);

    // ── Gameplay Clock Interval Loop ──────────────────────────────────────────
    useEffect(() => {
        let clock;
        if (gameStatus === 'playing') {
            clock = setInterval(() => {
                if (timerRef.current <= 1) {
                    setTimer(0);
                    setGameStatus('gameover');
                    playSound('gameover');
                    clearInterval(clock);
                } else {
                    setTimer(prev => prev - 1);
                    // play high-speed alert tick under 10 seconds
                    if (timerRef.current <= 10) {
                        playSound('tick');
                    }
                }
            }, 1000);
        }
        return () => clearInterval(clock);
    }, [gameStatus, playSound]);

    // ── Evaluate Option Choice ──────────────────────────────────────────────
    const handleSelectOption = (option) => {
        if (feedbackType !== null) return;
        setSelectedOption(option);

        const isCorrect = option === activeQuestion.correctAnswer;
        const floatId = Date.now();

        if (isCorrect) {
            setFeedbackType('correct');
            playSound('correct');
            
            // Add +5 seconds, score, and float tag
            setTimer(prev => Math.min(60, prev + 5)); // Cap timer at 60s
            setScore(prev => prev + 10);
            setCorrectAnswers(prev => prev + 1);
            confetti({ particleCount: 15, spread: 30, origin: { y: 0.85 } });

            setFloatingTexts(prev => [...prev, { id: floatId, text: '+5s', color: 'text-emerald-400 font-black' }]);

            // Move instantly to next question after small visual feedback
            setTimeout(() => {
                advanceGame();
            }, 550);

        } else {
            setFeedbackType('wrong');
            playSound('wrong');

            // Subtract 3s, card shake, red flash
            setTimer(prev => Math.max(0, prev - 3));
            setWrongAnswers(prev => prev + 1);
            setShakeCard(true);
            setFlashRed(true);

            setFloatingTexts(prev => [...prev, { id: floatId, text: '-3s', color: 'text-pink-500 font-black' }]);

            setTimeout(() => {
                setShakeCard(false);
                setFlashRed(false);
            }, 4000);

            setTimeout(() => {
                advanceGame();
            }, 550);
        }

        // Cleanup floating indicator tag
        setTimeout(() => {
            setFloatingTexts(prev => prev.filter(f => f.id !== floatId));
        }, 1200);
    };

    const advanceGame = () => {
        setSelectedOption(null);
        setFeedbackType(null);

        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(prev => prev + 1);
        } else {
            // Completed all questions
            setGameStatus('gameover');
            playSound('gameover');
        }
    };

    // ── Restart Game ───────────────────────────────────────────────────────────
    const handleReset = () => {
        setCurrentQuestion(0);
        setTimer(45);
        setScore(0);
        setCorrectAnswers(0);
        setWrongAnswers(0);
        setFloatingTexts([]);
        setSelectedOption(null);
        setFeedbackType(null);
        const uuid = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2, 15) + Date.now().toString(36));
        setSessionId(uuid);
        hasSubmitted.current = false;
        setGameStatus('playing');
        playSound('correct');
    };

    // ── Dynamic Timer Width & Color Math ─────────────────────────────────────
    const getTimerColorClass = () => {
        if (timer > 25) return 'from-cyan-400 to-emerald-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]';
        if (timer > 10) return 'from-amber-400 to-orange-500 shadow-[0_0_20px_rgba(245,158,11,0.4)]';
        return 'from-pink-500 to-red-600 shadow-[0_0_25px_rgba(244,63,94,0.5)] animate-pulse';
    };

    const attemptedTotal = correctAnswers + wrongAnswers;
    const accuracy = attemptedTotal > 0 ? Math.round((correctAnswers / attemptedTotal) * 100) : 0;

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-white font-inter relative overflow-hidden flex flex-col justify-between py-6">
            
            {/* Cyber Warning / Ambient Overlays */}
            <AnimatePresence>
                {flashRed && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.15 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-red-600 pointer-events-none z-45"
                    />
                )}
                {timer <= 10 && gameStatus === 'playing' && (
                    <motion.div 
                        animate={{ opacity: [0.03, 0.12, 0.03] }}
                        transition={{ duration: 0.6, repeat: Infinity }}
                        className="absolute inset-0 border-[6px] border-red-500/20 pointer-events-none z-45"
                    />
                )}
            </AnimatePresence>

            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-[140px] pointer-events-none -mr-64 -mt-64" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[140px] pointer-events-none -ml-64 -mb-64" />

            {/* HEADER BAR */}
            <header className="max-w-7xl mx-auto w-full px-6 flex justify-between items-center border-b border-white/5 pb-4 relative z-50">
                <div className="flex items-center gap-3">
                    <div className="bg-pink-600/10 border border-pink-500/30 w-10 h-10 rounded-lg flex items-center justify-center text-pink-400 shadow-[0_0_15px_rgba(219,39,119,0.2)]">
                        <Clock size={20} className="animate-spin-slow" />
                    </div>
                    <div>
                        <h1 className="text-md sm:text-lg font-black tracking-tight uppercase italic leading-none">
                            Sprint <span className="text-pink-500">Arena</span>
                        </h1>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Topic: {topicTitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setMuted(!muted)}
                        className="p-2.5 rounded-xl bg-[var(--bg-accent)] hover:bg-[var(--bg-accent-hover)] transition-all border border-[var(--bg-accent)] text-white shadow-md"
                        title={muted ? 'Unmute game sound' : 'Mute game sound'}
                    >
                        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <button 
                        onClick={() => navigate('/student-dashboard')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 transition-all border border-red-700 font-bold uppercase tracking-wider text-xs italic text-white shadow-md"
                    >
                        <Home size={14} /> Exit
                    </button>
                </div>
            </header>

            {/* MAIN GAMEPLAY ARENA */}
            <main className="max-w-4xl mx-auto w-full px-6 flex-1 flex flex-col justify-center my-6 relative z-10">
                
                {/* 1. SPRINT START SCREEN */}
                {gameStatus === 'start' && (
                    <motion.div
                        key="start-screen"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full text-center space-y-8 bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-[3rem] p-12 shadow-[0_30px_100px_rgba(0,0,0,0.5)] relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-pink-500/5 to-transparent pointer-events-none" />
                        
                        <div className="relative z-10 space-y-6">
                            <motion.div
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 1.8, repeat: Infinity }}
                                className="w-24 h-24 rounded-full border-2 border-pink-500 bg-pink-500/10 flex items-center justify-center mx-auto text-pink-400 shadow-[0_0_40px_rgba(219,39,119,0.25)]"
                            >
                                <Zap size={48} />
                            </motion.div>
                            
                            <div className="space-y-2">
                                <h2 className="text-4xl sm:text-5xl font-black italic uppercase tracking-tighter">
                                    Sprint <span className="text-pink-500 drop-shadow-[0_0_20px_rgba(219,39,119,0.3)]">Arena</span>
                                </h2>
                                <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-xs">High-Speed Time Attack Survival Mode</p>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-left text-xs leading-relaxed text-slate-300 max-w-sm mx-auto space-y-2">
                                <p className="font-bold text-center uppercase tracking-wider text-pink-400 mb-1">🎮 Game Manual</p>
                                <p>⚡ <b>Initial Timer:</b> You start with 45 seconds.</p>
                                <p>✅ <b>Correct Answer:</b> Grants +5 seconds and score increase.</p>
                                <p>❌ <b>Incorrect Answer:</b> Deducts -3 seconds immediately.</p>
                                <p>🛑 <b>Survival Goal:</b> Answer quickly to keep the energy bar active!</p>
                            </div>

                            <button
                                onClick={() => { setGameStatus('playing'); playSound('correct'); }}
                                className="w-full h-16 rounded-2xl bg-pink-600 text-white font-black text-xl italic uppercase tracking-[0.2em] shadow-[0_15px_30px_rgba(219,39,119,0.25)] border border-pink-500 hover:scale-[1.03] active:scale-95 transition-all"
                            >
                                Launch Sprint
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* 2. PLAYING VIEW */}
                {gameStatus === 'playing' && (
                    <div className="space-y-8 w-full relative">
                        
                        {/* Dynamic Horizontal Energy Timer Bar */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-slate-400 px-1">
                                <span>Core Matrix Stabilizer</span>
                                <span className={`font-mono text-sm ${timer <= 10 ? 'text-red-500 animate-pulse font-black' : 'text-slate-200'}`}>
                                    {timer} seconds
                                </span>
                            </div>
                            <div className="h-4 bg-white/5 border border-white/10 rounded-full p-0.5 overflow-hidden backdrop-blur-md">
                                <motion.div 
                                    initial={{ width: '75%' }}
                                    animate={{ width: `${(timer / 60) * 100}%` }}
                                    transition={{ duration: 0.1, ease: 'easeOut' }}
                                    className={`h-full rounded-full bg-gradient-to-r transition-all ${getTimerColorClass()}`}
                                />
                            </div>
                        </div>

                        {/* Question and Option Cards */}
                        <motion.div
                            animate={shakeCard ? { x: [-8, 8, -8, 8, 0] } : {}}
                            transition={{ duration: 0.35 }}
                            className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden group"
                        >
                            <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-6">
                                <span className="bg-pink-600/10 text-pink-400 font-black text-[10px] uppercase tracking-widest px-3 py-1 rounded-md border border-pink-500/20 shadow-[0_0_10px_rgba(219,39,119,0.1)]">
                                    Question {currentQuestion + 1} of {questions.length}
                                </span>
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Sprint Score</span>
                                    <span className="font-mono text-lg font-black text-pink-500 drop-shadow-[0_0_10px_rgba(219,39,119,0.2)]">{score} pts</span>
                                </div>
                            </div>

                            {/* Question Text */}
                            <div className="my-6 min-h-[70px]">
                                <h3 className="text-xl sm:text-2xl font-black leading-snug text-white tracking-tight">
                                    {activeQuestion.questionText}
                                </h3>
                            </div>

                            {/* Option Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 relative">
                                
                                {/* Floating +5s / -3s indicators */}
                                <AnimatePresence>
                                    {floatingTexts.map((f) => (
                                        <motion.div
                                            key={f.id}
                                            initial={{ opacity: 1, y: 30, scale: 0.8 }}
                                            animate={{ opacity: 0, y: -90, scale: 1.4 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.85, ease: 'easeOut' }}
                                            className={`absolute inset-0 flex items-center justify-center pointer-events-none z-50 text-4xl italic tracking-tighter ${f.color}`}
                                        >
                                            {f.text}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {activeQuestion.options.map((option, idx) => {
                                    const isSelected = selectedOption === option;
                                    const isCorrectChoice = option === activeQuestion.correctAnswer;

                                    let cardStyle = 'border-white/5 bg-white/[0.02] hover:border-white/20';
                                    if (feedbackType === 'correct') {
                                        if (isCorrectChoice) cardStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
                                        else if (isSelected) cardStyle = 'border-white/5 bg-white/[0.01] opacity-30';
                                    } else if (feedbackType === 'wrong') {
                                        if (isCorrectChoice) cardStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-300';
                                        else if (isSelected) cardStyle = 'border-pink-500 bg-pink-500/10 text-pink-300 shadow-[0_0_15px_rgba(219,39,119,0.15)]';
                                    }

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => handleSelectOption(option)}
                                            disabled={feedbackType !== null}
                                            className={`p-5 rounded-2xl border text-left font-semibold text-sm transition-all duration-300 flex items-center justify-between cursor-pointer ${cardStyle}`}
                                        >
                                            <span className="flex gap-3 items-center">
                                                <span className="font-mono uppercase text-pink-400 font-black text-xs border border-pink-500/20 px-2 py-0.5 rounded bg-white/5">
                                                    {['A', 'B', 'C', 'D'][idx]}
                                                </span>
                                                <span>{option}</span>
                                            </span>
                                            {feedbackType === 'correct' && isCorrectChoice && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
                                            {feedbackType === 'wrong' && isSelected && <XCircle size={16} className="text-pink-400 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>

                        </motion.div>

                    </div>
                )}

                {/* 3. GAME OVER SUMMARY */}
                {gameStatus === 'gameover' && (
                    <motion.div
                        key="gameover-screen"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full text-center space-y-8 bg-white/[0.02] backdrop-blur-2xl border border-pink-500/20 rounded-[3rem] p-12 shadow-[0_30px_100px_rgba(219,39,119,0.15)] relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-pink-500/10 to-transparent pointer-events-none" />
                        
                        <div className="relative z-10 space-y-6">
                            <div className="w-24 h-24 rounded-full border-2 border-pink-500 bg-pink-500/10 flex items-center justify-center mx-auto text-pink-400 shadow-[0_0_40px_rgba(219,39,119,0.35)]">
                                <Trophy size={48} />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-4xl sm:text-5xl font-black italic uppercase tracking-tighter text-pink-500">
                                    Sprint Complete!
                                </h2>
                                <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Your survival matrix has consolidated</p>
                            </div>

                            {/* Stat Grids */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto my-6">
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Final Score</p>
                                    <p className="text-2xl font-mono font-black text-pink-400 mt-1">{score} pts</p>
                                </div>
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Correct Splits</p>
                                    <p className="text-2xl font-mono font-black text-emerald-400 mt-1">{correctAnswers}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Wrong Splits</p>
                                    <p className="text-2xl font-mono font-black text-red-400 mt-1">{wrongAnswers}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Accuracy Rate</p>
                                    <p className="text-2xl font-mono font-black text-white mt-1">{accuracy}%</p>
                                </div>
                            </div>

                            <div className="flex gap-4 max-w-md mx-auto">
                                <button
                                    onClick={handleReset}
                                    className="flex-1 h-14 rounded-2xl bg-pink-600 text-white font-black text-md italic uppercase tracking-wider border border-pink-500 hover:scale-[1.03] active:scale-95 transition-all shadow-[0_10px_20px_rgba(219,39,119,0.25)] cursor-pointer"
                                >
                                    <RotateCw size={14} className="inline mr-2" /> Play Again
                                </button>
                                <button
                                    onClick={() => navigate('/student-dashboard')}
                                    className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-md italic uppercase tracking-wider hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                                >
                                    Dashboard
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

            </main>

            {/* STATUS ROW footer */}
            <footer className="max-w-7xl mx-auto w-full px-6 flex justify-between items-center border-t border-white/5 pt-4 text-[9px] text-slate-500 font-bold uppercase tracking-widest relative z-50">
                <span>Sprint Matrix Engine v1.0.0</span>
                <span>Active Time Deflection Stabilized</span>
            </footer>

        </div>
    );
}
