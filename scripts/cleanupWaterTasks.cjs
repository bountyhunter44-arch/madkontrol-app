const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupWaterTasks() {
  console.log('[cleanupWaterTasks] Starting cleanup...');
  
  const companyId = "onboarding_aroi-d";
  const locationId = "onboarding_aroi-d__main";
  
  const tasksRef = db.collection("task_instances");
  
  const snapshot = await tasksRef.get();
  
  console.log(`[cleanupWaterTasks] Found ${snapshot.size} total task instances`);
  
  const toDelete = [];
  
  snapshot.forEach(doc => {
    const task = doc.data();
    
    if (task.companyId !== companyId || task.locationId !== locationId) {
      return;
    }
    
    const title = (task.title || '').toLowerCase();
    const category = (task.category || '').toLowerCase();
    const templateSource = task.templateSource || '';
    const controlType = task.controlType || '';
    
    if (templateSource === 'equipment_maintenance_library' ||
        category === 'vedligeholdelse' ||
        controlType === 'maintenance_check' ||
        title.startsWith('vedligeholdelse -')) {
      toDelete.push(doc.ref);
      console.log('[DELETE]', doc.ref.path, '->', task.title);
    }
  });
  
  console.log(`[cleanupWaterTasks] Found ${toDelete.length} maintenance tasks to delete`);
  
  if (toDelete.length === 0) {
    console.log('[cleanupWaterTasks] No maintenance tasks found. Exiting.');
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
    console.log(`[cleanupWaterTasks] Deleted batch ${Math.floor(i / batchSize) + 1}: ${batchRefs.length} tasks (total: ${deletedCount})`);
  }
  
  console.log(`[cleanupWaterTasks] Cleanup complete. Deleted ${deletedCount} maintenance tasks.`);
  process.exit(0);
}

cleanupWaterTasks().catch(err => {
  console.error('[cleanupWaterTasks] Error:', err);
  process.exit(1);
});
