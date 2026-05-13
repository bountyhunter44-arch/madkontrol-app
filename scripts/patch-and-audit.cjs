/**
 * patch-and-audit.cjs
 *
 * 1. Patcher onboarding_answers for testlokationen med korrekte processes + areas
 * 2. Kører generateRisksFromOnboardingAnswers
 * 3. Kører generateEgenkontrolFromRiskAnalysis
 * 4. Kører syncAreaCleaningTemplates (lokalt)
 * 5. Læser alt tilbage og viser fuld rapport
 *
 * node scripts/patch-and-audit.cjs
 * node scripts/patch-and-audit.cjs --dry-run   (ingen Firestore-writes)
 */
"use strict";

const admin = require("firebase-admin");
const path  = require("path");
const serviceAccount = require(path.resolve(__dirname, "../serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId:  serviceAccount.project_id
  });
}

const db         = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const COMPANY_ID  = "onboarding_aroi-d";
const LOCATION_ID = "onboarding_aroi-d__main";
const DRY_RUN     = process.argv.includes("--dry-run");

// ─── Hvad vi skriver til onboarding_answers ───────────────────────────────
// Samme format som upsertOnboardingAnswersDocument forventer fremover
const PATCH_PROCESSES = [
  "receive_chilled_goods",
  "receive_frozen_goods",
  "store_chilled_goods",
  "store_frozen_goods",
  "cook_food",
  "hot_hold_food",
  "cool_food",
  "reheat_food",
  "serve_cold_food"
];

const PATCH_AREAS = [
  "kitchen",
  "serving_area",
  "dry_storage",
  "dishwashing_area",
  "toilet"
];

const PATCH_SPECIAL_CONDITIONS = ["handles_allergens"];

const PATCH_EQUIPMENT_COUNTS = { fridge: 3, freezer: 3, ice_machine: 1 };

// ─── AREA DEFINITIONS (spejling af functions/index.js) ───────────────────
const AREA_CLEANING_DEFINITIONS = [
  { areaKey: "kitchen",            title: "Rengøring af køkken",              frequency: "daily",  riskLevel: "high",   guideBody: "Rengør og desinficér alle køkkenoverflader: bordplader, gulv, vaskestationer og udstyr." },
  { areaKey: "production_kitchen", title: "Rengøring af produktionskøkken",   frequency: "daily",  riskLevel: "high",   guideBody: "Rengør produktionsoverflader og -udstyr. Tip affaldsposer og skift. Rengør gulv, vask og dræn." },
  { areaKey: "serving_area",       title: "Rengøring af serveringsområde",    frequency: "daily",  riskLevel: "medium", guideBody: "Rengør borde, stole, buffet og serveringsstationer." },
  { areaKey: "dry_storage",        title: "Rengøring af tørlager",            frequency: "weekly", riskLevel: "low",    guideBody: "Rengør hylder og gulv. Kontrollér holdbarhedsdatoer og kontrollér for skadedyr." },
  { areaKey: "toilet",             title: "Rengøring af toilet og håndvask",  frequency: "daily",  riskLevel: "high",   guideBody: "Rengør og desinficér toilet, håndvask og gulv. Fyld sæbe og papirhåndklæder op." },
  { areaKey: "dishwashing_area",   title: "Rengøring af opvaskområde",        frequency: "daily",  riskLevel: "medium", guideBody: "Rengør opvaskemaskine, bakkestativ og gulvafløb." },
  { areaKey: "washing_room",       title: "Rengøring af vaskerum",            frequency: "daily",  riskLevel: "medium", guideBody: "Rengør vaskerum og dræn." },
  { areaKey: "vegetable_room",     title: "Rengøring af grøntrum",            frequency: "daily",  riskLevel: "medium", guideBody: "Rengør hylder og gulv. Fjern blade og affald." },
  { areaKey: "walk_in_cooler_room",title: "Rengøring af kølerum",             frequency: "daily",  riskLevel: "high",   guideBody: "Rengør gulv og hylder. Kontrollér dørpakninger og gulvafløb." },
  { areaKey: "walk_in_freezer_room",title: "Rengøring af fryserum",           frequency: "weekly", riskLevel: "medium", guideBody: "Rengør gulv og hylder. Afrim om nødvendigt." },
];

