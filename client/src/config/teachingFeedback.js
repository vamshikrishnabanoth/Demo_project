// The teaching review is shown as written, evidence-backed feedback (strengths, what to try next, quoted moments).
// Ratings (the 0-100 number and per-area levels) stay hidden until they are validated against expert ratings:
// a 2026-11-22 test showed they do not yet separate weak from strong teaching or catch planted errors.
// Set VITE_SHOW_TEACHING_RATINGS=true to show them (research use only).
export const SHOW_TEACHING_RATINGS = import.meta.env.VITE_SHOW_TEACHING_RATINGS === 'true';
