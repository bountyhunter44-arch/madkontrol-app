const admin = require('../node_modules/firebase-admin');
const sa = require('../serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const LOCATION_ID = 'onboarding_aroi-d__main';
const TODAY = '2026-04-05';

async function main() {
  const snap = await db.collection('task_templates')
    .where('locationId', '==', LOCATION_ID)
    .get();

  const legacy = snap.docs.filter(d => {
    const id = d.id;
    return (id.includes('__temp__fridge') || id.includes('__temp__freezer')) && !d.data().controlType;
  });

  console.log(`Found ${legacy.length} legacy temp templates`);

  const batch1 = db.batch();
  for (const d of legacy) {
    const isFridge  = d.id.includes('__temp__fridge');
    const isFreezer = d.id.includes('__temp__freezer');
    const update = {
      controlType:        'temperature',
      formType:           'temperature',
      requiresMeasurement: true,
      measurementUnit:    '°C',
      templateSource:     isFridge ? 'equipment_temp_library' : 'equipment_temp_library',
      templateType:       'operational',
      isActive:           true,
      active:             true,
    };
    if (isFridge) {
      update.limitMax = 5;
      update.limitMin = null;
    } else if (isFreezer) {
      update.limitMax = -18;
      update.limitMin = null;
    }
    console.log(`TEMPLATE ${d.id} →`, update);
    batch1.update(d.ref, update);
  }
  await batch1.commit();
  console.log(`✅ Patched ${legacy.length} legacy templates`);

  // Patch today's instances
  const iSnap = await db.collection('task_instances')
    .where('locationId', '==', LOCATION_ID)
    .where('dateKey', '==', TODAY)
    .get();

  const legacyInst = iSnap.docs.filter(d => {
    const id = d.id;
    return (id.includes('__temp__fridge') || id.includes('__temp__freezer')) && !d.data().controlType;
  });

  console.log(`\nFound ${legacyInst.length} legacy temp instances for ${TODAY}`);
  const batch2 = db.batch();
  for (const d of legacyInst) {
    const isFridge  = d.id.includes('__temp__fridge');
    const update = {
      controlType:         'temperature',
      formType:            'temperature',
      requiresMeasurement: true,
      requiresRegistration: true,
      registrationDeferred: false,
      measurementUnit:     '°C',
      limitMax:            isFridge ? 5 : -18,
      limitMin:            null,
    };
    console.log(`INSTANCE ${d.id} → max=${update.limitMax}`);
    batch2.update(d.ref, update);
  }
  if (legacyInst.length > 0) {
    await batch2.commit();
    console.log(`✅ Patched ${legacyInst.length} legacy instances`);
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
