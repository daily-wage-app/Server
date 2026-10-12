import {
  auth, db, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  collection, getDocs, orderBy, query
} from './firebase.js';
import { initPayoutAdmin } from './admin-payouts.js';

const ADMIN_EMAIL = 'dailywage172@gmail.com';
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginNotice = document.getElementById('loginNotice');
const dataNotice = document.getElementById('dataNotice');
const tableContent = document.getElementById('tableContent');
const searchInput = document.getElementById('searchInput');
const signInButton = document.getElementById('signInButton');
const refreshButton = document.getElementById('refreshButton');
const signOutButton = document.getElementById('signOutButton');
let profiles = [];

function showNotice(element, message) {
  element.textContent = message;
  element.classList.toggle('show', Boolean(message));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function formatDate(value) {
  if (!value) return '—';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('my-MM', { timeZone: 'Asia/Bangkok', year: 'numeric', month: 'short', day: '2-digit' }).format(date);
}

function formatGender(value) {
  return ({
    female: 'အမျိုးသမီး',
    male: 'အမျိုးသား',
    non_binary: 'အခြားအမျိုးအစား',
    prefer_not_to_say: 'မဖြေလိုပါ'
  })[value] || '—';
}

function filteredProfiles() {
  const needle = searchInput.value.trim().toLocaleLowerCase();
  if (!needle) return profiles;
  return profiles.filter(profile => [
    profile.fullName, profile.country, profile.email, profile.phone,
    profile.gender, profile.dateOfBirth
  ].some(value => String(value || '').toLocaleLowerCase().includes(needle)));
}

function renderProfiles() {
  const visible = filteredProfiles();
  document.getElementById('totalProfiles').textContent = String(profiles.length);
  document.getElementById('visibleProfiles').textContent = String(visible.length);
  document.getElementById('resultNote').textContent = `ပြသထားသည် ${visible.length} ဦး`;

  if (!visible.length) {
    tableContent.className = 'empty';
    tableContent.textContent = profiles.length ? 'ရှာဖွေမှုနှင့် ကိုက်ညီသော ကိုယ်ရေးအချက်အလက် မရှိပါ။' : 'အသုံးပြုသူ၏ ကိုယ်ရေးအချက်အလက် မရရှိသေးပါ။';
    return;
  }

  tableContent.className = 'table-wrap';
  const rows = visible.map(profile => `
    <tr>
      <td data-label="အမည် / ID"><span class="name-cell">${escapeHtml(profile.fullName || '—')}</span><span class="subcell">${escapeHtml(profile.uid || '')}</span></td>
      <td data-label="မွေးသက္ကရာဇ်">${escapeHtml(profile.dateOfBirth || '—')}</td>
      <td data-label="နိုင်ငံ">${escapeHtml(profile.country || '—')}</td>
      <td data-label="ကျား/မ"><span class="tag">${escapeHtml(formatGender(profile.gender))}</span></td>
      <td data-label="အီးမေးလ် / ဖုန်း">${escapeHtml(profile.email || '—')}<span class="subcell">${escapeHtml(profile.phone || '')}</span></td>
      <td data-label="နောက်ဆုံးပြင်ဆင်ချိန်">${escapeHtml(formatDate(profile.updatedAt))}</td>
    </tr>`).join('');

  tableContent.innerHTML = `<table class="table"><thead><tr><th>အမည် / ID</th><th>မွေးသက္ကရာဇ်</th><th>နိုင်ငံ</th><th>ကျား/မ</th><th>အီးမေးလ် / ဖုန်း</th><th>နောက်ဆုံးပြင်ဆင်ချိန်</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function loadProfiles() {
  showNotice(dataNotice, '');
  tableContent.className = 'loading';
  tableContent.textContent = 'ကိုယ်ရေးအချက်အလက်များကို ဖတ်နေပါသည်…';
  refreshButton.disabled = true;
  try {
    const result = await getDocs(query(collection(db, 'userProfiles'), orderBy('updatedAt', 'desc')));
    profiles = result.docs.map(document => document.data());
    document.getElementById('lastRefreshed').textContent = new Intl.DateTimeFormat('my-MM', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
    }).format(new Date());
    renderProfiles();
  } catch (error) {
    tableContent.className = 'empty';
    tableContent.textContent = 'ကိုယ်ရေးအချက်အလက်များကို ဖတ်မရပါ။';
    showNotice(dataNotice, `Firebase ဝင်ခွင့် မရပါ: ${error.message}။ Firestore လုံခြုံရေးစည်းမျဉ်းများ ထည့်သွင်းထားခြင်းနှင့် စီမံခန့်ခွဲသူ၏ Google ဝင်ရောက်မှုကို စစ်ဆေးပါ။`);
  } finally {
    refreshButton.disabled = false;
  }
}

signInButton.addEventListener('click', async () => {
  showNotice(loginNotice, '');
  signInButton.disabled = true;
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ login_hint: ADMIN_EMAIL });
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    if (user.email !== ADMIN_EMAIL || !user.emailVerified) {
      await signOut(auth);
      throw new Error(`အတည်ပြုပြီးသော စီမံခန့်ခွဲသူအကောင့် ${ADMIN_EMAIL} ဖြင့် ဝင်ရောက်ပါ။`);
    }
  } catch (error) {
    showNotice(loginNotice, error.message || 'Google ဖြင့် ဝင်ရောက်မရပါ။');
  } finally {
    signInButton.disabled = false;
  }
});

refreshButton.addEventListener('click', loadProfiles);
signOutButton.addEventListener('click', () => signOut(auth));
searchInput.addEventListener('input', renderProfiles);

onAuthStateChanged(auth, async user => {
  if (!user) {
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
    return;
  }

  if (user.email !== ADMIN_EMAIL || !user.emailVerified) {
    await signOut(auth);
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
    showNotice(loginNotice, `ဤစာမျက်နှာကို ${ADMIN_EMAIL} အကောင့်ဖြင့်သာ ဝင်ရောက်နိုင်ပါသည်။`);
    return;
  }

  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  document.getElementById('adminEmail').textContent = user.email;
  await loadProfiles();
  await initPayoutAdmin();
});
