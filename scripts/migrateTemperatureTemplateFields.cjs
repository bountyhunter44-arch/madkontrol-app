/**
 * migrateTemperatureTemplateFields.cjs
 *
 * Tilføjer targetTemperature, thresholds, defaultValues, formDefinition
 * og displayHints til eksisterende temperature_check task_templates.
 *
 * Overskriver KUN felter der mangler eller er tomme ({}).
 * Udfylder ikke equipmentType (allerede migreret af migrateTemperatureTemplates.cjs).
 *
 * DRY_RUN = true   → vis hvad der ville ske, skriv ingenting
 * DRY_RUN = false  → skriv ændringer til Firestore
 */

"use strict";

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ─── KONFIGURATION ───────────────────────────────────────────────────────────
const DRY_RUN = false;
// ─────────────────────────────────────────────────────────────────────────────

// Feltprofiler per equipmentType (og per doc-id inference som fallback)
const TEMPERATURE_PROFILES = {
  fridge: {
    targetTemperature: 5.0,
    thresholds: { mode: "max", value: 5.0, unit: "°C" },
    defaultValues: { measuredTemperature: 5.0, status: "ok", note: "", measurementSource: "default" },
    formDefinition: {
      formType: "temperature_check",
      fields: [
        { key: "measuredTemperature", type: "number",   label: "Målt temperatur", unit: "°C", required: true, decimals: 1 },
        { key: "status",             type: "select",   label: "Status",          required: true, options: [{ value: "ok", label: "OK" }, { value: "deviation", label: "Afvigelse" }] },
        { key: "note",               type: "textarea", label: "Bemærkning",      required: false, maxLength: 500 }
      ]
    },
    displayHints: {
      thresholdText: "Maks 5 °C",
      helpText: "Registrér den målte temperatur for denne enhed."
    }
  },
  freezer: {
    targetTemperature: -18.0,
    thresholds: { mode: "max", value: -18.0, unit: "°C" },
    defaultValues: { measuredTemperature: -18.0, status: "ok", note: "", measurementSource: "default" },
    formDefinition: {
      formType: "temperature_check",
      fields: [
        { key: "measuredTemperature", type: "number",   label: "Målt temperatur", unit: "°C", required: true, decimals: 1 },
        { key: "status",             type: "select",   label: "Status",          required: true, options: [{ value: "ok", label: "OK" }, { value: "deviation", label: "Afvigelse" }] },
        { key: "note",               type: "textarea", label: "Bemærkning",      required: false, maxLength: 500 }
      ]
    },
    displayHints: {
      thresholdText: "Maks -18 °C",
      helpText: "Registrér den målte temperatur for denne enhed."
    }
  },
  walk_in_cooler: {
    targetTemperature: 4.0,
    thresholds: { mode: "max", value: 4.0, unit: "°C" },
    defaultValues: { measuredTemperature: 4.0, status: "ok", note: "", measurementSource: "default" },
    formDefinition: {
      formType: "temperature_check",
      fields: [
        { key: "measuredTemperature", type: "number",   label: "Målt temperatur", unit: "°C", required: true, decimals: 1 },
        { key: "status",             type: "select",   label: "Status",          required: true, options: [{ value: "ok", label: "OK" }, { value: "deviation", label: "Afvigelse" }] },
        { key: "note",               type: "textarea", label: "Bemærkning",      required: false, maxLength: 500 }
      ]
    },
    displayHints: { thresholdText: "Maks 4 °C", helpText: "Registrér den målte temperatur for denne enhed." }
  },
  walk_in_freezer: {
    targetTemperature: -18.0,
    thresholds: { mode: "max", value: -18.0, unit: "°C" },
    defaultValues: { measuredTemperature: -18.0, status: "ok", note: "", measurementSource: "default" },
    formDefinition: {
      formType: "temperature_check",
      fields: [
        { key: "measuredTemperature", type: "number",   label: "Målt temperatur", unit: "°C", required: true, decimals: 1 },
        { key: "status",             type: "select",   label: "Status",          required: true, options: [{ value: "ok", label: "OK" }, { value: "deviation", label: "Afvigelse" }] },
        { key: "note",               type: "textarea", label: "Bemærkning",      required: false, maxLength: 500 }
      ]
    },
    displayHints: { thresholdText: "Maks -18 °C", helpText: "Registrér den målte temperatur for denne enhed." }
  },
  blast_chiller: {
    targetTemperature: -18.0,
    thresholds: { mode: "max", value: -18.0, unit: "°C" },
    defaultValues: { measuredTemperature: -18.0, status: "ok", note: "", measurementSource: "default" },
    formDefinition: {
      formType: "temperature_check",
      fields: [
        { key: "measuredTemperature", type: "number",   label: "Målt temperatur", unit: "°C", required: true, decimals: 1 },
        { key: "status",             type: "select",   label: "Status",          required: true, options: [{ value: "ok", label: "OK" }, { value: "deviation", label: "Afvigelse" }] },
        { key: "note",               type: "textarea", label: "Bemærkning",      required: false, maxLength: 500 }
      ]
    },
    displayHints: { thresholdText: "Maks -18 °C", helpText: "Registrér den målte temperatur for denne enhed." }
  },
  display_fridge: {
    targetTemperature: 5.0,
    thresholds: { mode: "max", value: 5.0, unit: "°C" },
    defaultValues: { measuredTemperature: 5.0, status: "ok", note: "", measurementSource: "default" },
    formDefinition: {
      formType: "temperature_check",
      fields: [
        { key: "measuredTemperature", type: "number",   label: "Målt temperatur", unit: "°C", required: true, decimals: 1 },
        { key: "status",             type: "select",   label: "Status",          required: true, options: [{ value: "ok", label: "OK" }, { value: "deviation", label: "Afvigelse" }] },
        { key: "note",               type: "textarea", label: "Bemærkning",      required: false, maxLength: 500 }
      ]
    },
    displayHints: { thresholdText: "Maks 5 °C", helpText: "Registrér den målte temperatur for denne enhed." }
  },
  warming_cabinet: {
    targetTemperature: 65.0,
    thresholds: { mode: "min", value: 65.0, unit: "°C" },
    defaultValues: { measuredTemperature: 65.0, status: "ok", note: "", measurementSource: "default" },
    formDefinition: {
      formType: "temperature_check",
      fields: [
        { key: "measuredTemperature", type: "number",   label: "Målt temperatur", unit: "°C", required: true, decimals: 1 },
        { key: "status",             type: "select",   label: "Status",          required: true, options: [{ value: "ok", label: "OK" }, { value: "deviation", label: "Afvigelse" }] },
        { key: "note",               type: "textarea", label: "Bemærkning",      required: false, maxLength: 500 }
      ]
    },
    displayHints: { thresholdText: "Min 65 °C", helpText: "Registrér den målte temperatur for denne enhed." }
  },
  softice_machine: {
    targetTemperature: -5.0,
    thresholds: { mode: "max", value: -5.0, unit: "°C" },
    defaultValues: { measuredTemperature: -5.0, status: "ok", note: "", measurementSource: "default" },
    formDefinition: {
      formType: "temperature_check",
      fields: [
        { key: "measuredTemperature", type: "number",   label: "Målt temperatur", unit: "°C", required: true, decimals: 1 },
        { key: "status",             type: "select",   label: "Status",          required: true, options: [{ value: "ok", label: "OK" }, { value: "deviation", label: "Afvigelse" }] },
        { key: "note",               type: "textarea", label: "Bemærkning",      required: false, maxLength: 500 }
      ]
    },
    displayHints: { thresholdText: "Maks -5 °C", helpText: "Registrér den målte temperatur for denne enhed." }
  },
};

