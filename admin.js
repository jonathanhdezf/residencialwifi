import { auth } from './auth.js';
import { dbData } from './store.js';
import { notify } from './notifications.js';

// Guard
const adminUser = await auth.requireAdmin();
if (!adminUser) throw new Error('Unauthorized');

document.getElementById('adminName').textContent = adminUser.name;

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => auth.logout());

// Flag to prevent multiple concurrent renders
let isRendering = false;
let currentManagerUserId = null;
let currentChatUserId = null;

async function renderResidentList() {
  if (isRendering) return;
  isRendering = true;

  try {
    const users = await dbData.getUsers();
    const residents = users.filter(u => u.role === 'resident');
    const profiles = await Promise.all(residents.map(u => dbData.getProfile(u.id)));

    const tbody = document.getElementById('residentTableBody');
    if (!tbody) return;

    let html = '';
    for (let i = 0; i < residents.length; i++) {
      const user = residents[i];
      let profile = profiles[i];
      if (!profile) continue;

      // --- AUTO OVERDUE LOGIC ---
      const nextDateStr = convertDateForInput(profile.nextPaymentDate);
      const nextDate = new Date(nextDateStr + 'T23:59:59');
      const today = new Date();

      if (profile.paymentStatus === 'pending' && today > nextDate) {
        profile.paymentStatus = 'overdue';
        dbData.updateProfile(user.id, { paymentStatus: 'overdue' });
      }

      const displayAlias = profile.alias ? `<div style="font-size: 0.85em; color: var(--accent);">${profile.alias}</div>` : '';

      html += `
                <tr>
                    <td style="padding: 1rem; border-bottom: 1px solid var(--border); font-weight: 500;">
                        ${user.username}
                        ${displayAlias}
                    </td>
                    <td style="padding: 1rem; border-bottom: 1px solid var(--border);">
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <span style="padding: 0.25rem 0.5rem; border-radius: 999px; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; background: ${getStatusColor(profile.paymentStatus)}; display: inline-block; width: fit-content;">
                                ${getStatusText(profile.paymentStatus)}
                            </span>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">
                                Vence: ${profile.nextPaymentDate || 'N/A'}
                            </span>
                        </div>
                    </td>
                    <td style="padding: 1rem; border-bottom: 1px solid var(--border);">
                        <div class="table-actions">
                            <button class="btn btn-primary open-chat-btn" data-userid="${user.id}" style="font-size: 0.85rem;">
                                Mensajes ${profile.messages.filter(m => m.from === 'resident' && !m.read).length ? '🔴' : ''}
                            </button>
                            <button class="btn open-mgr-btn" data-userid="${user.id}" style="font-size: 0.85rem; border: 1px solid var(--border); background: rgba(255,255,255,0.1);">
                                Gestionar Cliente
                            </button>
                            <button class="btn notify-overdue-btn" data-userid="${user.id}" 
                                style="font-size: 0.85rem; border: 1px solid rgba(244,63,94,0.3); background: rgba(244,63,94,0.1); color: #fb7185; ${profile.paymentStatus !== 'overdue' ? 'display:none;' : ''}"
                                title="Enviar aviso de pago vencido">
                                🔔 Notificar
                            </button>
                        </div>
                    </td>
                </tr>
            `;
    }

    tbody.innerHTML = html;

    // Re-attach listeners
    document.querySelectorAll('.open-chat-btn').forEach(btn => {
      btn.addEventListener('click', () => openChat(btn.dataset.userid));
    });
    document.querySelectorAll('.open-mgr-btn').forEach(btn => {
      btn.addEventListener('click', () => openManager(btn.dataset.userid));
    });
    document.querySelectorAll('.notify-overdue-btn').forEach(btn => {
      btn.addEventListener('click', () => notifyOverdue(btn.dataset.userid));
    });
  } catch (err) {
    console.error("Error rendering resident list:", err);
  } finally {
    isRendering = false;
  }
}

