/**
 * syncMaintenanceTemplates.cjs
 *
 * Opretter equipment-baserede vedligeholdelsesrutiner i task_templates for én location.
 * Bruger samme mønster som syncCleaningTemplates.cjs.
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

// Spejling af EQUIPMENT_MAINTENANCE_TEMPLATE_DEFINITIONS i functions/index.js
const EQUIPMENT_MAINTENANCE_TEMPLATE_DEFINITIONS = [
  { key: "maintenance_fridge_control",         equipmentType: "fridge",          titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "weekly", riskLevel: "medium", guideBody: "Kontrollér køleskab for mekaniske fejl. Tjek termostat, kompressor og ventilator. Kontrollér gummilister og dørlukning. Afrim om nødvendigt. Rens kondensatorbakke." },
  { key: "maintenance_freezer_control",        equipmentType: "freezer",         titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "weekly", riskLevel: "medium", guideBody: "Kontrollér fryser for mekaniske fejl. Tjek termostat, kompressor og lås. Kontrollér gummilister. Afrim og rengør kondensatorbakke." },
  { key: "maintenance_walk_in_cooler_control", equipmentType: "walk_in_cooler",  titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "weekly", riskLevel: "medium", guideBody: "Kontrollér walk-in køler. Tjek kompressor, fordamper, lys og dørlukning. Kontrollér pakninger og låsemekanisme. Kontrollér gulvafløb." },
  { key: "maintenance_walk_in_freezer_control",equipmentType: "walk_in_freezer", titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "weekly", riskLevel: "medium", guideBody: "Kontrollér walk-in fryser. Tjek kompressor, fordamper, lys og dørlukning. Afgørende: ingen isophobning på fordamper. Kontrollér pakninger og låsemekanisme." },
  { key: "maintenance_fryer_control",          equipmentType: "fryer",           titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "weekly", riskLevel: "medium", guideBody: "Kontrollér frituregryde. Tjek termostat og sikkerhedsafbryder. Kontrollér varmeelement og drænsystem. Kontrollér oliestanden og oliernes kvalitet." },
  { key: "maintenance_dishwasher_control",     equipmentType: "dishwasher",      titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "weekly", riskLevel: "medium", guideBody: "Kontrollér opvaskemaskine. Tjek skylletemperatur (min. 82°C), vandtryk og doseringssystem. Rens filtre og sprøjtearme. Kontrollér tætninger og låger." },
  { key: "maintenance_ice_machine_control",    equipmentType: "ice_machine",     titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "weekly", riskLevel: "medium", guideBody: "Kontrollér isterningemaskine. Tjek vandfilter og afkølingssystem. Kontrollér at ingen slim eller alger er synlige. Efterse vandindløb og afløb." },
  { key: "maintenance_blast_chiller_control",  equipmentType: "blast_chiller",   titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "weekly", riskLevel: "medium", guideBody: "Kontrollér blast chiller. Tjek kompressor, fordamper og temperaturprobe. Kontrollér dørlukning og pakninger. Kontrollér at fordamper er fri for isophobning." },
  { key: "maintenance_warming_cabinet_control",equipmentType: "warming_cabinet", titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "weekly", riskLevel: "medium", guideBody: "Kontrollér varmeskab. Tjek termostat og varmeelement. Kontrollér temperaturjustering og dørlukning. Eftersyn af pakninger og vandskuffe (ved dampvarmeskabe)." },
  { key: "maintenance_display_fridge_control", equipmentType: "display_fridge",  titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "weekly", riskLevel: "medium", guideBody: "Kontrollér displaykøl. Tjek kompressor, belysning og dørlukning. Kontrollér gummilister og hyldeplaceringer. Rens kondensatorgitter og kontrollér afløb." },
  { key: "maintenance_softice_control",        equipmentType: "softice_machine", titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "weekly", riskLevel: "medium", guideBody: "Kontrollér softice-maskine. Tjek blandeenhed, pumper og seals. Kontrollér temperatur og viskositet. Kontrollér at sikkerhedstermostat fungerer korrekt." },
];

async function main() {
  console.log(`[syncMaintenanceTemplates] DRY_RUN=${DRY_RUN}  company=${COMPANY_ID}  location=${LOCATION_ID}\n`);

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

  console.log(`[syncMaintenanceTemplates] aktive equipment-typer: ${[...activeTypes].join(", ") || "(ingen)"}\n`);

  if (activeTypes.size === 0) {
    console.log("[syncMaintenanceTemplates] Ingen aktive equipment docs — afslutter.");
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const def of EQUIPMENT_MAINTENANCE_TEMPLATE_DEFINITIONS) {
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
        templateId:     docId,
        id:             def.key,
        companyId:      COMPANY_ID,
        organizationId: COMPANY_ID,
        locationId:     LOCATION_ID,
        title:          def.titleBase,
        description:    def.guideBody || "",
        category:       def.category,
        controlType:    def.controlType,
        equipmentType:  def.equipmentType,
        libraryType:    "operational",
        templateType:   "operational",
        templateSource: "equipment_maintenance_library",
        sourceType:     "equipment_maintenance_library",
        frequency:      def.frequency,
        frequencyType:  def.frequency,
        frequencyDays:  def.frequency === "weekly" ? 7 : def.frequency === "monthly" ? 30 : 1,
        riskLevel:      def.riskLevel,
        fields:         [],
        rules:          [],
        actions:        { allowApprove: true, allowDeviation: true },
        guideTitle:     `Vejledning: ${def.titleBase}`,
        guideBody:      def.guideBody || "",
        schemaVersion:  1,
        isActive:       true,
        active:         true,
        createdAt:      FieldValue.serverTimestamp(),
        updatedAt:      FieldValue.serverTimestamp(),
      });
    }
    created++;
  }

  console.log(`\n[syncMaintenanceTemplates] summary: created=${created}  skipped(exists)=${skipped}  DRY_RUN=${DRY_RUN}`);
  if (DRY_RUN) {
    console.log("[syncMaintenanceTemplates] DRY_RUN — ingen ændringer skrevet.");
  }
}

main().catch((err) => {
  console.error("[syncMaintenanceTemplates] FEJL:", err.message);
  process.exit(1);
});
