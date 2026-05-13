const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const SRC_LOCATION = 'location_1';
const DST_LOCATION = 'location_demo_1';
const DST_COMPANY = 'company_demo_1';

function getTodayKey() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Copenhagen',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

async function run() {
  const todayKey = getTodayKey();

  const sourceTemplates = await db
    .collection('task_templates')
    .where('locationId', '==', SRC_LOCATION)
    .where('isActive', '==', true)
    .get();

  console.log('SOURCE_TEMPLATES', sourceTemplates.size);

  let upserted = 0;
  for (const docSnap of sourceTemplates.docs) {
    const data = docSnap.data() || {};
    const targetId = `${docSnap.id}__${DST_LOCATION}`;

    await db.collection('task_templates').doc(targetId).set(
      {
        ...data,
        companyId: DST_COMPANY,
        organizationId: DST_COMPANY,
        locationId: DST_LOCATION,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    upserted += 1;
  }

  console.log('UPSERTED', upserted, 'templates to', DST_LOCATION);

  const runId = `${DST_COMPANY}__${DST_LOCATION}__${todayKey}`;
  await db.collection('daily_runs').doc(runId).delete().catch(() => {});
  console.log('DELETED_DAILY_RUN_IF_EXISTS', runId);

  const destTemplates = await db
    .collection('task_templates')
    .where('locationId', '==', DST_LOCATION)
    .where('isActive', '==', true)
    .get();

  console.log('DEST_TEMPLATES_NOW', destTemplates.size);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('FAILED', error);
    process.exit(1);
  });
