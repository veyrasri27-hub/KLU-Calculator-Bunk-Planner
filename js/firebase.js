import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC5vM4pqmRE1cOtQle_jmtd0WwozfCbXxw",
  authDomain: "klu-bunk-planner.firebaseapp.com",
  projectId: "klu-bunk-planner",
  storageBucket: "klu-bunk-planner.firebasestorage.app",
  messagingSenderId: "390757364343",
  appId: "1:390757364343:web:848d1a227bfc8d6d944c72",
  measurementId: "G-H1XVY5SKHF",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const EMAIL_LINK_STORAGE_KEY = "klu-auth-email";

// Starts Google popup sign-in for features that require a logged-in user.
async function continueWithGoogle() {
  await signInWithPopup(auth, googleProvider);
}

// Sends a passwordless email sign-in link and stores the email for completion.
async function sendMagicLink(email) {
  const actionCodeSettings = {
    url: window.location.href,
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
}

// Completes email-link sign-in when the user returns to the app from their email.
async function completeEmailLinkSignInIfPresent() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return { completed: false };
  const email = localStorage.getItem(EMAIL_LINK_STORAGE_KEY) || window.prompt("Confirm your email to finish sign-in:");
  if (!email) return { completed: false, error: "Email is required to complete sign-in." };
  await signInWithEmailLink(auth, email, window.location.href);
  localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
  return { completed: true };
}

// Gives script.js a simple way to read the current Firebase user.
function getCurrentUser() {
  return auth.currentUser;
}

// Exposes only the auth helpers that the main app needs.
window.firebaseAuth = {
  auth,
  onAuthStateChanged: (cb) => onAuthStateChanged(auth, cb),
  continueWithGoogle,
  sendMagicLink,
  completeEmailLinkSignInIfPresent,
  signOut: () => signOut(auth),
  getCurrentUser,
};

