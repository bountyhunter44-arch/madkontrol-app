const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

const ADMIN_EMAIL = "michael@madkontrollen.dk"; // <-- sæt din admin email her

async function deleteCollection(collectionName) {
  let totalDeleted = 0;
  let snapshot;

  do {
    snapshot = await db.collection(collectionName).limit(400).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    totalDeleted += snapshot.docs.length;
    console.log(`  [${collectionName}] Deleted ${totalDeleted} so far...`);
  } while (snapshot.docs.length === 400);

  console.log(`  [${collectionName}] Done. Total deleted: ${totalDeleted}`);
}

async function deleteNonAdminAuthUsers() {
  let totalDeleted = 0;
  let nextPageToken;

  do {
    const listResult = await auth.listUsers(1000, nextPageToken);
    const toDelete = listResult.users
      .filter((u) => (u.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase())
      .map((u) => u.uid);

    if (toDelete.length > 0) {
      const result = await auth.deleteUsers(toDelete);
      totalDeleted += result.successCount;
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((e) => console.warn(`  Auth delete error uid ${e.index}: ${e.error.message}`));
      }
      console.log(`  [auth] Deleted ${totalDeleted} user(s) so far...`);
    }

    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  console.log(`  [auth] Done. Total deleted: ${totalDeleted}`);
}

async function deleteNonAdminUserDocs() {
  let totalDeleted = 0;
  let snapshot;
  let lastDoc = null;

  do {
    let query = db.collection("users").limit(400);
    if (lastDoc) query = query.startAfter(lastDoc);

    snapshot = await query.get();
    if (snapshot.empty) break;

    const toDelete = snapshot.docs.filter((doc) => {
      const email = (doc.data().email || "").toLowerCase();
      return email !== ADMIN_EMAIL.toLowerCase();
    });

    if (toDelete.length > 0) {
      const batch = db.batch();
      toDelete.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      totalDeleted += toDelete.length;
      console.log(`  [users] Deleted ${totalDeleted} so far...`);
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  } while (snapshot.docs.length === 400);

  console.log(`  [users] Done. Total deleted: ${totalDeleted}`);
}

async function run() {
  console.log("=== cleanup-test-data ===");
  console.log(`Admin email protected: ${ADMIN_EMAIL}\n`);

  console.log("1. Deleting all task_instances...");
  await deleteCollection("task_instances");

  console.log("\n2. Deleting non-admin Firebase Auth users...");
  await deleteNonAdminAuthUsers();

  console.log("\n3. Deleting non-admin users collection docs...");
  await deleteNonAdminUserDocs();

  console.log("\n=== Done ===");
  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