// ─── STEP 1: Læs nuværende state ─────────────────────────────────────────
async function readBefore() {
  console.log("══ FØR PATCH ═════════════════════════════════════════════════\n");

  const oaSnap = await db.collection("onboarding_answers").where("locationId", "==", LOCATION_ID).get();
  console.log(`onboarding_answers (${oaSnap.size} docs):`);
  for (const doc of oaSnap.docs) {
    const d = doc.data() || {};
    console.log(`  ${doc.id}:`);
    console.log(`    processes:  ${JSON.stringify(d.processes || [])}`);
    console.log(`    areas:      ${JSON.stringify(d.areas || [])}`);
    console.log(`    equipmentCounts: ${JSON.stringify(d.equipmentCounts || {})}`);
  }

  const risksSnap = await db.collection("risks").where("locationId", "==", LOCATION_ID).get();
  console.log(`\nrisks: ${risksSnap.size} docs`);
  for (const doc of risksSnap.docs) {
    const d = doc.data();
    console.log(`  ${doc.id} → processKey=${d.processKey || "?"}`);
  }

  const tmplSnap = await db.collection("task_templates").where("locationId", "==", LOCATION_ID).get();
  const bySource = {};
  for (const doc of tmplSnap.docs) {
    const src = doc.data().templateSource || "unknown";
    bySource[src] = (bySource[src] || 0) + 1;
  }
  console.log(`\ntask_templates: ${tmplSnap.size} total`);
  for (const [src, cnt] of Object.entries(bySource)) {
    console.log(`  ${src}: ${cnt}`);
  }
  console.log();
}

// ─── STEP 2: Patch onboarding_answers ────────────────────────────────────
async function patchOnboardingAnswers() {
  console.log("══ PATCH onboarding_answers ══════════════════════════════════");
  const docId = `${COMPANY_ID}__${LOCATION_ID}__onboarding`;
  const ref   = db.collection("onboarding_answers").doc(docId);

  if (DRY_RUN) {
    console.log(`[DRY_RUN] ville skrive til: ${docId}`);
    console.log(`  processes: ${JSON.stringify(PATCH_PROCESSES)}`);
    console.log(`  areas: ${JSON.stringify(PATCH_AREAS)}`);
    return;
  }

  await ref.set({
    companyId:         COMPANY_ID,
    locationId:        LOCATION_ID,
    organizationId:    COMPANY_ID,
    processes:         PATCH_PROCESSES,
    areas:             PATCH_AREAS,
    specialConditions: PATCH_SPECIAL_CONDITIONS,
    equipmentCounts:   PATCH_EQUIPMENT_COUNTS,
    businessTypes:     ["restaurant"],
    serviceTypes:      ["dine_in"],
    ingredients:       [],
    source:            "manual_patch",
    updatedAt:         FieldValue.serverTimestamp()
  }, { merge: true });

  console.log(`  ✅ Wrote to: ${docId}`);
  console.log(`  processes: ${PATCH_PROCESSES.join(", ")}`);
  console.log(`  areas: ${PATCH_AREAS.join(", ")}`);
}

// ─── STEP 3: Generate risks ───────────────────────────────────────────────
async function stepRisks() {
  console.log("\n══ generateRisksFromOnboardingAnswers ════════════════════════");
  if (DRY_RUN) { console.log("[DRY_RUN] springer over"); return; }

  const { generateRisksFromOnboardingAnswers } = require(
    path.resolve(__dirname, "../functions/admin/generateRisksFromOnboardingAnswers.js")
  );
  const result = await generateRisksFromOnboardingAnswers({ locationId: LOCATION_ID });
  console.log(`  ✅ created=${result.created} updated=${result.updated} skipped=${result.skipped}`);
  if (result.details) {
    for (const d of result.details) {
      console.log(`  onboarding ${d.onboardingId}: ${d.totalRules} rules proceseret`);
    }
  }
}

