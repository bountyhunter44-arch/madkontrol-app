/**
 * Customer Setup Script
 * Creates a new customer account with proper isolation and module permissions
 * 
 * Usage: node scripts/setup-customer.js
 */

import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import * as readline from 'readline';

const firebaseConfig = {
  apiKey: "AIzaSyDNzCaPlot6hUdWDS4co91KW6isfLabTWI",
  authDomain: "madkontrollen.firebaseapp.com",
  projectId: "madkontrollen",
  storageBucket: "madkontrollen.firebasestorage.app",
  messagingSenderId: "690530462316",
  appId: "1:690530462316:web:f4d3e7c8e0b1a2c3d4e5f6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupCustomer() {
  console.log('\n🎯 Madkontrollen Pro - Customer Setup\n');
  console.log('Dette script opretter en ny kunde med fuld isolation.\n');

  // Gather customer information
  const companyName = await question('Virksomhedsnavn: ');
  const email = await question('Email (login): ');
  const password = await question('Midlertidigt password (min. 6 tegn): ');
  const displayName = await question('Kontaktperson navn: ');
  const cvr = await question('CVR-nummer (valgfrit): ');
  const address = await question('Adresse (valgfrit): ');

  console.log('\n📦 Hvilke moduler har kunden købt?');
  console.log('1. Kun Egenkontrol (basis)');
  console.log('2. Egenkontrol + Lager & Stregkode');
  console.log('3. Egenkontrol + Regnskab');
  console.log('4. Alle moduler');
  
  const moduleChoice = await question('\nVælg (1-4): ');

  const modules = {
    core: true,
    inventory: moduleChoice === '2' || moduleChoice === '4',
    accounting: moduleChoice === '3' || moduleChoice === '4',
    institutional: moduleChoice === '4',
    menu: moduleChoice === '4',
    analytics: moduleChoice === '4'
  };

  // Generate unique IDs
  const timestamp = Date.now();
  const companyId = `comp_${timestamp}`;
  const locationId = `loc_${timestamp}_main`;

  console.log('\n📋 Opsummering:');
  console.log('─'.repeat(50));
  console.log(`Virksomhed: ${companyName}`);
  console.log(`Email: ${email}`);
  console.log(`Company ID: ${companyId}`);
  console.log(`Location ID: ${locationId}`);
  console.log(`Moduler:`);
  console.log(`  - Egenkontrol: ✅`);
  console.log(`  - Lager & Stregkode: ${modules.inventory ? '✅' : '❌'}`);
  console.log(`  - Regnskab: ${modules.accounting ? '✅' : '❌'}`);
  console.log(`  - Institution: ${modules.institutional ? '✅' : '❌'}`);
  console.log('─'.repeat(50));

  const confirm = await question('\nOpret kunde? (ja/nej): ');
  
  if (confirm.toLowerCase() !== 'ja') {
    console.log('❌ Annulleret');
    rl.close();
    return;
  }

  try {
    console.log('\n🔄 Opretter kunde...');

    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log(`✅ Firebase Auth bruger oprettet: ${user.uid}`);

    // Create user document in Firestore
    await setDoc(doc(db, "users", user.uid), {
      userId: user.uid,
      email: email,
      displayName: displayName,
      role: "owner",
      companyId: companyId,
      organizationId: companyId,
      locationId: locationId,
      locationIds: [locationId],
      primaryLocationId: locationId,
      modules: modules,
      companyName: companyName,
      cvr: cvr || "",
      address: address || "",
      createdAt: serverTimestamp(),
      createdBy: "system",
      onboardingCompleted: false,
      subscriptionStatus: "active"
    });

    console.log(`✅ Firestore bruger dokument oprettet`);

    // Create company document
    await setDoc(doc(db, "companies", companyId), {
      companyId: companyId,
      name: companyName,
      cvr: cvr || "",
      address: address || "",
      ownerId: user.uid,
      modules: modules,
      createdAt: serverTimestamp(),
      subscriptionStatus: "active"
    });

    console.log(`✅ Company dokument oprettet`);

    // Create location document
    await setDoc(doc(db, "locations", locationId), {
      locationId: locationId,
      companyId: companyId,
      name: "Hovedlokation",
      address: address || "",
      isActive: true,
      createdAt: serverTimestamp()
    });

    console.log(`✅ Location dokument oprettet`);

    console.log('\n🎉 Kunde oprettet succesfuldt!\n');
    console.log('📧 Send følgende oplysninger til kunden:\n');
    console.log('─'.repeat(50));
    console.log(`Login URL: https://madkontrollen.web.app`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`\nKunden skal skifte password ved første login.`);
    console.log('─'.repeat(50));

    console.log('\n📁 Cloudinary folder struktur:');
    console.log(`${companyId}/`);
    console.log(`  └── ${locationId}/`);
    console.log(`      ├── egenkontrol/`);
    console.log(`      │   ├── task_photos/`);
    console.log(`      │   └── deviation_photos/`);
    if (modules.inventory) {
      console.log(`      └── lager/`);
      console.log(`          └── product_photos/`);
    }

    console.log('\n✅ Næste skridt:');
    console.log('1. Send login-oplysninger til kunden');
    console.log('2. Verificer at kunden kan logge ind');
    console.log('3. Guide kunden gennem onboarding');
    console.log('4. Verificer at kun købte moduler er synlige');
    console.log('5. Test billede-upload (skal lande i kunde-specifik folder)');

  } catch (error) {
    console.error('\n❌ Fejl ved oprettelse:', error.message);
    
    if (error.code === 'auth/email-already-in-use') {
      console.log('\n⚠️  Email er allerede i brug. Brug en anden email.');
    } else if (error.code === 'auth/weak-password') {
      console.log('\n⚠️  Password er for svagt. Brug mindst 6 tegn.');
    }
  } finally {
    rl.close();
  }
}

// Run setup
setupCustomer().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
