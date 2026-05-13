/**
 * reprovision-and-audit.cjs
 *
 * 1. Kører fuld reprovision for testlokationen (equipment → risks → templates)
 * 2. Læser alt tilbage og rapporterer præcist hvad der findes
 *
 * Brug: node scripts/reprovision-and-audit.cjs
 * Tilføj --dry-run for at læse uden at skrive
 */
"use strict";

const admin = require("firebase-admin");
const path  = require("path");
const serviceAccount = require(path.resolve(__dirname, "../serviceAccountKey.json"));

// Initialisér admin FØR de andre moduler requires, så de deler denne instance
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId:  serviceAccount.project_id
  });
}

const db         = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ─── KONFIGURATION ─────────────────────────────────────────────────────────
const COMPANY_ID   = "onboarding_aroi-d";
const LOCATION_ID  = "onboarding_aroi-d__main";
const DRY_RUN      = process.argv.includes("--dry-run");

// Explicit equipment counts (bruges hvis onboarding_answers ikke har dem)
const EXPLICIT_COUNTS = { fridge: 3, freezer: 3, ice_machine: 1 };

// ─── EQUIPMENT MAPPING (spejling af index.js EQUIPMENT_COUNT_MAPPING) ───────
const EQUIPMENT_COUNT_MAPPING = [
  { countKeys: ["fridge"],         equipmentType: "fridge",          titleBase: "Køleskab",           controlTypes: ["temperature_check"] },
  { countKeys: ["freezer"],        equipmentType: "freezer",         titleBase: "Fryser",             controlTypes: ["temperature_check"] },
  { countKeys: ["walk_in_cooler"], equipmentType: "walk_in_cooler",  titleBase: "Walk-in køler",      controlTypes: ["temperature_check"] },
  { countKeys: ["walk_in_freezer"],equipmentType: "walk_in_freezer", titleBase: "Walk-in fryser",     controlTypes: ["temperature_check"] },
  { countKeys: ["ice_machine"],    equipmentType: "ice_machine",     titleBase: "Isterningemaskine",  controlTypes: [] },
  { countKeys: ["ice_box"],        equipmentType: "ice_box",         titleBase: "Isboks",             controlTypes: ["temperature_check"] },
  { countKeys: ["fryer"],          equipmentType: "fryer",           titleBase: "Frituregryde",       controlTypes: [] },
  { countKeys: ["dishwasher"],     equipmentType: "dishwasher",      titleBase: "Opvaskemaskine",     controlTypes: [] },
  { countKeys: ["blast_chiller"],  equipmentType: "blast_chiller",   titleBase: "Blast chiller",      controlTypes: ["temperature_check"] },
  { countKeys: ["warming_cabinet"],equipmentType: "warming_cabinet", titleBase: "Varmeskab",          controlTypes: ["temperature_check"] },
  { countKeys: ["display_fridge"], equipmentType: "display_fridge",  titleBase: "Displaykøl",         controlTypes: ["temperature_check"] },
  { countKeys: ["softice_machine"],equipmentType: "softice_machine", titleBase: "Softice maskine",    controlTypes: ["temperature_check"] },
];

const CLEANING_DEFS = [
  { key: "cleaning_fridge_control",          equipmentType: "fridge",          titleBase: "Rengøringskontrol - Køleskab",       frequency: "daily",   riskLevel: "medium" },
  { key: "cleaning_freezer_control",         equipmentType: "freezer",         titleBase: "Rengøringskontrol - Fryser",         frequency: "daily",   riskLevel: "medium" },
  { key: "cleaning_fryer_control",           equipmentType: "fryer",           titleBase: "Rengøringskontrol - Frituregryde",   frequency: "daily",   riskLevel: "medium" },
  { key: "cleaning_dishwasher_control",      equipmentType: "dishwasher",      titleBase: "Rengøringskontrol - Opvaskemaskine", frequency: "daily",   riskLevel: "medium" },
  { key: "cleaning_ice_machine_control",     equipmentType: "ice_machine",     titleBase: "Rengøringskontrol - Isterningemaskine", frequency: "daily", riskLevel: "medium" },
  { key: "cleaning_softice_control",         equipmentType: "softice_machine", titleBase: "Rengøringskontrol - Softice",        frequency: "daily",   riskLevel: "medium" },
  { key: "cleaning_display_fridge_control",  equipmentType: "display_fridge",  titleBase: "Rengøringskontrol - Displaykøl",     frequency: "daily",   riskLevel: "medium" },
  { key: "cleaning_warming_cabinet_control", equipmentType: "warming_cabinet", titleBase: "Rengøringskontrol - Varmeskab",      frequency: "daily",   riskLevel: "medium" },
  { key: "cleaning_blast_chiller_control",   equipmentType: "blast_chiller",   titleBase: "Rengøringskontrol - Blast chiller",  frequency: "daily",   riskLevel: "medium" },
];

