import { auth } from './auth.js';
import { dbData } from './store.js';
import { notify } from './notifications.js';

// Guard
const user = await auth.requireAuth();
if (!user) throw new Error('Unauthorized');

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => auth.logout());

// Modal Refs
const aliasModal = document.getElementById('aliasModal');
const historyModal = document.getElementById('historyModal');
const speedTestModal = document.getElementById('speedTestModal');

// --- MODAL UTILS ---
function openModal(id) {
    const modal = document.getElementById(id);
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 400);
}

// Click outside to close
[aliasModal, historyModal, speedTestModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal.id);
    });
});

// Data Refresh
async function loadData() {
    const profile = await dbData.getProfile(user.id);
    if (!profile) return;

    // Mark admin messages as read
    await dbData.markMessagesRead(user.id, 'admin');

    // Name & Alias
    document.getElementById('userNameDisplay').textContent = user.name || user.username;
    const aliasDisplay = document.getElementById('userAliasDisplay');
    if (profile.alias) {
        aliasDisplay.textContent = profile.alias;
        aliasDisplay.style.fontStyle = 'italic';
        aliasDisplay.style.color = 'var(--accent)';
    } else {
        aliasDisplay.textContent = '+ Agregar Alias';
        aliasDisplay.style.fontStyle = 'normal';
        aliasDisplay.style.color = 'var(--text-muted)';
    }

    // Payment Status
    const paymentBadge = document.getElementById('paymentStatus');
    paymentBadge.textContent = getStatusText(profile.paymentStatus);
    paymentBadge.className = `status-badge ${getStatusClass(profile.paymentStatus)}`;
    document.getElementById('paymentDate').textContent = profile.nextPaymentDate || 'Pendiente';

    // Speed Display
    simulateSpeedTest(profile.internetSpeed || 0);

    // Messages
    renderMessages(profile.messages || []);

    // WiFi Details
    updateWifiDisplay(profile.wifiSSID, profile.wifiPass);
}

