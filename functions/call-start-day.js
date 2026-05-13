const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const { startDayForLocationCanonical } = require('./canonicalTaskEngine');

(async () => {
  try {
    const companyId = 'company_1777918459234_s1hq3qv7o';
    const locationId = 'location_1777918459234_me2rtaroj';
    const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    console.log('\n🚀 Calling startDayForLocationCanonical...');
    console.log('companyId:', companyId);
    console.log('locationId:', locationId);
    console.log('dateKey:', dateKey);
    
    // Call the function
    const result = await startDayForLocationCanonical({
      db,
      companyId,
      locationId,
      dateKey
    });
    
    console.log('\n✅ Result:', result);
    
    // Count task_instances
    console.log('\n📊 Checking task_instances...');
    const instancesQuery = await db.collection('task_instances')
      .where('companyId', '==', companyId)
      .where('locationId', '==', locationId)
      .where('dateKey', '==', dateKey)
      .get();
    
    console.log('task_instances count:', instancesQuery.size);
    
    if (instancesQuery.size > 0) {
      console.log('\n📋 Instances (first 10):');
      instancesQuery.docs.slice(0, 10).forEach((doc, idx) => {
        const data = doc.data();
        console.log(`  [${idx}] ${data.routineType} - ${data.title} (${data.status || 'pending'})`);
      });
    }
    
    console.log('\n✅ Done\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
