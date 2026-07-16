const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function deleteCollection(collectionPath, batchSize = 500) {
  const collectionRef = db.collection(collectionPath);
  let totalDeleted = 0;

  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();
    if (snapshot.empty) break;

    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    totalDeleted += snapshot.size;
    console.log(`Deleted ${totalDeleted} documents...`);
  }

  return totalDeleted;
}

async function run() {
  console.log("🔥 START: Deleting ALL task_instances...\n");

  const total = await deleteCollection("task_instances");

  console.log("\n✅ DONE");
  console.log(`Total deleted: ${total}`);
}

run().catch((err) => {
  console.error("❌ ERROR:", err);
  process.exit(1);
});