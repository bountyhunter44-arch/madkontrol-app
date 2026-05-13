const admin = require('../node_modules/firebase-admin');
const sa = require('../serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const TEMP_CONTROL_TYPES = new Set([
  "temperature", "cooking_process", "cooling_process", "reheating_process",
  "hot_holding_control", "freezer_temperature", "cooking_control"
]);

async function main() {
  // 1. Patch task_templates
  const tSnap = await db.collection('task_templates')
    .where('templateSource', '==', 'risk_analysis')
    .get();

  const batch1 = db.batch();
  let tPatched = 0;
  for (const d of tSnap.docs) {
    const t = d.data();
    const reqMeas = TEMP_CONTROL_TYPES.has(t.controlType) || TEMP_CONTROL_TYPES.has(t.guideKey);
    const mUnit = t.unit || (reqMeas ? '°C' : '');
    const fType = reqMeas ? 'temperature' : 'check';
    const update = {};
    if (t.measurementUnit !== mUnit)      update.measurementUnit = mUnit;
    if (t.requiresMeasurement !== reqMeas) update.requiresMeasurement = reqMeas;
    if (t.formType !== fType)              update.formType = fType;
    if (Object.keys(update).length) {
      console.log(`TEMPLATE ${d.id} (${t.title}) →`, update);
      batch1.update(d.ref, update);
      tPatched++;
    }
  }
  if (tPatched > 0) { await batch1.commit(); console.log(`✅ Patched ${tPatched} templates`); }

  // 2. Patch today's task_instances for this location
  const iSnap = await db.collection('task_instances')
    .where('locationId', '==', 'onboarding_aroi-d__main')
    .where('dateKey', '==', '2026-04-05')
    .get();

  const batch2 = db.batch();
  let iPatched = 0;
  for (const d of iSnap.docs) {
    const t = d.data();
    const reqMeas = TEMP_CONTROL_TYPES.has(t.controlType) || TEMP_CONTROL_TYPES.has(t.guideKey);
    const mUnit = t.unit || t.measurementUnit || (reqMeas ? '°C' : '');
    const fType = reqMeas ? 'temperature' : 'check';
    const update = {};
    if (reqMeas && !t.requiresMeasurement) update.requiresMeasurement = true;
    if (reqMeas && !t.requiresRegistration) update.requiresRegistration = true;
    if (reqMeas && t.registrationDeferred)  update.registrationDeferred = false;
    if (mUnit && t.measurementUnit !== mUnit) update.measurementUnit = mUnit;
    if (t.formType !== fType) update.formType = fType;
    if (Object.keys(update).length) {
      console.log(`INSTANCE ${d.id} (${t.title}) →`, update);
      batch2.update(d.ref, update);
      iPatched++;
    }
  }
  if (iPatched > 0) { await batch2.commit(); console.log(`✅ Patched ${iPatched} instances`); }
  else console.log('No instances to patch');

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
