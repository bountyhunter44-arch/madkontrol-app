const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function findTaskInstancesPath() {
  console.log('[findTaskInstancesPath] Starting search...');
  
  const companiesSnap = await db.collection('companies').get();
  console.log(`[findTaskInstancesPath] Found ${companiesSnap.size} companies`);
  
  for (const companyDoc of companiesSnap.docs) {
    const companyId = companyDoc.id;
    
    const locationsSnap = await db
      .collection('companies')
      .doc(companyId)
      .collection('locations')
      .get();
    
    for (const locationDoc of locationsSnap.docs) {
      const locationId = locationDoc.id;
      
      const taskInstancesSnap = await db
        .collection('companies')
        .doc(companyId)
        .collection('locations')
        .doc(locationId)
        .collection('task_instances')
        .get();
      
      const count = taskInstancesSnap.size;
      
      if (count > 0) {
        console.log('[TASK_INSTANCE_PATH]', {
          companyId,
          locationId,
          count
        });
        
        const sampleDocs = taskInstancesSnap.docs.slice(0, 5);
        for (const doc of sampleDocs) {
          const task = doc.data();
          console.log('[TASK_SAMPLE]', {
            companyId,
            locationId,
            taskId: doc.id,
            title: task.title || null,
            category: task.category || null,
            templateType: task.templateType || null,
            scheduleType: task.scheduleType || null,
            scheduleConfig: task.scheduleConfig || null
          });
        }
      }
    }
  }
  
  console.log('[findTaskInstancesPath] Search complete.');
  process.exit(0);
}

findTaskInstancesPath().catch(err => {
  console.error('[findTaskInstancesPath] Error:', err);
  process.exit(1);
});
