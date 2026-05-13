/**
 * Set super-admin role for mn@aroid.dk
 * This requires Firebase Admin SDK with service account
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// You need to download service account key from Firebase Console
// Go to: Project Settings → Service Accounts → Generate new private key
// Save as: service-account-key.json

try {
  const serviceAccount = JSON.parse(
    readFileSync('./service-account-key.json', 'utf8')
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const db = admin.firestore();
  const TARGET_EMAIL = 'mn@aroid.dk';

  console.log('🔍 Søger efter bruger med email:', TARGET_EMAIL);

  // Find user by email
  const usersSnapshot = await db.collection('users')
    .where('email', '==', TARGET_EMAIL)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    console.log('❌ Ingen bruger fundet med email:', TARGET_EMAIL);
    console.log('\nOpret brugeren først i Firebase Authentication');
    process.exit(1);
  }

  const userDoc = usersSnapshot.docs[0];
  const userId = userDoc.id;
  const userData = userDoc.data();

  console.log('✅ Fandt bruger:');
  console.log('   ID:', userId);
  console.log('   Email:', userData.email);
  console.log('   Nuværende rolle:', userData.role);

  // Update role
  await db.collection('users').doc(userId).update({
    role: 'super-admin'
  });

  console.log('\n✅ Rolle opdateret til: super-admin');
  console.log('\n🎉 Du kan nu logge ind på Owner Dashboard!');
  console.log('   https://madkontrollen.web.app/admin/owner-dashboard.html');

  process.exit(0);

} catch (error) {
  console.error('❌ Fejl:', error.message);
  
  if (error.code === 'ENOENT') {
    console.log('\n📋 Du mangler service-account-key.json');
    console.log('\nSådan får du den:');
    console.log('1. Gå til Firebase Console');
    console.log('2. Project Settings → Service Accounts');
    console.log('3. Klik "Generate new private key"');
    console.log('4. Gem filen som: service-account-key.json');
    console.log('5. Kør dette script igen');
  }
  
  process.exit(1);
}
