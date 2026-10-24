/**
 * Centralized, Memory-Safe Web Audio Synthesizer Singleton
 * Eliminates browser AudioContext leaks by reusing a single shared AudioContext
 * instead of creating unclosed instances on every tick/click.
 */

let sharedAudioCtx = null;

function getAudioContext() {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
        sharedAudioCtx = new AudioContextClass();
    }

    if (sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume().catch(() => {});
    }

    return sharedAudioCtx;
}

export function playSoundEffect(type, muted = false) {
    if (muted) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        if (type === 'correct') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(1040, now + 0.25);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'wrong') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(130, now);
            osc.frequency.linearRampToValueAtTime(70, now + 0.35);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
        } else if (type === 'tick') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'gameover') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(55, now + 0.6);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc.start(now);
            osc.stop(now + 0.6);
        } else if (type === 'shield') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(550, now);
            osc.frequency.linearRampToValueAtTime(250, now + 0.5);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        } else if (type === 'freeze') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1760, now + 0.4);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (type === 'heart') {
            [330, 440, 554.37].forEach((f, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, now + i * 0.08);
                gain.gain.setValueAtTime(0.08, now + i * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
                osc.start(now + i * 0.08);
                osc.stop(now + i * 0.08 + 0.2);
            });
        } else if (type === 'select') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, now);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'match') {
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
            [150, 120].forEach((f, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(f, now + i * 0.1);
                gain.gain.setValueAtTime(0.08, now + i * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.15);
                osc.start(now + i * 0.1);
                osc.stop(now + i * 0.1 + 0.15);
            });
        } else if (type === 'victory') {
            [440, 554.37, 659.25, 880].forEach((f, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(f, now + i * 0.12);
                gain.gain.setValueAtTime(0.1, now + i * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);
                osc.start(now + i * 0.12);
                osc.stop(now + i * 0.12 + 0.3);
            });
        }
    } catch (e) {
        // Silently ignore audio issues on background/unsupported devices
    }
}