const MAINTENANCE_DEFS = [
  { key: "maintenance_fridge_control",          equipmentType: "fridge",          titleBase: "Vedligeholdelse - Køleskab",          frequency: "monthly", riskLevel: "medium" },
  { key: "maintenance_freezer_control",         equipmentType: "freezer",         titleBase: "Vedligeholdelse - Fryser",            frequency: "monthly", riskLevel: "medium" },
  { key: "maintenance_walk_in_cooler_control",  equipmentType: "walk_in_cooler",  titleBase: "Vedligeholdelse - Walk-in køler",     frequency: "monthly", riskLevel: "medium" },
  { key: "maintenance_walk_in_freezer_control", equipmentType: "walk_in_freezer", titleBase: "Vedligeholdelse - Walk-in fryser",    frequency: "monthly", riskLevel: "medium" },
  { key: "maintenance_fryer_control",           equipmentType: "fryer",           titleBase: "Vedligeholdelse - Frituregryde",      frequency: "monthly", riskLevel: "medium" },
  { key: "maintenance_dishwasher_control",      equipmentType: "dishwasher",      titleBase: "Vedligeholdelse - Opvaskemaskine",    frequency: "monthly", riskLevel: "medium" },
  { key: "maintenance_ice_machine_control",     equipmentType: "ice_machine",     titleBase: "Vedligeholdelse - Isterningemaskine", frequency: "monthly", riskLevel: "medium" },
  { key: "maintenance_blast_chiller_control",   equipmentType: "blast_chiller",   titleBase: "Vedligeholdelse - Blast chiller",     frequency: "monthly", riskLevel: "medium" },
  { key: "maintenance_warming_cabinet_control", equipmentType: "warming_cabinet", titleBase: "Vedligeholdelse - Varmeskab",         frequency: "monthly", riskLevel: "medium" },
  { key: "maintenance_display_fridge_control",  equipmentType: "display_fridge",  titleBase: "Vedligeholdelse - Displaykøl",        frequency: "monthly", riskLevel: "medium" },
  { key: "maintenance_softice_control",         equipmentType: "softice_machine", titleBase: "Vedligeholdelse - Softice maskine",   frequency: "monthly", riskLevel: "medium" },
];

// ─── STEP 1: Sync equipment units ────────────────────────────────────────────
async function stepSyncEquipment(equipmentCounts) {
  console.log("\n══ STEP 1: Sync equipment units ═══════════════════════════════");
  if (DRY_RUN) { console.log("[DRY_RUN] Springer over"); return; }

  const nowTs  = FieldValue.serverTimestamp();
  const batch  = db.batch();
  let created  = 0, updated = 0;
  const written = [];

  for (const mapping of EQUIPMENT_COUNT_MAPPING) {
    const count = Math.max(0, Math.floor(Number(equipmentCounts[mapping.equipmentType] || 0)));
    for (let i = 1; i <= count; i++) {
      const docId = `onboarding_${mapping.equipmentType}_${i}`;
      const ref   = db.collection("equipment").doc(docId);
      const snap  = await ref.get();
      const payload = {
        companyId: COMPANY_ID, organizationId: COMPANY_ID, locationId: LOCATION_ID,
        source: "onboarding", equipmentType: mapping.equipmentType, type: mapping.equipmentType,
        controlTypes: mapping.controlTypes, controlType: mapping.controlTypes[0] || "",
        title: `${mapping.titleBase} ${i}`, name: `${mapping.titleBase} ${i}`,
        unitNumber: i, active: true, updatedAt: nowTs,
      };
      if (snap.exists) {
        batch.set(ref, payload, { merge: true });
        updated++;
      } else {
        batch.set(ref, { ...payload, createdAt: nowTs });
        created++;
      }
      written.push(docId);
    }
  }

  await batch.commit();
  console.log(`  ✅ created=${created} updated=${updated}`);
  console.log(`  equipment documents: ${written.join(", ") || "(ingen)"}`);
}

