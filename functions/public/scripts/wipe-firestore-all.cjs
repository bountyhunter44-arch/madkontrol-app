/**
 * wipe-firestore-all.cjs
 *
 * Sletter ALLE dokumenter i ALLE top-level Firestore collections.
 *
 * Brug:
 * node public/scripts/wipe-firestore-all.cjs
 */

const path = require("path");
const admin = require("firebase-admin");

const serviceAccount = require(path.resolve(__dirname, "../../serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const BATCH_LIMIT = 400;

async function deleteDocsInCollection(collectionRef, name) {
  const snapshot = await collectionRef.get();

  if (snapshot.empty) {
    console.log(`⚠️  Ingen dokumenter i ${name}`);
    return 0;
  }

  let deleted = 0;

  for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = snapshot.docs.slice(i, i + BATCH_LIMIT);

    chunk.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
    deleted += chunk.length;

    console.log(`🧹 Slettet ${deleted}/${snapshot.docs.length} i ${name}`);
  }

  return deleted;
}

async function run() {
  console.log("🚨 SLETTER ALT I FIRESTORE");

  const collections = await db.listCollections();
  const results = {};

  for (const col of collections) {
    console.log(`\n🔍 ${col.id}`);
    results[col.id] = await deleteDocsInCollection(col, col.id);
  }

  console.log("\n✅ Færdig");
  console.table(results);
}

run().catch((err) => {
  console.error("❌ FEJL:", err);
});