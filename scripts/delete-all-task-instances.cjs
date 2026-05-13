const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.resolve(__dirname, "../serviceAccountKey.json"));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function deleteCollectionInBatches(collectionName, batchSize = 300) {
    let totalDeleted = 0;

    while (true) {
        const snapshot = await db
            .collection(collectionName)
            .limit(batchSize)
            .get();

        if (snapshot.empty) {
            break;
        }

        const batch = db.batch();

        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        totalDeleted += snapshot.size;
        console.log(`Deleted ${snapshot.size} docs from ${collectionName} (total: ${totalDeleted})`);
    }

    return totalDeleted;
}

async function main() {
    try {
        console.log("Starting FULL delete...");

        const deletedInstances = await deleteCollectionInBatches("task_instances", 300);
        const deletedEntries = await deleteCollectionInBatches("task_entries", 300);

        console.log("DONE");
        console.log(`task_instances deleted: ${deletedInstances}`);
        console.log(`task_entries deleted: ${deletedEntries}`);

        process.exit(0);
    } catch (error) {
        console.error("FAILED:", error);
        process.exit(1);
    }
}

main();