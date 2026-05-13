const admin = require("firebase-admin");
const serviceAccount = require("../../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteDailyRunsForCompany() {
  const snapshot = await db.collection("daily_runs").get();

  console.log(`Fandt ${snapshot.size} dokumenter i daily_runs`);

  let batch = db.batch();
  let count = 0;
  let deleted = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};

    if (data.companyId === "onboarding_aroi-d") {
      batch.delete(doc.ref);
      count++;
      deleted++;
    }

    if (count === 400) {
      await batch.commit();
      console.log(`Slettet ${deleted} dokumenter indtil nu...`);
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log(`✅ Færdig. Slettet ${deleted} daily_runs for onboarding_aroi-d`);
}

deleteDailyRunsForCompany().catch((error) => {
  console.error(error);
  process.exit(1);
});