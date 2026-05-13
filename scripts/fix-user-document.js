/**
 * Fix User Document for Onboarding User
 * Adds missing fields required by Firestore rules
 * 
 * Usage: node scripts/fix-user-document.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
try {
  const serviceAccount = JSON.parse(
    readFileSync('./serviceAccountKey.json', 'utf8')
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log('✅ Firebase Admin initialized\n');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin');
  console.error('   Make sure serviceAccountKey.json exists in project root');
  process.exit(1);
}

const db = admin.firestore();

const USER_ID = 'Mmma7iwd5PPWRNkC2MUBUlK9WQt1';

async function fixUserDocument() {
  console.log('🔧 Fixing User Document');
  console.log('═'.repeat(60));
  console.log(`User ID: ${USER_ID}\n`);

  try {
    // Get current document
    const userRef = db.collection('users').doc(USER_ID);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error('❌ User document does not exist');
      process.exit(1);
    }

    const currentData = userDoc.data();
    console.log('📄 Current document data:');
    console.log(JSON.stringify(currentData, null, 2));
    console.log('');

    // Prepare updates
    const updates = {};
    let hasUpdates = false;

    // Add role if missing
    if (!currentData.role) {
      updates.role = 'owner';
      hasUpdates = true;
      console.log('➕ Adding field: role = "owner"');
    } else {
      console.log(`✓ Field exists: role = "${currentData.role}"`);
    }

    // Add organizationId if missing
    if (!currentData.organizationId) {
      updates.organizationId = currentData.companyId || 'onboarding_aroi-d';
      hasUpdates = true;
      console.log(`➕ Adding field: organizationId = "${updates.organizationId}"`);
    } else {
      console.log(`✓ Field exists: organizationId = "${currentData.organizationId}"`);
    }

    // Add primaryLocationId if missing
    if (!currentData.primaryLocationId) {
      updates.primaryLocationId = currentData.locationId || 'onboarding_aroi-d__main';
      hasUpdates = true;
      console.log(`➕ Adding field: primaryLocationId = "${updates.primaryLocationId}"`);
    } else {
      console.log(`✓ Field exists: primaryLocationId = "${currentData.primaryLocationId}"`);
    }

    // Apply updates if needed
    if (hasUpdates) {
      console.log('\n🔄 Applying updates...');
      await userRef.update(updates);
      console.log('✅ Updates applied successfully');

      // Fetch updated document
      const updatedDoc = await userRef.get();
      const updatedData = updatedDoc.data();

      console.log('\n📄 Updated document data:');
      console.log(JSON.stringify(updatedData, null, 2));
    } else {
      console.log('\n✅ No updates needed - all required fields exist');
    }

    // Verify rules compliance
    console.log('\n🔍 Verifying rules compliance:');
    const finalDoc = await userRef.get();
    const finalData = finalDoc.data();

    const requiredFields = ['role', 'organizationId', 'primaryLocationId'];
    let compliant = true;

    requiredFields.forEach(field => {
      if (finalData[field]) {
        console.log(`   ✓ ${field}: "${finalData[field]}"`);
      } else {
        console.log(`   ✗ ${field}: MISSING`);
        compliant = false;
      }
    });

    console.log('\n' + '═'.repeat(60));
    if (compliant) {
      console.log('✅ User document now matches Firestore rules expectations');
    } else {
      console.log('⚠️  User document still missing required fields');
    }
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

fixUserDocument();