function getStatusColor(status) {
  if (status === 'paid') return 'rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3)';
  if (status === 'pending') return 'rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3)';
  return 'rgba(244, 63, 94, 0.2); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3)';
}

function getStatusText(status) {
  if (status === 'paid') return 'Pagado';
  if (status === 'pending') return 'Pendiente';
  return 'Vencido';
}

// --- MODAL UTILS ---
function openModal(id) {
  const modal = document.getElementById(id);
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('active'), 10);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove('active');
  setTimeout(() => {
    modal.style.display = 'none';
    if (id === 'managerModal') {
      currentManagerUserId = null;
      document.getElementById('historyEditForm').style.display = 'none';
    }
  }, 400);
}

// --- HANDLERS ---
window.openManager = async (userId) => {
  currentManagerUserId = userId;
  const user = await dbData.findUserById(userId);
  const profile = await dbData.getProfile(userId);
  if (!user || !profile) return;

  document.getElementById('managerTitle').textContent = user.username + (profile.alias ? ` (${profile.alias})` : '');
  document.getElementById('mgrAlias').value = profile.alias || '';
  document.getElementById('mgrUsername').value = user.username;
  document.getElementById('mgrPassword').value = '';
  document.getElementById('mgrSpeed').value = profile.internetSpeed || 50;
  document.getElementById('mgrSpeedVal').textContent = profile.internetSpeed || 50;
  document.getElementById('mgrWifiSSID').value = profile.wifiSSID || '';
  document.getElementById('mgrWifiPass').value = profile.wifiPass || '';

  updateQrDisplay(profile.wifiSSID, profile.wifiPass);
  renderManagerHistory(profile.paymentHistory || []);
  openModal('managerModal');
};

window.closeManager = () => closeModal('managerModal');
window.openCreateUser = () => openModal('createUserModal');
window.closeCreateUser = () => closeModal('createUserModal');
window.closeChat = () => {
  closeModal('chatModal');
  currentChatUserId = null;
};

// Click outside to close
[document.getElementById('managerModal'), document.getElementById('createUserModal'), document.getElementById('chatModal')].forEach(modal => {
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal.id);
  });
});

window.saveProfileChanges = async () => {
  if (!currentManagerUserId) return;
  const alias = document.getElementById('mgrAlias').value.trim();
  const username = document.getElementById('mgrUsername').value.trim();
  const password = document.getElementById('mgrPassword').value;

  await dbData.updateProfile(currentManagerUserId, { alias });
  // In this shim, we assume the username might be the email or just a field.
  // If auth update is needed, it should be handled via auth.js

  notify.success('Perfil actualizado');
  renderResidentList();
  openManager(currentManagerUserId);
};

window.saveServiceChanges = async () => {
  if (!currentManagerUserId) return;
  const internetSpeed = parseInt(document.getElementById('mgrSpeed').value);
  const wifiSSID = document.getElementById('mgrWifiSSID').value.trim();
  const wifiPass = document.getElementById('mgrWifiPass').value.trim();

  await dbData.updateProfile(currentManagerUserId, { internetSpeed, wifiSSID, wifiPass });
  updateQrDisplay(wifiSSID, wifiPass);
  notify.success('Servicio y WiFi actualizados');
  renderResidentList();
};

function updateQrDisplay(ssid, pass) {
  const img = document.getElementById('mgrQrCode');
  const placeholder = document.getElementById('mgrQrPlaceholder');
  if (ssid && pass) {
    const wifiString = `WIFI:S:${ssid};T:WPA;P:${pass};;`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(wifiString)}`;
    img.src = qrUrl;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'flex';
  }
}

window.generateRandomPass = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pass = '';
  for (let i = 0; i < 8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
  document.getElementById('mgrWifiPass').value = pass;
};

document.getElementById('mgrSpeed').addEventListener('input', (e) => {
  document.getElementById('mgrSpeedVal').textContent = e.target.value;
});

// --- History ---
function renderManagerHistory(history) {
  const tbody = document.getElementById('mgrHistoryBody');
  tbody.innerHTML = '';
  const reversed = [...history].reverse();
  reversed.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">${item.period}</td>
            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">${item.amount}</td>
            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">${getStatusText(item.status)}</td>
            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border); text-align: right;">
                <button onclick="editHistoryItem('${item.id}')" style="background:none; border:none; cursor:pointer;">✏️</button>
                <button onclick="deleteHistoryItem('${item.id}')" style="background:none; border:none; cursor:pointer; color: #f87171;">🗑️</button>
            </td>
        `;
    tbody.appendChild(tr);
  });
}

