const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db   = admin.firestore();
const auth = admin.auth();

const TARGET_EMAIL = "michael@madkontrollen.dk";

(async () => {
  try {
    const userRecord = await auth.getUserByEmail(TARGET_EMAIL);
    console.log("Found uid:", userRecord.uid);

    await db.collection("users").doc(userRecord.uid).set({
      role: "super-admin",
    }, { merge: true });

    console.log(`✅ ${TARGET_EMAIL} sat til super-admin i Firestore`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Fejl:", err.message);
    process.exit(1);
  }
})();