// ─── STEP 2: Generate risks ───────────────────────────────────────────────────
async function stepGenerateRisks() {
  console.log("\n══ STEP 2: generateRisksFromOnboardingAnswers ══════════════════");
  if (DRY_RUN) { console.log("[DRY_RUN] Springer over"); return; }

  const { generateRisksFromOnboardingAnswers } = require(
    path.resolve(__dirname, "../functions/admin/generateRisksFromOnboardingAnswers.js")
  );
  const result = await generateRisksFromOnboardingAnswers({ locationId: LOCATION_ID });
  console.log(`  ✅ created=${result.created} updated=${result.updated} skipped=${result.skipped} total=${result.totalRules || "?"}`);
  if (result.message) console.log(`  msg: ${result.message}`);
  if (result.details) {
    for (const d of result.details) {
      console.log(`  onboarding ${d.onboardingId}: processes matched → ${d.totalRules} rules`);
    }
  }
}

// ─── STEP 3: Generate egenkontrol templates from risks ───────────────────────
async function stepGenerateTemplates() {
  console.log("\n══ STEP 3: generateEgenkontrolFromRiskAnalysis ════════════════");
  if (DRY_RUN) { console.log("[DRY_RUN] Springer over"); return; }

  // VIGTIGT: send IKKE 'db' fra dette script — de to firebase-admin versioner
  // (root node_modules vs functions/node_modules) har inkompatible FieldValue-objekter.
  // Lad generatoren bruge sin egen interne db-instans.
  const { generateEgenkontrolFromRiskAnalysis } = require(
    path.resolve(__dirname, "../functions/admin/generateEgenkontrolFromRiskAnalysis.js")
  );
  const result = await generateEgenkontrolFromRiskAnalysis({ locationId: LOCATION_ID });
  console.log(`  ✅`, JSON.stringify(result, null, 2).replace(/\n/g, "\n  "));
}

// ─── STEP 4: Sync cleaning templates ────────────────────────────────────────
async function stepSyncCleaning(activeTypes) {
  console.log("\n══ STEP 4: Sync cleaning templates ════════════════════════════");
  if (DRY_RUN) { console.log("[DRY_RUN] Springer over"); return; }

  const nowTs = FieldValue.serverTimestamp();
  let created = 0, skipped = 0;
  for (const def of CLEANING_DEFS) {
    if (!activeTypes.has(def.equipmentType)) continue;
    const docId = `${COMPANY_ID}_${LOCATION_ID}_${def.key}`;
    const ref   = db.collection("task_templates").doc(docId);
    const snap  = await ref.get();
    if (snap.exists) { skipped++; continue; }
    await ref.set({
      templateId: docId, companyId: COMPANY_ID, organizationId: COMPANY_ID, locationId: LOCATION_ID,
      title: def.titleBase, category: "rengøring", controlType: "cleaning_check",
      equipmentType: def.equipmentType, libraryType: "operational", templateType: "operational",
      templateSource: "equipment_cleaning_library", sourceType: "equipment_cleaning_library",
      frequency: def.frequency, frequencyType: def.frequency, riskLevel: def.riskLevel,
      isActive: true, active: true, createdAt: nowTs, updatedAt: nowTs,
    });
    created++;
    console.log(`  created: ${docId}`);
  }
  console.log(`  ✅ created=${created} skipped=${skipped}`);
}

