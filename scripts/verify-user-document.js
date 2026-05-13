/**
 * Verify User Document
 * Quick verification of user document fields
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

try {
  const serviceAccount = JSON.parse(
    readFileSync('./serviceAccountKey.json', 'utf8')
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin');
  process.exit(1);
}

const db = admin.firestore();
const USER_ID = 'Mmma7iwd5PPWRNkC2MUBUlK9WQt1';

async function verifyUser() {
  const userRef = db.collection('users').doc(USER_ID);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    console.error('❌ User document does not exist');
    process.exit(1);
  }

  const data = userDoc.data();
  
  console.log('\n📄 User Document Status\n');
  console.log('Required fields:');
  console.log(`   role: ${data.role ? '✅ "' + data.role + '"' : '❌ MISSING'}`);
  console.log(`   organizationId: ${data.organizationId ? '✅ "' + data.organizationId + '"' : '❌ MISSING'}`);
  console.log(`   primaryLocationId: ${data.primaryLocationId ? '✅ "' + data.primaryLocationId + '"' : '❌ MISSING'}`);
  
  console.log('\nRelated fields:');
  console.log(`   companyId: ${data.companyId || 'N/A'}`);
  console.log(`   locationId: ${data.locationId || 'N/A'}`);
  console.log(`   locationIds: ${JSON.stringify(data.locationIds || [])}`);
  console.log(`   email: ${data.email || 'N/A'}`);
  console.log(`   displayName: ${data.displayName || 'N/A'}`);
  
  const hasAllRequired = data.role && data.organizationId && data.primaryLocationId;
  
  console.log('\n' + (hasAllRequired ? '✅ All required fields present' : '❌ Missing required fields'));
  console.log('');
  
  process.exit(0);
}

verifyUser().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
