const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

(async () => {
  try {
    const userRecord = await auth.getUserByEmail('mn@aroid.dk');
    console.log('Found uid:', userRecord.uid);
    
    await db.collection('users').doc(userRecord.uid).set({
      email: 'mn@aroid.dk',
      companyId: 'company_demo_1',
      locationIds: ['location_demo_1'],
      primaryLocationId: 'location_demo_1',
      role: 'owner',
      name: 'Michael N',
      organizationId: 'company_demo_1',
      isActive: true
    }, { merge: true });
    
    console.log('✅ User dokument oprettet for mn@aroid.dk');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fejl:', error.message);
    process.exit(1);
  }
})();
