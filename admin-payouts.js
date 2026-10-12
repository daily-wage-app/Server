import {
  db, collection, doc, getDocs, orderBy, query, runTransaction, serverTimestamp
} from './firebase.js';

const queue = document.getElementById('payoutQueue');
const notice = document.getElementById('payoutNotice');
const pendingCount = document.getElementById('pendingPayoutCount');
const refreshButton = document.getElementById('refreshPayoutsButton');
let requests = [];
let busyRequestId = null;
let initialized = false;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function formatDate(value) {
  if (!value || typeof value.toDate !== 'function') return '—';
  return new Intl.DateTimeFormat('my-MM', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(value.toDate());
}

function statusLabel(status) {
  return ({
    pending: 'စောင့်ဆိုင်းနေသည်',
    processing: 'စစ်ဆေး / ငွေလွှဲနေသည်',
    paid: 'ငွေလွှဲပြီး',
    rejected: 'ပယ်ချပြီး · အမှတ်ပြန်အမ်းပြီး'
  })[status] || 'အခြေအနေ မသိရပါ';
}

function deadlineLabel(request) {
  if (request.status === 'paid' || request.status === 'rejected' || !request.createdAt?.toDate) return '';
  const dueAt = request.createdAt.toDate().getTime() + 24 * 60 * 60 * 1000;
  const remaining = dueAt - Date.now();
  if (remaining <= 0) {
    const hours = Math.ceil(Math.abs(remaining) / 3600000);
    return `၂၄ နာရီ သတ်မှတ်ချိန်ထက် ${hours} နာရီ ကျော်လွန်နေပါသည်`;
  }
  const hours = Math.ceil(remaining / 3600000);
  return `၂၄ နာရီအတွင်း ဆောင်ရွက်ရန် · ခန့်မှန်း ${hours} နာရီ ကျန်ပါသည်`;
}

function showNotice(message, isError = false) {
  notice.textContent = message;
  notice.dataset.type = isError ? 'error' : 'success';
  notice.classList.toggle('show', Boolean(message));
  if (message) notice.removeAttribute('hidden');
  else notice.setAttribute('hidden', '');
}

function renderQueue() {
  const active = requests.filter(item => ['pending', 'processing'].includes(item.status));
  pendingCount.textContent = String(active.length);
  if (!requests.length) {
    queue.className = 'empty';
    queue.textContent = 'ယခုအချိန်တွင် ငွေထုတ်တောင်းဆိုမှု မရှိသေးပါ။';
    return;
  }

  queue.className = 'payout-list';
  queue.innerHTML = requests.map(request => {
    const id = escapeHtml(request.id);
    const status = ['pending', 'processing', 'paid', 'rejected'].includes(request.status) ? request.status : 'unknown';
    const accountId = `payout-account-${id}`;
    const actions = request.status === 'pending'
      ? `<button class="button payout-action" type="button" data-action="processing" data-id="${id}">စစ်ဆေးမှု စတင်ရန်</button>
         <button class="button payout-action danger" type="button" data-action="reject" data-id="${id}">ပယ်ချပြီး အမှတ်ပြန်အမ်းရန်</button>`
      : request.status === 'processing'
        ? `<button class="button payout-action" type="button" data-action="paid" data-id="${id}">ငွေလွှဲပြီးဟု မှတ်သားရန်</button>
           <button class="button payout-action danger" type="button" data-action="reject" data-id="${id}">ပယ်ချပြီး အမှတ်ပြန်အမ်းရန်</button>`
        : '';
    return `<article class="payout-card" data-request-card="${id}">
      <div class="payout-card-head">
        <div><div class="payout-name">${escapeHtml(request.userFullName || 'အမည်မရှိ')}</div><div class="payout-uid">UID: ${escapeHtml(request.uid || '')}</div></div>
        <span class="payout-status ${status}">${statusLabel(status)}</span>
      </div>
      <div class="payout-grid">
        <div><span class="payout-label">ထုတ်ယူမည့်ငွေ</span><strong>${Number(request.amountBaht || 0).toLocaleString('en-US')} ဘတ်</strong></div>
        <div><span class="payout-label">ဖြတ်တောက်ထားသည့်အမှတ်</span><strong>${Number(request.pointsRequested || 0).toLocaleString('en-US')} မှတ်</strong></div>
        <div><span class="payout-label">တောင်းဆိုသည့်အချိန်</span><strong>${formatDate(request.createdAt)}</strong></div>
        <div><span class="payout-label">ငွေလက်ခံမည့်အကောင့်အမည်</span><strong>${escapeHtml(request.walletAccountName || '—')}</strong></div>
      </div>
      <div class="payout-account-row">
        <label for="${accountId}">TrueMoney အကောင့်နံပါတ်</label>
        <input id="${accountId}" type="password" value="${escapeHtml(request.walletAccountNumber || '')}" readonly autocomplete="off" />
        <button class="button secondary payout-action" type="button" data-action="toggle-account" data-id="${id}">နံပါတ်ပြရန်</button>
      </div>
      <div class="payout-deadline ${deadlineLabel(request).includes('ကျော်လွန်နေ') ? 'overdue' : ''}">${escapeHtml(deadlineLabel(request))}</div>
      ${request.adminNote ? `<p class="payout-note"><strong>စီမံခန့်ခွဲသူ၏ မှတ်ချက်:</strong> ${escapeHtml(request.adminNote)}</p>` : ''}
      ${request.refunded ? '<p class="payout-refund">ဖြတ်တောက်ထားသောအမှတ်များကို အသုံးပြုသူ၏အကောင့်သို့ ပြန်အမ်းပြီးပါပြီ။</p>' : ''}
      ${actions ? `<div class="payout-actions" data-actions-for="${id}">${actions}</div>` : ''}
    </article>`;
  }).join('');
}

async function loadPayouts() {
  showNotice('');
  queue.className = 'loading';
  queue.textContent = 'တောင်းဆိုမှုများကို ဖတ်နေပါသည်…';
  refreshButton.disabled = true;
  try {
    const result = await getDocs(query(collection(db, 'withdrawalRequests'), orderBy('createdAt', 'desc')));
    requests = result.docs.map(item => ({ id: item.id, ...item.data() }));
    renderQueue();
  } catch (error) {
    queue.className = 'empty';
    queue.textContent = 'ငွေထုတ်တောင်းဆိုမှုများကို ဖတ်မရပါ။';
    showNotice(`Firebase ဝင်ခွင့် သို့မဟုတ် လုံခြုံရေးစည်းမျဉ်း အမှား: ${error.message}`, true);
  } finally {
    refreshButton.disabled = false;
  }
}

async function updateStatus(id, action) {
  const requestRef = doc(db, 'withdrawalRequests', id);
  if (action === 'processing') {
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(requestRef);
      if (!snapshot.exists() || snapshot.data().status !== 'pending') throw new Error('ဤတောင်းဆိုမှုကို ပြောင်းလဲ၍ မရတော့ပါ။');
      const timestamp = serverTimestamp();
      transaction.update(requestRef, {
        status: 'processing', reviewedAt: timestamp, updatedAt: timestamp
      });
    });
    return true;
  }

  if (action === 'paid') {
    const selected = requests.find(item => item.id === id);
    const amount = Number(selected?.amountBaht || 0);
    if (!window.confirm(`${amount} ဘတ်ကို TrueMoney သို့ ကိုယ်တိုင်လွှဲပြီးပါသလား။ ဤလုပ်ဆောင်ချက်သည် တောင်းဆိုမှုအခြေအနေကိုသာ ပြောင်းလဲမည်ဖြစ်ပြီး အက်ပ်က ငွေလွှဲပေးမည်မဟုတ်ပါ။`)) return false;
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(requestRef);
      if (!snapshot.exists() || snapshot.data().status !== 'processing') throw new Error('ဤတောင်းဆိုမှုကို စစ်ဆေးနေသည့်အခြေအနေတွင် မရှိပါ။');
      const timestamp = serverTimestamp();
      transaction.update(requestRef, { status: 'paid', processedAt: timestamp, updatedAt: timestamp });
    });
    return true;
  }

  if (action === 'reject') {
    const reason = window.prompt('ပယ်ချရသည့်အကြောင်းရင်းကို ရေးပါ။ ဖြတ်ထားသောအမှတ်များကို အသုံးပြုသူထံ အလိုအလျောက် ပြန်အမ်းပါမည်။');
    if (reason === null) return false;
    const cleanReason = reason.trim();
    if (cleanReason.length < 3 || cleanReason.length > 500) throw new Error('အကြောင်းရင်းကို စာလုံး ၃ လုံးမှ ၅၀၀ လုံးအတွင်း ရေးပါ။');
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(requestRef);
      if (!snapshot.exists()) throw new Error('တောင်းဆိုမှုကို ရှာမတွေ့ပါ။');
      const request = snapshot.data();
      if (!['pending', 'processing'].includes(request.status) || request.refunded) throw new Error('ဤတောင်းဆိုမှုကို ပယ်ဖျက်၍ မရတော့ပါ။');
      const walletRef = doc(db, 'rewardWallets', request.uid);
      const walletSnapshot = await transaction.get(walletRef);
      if (!walletSnapshot.exists()) throw new Error('အသုံးပြုသူ၏ အမှတ်စာရင်းကို ရှာမတွေ့ပါ။');
      const wallet = walletSnapshot.data();
      const timestamp = serverTimestamp();
      transaction.update(walletRef, {
        pointsBalance: wallet.pointsBalance + request.pointsRequested,
        lastRefundRequestId: id,
        updatedAt: timestamp
      });
      transaction.update(requestRef, {
        status: 'rejected',
        refunded: true,
        adminNote: cleanReason,
        reviewedAt: request.reviewedAt || timestamp,
        rejectedAt: timestamp,
        updatedAt: timestamp
      });
    });
    return true;
  }
}

function handleQueueClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  if (action === 'toggle-account') {
    const accountInput = document.getElementById(`payout-account-${id}`);
    if (!accountInput) return;
    const reveal = accountInput.type === 'password';
    accountInput.type = reveal ? 'text' : 'password';
    button.textContent = reveal ? 'နံပါတ်ဖျောက်ရန်' : 'နံပါတ်ပြရန်';
    return;
  }
  if (busyRequestId) return;
  busyRequestId = id;
  button.disabled = true;
  showNotice('ပြောင်းလဲမှုကို သိမ်းဆည်းနေပါသည်…');
  updateStatus(id, action)
    .then(async changed => {
      if (!changed) {
        showNotice('လုပ်ဆောင်မှုကို ပယ်ဖျက်လိုက်ပါပြီ။');
        return;
      }
      await loadPayouts();
      showNotice(action === 'paid'
        ? 'ငွေလွှဲပြီးဟု အခြေအနေကို ပြောင်းလဲပြီးပါပြီ။ TrueMoney ငွေလွှဲမှုကို အက်ပ်က အလိုအလျောက် မလုပ်ဆောင်ပါ။'
        : action === 'reject'
          ? 'တောင်းဆိုမှုကို ပယ်ချပြီး အမှတ်များကို အသုံးပြုသူထံ ပြန်အမ်းပြီးပါပြီ။'
          : 'တောင်းဆိုမှုကို စစ်ဆေးနေသည့်အခြေအနေသို့ ပြောင်းလဲပြီးပါပြီ။');
    })
    .catch(error => showNotice(error.message || 'ပြောင်းလဲမှုကို သိမ်းဆည်းမရပါ။', true))
    .finally(() => {
      busyRequestId = null;
      button.disabled = false;
    });
}

export function initPayoutAdmin() {
  if (initialized) return loadPayouts();
  initialized = true;
  refreshButton.addEventListener('click', loadPayouts);
  queue.addEventListener('click', handleQueueClick);
  return loadPayouts();
}
