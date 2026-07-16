"use strict";

/**
 * moduleProvisioners.js
 *
 * Central onboarding provisioning. `selectedModules` drive provisioning through MODULE_PROVISIONERS
 * instead of scattered if-statements. Each provisioner is idempotent and uses deterministic doc IDs
 * (merge writes) so re-running onboarding never creates duplicates.
 *
 * Dependencies (db, FieldValue, canonical engine functions) are INJECTED via ctx so this module has
 * no circular dependency on functions/index.js.
 */

/**
 * Egenkontrol provisioning — same behavior as the original inline block in
 * createQuickOnboardingAccount, just encapsulated:
 *   1) equipment records (deterministic ids), 2) onboarding_answers,
 *   3) task_templates (filtered by routineKeys from the setup), 4) today's task_instances.
 * (risk_analysis/current + verification_templates remain handled by the checkout/risk pipeline.)
 */
async function provisionEgenkontrolModule(ctx) {
  const {
    db, FieldValue, companyId, locationId, userId, industry,
    setup: rawSetup, ownerScopeMetadata = {},
    generateCanonicalTaskTemplates, startDayForLocationCanonical
  } = ctx;

  const {
    normalizeQuickOnboardingSetup,
    resolveCanonicalRoutineKeysFromSetup,
    buildEquipmentFromSetup
  } = require("../../js/setupToCanonicalRoutines");

  // Normalize setup from the module payload (moduleSetup.egenkontrol or legacy setup).
  const setup = normalizeQuickOnboardingSetup(rawSetup || { industry });

  // STRICT: only routines selected by the setup are generated.
  const routineKeys = resolveCanonicalRoutineKeysFromSetup(setup);

  // Equipment is the runtime source of truth. Deterministic unit ids → "Køleskab 1", "Køleskab 2"...
  const equipmentUnits = buildEquipmentFromSetup(setup, { companyId, locationId, userId })
    .map((unit) => ({ ...unit, ...ownerScopeMetadata }));

  for (const unit of equipmentUnits) {
    await db.collection("equipment").doc(unit.id).set(unit, { merge: true });
  }

  const equipmentCounts = equipmentUnits.reduce((acc, unit) => {
    const type = String(unit.type || unit.equipmentType || "").trim();
    if (type) acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  await db.collection("onboarding_answers").doc(`${companyId}__${locationId}__onboarding`).set({
    companyId,
    organizationId: companyId,
    locationId,
    ...ownerScopeMetadata,
    equipmentCounts,
    quickOnboardingSetup: setup,
    source: "quick_onboarding",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  // task_templates reference equipmentId/equipmentType/equipmentName via the canonical engine + units.
  const templatesResult = await generateCanonicalTaskTemplates({
    db, companyId, locationId, routineKeys, units: equipmentUnits, ownerScopeMetadata
  });

  const todayDateKey = new Date().toISOString().slice(0, 10);
  const instancesResult = await startDayForLocationCanonical({
    db, companyId, locationId, dateKey: todayDateKey, createdBy: userId, routineKeys, ownerScopeMetadata
  });

  return {
    module: "egenkontrol",
    equipmentCount: equipmentUnits.length,
    templatesCount: (templatesResult.created || 0) + (templatesResult.updated || 0),
    instancesCount: instancesResult.instancesCreated || 0,
    routineKeys
  };
}

// Registry-ready stubs: module access is granted by the caller; no runtime data is built yet.
// They intentionally do NOT over-build collections that don't exist.
async function provisionPosModule() { return { module: "pos", skipped: true, reason: "no onboarding setup yet" }; }
async function provisionLagerkontrolModule() { return { module: "lagerkontrol", skipped: true, reason: "no onboarding setup yet" }; }
async function provisionKoerselskontrolModule() { return { module: "koerselskontrol", skipped: true, reason: "no onboarding setup yet" }; }
async function provisionSeoModule() { return { module: "seo", skipped: true, reason: "no onboarding setup yet" }; }

const MODULE_PROVISIONERS = {
  egenkontrol: provisionEgenkontrolModule,
  pos: provisionPosModule,
  lagerkontrol: provisionLagerkontrolModule,
  koerselskontrol: provisionKoerselskontrolModule,
  seo: provisionSeoModule
};

/**
 * Run provisioners for the selected modules. Per-module errors are captured (never thrown) so one
 * module's failure cannot abort account creation — mirrors the original "non-critical" behavior.
 */
async function runModuleProvisioners(selectedModules = [], ctx = {}) {
  const results = {};
  for (const moduleId of selectedModules) {
    const fn = MODULE_PROVISIONERS[moduleId];
    if (!fn) { results[moduleId] = { module: moduleId, skipped: true, reason: "no provisioner registered" }; continue; }
    try {
      results[moduleId] = await fn(ctx);
    } catch (err) {
      results[moduleId] = { module: moduleId, error: err && err.message ? err.message : String(err) };
    }
  }
  return results;
}

module.exports = {
  MODULE_PROVISIONERS,
  runModuleProvisioners,
  provisionEgenkontrolModule
};