// ─── STEP 5: Sync maintenance templates ─────────────────────────────────────
async function stepSyncMaintenance(activeTypes) {
  console.log("\n══ STEP 5: Sync maintenance templates ══════════════════════════");
  if (DRY_RUN) { console.log("[DRY_RUN] Springer over"); return; }

  const nowTs = FieldValue.serverTimestamp();
  let created = 0, skipped = 0;
  for (const def of MAINTENANCE_DEFS) {
    if (!activeTypes.has(def.equipmentType)) continue;
    const docId = `${COMPANY_ID}_${LOCATION_ID}_${def.key}`;
    const ref   = db.collection("task_templates").doc(docId);
    const snap  = await ref.get();
    if (snap.exists) { skipped++; continue; }
    await ref.set({
      templateId: docId, companyId: COMPANY_ID, organizationId: COMPANY_ID, locationId: LOCATION_ID,
      title: def.titleBase, category: "vedligeholdelse", controlType: "maintenance_check",
      equipmentType: def.equipmentType, libraryType: "operational", templateType: "operational",
      templateSource: "equipment_maintenance_library", sourceType: "equipment_maintenance_library",
      frequency: def.frequency, frequencyType: def.frequency, riskLevel: def.riskLevel,
      isActive: true, active: true, createdAt: nowTs, updatedAt: nowTs,
    });
    created++;
    console.log(`  created: ${docId}`);
  }
  console.log(`  ✅ created=${created} skipped=${skipped}`);
}