// Fallback inference fra doc-id
const INFERENCE_RULES = [
  { pattern: "walk_in_cooler",  profile: "walk_in_cooler"  },
  { pattern: "walk_in_freezer", profile: "walk_in_freezer" },
  { pattern: "blast_chiller",   profile: "blast_chiller"   },
  { pattern: "display_fridge",  profile: "display_fridge"  },
  { pattern: "softice",         profile: "softice_machine" },
  { pattern: "warming_cabinet", profile: "warming_cabinet" },
  { pattern: "freezer",         profile: "freezer"         },
  { pattern: "fridge",          profile: "fridge"          },
];

function inferProfile(doc) {
  const eqType = (doc.data()?.equipmentType || "").toLowerCase();
  if (TEMPERATURE_PROFILES[eqType]) return TEMPERATURE_PROFILES[eqType];
  // Fallback: infer from doc ID
  const lower = doc.id.toLowerCase();
  for (const rule of INFERENCE_RULES) {
    if (lower.includes(rule.pattern)) return TEMPERATURE_PROFILES[rule.profile] || null;
  }
  return null;
}

function isEmpty(val) {
  if (val === null || val === undefined) return true;
  if (typeof val === "object" && !Array.isArray(val) && Object.keys(val).length === 0) return true;
  return false;
}

async function main() {
  console.log(`[migrateTemperatureTemplateFields] DRY_RUN=${DRY_RUN}\n`);

  const snap = await db.collection("task_templates").get();

  const candidates = snap.docs.filter(doc => {
    const d = doc.data() || {};
    return d.controlType === "temperature_check";
  });

  console.log(`[migrateTemperatureTemplateFields] temperatur-templates fundet: ${candidates.length}\n`);

  let updated = 0;
  let skipped = 0;

  for (const doc of candidates) {
    const d   = doc.data() || {};
    const profile = inferProfile(doc);

    if (!profile) {
      console.log(`  SKIP (ingen profil)  ${doc.id}`);
      skipped++;
      continue;
    }

    // Build update: only set fields that are missing or empty
    const patch = {};
    const FIELDS = ["targetTemperature", "thresholds", "defaultValues", "formDefinition", "displayHints"];

    for (const field of FIELDS) {
      if (isEmpty(d[field])) {
        patch[field] = profile[field];
      }
    }

    if (Object.keys(patch).length === 0) {
      console.log(`  SKIP (allerede udfyldt)  ${doc.id}`);
      skipped++;
      continue;
    }

    console.log(`  UPDATE  ${doc.id}`);
    for (const [k, v] of Object.entries(patch)) {
      console.log(`          ${k}: ${JSON.stringify(v)}`);
    }

    if (!DRY_RUN) {
      await doc.ref.update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
    }
    updated++;
  }

  console.log(`\n[migrateTemperatureTemplateFields] summary: updated=${updated}  skipped=${skipped}  DRY_RUN=${DRY_RUN}`);
  if (DRY_RUN) {
    console.log("[migrateTemperatureTemplateFields] DRY_RUN — ingen ændringer skrevet.");
  }
}

main().catch(err => {
  console.error("[migrateTemperatureTemplateFields] FEJL:", err.message);
  process.exit(1);
});
