import {
  auth, db, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  collection, getDocs, orderBy, query
} from './firebase.js';

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
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: '2-digit' }).format(date);
}

function formatGender(value) {
  return ({
    female: 'Woman',
    male: 'Man',
    non_binary: 'Non-binary',
    prefer_not_to_say: 'Prefer not to say'
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
  document.getElementById('resultNote').textContent = `${visible.length} record${visible.length === 1 ? '' : 's'}`;

  if (!visible.length) {
    tableContent.className = 'empty';
    tableContent.textContent = profiles.length ? 'No profiles match your search.' : 'No user profiles have been submitted yet.';
    return;
  }

  tableContent.className = 'table-wrap';
  const rows = visible.map(profile => `
    <tr>
      <td data-label="Name / ID"><span class="name-cell">${escapeHtml(profile.fullName || '—')}</span><span class="subcell">${escapeHtml(profile.uid || '')}</span></td>
      <td data-label="Date of birth">${escapeHtml(profile.dateOfBirth || '—')}</td>
      <td data-label="Country">${escapeHtml(profile.country || '—')}</td>
      <td data-label="Gender"><span class="tag">${escapeHtml(formatGender(profile.gender))}</span></td>
      <td data-label="Email / phone">${escapeHtml(profile.email || '—')}<span class="subcell">${escapeHtml(profile.phone || '')}</span></td>
      <td data-label="Updated">${escapeHtml(formatDate(profile.updatedAt))}</td>
    </tr>`).join('');

  tableContent.innerHTML = `<table class="table"><thead><tr><th>Name / ID</th><th>Date of birth</th><th>Country</th><th>Gender</th><th>Email / phone</th><th>Updated</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function loadProfiles() {
  showNotice(dataNotice, '');
  tableContent.className = 'loading';
  tableContent.textContent = 'Loading profiles…';
  refreshButton.disabled = true;
  try {
    const result = await getDocs(query(collection(db, 'userProfiles'), orderBy('updatedAt', 'desc')));
    profiles = result.docs.map(document => document.data());
    document.getElementById('lastRefreshed').textContent = new Intl.DateTimeFormat('en', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
    }).format(new Date());
    renderProfiles();
  } catch (error) {
    tableContent.className = 'empty';
    tableContent.textContent = 'Profiles could not be loaded.';
    showNotice(dataNotice, `Firebase access failed: ${error.message}. Check that Firestore rules are deployed and Google sign-in is enabled for the admin account.`);
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
      throw new Error(`Please sign in with the verified admin account ${ADMIN_EMAIL}.`);
    }
  } catch (error) {
    showNotice(loginNotice, error.message || 'Google sign-in failed.');
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
    showNotice(loginNotice, `Access is restricted to ${ADMIN_EMAIL}.`);
    return;
  }

  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  document.getElementById('adminEmail').textContent = user.email;
  await loadProfiles();
});