// ─── AUDIT: Læs alt tilbage ──────────────────────────────────────────────────
async function audit() {
  console.log("\n\n══════════════════════════════════════════════════════════════");
  console.log("  AUDIT — faktisk tilstand i Firestore");
  console.log("══════════════════════════════════════════════════════════════\n");

  // ── onboarding_answers ──────────────────────────────────────────────────
  const oaSnap = await db.collection("onboarding_answers")
    .where("locationId", "==", LOCATION_ID).get();
  console.log(`── onboarding_answers (${oaSnap.size} doc(s)) ─────────────────`);
  if (oaSnap.empty) {
    console.log("  ⚠️  INGEN onboarding_answers for denne location!");
    console.log("  Dette er årsagen til at risks-pipelinen ikke kan generere procesbaserede templates.\n");
  } else {
    for (const doc of oaSnap.docs) {
      const d = doc.data() || {};
      console.log(`  id: ${doc.id}`);
      console.log(`  processes:        ${JSON.stringify(d.processes || [])}`);
      console.log(`  equipmentCounts:  ${JSON.stringify(d.equipmentCounts || {})}`);
      console.log(`  specialConditions:${JSON.stringify(d.specialConditions || [])}`);
      console.log(`  areas:            ${JSON.stringify(d.areas || [])}`);
      console.log(`  ingredients:      ${JSON.stringify(d.ingredients || [])}`);
    }
  }

  // ── equipment ──────────────────────────────────────────────────────────
  const eqSnap = await db.collection("equipment")
    .where("locationId", "==", LOCATION_ID).get();
  const activeEq   = eqSnap.docs.filter(d => d.data().active !== false);
  const inactiveEq = eqSnap.docs.filter(d => d.data().active === false);
  const activeTypes = new Set(activeEq.map(d => d.data().equipmentType || d.data().type).filter(Boolean));

  console.log(`\n── equipment (${eqSnap.size} total, ${activeEq.length} aktive, ${inactiveEq.length} inaktive) ──`);
  for (const doc of activeEq) {
    const d = doc.data() || {};
    const type   = d.equipmentType || d.type || "?";
    const title  = d.title || d.name || "?";
    const source = d.source || "?";
    console.log(`  ✅ ${doc.id.padEnd(35)} type=${type.padEnd(20)} title="${title}"  source=${source}`);
  }
  if (inactiveEq.length > 0) {
    console.log(`  (${inactiveEq.length} inaktive: ${inactiveEq.map(d => d.id).join(", ")})`);
  }
  if (eqSnap.empty) console.log("  ⚠️  Ingen equipment docs! syncOnboardingEquipmentUnits er ikke kørt.");

  // ── risks ──────────────────────────────────────────────────────────────
  const risksSnap = await db.collection("risks")
    .where("locationId", "==", LOCATION_ID).get();
  console.log(`\n── risks (${risksSnap.size} docs) ────────────────────────────────`);
  if (risksSnap.empty) {
    console.log("  ⚠️  Ingen risks! generateRisksFromOnboardingAnswers er ikke kørt, eller onboarding_answers mangler processes.");
  } else {
    for (const doc of risksSnap.docs) {
      const d = doc.data() || {};
      const ccp  = d.isCCP ? "CCP" : "GMP";
      const proc = d.processKey || "?";
      const ctrl = d.controlType || "?";
      console.log(`  ${ccp.padEnd(4)} id=${doc.id.padEnd(55)} processKey=${proc.padEnd(30)} controlType=${ctrl}`);
    }
  }

  // ── task_templates ─────────────────────────────────────────────────────
  const tmplSnap = await db.collection("task_templates")
    .where("locationId", "==", LOCATION_ID).get();

  const bySource = {};
  for (const doc of tmplSnap.docs) {
    const d = doc.data() || {};
    const source = d.templateSource || d.sourceType || "unknown";
    if (!bySource[source]) bySource[source] = [];
    bySource[source].push({ id: doc.id, ...d });
  }

  // Klassificér som ønsket af bruger
  const processDaily     = [];  // risk_analysis templates (operational, ikke unit-knyttet)
  const unitDaily        = [];  // cleaning_library + maintenance_library (per equipment type)
  const areaDaily        = [];  // area_cleaning kategori
  const monthlyMaint     = [];  // maintenance frequency
  const other            = [];

  for (const doc of tmplSnap.docs) {
    const d   = doc.data() || {};
    const src = d.templateSource || d.sourceType || "";
    const frq = d.frequency || d.frequencyType || "";
    const cat = (d.category || "").toLowerCase();
    const tmplType = d.templateType || "";

    if (src === "equipment_maintenance_library" || frq === "monthly" || frq === "weekly" && cat === "vedligeholdelse") {
      monthlyMaint.push(doc);
    } else if (src === "equipment_cleaning_library" || cat === "rengøring") {
      unitDaily.push(doc);
    } else if (src === "risk_analysis" || tmplType === "operational" && !d.equipmentType) {
      if (cat === "area_cleaning" || (d.description || "").toLowerCase().includes("område")) {
        areaDaily.push(doc);
      } else {
        processDaily.push(doc);
      }
    } else {
      other.push(doc);
    }
  }

  console.log(`\n── task_templates (${tmplSnap.size} total) ───────────────────────`);
  console.log(`\n  PROCESS-DAGLIGE (risk_analysis → operational):  ${processDaily.length}`);
  for (const doc of processDaily) {
    const d = doc.data();
    const freq = d.frequency || "?";
    const active = d.isActive !== false ? "✅" : "❌";
    console.log(`  ${active} [${freq.padEnd(12)}] ${(d.title || doc.id).padEnd(50)} source=${d.templateSource || "?"}`);
  }

  console.log(`\n  ENHEDSBASEREDE DAGLIGE (cleaning_library):        ${unitDaily.length}`);
  for (const doc of unitDaily) {
    const d = doc.data();
    const eq = d.equipmentType || "?";
    const active = d.isActive !== false ? "✅" : "❌";
    console.log(`  ${active} [${eq.padEnd(20)}] ${(d.title || doc.id).padEnd(50)} id=${doc.id}`);
  }

  console.log(`\n  OMRÅDEBASEREDE DAGLIGE (area_cleaning):           ${areaDaily.length}`);
  for (const doc of areaDaily) {
    const d = doc.data();
    const active = d.isActive !== false ? "✅" : "❌";
    console.log(`  ${active} ${(d.title || doc.id).padEnd(55)} source=${d.templateSource || "?"}`);
  }

  console.log(`\n  MÅNEDLIG VEDLIGEHOLDELSE (maintenance_library):   ${monthlyMaint.length}`);
  for (const doc of monthlyMaint) {
    const d = doc.data();
    const eq = d.equipmentType || "?";
    const freq = d.frequency || "?";
    const active = d.isActive !== false ? "✅" : "❌";
    console.log(`  ${active} [${eq.padEnd(20)}] [${freq.padEnd(10)}] ${(d.title || doc.id).padEnd(45)} id=${doc.id}`);
  }

  if (other.length > 0) {
    console.log(`\n  ØVRIGE (${other.length}):`);
    for (const doc of other) {
      const d = doc.data();
      console.log(`  - ${doc.id.padEnd(60)} source=${d.templateSource || "?"} type=${d.templateType || "?"} freq=${d.frequency || "?"}`);
    }
  }

  // ── Kravcheck ─────────────────────────────────────────────────────────
  console.log("\n── KRAVCHECK ─────────────────────────────────────────────────");
  const allTitles = tmplSnap.docs.map(d => (d.data().title || "").toLowerCase());
  const allCats   = tmplSnap.docs.map(d => (d.data().category || "").toLowerCase());
  const allSources= tmplSnap.docs.map(d => d.data().templateSource || "");

  const checks = [
    { label: "Nedkøling (cooling_process template)",          ok: allSources.some(s => s === "risk_analysis") && allTitles.some(t => t.includes("nedkøl") || t.includes("cooling")) },
    { label: "Varmholdelse (temperature_heating template)",    ok: allTitles.some(t => t.includes("varmhold") || t.includes("hot hold") || t.includes("heating")) },
    { label: "Opvarmning / genopvarmning",                    ok: allTitles.some(t => t.includes("opvarmning") || t.includes("genopvarmning") || t.includes("reheat")) },
    { label: "Varemodtagelse (receiving_control)",             ok: allTitles.some(t => t.includes("modtage") || t.includes("receiving") || t.includes("varemodtag")) },
    { label: "Adskillelse af råvarer (allergen/separation)",   ok: allTitles.some(t => t.includes("adskil") || t.includes("allergen") || t.includes("separat")) },
    { label: "Opbevaring (temperaturkontrol)",                 ok: allTitles.some(t => t.includes("temperaturkontrol")) },
    { label: "Områdebaseret rengøring (area_cleaning)",        ok: areaDaily.length > 0 || allCats.some(c => c === "area_cleaning") },
    { label: "Temperaturkontrol pr. enhed (unit_daily)",       ok: unitDaily.length > 0 },
    { label: "Vedligeholdelse månedlig (maintenance_library)", ok: monthlyMaint.length > 0 },
  ];

  for (const c of checks) {
    console.log(`  ${c.ok ? "✅" : "❌"} ${c.label}`);
  }

  // ── Diagnose ───────────────────────────────────────────────────────────
  const missingOA    = oaSnap.empty;
  const missingProc  = !missingOA && (oaSnap.docs[0].data().processes || []).length === 0;
  const missingRisks = risksSnap.empty;

  if (missingOA || missingProc || missingRisks) {
    console.log("\n── MANGLER – hvad stopper procesbaserede templates ──────────");
    if (missingOA)   console.log("  ❌ onboarding_answers mangler helt for location → ingen risks kan genereres");
    if (!missingOA && missingProc) {
      const d = oaSnap.docs[0].data();
      console.log("  ❌ onboarding_answers.processes = [] → generateRisksFromOnboardingAnswers finder ingen PROCESS_RULES");
      console.log(`     Felter i dokumentet: ${Object.keys(d).join(", ")}`);
      console.log(`     Disse processer skal sættes i processes[]: ${Object.keys({
        receive_chilled_goods: 1, receive_frozen_goods: 1, store_chilled_goods: 1,
        store_frozen_goods: 1, cook_food: 1, hot_hold_food: 1, cool_food: 1, reheat_food: 1, serve_cold_food: 1
      }).join(", ")}`);
    }
    if (missingRisks && !missingOA && !missingProc) {
      console.log("  ❌ risks-samlingen er tom → generateEgenkontrolFromRiskAnalysis finder intet at aggregere → 0 risk_analysis templates");
    }
  }

  const processRiskTemplateCount = processDaily.filter(d => (d.data().templateSource || "") === "risk_analysis").length;
  if (processRiskTemplateCount === 0 && !missingOA) {
    console.log("\n  ℹ️  processDaily indeholder 0 risk_analysis templates.");
    console.log("     Mulige årsager:");
    console.log("     1. onboarding_answers.processes er tom → ingen risks genereret");
    console.log("     2. risks-samlingen er tom → generateEgenkontrolFromRiskAnalysis finder intet");
    console.log("     3. alle risks matcher 'verification' category → templateType='verification' og filtreres fra daglige rutiner");
  }

  console.log("\n══════════════════════════════════════════════════════════════\n");
  console.log("Færdig.");
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n[reprovision-and-audit] company=${COMPANY_ID}  location=${LOCATION_ID}  DRY_RUN=${DRY_RUN}`);
  console.log("════════════════════════════════════════════════════════════\n");

  // Dump onboarding_answers FØR alt andet
  console.log("══ PRE-AUDIT: onboarding_answers for location ═══════════════");
  const oaSnapAll = await db.collection("onboarding_answers")
    .where("locationId", "==", LOCATION_ID).get();
  if (oaSnapAll.empty) {
    console.log("  ⚠️  INGEN onboarding_answers for denne location!");
  } else {
    for (const doc of oaSnapAll.docs) {
      const d = doc.data() || {};
      console.log(`  doc id: ${doc.id}`);
      console.log(`  processes:         ${JSON.stringify(d.processes || [])}`);
      console.log(`  equipmentCounts:   ${JSON.stringify(d.equipmentCounts || {})}`);
      console.log(`  specialConditions: ${JSON.stringify(d.specialConditions || [])}`);
    }
  }

  // Hent onboarding_answers
  const oaSnap = oaSnapAll;
  const oaData   = oaSnap.empty ? {} : (oaSnap.docs[0].data() || {});
  const rawCounts = oaData.equipmentCounts || {};

  // Brug EXPLICIT_COUNTS som primær kilde, fall back til onboarding_answers
  const equipmentCounts = {};
  for (const mapping of EQUIPMENT_COUNT_MAPPING) {
    const type = mapping.equipmentType;
    const explicit = EXPLICIT_COUNTS[type];
    if (explicit != null && explicit > 0) {
      equipmentCounts[type] = explicit;
    } else {
      // Prøv at finde i rawCounts med varianter
      for (const k of mapping.countKeys) {
        const v = rawCounts[k] || rawCounts[type];
        if (v != null && Number(v) > 0) { equipmentCounts[type] = Number(v); break; }
      }
    }
  }
  console.log(`Effektive equipmentCounts: ${JSON.stringify(equipmentCounts)}`);

  // Step 1-5
  await stepSyncEquipment(equipmentCounts);

  // Bestem aktive typer EFTER step 1 for cleaning/maintenance
  const eqSnapAfter = await db.collection("equipment").where("locationId", "==", LOCATION_ID).get();
  const activeTypes = new Set(
    eqSnapAfter.docs
      .filter(d => d.data().active !== false)
      .map(d => d.data().equipmentType || d.data().type)
      .filter(Boolean)
  );
  if (activeTypes.size === 0) {
    // Fallback: brug equipmentCounts direkte
    for (const [k, v] of Object.entries(equipmentCounts)) {
      if (Number(v) > 0) activeTypes.add(k);
    }
  }

  await stepGenerateRisks();
  await stepGenerateTemplates();
  await stepSyncCleaning(activeTypes);
  await stepSyncMaintenance(activeTypes);

  await audit();
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
