# FILE: scripts/cleanup-database.js

```javascript
/**
 * Database Cleanup Script
 * Removes test data and ensures all documents have proper companyId/locationId
 * 
 * Run this script in Firebase Console or via Node.js with Admin SDK
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDNzCaPlot6hUdWDS4co91KW6isfLabTWI",
  authDomain: "madkontrollen.firebaseapp.com",
  projectId: "madkontrollen",
  storageBucket: "madkontrollen.firebasestorage.app",
  messagingSenderId: "690530462316",
  appId: "1:690530462316:web:f4d3e7c8e0b1a2c3d4e5f6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTIONS_TO_CLEAN = [
  'task_instances',
  'daily_runs',
  'deviations',
  'reports',
  'inventory_items',
  'inventory_transactions',
  'inventory_alerts',
  'media_assets',
  'logbook_entries',
  'service_sessions',
  'equipment',
  'documents',
  'alerts'
];

const TEST_PREFIXES = ['test_', 'demo_', 'temp_', 'old_', 'dev_'];

async function cleanupCollection(collectionName) {
  console.log(`\n🔍 Cleaning ${collectionName}...`);
  
  const snapshot = await getDocs(collection(db, collectionName));
  let deletedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  for (const docSnap of snapshot.docs) {
    const docId = docSnap.id;
    const data = docSnap.data();

    try {
      // Check if document ID is test data
      const isTestId = TEST_PREFIXES.some(prefix => docId.toLowerCase().startsWith(prefix));
      
      if (isTestId) {
        await deleteDoc(doc(db, collectionName, docId));
        console.log(`  🗑️  Deleted test document: ${docId}`);
        deletedCount++;
        continue;
      }

      // Check if document is missing critical fields
      const missingCompanyId = !data.companyId && !data.organizationId;
      const missingLocationId = !data.locationId;

      if (missingCompanyId) {
        console.log(`  ⚠️  Document ${docId} missing companyId - DELETING`);
        await deleteDoc(doc(db, collectionName, docId));
        deletedCount++;
        continue;
      }

      // Normalize organizationId to companyId
      if (data.organizationId && !data.companyId) {
        await updateDoc(doc(db, collectionName, docId), {
          companyId: data.organizationId,
          updatedAt: serverTimestamp()
        });
        console.log(`  ✏️  Normalized organizationId → companyId for ${docId}`);
        updatedCount++;
      }

      // Add missing timestamps
      const updates = {};
      if (!data.createdAt && data.created_at) {
        updates.createdAt = data.created_at;
      }
      if (!data.updatedAt && data.updated_at) {
        updates.updatedAt = data.updated_at;
      }
      if (!data.performedAt && data.performed_at) {
        updates.performedAt = data.performed_at;
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, collectionName, docId), updates);
        console.log(`  ✏️  Updated timestamps for ${docId}`);
        updatedCount++;
      }

    } catch (error) {
      console.error(`  ❌ Error processing ${docId}:`, error.message);
      errorCount++;
    }
  }

  console.log(`✅ ${collectionName}: ${deletedCount} deleted, ${updatedCount} updated, ${errorCount} errors`);
  
  return { deletedCount, updatedCount, errorCount };
}

async function runCleanup() {
  console.log('🚀 Starting database cleanup...\n');
  console.log('Collections to clean:', COLLECTIONS_TO_CLEAN.join(', '));
  console.log('Test prefixes:', TEST_PREFIXES.join(', '));
  console.log('\n' + '='.repeat(60) + '\n');

  let totalDeleted = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const collectionName of COLLECTIONS_TO_CLEAN) {
    try {
      const result = await cleanupCollection(collectionName);
      totalDeleted += result.deletedCount;
      totalUpdated += result.updatedCount;
      totalErrors += result.errorCount;
    } catch (error) {
      console.error(`❌ Failed to clean ${collectionName}:`, error.message);
      totalErrors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 CLEANUP SUMMARY:');
  console.log(`   🗑️  Total deleted: ${totalDeleted}`);
  console.log(`   ✏️  Total updated: ${totalUpdated}`);
  console.log(`   ❌ Total errors: ${totalErrors}`);
  console.log('\n✅ Database cleanup complete!\n');
}

// Run cleanup
runCleanup().catch(error => {
  console.error('💥 Cleanup failed:', error);
  process.exit(1);
});

```
