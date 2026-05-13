const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "madkontrollen",
});

const db = admin.firestore();

async function run() {
  const locationId = "onboarding_aroi-d__main";
  const dateKey = "2026-03-29";

  const snap = await db
    .collection("task_instances")
    .where("locationId", "==", locationId)
    .where("dateKey", "==", dateKey)
    .get();

  if (snap.empty) {
    console.log("Ingen dokumenter fundet");
    return;
  }

  console.log("Fundet:", snap.size);

  const batch = db.batch();

  snap.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  console.log("✅ Slettet alle task_instances for dagen");
}

run().catch(console.error);