const admin = require("firebase-admin");
const path = require("path");
const { execSync } = require("child_process");

const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function deleteCollectionDocuments(collectionName) {
  let totalDeleted = 0;

  while (true) {
    const snapshot = await db.collection(collectionName).limit(400).get();

    if (snapshot.empty) {
      if (totalDeleted === 0) {
        console.log(`Ingen dokumenter i ${collectionName}`);
      }
      break;
    }

    const batch = db.batch();

    snapshot.docs.forEach((docItem) => {
      batch.delete(docItem.ref);
    });

    await batch.commit();

    totalDeleted += snapshot.size;
    console.log(`Slettet ${snapshot.size} dokumenter fra ${collectionName}`);
  }

  return totalDeleted;
}

async function run() {
  try {
    console.log("Starter reset af daglige data...");

    const deletedTaskInstances = await deleteCollectionDocuments("task_instances");
    const deletedTaskEntries = await deleteCollectionDocuments("task_entries");
    const deletedAlerts = await deleteCollectionDocuments("alerts");

    console.log("Genererer nye daglige task_instances...");
    execSync(`node "${path.join(__dirname, "generateDailyTasks.js")}"`, {
      stdio: "inherit"
    });

    console.log("Importerer test alerts...");
    execSync(`node "${path.join(__dirname, "importAlerts.js")}"`, {
      stdio: "inherit"
    });

    console.log("Reset færdig ✅");
    console.log(`task_instances slettet: ${deletedTaskInstances}`);
    console.log(`task_entries slettet: ${deletedTaskEntries}`);
    console.log(`alerts slettet: ${deletedAlerts}`);
  } catch (error) {
    console.error("Fejl i resetDailyData.js:", error);
    process.exitCode = 1;
  }
}

run();