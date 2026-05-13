const admin = require('../node_modules/firebase-admin');
const sa = require('../serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const LOCATION_ID = 'onboarding_aroi-d__main';

async function main() {
  const snap = await db.collection('task_templates')
    .where('locationId', '==', LOCATION_ID)
    .get();

  // Legacy templates: dem der bruger gammel __ separeret ID-format OG ikke har templateSource sat
  const legacy = snap.docs.filter(d => {
    const data = d.data();
    const id = d.id;
    // Gammel format: companyId__locationId__xxx
    const isOldFormat = id.startsWith('onboarding_aroi-d__onboarding_aroi-d__main__');
    return isOldFormat && !data.templateSource;
  });

  console.log(`Found ${legacy.size || legacy.length} legacy templates to deactivate:\n`);
  const batch = db.batch();
  for (const d of legacy) {
    const t = d.data();
    console.log(`  DEACTIVATE  ${d.id}  (${t.title || '?'})`);
    batch.update(d.ref, { isActive: false, active: false });
  }

  await batch.commit();
  console.log(`\n✅ Deactivated ${legacy.length} legacy templates`);
  console.log('De vil ikke generere nye task_instances fremover.\n');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
