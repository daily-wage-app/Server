import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

// Separate app name prevents the admin session from replacing the worker's anonymous session.
const app = initializeApp(firebaseConfig, 'DailyWageAdmin');
export const auth = getAuth(app);
export const db = getFirestore(app);
export { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, collection, getDocs, orderBy, query };
