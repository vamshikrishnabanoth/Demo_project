import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Brain, Clock, FastForward, Flame, Sparkles, AlertCircle } from 'lucide-react';

export const LIFELINE_COSTS = {
    FIFTY_FIFTY: 20,
    ASK_AI: 30,
    EXTRA_TIME: 15,
    SKIP: 10,
};

export default function QuizLifelines({
    points = 100,
    streak = 0,
    onUseFiftyFifty,
    onUseAskAi,
    onUseExtraTime,
    onUseSkip,
    fiftyFiftyUsed = false,
    askAiUsed = false,
    extraTimeUsed = false,
    disabled = false,
    optionsCount = 4,
}) {
    const lifelines = [
        {
            id: 'fiftyFifty',
            label: '50 / 50',
            subtitle: 'Eliminate 2 choices',
            icon: Zap,
            cost: LIFELINE_COSTS.FIFTY_FIFTY,
            used: fiftyFiftyUsed,
            hidden: optionsCount < 4,
            action: onUseFiftyFifty,
            color: 'from-amber-500 to-orange-500',
            border: 'border-amber-400/40',
            bg: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300',
        },
        {
            id: 'askAi',
            label: 'Ask AI',
            subtitle: 'Concept Clue',
            icon: Brain,
            cost: LIFELINE_COSTS.ASK_AI,
            used: askAiUsed,
            hidden: false,
            action: onUseAskAi,
            color: 'from-purple-500 to-indigo-600',
            border: 'border-indigo-400/40',
            bg: 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300',
        },
        {
            id: 'extraTime',
            label: '+15s Clock',
            subtitle: 'Extend timer',
            icon: Clock,
            cost: LIFELINE_COSTS.EXTRA_TIME,
            used: extraTimeUsed,
            hidden: false,
            action: onUseExtraTime,
            color: 'from-emerald-500 to-teal-600',
            border: 'border-emerald-400/40',
            bg: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
        },
        {
            id: 'skip',
            label: 'Pass / Skip',
            subtitle: 'Advance safely',
            icon: FastForward,
            cost: LIFELINE_COSTS.SKIP,
            used: false,
            hidden: false,
            action: onUseSkip,
            color: 'from-sky-500 to-blue-600',
            border: 'border-sky-400/40',
            bg: 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300',
        },
    ];

    return (
        <div className="w-full mb-6 relative">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                    {/* Points & Multiplier Badge */}
                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start">
                        <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border border-amber-500/30 rounded-2xl px-3.5 py-1.5 shadow-xs">
                            <Sparkles size={16} className="text-amber-500 animate-pulse" />
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">PTS:</span>
                                <motion.span 
                                    key={points}
                                    initial={{ scale: 1.2, color: '#f59e0b' }}
                                    animate={{ scale: 1, color: 'inherit' }}
                                    className="text-base font-black italic tracking-tight text-slate-900 dark:text-white"
                                >
                                    {points}
                                </motion.span>
                            </div>
                        </div>

                        {/* Streak Badge */}
                        {streak > 0 && (
                            <motion.div 
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl px-3 py-1.5"
                            >
                                <Flame size={16} className="text-rose-500 fill-rose-500 animate-bounce" />
                                <span className="text-xs font-black italic tracking-tight text-rose-600 dark:text-rose-400">
                                    {streak}x STREAK {streak >= 3 ? '(+20% Yield)' : ''}
                                </span>
                            </motion.div>
                        )}
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:flex">
                        <span>Lifeline Deck</span>
                    </div>
                </div>

                {/* Lifeline Action Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {lifelines.filter(item => !item.hidden).map((line) => {
                        const canAfford = points >= line.cost;
                        const isActionDisabled = disabled || line.used || !canAfford;
                        const Icon = line.icon;

                        return (
                            <motion.button
                                key={line.id}
                                type="button"
                                whileHover={!isActionDisabled ? { scale: 1.02, y: -1 } : {}}
                                whileTap={!isActionDisabled ? { scale: 0.97 } : {}}
                                onClick={() => {
                                    if (!isActionDisabled && line.action) {
                                        line.action();
                                    }
                                }}
                                disabled={isActionDisabled}
                                className={`relative group p-2.5 sm:p-3 rounded-2xl border transition-all text-left flex flex-col justify-between overflow-hidden cursor-pointer ${
                                    line.used
                                        ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                                        : !canAfford
                                        ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                                        : `${line.bg} ${line.border} shadow-xs hover:shadow-md`
                                }`}
                                title={
                                    line.used
                                        ? 'Already activated for this sequence'
                                        : !canAfford
                                        ? `Requires ${line.cost} points (You have ${points})`
                                        : `${line.subtitle} (Costs ${line.cost} pts)`
                                }
                            >
                                <div className="flex items-center justify-between w-full mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-xl ${line.used ? 'bg-slate-200 dark:bg-slate-700 text-slate-400' : 'bg-white/80 dark:bg-slate-800 text-current shadow-xs'}`}>
                                            <Icon size={16} />
                                        </div>
                                        <span className="font-black text-xs uppercase tracking-tight italic">
                                            {line.label}
                                        </span>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                                        line.used 
                                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                                            : canAfford 
                                            ? 'bg-white/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-current/10'
                                            : 'bg-rose-100 text-rose-600'
                                    }`}>
                                        {line.used ? 'USED' : `-${line.cost}`}
                                    </span>
                                </div>
                                <span className="text-[10px] font-medium opacity-70 tracking-tight block truncate">
                                    {line.subtitle}
                                </span>
                            </motion.button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
