const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const SEARCH_KEYWORDS = ['vand', 'water', 'drikke', 'vedligehold', 'maintenance'];

async function findWaterLikeTasks() {
  console.log('[findWaterLikeTasks] Starting search...');
  
  const companyId = "onboarding_aroi-d";
  const locationId = "onboarding_aroi-d__main";
  
  const collections = ['task_instances', 'task_entries'];
  
  for (const collectionName of collections) {
    console.log(`\n=== Searching ${collectionName} ===`);
    
    const snapshot = await db.collection(collectionName).get();
    console.log(`[findWaterLikeTasks] Found ${snapshot.size} docs in ${collectionName}`);
    
    let matchCount = 0;
    
    snapshot.forEach(doc => {
      const task = doc.data();
      
      if (task.companyId !== companyId || task.locationId !== locationId) {
        return;
      }
      
      const searchFields = [
        task.title,
        task.category,
        task.guideKey,
        task.templateType,
        task.scheduleType,
        task.source,
        task.templateSource,
        task.taskType,
        task.description,
        task.label,
        task.name,
        task.controlType
      ];
      
      const combinedText = searchFields
        .filter(field => field)
        .join(' ')
        .toLowerCase();
      
      const hasKeyword = SEARCH_KEYWORDS.some(keyword => combinedText.includes(keyword));
      
      if (hasKeyword) {
        matchCount++;
        console.log('[WATER_LIKE_TASK]', {
          collection: collectionName,
          docId: doc.id,
          path: doc.ref.path,
          title: task.title || null,
          category: task.category || null,
          guideKey: task.guideKey || null,
          templateType: task.templateType || null,
          scheduleType: task.scheduleType || null,
          scheduleConfig: task.scheduleConfig || null,
          source: task.source || null,
          templateSource: task.templateSource || null,
          taskType: task.taskType || null,
          label: task.label || null,
          name: task.name || null,
          controlType: task.controlType || null,
          companyId: task.companyId || null,
          locationId: task.locationId || null,
          dateKey: task.dateKey || null
        });
      }
    });
    
    console.log(`[findWaterLikeTasks] Found ${matchCount} matching docs in ${collectionName}`);
  }
  
  console.log('\n[findWaterLikeTasks] Search complete.');
  process.exit(0);
}

findWaterLikeTasks().catch(err => {
  console.error('[findWaterLikeTasks] Error:', err);
  process.exit(1);
});
