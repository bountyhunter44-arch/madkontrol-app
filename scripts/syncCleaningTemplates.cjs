/**
 * syncCleaningTemplates.cjs
 *
 * Opretter equipment-baserede rengøringsrutiner i task_templates for én location.
 * Bruger samme mønster som syncEquipmentUnits.cjs.
 *
 * DRY_RUN = true   → vis hvad der ville ske, skriv ingenting
 * DRY_RUN = false  → skriv templates til Firestore
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
const DRY_RUN    = false;
const COMPANY_ID  = "onboarding_aroi-d";
const LOCATION_ID = "onboarding_aroi-d__main";
// ─────────────────────────────────────────────────────────────────────────────

// Spejling af EQUIPMENT_CLEANING_TEMPLATE_DEFINITIONS i functions/index.js
const EQUIPMENT_CLEANING_TEMPLATE_DEFINITIONS = [
  { key: "cleaning_fridge_control",          equipmentType: "fridge",          titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rengør og desinficér køleskab grundigt. Fjern alle varer. Rengør hylder, skuffer og gummilister. Tør indvendigt tørt. Placer varerne tilbage. Kontrollér at døren lukker tæt." },
  { key: "cleaning_freezer_control",         equipmentType: "freezer",         titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Afrim og rengør fryser. Fjern alle varer og isbelægning. Rengør indvendigt med godkendt middel. Tør af og sæt varerne tilbage. Kontrollér temperatur efterfølgende." },
  { key: "cleaning_fryer_control",           equipmentType: "fryer",           titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Sluk og afkøl frituregryden. Tøm og filtrer olien. Rengør kar, kurve og varmeelementer. Kontrollér oliernes kvalitet. Varm op til driftstemperatur igen." },
  { key: "cleaning_dishwasher_control",      equipmentType: "dishwasher",      titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rens opvaskemaskinens filtre, arme og indre vægge. Kontrollér afkalkningsmiddel og skyllemiddel. Kør tomt program. Kontrollér skylletemperatur (min. 82°C)." },
  { key: "cleaning_ice_machine_control",     equipmentType: "ice_machine",     titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rengør isterningemaskinen dagligt. Tøm beholderen og rengør indvendigt. Skyl grundigt. Kontrollér at ingen snavs eller slim er synlig." },
  { key: "cleaning_softice_control",         equipmentType: "softice_machine", titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rens softice-maskinen dagligt. Skil løse dele ad. Rengør og desinficér alle overflader. Skyl og sæt sam­men igen." },
  { key: "cleaning_display_fridge_control",  equipmentType: "display_fridge",  titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Tøm displaykøl. Rengør hylder og vægge indvendigt. Kontrollér gummilister. Tør af og fyld op. Kontrollér temperatur." },
  { key: "cleaning_warming_cabinet_control", equipmentType: "warming_cabinet", titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rengør varmeskab. Fjern madrester. Rengør med varmt vand og godkendt middel. Tør af. Kontrollér varmeelementer og termostat." },
  { key: "cleaning_blast_chiller_control",   equipmentType: "blast_chiller",   titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rengør blast chiller efter brug. Fjern madrester. Rengør indvendigt. Kontrollér fordamper. Tør og klargør til næste brug." },
];

async function main() {
  console.log(`[syncCleaningTemplates] DRY_RUN=${DRY_RUN}  company=${COMPANY_ID}  location=${LOCATION_ID}\n`);

  // Hent aktive equipment docs
  const eqSnap = await db.collection("equipment")
    .where("locationId", "==", LOCATION_ID)
    .get();

  const activeTypes = new Set();
  for (const doc of eqSnap.docs) {
    const d = doc.data() || {};
    if (d.active === false) continue;
    const type = (d.type || d.equipmentType || "").toLowerCase().trim();
    if (type) activeTypes.add(type);
  }

  console.log(`[syncCleaningTemplates] aktive equipment-typer: ${[...activeTypes].join(", ") || "(ingen)"}\n`);

  if (activeTypes.size === 0) {
    console.log("[syncCleaningTemplates] Ingen aktive equipment docs — afslutter.");
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const def of EQUIPMENT_CLEANING_TEMPLATE_DEFINITIONS) {
    if (!activeTypes.has(def.equipmentType)) continue;

    const docId = `${COMPANY_ID}_${LOCATION_ID}_${def.key}`;
    const ref = db.collection("task_templates").doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
      console.log(`  SKIP (exists)  ${docId}`);
      skipped++;
      continue;
    }

    console.log(`  CREATE  ${docId}  (equipmentType=${def.equipmentType})`);

    if (!DRY_RUN) {
      await ref.set({
        templateId:    docId,
        id:            def.key,
        companyId:     COMPANY_ID,
        organizationId: COMPANY_ID,
        locationId:    LOCATION_ID,
        title:         def.titleBase,
        description:   def.guideBody || "",
        category:      def.category,
        controlType:   def.controlType,
        equipmentType: def.equipmentType,
        libraryType:   "operational",
        templateType:  "operational",
        templateSource: "equipment_cleaning_library",
        sourceType:    "equipment_cleaning_library",
        frequency:     def.frequency,
        frequencyType: def.frequency,
        frequencyDays: def.frequency === "weekly" ? 7 : 1,
        riskLevel:     def.riskLevel,
        fields:        [],
        rules:         [],
        actions:       { allowApprove: true, allowDeviation: true },
        guideTitle:    `Vejledning: ${def.titleBase}`,
        guideBody:     def.guideBody || "",
        schemaVersion: 1,
        isActive:      true,
        active:        true,
        createdAt:     FieldValue.serverTimestamp(),
        updatedAt:     FieldValue.serverTimestamp(),
      });
    }
    created++;
  }

  console.log(`\n[syncCleaningTemplates] summary: created=${created}  skipped(exists)=${skipped}  DRY_RUN=${DRY_RUN}`);
  if (DRY_RUN) {
    console.log("[syncCleaningTemplates] DRY_RUN — ingen ændringer skrevet.");
  }
}

main().catch((err) => {
  console.error("[syncCleaningTemplates] FEJL:", err.message);
  process.exit(1);
});
