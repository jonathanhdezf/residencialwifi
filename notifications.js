/**
 * notifications.js
 * Handles audio feedback and system notifications.
 */

// Audio Context Singleton
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

export const notify = {
    // Check and request permission on initialization
    async requestPermission() {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    },

    // Play a subtle 'tick' or 'pop' for sending
    playSendSound() {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        // Sound Design: Quick high-pitch blip, very subtle
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    },

    // Play a pleasant 'ding' for receiving
    playReceiveSound() {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        // Sound Design: "Glassy" Ding (Sine ending with decay)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1); // Slide up slightly

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5); // Long tail

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
    },

    // Show system notification
    show(title, body, icon = null) {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: icon,
                silent: true
            });
        }
    },

    // UI Toasts (On-page notifications)
    toast(message, type = 'info') {
        const container = document.getElementById('toast-container') || this.createToastContainer();
        const toast = document.createElement('div');

        const colors = {
            success: 'var(--success)',
            error: 'var(--error)',
            info: 'var(--accent)',
            warning: 'var(--warning)'
        };

        toast.style.cssText = `
            background: rgba(9, 9, 11, 0.9);
            backdrop-filter: blur(10px);
            border-left: 4px solid ${colors[type] || colors.info};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            margin-top: 0.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            gap: 0.75rem;
            animation: slideIn 0.3s ease-out forwards;
            min-width: 250px;
            pointer-events: auto;
        `;

        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };

        toast.innerHTML = `<span>${icons[type] || '🔔'}</span> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 2rem;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            pointer-events: none;
        `;
        document.body.appendChild(container);

        // Add animations if not present
        if (!document.getElementById('toast-animations')) {
            const style = document.createElement('style');
            style.id = 'toast-animations';
            style.textContent = `
                @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
            `;
            document.head.appendChild(style);
        }
        return container;
    },

    success(m) { this.toast(m, 'success'); },
    info(m) { this.toast(m, 'info'); },
    error(m) { this.toast(m, 'error'); this.playSendSound(); },
    warning(m) { this.toast(m, 'warning'); }
};
