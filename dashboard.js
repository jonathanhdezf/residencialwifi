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
    const statusText = getStatusText(item.status);
    const statusColor = item.status === 'paid' ? '#10b981' : (item.status === 'pending' ? '#f59e0b' : '#f43f5e');
    const statusBg = item.status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : (item.status === 'pending' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(244, 63, 94, 0.1)');

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
        body { font-family: 'Outfit', sans-serif; background-color: #f8fafc; color: #1e293b; padding: 40px; margin: 0; }
        .receipt-card { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%); padding: 30px; color: white; display: flex; justify-content: space-between; align-items: center; }
        .logo-area { display: flex; align-items: center; gap: 10px; }
        .logo-img { width: 40px; height: 40px; object-fit: contain; }
        .logo-text { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
        .receipt-body { padding: 40px; }
        .title { font-size: 24px; font-weight: 700; margin-bottom: 20px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .info-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .info-value { font-size: 16px; font-weight: 600; color: #1e293b; }
        .summary-card { background: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; }
        .amount-row { display: flex; justify-content: space-between; align-items: center; }
        .amount-total { font-size: 28px; font-weight: 700; color: #4f46e5; }
        .status-badge { display: inline-block; padding: 6px 12px; border-radius: 99px; font-size: 13px; font-weight: 600; text-transform: uppercase; color: ${statusColor}; background: ${statusBg}; border: 1px solid ${statusColor}44; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        .print-btn { display: block; width: 100%; padding: 12px; background: #4f46e5; color: white; text-align: center; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; transition: background 0.2s; }
        @media print { .print-btn { display: none; } body { background: white; padding: 0; } .receipt-card { box-shadow: none; border: none; } }
    </style>
</head>
<body>
    <div class="receipt-card">
        <div class="header">
            <div class="logo-area">
                <img src="https://github.com/jonathanhdezf/residencialwifi/blob/main/fiberhub_logo_nebula.png?raw=true" class="logo-img">
                <span class="logo-text">FiberHub</span>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 12px; opacity: 0.8;">Recibo Electrónico</div>
                <div style="font-weight: 600;">#${Math.random().toString(36).substr(2, 9).toUpperCase()}</div>
            </div>
        </div>
        <div class="receipt-body">
            <div class="title">Comprobante de Pago</div>
            
            <div class="info-grid">
                <div>
                    <div class="info-label">Periodo de Servicio</div>
                    <div class="info-value">${item.period}</div>
                </div>
                <div>
                    <div class="info-label">Fecha de Emisión</div>
                    <div class="info-value">${item.date}</div>
                </div>
            </div>

            <div class="summary-card">
                <div class="info-label">Estado del Pago</div>
                <div style="margin-bottom: 20px;">
                    <span class="status-badge">${statusText}</span>
                </div>
                <div class="amount-row">
                    <div class="info-label" style="margin: 0;">Total Pagado</div>
                    <div class="amount-total">${item.amount}</div>
                </div>
            </div>

            <a href="javascript:window.print()" class="print-btn">Imprimir / Guardar PDF</a>
        </div>
        <div class="footer">
            Fiberlink Servicios TIC | Soporte 24/7 | © 2026 FiberHub
        </div>
    </div>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Recibo_${item.period.replace(/ /g, '_')}.html`;
    a.click();
    notify.success('Recibo generado perfectamente');
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
