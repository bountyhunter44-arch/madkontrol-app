/**
 * audit-equipment-bound-routines-without-equipment.cjs   —  READ-ONLY. No writes, ever.
 *
 * Finds ALL equipment-bound routine docs that lack a concrete equipment/unit reference across
 * task_templates, task_instances and task_entries — not just køl/frys/temperatur, but every
 * equipment-bound type: køleskab, fryser, køledisk, kølerum, frostrum, varmeskab, pålægsmaskine,
 * komfur, ovn, friture, opvaskemaskine, isterningemaskine, softice, røgeovn, rasteskab.
 *
 * Uses the SAME shared rule as the backend/generators (single source of truth):
 *   functions/equipmentRoutineGuard.js
 * Therefore PROCESS routines are never flagged (nedkøling, opvarmning, 3-timers regel,
 * modtagekontrol, adskillelse, personlig hygiejne, varmholdelse). No bare "køl"/"koel".
 *
 * Usage:
 *   node --check tools/audit-equipment-bound-routines-without-equipment.cjs
 *   node --use-system-ca tools/audit-equipment-bound-routines-without-equipment.cjs
 *   node --use-system-ca tools/audit-equipment-bound-routines-without-equipment.cjs --companyId=onboarding_aroi-d_42405000
 *   ... add --json for machine-readable output.
 */
"use strict";

const path = require("path");
const admin = require("firebase-admin");
const {
  isEquipmentBoundRoutine,
  hasConcreteEquipmentRef,
  shouldSkipEquipmentBoundRoutineWithoutEquipment
} = require(path.join(__dirname, "../functions/equipmentRoutineGuard.js"));

const COLLECTIONS = ["task_templates", "task_instances", "task_entries"];

// Process terms that must NEVER appear in a flagged doc — used for the false-positive self-check.
const PROCESS_TERMS = [
  "nedkøling", "nedkoeling", "opvarmning", "genopvarmning", "3-timers", "tre_timers", "tre-timers",
  "modtagekontrol", "varemodtagelse", "adskillelse", "personlig hygiejne", "varmholdelse", "hot_holding"
];

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

function docHaystack(d = {}) {
  return [d.title, d.taskTitle, d.routineTitle, d.routineType, d.templateKey, d.category, d.equipmentType]
    .filter(Boolean).join(" ").toLowerCase();
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
  // False-positive controls
  let equipmentBoundWithEquipment = 0;   // equipment-bound but HAS equipment -> correctly NOT flagged
  let processNotFlagged = 0;             // process routines -> correctly NOT flagged
  const falsePositives = [];            // flagged docs that ALSO match a process term (should be 0)

  for (const col of COLLECTIONS) {
    let ref = db.collection(col);
    if (companyFilter) ref = ref.where("companyId", "==", companyFilter);
    const snap = await ref.get();
    snap.forEach((doc) => {
      const d = doc.data() || {};
      const bound = isEquipmentBoundRoutine(d);

      // Sanity counters for the false-positive section
      if (bound && hasConcreteEquipmentRef(d)) equipmentBoundWithEquipment++;
      if (!bound) processNotFlagged++;

      if (!shouldSkipEquipmentBoundRoutineWithoutEquipment(d)) return; // not a target

      const hay = docHaystack(d);
      const offendingProcess = PROCESS_TERMS.filter((t) => hay.includes(t));

      const alreadyArchived =
        d.archived === true || d.active === false || d.isActive === false || d.status === "inactive";

      const finding = {
        collection: col,
        docId: doc.id,
        companyId: d.companyId || d.organizationId || "",
        locationId: d.locationId || "",
        title: d.title || d.taskTitle || d.routineTitle || "",
        routineType: d.routineType || "",
        templateKey: d.templateKey || "",
        equipmentId: d.equipmentId || "",
        unitId: d.unitId || "",
        equipmentName: d.equipmentName || "",
        unitName: d.unitName || "",
        createdAt: d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toISOString() : (d.createdAt || d.dateKey || ""),
        alreadyArchived,
        suggestedAction: alreadyArchived
          ? "none (already soft-archived/hidden)"
          : (col === "task_entries"
              ? "review only — historical registration, do NOT archive"
              : "soft_archive_missing_equipment_reference")
      };
      findings.push(finding);
      if (offendingProcess.length) falsePositives.push({ ...finding, offendingProcess });
    });
  }

  if (asJson) {
    console.log(JSON.stringify({ findings, falsePositives, equipmentBoundWithEquipment, processNotFlagged }, null, 2));
    process.exit(0);
  }

  console.log("==================================================");
  console.log("audit-equipment-bound-routines-without-equipment   (READ-ONLY)");
  console.log("shared rule:", "functions/equipmentRoutineGuard.js");
  console.log("scope:", companyFilter || "ALL companies");
  console.log("collections:", COLLECTIONS.join(", "));
  console.log("==================================================");

  const byCol = {};
  COLLECTIONS.forEach((c) => { byCol[c] = 0; });
  findings.forEach((f) => { byCol[f.collection] = (byCol[f.collection] || 0) + 1; });

  const needFix = findings.filter((f) => !f.alreadyArchived);
  console.log("\nEquipment-bound docs WITHOUT concrete equipment:", findings.length);
  COLLECTIONS.forEach((c) => console.log(`  ${c}: ${byCol[c]}`));
  console.log("  already archived/hidden:", findings.length - needFix.length);
  console.log("  needs cleanup:", needFix.length);

  // Breakdown by routineType/templateKey so the equipment coverage is visible
  const byType = {};
  findings.forEach((f) => {
    const key = f.routineType || f.templateKey || "(blank)";
    byType[key] = (byType[key] || 0) + 1;
  });
  console.log("\n-- by routineType/templateKey --");
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${n.toString().padStart(4)}  ${k}`));

  console.log("\n-- sample (first 25) --");
  findings.slice(0, 25).forEach((f) => {
    console.log(`  [${f.collection}] ${f.docId}`);
    console.log(`      company=${f.companyId} loc=${f.locationId}`);
    console.log(`      "${f.title}" routineType=${f.routineType} templateKey=${f.templateKey}`);
    console.log(`      equipmentId=${f.equipmentId || "—"} unitId=${f.unitId || "—"} equipmentName=${f.equipmentName || "—"} unitName=${f.unitName || "—"}`);
    console.log(`      createdAt=${f.createdAt} | archived=${f.alreadyArchived} | -> ${f.suggestedAction}`);
  });

  console.log("\n-- false-positive control --");
  console.log("  equipment-bound docs that HAVE equipment (correctly NOT flagged):", equipmentBoundWithEquipment);
  console.log("  process/other docs (correctly NOT flagged):", processNotFlagged);
  console.log("  flagged docs that also match a PROCESS term (must be 0):", falsePositives.length);
  if (falsePositives.length) {
    console.log("  ⚠️  POTENTIAL FALSE POSITIVES:");
    falsePositives.slice(0, 10).forEach((f) =>
      console.log(`     [${f.collection}] ${f.docId} "${f.title}" matches ${f.offendingProcess.join(",")}`));
  } else {
    console.log("  ✓ no process routines (nedkøling/3-timers/varmholdelse/...) were flagged.");
  }

  console.log("\nREAD-ONLY — no writes. task_entries are review-only (historical); use the repair");
  console.log("script (dry-run default, task_templates/task_instances only) to soft-archive after review.");
  console.log("==================================================");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
