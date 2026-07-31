import React from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, AlertCircle, HelpCircle, X, Info } from 'lucide-react';

/**
 * Professional, High-Contrast White-Text Alert System for ProjectK.
 * Enforces 100% crisp pure white text (#ffffff) across all toast notifications & confirm popups.
 *
 * FIX (2024): Added deduplication via stable IDs so the same message never stacks.
 * Calling showError/showSuccess/showInfo with the same message replaces the existing toast
 * instead of creating a new one — prevents visual "pausing" and pile-up.
 */

// ─── Dismiss all currently visible toasts (useful on page unmount) ────────────
export const dismissAllToasts = () => toast.dismiss();

// ─── Stable ID helpers ────────────────────────────────────────────────────────
// Build a short deterministic string from the message so duplicate calls
// update/replace the existing toast rather than stacking new ones.
const stableId = (prefix, title) =>
    `${prefix}-${String(title || '').slice(0, 40).replace(/\s+/g, '-').toLowerCase()}`;

// ─── showSuccess ──────────────────────────────────────────────────────────────
export const showSuccess = (title, text, duration = 2400) => {
    const mainTitle = text ? title : (title || 'Success');
    const messageText = text ? text : '';
    const id = stableId('ok', mainTitle);

    return toast.custom((t) => (
        React.createElement('div', {
            className: `${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-slate-900/98 backdrop-blur-2xl border border-emerald-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(16,185,129,0.25)] rounded-2xl p-4 flex items-start gap-3.5 text-white pointer-events-auto transition-all`,
            style: { color: '#ffffff' }
        }, [
            React.createElement('div', {
                key: 'icon',
                className: 'p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 mt-0.5'
            }, React.createElement(CheckCircle2, { size: 20, className: 'stroke-[2.5]' })),
            React.createElement('div', {
                key: 'body',
                className: 'flex-1 min-w-0'
            }, [
                React.createElement('h4', {
                    key: 'title',
                    className: 'text-sm font-extrabold tracking-wide leading-snug',
                    style: { color: '#ffffff' }
                }, mainTitle),
                messageText ? React.createElement('p', {
                    key: 'desc',
                    className: 'text-xs font-semibold mt-0.5 leading-relaxed',
                    style: { color: '#f1f5f9' }
                }, messageText) : null
            ]),
            React.createElement('button', {
                key: 'close',
                onClick: () => toast.dismiss(t.id),
                className: 'text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer',
                style: { color: '#ffffff' }
            }, React.createElement(X, { size: 16 }))
        ])
    ), { duration, id, position: 'top-right' });
};

// ─── showError ────────────────────────────────────────────────────────────────
export const showError = (title, text, duration = 3800) => {
    const mainTitle = text ? title : (title || 'Error');
    const messageText = text ? text : '';
    const id = stableId('err', mainTitle);

    return toast.custom((t) => (
        React.createElement('div', {
            className: `${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-slate-900/98 backdrop-blur-2xl border border-rose-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(244,63,94,0.25)] rounded-2xl p-4 flex items-start gap-3.5 text-white pointer-events-auto transition-all`,
            style: { color: '#ffffff' }
        }, [
            React.createElement('div', {
                key: 'icon',
                className: 'p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0 mt-0.5'
            }, React.createElement(AlertCircle, { size: 20, className: 'stroke-[2.5]' })),
            React.createElement('div', {
                key: 'body',
                className: 'flex-1 min-w-0'
            }, [
                React.createElement('h4', {
                    key: 'title',
                    className: 'text-sm font-extrabold tracking-wide leading-snug',
                    style: { color: '#ffffff' }
                }, mainTitle),
                messageText ? React.createElement('p', {
                    key: 'desc',
                    className: 'text-xs font-semibold mt-0.5 leading-relaxed',
                    style: { color: '#f1f5f9' }
                }, messageText) : null
            ]),
            React.createElement('button', {
                key: 'close',
                onClick: () => toast.dismiss(t.id),
                className: 'text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer',
                style: { color: '#ffffff' }
            }, React.createElement(X, { size: 16 }))
        ])
    ), { duration, id, position: 'top-right' });
};

