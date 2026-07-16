/**
 * reactivateCanonicalGenericTemplates.js
 *
 * CORRECTIVE fix for runCanonicalEngineRestore sequencing: TRIN 0 archived all 28 flat
 * templates; the engine then re-used the NON-equipment ones via update(patch) but did not
 * un-archive them. This re-activates exactly those non-equipment generic templates.
 *
 * Equipment-routine flat templates (superseded by per-unit versions) stay archived.
 *
 * DRY-RUN by default. Pass --apply to write. No hard delete. Only flips
 * active/isActive/archived/status on the affected docs.
 *
 * Usage (DRY-RUN):
 *   node --use-system-ca functions/scripts/reactivateCanonicalGenericTemplates.js \
 *     --targetCompanyId="onboarding_aroi-d_42405000" \
 *     --targetLocationId="onboarding_aroi-d_42405000__main" \
 *     --restoreBatchId="canonical_aroi_d_2026_06_15_001"
 */

"use strict";

const path = require("path");
const admin = require("firebase-admin");
const { normalizeRoutineType } = require("../js/canonicalRoutines");

const ARCHIVED_BY_TO_FIX = "runCanonicalEngineRestore";
const REACTIVATED_BY = "reactivateCanonicalGenericTemplates";
const AROID_NAME_HINT = "aroi";

// Mirror of canonicalTaskEngine EQUIPMENT_ROUTINE_TYPES keys — equipment routines whose flat
// docs are correctly superseded by per-unit versions and must STAY archived.
const EQUIPMENT_ROUTINE_TYPES = new Set([
  "koeleskab_temperatur", "koeleskab_rengoering", "fryser_temperatur", "fryser_rengoering",
  "walkin_koeler_temperatur", "walkin_koeler_rengoering", "walkin_fryser_temperatur", "walkin_fryser_rengoering",
  "opvaskemaskine_skyllevand", "opvaskemaskine_rengoering", "friture_rengoering", "paalaegsmaskine_rengoering",
  "softice_maskine_rengoering", "softice_temperatur_kontrol", "koledisk_temperatur", "koledisk_rengoering",
  "ovn_rengoering", "komfur_rengoering", "blaesekoeler_temperatur", "blaesekoeler_rengoering",
  "varmeskab_temperatur", "varmeskab_rengoering", "roegeovn_temperatur", "roegeovn_rengoering", "rasteskab_rengoering"
]);

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

function fail(msg) { console.error("\n[STOP] " + msg); process.exit(1); }

async function main() {
  const args = parseArgs(process.argv);
  const APPLY = args.apply === true;
  const targetCompanyId = args.targetCompanyId || "";
  const targetLocationId = args.targetLocationId || "";
  const restoreBatchId = args.restoreBatchId || "";

  if (!targetCompanyId || !targetLocationId) fail("targetCompanyId og targetLocationId paakraevet.");

  if (!admin.apps.length) {
    const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: serviceAccount.project_id });
  }
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });

  console.log("==================================================");
  console.log("reactivateCanonicalGenericTemplates");
  console.log("MODE:", APPLY ? "APPLY (WRITES)" : "DRY-RUN (no writes)");
  console.log("TARGET:", targetCompanyId, "/", targetLocationId);
  console.log("==================================================");

  // Aroi-D identity guard
  const tgtCompany = await db.collection("companies").doc(targetCompanyId).get();
  const tgtLocation = await db.collection("companies").doc(targetCompanyId).collection("locations").doc(targetLocationId).get();
  if (!tgtCompany.exists || !tgtLocation.exists) fail("target company/location findes ikke.");
  const identity = `${(tgtLocation.data() || {}).name || ""} ${(tgtCompany.data() || {}).name || ""} ${targetCompanyId}`.toLowerCase();
  if (!identity.includes(AROID_NAME_HINT)) fail("target identificeres ikke som Aroi-D.");

  const snap = await db.collection("task_templates").where("locationId", "==", targetLocationId).get();
  const all = snap.docs.map((d) => ({ ref: d.ref, id: d.id, ...d.data() }))
    .filter((t) => t.companyId === targetCompanyId || t.organizationId === targetCompanyId);

  const isArchived = (t) => t.isActive === false || t.active === false || t.archived === true || t.status === "archived";

  const candidates = all.filter((t) => {
    if (!isArchived(t)) return false;
    if (ARCHIVED_BY_TO_FIX && t.archivedBy !== ARCHIVED_BY_TO_FIX) return false;
    const rt = normalizeRoutineType(t.routineType || t.templateKey || t.taskKey || "");
    const isEquipmentRoutine = EQUIPMENT_ROUTINE_TYPES.has(rt);
    const hasEquipmentBinding = !!(t.equipmentId && t.equipmentId !== "");
    // Re-activate ONLY non-equipment generic flat templates (no per-unit replacement).
    return !isEquipmentRoutine && !hasEquipmentBinding;
  });

  const stayArchived = all.filter((t) => isArchived(t) && !candidates.includes(t));

  console.log("\nArchived templates on target:", all.filter(isArchived).length);
  console.log("WOULD RE-ACTIVATE (non-equipment generic CCPs):", candidates.length);
  candidates.forEach((t) => console.log("   + " + (t.routineType || t.templateKey || t.id) + "  \"" + String(t.title || t.name || "").slice(0, 40) + "\""));
  console.log("\nWILL STAY ARCHIVED (equipment flat, superseded by per-unit):", stayArchived.length);
  stayArchived.slice(0, 20).forEach((t) => console.log("   - " + (t.routineType || t.templateKey || t.id)));

  if (!APPLY) {
    console.log("\n  NO WRITES because dry-run (pass --apply to write).");
    console.log("==================================================");
    return;
  }

  const patch = {
    active: true, isActive: true, archived: false, status: "active",
    reactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
    reactivatedBy: REACTIVATED_BY, reactivateBatchId: restoreBatchId || null
  };
  for (let i = 0; i < candidates.length; i += 450) {
    const batch = db.batch();
    candidates.slice(i, i + 450).forEach((t) => batch.set(t.ref, patch, { merge: true }));
    await batch.commit();
  }
  console.log(`\n[APPLY] re-activated ${candidates.length} non-equipment generic templates.`);
  console.log("==================================================");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
