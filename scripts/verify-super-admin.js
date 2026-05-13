/**
 * Verify and setup super-admin user
 * Run: node scripts/verify-super-admin.js
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDLN_ZO5Z1-CvBNK-JoNiI0k1m3zR7xBJo",
  authDomain: "madkontrollen.firebaseapp.com",
  projectId: "madkontrollen",
  storageBucket: "madkontrollen.firebasestorage.app",
  messagingSenderId: "312977848492",
  appId: "1:312977848492:web:1c3f9e5f0e8e3e3e3e3e3e"
};

const SUPER_ADMIN_EMAIL = 'mn@aroid.dk';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verifySuperAdmin() {
  console.log('\n🔍 Verificerer super-admin setup...\n');

  try {
    // Get all users
    const usersSnap = await getDocs(collection(db, 'users'));
    console.log(`📊 Fundet ${usersSnap.size} brugere i databasen\n`);

    let superAdminUser = null;
    let targetUser = null;

    usersSnap.forEach((doc) => {
      const data = doc.data();
      console.log(`👤 Bruger: ${data.email || 'Ingen email'}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Rolle: ${data.role || 'Ingen rolle'}`);
      console.log(`   Navn: ${data.displayName || 'Intet navn'}`);
      console.log('');

      if (data.email === SUPER_ADMIN_EMAIL) {
        targetUser = { id: doc.id, ...data };
      }

      if (data.role === 'super-admin') {
        superAdminUser = { id: doc.id, ...data };
      }
    });

    console.log('─────────────────────────────────────\n');

    if (targetUser) {
      console.log(`✅ Fandt bruger med email: ${SUPER_ADMIN_EMAIL}`);
      console.log(`   User ID: ${targetUser.id}`);
      console.log(`   Nuværende rolle: ${targetUser.role || 'Ingen rolle'}\n`);

      if (targetUser.role !== 'super-admin') {
        console.log('⚠️  Brugeren har IKKE super-admin rolle');
        console.log('📝 Opdaterer rolle til super-admin...\n');

        await updateDoc(doc(db, 'users', targetUser.id), {
          role: 'super-admin'
        });

        console.log('✅ Rolle opdateret til super-admin!');
      } else {
        console.log('✅ Brugeren har allerede super-admin rolle!');
      }
    } else {
      console.log(`❌ Ingen bruger fundet med email: ${SUPER_ADMIN_EMAIL}`);
      console.log('\n📋 Næste skridt:');
      console.log('1. Gå til Firebase Console → Authentication');
      console.log('2. Opret en bruger med email: mn@aroid.dk');
      console.log('3. Kør dette script igen');
    }

    if (superAdminUser && superAdminUser.email !== SUPER_ADMIN_EMAIL) {
      console.log(`\n⚠️  ADVARSEL: En anden bruger har super-admin rolle:`);
      console.log(`   Email: ${superAdminUser.email}`);
      console.log(`   ID: ${superAdminUser.id}`);
    }

    console.log('\n─────────────────────────────────────');
    console.log('✅ Verificering færdig!\n');

    if (targetUser && targetUser.role === 'super-admin') {
      console.log('🎉 Du kan nu logge ind på Owner Dashboard:');
      console.log('   https://madkontrollen.web.app/admin/owner-dashboard.html\n');
    }

  } catch (error) {
    console.error('❌ Fejl:', error.message);
    console.error(error);
  }

  process.exit(0);
}

verifySuperAdmin();
