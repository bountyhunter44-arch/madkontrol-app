import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const configResponse = await fetch("/firebase-config.json", {
  cache: "no-store"
});

if (!configResponse.ok) {
  throw new Error("Kunne ikke hente /firebase-config.json");
}

const firebaseConfig = await configResponse.json();

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
console.log('Auth er klar:', auth);
export const db = getFirestore(app);
console.log('Firestore er klar:', db);
export const storage = getStorage(app);

export default app;