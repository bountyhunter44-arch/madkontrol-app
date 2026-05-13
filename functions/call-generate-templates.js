const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const { generateCanonicalTaskTemplates } = require('./canonicalTaskEngine');

(async () => {
  try {
    const companyId = 'company_1777918459234_s1hq3qv7o';
    const locationId = 'location_1777918459234_me2rtaroj';
    
    console.log('\n🚀 Calling generateCanonicalTaskTemplates...');
    console.log('companyId:', companyId);
    console.log('locationId:', locationId);
    
    // Call the function
    const result = await generateCanonicalTaskTemplates({
      db,
      companyId,
      locationId
    });
    
    console.log('\n✅ Result:', result);
    
    // Count task_templates
    console.log('\n📊 Checking task_templates...');
    const templatesQuery = await db.collection('task_templates')
      .where('companyId', '==', companyId)
      .where('locationId', '==', locationId)
      .where('isActive', '==', true)
      .get();
    
    console.log('task_templates count:', templatesQuery.size);
    
    if (templatesQuery.size > 0) {
      console.log('\n📋 Templates:');
      templatesQuery.docs.forEach((doc, idx) => {
        const data = doc.data();
        console.log(`  [${idx}] ${data.routineType || data.templateKey} - ${data.title} (${data.frequencyDays}d)`);
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