window.openAddHistory = () => {
  document.getElementById('historyEditForm').style.display = 'block';
  document.getElementById('histId').value = '';
  document.getElementById('histPeriod').value = '';
  document.getElementById('histDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('histAmount').value = '$2,500.00';
  document.getElementById('histStatus').value = 'paid';
};

window.cancelHistoryEdit = () => document.getElementById('historyEditForm').style.display = 'none';

window.saveHistoryItem = async () => {
  if (!currentManagerUserId) return;
  const id = document.getElementById('histId').value;
  const item = {
    period: document.getElementById('histPeriod').value,
    date: document.getElementById('histDate').value,
    amount: document.getElementById('histAmount').value,
    status: document.getElementById('histStatus').value
  };

  if (id) await dbData.updateHistoryItem(currentManagerUserId, id, item);
  else await dbData.addHistoryItem(currentManagerUserId, item);

  const updatedProfile = await dbData.getProfile(currentManagerUserId);
  renderManagerHistory(updatedProfile.paymentHistory);
  document.getElementById('historyEditForm').style.display = 'none';

  // Auto-sync status
  if (updatedProfile.paymentHistory && updatedProfile.paymentHistory.length > 0) {
    const latest = updatedProfile.paymentHistory[0];
    let finalStatus = latest.status;
    if (finalStatus === 'pending') {
      const check = new Date(latest.date + 'T23:59:59');
      if (new Date() > check) finalStatus = 'overdue';
    }
    const updates = { paymentStatus: finalStatus };
    if (!id) {
      const nextDateStr = getNextMonthDate(latest.date);
      updates.nextPaymentDate = formatDateToSpanish(nextDateStr);
    }
    await dbData.updateProfile(currentManagerUserId, updates);
    notify.success('Sincronizado: ' + getStatusText(finalStatus));
  }
  renderResidentList();
};

window.editHistoryItem = async (itemId) => {
  const profile = await dbData.getProfile(currentManagerUserId);
  const item = profile.paymentHistory.find(h => h.id == itemId);
  if (!item) return;

  document.getElementById('historyEditForm').style.display = 'block';
  document.getElementById('histId').value = itemId;
  document.getElementById('histPeriod').value = item.period;
  document.getElementById('histDate').value = item.date;
  document.getElementById('histAmount').value = item.amount;
  document.getElementById('histStatus').value = item.status;
};

window.deleteHistoryItem = async (itemId) => {
  if (confirm('¿Borrar este registro?')) {
    await dbData.deleteHistoryItem(currentManagerUserId, itemId);
    const p = await dbData.getProfile(currentManagerUserId);
    renderManagerHistory(p.paymentHistory);
  }
};

// --- CHAT ---
window.openChat = async (userId) => {
  currentChatUserId = userId;
  const user = await dbData.findUserById(userId);
  const profile = await dbData.getProfile(userId);
  const displayName = profile.alias || user.username;

  document.getElementById('chatTitle').textContent = `Chat: ${displayName}`;
  openModal('chatModal');

  await dbData.markMessagesRead(userId);
  renderResidentList();
  renderChatMessages(true);
};

async function renderChatMessages(forceScroll = false) {
  if (!currentChatUserId) return;
  const profile = await dbData.getProfile(currentChatUserId);
  const chatMsgs = document.getElementById('chatMessages');

  const threshold = 100;
  const isAtBottom = chatMsgs.scrollHeight - chatMsgs.scrollTop - chatMsgs.clientHeight < threshold;

  chatMsgs.innerHTML = '';
  profile.messages.forEach(msg => {
    const div = document.createElement('div');
    const isAdmin = msg.from === 'admin';
    const time = new Date(msg.timestamp).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' });

    div.style.cssText = `
            margin-bottom: 0.5rem; max-width: 80%;
            align-self: ${isAdmin ? 'flex-end' : 'flex-start'};
            display: flex; flex-direction: column;
        `;
    div.innerHTML = `
            <div style="padding: 0.5rem 0.8rem; border-radius: 12px; background: ${isAdmin ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}; color: white;">
                ${msg.text}
            </div>
            <span style="font-size: 0.65rem; color: var(--text-muted); margin-top: 0.2rem; align-self: ${isAdmin ? 'flex-end' : 'flex-start'};">
                ${time}
            </span>
        `;
    chatMsgs.appendChild(div);
  });

  if (forceScroll || isAtBottom) chatMsgs.scrollTop = chatMsgs.scrollHeight;
}

document.getElementById('adminChatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('adminMsgInput');
  const text = input.value.trim();
  if (text && currentChatUserId) {
    await dbData.addMessage(currentChatUserId, { from: 'admin', text });
    notify.playSendSound();
    input.value = '';
    renderChatMessages(true);
    renderResidentList();
  }
});

