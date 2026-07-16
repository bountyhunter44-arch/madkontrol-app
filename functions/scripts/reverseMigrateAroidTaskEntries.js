/**
 * reverseMigrateAroidTaskEntries.js
 *
 * REVERT of migrateAroidTaskEntriesLegacyToCanonical: the 647 canonical task_entries copies
 * polluted rutiner.html (which reads task_entries as routine-card history), producing duplicate
 * routine cards. This removes ONLY those migrated copies. The legacy originals are untouched, so
 * nothing is lost (the migration can be re-run, or the report can read both scopes instead).
 *
 * Triple guard — a doc is only deleted if ALL hold:
 *   locationId  == targetLocationId (canonical)
 *   restoreBatchId == --restoreBatchId
 *   restoredBy  == "migrateAroidTaskEntriesLegacyToCanonical"
 *
 * DRY-RUN by default. Pass --apply to delete. Legacy + original-9 canonical entries are never touched.
 *
 * Usage (DRY-RUN): node --use-system-ca functions/scripts/reverseMigrateAroidTaskEntries.js --restoreBatchId="restore_aroi_d_entries_2026_06_15_001"
 * Apply:           ...same... --apply
 */

"use strict";

const path = require("path");
const admin = require("firebase-admin");

const TARGET_LOC = "onboarding_aroi-d_42405000__main";
const MIGRATED_BY = "migrateAroidTaskEntriesLegacyToCanonical";
const LEGACY_LOC = "location_1778453641187_fbljxh1ym";
const MAX_BATCH = 450;

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    if (eq === -1) args[raw.slice(2)] = true;
    else args[raw.slice(2, eq)] = raw.slice(eq + 1);
  }
  return args;
}
function fail(m) { console.error("\n[STOP] " + m); process.exit(1); }

async function main() {
  const args = parseArgs(process.argv);
  const APPLY = args.apply === true;
  const restoreBatchId = args.restoreBatchId || "";
  if (!restoreBatchId) fail("--restoreBatchId paakraevet.");

  if (!admin.apps.length) {
    const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: serviceAccount.project_id });
  }
  const db = admin.firestore();

  console.log("==================================================");
  console.log("reverseMigrateAroidTaskEntries");
  console.log("MODE:", APPLY ? "APPLY (DELETES copies)" : "DRY-RUN (no writes)");
  console.log("restoreBatchId:", restoreBatchId, "| target loc:", TARGET_LOC);
  console.log("==================================================");

  // candidate set: canonical + this batch
  const snap = await db.collection("task_entries")
    .where("locationId", "==", TARGET_LOC)
    .where("restoreBatchId", "==", restoreBatchId)
    .get();

  // triple-guard each doc
  const toDelete = [];
  const skipped = [];
  for (const d of snap.docs) {
    const x = d.data();
    if (x.locationId === TARGET_LOC && x.restoreBatchId === restoreBatchId && x.restoredBy === MIGRATED_BY && x.restoredFromDocId) {
      toDelete.push(d);
    } else {
      skipped.push(d.id);
    }
  }

  // safety counts: originals + legacy
  const allCanon = await db.collection("task_entries").where("locationId", "==", TARGET_LOC).count().get();
  const originals = allCanon.data().count - toDelete.length;
  const legacy = await db.collection("task_entries").where("locationId", "==", LEGACY_LOC).count().get();

  console.log("\n-- REVERT PLAN --");
  console.log("  WOULD DELETE (migrated copies):", toDelete.length, "(expect 647)");
  console.log("  skipped (failed triple-guard, kept):", skipped.length);
  console.log("  canonical NON-migrated entries kept:", originals, "(expect ~9)");
  console.log("  legacy entries (untouched):", legacy.data().count, "(expect 647 — the originals)");
  console.log("\n  sample to-delete IDs:");
  toDelete.slice(0, 5).forEach((d) => console.log("    -", d.id, "| restoredFromDocId=" + d.data().restoredFromDocId));

  if (!APPLY) {
    console.log("\n  NO WRITES because dry-run (pass --apply to delete the copies).");
    console.log("==================================================");
    return;
  }

  // APPLY: delete only the guarded copies
  for (let i = 0; i < toDelete.length; i += MAX_BATCH) {
    const batch = db.batch();
    toDelete.slice(i, i + MAX_BATCH).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  console.log(`\n[APPLY] deleted ${toDelete.length} migrated canonical task_entries copies (legacy originals untouched).`);
  console.log("==================================================");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
