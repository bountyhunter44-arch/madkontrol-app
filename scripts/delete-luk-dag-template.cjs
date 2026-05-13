const admin = require('../node_modules/firebase-admin');
const sa = require('../serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  const snap = await db.collection('task_templates')
    .where('templateSource', '==', 'process_drift_library')
    .get();

  let deleted = 0;
  const batch = db.batch();

  for (const doc of snap.docs) {
    const data = doc.data();
    if ((data.key || doc.id).includes('luk_dag')) {
      console.log('DELETE', doc.id, '—', data.title);
      batch.delete(doc.ref);
      deleted++;
    }
  }

  if (deleted > 0) {
    await batch.commit();
    console.log(`\n✅ Deleted ${deleted} luk_dag template(s)`);
  } else {
    console.log('No luk_dag templates found');
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
