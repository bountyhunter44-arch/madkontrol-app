const admin = require('../node_modules/firebase-admin');
const sa = require('../serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const COMPANY_ID  = 'onboarding_aroi-d';
const LOCATION_ID = 'onboarding_aroi-d__main';
const NOW = admin.firestore.FieldValue.serverTimestamp();

// Equipment to add (missing units)
const MISSING_EQUIPMENT = [
  { id: 'onboarding_fridge_4',   equipmentType: 'fridge',      unitNumber: 4, title: 'Køleskab 4',        limitMax: 5,   limitMin: null, measurementUnit: '°C' },
  { id: 'onboarding_freezer_4',  equipmentType: 'freezer',     unitNumber: 4, title: 'Fryser 4',           limitMax: -18, limitMin: null, measurementUnit: '°C' },
  { id: 'onboarding_friture_1',  equipmentType: 'friture',     unitNumber: 1, title: 'Friture 1',          limitMax: null, limitMin: 170, measurementUnit: '°C' },
];

// All equipment that should have individual temp templates (including existing)
const ALL_TEMP_EQUIPMENT = [
  { equipmentType: 'fridge',   units: 4, titlePrefix: 'Køleskab', limitMax: 5,   limitMin: null },
  { equipmentType: 'freezer',  units: 4, titlePrefix: 'Fryser',   limitMax: -18, limitMin: null },
  { equipmentType: 'friture',  units: 1, titlePrefix: 'Friture',  limitMax: null, limitMin: 170 },
];

async function run() {
  const batch = db.batch();
  let ops = 0;

  // 1. Add missing equipment docs
  console.log('=== Adding missing equipment units ===');
  for (const eq of MISSING_EQUIPMENT) {
    const ref = db.collection('equipment').doc(eq.id);
    const snap = await ref.get();
    if (snap.exists) {
      console.log(`  SKIP (exists): ${eq.id}`);
      continue;
    }
    batch.set(ref, {
      companyId:     COMPANY_ID,
      organizationId: COMPANY_ID,
      locationId:    LOCATION_ID,
      source:        'onboarding',
      equipmentType: eq.equipmentType,
      type:          eq.equipmentType,
      controlTypes:  ['temperature_check'],
      controlType:   'temperature_check',
      title:         eq.title,
      name:          eq.title,
      displayName:   eq.title,
      unitNumber:    eq.unitNumber,
      active:        true,
      createdAt:     NOW,
      updatedAt:     NOW,
    });
    console.log(`  ADD: ${eq.id} → ${eq.title}`);
    ops++;
  }

  await batch.commit();
  console.log(`  Committed ${ops} equipment writes\n`);

  // 2. Provision individual temperature templates per unit
  console.log('=== Provisioning temperature templates per unit ===');
  const tplBatch = db.batch();
  let tplOps = 0;

  // Fetch existing temp templates to avoid duplicates
  const existingSnap = await db.collection('task_templates')
    .where('companyId', '==', COMPANY_ID)
    .where('locationId', '==', LOCATION_ID)
    .where('templateSource', '==', 'equipment_temp_library')
    .get();

  const existingKeys = new Set(existingSnap.docs.filter(d => d.data().isActive !== false).map(d => d.data().equipmentId || d.data().templateId || d.id));

  for (const def of ALL_TEMP_EQUIPMENT) {
    for (let i = 1; i <= def.units; i++) {
      const equipmentId = `onboarding_${def.equipmentType}_${i}`;
      const title       = `${def.titlePrefix} ${i} – Temperaturkontrol`;
      const templateId  = `${COMPANY_ID}__${LOCATION_ID}__temp__${def.equipmentType}_${i}`;

      if (existingKeys.has(equipmentId) || existingKeys.has(templateId)) {
        console.log(`  SKIP (active exists): ${title}`);
        continue;
      }

      const ref = db.collection('task_templates').doc(templateId);
      const snap = await ref.get();
      if (snap.exists && snap.data().isActive !== false) {
        console.log(`  SKIP (doc exists active): ${title}`);
        continue;
      }

      tplBatch.set(ref, {
        templateId,
        companyId:       COMPANY_ID,
        locationId:      LOCATION_ID,
        templateSource:  'equipment_temp_library',
        equipmentId,
        equipmentType:   def.equipmentType,
        equipmentTitle:  `${def.titlePrefix} ${i}`,
        title,
        name:            title,
        description:     `Mål temperaturen på ${def.titlePrefix} ${i} og noter resultatet.`,
        category:        def.equipmentType === 'fridge' || def.equipmentType === 'freezer' ? 'temperatur' : 'kontrol',
        controlType:     'temperature',
        formType:        'temperature',
        requiresMeasurement: true,
        measurementUnit: '°C',
        ...(def.limitMax !== null ? { limitMax: def.limitMax, maxValue: def.limitMax } : {}),
        ...(def.limitMin !== null ? { limitMin: def.limitMin, minValue: def.limitMin } : {}),
        frequency:       'daily',
        frequencyType:   'daily',
        isActive:        true,
        active:          true,
        createdAt:       NOW,
        updatedAt:       NOW,
      });
      console.log(`  CREATE: ${title}  (limitMax=${def.limitMax} limitMin=${def.limitMin})`);
      tplOps++;
    }
  }

  await tplBatch.commit();
  console.log(`\n  Committed ${tplOps} template writes`);
  console.log('\nDone. Re-run audit-equipment-units.cjs to verify.');
}

run().catch(console.error).finally(() => process.exit(0));
