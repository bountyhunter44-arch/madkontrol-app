/**
 * restoreAroidMasterdataLegacyToCanonical.js
 *
 * Restore MASTERDATA ONLY (equipment, task_templates, verification_templates)
 * from a legacy scope to a canonical scope. DRY-RUN by default.
 *
 * Does NOT touch: task_instances, task_entries, daily_runs, daily_reports,
 * deviations, risk_analysis, users, live_user_profiles, subscriptions,
 * checkout_sessions, Stripe. No hard deletes. Existing target masterdata is
 * only SOFT-ARCHIVED (never deleted) on --apply.
 *
 * Usage (DRY-RUN):
 *   node functions/scripts/restoreAroidMasterdataLegacyToCanonical.js \
 *     --sourceCompanyId="company_1778453641187_xxaoilz18" \
 *     --sourceLocationId="location_1778453641187_fbljxh1ym" \
 *     --targetCompanyId="onboarding_aroi-d_42405000" \
 *     --targetLocationId="onboarding_aroi-d_42405000__main" \
 *     --restoreBatchId="restore_aroi_d_2026_06_15_001"
 *
 * Apply (WRITES) — only after explicit approval, NOT run yet:
 *   ...same args... --apply
 *
 * Note: if your environment uses a corporate root CA, run with:
 *   node --use-system-ca functions/scripts/restoreAroidMasterdataLegacyToCanonical.js ...
 */

"use strict";

const path = require("path");
const admin = require("firebase-admin");

// ---- Constants ----------------------------------------------------------
const RESTORED_BY = "restoreAroidMasterdataLegacyToCanonical";
const ARCHIVED_BY = "restoreAroidMasterdataLegacyToCanonical";
const SUPAWAN_UID = "HNcGHMrzsUPqbyBcmodsxBuWuJc2";
const TODAY_DATEKEY = "2026-06-15"; // only used to REPORT untouched existing instances
const AROID_NAME_HINT = "aroi";
const MAX_BATCH = 450;

// ---- Arg parsing --------------------------------------------------------
function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    if (eq === -1) {
      args[raw.slice(2)] = true; // flag, e.g. --apply
    } else {
      args[raw.slice(2, eq)] = raw.slice(eq + 1);
    }
  }
  return args;
}

// ---- Helpers ------------------------------------------------------------
function toDocSafeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 200);
}

function isActiveMaster(d) {
  return d.isActive !== false && d.active !== false && d.archived !== true && d.status !== "archived";
}

function stableTemplateKey(t, sourceDocId) {
  const tail = String(sourceDocId || "").split("__").filter(Boolean).pop() || "tmpl";
  return toDocSafeId(t.templateKey || t.routineKey || t.canonicalRoutineType || t.routineType || tail);
}

function fail(msg) {
  console.error("\n[STOP] " + msg);
  process.exit(1);
}

function ownerMetaForTarget() {
  return {
    ownerKind: "real_owner",
    ownerLabel: "Rigtig owner",
    isDemoScope: false,
    scopeType: "customer"
  };
}

function restoredFromFields(sourceDoc, sourceData, ctx) {
  const out = {
    restoredFromCompanyId: ctx.sourceCompanyId,
    restoredFromLocationId: ctx.sourceLocationId,
    restoredFromDocId: sourceDoc.id,
    restoredAt: admin.firestore.FieldValue.serverTimestamp(),
    restoreBatchId: ctx.restoreBatchId,
    restoredBy: RESTORED_BY
  };
  if (sourceData.ownerKind !== undefined) out.restoredFromOwnerKind = sourceData.ownerKind;
  if (sourceData.ownerLabel !== undefined) out.restoredFromOwnerLabel = sourceData.ownerLabel;
  return out;
}

