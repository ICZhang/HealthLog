import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Replace these values with your actual Firebase project credentials
const firebaseConfig = {
    apiKey: "AIzaSyC__qzuMp1hkem_qgz3p9ZRIDNkPGJyM5Q",
    authDomain: "healthlog-c442b.firebaseapp.com",
    projectId: "healthlog-c442b",
    storageBucket: "healthlog-c442b.firebasestorage.app",
    messagingSenderId: "485609621730",
    appId: "1:485609621730:web:964d0e244855e4ea4df6bb",
    measurementId: "G-9J4N42X9CL"
};


// Initialize Firebase services
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);