"use strict";
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const COMPANY_ID  = "onboarding_aroi-d";
const LOCATION_ID = "onboarding_aroi-d__main";

async function main() {
  // Find alle temperature_check instances der IKKE har equipmentId (generiske)
  const snap = await db.collection("task_instances")
    .where("companyId",    "==", COMPANY_ID)
    .where("locationId",   "==", LOCATION_ID)
    .where("controlType",  "==", "temperature_check")
    .get();

  const toDelete = snap.docs.filter(doc => {
    const d = doc.data() || {};
    const eq = d.equipmentId || "";
    return !eq; // generisk = ingen konkret enhed
  });

  if (toDelete.length === 0) {
    console.log("Ingen generiske temperature_check instances fundet.");
    process.exit(0);
  }

  console.log(`Sletter ${toDelete.length} generiske temperature_check instances:`);
  const batch = db.batch();
  for (const doc of toDelete) {
    console.log(` DEL  ${doc.id}`);
    batch.delete(doc.ref);
  }
  await batch.commit();
  console.log("Slettet.");
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
