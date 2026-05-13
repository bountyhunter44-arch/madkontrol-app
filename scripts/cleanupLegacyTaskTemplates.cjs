/**
 * cleanupLegacyTaskTemplates.cjs
 *
 * Finder og arkiverer dublerede task_templates i Firestore.
 *
 * Grupperer efter: companyId + locationId + (controlType|templateKey) + title + equipmentUnit
 * Vælger én canonical per gruppe (nyest + backend-genereret foretrukket).
 * Resten sættes til isArchived: true.
 *
 * SLET KUN dokumenter der er 100% sikre (ingen referencer og ingen aktive felter).
 *
 * Sæt DRY_RUN = false for at skrive til Firestore.
 */

"use strict";

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

// ─── KONFIGURATION ───────────────────────────────────────────────────────────
const DRY_RUN = true;        // Sæt til false for at skrive til Firestore
const ARCHIVE_REASON = "legacy-duplicate-template";
// ─────────────────────────────────────────────────────────────────────────────

function groupKey(doc) {
  const d = doc.data;
  const companyId   = d.companyId   || d.organizationId || "";
  const locationId  = d.locationId  || "";
  const typeKey     = d.controlType || d.templateKey    || d.type || "";
  const title       = (d.title || "").trim().toLowerCase();
  const unitKey     = d.equipmentUnit || d.unitId || d.areaName || "";
  return `${companyId}|${locationId}|${typeKey}|${title}|${unitKey}`;
}

/**
 * Scorer en template: højere = bedre kandidat til at bevare.
 * Backend-genererede (har templateKey) vægtes højest.
 */
function score(doc) {
  const d = doc.data;
  let s = 0;
  if (d.templateKey)                                       s += 100; // backend-genereret
  if (d.isActive === true)                                 s +=  50;
  if (d.equipmentUnit)                                     s +=  20; // unit-specifik
  if (d.isArchived === true)                               s -=  200; // allerede arkiveret
  // Nyere updatedAt er bedre
  const ts = d.updatedAt?.toMillis?.() || d.updatedAt?._seconds * 1000 || 0;
  s += Math.floor(ts / 1e10); // lille bonus for nyere timestamps
  return s;
}

async function main() {
  console.log(`[cleanupTemplates] DRY_RUN=${DRY_RUN}`);

  // ── 1. Hent alle task_templates ─────────────────────────────────────────────
  const snap = await db.collection("task_templates").get();
  const allDocs = snap.docs.map((d) => ({ id: d.id, ref: d.ref, data: d.data() }));
  console.log(`[cleanupTemplates] found=${allDocs.length}`);

  // ── 2. Gruppér ──────────────────────────────────────────────────────────────
  const groups = new Map();
  for (const doc of allDocs) {
    const k = groupKey(doc);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(doc);
  }

  let totalGroups    = 0;
  let toArchive      = 0;
  let toDelete       = 0;
  let skipped        = 0;
  const archiveOps   = [];
  const deleteOps    = [];

  // ── 3. Per gruppe: vælg canonical, arkivér resten ───────────────────────────
  for (const [key, members] of groups.entries()) {
    totalGroups++;
    if (members.length === 1) continue; // ingen dubletter

    // Sortér best-first
    members.sort((a, b) => score(b) - score(a));
    const canonical = members[0];
    const duplicates = members.slice(1);

    console.log(`\nGROUP: ${key}`);
    console.log(`  KEEP: ${canonical.id} (score=${score(canonical)})`);

    for (const dup of duplicates) {
      const d = dup.data;

      // Skip hvis allerede arkiveret
      if (d.isArchived === true) {
        console.log(`  SKIP: ${dup.id} reason=alreadyArchived`);
        skipped++;
        continue;
      }

      // Kan slettes sikkert hvis: ingen entries, ingen alerts, ingen rapport, pending/inaktiv
      const safeToDelete =
        d.isActive !== true &&
        !d.hasEntries &&
        !d.hasAlerts &&
        !d.usedInReport;

      if (safeToDelete) {
        console.log(`  DELETE: ${dup.id}`);
        deleteOps.push(dup.ref);
        toDelete++;
      } else {
        console.log(`  ARCHIVE: ${dup.id}`);
        archiveOps.push({
          ref: dup.ref,
          payload: {
            isArchived:     true,
            isActive:       false,
            archivedAt:     admin.firestore.FieldValue.serverTimestamp(),
            archivedReason: ARCHIVE_REASON,
          },
        });
        toArchive++;
      }
    }
  }

  console.log(
    `\n[cleanupTemplates] found=${allDocs.length} groups=${totalGroups} archive=${toArchive} delete=${toDelete} skipped=${skipped}`
  );

  if (DRY_RUN) {
    console.log("[cleanupTemplates] DRY_RUN – ingen ændringer skrevet til Firestore.");
    return;
  }

  // ── 4. Skriv arkiveringer i batches ─────────────────────────────────────────
  const BATCH_SIZE = 400;
  for (let i = 0; i < archiveOps.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const op of archiveOps.slice(i, i + BATCH_SIZE)) {
      batch.update(op.ref, op.payload);
    }
    await batch.commit();
    console.log(`[cleanupTemplates] archived batch ${Math.floor(i / BATCH_SIZE) + 1}`);
  }

  // ── 5. Slet sikre dubletter ──────────────────────────────────────────────────
  for (let i = 0; i < deleteOps.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const ref of deleteOps.slice(i, i + BATCH_SIZE)) {
      batch.delete(ref);
    }
    await batch.commit();
    console.log(`[cleanupTemplates] deleted batch ${Math.floor(i / BATCH_SIZE) + 1}`);
  }

  console.log("[cleanupTemplates] done.");
}

main().catch((err) => {
  console.error("[cleanupTemplates] FEJL:", err);
  process.exit(1);
});
