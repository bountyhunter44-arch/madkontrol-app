const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const TASK_COLLECTION_NAMES = [
  'task_instances',
  'tasks',
  'daily_tasks',
  'routine_tasks',
  'verification_instances'
];

async function findTaskCollectionsEverywhere() {
  console.log('[findTaskCollectionsEverywhere] Starting search...');
  
  // 1. List all top-level collections
  console.log('\n=== TOP-LEVEL COLLECTIONS ===');
  const topCollections = await db.listCollections();
  for (const collection of topCollections) {
    console.log('[TOP_COLLECTION]', collection.id);
  }
  
  // 2. Check specific task-like collection names at top level
  console.log('\n=== TOP-LEVEL TASK COLLECTIONS ===');
  for (const collectionName of TASK_COLLECTION_NAMES) {
    try {
      const snapshot = await db.collection(collectionName).limit(10).get();
      if (snapshot.size > 0) {
        console.log(`[TOP_TASK_COLLECTION_FOUND] ${collectionName} has ${snapshot.size} docs (showing up to 10)`);
        for (const doc of snapshot.docs) {
          const data = doc.data();
          console.log('[TOP_TASK_SAMPLE]', {
            collection: collectionName,
            docId: doc.id,
            title: data.title || null,
            category: data.category || null,
            templateType: data.templateType || null,
            scheduleType: data.scheduleType || null,
            scheduleConfig: data.scheduleConfig || null,
            companyId: data.companyId || null,
            locationId: data.locationId || null,
            dateKey: data.dateKey || null
          });
        }
      }
    } catch (err) {
      // Collection doesn't exist, skip
    }
  }
  
  // 3. Go through all companies and locations
  console.log('\n=== COMPANY/LOCATION SUBCOLLECTIONS ===');
  const companiesSnap = await db.collection('companies').get();
  console.log(`[findTaskCollectionsEverywhere] Found ${companiesSnap.size} companies`);
  
  for (const companyDoc of companiesSnap.docs) {
    const companyId = companyDoc.id;
    
    const locationsSnap = await db
      .collection('companies')
      .doc(companyId)
      .collection('locations')
      .get();
    
    for (const locationDoc of locationsSnap.docs) {
      const locationId = locationDoc.id;
      
      // List all subcollections under this location
      const subcollections = await locationDoc.ref.listCollections();
      
      for (const subcollection of subcollections) {
        console.log('[LOCATION_SUBCOLLECTION]', {
          companyId,
          locationId,
          subcollection: subcollection.id
        });
        
        // 4. If subcollection name looks like tasks, sample it
        if (TASK_COLLECTION_NAMES.includes(subcollection.id)) {
          const taskSnap = await subcollection.limit(5).get();
          console.log(`[LOCATION_TASK_COLLECTION_FOUND] ${subcollection.id} has ${taskSnap.size} docs (showing up to 5)`);
          
          for (const doc of taskSnap.docs) {
            const data = doc.data();
            console.log('[LOCATION_TASK_SAMPLE]', {
              companyId,
              locationId,
              collection: subcollection.id,
              docId: doc.id,
              title: data.title || null,
              category: data.category || null,
              templateType: data.templateType || null,
              scheduleType: data.scheduleType || null,
              scheduleConfig: data.scheduleConfig || null,
              companyId: data.companyId || null,
              locationId: data.locationId || null,
              dateKey: data.dateKey || null
            });
          }
        }
      }
    }
  }
  
  console.log('\n[findTaskCollectionsEverywhere] Search complete.');
  process.exit(0);
}

findTaskCollectionsEverywhere().catch(err => {
  console.error('[findTaskCollectionsEverywhere] Error:', err);
  process.exit(1);
});
