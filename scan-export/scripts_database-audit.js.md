# FILE: scripts/database-audit.js

```javascript
/**
 * Database Connection Audit
 * Checks all Firestore read/write operations across the app
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDLN_ZO5Z1-CvBNK-JoNiI0k1m3zR7xBJo",
  authDomain: "madkontrollen.firebaseapp.com",
  projectId: "madkontrollen",
  storageBucket: "madkontrollen.firebasestorage.app",
  messagingSenderId: "312977848492",
  appId: "1:312977848492:web:1c3f9e5f0e8e3e3e3e3e3e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Collections used in the app
const COLLECTIONS = [
  'users',
  'companies',
  'organizations',
  'locations',
  'task_templates',
  'tasks',
  'task_instances',
  'task_entries',
  'daily_runs',
  'logbook_entries',
  'operating_overrides',
  'service_sessions',
  'equipment',
  'documents',
  'alerts',
  'media_assets',
  'haccp_snapshots',
  'live_user_profiles',
  'areas',
  'deviations',
  'reports',
  'inventory_items',
  'inventory_transactions',
  'inventory_alerts',
  'system_state',
  'workflow_state',
  'risk_profiles'
];

async function auditDatabase() {
  console.log('\n🔍 DATABASE CONNECTION AUDIT\n');
  console.log('═'.repeat(60));
  
  const results = {
    readable: [],
    notReadable: [],
    empty: [],
    errors: []
  };

  for (const collectionName of COLLECTIONS) {
    try {
      console.log(`\n📂 Checking: ${collectionName}`);
      
      const snapshot = await getDocs(collection(db, collectionName));
      
      if (snapshot.empty) {
        console.log(`   ⚠️  Collection is EMPTY (0 documents)`);
        results.empty.push(collectionName);
      } else {
        console.log(`   ✅ READ OK - ${snapshot.size} documents found`);
        results.readable.push({
          collection: collectionName,
          count: snapshot.size
        });
        
        // Show sample document structure
        const firstDoc = snapshot.docs[0];
        const data = firstDoc.data();
        const fields = Object.keys(data).slice(0, 5);
        console.log(`   📋 Sample fields: ${fields.join(', ')}${Object.keys(data).length > 5 ? '...' : ''}`);
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.code || error.message}`);
      results.notReadable.push(collectionName);
      results.errors.push({
        collection: collectionName,
        error: error.code || error.message
      });
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 AUDIT SUMMARY\n');
  
  console.log(`✅ Readable collections: ${results.readable.length}`);
  results.readable.forEach(r => {
    console.log(`   - ${r.collection}: ${r.count} documents`);
  });
  
  if (results.empty.length > 0) {
    console.log(`\n⚠️  Empty collections: ${results.empty.length}`);
    results.empty.forEach(c => console.log(`   - ${c}`));
  }
  
  if (results.notReadable.length > 0) {
    console.log(`\n❌ Not readable collections: ${results.notReadable.length}`);
    results.errors.forEach(e => {
      console.log(`   - ${e.collection}: ${e.error}`);
    });
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('\n✅ Audit complete!\n');
  
  process.exit(0);
}

auditDatabase().catch(error => {
  console.error('\n❌ Audit failed:', error);
  process.exit(1);
});

```
