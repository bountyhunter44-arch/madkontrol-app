const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupMaintenanceEntries() {
  console.log('[cleanupMaintenanceEntries] Starting cleanup...');
  
  const companyId = "onboarding_aroi-d";
  const locationId = "onboarding_aroi-d__main";
  
  const entriesRef = db.collection("task_entries");
  
  const snapshot = await entriesRef.get();
  
  console.log(`[cleanupMaintenanceEntries] Found ${snapshot.size} total task entries`);
  
  const toDelete = [];
  
  snapshot.forEach(doc => {
    const task = doc.data();
    
    if (task.companyId !== companyId || task.locationId !== locationId) {
      return;
    }
    
    const taskType = (task.taskType || '').toLowerCase();
    
    if (taskType === 'vedligeholdelse') {
      toDelete.push(doc.ref);
      console.log('[DELETE_ENTRY]', doc.ref.path, '->', task.taskType, task.dateKey || null);
    }
  });
  
  console.log(`[cleanupMaintenanceEntries] Found ${toDelete.length} maintenance entries to delete`);
  
  if (toDelete.length === 0) {
    console.log('[cleanupMaintenanceEntries] No maintenance entries found. Exiting.');
    process.exit(0);
    return;
  }
  
  let deletedCount = 0;
  const batchSize = 500;
  
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = db.batch();
    const batchRefs = toDelete.slice(i, i + batchSize);
    
    batchRefs.forEach(ref => {
      batch.delete(ref);
    });
    
    await batch.commit();
    deletedCount += batchRefs.length;
    console.log(`[cleanupMaintenanceEntries] Deleted batch ${Math.floor(i / batchSize) + 1}: ${batchRefs.length} entries (total: ${deletedCount})`);
  }
  
  console.log(`[cleanupMaintenanceEntries] Cleanup complete. Deleted ${deletedCount} maintenance entries.`);
  process.exit(0);
}

cleanupMaintenanceEntries().catch(err => {
  console.error('[cleanupMaintenanceEntries] Error:', err);
  process.exit(1);
});