function updateWifiDisplay(ssid, pass) {
    const ssidEl = document.getElementById('dashSsid');
    const passEl = document.getElementById('dashPass');
    const qrImg = document.getElementById('dashWifiQr');
    const qrPlaceholder = document.getElementById('dashQrPlaceholder');

    if (ssid && pass) {
        ssidEl.textContent = ssid;
        passEl.textContent = pass;
        const wifiString = `WIFI:S:${ssid};T:WPA;P:${pass};;`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(wifiString)}`;
        qrImg.src = qrUrl;
        qrImg.style.display = 'block';
        qrPlaceholder.style.display = 'none';
    } else {
        ssidEl.textContent = 'Pendiente de configurar';
        passEl.textContent = '••••••••';
        qrImg.style.display = 'none';
        qrPlaceholder.style.display = 'flex';
    }
}

// Alias Logic
document.getElementById('userAliasDisplay').addEventListener('click', async () => {
    const profile = await dbData.getProfile(user.id);
    document.getElementById('aliasInput').value = profile.alias || '';
    openModal('aliasModal');
});

document.getElementById('cancelAliasBtn').addEventListener('click', () => closeModal('aliasModal'));
document.getElementById('saveAliasBtn').addEventListener('click', async () => {
    const newAlias = document.getElementById('aliasInput').value.trim();
    await dbData.updateProfile(user.id, { alias: newAlias });
    closeModal('aliasModal');
    loadData();
});

// History Logic
document.getElementById('viewHistoryBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    const profile = await dbData.getProfile(user.id);
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';

    profile.paymentHistory?.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 0.75rem 0.5rem; border-bottom: 1px solid var(--border);">${item.period}</td>
            <td style="padding: 0.75rem 0.5rem; border-bottom: 1px solid var(--border);">${item.date}</td>
            <td style="padding: 0.75rem 0.5rem; border-bottom: 1px solid var(--border);">${item.amount}</td>
            <td style="padding: 0.75rem 0.5rem; border-bottom: 1px solid var(--border);">
                <span class="status-badge ${getStatusClass(item.status)}" style="font-size: 0.75rem; padding: 0.1rem 0.5rem;">
                    ${getStatusText(item.status)}
                </span>
            </td>
            <td style="padding: 0.75rem 0.5rem; border-bottom: 1px solid var(--border); text-align: center;">
                <button class="download-receipt-btn" data-period="${item.period}" data-date="${item.date}" data-amount="${item.amount}" data-status="${item.status}" style="background: none; border: none; color: var(--accent); cursor: pointer;">📥</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (!tbody.hasAttribute('data-listener')) {
        tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('.download-receipt-btn');
            if (btn) downloadReceipt({
                period: btn.dataset.period,
                date: btn.dataset.date,
                amount: btn.dataset.amount,
                status: btn.dataset.status
            });
        });
        tbody.setAttribute('data-listener', 'true');
    }
    openModal('historyModal');
});

document.getElementById('closeHistoryBtn').addEventListener('click', () => closeModal('historyModal'));

// Speed Simulation
let speedInterval;
function simulateSpeedTest(maxSpeed) {
    const speedValue = document.getElementById('speedValue');
    const speedBar = document.getElementById('speedBar');
    if (speedInterval) clearInterval(speedInterval);
    let current = 0;
    speedInterval = setInterval(() => {
        const diff = maxSpeed - current;
        current += Math.max(0.5, diff * 0.1);
        if (Math.abs(maxSpeed - current) < 0.5) {
            current = maxSpeed;
            clearInterval(speedInterval);
        }
        speedValue.textContent = Math.floor(current);
        speedBar.style.width = `${Math.min(100, (current / 200) * 100)}%`;
    }, 50);
}

// Typing Emojis
document.querySelectorAll('.btn-emoji').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById('messageInput');
        input.value += btn.textContent;
        input.focus();
    });
});

// Message Render
function renderMessages(messages, forceScroll = false) {
    const messageList = document.getElementById('messageList');
    const threshold = 100;
    const isAtBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < threshold;

    messageList.innerHTML = '';
    messages.forEach(msg => {
        const div = document.createElement('div');
        const isSent = msg.from !== 'admin';
        const time = new Date(msg.timestamp).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' });

        div.className = `message ${isSent ? 'sent' : 'received'}`;
        div.innerHTML = `
            <div style="font-weight: 600; font-size: 0.75rem; margin-bottom: 0.2rem; opacity: 0.8;">
                ${isSent ? 'Tú' : 'Administración'}
            </div>
            <div>${msg.text}</div>
            <div style="font-size: 0.65rem; opacity: 0.6; margin-top: 0.25rem; text-align: right;">${time}</div>
        `;
        messageList.appendChild(div);
    });

    if (forceScroll || isAtBottom) messageList.scrollTop = messageList.scrollHeight;
}

document.getElementById('messageForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (text) {
        await dbData.addMessage(user.id, { from: 'resident', text });
        notify.playSendSound();
        input.value = '';
        const profile = await dbData.getProfile(user.id);
        renderMessages(profile.messages, true);
    }
});

// Utils
function getStatusText(status) {
    if (status === 'paid') return 'Pagado';
    if (status === 'pending') return 'Pendiente';
    return 'Vencido';
}

function getStatusClass(status) {
    if (status === 'paid') return 'status-paid';
    if (status === 'pending') return 'status-pending';
    return 'status-error';
}

function downloadReceipt(item) {
    const html = `<html><body style="font-family: sans-serif; padding: 40px;"><div style="border: 1px solid #ddd; padding: 20px; border-radius: 8px;"><h2>Recibo de Internet</h2><p>Periodo: ${item.period}</p><p>Monto: ${item.amount}</p><p>Estado: ${getStatusText(item.status)}</p><p>Fecha: ${item.date}</p></div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Recibo_${item.period}.html`;
    a.click();
    notify.info('Recibo descargado');
}

// Polling
setInterval(() => {
    loadData();
    checkNewMessages();
}, 5000);

let lastCount = 0;
let first = true;
async function checkNewMessages() {
    const profile = await dbData.getProfile(user.id);
    if (!profile) return;
    const current = profile.messages.length;
    if (!first && current > lastCount) {
        const last = profile.messages[current - 1];
        if (last.from === 'admin') {
            notify.playReceiveSound();
            notify.show('Mensaje de Administración', last.text);
        }
    }
    lastCount = current;
    first = false;
}

loadData();
notify.requestPermission();
