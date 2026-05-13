# FILE: scripts/delete-global-manual-deviations.js

```javascript
const path = require("path");
const admin = require("firebase-admin");

const serviceAccount = require(path.join(__dirname, "..", "serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const DRY_RUN = process.argv.includes("--dry-run");

function uniqueRefsFromSnapshots(snapshots) {
  const map = new Map();
  snapshots.forEach((snap) => {
    snap.docs.forEach((doc) => {
      map.set(doc.ref.path, doc.ref);
    });
  });
  return Array.from(map.values());
}

async function collectManualAlerts() {
  const queries = [
    db.collection("alerts").where("alertType", "==", "manual_deviation").get(),
    db.collection("alerts").where("actionType", "==", "manual_deviation").get(),
    db.collection("alerts").where("reason", "==", "manual_deviation").get(),
    db.collection("alerts").where("actionType", "==", "deviation").get()
  ];

  const snapshots = await Promise.all(queries);
  return uniqueRefsFromSnapshots(snapshots);
}

async function collectManualTaskEntries() {
  const queries = [
    db.collection("task_entries").where("actionType", "==", "manual_deviation").get(),
    db.collection("task_entries").where("actionType", "==", "deviation").get(),
    db.collection("task_entries").where("valueOption", "==", "deviation").get(),
    db.collection("task_entries").where("status", "==", "deviation").get()
  ];

  const snapshots = await Promise.all(queries);
  return uniqueRefsFromSnapshots(snapshots);
}

async function collectManualDeviations() {
  const queries = [
    db.collection("deviations").where("reason", "==", "manual_deviation").get(),
    db.collection("deviations").where("isDeviation", "==", true).get()
  ];

  const snapshots = await Promise.all(queries);

  // Keep only records that look manually created.
  const refs = uniqueRefsFromSnapshots(snapshots);
  const filtered = [];

  for (const ref of refs) {
    const snap = await ref.get();
    if (!snap.exists) continue;
    const data = snap.data() || {};
    const reason = String(data.reason || "");
    const actionType = String(data.actionType || "");
    const sourceType = String(data.sourceType || "");

    const isManual =
      reason === "manual_deviation" ||
      actionType === "manual_deviation" ||
      actionType === "deviation" ||
      sourceType === "manual_deviation";

    if (isManual) {
      filtered.push(ref);
    }
  }

  return filtered;
}

async function deleteRefs(refs) {
  let deleted = 0;

  for (let i = 0; i < refs.length; i += 450) {
    const chunk = refs.slice(i, i + 450);
    const batch = db.batch();
    chunk.forEach((ref) => batch.delete(ref));
    if (!DRY_RUN) {
      await batch.commit();
    }
    deleted += chunk.length;
  }

  return deleted;
}

async function main() {
  const [alertRefs, taskEntryRefs, deviationRefs] = await Promise.all([
    collectManualAlerts(),
    collectManualTaskEntries(),
    collectManualDeviations()
  ]);

  const totalFound = {
    alerts: alertRefs.length,
    task_entries: taskEntryRefs.length,
    deviations: deviationRefs.length
  };

  const totalDeleted = {
    alerts: await deleteRefs(alertRefs),
    task_entries: await deleteRefs(taskEntryRefs),
    deviations: await deleteRefs(deviationRefs)
  };

  console.log(`Mode: ${DRY_RUN ? "DRY_RUN" : "DELETE"}`);
  console.log(`alerts: found=${totalFound.alerts}, deleted=${totalDeleted.alerts}`);
  console.log(`task_entries: found=${totalFound.task_entries}, deleted=${totalDeleted.task_entries}`);
  console.log(`deviations: found=${totalFound.deviations}, deleted=${totalDeleted.deviations}`);

  await admin.app().delete();
}

main().catch(async (error) => {
  console.error("Delete failed:", error);
  try {
    await admin.app().delete();
  } catch {
    // ignore cleanup errors
  }
  process.exit(1);
});

```
