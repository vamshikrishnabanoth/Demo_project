import Swal from 'sweetalert2';

// Standardized Elite Alert Configuration
export const royalAlert = Swal.mixin({
    background: 'transparent',
    color: 'var(--text-primary)',
    padding: '2.5rem',
    customClass: {
        popup: 'royal-swal-popup',
        title: 'royal-swal-title',
        htmlContainer: 'royal-swal-text',
        confirmButton: 'royal-swal-button royal-swal-confirm',
        cancelButton: 'royal-swal-button royal-swal-cancel',
    },
    showClass: {
        popup: 'arena-in'
    },
    hideClass: {
        popup: 'arena-out'
    },
    buttonsStyling: false,
});

// Theme-driven CSS injection for SweetAlert2
export const injectSwalStyles = () => {
    const style = document.createElement('style');
    style.id = 'royal-swal-styles'; // Used for idempotency check
    style.innerHTML = `
        @keyframes arenaIn {
            from {
                opacity: 0;
                transform: scale(0.85) translateY(20px);
                filter: blur(20px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
                filter: blur(0);
            }
        }
        @keyframes arenaOut {
            from {
                opacity: 1;
                transform: scale(1) translateY(0);
                filter: blur(0);
            }
            to {
                opacity: 0;
                transform: scale(1.05) translateY(-20px);
                filter: blur(20px);
            }
        }
        .arena-in {
            animation: arenaIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards !important;
        }
        .arena-out {
            animation: arenaOut 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards !important;
        }
        .royal-swal-popup {
            border-radius: 2.5rem !important;
            border: 1.5px solid var(--bg-accent) !important;
            box-shadow: 0 0 30px var(--bg-accent-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.6) !important;
            font-family: var(--app-font) !important;
            background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%) !important;
            backdrop-filter: blur(24px) !important;
            -webkit-backdrop-filter: blur(24px) !important;
            position: relative;
            overflow: hidden;
        }
        .royal-swal-popup::before {
            content: '';
            position: absolute;
            top: -20%;
            right: -20%;
            width: 80%;
            height: 80%;
            background: radial-gradient(circle, var(--bg-accent) 0%, transparent 70%);
            opacity: 0.08;
            pointer-events: none;
            filter: blur(40px);
        }
        .royal-swal-title {
            font-weight: 900 !important;
            text-transform: uppercase !important;
            font-style: italic !important;
            letter-spacing: -0.025em !important;
            color: var(--text-primary) !important;
        }
        .royal-swal-text {
            font-weight: 600 !important;
            color: var(--text-secondary) !important;
        }
        .royal-swal-button {
            padding: 1.25rem 2.5rem !important;
            border-radius: 1.5rem !important;
            font-weight: 900 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.1em !important;
            font-size: 0.75rem !important;
            margin: 0.5rem !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            cursor: pointer !important;
            border: none !important;
        }
        .royal-swal-confirm {
            background-color: var(--bg-accent) !important;
            color: var(--text-on-accent) !important;
            box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.4) !important;
        }
        .royal-swal-confirm:hover {
            transform: scale(1.05) !important;
            background-color: var(--bg-accent-hover) !important;
            box-shadow: 0 15px 30px -10px rgba(0, 0, 0, 0.6) !important;
        }
        .royal-swal-cancel {
            background-color: rgba(255, 255, 255, 0.05) !important;
            color: var(--text-primary) !important;
            border: 1px solid var(--border-color) !important;
        }
        .royal-swal-cancel:hover {
            background-color: rgba(255, 255, 255, 0.1) !important;
            transform: scale(1.05) !important;
        }
        .swal2-icon {
            border-width: 4px !important;
            border-color: var(--bg-accent) !important;
        }
        .swal2-icon.swal2-success { border-color: var(--success-bg) !important; }
        .swal2-icon.swal2-error { border-color: var(--error-bg) !important; }
        .swal2-icon.swal2-success [class^='swal2-success-line'] { background-color: var(--success-bg) !important; }
        .swal2-icon.swal2-success .swal2-success-ring { border-color: var(--success-bg, #22c55e) !important; opacity: 0.2; }
        .swal2-icon.swal2-error [class^='swal2-x-mark-line'] { background-color: var(--error-bg) !important; }
    `;
    document.head.appendChild(style);
};

// Auto-inject styles (idempotent — won't duplicate on HMR or re-imports)
if (typeof document !== 'undefined' && !document.getElementById('royal-swal-styles')) {
    injectSwalStyles();
}

export const showSuccess = (title, text, timer = 2000) => {
    return royalAlert.fire({
        title,
        text,
        icon: 'success',
        iconColor: 'var(--success-bg)',
        showConfirmButton: false,
        timer,
        timerProgressBar: true,
    });
};

export const showError = (title, text) => {
    return royalAlert.fire({
        title,
        text,
        icon: 'error',
        iconColor: 'var(--error-bg)',
    });
};

export const showConfirm = (title, text, confirmText = 'Yes, Proceed') => {
    return royalAlert.fire({
        title,
        text,
        icon: 'question',
        iconColor: 'var(--bg-accent)',
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: 'Cancel'
    });
};
