const admin = require('../node_modules/firebase-admin');
const sa = require('../serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const COMPANY_ID = 'onboarding_aroi-d';
const LOCATION_ID = 'onboarding_aroi-d__main';

async function main() {
  // 1. Equipment units
  const unitsSnap = await db.collection('equipment_units')
    .where('companyId', '==', COMPANY_ID)
    .where('locationId', '==', LOCATION_ID)
    .get();

  console.log(`\n=== EQUIPMENT UNITS (${unitsSnap.size}) ===`);
  const units = unitsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  units.sort((a,b) => (a.equipmentType||'').localeCompare(b.equipmentType||''));
  for (const u of units) {
    console.log(`  [${u.equipmentType||'?'}] ${(u.name||u.title||u.id).padEnd(35)} id=${u.id}`);
  }

  // 2. Templates grouped by equipmentId
  const tplSnap = await db.collection('task_templates')
    .where('companyId', '==', COMPANY_ID)
    .where('locationId', '==', LOCATION_ID)
    .get();

  const tplByEq = {};
  tplSnap.docs.forEach(d => {
    const t = d.data();
    const key = t.equipmentId || t.equipmentType || 'GENERIC';
    if (!tplByEq[key]) tplByEq[key] = [];
    tplByEq[key].push({ id: d.id, ...t });
  });

  console.log(`\n=== TEMPLATES BY EQUIPMENT (${tplSnap.size} total) ===`);
  for (const [eq, docs] of Object.entries(tplByEq)) {
    console.log(`\n  Equipment: ${eq}`);
    for (const t of docs) {
      const active = t.isActive === false ? ' [INACTIVE]' : '';
      console.log(`    ${(t.title||t.name||t.id).padEnd(45)} src=${t.templateSource||'?'} ctrl=${t.controlType||'?'}${active}`);
    }
  }

  // 3. Check for koel/frys equipment units specifically
  const koelTypes = units.filter(u => ['refrigerator','koel','fridge','cooler'].some(k => (u.equipmentType||'').toLowerCase().includes(k)));
  const frysTypes = units.filter(u => ['freezer','frys'].some(k => (u.equipmentType||'').toLowerCase().includes(k)));
  console.log(`\n=== KØLESKABE (${koelTypes.length}) ===`);
  koelTypes.forEach(u => console.log(`  ${u.id}: ${u.name||u.title||''} type=${u.equipmentType}`));
  console.log(`\n=== FRYSERE (${frysTypes.length}) ===`);
  frysTypes.forEach(u => console.log(`  ${u.id}: ${u.name||u.title||''} type=${u.equipmentType}`));

  // 4. Onboarding data
  const obSnap = await db.collection('onboarding_sessions')
    .where('companyId', '==', COMPANY_ID)
    .get();
  if (obSnap.size > 0) {
    const ob = obSnap.docs[0].data();
    console.log('\n=== ONBOARDING equipment selection ===');
    const equip = ob.equipment || ob.equipmentSelection || ob.selectedEquipment || {};
    console.log(JSON.stringify(equip, null, 2));
  } else {
    // Try locations collection
    const locSnap = await db.collection('locations').doc(LOCATION_ID).get();
    if (locSnap.exists) {
      const loc = locSnap.data();
      console.log('\n=== LOCATION DATA (equipment) ===');
      const equip = loc.equipment || loc.equipmentCounts || loc.onboarding || {};
      console.log(JSON.stringify(equip, null, 2));
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