// ─── STEP 4: Generate risk templates ─────────────────────────────────────
async function stepTemplates() {
  console.log("\n══ generateEgenkontrolFromRiskAnalysis ═══════════════════════");
  if (DRY_RUN) { console.log("[DRY_RUN] springer over"); return; }

  const { generateEgenkontrolFromRiskAnalysis } = require(
    path.resolve(__dirname, "../functions/admin/generateEgenkontrolFromRiskAnalysis.js")
  );
  // Send IKKE db herfra — undgå FieldValue-konflikt mellem to firebase-admin instanser
  const result = await generateEgenkontrolFromRiskAnalysis({ locationId: LOCATION_ID });
  console.log(`  ✅ created=${result.created} updated=${result.updated} skipped=${result.skipped} total=${result.totalTemplates}`);
}

// ─── STEP 5: Sync area cleaning templates ────────────────────────────────
async function stepAreaTemplates() {
  console.log("\n══ syncAreaCleaningTemplates (local) ════════════════════════");
  if (DRY_RUN) { console.log("[DRY_RUN] springer over"); return; }

  const canonicalDocId = `${COMPANY_ID}__${LOCATION_ID}__onboarding`;
  const oaDoc = await db.collection("onboarding_answers").doc(canonicalDocId).get();
  const areas = oaDoc.exists ? ((oaDoc.data() || {}).areas || []) : [];
  const activeAreas = new Set(areas.length > 0 ? areas : ["kitchen"]);
  console.log(`  areas fra onboarding_answers: ${[...activeAreas].join(", ")}`);

  const nowTs = FieldValue.serverTimestamp();
  let created = 0, skipped = 0;

  for (const def of AREA_CLEANING_DEFINITIONS) {
    if (!activeAreas.has(def.areaKey)) continue;
    const docId = `${COMPANY_ID}_${LOCATION_ID}_area_cleaning_${def.areaKey}`;
    const ref   = db.collection("task_templates").doc(docId);
    const snap  = await ref.get();
    if (snap.exists) { skipped++; continue; }
    await ref.set({
      templateId:     docId, companyId: COMPANY_ID, organizationId: COMPANY_ID, locationId: LOCATION_ID,
      areaKey:        def.areaKey, title: def.title, description: def.guideBody,
      category:       "area_cleaning", controlType: "cleaning_check",
      libraryType:    "operational", templateType:   "operational",
      templateSource: "area_cleaning_library", sourceType: "area_cleaning_library",
      frequency:      def.frequency, frequencyType:  def.frequency,
      riskLevel:      def.riskLevel, fields: [], rules: [],
      actions:        { allowApprove: true, allowDeviation: true },
      guideTitle:     `Vejledning: ${def.title}`, guideBody: def.guideBody,
      schemaVersion:  1, isActive: true, active: true,
      createdAt: nowTs, updatedAt: nowTs
    });
    created++;
    console.log(`  created: ${docId}`);
  }
  console.log(`  ✅ created=${created} skipped=${skipped}`);
}

