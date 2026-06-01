import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Zap, Trophy, Play, RotateCw, Home, Cpu, Eye, 
    Volume2, VolumeX, Layers, CheckCircle2, AlertTriangle, Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import api from '../utils/api';

const FALLBACK_QUESTIONS = [
    { questionText: "Which TCP/IP protocol is used to securely transfer files over a network tunnel?", correctAnswer: "SFTP" },
    { questionText: "What represents the main conceptual advantage of utilizing a Relational Database (RDBMS)?", correctAnswer: "Structured queries and foreign keys" },
    { questionText: "What represents the primary vulnerability target in an SQL Injection attack?", correctAnswer: "Unsanitized user inputs" },
    { questionText: "Which encryption key scheme does HTTPS utilize to establish a secure browser connection?", correctAnswer: "Asymmetric handshakes + symmetric keys" },
    { questionText: "What type of malware is explicitly designed to lock data systems and demand payment?", correctAnswer: "Ransomware" },
    { questionText: "Which HTML5 tag is strictly utilized to define high-level descriptive table rows?", correctAnswer: "<tr>" },
    { questionText: "What represents a RESTful API core design characteristic?", correctAnswer: "Statelessness over HTTP" },
    { questionText: "In git, which command downloads remote commits without merging?", correctAnswer: "git fetch" },
    { questionText: "Which data structure follows a strict First-In, First-Out (FIFO) queue layout?", correctAnswer: "Queue" },
    { questionText: "What represents the main conceptual advantage of adopting Docker Container virtualization?", correctAnswer: "Identical isolated runtimes" },
    { questionText: "Which CPU component executes arithmetic and logical operations directly?", correctAnswer: "ALU" },
    { questionText: "What is the primary memory caching standard located closest to CPU registers?", correctAnswer: "L1 Cache" }
];

