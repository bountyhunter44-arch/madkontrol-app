/**
 * audit-missing-equipment-temperature-routines.cjs   —  READ-ONLY. No writes, ever.
 *
 * Finds cold/freezer (køl/frys/temperature) routine docs that lack a concrete equipment reference
 * across task_templates, task_instances and task_entries. These are the "generic" rows that should
 * never have been generated (e.g. "Fryser temperatur" without unit).
 *
 * Usage:
 *   node --use-system-ca tools/audit-missing-equipment-temperature-routines.cjs
 *   node --use-system-ca tools/audit-missing-equipment-temperature-routines.cjs --companyId=onboarding_aroi-d_42405000
 *   ... add --json to print machine-readable output.
 */
"use strict";

const path = require("path");
const admin = require("firebase-admin");

const COLLECTIONS = ["task_templates", "task_instances", "task_entries"];

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

// Same rule as the backend/frontend guards.
function requiresConcreteEquipment(d = {}) {
  const hay = [d.templateKey, d.routineType, d.title, d.taskTitle, d.routineTitle, d.category, d.equipmentType]
    .filter(Boolean).join(" ").toLowerCase();
  // SPECIFIC fridge/freezer words only — NOT bare "køl"/"koel" (would wrongly flag process routines
  // like "nedkøling" or "3-timers regel uden køl/varme").
  return (
    hay.includes("fridge") || hay.includes("refrigerator") || hay.includes("køleskab") || hay.includes("koeleskab") ||
    hay.includes("freezer") || hay.includes("fryser") || hay.includes("frost") || hay.includes("cold_storage")
  );
}
function hasConcreteEquipment(d = {}) {
  return Boolean(
    d.equipmentId || d.unitId || d.equipmentName || d.unitName ||
    (d.equipment && (d.equipment.id || d.equipment.name)) ||
    (d.unit && (d.unit.id || d.unit.name)) ||
    (d.answers && (d.answers.equipmentId || d.answers.equipmentName || d.answers.unitId || d.answers.unitName))
  );
}

async function main() {
  const args = parseArgs(process.argv);
  const companyFilter = typeof args.companyId === "string" ? args.companyId : "";
  const asJson = args.json === true;

  if (!admin.apps.length) {
    const sa = require(path.join(__dirname, "../serviceAccountKey.json"));
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
  }
  const db = admin.firestore();

  const findings = [];
  for (const col of COLLECTIONS) {
    let ref = db.collection(col);
    if (companyFilter) ref = ref.where("companyId", "==", companyFilter);
    const snap = await ref.get();
    snap.forEach((doc) => {
      const d = doc.data() || {};
      if (!requiresConcreteEquipment(d) || hasConcreteEquipment(d)) return;
      // Skip already soft-archived rows (they're effectively hidden already).
      const alreadyArchived = d.archived === true || d.active === false || d.isActive === false || d.status === "inactive";
      findings.push({
        collection: col,
        docId: doc.id,
        companyId: d.companyId || d.organizationId || "",
        locationId: d.locationId || "",
        title: d.title || d.taskTitle || d.routineTitle || "",
        routineType: d.routineType || "",
        templateKey: d.templateKey || "",
        createdAt: d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toISOString() : (d.createdAt || d.dateKey || ""),
        alreadyArchived,
        suggestedAction: alreadyArchived ? "none (already soft-archived/hidden)" : "soft_archive_missing_equipment_reference"
      });
    });
  }

  if (asJson) { console.log(JSON.stringify(findings, null, 2)); process.exit(0); }

  console.log("==================================================");
  console.log("audit-missing-equipment-temperature-routines  (READ-ONLY)");
  console.log("scope:", companyFilter || "ALL companies");
  console.log("==================================================");
  const byCol = {};
  findings.forEach((f) => { byCol[f.collection] = (byCol[f.collection] || 0) + 1; });
  console.log("\nGeneric cold/freezer docs WITHOUT equipment:", findings.length);
  COLLECTIONS.forEach((c) => console.log(`  ${c}: ${byCol[c] || 0}`));
  const needFix = findings.filter((f) => !f.alreadyArchived);
  console.log("  already soft-archived/hidden:", findings.length - needFix.length, "| would need cleanup:", needFix.length);

  console.log("\n-- sample (first 25) --");
  findings.slice(0, 25).forEach((f) => {
    console.log(`  [${f.collection}] ${f.docId}`);
    console.log(`      company=${f.companyId} loc=${f.locationId} | "${f.title}" routineType=${f.routineType} templateKey=${f.templateKey}`);
    console.log(`      createdAt=${f.createdAt} | archived=${f.alreadyArchived} | -> ${f.suggestedAction}`);
  });
  console.log("\nREAD-ONLY — no writes. Use the repair script (dry-run default) to soft-archive after review.");
  console.log("==================================================");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
