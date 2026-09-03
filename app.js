import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: Paste your actual Firebase project keys inside quotes
const firebaseConfig = {
    apiKey: "AIzaSyC__qzuMp1hkem_qgz3p9ZRIDNkPGJyM5Q",
    authDomain: "healthlog-c442b.firebaseapp.com",
    projectId: "healthlog-c442b",
    storageBucket: "healthlog-c442b.firebasestorage.app",
    messagingSenderId: "485609621730",
    appId: "1:485609621730:web:964d0e244855e4ea4df6bb",
    measurementId: "G-9J4N42X9CL"
};


// Initialize Firebase Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let isSignUp = false;
let currentUser = null;
let unsubscribeFromLogs = null;

// DOM Elements
const authTitle = document.getElementById("auth-title");
const authBtn = document.getElementById("auth-btn");
const toggleWrapper = document.getElementById("toggle-wrapper");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const showPasswordCheckbox = document.getElementById("show-password");
const errorMsg = document.getElementById("error-msg");
const authContainer = document.getElementById("auth-container");
const dashboard = document.getElementById("dashboard");
const userEmailSpan = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");

const logForm = document.getElementById("log-form");
const symptomInput = document.getElementById("symptom");
const severitySelect = document.getElementById("severity");
const notesInput = document.getElementById("notes");
const logList = document.getElementById("log-list");

// Toggle Password Visibility
showPasswordCheckbox.addEventListener("change", () => {
    passwordInput.type = showPasswordCheckbox.checked ? "text" : "password";
});

// Toggle Sign In / Sign Up Modes
toggleWrapper.addEventListener("click", (e) => {
    if (e.target && e.target.id === "toggle-auth") {
    isSignUp = !isSignUp;
    errorMsg.textContent = "";

    if (isSignUp) {
        authTitle.textContent = "Create Account";
        authBtn.textContent = "Sign Up";
        toggleWrapper.innerHTML = 'Already have an account? <span class="toggle-link" id="toggle-auth">Sign In</span>';
    } else {
        authTitle.textContent = "Sign In";
        authBtn.textContent = "Sign In";
        toggleWrapper.innerHTML = 'Don\'t have an account? <span class="toggle-link" id="toggle-auth">Sign Up</span>';
    }
    }
});

// Handle Auth Submission
authBtn.addEventListener("click", async () => {
    const rawUsername = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value.trim();
    errorMsg.textContent = "";

    if (!rawUsername || !password) {
    errorMsg.textContent = "Please enter both username and password.";
    return;
    }

    const formattedEmail = `${rawUsername}@app.local`;

    try {
    if (isSignUp) {
        await createUserWithEmailAndPassword(auth, formattedEmail, password);
    } else {
        await signInWithEmailAndPassword(auth, formattedEmail, password);
    }
    } catch (err) {
    errorMsg.textContent = err.message
        .replace("Firebase: ", "")
        .replace("email address", "username");
    }
});

// Handle Sign Out
logoutBtn.addEventListener("click", () => {
    if (unsubscribeFromLogs) unsubscribeFromLogs();
    signOut(auth);
});

// Listen for Auth State Changes
onAuthStateChanged(auth, (user) => {
    if (user) {
    currentUser = user;
    authContainer.classList.add("hidden");
    dashboard.classList.remove("hidden");

    const cleanUsername = user.email.replace("@app.local", "");
    userEmailSpan.textContent = cleanUsername;

    listenToHealthLogs(user.uid);
    } else {
    currentUser = null;
    if (unsubscribeFromLogs) unsubscribeFromLogs();
    authContainer.classList.remove("hidden");
    dashboard.classList.add("hidden");
    usernameInput.value = "";
    passwordInput.value = "";
    logList.innerHTML = "";
    }
});

// Save New Log Entry to Firestore
logForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const symptom = symptomInput.value.trim();
    const severity = severitySelect.value;
    const notes = notesInput.value.trim();

    try {
    const logsRef = collection(db, "users", currentUser.uid, "logs");
    await addDoc(logsRef, {
        symptom: symptom,
        severity: severity,
        notes: notes,
        createdAt: serverTimestamp()
    });

    logForm.reset();
    } catch (err) {
    alert("Failed to save entry: " + err.message);
    }
});

// Real-Time Listener to Fetch Logs
function listenToHealthLogs(userId) {
    const logsRef = collection(db, "users", userId, "logs");
    const q = query(logsRef, orderBy("createdAt", "desc"));

    unsubscribeFromLogs = onSnapshot(q, (snapshot) => {
    logList.innerHTML = "";
    
    if (snapshot.empty) {
        logList.innerHTML = '<li style="color: #888; font-size: 0.9rem;">No entries logged yet.</li>';
        return;
    }

    snapshot.forEach((doc) => {
        const data = doc.data();
        const date = data.createdAt ? data.createdAt.toDate().toLocaleString() : "Just now";

        const li = document.createElement("li");
        li.className = "log-item";
        li.innerHTML = `
        <div class="log-header">
            <span>${escapeHtml(data.symptom)}</span>
            <span>Level: ${data.severity}/10</span>
        </div>
        <div class="log-date">${date}</div>
        ${data.notes ? `<div class="log-notes">${escapeHtml(data.notes)}</div>` : ""}
        `;
        logList.appendChild(li);
    });
    }, (error) => {
    logList.innerHTML = '<li style="color: #d9534f; font-size: 0.85rem;">Error loading entries: ${error.message}</li>';
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
    });
}