// ─── AUDIT: Læs alt tilbage ──────────────────────────────────────────────
async function readAfter() {
  console.log("\n\n══ EFTER PATCH — faktisk tilstand ════════════════════════════\n");

  // risks
  const risksSnap = await db.collection("risks").where("locationId", "==", LOCATION_ID).get();
  console.log(`── risks (${risksSnap.size} docs) ──────────────────────────────`);
  for (const doc of risksSnap.docs) {
    const d = doc.data();
    const ccp = d.isCCP ? "CCP" : "GMP";
    console.log(`  ${ccp} ${doc.id}`);
    console.log(`      processKey=${d.processKey}  controlType=${d.controlType}  isCCP=${d.isCCP}`);
  }

  // task_templates
  const tmplSnap = await db.collection("task_templates").where("locationId", "==", LOCATION_ID).get();

  const processDaily  = [];
  const unitDaily     = [];
  const areaDaily     = [];
  const monthlyMaint  = [];
  const other         = [];

  for (const doc of tmplSnap.docs) {
    const d   = doc.data() || {};
    const src = d.templateSource || d.sourceType || "";
    const frq = d.frequency || d.frequencyType || "";
    const cat = (d.category || "").toLowerCase();
    const active = d.isActive !== false;

    if (src === "area_cleaning_library") {
      areaDaily.push({ doc, active });
    } else if (src === "equipment_maintenance_library" || (cat === "vedligeholdelse" && (frq === "weekly" || frq === "monthly"))) {
      monthlyMaint.push({ doc, active });
    } else if (src === "equipment_cleaning_library" || cat === "rengøring") {
      unitDaily.push({ doc, active });
    } else if (src === "risk_analysis") {
      processDaily.push({ doc, active });
    } else {
      other.push({ doc, active });
    }
  }

  const fmt = ({ doc, active }) => {
    const d = doc.data();
    const freq = d.frequency || "?";
    const mark = active ? "✅" : "❌";
    return `  ${mark} [${freq.padEnd(12)}] ${(d.title || doc.id).padEnd(52)} (${d.templateSource || "?"})`;
  };

  console.log(`\n── PROCESS-DAGLIGE / risk_analysis (${processDaily.length}) ─────────────────────`);
  for (const item of processDaily) console.log(fmt(item));
  if (processDaily.length === 0) console.log("  (ingen)");

  console.log(`\n── ENHEDSBASEREDE / cleaning_library (${unitDaily.length}) ──────────────────────`);
  for (const item of unitDaily) console.log(fmt(item));

  console.log(`\n── OMRÅDEBASEREDE / area_cleaning_library (${areaDaily.length}) ────────────────`);
  for (const item of areaDaily) console.log(fmt(item));
  if (areaDaily.length === 0) console.log("  (ingen)");

  console.log(`\n── VEDLIGEHOLDELSE / maintenance_library (${monthlyMaint.length}) ─────────────`);
  for (const item of monthlyMaint) console.log(fmt(item));

  if (other.length > 0) {
    console.log(`\n── ØVRIGE (${other.length}) ─────────────────────────────────────────────`);
    for (const item of other) {
      const d = item.doc.data();
      const mark = item.active ? "✅" : "❌";
      console.log(`  ${mark} ${item.doc.id.padEnd(65)} src=${d.templateSource || "?"} type=${d.templateType || "?"}`);
    }
  }

  // ── Kravcheck ──────────────────────────────────────────────────────────
  console.log("\n── KRAVCHECK ─────────────────────────────────────────────────");
  const processRiskTemplates = processDaily.filter(i => i.active);
  const allActiveTitles = processRiskTemplates.map(i => (i.doc.data().title || "").toLowerCase());

  function check(label, test) {
    console.log(`  ${test ? "✅" : "❌"} ${label}`);
  }

  check("Nedkøling (cooling_process)",          allActiveTitles.some(t => t.includes("nedkøl") || t.includes("cooling")));
  check("Varmholdelse (hot_holding)",            allActiveTitles.some(t => t.includes("varmhold") || t.includes("hot hold")));
  check("Opvarmning/genopvarmning",              allActiveTitles.some(t => t.includes("opvarm") || t.includes("varmebehandl") || t.includes("genopvarm")));
  check("Varemodtagelse (receiving_control)",    allActiveTitles.some(t => t.includes("modtag") || t.includes("receiving")));
  check("Opbevaring køl (temp_cooling)",         allActiveTitles.some(t => t.includes("køl") || t.includes("temperaturkontrol")));
  check("Opbevaring frost (temp_freezing)",      allActiveTitles.some(t => t.includes("frost") || t.includes("frys")));
  check("Allergen-/adskillelseskontrol",         allActiveTitles.some(t => t.includes("allergen") || t.includes("adskil")));
  check("Temperaturkontrol pr. enhed (unit)",    unitDaily.some(i => i.active));
  check("Vedligeholdelse (maintenance)",         monthlyMaint.some(i => i.active));
  check("Områderengøring (area_cleaning)",       areaDaily.some(i => i.active));

  console.log(`\n  Total aktive process-daglige templates: ${processRiskTemplates.length}`);
  console.log(`  Total aktive enhedsbaserede:            ${unitDaily.filter(i => i.active).length}`);
  console.log(`  Total aktive områderengøring:           ${areaDaily.filter(i => i.active).length}`);
  console.log(`  Total aktive vedligeholdelse:           ${monthlyMaint.filter(i => i.active).length}`);
  console.log(`  TOTAL task_templates for lokationen:   ${tmplSnap.size}\n`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n[patch-and-audit] company=${COMPANY_ID}  location=${LOCATION_ID}  DRY_RUN=${DRY_RUN}\n`);

  await readBefore();
  await patchOnboardingAnswers();
  await stepRisks();
  await stepTemplates();
  await stepAreaTemplates();
  await readAfter();

  process.exit(0);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
