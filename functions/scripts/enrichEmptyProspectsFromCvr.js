/**
 * enrichEmptyProspectsFromCvr.js
 *
 * Fills CVR-register data (name/phone/email) into `prospects` docs that the old enrichment left
 * empty (it mis-handled cvrapi.dk error/rate-limit 200-responses and saved blanks). Data here was
 * re-fetched from the CVR register via the assistant's web tool — node in this env has no network.
 *
 * MERGE-ONLY-EMPTY: a field is written ONLY if the record has a value AND the existing prospect
 * field is empty. Never overwrites manually entered data. Touches ONLY the `prospects` collection.
 *
 * DRY-RUN by default. Pass --apply to write.
 * Usage (DRY-RUN): node --use-system-ca functions/scripts/enrichEmptyProspectsFromCvr.js
 * Apply:           node --use-system-ca functions/scripts/enrichEmptyProspectsFromCvr.js --apply
 */
"use strict";

const path = require("path");
const admin = require("firebase-admin");

// Batch B (first 20 empty prospects), re-fetched live from the CVR register.
const RECORDS = [
  { cvr: "10003415", name: "TH. OLESEN IMPORT A/S", phone: "92444818", email: "tho@th-olesen.dk" },
  { cvr: "10006511", name: "Randers Idrætshal", phone: "", email: "mail@arenaranders.dk" },
  { cvr: "10007127", name: "NOVOZYMES A/S", phone: "44460000", email: "" },
  { cvr: "10008328", name: "OEM AUTOMATIC KLITSØ A/S", phone: "70106400", email: "" },
  { cvr: "10008638", name: "PEER SØNDERMARK", phone: "62581700", email: "" },
  { cvr: "10008824", name: "NORMANN COPENHAGEN ApS", phone: "35554459", email: "" },
  { cvr: "10011663", name: "Espresso House Denmark A/S", phone: "33939828", email: "pernille.hasselriis.nielsen@espressohouse.com" },
  { cvr: "10016371", name: "TEFCOLD A/S", phone: "86601933", email: "lm@tefcold.dk" },
  { cvr: "10016533", name: "EMPAKA KARTONNAGE A/S", phone: "48140522", email: "" },
  { cvr: "10020654", name: "CAMPING OG FERIECENTER SAMSØ ApS", phone: "86596868", email: "" },
  { cvr: "10020867", name: "CBS CAFÉERNE ApS", phone: "", email: "" },
  { cvr: "10025508", name: "VOGNMAND POUL PEDERSEN, EJBY ApS", phone: "64461639", email: "pp@poul-pedersen.dk" },
  { cvr: "10025907", name: "MARPHIL ApS", phone: "32503068", email: "" },
  { cvr: "10026164", name: "E. LAMPE PØLSEGÅRDEN ApS", phone: "74523299", email: "" },
  { cvr: "10026423", name: "DANSKE FISKEAUKTIONER A/S", phone: "96908800", email: "info@dfa.as" },
  { cvr: "10026725", name: "ST. HIPPOLYT DANMARK A/S", phone: "70205344", email: "hippolyt@hippolyt.dk" },
  { cvr: "10028922", name: "GROES BAGERI ApS", phone: "98671380", email: "" },
  { cvr: "10030358", name: "SP Moulding Lynge A/S", phone: "70233060", email: "" },
  { cvr: "10036712", name: "Årre Smede- & Maskinforretning ApS", phone: "21200500", email: "" },
  { cvr: "10036763", name: "GRØNTGROSSISTEN ApS", phone: "36308494", email: "info@groentgrossisten.dk" }
];

const has = (v) => v !== undefined && v !== null && String(v).trim() !== "";

async function main() {
  const APPLY = process.argv.slice(2).includes("--apply");

  if (!admin.apps.length) {
    const sa = require(path.join(__dirname, "../../serviceAccountKey.json"));
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
  }
  const db = admin.firestore();

  console.log("==================================================");
  console.log("enrichEmptyProspectsFromCvr  (Batch B — 20)");
  console.log("MODE:", APPLY ? "APPLY (writes)" : "DRY-RUN (no writes)");
  console.log("==================================================");

  let wouldWrite = 0, skippedNoData = 0, filledFields = 0;
  for (const rec of RECORDS) {
    const ref = db.collection("prospects").doc(rec.cvr);
    const snap = await ref.get();
    const cur = snap.exists ? (snap.data() || {}) : {};

    const patch = {};
    if (has(rec.name) && !has(cur.companyName)) patch.companyName = rec.name;
    if (has(rec.name) && !has(cur.name)) patch.name = rec.name;
    if (has(rec.phone) && !has(cur.phone)) patch.phone = rec.phone;
    if (has(rec.email) && !has(cur.email)) patch.email = rec.email;

    const fields = Object.keys(patch);
    if (!fields.length) {
      skippedNoData++;
      console.log(`  - ${rec.cvr}  (nothing to fill — already set or no data)`);
      continue;
    }
    wouldWrite++;
    filledFields += fields.length;
    console.log(`  ✎ ${rec.cvr}  ${rec.name}`);
    fields.forEach((f) => console.log(`        ${f}: ${JSON.stringify(cur[f] || "")}  ->  ${JSON.stringify(patch[f])}`));

    if (APPLY) {
      patch.enrichedAt = admin.firestore.FieldValue.serverTimestamp();
      patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      patch.importSource = "cvr_websearch_repair";
      await ref.set(patch, { merge: true });
    }
  }

  console.log("\n-- SUMMARY --");
  console.log("  prospects that would be updated:", wouldWrite);
  console.log("  fields filled:", filledFields);
  console.log("  skipped (nothing to fill):", skippedNoData);
  console.log(APPLY ? "\n[APPLY] writes committed (merge, empty-only)." : "\n  DRY-RUN — pass --apply to write.");
  console.log("==================================================");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