// ─── showInfo ─────────────────────────────────────────────────────────────────
export const showInfo = (title, text, duration = 2400) => {
    const mainTitle = text ? title : (title || 'Notice');
    const messageText = text ? text : '';
    const id = stableId('info', mainTitle);

    return toast.custom((t) => (
        React.createElement('div', {
            className: `${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-slate-900/98 backdrop-blur-2xl border border-blue-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(59,130,246,0.25)] rounded-2xl p-4 flex items-start gap-3.5 text-white pointer-events-auto transition-all`,
            style: { color: '#ffffff' }
        }, [
            React.createElement('div', {
                key: 'icon',
                className: 'p-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0 mt-0.5'
            }, React.createElement(Info, { size: 20, className: 'stroke-[2.5]' })),
            React.createElement('div', {
                key: 'body',
                className: 'flex-1 min-w-0'
            }, [
                React.createElement('h4', {
                    key: 'title',
                    className: 'text-sm font-extrabold tracking-wide leading-snug',
                    style: { color: '#ffffff' }
                }, mainTitle),
                messageText ? React.createElement('p', {
                    key: 'desc',
                    className: 'text-xs font-semibold mt-0.5 leading-relaxed',
                    style: { color: '#f1f5f9' }
                }, messageText) : null
            ]),
            React.createElement('button', {
                key: 'close',
                onClick: () => toast.dismiss(t.id),
                className: 'text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer',
                style: { color: '#ffffff' }
            }, React.createElement(X, { size: 16 }))
        ])
    ), { duration, id, position: 'top-right' });
};

// ─── showConfirm ──────────────────────────────────────────────────────────────
// Uses a long but FINITE duration (30s) instead of Infinity so it never freezes.
// Only one confirm dialog can be open at a time.
let activeConfirmId = null;
const CONFIRM_DURATION = 30_000; // 30 seconds — long enough for user to decide

export const showConfirm = (title, text, confirmText = 'Yes, Proceed') => {
    if (activeConfirmId) {
        toast.dismiss(activeConfirmId);
        activeConfirmId = null;
    }
    return new Promise((resolve) => {
        let resolved = false;
        const safeResolve = (val) => {
            if (resolved) return;
            resolved = true;
            resolve(val);
        };

        const id = toast.custom((t) => (
            React.createElement('div', {
                className: `${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-[var(--bg-secondary)] backdrop-blur-2xl border-2 border-[var(--border-color)] shadow-[0_25px_60px_rgba(0,0,0,0.25)] rounded-3xl p-6 pointer-events-auto transition-all space-y-5`,
                style: { color: 'var(--text-primary)' }
            }, [
                React.createElement('div', {
                    key: 'header',
                    className: 'flex items-start gap-4'
                }, [
                    React.createElement('div', {
                        key: 'icon',
                        className: 'p-3.5 rounded-2xl bg-[var(--bg-accent)]/15 text-[var(--text-accent)] border border-[var(--border-color)] shrink-0'
                    }, React.createElement(HelpCircle, { size: 26, className: 'stroke-[2.5]' })),
                    React.createElement('div', {
                        key: 'content',
                        className: 'flex-1 min-w-0 pt-0.5'
                    }, [
                        React.createElement('h3', {
                            key: 'h3',
                            className: 'text-lg font-black tracking-wide leading-tight text-[var(--text-primary)]',
                            style: { color: 'var(--text-primary)' }
                        }, title),
                        text ? React.createElement('p', {
                            key: 'p',
                            className: 'text-sm font-semibold mt-1.5 leading-relaxed text-[var(--text-secondary)]',
                            style: { color: 'var(--text-secondary)' }
                        }, text) : null
                    ])
                ]),
                React.createElement('div', {
                    key: 'actions',
                    className: 'flex items-center justify-end gap-3 pt-3.5 border-t border-[var(--border-color)]'
                }, [
                    React.createElement('button', {
                        key: 'cancel',
                        onClick: () => {
                            toast.dismiss(t.id);
                            if (activeConfirmId === t.id) activeConfirmId = null;
                            safeResolve({ isConfirmed: false });
                        },
                        className: 'px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 transition-all cursor-pointer shadow-xs',
                        style: { color: '#334155' }
                    }, 'Cancel'),
                    React.createElement('button', {
                        key: 'confirm',
                        onClick: () => {
                            toast.dismiss(t.id);
                            if (activeConfirmId === t.id) activeConfirmId = null;
                            safeResolve({ isConfirmed: true });
                        },
                        className: 'px-6 py-2.5 rounded-xl text-xs font-black bg-[var(--bg-accent)] text-[var(--text-on-accent)] shadow-lg hover:opacity-90 transition-all transform active:scale-95 cursor-pointer btn-cinematic',
                        style: { color: '#ffffff' }
                    }, confirmText)
                ])
            ])
        ), { duration: CONFIRM_DURATION, id: 'confirm-dialog', position: 'top-center' });

        activeConfirmId = id;

        // Auto-resolve as cancelled if the toast times out without user interaction
        setTimeout(() => {
            if (activeConfirmId === id) activeConfirmId = null;
            safeResolve({ isConfirmed: false });
        }, CONFIRM_DURATION);
    });
};

export const royalAlert = {
    fire: ({ title, text, icon }) => {
        if (icon === 'success') return showSuccess(title, text);
        if (icon === 'error') return showError(title, text);
        if (icon === 'question') return showConfirm(title, text);
        return showInfo(title, text);
    }
};

export default {
    showSuccess,
    showError,
    showInfo,
    showConfirm,
    dismissAllToasts,
    royalAlert
};
