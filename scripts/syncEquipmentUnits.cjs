/**
 * syncEquipmentUnits.cjs
 *
 * Materialiser onboarding equipmentCounts for én company/location
 * til konkrete equipment docs i Firestore.
 *
 * Brug:
 *   node scripts/syncEquipmentUnits.cjs
 *
 * Sæt COUNTS nedenfor eller lad scriptet læse dem fra onboarding_answers.
 *
 * DRY_RUN = true   → vis hvad der ville ske, skriv ingenting
 * DRY_RUN = false  → skriv til Firestore
 */

"use strict";

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ─── KONFIGURATION ───────────────────────────────────────────────────────────
const DRY_RUN    = true;
const COMPANY_ID  = "onboarding_aroi-d";
const LOCATION_ID = "onboarding_aroi-d__main";

// Sæt counts manuelt her, ELLER lad scriptet hente fra onboarding_answers (MANUAL_COUNTS = null)
const MANUAL_COUNTS = { fridge: 2, freezer: 1 };
// Eksempel: const MANUAL_COUNTS = { fridge: 2, freezer: 1 };
// ─────────────────────────────────────────────────────────────────────────────

const EQUIPMENT_COUNT_MAPPING = [
  { countKeys: ["fridge", "fridgeCount", "antalKoeleskabe"],                equipmentType: "fridge",          titleBase: "Køleskab",          controlTypes: ["temperature_check"] },
  { countKeys: ["freezer", "freezerCount", "antalFrysere"],                 equipmentType: "freezer",         titleBase: "Fryser",            controlTypes: ["temperature_check"] },
  { countKeys: ["walk_in_cooler", "walkInCooler", "walkInCoolerCount"],     equipmentType: "walk_in_cooler",   titleBase: "Walk-in køler",     controlTypes: ["temperature_check"] },
  { countKeys: ["walk_in_freezer", "walkInFreezer", "walkInFreezerCount"],  equipmentType: "walk_in_freezer",  titleBase: "Walk-in fryser",    controlTypes: ["temperature_check"] },
  { countKeys: ["ice_machine", "iceMachine", "antalIsterningemaskiner"],    equipmentType: "ice_machine",      titleBase: "Isterningemaskine", controlTypes: [] },
  { countKeys: ["ice_box", "isboks", "antalIsbokse"],                       equipmentType: "ice_box",          titleBase: "Isboks",            controlTypes: ["temperature_check"] },
  { countKeys: ["fryer", "antalFrityreGryder"],                             equipmentType: "fryer",            titleBase: "Frituregryden",     controlTypes: [] },
  { countKeys: ["dishwasher", "antalOpvaskemaskiner"],                      equipmentType: "dishwasher",       titleBase: "Opvaskemaskine",    controlTypes: [] },
  { countKeys: ["blast_chiller", "blastChiller", "antalBlastChillere"],     equipmentType: "blast_chiller",    titleBase: "Blast chiller",     controlTypes: ["temperature_check"] },
  { countKeys: ["warming_cabinet", "warmingCabinet", "antalVarmeskabe"],    equipmentType: "warming_cabinet",  titleBase: "Varmeskab",         controlTypes: ["temperature_check"] },
  { countKeys: ["display_fridge", "displayFridge", "antalDisplaykoele"],   equipmentType: "display_fridge",   titleBase: "Displaykøl",        controlTypes: ["temperature_check"] },
  { countKeys: ["softice_machine", "softiceMachine"],                       equipmentType: "softice_machine",  titleBase: "Softice maskine",   controlTypes: ["temperature_check"] },
];

function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function normalizeEquipmentCounts(rawCounts = {}, profile = {}) {
  const result = {};
  for (const mapping of EQUIPMENT_COUNT_MAPPING) {
    let count = 0;
    for (const key of mapping.countKeys) {
      const val = rawCounts[key] != null ? rawCounts[key] : profile[key];
      if (val != null) { count = toPositiveInt(val); break; }
    }
    result[mapping.equipmentType] = count;
  }
  return result;
}

async function loadCounts() {
  if (MANUAL_COUNTS) return MANUAL_COUNTS;

  const snap = await db.collection("onboarding_answers")
    .where("locationId", "==", LOCATION_ID)
    .limit(1).get();
  if (snap.empty) {
    console.log("[syncEquipmentUnits] ingen onboarding_answers fundet, bruger tomme counts");
    return {};
  }
  const data = snap.docs[0].data() || {};
  console.log("[syncEquipmentUnits] læste equipmentCounts fra onboarding_answers:", data.equipmentCounts || {});
  return data.equipmentCounts || {};
}

