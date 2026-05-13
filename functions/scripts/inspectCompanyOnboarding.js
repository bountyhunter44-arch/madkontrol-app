#!/usr/bin/env node

/**
 * Inspect Company Onboarding Data - READ ONLY
 * 
 * This script ONLY reads and logs Firestore data. It does NOT write anything.
 * 
 * Usage:
 * node functions/scripts/inspectCompanyOnboarding.js --companyId=oxzE7wuc0KkurBqvQaks --locationId=H5IlvYHhMXcBlxTBw3n1
 */

require("dotenv").config();
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// Initialize Firebase Admin with service account
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, "../../serviceAccountKey.json");
  
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: "madkontrollen"
    });
    console.log("✓ Initialized with service account\n");
  } else {
    // Fallback to default credentials
    admin.initializeApp({
      projectId: "madkontrollen"
    });
    console.log("✓ Initialized with default credentials\n");
  }
}

const db = admin.firestore();

async function inspectCompanyOnboarding(companyId, locationId) {
  console.log("\n=== INSPECTING COMPANY ONBOARDING DATA ===\n");
  console.log("Company ID:", companyId);
  console.log("Location ID:", locationId);
  console.log("\n");

  // 1. Check company document
  console.log("--- 1. COMPANY DOCUMENT ---");
  const companyDoc = await db.collection("companies").doc(companyId).get();
  if (companyDoc.exists) {
    const companyData = companyDoc.data();
    console.log("Company found:", {
      name: companyData.name || companyData.companyName,
      cvr: companyData.cvr,
      industry: companyData.industry || companyData.companyType,
      subscription: companyData.subscription
    });
  } else {
    console.log("Company NOT found");
  }
  console.log("\n");

  // 2. Check location document (both paths)
  console.log("--- 2. LOCATION DOCUMENT ---");
  
  // Check root locations collection
  console.log("Checking: locations/{locationId}");
  const rootLocationDoc = await db.collection("locations").doc(locationId).get();
  if (rootLocationDoc.exists) {
    const locationData = rootLocationDoc.data();
    console.log("✓ Root location found:", {
      name: locationData.name || locationData.locationName,
      address: locationData.address,
      city: locationData.city,
      zip: locationData.zip,
      companyId: locationData.companyId
    });
  } else {
    console.log("✗ Root location NOT found");
  }
  
  // Check subcollection under company
  console.log("Checking: companies/{companyId}/locations/{locationId}");
  const subLocationDoc = await db.collection("companies").doc(companyId)
    .collection("locations").doc(locationId).get();
  if (subLocationDoc.exists) {
    const locationData = subLocationDoc.data();
    console.log("✓ Subcollection location found:", {
      name: locationData.name || locationData.locationName,
      address: locationData.address,
      city: locationData.city,
      zip: locationData.zip
    });
  } else {
    console.log("✗ Subcollection location NOT found");
  }
  console.log("\n");

  // 3. Check users (both companyId and organizationId)
  console.log("--- 3. USERS ---");
  
  console.log("Checking: users where companyId ==", companyId);
  const usersSnap = await db.collection("users")
    .where("companyId", "==", companyId)
    .get();
  console.log(`Found ${usersSnap.size} users with companyId`);
  usersSnap.forEach(doc => {
    const user = doc.data();
    console.log(`  - ${user.email} (${user.role || "no role"})`);
  });
  
  console.log("Checking: users where organizationId ==", companyId);
  const usersOrgSnap = await db.collection("users")
    .where("organizationId", "==", companyId)
    .get();
  console.log(`Found ${usersOrgSnap.size} users with organizationId`);
  usersOrgSnap.forEach(doc => {
    const user = doc.data();
    console.log(`  - ${user.email} (${user.role || "no role"})`);
  });
  console.log("\n");

  // 4. Check live_user_profiles
  console.log("--- 4. LIVE USER PROFILES ---");
  const liveProfileId = `${companyId}__${locationId}__live_profile`;
  const liveProfileDoc = await db.collection("live_user_profiles").doc(liveProfileId).get();
  if (liveProfileDoc.exists) {
    const liveProfile = liveProfileDoc.data();
    console.log("Live profile found:");
    console.log(JSON.stringify(liveProfile, null, 2));
  } else {
    console.log("Live profile NOT found");
  }
  console.log("\n");

  // 5. Check haccp_snapshots
  console.log("--- 5. HACCP SNAPSHOTS ---");
  const haccpSnap = await db.collection("companies").doc(companyId)
    .collection("locations").doc(locationId)
    .collection("haccp_snapshots")
    .get();
  if (!haccpSnap.empty) {
    const haccpData = haccpSnap.docs[0].data();
    console.log("HACCP snapshot found:");
    console.log("  ID:", haccpSnap.docs[0].id);
    console.log("  Created:", haccpData.createdAt?.toDate());
    console.log("  Risk model:", {
      companyType: haccpData.riskModel?.companyType,
      hasCooling: haccpData.riskModel?.hasCooling,
      hasHeating: haccpData.riskModel?.hasHeating,
      hasHotHolding: haccpData.riskModel?.hasHotHolding,
      hasReceiving: haccpData.riskModel?.hasReceiving,
      hasDishwasher: haccpData.riskModel?.hasDishwasher
    });
  } else {
    console.log("HACCP snapshot NOT found");
  }
  console.log("\n");

  // 6. Check onboarding_answers
  console.log("--- 6. ONBOARDING ANSWERS ---");
  const onboardingAnswersSnap = await db.collection("companies").doc(companyId)
    .collection("locations").doc(locationId)
    .collection("onboarding_answers")
    .get();
  if (!onboardingAnswersSnap.empty) {
    const answersData = onboardingAnswersSnap.docs[0].data();
    console.log("Onboarding answers found:");
    console.log("  ID:", onboardingAnswersSnap.docs[0].id);
    console.log("  Equipment counts:", answersData.equipmentCounts);
    console.log("  Profile:", {
      companyType: answersData.profile?.companyType,
      hasCooling: answersData.profile?.hasCooling,
      hasHeating: answersData.profile?.hasHeating,
      hasHotHolding: answersData.profile?.hasHotHolding,
      hasReceiving: answersData.profile?.hasReceiving,
      hasDishwasher: answersData.profile?.hasDishwasher,
      hasFryer: answersData.profile?.hasFryer,
      fridgeCount: answersData.profile?.fridgeCount,
      freezerCount: answersData.profile?.freezerCount,
      walkinCoolerCount: answersData.profile?.walkinCoolerCount,
      walkinFreezerCount: answersData.profile?.walkinFreezerCount
    });
  } else {
    console.log("Onboarding answers NOT found");
  }
  console.log("\n");

  // 7. Check onboarding_checkout_drafts
  console.log("--- 7. ONBOARDING CHECKOUT DRAFTS ---");
  const draftsSnap = await db.collection("onboarding_checkout_drafts")
    .where("companyId", "==", companyId)
    .where("locationId", "==", locationId)
    .get();
  if (!draftsSnap.empty) {
    const draftData = draftsSnap.docs[0].data();
    console.log("Checkout draft found:");
    console.log("  ID:", draftsSnap.docs[0].id);
    console.log("  Profile:", {
      companyType: draftData.profile?.companyType,
      hasCooling: draftData.profile?.hasCooling,
      hasHeating: draftData.profile?.hasHeating,
      hasHotHolding: draftData.profile?.hasHotHolding,
      hasReceiving: draftData.profile?.hasReceiving,
      hasDishwasher: draftData.profile?.hasDishwasher,
      hasFryer: draftData.profile?.hasFryer,
      fridgeCount: draftData.profile?.fridgeCount,
      freezerCount: draftData.profile?.freezerCount,
      walkinCoolerCount: draftData.profile?.walkinCoolerCount,
      walkinFreezerCount: draftData.profile?.walkinFreezerCount
    });
  } else {
    console.log("Checkout draft NOT found");
  }
  console.log("\n");

  // 8. Check equipment (root collection with filters)
  console.log("--- 8. EQUIPMENT ---");
  
  console.log("Checking: equipment where locationId ==", locationId);
  const equipmentSnap = await db.collection("equipment")
    .where("locationId", "==", locationId)
    .get();
  console.log(`Found ${equipmentSnap.size} equipment items with locationId`);
  
  console.log("Checking: equipment where companyId ==", companyId);
  const equipmentCompanySnap = await db.collection("equipment")
    .where("companyId", "==", companyId)
    .get();
  console.log(`Found ${equipmentCompanySnap.size} equipment items with companyId`);
  
  const equipmentByType = {};
  const allEquipmentDocs = new Map();
  
  // Combine both queries (deduplicate by ID)
  equipmentSnap.forEach(doc => allEquipmentDocs.set(doc.id, doc));
  equipmentCompanySnap.forEach(doc => allEquipmentDocs.set(doc.id, doc));
  
  allEquipmentDocs.forEach(doc => {
    const eq = doc.data();
    const type = eq.type || eq.equipmentType || "unknown";
    if (!equipmentByType[type]) {
      equipmentByType[type] = [];
    }
    equipmentByType[type].push({
      id: doc.id,
      name: eq.name || eq.displayName,
      active: eq.active !== false,
      locationId: eq.locationId,
      companyId: eq.companyId
    });
  });
  
  console.log(`Total unique equipment: ${allEquipmentDocs.size}`);
  Object.keys(equipmentByType).forEach(type => {
    console.log(`  ${type}: ${equipmentByType[type].length} items`);
    equipmentByType[type].forEach(item => {
      console.log(`    - ${item.name} (${item.id}) ${item.active ? "✓" : "✗"}`);
    });
  });
  console.log("\n");

  // 9. Check task_templates
  console.log("--- 9. TASK TEMPLATES ---");
  const templatesSnap = await db.collection("task_templates")
    .where("companyId", "==", companyId)
    .where("locationId", "==", locationId)
    .get();
  console.log(`Found ${templatesSnap.size} task templates`);
  const templatesByKey = {};
  templatesSnap.forEach(doc => {
    const tmpl = doc.data();
    const key = tmpl.templateKey || tmpl.controlType || "unknown";
    if (!templatesByKey[key]) {
      templatesByKey[key] = [];
    }
    templatesByKey[key].push({
      id: doc.id,
      title: tmpl.title,
      frequency: tmpl.frequency,
      equipmentUnit: tmpl.equipmentUnit
    });
  });
  Object.keys(templatesByKey).forEach(key => {
    console.log(`  ${key}: ${templatesByKey[key].length} templates`);
    templatesByKey[key].forEach(tmpl => {
      console.log(`    - ${tmpl.title} (${tmpl.frequency || "no freq"}) ${tmpl.equipmentUnit ? `[${tmpl.equipmentUnit}]` : ""}`);
    });
  });
  console.log("\n");

  // 10. Check task_instances for today
  console.log("--- 10. TASK INSTANCES (TODAY) ---");
  const today = new Date().toISOString().split("T")[0];
  const instancesSnap = await db.collection("task_instances")
    .where("companyId", "==", companyId)
    .where("locationId", "==", locationId)
    .where("dateKey", "==", today)
    .get();
  console.log(`Found ${instancesSnap.size} task instances for ${today}`);
  instancesSnap.forEach(doc => {
    const inst = doc.data();
    console.log(`  - ${inst.title} (${doc.id})`);
  });
  console.log("\n");

  // === ANALYSIS AND RECOMMENDATIONS ===
  console.log("\n" + "=".repeat(80));
  console.log("=== ANALYSIS AND RECOMMENDATIONS ===");
  console.log("=".repeat(80) + "\n");

  // Collect onboarding data from all sources
  let onboardingData = {
    fridgeCount: 0,
    freezerCount: 0,
    walkinCoolerCount: 0,
    walkinFreezerCount: 0,
    hasCooling: false,
    hasHeating: false,
    hasHotHolding: false,
    hasReceiving: false,
    hasDishwasher: false,
    hasFryer: false,
    source: "none"
  };

  // Try to get from onboarding_answers first
  if (!onboardingAnswersSnap.empty) {
    const answersData = onboardingAnswersSnap.docs[0].data();
    if (answersData.profile) {
      onboardingData = {
        fridgeCount: answersData.profile.fridgeCount || 0,
        freezerCount: answersData.profile.freezerCount || 0,
        walkinCoolerCount: answersData.profile.walkinCoolerCount || 0,
        walkinFreezerCount: answersData.profile.walkinFreezerCount || 0,
        hasCooling: answersData.profile.hasCooling || false,
        hasHeating: answersData.profile.hasHeating || false,
        hasHotHolding: answersData.profile.hasHotHolding || false,
        hasReceiving: answersData.profile.hasReceiving || false,
        hasDishwasher: answersData.profile.hasDishwasher || false,
        hasFryer: answersData.profile.hasFryer || false,
        source: "onboarding_answers"
      };
    }
  }

  // Fallback to checkout draft
  if (onboardingData.source === "none" && !draftsSnap.empty) {
    const draftData = draftsSnap.docs[0].data();
    if (draftData.profile) {
      onboardingData = {
        fridgeCount: draftData.profile.fridgeCount || 0,
        freezerCount: draftData.profile.freezerCount || 0,
        walkinCoolerCount: draftData.profile.walkinCoolerCount || 0,
        walkinFreezerCount: draftData.profile.walkinFreezerCount || 0,
        hasCooling: draftData.profile.hasCooling || false,
        hasHeating: draftData.profile.hasHeating || false,
        hasHotHolding: draftData.profile.hasHotHolding || false,
        hasReceiving: draftData.profile.hasReceiving || false,
        hasDishwasher: draftData.profile.hasDishwasher || false,
        hasFryer: draftData.profile.hasFryer || false,
        source: "onboarding_checkout_drafts"
      };
    }
  }

  // Fallback to HACCP snapshot
  if (onboardingData.source === "none" && !haccpSnap.empty) {
    const haccpData = haccpSnap.docs[0].data();
    if (haccpData.riskModel) {
      onboardingData = {
        fridgeCount: 0, // Not stored in HACCP
        freezerCount: 0,
        walkinCoolerCount: 0,
        walkinFreezerCount: 0,
        hasCooling: haccpData.riskModel.hasCooling || false,
        hasHeating: haccpData.riskModel.hasHeating || false,
        hasHotHolding: haccpData.riskModel.hasHotHolding || false,
        hasReceiving: haccpData.riskModel.hasReceiving || false,
        hasDishwasher: haccpData.riskModel.hasDishwasher || false,
        hasFryer: false,
        source: "haccp_snapshots"
      };
    }
  }

  console.log("ONBOARDING DATA SOURCE:", onboardingData.source);
  console.log("\nVALGT VED ONBOARDING:");
  console.log("  Køleskabe:", onboardingData.fridgeCount);
  console.log("  Frysere:", onboardingData.freezerCount);
  console.log("  Walk-in køl:", onboardingData.walkinCoolerCount);
  console.log("  Walk-in fryser:", onboardingData.walkinFreezerCount);
  console.log("  Køling (nedkøling):", onboardingData.hasCooling ? "JA" : "NEJ");
  console.log("  Opvarmning:", onboardingData.hasHeating ? "JA" : "NEJ");
  console.log("  Varmholdelse:", onboardingData.hasHotHolding ? "JA" : "NEJ");
  console.log("  Varemodtagelse:", onboardingData.hasReceiving ? "JA" : "NEJ");
  console.log("  Opvaskemaskine:", onboardingData.hasDishwasher ? "JA" : "NEJ");
  console.log("  Friture:", onboardingData.hasFryer ? "JA" : "NEJ");

  console.log("\nEKSISTERENDE EQUIPMENT:");
  Object.keys(equipmentByType).forEach(type => {
    console.log(`  ${type}: ${equipmentByType[type].length} stk`);
  });

  console.log("\nEKSISTERENDE TASK TEMPLATES:");
  Object.keys(templatesByKey).forEach(key => {
    console.log(`  ${key}: ${templatesByKey[key].length} stk`);
  });

  console.log("\n" + "=".repeat(80));
  console.log("=== ANBEFALET REPAIR PLAN ===");
  console.log("=".repeat(80) + "\n");

  const repairPlan = [];

  // Calculate missing equipment
  const existingFridges = (equipmentByType.fridge || []).length;
  const existingFreezers = (equipmentByType.freezer || []).length;
  const existingWalkinCoolers = (equipmentByType.walk_in_cooler || []).length;
  const existingWalkinFreezers = (equipmentByType.walk_in_freezer || []).length;

  if (onboardingData.fridgeCount > existingFridges) {
    repairPlan.push(`CREATE ${onboardingData.fridgeCount - existingFridges} x fridge equipment`);
  }
  if (onboardingData.freezerCount > existingFreezers) {
    repairPlan.push(`CREATE ${onboardingData.freezerCount - existingFreezers} x freezer equipment`);
  }
  if (onboardingData.walkinCoolerCount > existingWalkinCoolers) {
    repairPlan.push(`CREATE ${onboardingData.walkinCoolerCount - existingWalkinCoolers} x walk_in_cooler equipment`);
  }
  if (onboardingData.walkinFreezerCount > existingWalkinFreezers) {
    repairPlan.push(`CREATE ${onboardingData.walkinFreezerCount - existingWalkinFreezers} x walk_in_freezer equipment`);
  }

  // Calculate missing templates
  const expectedTemplates = [];

  // Temperature templates per equipment
  const totalFridges = onboardingData.fridgeCount;
  const totalFreezers = onboardingData.freezerCount;
  const totalWalkinCoolers = onboardingData.walkinCoolerCount;
  const totalWalkinFreezers = onboardingData.walkinFreezerCount;

  if (totalFridges > 0) {
    expectedTemplates.push(`${totalFridges} x koeleskab_temperatur templates`);
    expectedTemplates.push(`${totalFridges} x koeleskab_rengoering templates`);
  }
  if (totalFreezers > 0) {
    expectedTemplates.push(`${totalFreezers} x fryser_temperatur templates`);
    expectedTemplates.push(`${totalFreezers} x fryser_rengoering templates`);
  }
  if (totalWalkinCoolers > 0) {
    expectedTemplates.push(`${totalWalkinCoolers} x walkin_cooler_temperatur templates`);
  }
  if (totalWalkinFreezers > 0) {
    expectedTemplates.push(`${totalWalkinFreezers} x walkin_freezer_temperatur templates`);
  }

  // CCP routine templates
  if (onboardingData.hasReceiving) {
    expectedTemplates.push("1 x varemodtagelse template");
  }
  if (onboardingData.hasCooling) {
    expectedTemplates.push("1 x nedkoeling template");
  }
  if (onboardingData.hasHeating) {
    expectedTemplates.push("1 x opvarmning template");
  }
  if (onboardingData.hasHotHolding) {
    expectedTemplates.push("1 x varmholdelse template");
  }
  if (onboardingData.hasDishwasher) {
    expectedTemplates.push("1 x opvaskemaskine_skyllevand template");
  }
  if (onboardingData.hasFryer) {
    expectedTemplates.push("1 x friture template");
  }

  console.log("EQUIPMENT ACTIONS:");
  if (repairPlan.length > 0) {
    repairPlan.forEach(action => console.log(`  - ${action}`));
  } else {
    console.log("  - No equipment actions needed");
  }

  console.log("\nEXPECTED TEMPLATES:");
  if (expectedTemplates.length > 0) {
    expectedTemplates.forEach(tmpl => console.log(`  - ${tmpl}`));
  } else {
    console.log("  - No templates expected");
  }

  console.log("\nCURRENT TEMPLATES: " + templatesSnap.size);
  console.log("\nNEXT STEPS:");
  console.log("  1. Review the data above");
  console.log("  2. If repair is needed, run:");
  console.log("     node functions/scripts/repairCompanyFromOnboarding.js --companyId=" + companyId + " --locationId=" + locationId);
  console.log("\n" + "=".repeat(80));
  console.log("=== INSPECTION COMPLETE ===");
  console.log("=".repeat(80) + "\n");
}

// Parse command line arguments
const args = process.argv.slice(2);
const companyIdArg = args.find(arg => arg.startsWith("--companyId="));
const locationIdArg = args.find(arg => arg.startsWith("--locationId="));

if (!companyIdArg || !locationIdArg) {
  console.error("Usage: node inspectCompanyOnboarding.js --companyId=<id> --locationId=<id>");
  process.exit(1);
}

const companyId = companyIdArg.split("=")[1];
const locationId = locationIdArg.split("=")[1];

inspectCompanyOnboarding(companyId, locationId)
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
