/**
 * delete-egenkontrol-data-for-location.cjs
 *
 * Sletter KUN egenkontrol-relaterede data for én companyId + locationId
 *
 * Collections:
 * - task_templates
 * - task_instances
 * - verification_templates
 * - verification_instances
 * - program_sections
 * - program_answers
 *
 * Brug:
 * node public/scripts/delete-egenkontrol-data-for-location.cjs
 */

const admin = require("firebase-admin");

// 🔑 Justér sti hvis nødvendigt
const serviceAccount = require("../../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const BATCH_LIMIT = 400;

// 🔧 Sæt dine værdier her
const companyId = "company_1";
const locationId = "location_1";

// Collections der må slettes
const COLLECTIONS = [
  "task_templates",
  "task_instances",
  "verification_templates",
  "verification_instances",
  "program_sections",
  "program_answers",
];

async function deleteCollectionScoped(collectionName) {
  console.log(`\n🔍 Henter ${collectionName}...`);

  const snapshot = await db
    .collection(collectionName)
    .where("companyId", "==", companyId)
    .where("locationId", "==", locationId)
    .get();

  if (snapshot.empty) {
    console.log(`⚠️  Ingen dokumenter i ${collectionName}`);
    return 0;
  }

  let deletedCount = 0;
  const docs = snapshot.docs;

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const chunk = docs.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();

    for (const doc of chunk) {
      batch.delete(doc.ref);
    }

    await batch.commit();
    deletedCount += chunk.length;

    console.log(`🧹 Slettet ${deletedCount}/${docs.length} i ${collectionName}`);
  }

  return deletedCount;
}

async function run() {
  if (!companyId || !locationId) {
    throw new Error("❌ companyId og locationId skal sættes i filen");
  }

  console.log("🚨 Starter sletning af egenkontrol-data");
  console.log(`Company: ${companyId}`);
  console.log(`Location: ${locationId}`);

  const results = {};

  for (const collection of COLLECTIONS) {
    const count = await deleteCollectionScoped(collection);
    results[collection] = count;
  }

  console.log("\n✅ Færdig!");
  console.log("Resultat:");
  console.table(results);
}

run().catch((err) => {
  console.error("❌ FEJL:", err);
  process.exit(1);
});