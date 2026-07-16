/**
 * cleanupCanonicalDuplicates.js
 *
 * Removes the duplicate routine cards on the canonical location caused by leftovers
 * from the discarded flat restore:
 *
 *   PART A (root cause of template-vs-risk duplicates):
 *     The re-activated flat templates carry a STALE templateId/taskId pointing to the
 *     legacy scope (company_1778453641187_xxaoilz18 / location_1778453641187_fbljxh1ym).
 *     routineCardsResolver.parseScopedRoutineParts() reads templateId and derives a phantom
 *     equipmentKey from the legacy location -> the card no longer dedupes with the matching
 *     risk_analysis card. Fix: rewrite stale scoped-id fields to the template's own (target)
 *     doc id, so the dedup key becomes clean and the card merges with the risk card.
 *
 *   PART B (stray instances):
 *     3 generic pre-restore task_instances (no equipmentId) for the selected date duplicate
 *     the proper per-unit / template cards. Soft-archive them (NO hard delete).
 *
 * DRY-RUN by default. Pass --apply to write. No hard delete.
 *
 * Usage (DRY-RUN):
 *   node --use-system-ca functions/scripts/cleanupCanonicalDuplicates.js \
 *     --targetCompanyId="onboarding_aroi-d_42405000" \
 *     --targetLocationId="onboarding_aroi-d_42405000__main" \
 *     --dateKey="2026-06-15"
 */

"use strict";

const path = require("path");
const admin = require("firebase-admin");

const AROID_NAME_HINT = "aroi";
const PATCHED_BY = "cleanupCanonicalDuplicates";
const LEGACY_TOKENS = ["company_1778453641187_xxaoilz18", "location_1778453641187_fbljxh1ym"];
const SCOPED_ID_FIELDS = ["templateId", "taskId", "taskInstanceId", "instanceId"];

// Equipment routine types: a GENERIC (no-equipment) instance of these is a stray duplicate,
// because the proper card is per-unit. Non-equipment routines keep their generic instance.
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
function fail(m) { console.error("\n[STOP] " + m); process.exit(1); }
const hasLegacy = (v) => typeof v === "string" && LEGACY_TOKENS.some((t) => v.includes(t));

async function main() {
  const args = parseArgs(process.argv);
  const APPLY = args.apply === true;
  const targetCompanyId = args.targetCompanyId || "";
  const targetLocationId = args.targetLocationId || "";
  const dateKey = args.dateKey || "2026-06-15";
  if (!targetCompanyId || !targetLocationId) fail("targetCompanyId og targetLocationId paakraevet.");

  if (!admin.apps.length) {
    const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: serviceAccount.project_id });
  }
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });

  console.log("==================================================");
  console.log("cleanupCanonicalDuplicates");
  console.log("MODE:", APPLY ? "APPLY (WRITES)" : "DRY-RUN (no writes)");
  console.log("TARGET:", targetCompanyId, "/", targetLocationId, "| dateKey:", dateKey);
  console.log("==================================================");

  // Aroi-D guard
  const tgtCompany = await db.collection("companies").doc(targetCompanyId).get();
  const tgtLocation = await db.collection("companies").doc(targetCompanyId).collection("locations").doc(targetLocationId).get();
  if (!tgtCompany.exists || !tgtLocation.exists) fail("target company/location findes ikke.");
  const identity = `${(tgtLocation.data() || {}).name || ""} ${(tgtCompany.data() || {}).name || ""} ${targetCompanyId}`.toLowerCase();
  if (!identity.includes(AROID_NAME_HINT)) fail("target identificeres ikke som Aroi-D.");

  // ---- PART A: stale scoped-id fields on ACTIVE templates ----
  const tplSnap = await db.collection("task_templates").where("locationId", "==", targetLocationId).get();
  const activeTemplates = tplSnap.docs
    .map((d) => ({ ref: d.ref, id: d.id, data: d.data() }))
    .filter((t) => (t.data.companyId === targetCompanyId || t.data.organizationId === targetCompanyId)
      && t.data.isActive !== false && t.data.active !== false && t.data.archived !== true && t.data.status !== "archived");

  const templateFixes = [];
  for (const t of activeTemplates) {
    const patch = {};
    for (const f of SCOPED_ID_FIELDS) {
      if (hasLegacy(t.data[f])) patch[f] = t.id; // rewrite stale legacy-scoped id -> own target doc id
    }
    if (Object.keys(patch).length) templateFixes.push({ ref: t.ref, id: t.id, patch, routineType: t.data.routineType || t.data.templateKey });
  }

  console.log("\n-- PART A: active templates with stale legacy scoped-id fields --");
  console.log("WOULD FIX templates:", templateFixes.length);
  templateFixes.forEach((f) => console.log("   ~ " + (f.routineType || f.id) + "  fields: " + Object.keys(f.patch).join(", ")));

  // ---- PART B: stray generic task_instances for the date (no equipmentId) ----
  const instSnap = await db.collection("task_instances")
    .where("locationId", "==", targetLocationId).where("dateKey", "==", dateKey).get();
  const allGeneric = instSnap.docs
    .map((d) => ({ ref: d.ref, id: d.id, data: d.data() }))
    .filter((i) => !(i.data.equipmentId && i.data.equipmentId !== "")); // generic = no equipment binding
  // Only EQUIPMENT-routine generic instances are strays (superseded by per-unit cards).
  // Non-equipment generic instances are legitimate and kept.
  const strayInstances = allGeneric.filter((i) => EQUIPMENT_ROUTINE_TYPES.has(String(i.data.routineType || i.data.templateKey || "").toLowerCase()));
  const keptGeneric = allGeneric.filter((i) => !strayInstances.includes(i));

  console.log("\n-- PART B: stray EQUIPMENT-routine generic task_instances for", dateKey, "(superseded by per-unit) --");
  console.log("WOULD SOFT-ARCHIVE instances:", strayInstances.length);
  strayInstances.forEach((i) => console.log("   - " + (i.data.title || i.data.routineType || i.id) + "  status=" + (i.data.status || "")));
  console.log("KEPT (legitimate non-equipment generic instances):", keptGeneric.length);
  keptGeneric.forEach((i) => console.log("   = " + (i.data.title || i.data.routineType || i.id) + "  status=" + (i.data.status || "")));

  if (!APPLY) {
    console.log("\n  NO WRITES because dry-run (pass --apply to write).");
    console.log("==================================================");
    return;
  }

  // APPLY
  for (let i = 0; i < templateFixes.length; i += 450) {
    const batch = db.batch();
    templateFixes.slice(i, i + 450).forEach((f) => batch.set(f.ref, {
      ...f.patch, scopedIdNormalizedAt: admin.firestore.FieldValue.serverTimestamp(), scopedIdNormalizedBy: PATCHED_BY
    }, { merge: true }));
    await batch.commit();
  }
  console.log(`\n[APPLY] PART A: normalized scoped-id fields on ${templateFixes.length} templates.`);

  const archivePatch = {
    active: false, isActive: false, archived: true, status: "archived",
    archivedAt: admin.firestore.FieldValue.serverTimestamp(), archivedBy: PATCHED_BY,
    archiveReason: "stray_generic_instance_superseded_by_canonical"
  };
  for (let i = 0; i < strayInstances.length; i += 450) {
    const batch = db.batch();
    strayInstances.slice(i, i + 450).forEach((x) => batch.set(x.ref, archivePatch, { merge: true }));
    await batch.commit();
  }
  console.log(`[APPLY] PART B: soft-archived ${strayInstances.length} stray generic instances.`);
  console.log("==================================================");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
