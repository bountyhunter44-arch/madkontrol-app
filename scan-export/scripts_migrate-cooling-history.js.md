# FILE: scripts/migrate-cooling-history.js

```javascript
/**
 * Migration Script: Create cooling_history from existing cooling entries
 */

const admin = require("firebase-admin");
const { createCoolingHistoryRecord } = require("../functions/egenkontrol/models/coolingHistoryModel");

admin.initializeApp();

async function migrateCoolingHistory() {
  const db = admin.firestore();
  
  console.log("🔍 Finding existing cooling entries...");
  
  const entriesSnapshot = await db.collection("task_entries")
    .where("entryType", "==", "cooling_control")
    .get();
  
  console.log(`📊 Found ${entriesSnapshot.size} cooling entries`);
  
  if (entriesSnapshot.empty) {
    console.log("✅ No cooling entries to migrate");
    return;
  }
  
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const entryDoc of entriesSnapshot.docs) {
    const entry = entryDoc.data();
    
    try {
      // Check if already migrated
      const historyId = `cooling_history_${entry.entryId}_migration`;
      const existingHistory = await db.collection("cooling_history").doc(historyId).get();
      
      if (existingHistory.exists) {
        console.log(`⏭️  Skipping ${entry.entryId} (already migrated)`);
        skipped++;
        continue;
      }
      
      // Create history record
      const historyRecord = createCoolingHistoryRecord(entry, entry.evaluation || {});
      historyRecord.historyId = historyId; // Use consistent ID for migration
      historyRecord.migrated = true;
      
      await db.collection("cooling_history").doc(historyRecord.historyId).set(historyRecord);
      
      console.log(`✅ Migrated ${entry.entryId}`);
      migrated++;
      
    } catch (error) {
      console.error(`❌ Error migrating ${entry.entryId}:`, error.message);
      errors++;
    }
  }
  
  console.log("\n📈 Migration Summary:");
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total: ${entriesSnapshot.size}`);
}

migrateCoolingHistory()
  .then(() => {
    console.log("\n✅ Migration complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  });

```
