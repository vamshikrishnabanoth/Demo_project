import React, { useState, useEffect, useRef, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, BookOpen, User, Hash, CornerDownLeft, Sparkles, Loader2 } from 'lucide-react';
import api from '../utils/api';
import AuthContext from '../context/AuthContext';

export default function GlobalSearch({ variant = 'navbar' }) {
    const navigate = useNavigate();
    const { user, theme } = useContext(AuthContext);
    
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState({ quizzes: [], users: [] });
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const inputRef = useRef(null);
    const modalRef = useRef(null);
    
    // Inline debouncing logic
    const [debouncedQuery, setDebouncedQuery] = useState('');
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuery(query);
        }, 250);
        return () => clearTimeout(handler);
    }, [query]);

    // Handle global keydown for Cmd/Ctrl + K shortcut
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
            setActiveIndex(0);
        } else {
            setQuery('');
            setResults({ quizzes: [], users: [] });
        }
    }, [isOpen]);

    // Fetch search results from backend API
    useEffect(() => {
        const fetchResults = async () => {
            if (!debouncedQuery.trim()) {
                setResults({ quizzes: [], users: [] });
                return;
            }
            setLoading(true);
            try {
                const res = await api.get(`/search/global?q=${encodeURIComponent(debouncedQuery)}`);
                setResults(res.data);
                setActiveIndex(0);
            } catch (err) {
                console.error('Error fetching global search results:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchResults();
    }, [debouncedQuery]);

    const totalResultsCount = results.quizzes.length + results.users.length;

    // Handle arrow keys navigation and Enter selection
    const handleKeyDown = (e) => {
        if (totalResultsCount === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((prev) => (prev + 1) % totalResultsCount);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((prev) => (prev - 1 + totalResultsCount) % totalResultsCount);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            selectItem(activeIndex);
        }
    };

    const selectItem = (index) => {
        let currentIndex = 0;
        
        // Check Quizzes
        for (let i = 0; i < results.quizzes.length; i++) {
            if (currentIndex === index) {
                const q = results.quizzes[i];
                setIsOpen(false);
                setQuery('');
                if (user?.role === 'student') {
                    if (q.completed && q.resultId) {
                        navigate(`/report/${q.resultId}`);
                    } else {
                        navigate(`/quiz/attempt/${q.id}`);
                    }
                } else {
                    if (q.matchedOn === 'question' && q.matchedQuestionIndex !== null && q.matchedQuestionIndex !== undefined) {
                        navigate(`/analytics/question/${q.id}/${q.matchedQuestionIndex}`);
                    } else {
                        navigate(`/analytics/quiz/${q.id}`);
                    }
                }
                return;
            }
            currentIndex++;
        }

        // Check Users
        for (let i = 0; i < results.users.length; i++) {
            if (currentIndex === index) {
                const u = results.users[i];
                setIsOpen(false);
                setQuery('');
                if (user?.role === 'admin') {
                    navigate('/admin/users');
                }
                return;
            }
            currentIndex++;
        }
    };

    // Text highlighter helper function (case-insensitive)
    const highlightText = (text, highlight) => {
        if (!highlight.trim()) return <span>{text}</span>;
        const regex = new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
        const parts = text.split(regex);
        return (
            <span>
                {parts.map((part, i) => 
                    regex.test(part) ? (
                        <mark key={i} className="bg-[var(--text-accent)]/20 text-[var(--text-accent)] px-0.5 rounded-sm font-black italic underline decoration-wavy decoration-1 decoration-[var(--text-accent)]">
                            {part}
                        </mark>
                    ) : (
                        part
                    )
                )}
            </span>
        );
    };

    return (
        <>
            {variant === 'dashboard' ? (
                /* Premium Full-Width Dashboard Search Trigger */
                <div 
                    onClick={() => setIsOpen(true)}
                    className="w-full max-w-none px-6 h-14 bg-[var(--bg-secondary)]/45 border border-[var(--border-color)] hover:border-[var(--text-accent)]/30 rounded-[1.25rem] cursor-pointer flex items-center justify-between transition-all duration-300 hover:scale-[1.005] hover:bg-[var(--bg-secondary)]/70 hover:shadow-[0_8px_30px_rgba(0,0,0,0.25)] group relative z-20 select-none"
                >
                    <div className="flex items-center gap-4">
                        <Search size={18} className="text-[var(--text-secondary)]/45 group-hover:text-[var(--text-accent)] transition-colors" />
                        <span className="text-sm font-semibold text-[var(--text-secondary)]/50 group-hover:text-[var(--text-primary)] transition-colors">Search by title, student, subject, topic, questions...</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <kbd className="bg-[var(--bg-primary)]/80 border border-[var(--border-color)] px-2.5 py-1 rounded-lg text-[9px] font-black text-[var(--text-secondary)]/40 uppercase shadow-sm tracking-wider group-hover:border-[var(--text-accent)]/30 transition-all">Ctrl K</kbd>
                    </div>
                </div>
            ) : (
                <>
                    {/* Desktop Search Trigger bar */}
                    <div 
                        onClick={() => setIsOpen(true)}
                        className="hidden lg:flex items-center gap-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--text-accent)]/40 px-4 py-2 rounded-2xl cursor-pointer w-64 transition-all duration-300 shadow-inner group"
                    >
                        <Search size={16} className="text-[var(--text-secondary)]/50 group-hover:text-[var(--text-accent)] transition-colors" />
                        <span className="text-xs font-bold text-[var(--text-secondary)]/60 group-hover:text-[var(--text-primary)] flex-1 transition-colors select-none">Search quizzes, students...</span>
                        <kbd className="bg-[var(--bg-primary)] border border-[var(--border-color)] px-2 py-0.5 rounded-md text-[10px] font-black text-[var(--text-secondary)]/50 uppercase shadow-sm select-none">Ctrl K</kbd>
                    </div>

                    {/* Mobile Search Icon Trigger */}
                    <button 
                        onClick={() => setIsOpen(true)}
                        className="lg:hidden p-3 bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-2xl border border-[var(--border-color)] hover:border-[var(--text-accent)]/30 transition-all duration-300"
                        aria-label="Search site"
                    >
                        <Search size={20} />
                    </button>
                </>
            )}

            {/* Spotlight Overlay Modal via React Portal to prevent parent element clipping */}
            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <>
                            {/* Backdrop Blur Overlay */}
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsOpen(false)}
                                className="fixed inset-0 bg-black/45 backdrop-blur-[8px] z-[99998] cursor-pointer"
                            />

                            {/* Viewport-relative Centered Search Container Card */}
                            <div 
                                className="fixed inset-x-0 flex justify-center px-4 pointer-events-none z-[99999]"
                                style={{
                                    top: 'clamp(70px, 8vh, 110px)',
                                }}
                            >
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.98, y: -8 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.98, y: -8 }}
                                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                    className="pointer-events-auto relative w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),0_0_40px_-5px_var(--bg-accent-glow)] overflow-hidden flex flex-col"
                                    style={{
                                        width: 'min(900px, 92vw)',
                                        maxHeight: '80vh',
                                    }}
                                    ref={modalRef}
                                    onKeyDown={handleKeyDown}
                                >
                            {/* Input Field wrapper */}
                            <div className="flex items-center gap-4 px-6 h-16 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] relative select-none rounded-t-3xl shrink-0">
                                <Search size={20} className="text-[var(--text-accent)] shrink-0 opacity-80" />
                                <input 
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Search by title, student, subject, topic, faculty..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="flex-1 bg-transparent global-search-input text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 font-bold focus:outline-none text-base border-none outline-none ring-0 focus:ring-0 p-0 h-full leading-normal"
                                    aria-autocomplete="list"
                                    aria-controls="search-results-listbox"
                                />
                                <div className="flex items-center gap-3 shrink-0">
                                    {loading && (
                                        <Loader2 className="animate-spin text-[var(--text-accent)] shrink-0" size={18} />
                                    )}
                                    {query && !loading && (
                                        <button 
                                            onClick={() => setQuery('')}
                                            className="p-1.5 hover:bg-[var(--bg-primary)] rounded-lg transition-colors text-[var(--text-secondary)] shrink-0 flex items-center justify-center"
                                            title="Clear search"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => setIsOpen(false)}
                                        className="text-[10px] font-black uppercase text-[var(--text-primary)] tracking-wider bg-[var(--bg-primary)] border border-[var(--border-color)] px-3 py-1.5 rounded-lg select-none shadow-sm hover:border-[var(--text-accent)] transition-all cursor-pointer active:scale-95"
                                        title="Close search"
                                    >
                                        ESC
                                    </button>
                                </div>
                            </div>

                            {/* Suggestions and Results listbox */}
                            <div className="flex-1 overflow-y-auto premium-scrollbar p-6 space-y-6 max-h-[45vh]" id="search-results-listbox" role="listbox">
                                {loading && !query && (
                                    <div className="flex flex-col items-center justify-center py-10 space-y-3">
                                        <Loader2 className="animate-spin text-[var(--text-accent)]" size={32} />
                                        <p className="text-xs font-bold text-[var(--text-secondary)]/40 uppercase tracking-widest animate-pulse">Running advanced tokenized index search...</p>
                                    </div>
                                )}

                                {!query && (
                                    <div className="text-center py-10 space-y-4">
                                        <div className="w-12 h-12 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-full flex items-center justify-center mx-auto text-[var(--text-accent)] shadow-inner">
                                            <Sparkles size={20} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-black text-[var(--text-primary)] uppercase italic tracking-wider">Spotlight Fuzzy Search Ready</p>
                                            <p className="text-xs font-bold text-[var(--text-secondary)]/60 max-w-sm mx-auto">Type anything to execute a high-performance typo-tolerant search across all quizzes, topics, subjects, students, and faculty.</p>
                                        </div>
                                    </div>
                                )}

                                {query && totalResultsCount === 0 && !loading && (
                                    <div className="text-center py-12 space-y-3">
                                        <p className="text-2xl">🔍</p>
                                        <p className="text-sm font-black text-[var(--text-primary)] uppercase italic tracking-wider">No matching results found</p>
                                        <p className="text-xs text-[var(--text-secondary)]/50 max-w-xs mx-auto">Double check spelling or search with shorter keywords (e.g. search "data" instead of "databse").</p>
                                    </div>
                                )}

                                {/* Results display */}
                                {query && totalResultsCount > 0 && (
                                    <>
                                        {/* Quizzes category */}
                                        {results.quizzes.length > 0 && (
                                            <div className="space-y-2">
                                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]/50 pl-2">Quizzes & Assessments ({results.quizzes.length})</h3>
                                                <div className="space-y-1.5">
                                                    {results.quizzes.map((quiz, idx) => {
                                                        const globalIdx = idx;
                                                        const isSelected = activeIndex === globalIdx;
                                                        return (
                                                            <div 
                                                                key={quiz.id}
                                                                onClick={() => {
                                                                    setIsOpen(false);
                                                                    setQuery('');
                                                                    if (user?.role === 'student') {
                                                                        if (quiz.completed && quiz.resultId) {
                                                                            navigate(`/report/${quiz.resultId}`);
                                                                        } else {
                                                                            navigate(`/quiz/attempt/${quiz.id}`);
                                                                        }
                                                                    } else {
                                                                        if (quiz.matchedOn === 'question' && quiz.matchedQuestionIndex !== null && quiz.matchedQuestionIndex !== undefined) {
                                                                            navigate(`/analytics/question/${quiz.id}/${quiz.matchedQuestionIndex}`);
                                                                        } else {
                                                                            navigate(`/analytics/quiz/${quiz.id}`);
                                                                        }
                                                                    }
                                                                }}
                                                                onMouseEnter={() => setActiveIndex(globalIdx)}
                                                                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                                                                    isSelected 
                                                                        ? 'bg-[var(--bg-primary)] border-[var(--text-accent)]/50 shadow-lg' 
                                                                        : 'bg-[var(--bg-primary)]/30 border-transparent hover:border-[var(--border-color)]'
                                                                }`}
                                                                role="option"
                                                                aria-selected={isSelected}
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`p-3 rounded-xl ${isSelected ? 'bg-[var(--text-accent)]/15 text-[var(--text-accent)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]/50'}`}>
                                                                        <BookOpen size={16} />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-black text-sm text-[var(--text-primary)]">{highlightText(quiz.title, query)}</h4>
                                                                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px] font-bold text-[var(--text-secondary)]/60 uppercase tracking-wider">
                                                                            <span>Topic: <strong className="text-[var(--text-primary)]/80">{highlightText(quiz.topic, query)}</strong></span>
                                                                            <span>•</span>
                                                                            <span>Faculty: <strong className="text-[var(--text-primary)]/80">{highlightText(quiz.faculty, query)}</strong></span>
                                                                            <span>•</span>
                                                                            <span className={`px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[9px] ${quiz.difficulty === 'Hard' ? 'text-rose-400' : quiz.difficulty === 'Easy' ? 'text-green-400' : 'text-blue-400'}`}>{quiz.difficulty}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    {quiz.matchedOn && (
                                                                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)]/60 border border-[var(--border-color)] group-hover:border-[var(--text-accent)]/20">Matched on {quiz.matchedOn}</span>
                                                                    )}
                                                                    {isSelected && (
                                                                        <CornerDownLeft size={14} className="text-[var(--text-accent)] animate-pulse" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Users category */}
                                        {results.users.length > 0 && user?.role === 'admin' && (
                                            <div className="space-y-2">
                                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]/50 pl-2">Students & Faculty ({results.users.length})</h3>
                                                <div className="space-y-1.5">
                                                    {results.users.map((user, idx) => {
                                                        const globalIdx = results.quizzes.length + idx;
                                                        const isSelected = activeIndex === globalIdx;
                                                        return (
                                                            <div 
                                                                key={user.id}
                                                                onClick={() => {
                                                                    setIsOpen(false);
                                                                    setQuery('');
                                                                    if (user?.role === 'admin') {
                                                                        navigate('/admin/users');
                                                                    }
                                                                }}
                                                                onMouseEnter={() => setActiveIndex(globalIdx)}
                                                                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                                                                    isSelected 
                                                                        ? 'bg-[var(--bg-primary)] border-[var(--text-accent)]/50 shadow-lg' 
                                                                        : 'bg-[var(--bg-primary)]/30 border-transparent hover:border-[var(--border-color)]'
                                                                }`}
                                                                role="option"
                                                                aria-selected={isSelected}
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`p-3 rounded-xl ${isSelected ? 'bg-[var(--text-accent)]/15 text-[var(--text-accent)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]/50'}`}>
                                                                        <User size={16} />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-black text-sm text-[var(--text-primary)]">{highlightText(user.username, query)}</h4>
                                                                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px] font-bold text-[var(--text-secondary)]/60 uppercase tracking-wider">
                                                                            <span>Email: <strong className="text-[var(--text-primary)]/80">{highlightText(user.email, query)}</strong></span>
                                                                            <span>•</span>
                                                                            <span>Branch: <strong className="text-[var(--text-primary)]/80">{highlightText(user.studentBranch, query)}</strong></span>
                                                                            <span>•</span>
                                                                            <span>Section: <strong className="text-[var(--text-primary)]/80">{highlightText(user.section, query)}</strong></span>
                                                                            <span>•</span>
                                                                            <span className={`px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[9px] ${user.role === 'teacher' ? 'text-amber-400' : 'text-purple-400'}`}>{user.role}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    {user.matchedOn && (
                                                                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)]/60 border border-[var(--border-color)] group-hover:border-[var(--text-accent)]/20">Matched on {user.matchedOn}</span>
                                                                    )}
                                                                    {isSelected && (
                                                                        <CornerDownLeft size={14} className="text-[var(--text-accent)] animate-pulse" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Search bar footer instructions */}
                            <div className="bg-[var(--bg-primary)]/40 p-4 border-t border-[var(--border-color)] flex justify-between items-center text-[10px] font-black text-[var(--text-secondary)]/50 uppercase tracking-wider">
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1"><kbd className="bg-[var(--bg-primary)] px-1 rounded shadow-sm border border-[var(--border-color)]">↑↓</kbd> to navigate</span>
                                    <span className="flex items-center gap-1"><kbd className="bg-[var(--bg-primary)] px-1 rounded shadow-sm border border-[var(--border-color)]">Enter</kbd> to select</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[var(--text-accent)]">
                                    <Sparkles size={10} className="animate-spin" />
                                    <span>Typo-Tolerant Engine Active</span>
                                </div>
                            </div>
                                </motion.div>
                            </div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}
