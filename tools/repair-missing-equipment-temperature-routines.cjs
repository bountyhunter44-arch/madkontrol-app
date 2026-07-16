/**
 * repair-missing-equipment-temperature-routines.cjs
 *
 * Soft-archives (NEVER deletes) the generic cold/freezer/temperature docs that lack a concrete
 * equipment reference, in task_templates / task_instances. DRY-RUN by default.
 *
 * Soft-archive payload only:
 *   active:false, isActive:false, archived:true, status:"inactive",
 *   archivedReason:"missing_equipment_reference", archivedAt
 *
 * Guards: only touches docs that BOTH require concrete equipment AND have none. Docs that already
 * carry equipment are never touched. task_entries are NOT archived (historical records kept intact).
 *
 * Usage (DRY-RUN): node --use-system-ca tools/repair-missing-equipment-temperature-routines.cjs
 *   scope:          ... --companyId=onboarding_aroi-d_42405000
 *   apply:          ... --apply
 */
"use strict";

const path = require("path");
const admin = require("firebase-admin");
const { shouldSkipEquipmentBoundRoutineWithoutEquipment } =
  require(path.join(__dirname, "../functions/equipmentRoutineGuard.js"));

// Only structural collections — task_entries (historical registrations) are never archived here.
const COLLECTIONS = ["task_templates", "task_instances"];
const MAX_BATCH = 400;

function parseArgs(argv) {
  const a = {};
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    if (eq === -1) a[raw.slice(2)] = true;
    else a[raw.slice(2, eq)] = raw.slice(eq + 1);
  }
  return a;
}
async function main() {
  const args = parseArgs(process.argv);
  const APPLY = args.apply === true;
  const companyFilter = typeof args.companyId === "string" ? args.companyId : "";

  if (!admin.apps.length) {
    const sa = require(path.join(__dirname, "../serviceAccountKey.json"));
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
  }
  const db = admin.firestore();

  console.log("==================================================");
  console.log("repair-missing-equipment-temperature-routines");
  console.log("MODE:", APPLY ? "APPLY (soft-archive)" : "DRY-RUN (no writes)");
  console.log("scope:", companyFilter || "ALL companies");
  console.log("==================================================");

  let totalTargets = 0;
  for (const col of COLLECTIONS) {
    let ref = db.collection(col);
    if (companyFilter) ref = ref.where("companyId", "==", companyFilter);
    const snap = await ref.get();

    const targets = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      if (!shouldSkipEquipmentBoundRoutineWithoutEquipment(d)) return;
      const alreadyArchived = d.archived === true || d.active === false || d.isActive === false || d.status === "inactive";
      if (alreadyArchived) return; // nothing to do
      targets.push({ ref: doc.ref, id: doc.id, title: d.title || d.taskTitle || "", routineType: d.routineType || "" });
    });

    console.log(`\n${col}: ${targets.length} generic-without-equipment doc(s) to soft-archive`);
    targets.slice(0, 10).forEach((t) => console.log(`  - ${t.id} | "${t.title}" (${t.routineType})`));
    if (targets.length > 10) console.log(`  ... +${targets.length - 10} more`);
    totalTargets += targets.length;

    if (APPLY && targets.length) {
      for (let i = 0; i < targets.length; i += MAX_BATCH) {
        const batch = db.batch();
        targets.slice(i, i + MAX_BATCH).forEach((t) => batch.set(t.ref, {
          active: false,
          isActive: false,
          archived: true,
          status: "inactive",
          archivedReason: "missing_equipment_reference",
          archivedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true }));
        await batch.commit();
      }
      console.log(`  [APPLY] soft-archived ${targets.length} doc(s) in ${col}.`);
    }
  }

  console.log("\n-- SUMMARY --");
  console.log("  total targets:", totalTargets);
  console.log(APPLY ? "  [APPLY] soft-archive committed (no deletes, history preserved)." : "  DRY-RUN — pass --apply to soft-archive (still no deletes).");
  console.log("==================================================");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
