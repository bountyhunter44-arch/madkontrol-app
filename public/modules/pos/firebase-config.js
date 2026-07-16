import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAmwnoJ9RpxjS_3u8t2Dfa6QB_Q-ctbsjQ",
  authDomain: "madkontrollen.firebaseapp.com",
  projectId: "madkontrollen",
  storageBucket: "madkontrollen.firebasestorage.app",
  messagingSenderId: "937588793415",
  appId: "1:937588793415:web:7bf372dff6e98c9bad9162",
  measurementId: "G-KPVDR4PSVK"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
