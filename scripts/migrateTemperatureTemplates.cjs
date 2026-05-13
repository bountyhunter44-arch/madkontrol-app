/**
 * migrateTemperatureTemplates.cjs
 *
 * Migrerer eksisterende temperature_check task_templates til at have
 * eksplicit equipmentType baseret på doc-id inference.
 *
 * Påvirker KUN docs med controlType === "temperature_check" OG manglende equipmentType.
 * Alle andre templates forbliver uberørt.
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

// Kanonisk inferens: doc-id nøgleord → equipmentType
// Rækkefølge er vigtig (walk_in_cooler/freezer før cooler/freezer)
const INFERENCE_RULES = [
  { pattern: "walk_in_cooler",  equipmentType: "walk_in_cooler"  },
  { pattern: "walk_in_freezer", equipmentType: "walk_in_freezer" },
  { pattern: "blast_chiller",   equipmentType: "blast_chiller"   },
  { pattern: "display_fridge",  equipmentType: "display_fridge"  },
  { pattern: "softice",         equipmentType: "softice_machine" },
  { pattern: "warming_cabinet", equipmentType: "warming_cabinet" },
  { pattern: "freezer",         equipmentType: "freezer"         },
  { pattern: "fridge",          equipmentType: "fridge"          },
];

function inferEquipmentType(docId) {
  const lower = docId.toLowerCase();
  for (const rule of INFERENCE_RULES) {
    if (lower.includes(rule.pattern)) return rule.equipmentType;
  }
  return null;
}

async function main() {
  console.log(`[migrateTemperatureTemplates] DRY_RUN=${DRY_RUN}\n`);

  const snap = await db.collection("task_templates").get();

  const candidates = snap.docs.filter(doc => {
    const d = doc.data() || {};
    return d.controlType === "temperature_check" && !d.equipmentType;
  });

  console.log(`[migrateTemperatureTemplates] kandidater (mangler equipmentType): ${candidates.length}\n`);

  let updated = 0;
  let skipped = 0;

  for (const doc of candidates) {
    const inferred = inferEquipmentType(doc.id);

    if (!inferred) {
      console.log(`  SKIP (ukendt type)  ${doc.id}`);
      skipped++;
      continue;
    }

    console.log(`  UPDATE  ${doc.id}`);
    console.log(`          equipmentType: (none) → ${inferred}`);

    if (!DRY_RUN) {
      await doc.ref.update({
        equipmentType: inferred,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    updated++;
  }

  console.log(`\n[migrateTemperatureTemplates] summary: updated=${updated}  skipped(ukendt)=${skipped}  DRY_RUN=${DRY_RUN}`);
  if (DRY_RUN) {
    console.log("[migrateTemperatureTemplates] DRY_RUN — ingen ændringer skrevet.");
  }
}

main().catch(err => {
  console.error("[migrateTemperatureTemplates] FEJL:", err.message);
  process.exit(1);
});
