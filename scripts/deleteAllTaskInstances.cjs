"use strict";

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

// ─── KONFIGURATION ───────────────────────────────────────────────────────────
const DRY_RUN = false; // Sæt til false for at slette
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 400;

async function main() {
  console.log(`[deleteAllTaskInstances] DRY_RUN=${DRY_RUN}`);

  try {
    const snap = await db.collection("task_instances").get();

    if (snap.empty) {
      console.log("[deleteAllTaskInstances] Ingen task_instances fundet.");
      return;
    }

    console.log(`[deleteAllTaskInstances] found=${snap.size}`);

    for (const doc of snap.docs) {
      console.log(`DELETE: ${doc.id}`);
    }

    if (DRY_RUN) {
      console.log("[deleteAllTaskInstances] DRY_RUN — ingen data slettet.");
      return;
    }

    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + BATCH_SIZE);
      for (const doc of chunk) {
        batch.delete(doc.ref);
      }
      await batch.commit();
      console.log(
        `[deleteAllTaskInstances] slettet batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} docs)`
      );
    }

    console.log("[deleteAllTaskInstances] done.");
  } catch (err) {
    console.error("[deleteAllTaskInstances] FEJL:", err.message);
    process.exit(1);
  }
}

main();