// ---- Main ---------------------------------------------------------------
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

  // ---- Pre-flight argument validation ----
  if (!ctx.restoreBatchId) fail("restoreBatchId mangler (--restoreBatchId paakraevet).");
  if (APPLY && !ctx.restoreBatchId) fail("--apply kraever --restoreBatchId.");
  for (const k of ["sourceCompanyId", "sourceLocationId", "targetCompanyId", "targetLocationId"]) {
    if (!ctx[k]) fail(`${k} mangler.`);
  }
  if (ctx.targetCompanyId === ctx.sourceCompanyId) fail("targetCompanyId == sourceCompanyId — afvist.");
  if (ctx.targetLocationId === ctx.sourceLocationId) fail("targetLocationId == sourceLocationId — afvist.");

  // ---- Firebase init ----
  if (!admin.apps.length) {
    const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
  }
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });

  const MODE = APPLY ? "APPLY (WRITES)" : "DRY-RUN (no writes)";
  console.log("==================================================");
  console.log("restoreAroidMasterdataLegacyToCanonical");
  console.log("MODE:", MODE);
  console.log("restoreBatchId:", ctx.restoreBatchId);
  console.log("SOURCE:", ctx.sourceCompanyId, "/", ctx.sourceLocationId);
  console.log("TARGET:", ctx.targetCompanyId, "/", ctx.targetLocationId);
  console.log("==================================================");

  // ---- Safety checks (read-only) ----
  const srcCompany = await db.collection("companies").doc(ctx.sourceCompanyId).get();
  if (!srcCompany.exists) fail("source company findes ikke.");
  const srcLocation = await db.collection("companies").doc(ctx.sourceCompanyId)
    .collection("locations").doc(ctx.sourceLocationId).get();
  if (!srcLocation.exists) fail("source location findes ikke.");

  const tgtCompany = await db.collection("companies").doc(ctx.targetCompanyId).get();
  if (!tgtCompany.exists) fail("target company findes ikke.");
  const tgtLocation = await db.collection("companies").doc(ctx.targetCompanyId)
    .collection("locations").doc(ctx.targetLocationId).get();
  if (!tgtLocation.exists) fail("target location findes ikke.");

  // Aroi-D identity check (target)
  const tgtLocData = tgtLocation.data() || {};
  const tgtCompData = tgtCompany.data() || {};
  const identity = `${tgtLocData.name || ""} ${tgtLocData.displayName || ""} ${tgtCompData.name || ""} ${ctx.targetCompanyId}`.toLowerCase();
  if (!identity.includes(AROID_NAME_HINT)) {
    fail("target company/location identificeres ikke som Aroi-D (name/displayName/id indeholder ikke 'aroi').");
  }

  // Supawan membership on target
  const tgtMember = await db.collection("companies").doc(ctx.targetCompanyId)
    .collection("members").doc(SUPAWAN_UID).get();
  if (!tgtMember.exists) fail(`target membership for Supawan (${SUPAWAN_UID}) mangler.`);

  // ---- Load SOURCE masterdata ----
  const srcEquipmentSnap = await db.collection("equipment").where("locationId", "==", ctx.sourceLocationId).get();
  const srcEquipment = srcEquipmentSnap.docs
    .filter((d) => {
      const x = d.data();
      return (!x.companyId || x.companyId === ctx.sourceCompanyId || x.organizationId === ctx.sourceCompanyId) && x.active !== false;
    });

  const srcTemplatesSnap = await db.collection("task_templates").where("locationId", "==", ctx.sourceLocationId).get();
  const srcTemplates = srcTemplatesSnap.docs
    .filter((d) => {
      const x = d.data();
      return (x.companyId === ctx.sourceCompanyId || x.organizationId === ctx.sourceCompanyId) && isActiveMaster(x);
    });

  const srcVerifSnap = await db.collection("verification_templates").where("locationId", "==", ctx.sourceLocationId).get();
  const srcVerif = srcVerifSnap.docs
    .filter((d) => {
      const x = d.data();
      return (x.companyId === ctx.sourceCompanyId || x.organizationId === ctx.sourceCompanyId) && isActiveMaster(x);
    });

  if (srcTemplates.length === 0) fail("source task_templates active count er 0 — afvist (intet at restore).");

  console.log("\n-- SOURCE masterdata --");
  console.log("source equipment active:", srcEquipment.length);
  console.log("source task_templates active:", srcTemplates.length);
  console.log("source verification_templates active:", srcVerif.length);

  // ---- Scan TARGET existing masterdata (to archive) ----
  async function scanTargetActive(col) {
    const snap = await db.collection(col).where("locationId", "==", ctx.targetLocationId).get();
    return snap.docs.filter((d) => {
      const x = d.data();
      return (x.companyId === ctx.targetCompanyId || x.organizationId === ctx.targetCompanyId) && isActiveMaster(x);
    });
  }
  const tgtTemplatesActive = await scanTargetActive("task_templates");
  const tgtVerifActive = await scanTargetActive("verification_templates");
  const tgtEquipmentActive = (await db.collection("equipment").where("locationId", "==", ctx.targetLocationId).get())
    .docs.filter((d) => {
      const x = d.data();
      return (!x.companyId || x.companyId === ctx.targetCompanyId || x.organizationId === ctx.targetCompanyId) && x.active !== false;
    });

  console.log("\n-- TARGET existing masterdata to soft-archive (NO hard delete) --");
  console.log("target task_templates to archive:", tgtTemplatesActive.length);
  console.log("target equipment to archive:", tgtEquipmentActive.length);
  console.log("target verification_templates to archive:", tgtVerifActive.length);

  // ---- Report (untouched) existing target task_instances for TODAY ----
  const tgtInstancesToday = await db.collection("task_instances")
    .where("locationId", "==", ctx.targetLocationId)
    .where("dateKey", "==", TODAY_DATEKEY).get();
  console.log(`\n-- TARGET existing task_instances ${TODAY_DATEKEY}: ${tgtInstancesToday.size} (UNTOUCHED — runtime/historical data, never modified) --`);

  // ---- Build equipment restore plan + equipmentIdMap ----
  const equipmentIdMap = new Map();
  const equipmentWrites = [];
  for (const doc of srcEquipment) {
    const data = doc.data() || {};
    const targetDocId = toDocSafeId(`${ctx.targetLocationId}__equip__${doc.id}`);
    equipmentIdMap.set(doc.id, targetDocId);

    const payload = {
      ...data,
      companyId: ctx.targetCompanyId,
      locationId: ctx.targetLocationId,
      active: true,
      isActive: true,
      archived: false,
      ...ownerMetaForTarget(),
      ...restoredFromFields(doc, data, ctx)
    };
    if (data.organizationId !== undefined) payload.organizationId = ctx.targetCompanyId;
    equipmentWrites.push({ targetDocId, payload, sourceDocId: doc.id });
  }

  // ---- Build task_template restore plan ----
  const templateWrites = [];
  let templatesWithEquipRewrite = 0;
  let templatesEquipUnmapped = 0;
  for (const doc of srcTemplates) {
    const data = doc.data() || {};
    const key = stableTemplateKey(data, doc.id);
    const targetDocId = toDocSafeId(`${ctx.targetCompanyId}__${ctx.targetLocationId}__canonical__${key}`);

    let equipmentId = data.equipmentId || "";
    if (equipmentId) {
      if (equipmentIdMap.has(equipmentId)) {
        equipmentId = equipmentIdMap.get(equipmentId);
        templatesWithEquipRewrite += 1;
      } else {
        templatesEquipUnmapped += 1; // referenced equipment not in active source set; leave as-is
      }
    }

    const payload = {
      ...data,
      companyId: ctx.targetCompanyId,
      locationId: ctx.targetLocationId,
      active: true,
      isActive: true,
      archived: false,
      status: "active",
      ...ownerMetaForTarget(),
      ...restoredFromFields(doc, data, ctx)
    };
    if (data.organizationId !== undefined) payload.organizationId = ctx.targetCompanyId;
    if (data.equipmentId !== undefined) payload.equipmentId = equipmentId;
    // scheduleConfig.recurrenceMode (incl. "interval_days") preserved as-is; backend alias-fix handles it.

    templateWrites.push({ targetDocId, payload, sourceDocId: doc.id, templateKey: key });
  }

  // ---- Build verification_template restore plan ----
  const verifWrites = [];
  for (const doc of srcVerif) {
    const data = doc.data() || {};
    const key = stableTemplateKey(data, doc.id);
    const targetDocId = toDocSafeId(`${ctx.targetCompanyId}__${ctx.targetLocationId}__canonical_verif__${key}`);
    const payload = {
      ...data,
      companyId: ctx.targetCompanyId,
      locationId: ctx.targetLocationId,
      active: true,
      isActive: true,
      archived: false,
      status: "active",
      ...ownerMetaForTarget(),
      ...restoredFromFields(doc, data, ctx)
    };
    if (data.organizationId !== undefined) payload.organizationId = ctx.targetCompanyId;
    verifWrites.push({ targetDocId, payload, sourceDocId: doc.id, templateKey: key });
  }

  // ---- Idempotency pre-check (read existing target docs) ----
  async function idempotencyNote(col, writes) {
    let sameRestore = 0, conflict = 0, fresh = 0;
    for (const w of writes) {
      const ex = await db.collection(col).doc(w.targetDocId).get();
      if (!ex.exists) { fresh += 1; continue; }
      const ed = ex.data() || {};
      if (ed.restoredFromDocId === w.sourceDocId || ed.restoreBatchId === ctx.restoreBatchId) sameRestore += 1;
      else conflict += 1;
    }
    return { sameRestore, conflict, fresh };
  }
  const eqIdem = await idempotencyNote("equipment", equipmentWrites);
  const tmplIdem = await idempotencyNote("task_templates", templateWrites);

  // ---- Dry-run output ----
  console.log("\n-- EQUIPMENT restore plan --");
  console.log("WOULD WRITE equipment:", equipmentWrites.length,
    `(fresh=${eqIdem.fresh}, would-overwrite-same-restore=${eqIdem.sameRestore}, conflict=${eqIdem.conflict})`);
  console.log("equipmentIdMap (sample up to 8):");
  equipmentWrites.slice(0, 8).forEach((w) =>
    console.log(`   ${w.sourceDocId}  ->  ${w.targetDocId}  [${w.payload.name || w.payload.displayName || "?"}]`));
  if (equipmentWrites.length > 8) console.log(`   ... (+${equipmentWrites.length - 8} more)`);

  console.log("\n-- TASK_TEMPLATES restore plan --");
  console.log("WOULD WRITE task_templates:", templateWrites.length,
    `(fresh=${tmplIdem.fresh}, would-overwrite-same-restore=${tmplIdem.sameRestore}, conflict=${tmplIdem.conflict})`);
  console.log(`equipmentId rewrites via map: ${templatesWithEquipRewrite}, unmapped equipmentId (left as-is): ${templatesEquipUnmapped}`);
  console.log("sample target IDs + templateKeys (up to 10):");
  templateWrites.slice(0, 10).forEach((w) =>
    console.log(`   ${w.templateKey.padEnd(26)} -> ${w.targetDocId}`));

  console.log("\n-- VERIFICATION_TEMPLATES restore plan --");
  console.log("WOULD WRITE verification_templates:", verifWrites.length);

  // ---- Summary ----
  console.log("\n==================================================");
  console.log("SUMMARY");
  console.log("  source equipment active:", srcEquipment.length);
  console.log("  source task_templates active:", srcTemplates.length);
  console.log("  source verification_templates active:", srcVerif.length);
  console.log("  target equipment to archive:", tgtEquipmentActive.length);
  console.log("  target task_templates to archive:", tgtTemplatesActive.length);
  console.log("  target verification_templates to archive:", tgtVerifActive.length);
  console.log(`  target existing task_instances ${TODAY_DATEKEY}: ${tgtInstancesToday.size}, untouched`);
  console.log("  WOULD WRITE equipment:", equipmentWrites.length);
  console.log("  WOULD WRITE task_templates:", templateWrites.length);
  console.log("  WOULD WRITE verification_templates:", verifWrites.length);

  if (!APPLY) {
    console.log("\n  NO WRITES because dry-run (pass --apply to write).");
    console.log("==================================================");
    return;
  }

  // ---- APPLY (writes) — guarded; only runs with --apply ----
  console.log("\n[APPLY] Writing... (soft-archive existing, then restore)");

  async function commitInBatches(ops) {
    for (let i = 0; i < ops.length; i += MAX_BATCH) {
      const slice = ops.slice(i, i + MAX_BATCH);
      const batch = db.batch();
      for (const op of slice) batch.set(op.ref, op.data, op.merge ? { merge: true } : undefined);
      await batch.commit();
    }
  }

  const archivePatch = {
    active: false,
    isActive: false,
    archived: true,
    status: "archived",
    archivedAt: admin.firestore.FieldValue.serverTimestamp(),
    archivedBy: ARCHIVED_BY,
    restoreBatchId: ctx.restoreBatchId
  };

  const archiveOps = [];
  for (const d of tgtTemplatesActive) archiveOps.push({ ref: d.ref, data: archivePatch, merge: true });
  for (const d of tgtVerifActive) archiveOps.push({ ref: d.ref, data: archivePatch, merge: true });
  for (const d of tgtEquipmentActive) archiveOps.push({ ref: d.ref, data: archivePatch, merge: true });
  await commitInBatches(archiveOps);
  console.log(`[APPLY] soft-archived ${archiveOps.length} existing target master docs.`);

  const writeOps = [];
  for (const w of equipmentWrites) writeOps.push({ ref: db.collection("equipment").doc(w.targetDocId), data: w.payload });
  for (const w of templateWrites) writeOps.push({ ref: db.collection("task_templates").doc(w.targetDocId), data: w.payload });
  for (const w of verifWrites) writeOps.push({ ref: db.collection("verification_templates").doc(w.targetDocId), data: w.payload });
  await commitInBatches(writeOps);
  console.log(`[APPLY] wrote ${equipmentWrites.length} equipment + ${templateWrites.length} task_templates + ${verifWrites.length} verification_templates.`);
  console.log("==================================================");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