async function main() {
  console.log(`[syncEquipmentUnits] DRY_RUN=${DRY_RUN}  company=${COMPANY_ID}  location=${LOCATION_ID}`);

  const rawCounts = await loadCounts();
  const normalizedCounts = normalizeEquipmentCounts(rawCounts);
  console.log("[syncEquipmentUnits] normalizedCounts:", normalizedCounts);

  const existingSnap = await db.collection("equipment")
    .where("locationId", "==", LOCATION_ID)
    .where("source", "==", "onboarding")
    .get();

  const existingById = new Map();
  for (const doc of existingSnap.docs) {
    existingById.set(doc.id, { ref: doc.ref, data: doc.data() || {} });
  }
  console.log(`[syncEquipmentUnits] eksisterende onboarding equipment docs: ${existingById.size}`);

  const ops = [];

  for (const mapping of EQUIPMENT_COUNT_MAPPING) {
    const count = normalizedCounts[mapping.equipmentType] || 0;
    const { equipmentType, titleBase, controlTypes } = mapping;

    let maxExisting = 0;
    for (const [id] of existingById) {
      const prefix = `onboarding_${equipmentType}_`;
      if (id.startsWith(prefix)) {
        const n = parseInt(id.slice(prefix.length), 10);
        if (!isNaN(n) && n > maxExisting) maxExisting = n;
      }
    }

    for (let i = 1; i <= count; i++) {
      const docId = `onboarding_${equipmentType}_${i}`;
      const title = `${titleBase} ${i}`;
      const existing = existingById.get(docId);
      ops.push({ action: existing ? (existing.data.active === false ? "ACTIVATE" : "KEEP") : "CREATE", docId, title, controlTypes });
    }

    for (let i = count + 1; i <= maxExisting; i++) {
      const docId = `onboarding_${equipmentType}_${i}`;
      const existing = existingById.get(docId);
      if (existing && existing.data.active !== false) {
        ops.push({ action: "DEACTIVATE", docId });
      }
    }
  }

  console.log("\n── PLAN ─────────────────────────────────────────────────────────");
  const creates    = ops.filter(o => o.action === "CREATE");
  const activates  = ops.filter(o => o.action === "ACTIVATE");
  const deactivates= ops.filter(o => o.action === "DEACTIVATE");
  const keeps      = ops.filter(o => o.action === "KEEP");

  for (const o of creates)     console.log(`  CREATE     ${o.docId}  →  ${o.title}  controlTypes=${JSON.stringify(o.controlTypes)}`);
  for (const o of activates)   console.log(`  ACTIVATE   ${o.docId}  →  ${o.title}`);
  for (const o of deactivates) console.log(`  DEACTIVATE ${o.docId}`);
  for (const o of keeps)       console.log(`  KEEP       ${o.docId}  →  ${o.title}`);

  console.log(`\n[syncEquipmentUnits] summary: create=${creates.length} activate=${activates.length} deactivate=${deactivates.length} keep=${keeps.length}`);

  if (DRY_RUN) {
    console.log("[syncEquipmentUnits] DRY_RUN — ingen ændringer skrevet.");
    process.exit(0);
    return;
  }

  const nowTs = FieldValue.serverTimestamp();
  const batch = db.batch();

  for (const mapping of EQUIPMENT_COUNT_MAPPING) {
    const count = normalizedCounts[mapping.equipmentType] || 0;
    const { equipmentType, titleBase, controlTypes } = mapping;

    let maxExisting = 0;
    for (const [id] of existingById) {
      const prefix = `onboarding_${equipmentType}_`;
      if (id.startsWith(prefix)) {
        const n = parseInt(id.slice(prefix.length), 10);
        if (!isNaN(n) && n > maxExisting) maxExisting = n;
      }
    }

    for (let i = 1; i <= count; i++) {
      const docId = `onboarding_${equipmentType}_${i}`;
      const title = `${titleBase} ${i}`;
      const existing = existingById.get(docId);
      const ref = existing?.ref || db.collection("equipment").doc(docId);

      if (existing) {
        batch.set(ref, {
          companyId: COMPANY_ID, organizationId: COMPANY_ID, locationId: LOCATION_ID,
          source: "onboarding", equipmentType, type: equipmentType,
          controlTypes, controlType: controlTypes[0] || "",
          title, name: title, displayName: title,
          unitNumber: i, active: true, updatedAt: nowTs
        }, { merge: true });
      } else {
        batch.set(ref, {
          companyId: COMPANY_ID, organizationId: COMPANY_ID, locationId: LOCATION_ID,
          source: "onboarding", equipmentType, type: equipmentType,
          controlTypes, controlType: controlTypes[0] || "",
          title, name: title, displayName: title,
          unitNumber: i, active: true, createdAt: nowTs, updatedAt: nowTs
        });
      }
    }

    for (let i = count + 1; i <= maxExisting; i++) {
      const docId = `onboarding_${equipmentType}_${i}`;
      const existing = existingById.get(docId);
      if (existing && existing.data.active !== false) {
        batch.set(existing.ref, { active: false, updatedAt: nowTs }, { merge: true });
      }
    }
  }

  await batch.commit();
  console.log("[syncEquipmentUnits] skrevet til Firestore.");
  process.exit(0);
}

main().catch(e => { console.error("[syncEquipmentUnits] FEJL:", e.message); process.exit(1); });
