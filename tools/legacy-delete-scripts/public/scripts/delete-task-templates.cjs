const admin = require("firebase-admin");
const serviceAccount = require("../../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteTaskTemplatesForCompany() {
  const COMPANY_ID = "onboarding_aroi-d";

  const snapshot = await db.collection("task_templates")
    .where("companyId", "==", COMPANY_ID)
    .get();

  console.log(`Fandt ${snapshot.size} templates for ${COMPANY_ID}`);

  if (snapshot.empty) {
    console.log("Ingen templates fundet.");
    return;
  }

  let batch = db.batch();
  let count = 0;
  let deleted = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    deleted++;

    if (count === 400) {
      await batch.commit();
      console.log(`Slettet ${deleted} templates indtil nu...`);
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log(`✅ Færdig. Slettet ${deleted} task_templates`);
}

deleteTaskTemplatesForCompany().catch((error) => {
  console.error(error);
  process.exit(1);
});