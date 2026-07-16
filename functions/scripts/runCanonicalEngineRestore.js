/**
 * runCanonicalEngineRestore.js
 *
 * SAFE canonical-engine restore for a real customer location.
 *
 * Unlike the discarded restoreAroidMasterdataLegacyToCanonical.js (which copied
 * FLAT legacy task_templates and broke runtime), this script:
 *   TRIN 0  Soft-archive any flat legacy templates from the old restore (no hard delete)
 *   TRIN 1  Replicate the 23 source EQUIPMENT to the target location (deterministic ids,
 *           real_owner stamp, internal `id` == new doc id so the engine binds correctly)
 *   TRIN 2  Call the REAL generateCanonicalTaskTemplates() from ../canonicalTaskEngine.js
 *           with routineKeys=null so the engine scans the freshly-created equipment and
 *           generates the correct per-unit CCP templates (e.g. koeleskab_temperatur bound
 *           to each fridge via buildCanonicalTemplateId).
 *
 * DRY-RUN by default. Pass --apply to write.
 * In DRY-RUN, TRIN 2 is SIMULATED (the engine writes internally and is not dry-run safe);
 * --apply calls the real engine.
 *
 * Never touches: task_instances, task_entries, daily_runs, daily_reports, deviations,
 * risk_analysis, users, live_user_profiles, subscriptions/checkout_sessions/Stripe.
 * No hard deletes.
 *
 * Usage (DRY-RUN):
 *   node --use-system-ca functions/scripts/runCanonicalEngineRestore.js \
 *     --sourceCompanyId="company_1778453641187_xxaoilz18" \
 *     --sourceLocationId="location_1778453641187_fbljxh1ym" \
 *     --targetCompanyId="onboarding_aroi-d_42405000" \
 *     --targetLocationId="onboarding_aroi-d_42405000__main" \
 *     --restoreBatchId="canonical_aroi_d_2026_06_15_001"
 *
 * Apply (WRITES) — only after approval:
 *   ...same args... --apply
 */

"use strict";

const path = require("path");
const admin = require("firebase-admin");

// REAL engine (called on --apply)
const { generateCanonicalTaskTemplates } = require("../canonicalTaskEngine");
// Canonical routine definitions + helpers (same source the engine uses) — for DRY-RUN simulation
const { CANONICAL_ROUTINES, normalizeRoutineType, buildDisplayTitle } = require("../js/canonicalRoutines");
const { buildOwnerScopeMetadata, isValidOwnerKind } = require("../lib/ownerScope");

const RESTORED_BY = "runCanonicalEngineRestore";
const ARCHIVED_BY = "runCanonicalEngineRestore";
const OLD_FLAT_RESTORE_BY = "restoreAroidMasterdataLegacyToCanonical"; // flat legacy templates to retire
const SUPAWAN_UID = "HNcGHMrzsUPqbyBcmodsxBuWuJc2";
const TODAY_DATEKEY = "2026-06-15";
const AROID_NAME_HINT = "aroi";
const OWNER_KIND = "real_owner";
const MAX_BATCH = 450;

// ---- EQUIPMENT_ROUTINE_TYPES: faithful mirror of canonicalTaskEngine.js (DRY-RUN simulation only) ----
const EQUIPMENT_ROUTINE_TYPES = {
  koeleskab_temperatur: ["fridge", "koeleskab"],
  koeleskab_rengoering: ["fridge", "koeleskab"],
  fryser_temperatur: ["freezer", "fryser"],
  fryser_rengoering: ["freezer", "fryser"],
  walkin_koeler_temperatur: ["walk_in_cooler", "walkin_cooler", "walkin_koeler"],
  walkin_koeler_rengoering: ["walk_in_cooler", "walkin_cooler", "walkin_koeler"],
  walkin_fryser_temperatur: ["walk_in_freezer", "walkin_freezer", "walkin_fryser"],
  walkin_fryser_rengoering: ["walk_in_freezer", "walkin_freezer", "walkin_fryser"],
  opvaskemaskine_skyllevand: ["dishwasher", "opvaskemaskine"],
  opvaskemaskine_rengoering: ["dishwasher", "opvaskemaskine"],
  friture_rengoering: ["fryer", "friture"],
  paalaegsmaskine_rengoering: ["slicer", "paalaegsmaskine", "slicing_machine"],
  softice_maskine_rengoering: ["softice_machine", "ice_machine", "ismaskine", "softice_maskine"],
  softice_temperatur_kontrol: ["softice_machine", "ice_machine", "ismaskine", "softice_maskine"],
  koledisk_temperatur: ["display_fridge", "refrigerated_display", "koledisk"],
  koledisk_rengoering: ["display_fridge", "refrigerated_display", "koledisk"],
  ovn_rengoering: ["oven", "ovn"],
  komfur_rengoering: ["stove", "komfur"],
  blaesekoeler_temperatur: ["blast_chiller", "blaesekoeler"],
  blaesekoeler_rengoering: ["blast_chiller", "blaesekoeler"],
  varmeskab_temperatur: ["warming_cabinet", "hot_cabinet", "varmeskab"],
  varmeskab_rengoering: ["warming_cabinet", "hot_cabinet", "varmeskab"],
  roegeovn_temperatur: ["smoke_oven", "roegeovn"],
  roegeovn_rengoering: ["smoke_oven", "roegeovn"],
  rasteskab_rengoering: ["proofing_cabinet", "rasteskab"]
};

function normalizeEquipmentTypeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s-]+/g, "_");
}

function normalizeCanonicalUnit(unit = {}) {
  const id = String(unit.id || unit.equipmentId || unit.unitId || "").trim();
  const type = normalizeEquipmentTypeKey(unit.type || unit.equipmentType || unit.category || "");
  const category = normalizeEquipmentTypeKey(unit.category || unit.type || unit.equipmentType || "");
  const name = String(unit.name || unit.displayName || unit.equipmentName || unit.unitName || "").trim();
  return { ...unit, id, type, category, name };
}

function getRoutineTargetUnits(routineType, units = []) {
  const normalizedRoutineType = normalizeRoutineType(routineType);
  const allowedTypes = EQUIPMENT_ROUTINE_TYPES[normalizedRoutineType] || null;
  if (!allowedTypes) {
    return [{ id: "default", name: "", type: "default", category: "default" }];
  }
  const allowed = new Set(allowedTypes.map(normalizeEquipmentTypeKey));
  return units
    .map(normalizeCanonicalUnit)
    .filter((unit) => unit.id && (allowed.has(unit.type) || allowed.has(unit.category)));
}

// ---- Helpers ----
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

function toDocSafeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 200);
}

function fail(msg) {
  console.error("\n[STOP] " + msg);
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv);
  const APPLY = args.apply === true;

  const ctx = {
    sourceCompanyId: args.sourceCompanyId || "",
    sourceLocationId: args.sourceLocationId || "",
    targetCompanyId: args.targetCompanyId || "",
    targetLocationId: args.targetLocationId || "",
    restoreBatchId: args.restoreBatchId || ""
  };

  // ---- Pre-flight validation ----
  if (!ctx.restoreBatchId) fail("restoreBatchId mangler (--restoreBatchId paakraevet).");
  for (const k of ["sourceCompanyId", "sourceLocationId", "targetCompanyId", "targetLocationId"]) {
    if (!ctx[k]) fail(`${k} mangler.`);
  }
  if (ctx.targetCompanyId === ctx.sourceCompanyId) fail("targetCompanyId == sourceCompanyId — afvist.");
  if (ctx.targetLocationId === ctx.sourceLocationId) fail("targetLocationId == sourceLocationId — afvist.");
  if (!isValidOwnerKind(OWNER_KIND)) fail(`ownerKind "${OWNER_KIND}" er ikke gyldig.`);

  const ownerScopeMetadata = buildOwnerScopeMetadata(OWNER_KIND);
  if (ownerScopeMetadata.isDemoScope !== false || ownerScopeMetadata.scopeType !== "customer") {
    fail("ownerScopeMetadata for real_owner skal give isDemoScope:false + scopeType:customer. Fik: " + JSON.stringify(ownerScopeMetadata));
  }

  // ---- Firebase init ----
  if (!admin.apps.length) {
    const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: serviceAccount.project_id });
  }
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });

  console.log("==================================================");
  console.log("runCanonicalEngineRestore");
  console.log("MODE:", APPLY ? "APPLY (WRITES)" : "DRY-RUN (no writes)");
  console.log("restoreBatchId:", ctx.restoreBatchId);
  console.log("SOURCE:", ctx.sourceCompanyId, "/", ctx.sourceLocationId);
  console.log("TARGET:", ctx.targetCompanyId, "/", ctx.targetLocationId);
  console.log("ownerScopeMetadata:", JSON.stringify(ownerScopeMetadata));
  console.log("==================================================");

  // ---- Safety checks (read-only) ----
  const srcCompany = await db.collection("companies").doc(ctx.sourceCompanyId).get();
  if (!srcCompany.exists) fail("source company findes ikke.");
  const srcLocation = await db.collection("companies").doc(ctx.sourceCompanyId).collection("locations").doc(ctx.sourceLocationId).get();
  if (!srcLocation.exists) fail("source location findes ikke.");
  const tgtCompany = await db.collection("companies").doc(ctx.targetCompanyId).get();
  if (!tgtCompany.exists) fail("target company findes ikke.");
  const tgtLocation = await db.collection("companies").doc(ctx.targetCompanyId).collection("locations").doc(ctx.targetLocationId).get();
  if (!tgtLocation.exists) fail("target location findes ikke.");

  const tgtLocData = tgtLocation.data() || {};
  const tgtCompData = tgtCompany.data() || {};
  const identity = `${tgtLocData.name || ""} ${tgtLocData.displayName || ""} ${tgtCompData.name || ""} ${ctx.targetCompanyId}`.toLowerCase();
  if (!identity.includes(AROID_NAME_HINT)) fail("target identificeres ikke som Aroi-D (name/displayName/id mangler 'aroi').");

  const tgtMember = await db.collection("companies").doc(ctx.targetCompanyId).collection("members").doc(SUPAWAN_UID).get();
  if (!tgtMember.exists) fail(`target membership for Supawan (${SUPAWAN_UID}) mangler.`);

  // ---- Load SOURCE equipment (the quick-onboarding-defined units) ----
  const srcEquipmentSnap = await db.collection("equipment").where("locationId", "==", ctx.sourceLocationId).get();
  const srcEquipment = srcEquipmentSnap.docs.filter((d) => {
    const x = d.data();
    return (!x.companyId || x.companyId === ctx.sourceCompanyId || x.organizationId === ctx.sourceCompanyId) && x.active !== false;
  });
  if (srcEquipment.length === 0) fail("source equipment count er 0 — afvist (motoren kan ikke generere uden udstyr).");
  console.log("\nsource equipment active:", srcEquipment.length);

  // ---- TRIN 0: identify flat legacy templates from the discarded restore (to soft-archive) ----
  const tgtTemplatesSnap = await db.collection("task_templates").where("locationId", "==", ctx.targetLocationId).get();
  const flatToArchive = tgtTemplatesSnap.docs.filter((d) => {
    const x = d.data();
    const onTarget = x.companyId === ctx.targetCompanyId || x.organizationId === ctx.targetCompanyId;
    const isFlatOldRestore = x.restoredBy === OLD_FLAT_RESTORE_BY;
    const stillActive = x.isActive !== false && x.active !== false && x.archived !== true && x.status !== "archived";
    return onTarget && isFlatOldRestore && stillActive;
  });
  console.log("\n-- TRIN 0: flat legacy templates from discarded restore to soft-archive (NO hard delete) --");
  console.log("would soft-archive flat templates:", flatToArchive.length);

  // ---- TRIN 1: build equipment replication payloads (deterministic ids, real_owner, id==docId) ----
  const equipmentWrites = [];
  const unitsForEngine = []; // normalized units, used for DRY-RUN simulation
  for (const doc of srcEquipment) {
    const data = doc.data() || {};
    const targetDocId = toDocSafeId(`${ctx.targetLocationId}__equip__${doc.id}`);
    const payload = {
      ...data,
      id: targetDocId,                 // internal id == new doc id (engine binds via data.id || doc.id)
      companyId: ctx.targetCompanyId,
      locationId: ctx.targetLocationId,
      active: true,
      isActive: true,
      archived: false,
      ...ownerScopeMetadata,
      restoredFromCompanyId: ctx.sourceCompanyId,
      restoredFromLocationId: ctx.sourceLocationId,
      restoredFromDocId: doc.id,
      restoredAt: admin.firestore.FieldValue.serverTimestamp(),
      restoreBatchId: ctx.restoreBatchId,
      restoredBy: RESTORED_BY
    };
    if (data.organizationId !== undefined) payload.organizationId = ctx.targetCompanyId;
    equipmentWrites.push({ targetDocId, payload, sourceDocId: doc.id });
    unitsForEngine.push(normalizeCanonicalUnit({ id: targetDocId, name: data.name || data.displayName || data.equipmentName || "", type: data.type || data.equipmentType || "", category: data.category || data.type || data.equipmentType || "" }));
  }
  console.log("\n-- TRIN 1: equipment replication --");
  console.log("WOULD WRITE equipment:", equipmentWrites.length, "(deterministic ids, id==docId, real_owner)");
  equipmentWrites.slice(0, 6).forEach((w) => console.log(`   ${w.sourceDocId} -> ${w.targetDocId} [${w.payload.name || "?"}] type=${w.payload.type || w.payload.equipmentType || "?"}`));

  // ---- TRIN 2: engine ----
  console.log("\n-- TRIN 2: canonical engine (routineKeys=null) --");
  if (!APPLY) {
    // SIMULATE: mirror getRoutineTargetUnits over the just-built units (engine writes internally; not dry-run safe)
    let totalTemplates = 0, equipmentTemplates = 0, genericTemplates = 0, skippedRoutines = 0;
    const sample = [];
    for (const def of CANONICAL_ROUTINES) {
      const routineType = def.routineType;
      const targets = getRoutineTargetUnits(routineType, unitsForEngine);
      const isEquip = !!EQUIPMENT_ROUTINE_TYPES[normalizeRoutineType(routineType)];
      if (isEquip && targets.length === 0) { skippedRoutines++; continue; }
      totalTemplates += targets.length;
      if (isEquip) equipmentTemplates += targets.length; else genericTemplates += targets.length;
      for (const u of targets.slice(0, isEquip ? 99 : 1)) {
        if (sample.length < 24) {
          let title;
          try { title = buildDisplayTitle(routineType, u.id !== "default" ? u.id : "", u.name || ""); }
          catch (e) { title = routineType; }
          sample.push(`${routineType}${u.id !== "default" ? " @" + (u.name || u.id) : ""} -> "${title}"`);
        }
      }
    }
    console.log("[SIMULATION — --apply calls the real generateCanonicalTaskTemplates]");
    console.log("  canonical routine definitions scanned:", CANONICAL_ROUTINES.length);
    console.log("  WOULD GENERATE templates total:", totalTemplates, `(per-unit equipment: ${equipmentTemplates}, generic: ${genericTemplates})`);
    console.log("  equipment routines skipped (no matching units):", skippedRoutines);
    console.log("  sample (up to 24):");
    sample.forEach((s) => console.log("    -", s));
  }

  // ---- Existing target task_instances (report only, untouched) ----
  const tgtInstancesToday = await db.collection("task_instances").where("locationId", "==", ctx.targetLocationId).where("dateKey", "==", TODAY_DATEKEY).get();
  console.log(`\n-- TARGET task_instances ${TODAY_DATEKEY}: ${tgtInstancesToday.size} (UNTOUCHED) --`);

  // ---- Summary ----
  console.log("\n==================================================");
  console.log("SUMMARY");
  console.log("  source equipment active:", srcEquipment.length);
  console.log("  flat legacy templates to soft-archive:", flatToArchive.length);
  console.log("  WOULD WRITE equipment:", equipmentWrites.length);
  console.log("  TRIN 2 templates: " + (APPLY ? "(generated by real engine — see stats below)" : "(simulated above)"));
  console.log(`  target task_instances ${TODAY_DATEKEY}: ${tgtInstancesToday.size}, untouched`);

  if (!APPLY) {
    console.log("\n  NO WRITES because dry-run (pass --apply to write).");
    console.log("==================================================");
    return;
  }

  // ================= APPLY =================
  console.log("\n[APPLY] Writing...");

  async function commitInBatches(ops) {
    for (let i = 0; i < ops.length; i += MAX_BATCH) {
      const slice = ops.slice(i, i + MAX_BATCH);
      const batch = db.batch();
      for (const op of slice) batch.set(op.ref, op.data, op.merge ? { merge: true } : undefined);
      await batch.commit();
    }
  }

  // TRIN 0: soft-archive flat legacy templates
  const archivePatch = {
    active: false, isActive: false, archived: true, status: "archived",
    archivedAt: admin.firestore.FieldValue.serverTimestamp(), archivedBy: ARCHIVED_BY, restoreBatchId: ctx.restoreBatchId
  };
  await commitInBatches(flatToArchive.map((d) => ({ ref: d.ref, data: archivePatch, merge: true })));
  console.log(`[APPLY] TRIN 0: soft-archived ${flatToArchive.length} flat legacy templates.`);

  // TRIN 1: write equipment (idempotent — deterministic ids, overwrite)
  await commitInBatches(equipmentWrites.map((w) => ({ ref: db.collection("equipment").doc(w.targetDocId), data: w.payload })));
  console.log(`[APPLY] TRIN 1: wrote ${equipmentWrites.length} equipment to target.`);

  // TRIN 2: call the REAL engine (scans freshly-written equipment, routineKeys=null)
  console.log("[APPLY] TRIN 2: calling generateCanonicalTaskTemplates (routineKeys=null, units=null)...");
  const stats = await generateCanonicalTaskTemplates({
    db,
    companyId: ctx.targetCompanyId,
    locationId: ctx.targetLocationId,
    routineKeys: null,
    units: null,
    ownerScopeMetadata
  });
  console.log("[APPLY] TRIN 2 engine stats:", JSON.stringify(stats));
  console.log("==================================================");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  if (e && e.stack) console.error(e.stack);
  process.exit(1);
});