export default function MatchUpArena() {
    const location = useLocation();
    const navigate = useNavigate();

    // ── Load questions from location state or use fallbacks ──────────────────
    const rawQuestions = location.state?.questions || FALLBACK_QUESTIONS;
    const topicTitle = location.state?.title || 'System Core Matrix';

    // Normalize
    const normalizedQuestions = rawQuestions.map(q => ({
        questionText: q.questionText || '',
        correctAnswer: q.correctAnswer || ''
    }));

    // ── GAME STATES ──────────────────────────────────────────────────────────
    const [gameStatus, setGameStatus] = useState('start'); // 'start' | 'playing' | 'victory'
    const [sessionId, setSessionId] = useState(() => {
        return crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2, 15) + Date.now().toString(36));
    });
    const hasSubmitted = useRef(false);
    const [difficulty, setDifficulty] = useState('medium'); // 'easy' | 'medium' | 'hard'

    const [cards, setCards] = useState([]);
    const [selectedCards, setSelectedCards] = useState([]); // indices of currently selected cards
    const [matchedCards, setMatchedCards] = useState([]);   // IDs of matched cards
    const [mismatchedCards, setMismatchedCards] = useState([]); // indices of mismatched cards (for shake/red borders)
    const [isStartRevealActive, setIsStartRevealActive] = useState(false);
    const [revealCountdown, setRevealCountdown] = useState(0);


    const [moves, setMoves] = useState(0);
    const [matches, setMatches] = useState(0);
    const [timer, setTimer] = useState(0);
    
    // Stats tracking
    const [correctMatches, setCorrectMatches] = useState(0);
    const [wrongAttempts, setWrongAttempts] = useState(0);

    const [muted, setMuted] = useState(false);

    const timerRef = useRef(timer);
    useEffect(() => { timerRef.current = timer; }, [timer]);

    // Metric Math
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const baseScore = matches * 100;
    const accuracyVal = moves > 0 ? Math.round((correctMatches / moves) * 100) : 0;
    const accuracyBonus = Math.max(0, accuracyVal * 10);
    const speedBonus = Math.max(0, (240 - timer) * 4);
    const finalScore = baseScore + accuracyBonus + speedBonus;

    const completionPercentage = cards.length > 0 ? Math.round((matchedCards.length / cards.length) * 100) : 0;
    const totalPairs = cards.length / 2;

    // Submit Gamification Score — raw metrics only (anti-cheat: backend computes XP)
    useEffect(() => {
        if (gameStatus === 'victory' && !hasSubmitted.current) {
            hasSubmitted.current = true;
            api.post('/students/game-score', {
                gameType: 'match_up',
                correctAnswers: correctMatches,  // number of matched pairs
                totalQuestions: totalPairs,
                duration: 240 - timer,           // time elapsed in seconds
                moves: moves,                    // total card flips made
                sessionId: sessionId
            }).catch(err => console.error('Failed to save score:', err));
        }
    }, [gameStatus, correctMatches, totalPairs, timer, moves, sessionId]);

    // ── Synthesized Sound Oscillators ─────────────────────────────────────────
    const playSound = useCallback((type) => {
        if (muted) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            
            if (type === 'select') {
                // Short organic click
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(300, ctx.currentTime);
                gain.gain.setValueAtTime(0.06, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
                osc.start();
                osc.stop(ctx.currentTime + 0.15);
            } else if (type === 'match') {
                // Happy double chime
                const now = ctx.currentTime;
                [523.25, 659.25].forEach((f, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.frequency.setValueAtTime(f, now + i * 0.08);
                    gain.gain.setValueAtTime(0.07, now + i * 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
                    osc.start(now + i * 0.08);
                    osc.stop(now + i * 0.08 + 0.2);
                });
            } else if (type === 'mismatch') {
                // Double low buzz
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(120, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.3);
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                osc.start();
                osc.stop(ctx.currentTime + 0.3);
            } else if (type === 'victory') {
                // Glorious major chord melody
                const now = ctx.currentTime;
                [261.63, 329.63, 392.00, 523.25].forEach((f, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.frequency.setValueAtTime(f, now + i * 0.12);
                    gain.gain.setValueAtTime(0.08, now + i * 0.12);
                    gain.gain.exponentialRampToValueAtTime(0.002, now + i * 0.12 + 0.45);
                    osc.start(now + i * 0.12);
                    osc.stop(now + i * 0.12 + 0.45);
                });
            }
        } catch (e) {
            console.warn('Synth error:', e);
        }
    }, [muted]);

    // ── Timer clock ──────────────────────────────────────────────────────────
    useEffect(() => {
        let clock;
        if (gameStatus === 'playing' && !isStartRevealActive) {
            clock = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(clock);
    }, [gameStatus, isStartRevealActive]);

    // ── Initial Preview Countdown Ticker ─────────────────────────────────────
    useEffect(() => {
        let countdownTimer;
        if (isStartRevealActive && revealCountdown > 0) {
            countdownTimer = setTimeout(() => {
                setRevealCountdown(prev => prev - 1);
            }, 1000);
        } else if (isStartRevealActive && revealCountdown === 0) {
            setIsStartRevealActive(false);
        }
        return () => clearTimeout(countdownTimer);
    }, [isStartRevealActive, revealCountdown]);

    // ── Generate Pairs & Grid ────────────────────────────────────────────────
    const handleStartGame = () => {
        // Determine pair count based on difficulty
        let pairCount = 8; // Easy
        if (difficulty === 'medium') pairCount = 10;
        else if (difficulty === 'hard') pairCount = 12;

        // Fetch target pool questions
        let questionPool = [...normalizedQuestions];
        
        // Fill up to target using fallbacks if the generated pool size is too small
        if (questionPool.length < pairCount) {
            const needed = pairCount - questionPool.length;
            const extra = FALLBACK_QUESTIONS.slice(0, needed);
            questionPool = [...questionPool, ...extra];
        } else {
            questionPool = questionPool.slice(0, pairCount);
        }

        // Generate A and B memory cards
        const generatedCards = [];
        questionPool.forEach((q, idx) => {
            const pairId = `pair-${idx}`;
            
            // Card A (Question Text)
            generatedCards.push({
                id: `card-${idx}-q`,
                pairId,
                type: 'question',
                text: q.questionText,
                isFlipped: false
            });

            // Card B (Correct Answer Text)
            generatedCards.push({
                id: `card-${idx}-a`,
                pairId,
                type: 'answer',
                text: q.correctAnswer,
                isFlipped: false
            });
        });

        // Shuffle cards using Fisher-Yates shuffle
        for (let i = generatedCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [generatedCards[i], generatedCards[j]] = [generatedCards[j], generatedCards[i]];
        }

        setCards(generatedCards);
        setSelectedCards([]);
        setMatchedCards([]);
        setMismatchedCards([]);
        setMoves(0);
        setMatches(0);
        setTimer(0);
        setCorrectMatches(0);
        setWrongAttempts(0);
        setGameStatus('playing');
        playSound('victory');
        setIsStartRevealActive(true);
        setRevealCountdown(3);
    };

    const handleReset = () => {
        const uuid = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2, 15) + Date.now().toString(36));
        setSessionId(uuid);
        hasSubmitted.current = false;
        handleStartGame();
    };

    // ── Card Clicking Flow ───────────────────────────────────────────────────
    const handleCardClick = (index) => {
        // Block clicking if selected indices exceed 2, card is matched, or clicked card is already open
        if (isStartRevealActive || selectedCards.length >= 2 || matchedCards.includes(cards[index].id) || selectedCards.includes(index) || mismatchedCards.length > 0) return;

        playSound('select');
        
        const newSelected = [...selectedCards, index];
        setSelectedCards(newSelected);

        if (newSelected.length === 2) {
            // Evaluated Move
            setMoves(prev => prev + 1);
            const firstIdx = newSelected[0];
            const secondIdx = newSelected[1];

            const card1 = cards[firstIdx];
            const card2 = cards[secondIdx];

            // Evaluate Match
            if (card1.pairId === card2.pairId && card1.type !== card2.type) {
                // Match Found!
                setCorrectMatches(prev => prev + 1);
                setMatches(prev => prev + 1);
                playSound('match');
                confetti({ particleCount: 15, spread: 30, origin: { y: 0.85 } });

                setMatchedCards(prev => [...prev, card1.id, card2.id]);
                setSelectedCards([]);

                // Check victory condition
                const totalPairs = cards.length / 2;
                if (matches + 1 === totalPairs) {
                    setTimeout(() => {
                        setGameStatus('victory');
                        playSound('victory');
                        triggerVictoryConfetti();
                    }, 1200);
                }

            } else {
                // Mismatch
                setWrongAttempts(prev => prev + 1);
                playSound('mismatch');
                setMismatchedCards([firstIdx, secondIdx]);

                // Flip them back down after a delay
                setTimeout(() => {
                    setSelectedCards([]);
                    setMismatchedCards([]);
                }, 1200);
            }
        }
    };

    // ── Celebration Confetti Loops ──────────────────────────────────────────
    const triggerVictoryConfetti = () => {
        const duration = 4 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
        const randomInRange = (min, max) => Math.random() * (max - min) + min;

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            const particleCount = 35 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 220);
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-white font-inter relative overflow-hidden flex flex-col justify-between py-6">
            
            {/* Ambient Cyberglows */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[140px] pointer-events-none -mr-64 -mt-64" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none -ml-64 -mb-64" />

            {/* HEADER BAR */}
            <header className="max-w-7xl mx-auto w-full px-6 flex justify-between items-center border-b border-white/5 pb-4 relative z-50">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-600/10 border border-purple-500/30 w-10 h-10 rounded-lg flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                        <Cpu size={20} />
                    </div>
                    <div>
                        <h1 className="text-md sm:text-lg font-black tracking-tight uppercase italic leading-none">
                            Match-Up <span className="text-purple-400">Arena</span>
                        </h1>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Topic: {topicTitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setMuted(!muted)}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 text-slate-400 hover:text-white"
                        title={muted ? 'Unmute game sound' : 'Mute game sound'}
                    >
                        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <button 
                        onClick={() => navigate('/student-dashboard')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 font-bold uppercase tracking-wider text-xs italic text-slate-300 hover:text-white"
                    >
                        <Home size={14} /> Exit
                    </button>
                </div>
            </header>

            {/* MAIN GAME CONTAINER VIEW */}
            <main className="max-w-7xl mx-auto w-full px-6 flex-1 flex flex-col justify-center my-6 relative z-10">
                <AnimatePresence mode="wait">
                    
                    {/* 1. START SCREEN */}
                    {gameStatus === 'start' && (
                        <motion.div
                            key="start-screen"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="max-w-xl w-full mx-auto text-center space-y-8 bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-[3rem] p-12 shadow-[0_30px_100px_rgba(0,0,0,0.5)] relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />
                            
                            <div className="relative z-10 space-y-6">
                                <motion.div
                                    animate={{ scale: [1, 1.05, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="w-24 h-24 rounded-full border-2 border-purple-500 bg-purple-500/10 flex items-center justify-center mx-auto text-purple-400 shadow-[0_0_40px_rgba(168,85,247,0.25)]"
                                >
                                    <Layers size={48} />
                                </motion.div>
                                
                                <div className="space-y-2">
                                    <h2 className="text-4xl sm:text-5xl font-black italic uppercase tracking-tighter">
                                        Match-Up <span className="text-purple-400 drop-shadow-[0_0_20px_rgba(168,85,247,0.3)]">Arena</span>
                                    </h2>
                                    <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-xs">Visual Cognitive Terminology Matcher</p>
                                </div>

                                {/* Difficulty selector */}
                                <div className="space-y-3 max-w-xs mx-auto">
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest text-center">Select Grid Complexity</p>
                                    <div className="flex gap-2">
                                        {['easy', 'medium', 'hard'].map((d) => (
                                            <button
                                                key={d}
                                                onClick={() => setDifficulty(d)}
                                                className={`flex-1 py-2.5 rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all border ${
                                                    difficulty === d
                                                        ? 'bg-purple-600 border-purple-500 text-white font-black shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                                                        : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-slate-500 text-center font-bold">
                                        {difficulty === 'easy' && '4x4 Grid (8 pairs / 8 questions)'}
                                        {difficulty === 'medium' && '5x4 Grid (10 pairs / 10 questions)'}
                                        {difficulty === 'hard' && '6x4 Grid (12 pairs / 12 questions)'}
                                    </p>
                                </div>

                                <button
                                    onClick={handleStartGame}
                                    className="w-full h-16 rounded-2xl bg-purple-600 text-white font-black text-xl italic uppercase tracking-[0.2em] shadow-[0_15px_30px_rgba(168,85,247,0.25)] border border-purple-500 hover:scale-[1.03] active:scale-95 transition-all"
                                >
                                    Launch Match-Up
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* 2. PLAYING GRID */}
                    {gameStatus === 'playing' && (
                        <motion.div
                            key="playing-grid"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full grid grid-cols-1 lg:grid-cols-4 gap-8 items-stretch"
                        >
                            {/* Cards Memory Grid (Left 3 columns) */}
                            <div className="lg:col-span-3 flex flex-col justify-between gap-6">
                                
                                {isStartRevealActive && (
                                    <div className="bg-purple-600/10 border border-purple-500/30 text-purple-300 px-6 py-4 rounded-2xl flex items-center justify-between shadow-[0_0_20px_rgba(168,85,247,0.15)] text-xs font-bold uppercase tracking-wider animate-pulse">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-purple-500/20 w-8 h-8 rounded-lg flex items-center justify-center text-purple-400">
                                                <Eye size={16} />
                                            </div>
                                            <span>Memorize the board! Grid reveals ending in:</span>
                                        </div>
                                        <span className="font-mono text-sm bg-purple-500/30 border border-purple-500/40 px-4 py-1.5 rounded-xl text-white">
                                            {revealCountdown}s
                                        </span>
                                    </div>
                                )}

                                {/* Dynamic Grid Container */}
                                <div className={`grid gap-4 flex-1 ${
                                    difficulty === 'easy'
                                        ? 'grid-cols-2 md:grid-cols-4'
                                        : difficulty === 'medium'
                                            ? 'grid-cols-2 md:grid-cols-5 animate-in fade-in duration-300'
                                            : 'grid-cols-3 md:grid-cols-6 animate-in fade-in duration-300'
                                }`}>
                                    {cards.map((card, index) => {
                                        const isSelected = selectedCards.includes(index);
                                        const isMatched = matchedCards.includes(card.id);
                                        const isMismatched = mismatchedCards.includes(index);
                                        const isFlipped = isSelected || isMatched || isStartRevealActive;

                                        // Glow/Border Style Math
                                        let borderGlowClass = 'border-white/5 bg-white/[0.02] hover:border-white/20';
                                        if (isMatched) {
                                            borderGlowClass = 'border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)] opacity-80 cursor-default';
                                        } else if (isMismatched) {
                                            borderGlowClass = 'border-red-500 bg-red-500/10 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.15)]';
                                        } else if (isSelected) {
                                            borderGlowClass = 'border-cyan-400 bg-cyan-400/5 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.15)] scale-[1.03]';
                                        }

                                        return (
                                            <div
                                                key={card.id}
                                                onClick={() => !isMatched && handleCardClick(index)}
                                                className="h-32 md:h-36 relative cursor-pointer"
                                                style={{ perspective: 1000 }}
                                            >
                                                <motion.div
                                                    className={`absolute inset-0 w-full h-full rounded-2xl border flex items-center justify-center p-3 text-center transition-[border-color,background-color,color,box-shadow,opacity] duration-300 shadow-md ${borderGlowClass}`}
                                                    style={{ transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }}
                                                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                                                    transition={{ duration: 0.4 }}
                                                >
                                                    {/* CARD BACK SIDE (Face Down) */}
                                                    <div 
                                                        className="absolute inset-0 w-full h-full rounded-2xl flex flex-col items-center justify-center bg-white/[0.01] border-white/5"
                                                        style={{ 
                                                            transform: 'rotateY(0deg)',
                                                            WebkitTransform: 'rotateY(0deg)',
                                                            zIndex: isFlipped ? 1 : 2,
                                                            opacity: isFlipped ? 0 : 1,
                                                            transition: 'opacity 0.2s ease-in-out'
                                                        }}
                                                    >
                                                        <span className="text-5xl font-black uppercase tracking-widest text-purple-500/25 select-none">
                                                            {card.type === 'question' ? 'Q' : 'A'}
                                                        </span>
                                                    </div>

                                                    {/* CARD FRONT SIDE (Face Up - text rotated by 180 degrees to display correctly) */}
                                                    <div 
                                                        className="absolute inset-0 w-full h-full rounded-2xl flex flex-col items-center justify-center bg-white/[0.03] p-4 text-xs font-semibold overflow-y-auto leading-relaxed select-none"
                                                        style={{ 
                                                            transform: 'rotateY(180deg)',
                                                            WebkitTransform: 'rotateY(180deg)',
                                                            zIndex: isFlipped ? 2 : 1,
                                                            opacity: isFlipped ? 1 : 0,
                                                            transition: 'opacity 0.2s ease-in-out'
                                                        }}
                                                    >
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-purple-400 absolute top-2 left-3">
                                                            {card.type}
                                                        </span>
                                                        <p className="hyphens-auto break-words max-h-full">{card.text}</p>
                                                    </div>
                                                </motion.div>
                                            </div>
                                        );
                                    })}
                                </div>

                            </div>

                            {/* Real-time stats panel (Right 1 column) */}
                            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                                <div className="border-b border-white/5 pb-4 mb-4">
                                    <h4 className="font-black text-xs uppercase tracking-widest text-slate-400 text-center">Tactical Matrix Stats</h4>
                                </div>

                                <div className="flex-1 flex flex-col justify-center gap-6">
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Moves Attempted</p>
                                        <p className="text-2xl font-mono font-black text-purple-400 mt-1">{moves}</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Matches Resolved</p>
                                        <p className="text-2xl font-mono font-black text-emerald-400 mt-1">{matches} / {totalPairs}</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Time Elapsed</p>
                                        <p className="text-2xl font-mono font-black text-white mt-1">{formatTime(timer)}</p>
                                    </div>
                                </div>

                                <div className="space-y-2 mt-6 border-t border-white/5 pt-4">
                                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 px-1">
                                        <span>Consolidation Rate</span>
                                        <span>{completionPercentage}%</span>
                                    </div>
                                    <div className="h-2 bg-white/5 border border-white/10 rounded-full overflow-hidden">
                                        <motion.div 
                                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400"
                                            animate={{ width: `${completionPercentage}%` }}
                                            transition={{ duration: 0.3 }}
                                        />
                                    </div>
                                </div>
                            </div>

                        </motion.div>
                    )}

                    {/* 3. VICTORY SUMMARY SCREEN */}
                    {gameStatus === 'victory' && (
                        <motion.div
                            key="victory-screen"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="max-w-2xl w-full mx-auto text-center space-y-8 bg-white/[0.02] backdrop-blur-2xl border border-purple-500/20 rounded-[3rem] p-12 shadow-[0_30px_100px_rgba(168,85,247,0.15)] relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 to-transparent pointer-events-none" />
                            
                            <div className="relative z-10 space-y-6">
                                <div className="w-20 h-20 rounded-full border-2 border-purple-500 bg-purple-500/10 flex items-center justify-center mx-auto text-purple-400 shadow-[0_0_40px_rgba(168,85,247,0.35)]">
                                    <Trophy size={40} />
                                </div>

                                <div className="space-y-2">
                                    <h2 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tighter text-purple-400">
                                        🎉 Arena Resolved!
                                    </h2>
                                    <p className="text-slate-400 font-bold uppercase tracking-[0.25em] text-[9px]">All memory matrices paired successfully</p>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto my-6">
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Final Points</p>
                                        <p className="text-xl font-mono font-black text-purple-400 mt-1">{finalScore} pts</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Time Taken</p>
                                        <p className="text-xl font-mono font-black text-white mt-1">{formatTime(timer)}</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Total Moves</p>
                                        <p className="text-xl font-mono font-black text-cyan-400 mt-1">{moves}</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Matches Found</p>
                                        <p className="text-xl font-mono font-black text-emerald-400 mt-1">{correctMatches}</p>
                                    </div>
                                </div>

                                <div className="flex gap-4 max-w-md mx-auto">
                                    <button
                                        onClick={handleReset}
                                        className="flex-1 h-14 rounded-2xl bg-purple-600 text-white font-black text-md italic uppercase tracking-wider border border-purple-500 hover:scale-[1.03] active:scale-95 transition-all shadow-[0_10px_20px_rgba(168,85,247,0.25)] cursor-pointer"
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

                </AnimatePresence>
            </main>

            {/* STATUS ROW footer */}
            <footer className="max-w-7xl mx-auto w-full px-6 flex justify-between items-center border-t border-white/5 pt-4 text-[9px] text-slate-500 font-bold uppercase tracking-widest relative z-50">
                <span>Match-Up Grid Matrix v1.0.0</span>
                <span>Active 3D Hardware Deflection Stabilized</span>
            </footer>

        </div>
    );
}