// Emoji Pickers
document.querySelectorAll('.admin-emoji').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById('adminMsgInput');
    input.value += btn.textContent;
    input.focus();
  });
});

window.deleteUser = async () => {
  if (!currentManagerUserId) return;
  if (confirm('🚨 ¿Eliminar este usuario PERMANENTEMENTE?')) {
    const success = await dbData.deleteUser(currentManagerUserId);
    if (success) {
      closeModal('managerModal');
      renderResidentList();
      notify.info('Usuario eliminado.');
    } else {
      notify.error('Error al eliminar.');
    }
  }
};

window.notifyOverdue = async (userId) => {
  const profile = await dbData.getProfile(userId);
  const user = await dbData.findUserById(userId);
  const name = profile.alias || user.username;

  if (confirm(`¿Enviar aviso de pago vencido a ${name}?`)) {
    const warning = `⚠️ AVISO DE PAGO VENCIDO: Estimado residente ${name}, le informamos que su servicio presenta un pago vencido. Favor de regularizar su situación.`;
    await dbData.addMessage(userId, { from: 'admin', text: warning });
    notify.playSendSound();
    notify.success(`Aviso enviado a ${name}`);
    renderResidentList();
  }
};

// Utils
function convertDateForInput(dateString) {
  if (!dateString) return new Date().toISOString().split('T')[0];
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) return dateString;
  const months = { 'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08', 'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12' };
  const parts = dateString.toLowerCase().match(/(\d{1,2}) de ([a-z]+)[,]?(?: de)? (\d{4})/);
  if (parts) return `${parts[3]}-${months[parts[2]]}-${parts[1].padStart(2, '0')}`;
  return new Date().toISOString().split('T')[0];
}

function getNextMonthDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().split('T')[0];
}

function formatDateToSpanish(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Polling
setInterval(() => {
  renderResidentList();
  checkNewMessages();
}, 5000);

let lastTotalMessages = 0;
let isFirstLoad = true;
async function checkNewMessages() {
  const users = await dbData.getUsers();
  const residents = users.filter(u => u.role === 'resident');
  let count = 0;
  for (const u of residents) {
    const p = await dbData.getProfile(u.id);
    if (p) count += p.messages.length;
  }

  if (!isFirstLoad && count > lastTotalMessages) {
    notify.playReceiveSound();
    notify.show('FiberHub', 'Nuevo mensaje recibido.');
    if (currentChatUserId) renderChatMessages();
  }
  lastTotalMessages = count;
  isFirstLoad = false;
}

renderResidentList();
notify.requestPermission();
