/**
 * patchTemperatureMeasurementFields.js
 *
 * Restores the manual temperature-entry field on temperature routine cards.
 *
 * Root cause: the canonical engine's deriveControlType() sets controlType="temperature",
 * but rutiner.html getTaskType() only treats a card as a measurement (number input) when
 * controlType==="temperature_check" OR requiresMeasurement===true OR measurementUnit is set,
 * etc. So temperature cards render as a checkbox instead of a °C input.
 *
 * SAFE additive fix (does NOT touch controlType -> no resolveTemplateSchedule side effects):
 *   requiresMeasurement: true
 *   measurementUnit: "°C"
 *
 * Targets ACTIVE temperature templates on the target location only.
 * DRY-RUN by default. Pass --apply to write. No hard delete.
 *
 * Usage (DRY-RUN):
 *   node --use-system-ca functions/scripts/patchTemperatureMeasurementFields.js \
 *     --targetCompanyId="onboarding_aroi-d_42405000" \
 *     --targetLocationId="onboarding_aroi-d_42405000__main"
 */

"use strict";

const path = require("path");
const admin = require("firebase-admin");

const PATCHED_BY = "patchTemperatureMeasurementFields";
const AROID_NAME_HINT = "aroi";

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

function isTemperatureTemplate(t) {
  const ct = String(t.controlType || "").toLowerCase();
  const key = String(t.templateKey || t.routineType || "").toLowerCase();
  return ct === "temperature" || /(_temperatur|temperatur_|_temperature|temperature_)/.test(key);
}

async function main() {
  const args = parseArgs(process.argv);
  const APPLY = args.apply === true;
  const targetCompanyId = args.targetCompanyId || "";
  const targetLocationId = args.targetLocationId || "";
  if (!targetCompanyId || !targetLocationId) fail("targetCompanyId og targetLocationId paakraevet.");

  if (!admin.apps.length) {
    const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: serviceAccount.project_id });
  }
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });

  console.log("==================================================");
  console.log("patchTemperatureMeasurementFields");
  console.log("MODE:", APPLY ? "APPLY (WRITES)" : "DRY-RUN (no writes)");
  console.log("TARGET:", targetCompanyId, "/", targetLocationId);
  console.log("==================================================");

  // Aroi-D guard
  const tgtCompany = await db.collection("companies").doc(targetCompanyId).get();
  const tgtLocation = await db.collection("companies").doc(targetCompanyId).collection("locations").doc(targetLocationId).get();
  if (!tgtCompany.exists || !tgtLocation.exists) fail("target company/location findes ikke.");
  const identity = `${(tgtLocation.data() || {}).name || ""} ${(tgtCompany.data() || {}).name || ""} ${targetCompanyId}`.toLowerCase();
  if (!identity.includes(AROID_NAME_HINT)) fail("target identificeres ikke som Aroi-D.");

  const snap = await db.collection("task_templates").where("locationId", "==", targetLocationId).get();
  const active = snap.docs.map((d) => ({ ref: d.ref, id: d.id, ...d.data() }))
    .filter((t) => (t.companyId === targetCompanyId || t.organizationId === targetCompanyId)
      && t.isActive !== false && t.active !== false && t.archived !== true && t.status !== "archived");

  const tempTemplates = active.filter(isTemperatureTemplate);

  // Only patch those missing the measurement signal
  const needsPatch = tempTemplates.filter((t) => t.requiresMeasurement !== true || !String(t.measurementUnit || "").trim());

  console.log("\nActive temperature templates:", tempTemplates.length);
  console.log("Needing measurement-field patch:", needsPatch.length);
  console.log("\nWOULD PATCH (requiresMeasurement:true, measurementUnit:\"°C\"):");
  needsPatch.forEach((t) => {
    const limit = (t.risk && (t.risk.criticalLimit || t.risk.critical_limit)) || t.acceptCriteria || "";
    console.log("  + " + (t.equipmentName ? t.title : (t.templateKey || t.routineType))
      + "   [grænse-tekst: \"" + String(limit).slice(0, 60) + "\"]");
  });

  // Sanity: list temperature templates already OK
  const alreadyOk = tempTemplates.filter((t) => !needsPatch.includes(t));
  if (alreadyOk.length) console.log("\nAlready measurement-enabled (skipped):", alreadyOk.length);

  if (!APPLY) {
    console.log("\n  NOTE: This patch only makes the manual °C entry field APPEAR.");
    console.log("  Structured min/max deviation limits are NOT set here (limits currently live as TEXT in risk.criticalLimit).");
    console.log("  NO WRITES because dry-run (pass --apply to write).");
    console.log("==================================================");
    return;
  }

  const patch = {
    requiresMeasurement: true,
    measurementUnit: "°C",
    measurementPatchedAt: admin.firestore.FieldValue.serverTimestamp(),
    measurementPatchedBy: PATCHED_BY
  };
  for (let i = 0; i < needsPatch.length; i += 450) {
    const batch = db.batch();
    needsPatch.slice(i, i + 450).forEach((t) => batch.set(t.ref, patch, { merge: true }));
    await batch.commit();
  }
  console.log(`\n[APPLY] patched ${needsPatch.length} temperature templates (requiresMeasurement + measurementUnit).`);
  console.log("==================================================");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
