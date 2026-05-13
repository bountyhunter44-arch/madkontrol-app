const admin = require('../node_modules/firebase-admin');
const sa = require('../serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const COMPANY_ID  = 'onboarding_aroi-d';
const LOCATION_ID = 'onboarding_aroi-d__main';
const TODAY       = '2026-04-05';

async function main() {
  // 1. Slet task_instances for i dag
  const iSnap = await db.collection('task_instances')
    .where('locationId', '==', LOCATION_ID)
    .where('dateKey', '==', TODAY)
    .get();
  console.log(`Sletter ${iSnap.size} task_instances...`);
  const chunks = [];
  for (let i = 0; i < iSnap.docs.length; i += 499) chunks.push(iSnap.docs.slice(i, i + 499));
  for (const chunk of chunks) {
    const b = db.batch();
    chunk.forEach(d => b.delete(d.ref));
    await b.commit();
  }

  // 2. Slet daily_run for i dag
  const rSnap = await db.collection('daily_runs')
    .where('locationId', '==', LOCATION_ID)
    .where('dateKey', '==', TODAY)
    .get();
  console.log(`Sletter ${rSnap.size} daily_run docs...`);
  const b2 = db.batch();
  rSnap.docs.forEach(d => b2.delete(d.ref));
  await b2.commit();

  console.log('✅ Dag nulstillet — genindlæs rutiner.html og klik "Opdater dag"');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
