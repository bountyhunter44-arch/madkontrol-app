import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

let firebaseClientPromise = null;

export async function getPlatformFirebaseClient() {
  if (!firebaseClientPromise) {
    firebaseClientPromise = createPlatformFirebaseClient();
  }
  return firebaseClientPromise;
}

export async function waitForPlatformAuth(timeoutMs = 5000) {
  const { auth } = await getPlatformFirebaseClient();
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve) => {
    let unsubscribe = () => {};
    const timeout = window.setTimeout(() => {
      unsubscribe();
      resolve(auth.currentUser || null);
    }, timeoutMs);
    unsubscribe = onAuthStateChanged(auth, (user) => {
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(user || null);
    });
  });
}

async function createPlatformFirebaseClient() {
  const response = await fetch("/firebase-config.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Kunne ikke hente /firebase-config.json");
  }

  const firebaseConfig = await response.json();
  const app = initializeApp(firebaseConfig);

  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app)
  };
}
