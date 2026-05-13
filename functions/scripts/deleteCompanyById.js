#!/usr/bin/env node

/**
 * Delete Company Data Script - DESTRUCTIVE OPERATION
 * 
 * This script deletes ALL Firestore data for a specific company and location.
 * 
 * Usage:
 * DRY RUN (safe):
 *   node functions/scripts/deleteCompanyById.js --companyId=oxzE7wuc0KkurBqvQaks --locationId=H5IlvYHhMXcBlxTBw3n1
 * 
 * REAL DELETE (destructive):
 *   node functions/scripts/deleteCompanyById.js --companyId=oxzE7wuc0KkurBqvQaks --locationId=H5IlvYHhMXcBlxTBw3n1 --confirm
 * 
 * WARNING: This operation is IRREVERSIBLE. All data will be permanently deleted.
 */

require("dotenv").config();
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// Initialize Firebase Admin with service account
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, "../../serviceAccountKey.json");
  
  if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ ERROR: serviceAccountKey.json not found at:", serviceAccountPath);
    console.error("Please ensure the service account key file exists.");
    process.exit(1);
  }
  
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "madkontrollen"
  });
  console.log("✓ Initialized with service account\n");
}

const db = admin.firestore();
const auth = admin.auth();

// Parse command line arguments
const args = process.argv.slice(2);
const companyIdArg = args.find(arg => arg.startsWith("--companyId="));
const locationIdArg = args.find(arg => arg.startsWith("--locationId="));
const confirmArg = args.includes("--confirm");

if (!companyIdArg || !locationIdArg) {
  console.error("Usage: node deleteCompanyById.js --companyId=<id> --locationId=<id> [--confirm]");
  process.exit(1);
}

const companyId = companyIdArg.split("=")[1];
const locationId = locationIdArg.split("=")[1];

console.log("=" .repeat(80));
console.log("=== DELETE COMPANY DATA SCRIPT ===");
console.log("=" .repeat(80));
console.log("\nCompany ID:", companyId);
console.log("Location ID:", locationId);
console.log("Mode:", confirmArg ? "🔴 REAL DELETE" : "🟡 DRY RUN (safe)");
console.log("\n" + "=" .repeat(80));

if (!confirmArg) {
  console.log("\n⚠️  DRY RUN MODE - No data will be deleted");
  console.log("To perform real deletion, add --confirm flag\n");
}

// Statistics
const stats = {
  collections: {},
  authUsers: 0,
  totalDocs: 0,
  errors: 0
};

/**
 * Delete documents in batches
 */
async function batchDelete(collectionName, query, dryRun = true) {
  console.log(`\n--- ${collectionName.toUpperCase()} ---`);
  
  try {
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log(`No documents found in ${collectionName}`);
      stats.collections[collectionName] = 0;
      return;
    }
    
    console.log(`Found ${snapshot.size} documents in ${collectionName}`);
    
    // Log all documents
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${doc.id}`, {
        title: data.title,
        name: data.name,
        email: data.email,
        dateKey: data.dateKey,
        status: data.status
      });
    });
    
    stats.collections[collectionName] = snapshot.size;
    stats.totalDocs += snapshot.size;
    
    if (dryRun) {
      console.log(`[DRY RUN] Would delete ${snapshot.size} documents from ${collectionName}`);
      return;
    }
    
    // Real deletion in batches of 450
    const BATCH_SIZE = 450;
    const docs = snapshot.docs;
    
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + BATCH_SIZE);
      
      chunk.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`✓ Deleted batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} docs)`);
    }
    
    console.log(`✓ Deleted ${snapshot.size} documents from ${collectionName}`);
  } catch (error) {
    console.error(`❌ Error deleting from ${collectionName}:`, error.message);
    stats.errors++;
  }
}

/**
 * Delete subcollection documents
 */
async function deleteSubcollection(parentPath, subcollectionName, dryRun = true) {
  console.log(`\n--- ${parentPath}/${subcollectionName} ---`);
  
  try {
    const snapshot = await db.collection(parentPath).doc(companyId)
      .collection("locations").doc(locationId)
      .collection(subcollectionName)
      .get();
    
    if (snapshot.empty) {
      console.log(`No documents found in ${parentPath}/${subcollectionName}`);
      stats.collections[`${parentPath}/${subcollectionName}`] = 0;
      return;
    }
    
    console.log(`Found ${snapshot.size} documents in ${parentPath}/${subcollectionName}`);
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${doc.id}`, {
        createdAt: data.createdAt?.toDate?.(),
        type: data.type,
        status: data.status
      });
    });
    
    stats.collections[`${parentPath}/${subcollectionName}`] = snapshot.size;
    stats.totalDocs += snapshot.size;
    
    if (dryRun) {
      console.log(`[DRY RUN] Would delete ${snapshot.size} documents from ${parentPath}/${subcollectionName}`);
      return;
    }
    
    // Real deletion in batches
    const BATCH_SIZE = 450;
    const docs = snapshot.docs;
    
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + BATCH_SIZE);
      
      chunk.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`✓ Deleted batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} docs)`);
    }
    
    console.log(`✓ Deleted ${snapshot.size} documents from ${parentPath}/${subcollectionName}`);
  } catch (error) {
    console.error(`❌ Error deleting from ${parentPath}/${subcollectionName}:`, error.message);
    stats.errors++;
  }
}

/**
 * Delete Firebase Auth users
 */
async function deleteAuthUsers(userDocs, dryRun = true) {
  console.log("\n--- FIREBASE AUTH USERS ---");
  
  const authUids = [];
  
  for (const doc of userDocs) {
    const uid = doc.id;
    const userData = doc.data();
    
    try {
      const userRecord = await auth.getUser(uid);
      authUids.push(uid);
      console.log(`  - ${userRecord.email || uid} (${uid})`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log(`  - ${uid} (not found in Auth, only in Firestore)`);
      } else {
        console.error(`  - ${uid} (error checking Auth):`, error.message);
      }
    }
  }
  
  stats.authUsers = authUids.length;
  
  if (authUids.length === 0) {
    console.log("No Auth users to delete");
    return;
  }
  
  if (dryRun) {
    console.log(`[DRY RUN] Would delete ${authUids.length} Firebase Auth users`);
    return;
  }
  
  // Real deletion
  for (const uid of authUids) {
    try {
      await auth.deleteUser(uid);
      console.log(`✓ Deleted Auth user: ${uid}`);
    } catch (error) {
      console.error(`❌ Error deleting Auth user ${uid}:`, error.message);
      stats.errors++;
    }
  }
  
  console.log(`✓ Deleted ${authUids.length} Firebase Auth users`);
}

/**
 * Main deletion function
 */
async function deleteCompanyData() {
  const dryRun = !confirmArg;
  
  console.log("\n" + "=".repeat(80));
  console.log("=== SCANNING FOR DATA TO DELETE ===");
  console.log("=".repeat(80));
  
  // 1. Users collection (both companyId and organizationId)
  console.log("\n--- USERS (companyId) ---");
  const usersCompanyQuery = db.collection("users").where("companyId", "==", companyId);
  const usersCompanySnap = await usersCompanyQuery.get();
  console.log(`Found ${usersCompanySnap.size} users with companyId`);
  
  console.log("\n--- USERS (organizationId) ---");
  const usersOrgQuery = db.collection("users").where("organizationId", "==", companyId);
  const usersOrgSnap = await usersOrgQuery.get();
  console.log(`Found ${usersOrgSnap.size} users with organizationId`);
  
  // Combine and deduplicate users
  const allUserDocs = new Map();
  usersCompanySnap.forEach(doc => allUserDocs.set(doc.id, doc));
  usersOrgSnap.forEach(doc => allUserDocs.set(doc.id, doc));
  
  console.log(`\nTotal unique users: ${allUserDocs.size}`);
  allUserDocs.forEach(doc => {
    const user = doc.data();
    console.log(`  - ${user.email} (${doc.id}) - ${user.role || "no role"}`);
  });
  
  // 2. Live user profiles
  const liveProfileId = `${companyId}__${locationId}__live_profile`;
  console.log(`\n--- LIVE USER PROFILE ---`);
  const liveProfileDoc = await db.collection("live_user_profiles").doc(liveProfileId).get();
  if (liveProfileDoc.exists) {
    console.log(`Found live profile: ${liveProfileId}`);
    stats.collections["live_user_profiles"] = 1;
    stats.totalDocs += 1;
  } else {
    console.log("No live profile found");
    stats.collections["live_user_profiles"] = 0;
  }
  
  // 3. Root collections with companyId/locationId filters
  await batchDelete("task_templates", 
    db.collection("task_templates")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId),
    dryRun
  );
  
  await batchDelete("verification_templates",
    db.collection("verification_templates")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId),
    dryRun
  );
  
  await batchDelete("task_instances",
    db.collection("task_instances")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId),
    dryRun
  );
  
  await batchDelete("task_entries",
    db.collection("task_entries")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId),
    dryRun
  );
  
  await batchDelete("daily_runs",
    db.collection("daily_runs")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId),
    dryRun
  );
  
  await batchDelete("reports",
    db.collection("reports")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId),
    dryRun
  );
  
  await batchDelete("daily_reports",
    db.collection("daily_reports")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId),
    dryRun
  );
  
  await batchDelete("alerts",
    db.collection("alerts")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId),
    dryRun
  );
  
  await batchDelete("equipment",
    db.collection("equipment")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId),
    dryRun
  );
  
  await batchDelete("media_assets",
    db.collection("media_assets")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId),
    dryRun
  );
  
  await batchDelete("risks",
    db.collection("risks")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId),
    dryRun
  );
  
  await batchDelete("onboarding_checkout_drafts",
    db.collection("onboarding_checkout_drafts")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId),
    dryRun
  );
  
  // 4. Subcollections under companies/{companyId}/locations/{locationId}
  await deleteSubcollection("companies", "haccp_snapshots", dryRun);
  await deleteSubcollection("companies", "onboarding_answers", dryRun);
  
  // 5. Location document
  console.log("\n--- LOCATION DOCUMENT ---");
  const locationDoc = await db.collection("companies").doc(companyId)
    .collection("locations").doc(locationId).get();
  
  if (locationDoc.exists) {
    console.log(`Found location: companies/${companyId}/locations/${locationId}`);
    const locationData = locationDoc.data();
    console.log(`  - ${locationData.name || "Unnamed location"}`);
    stats.collections["companies/locations"] = 1;
    stats.totalDocs += 1;
    
    if (!dryRun) {
      await locationDoc.ref.delete();
      console.log("✓ Deleted location document");
    } else {
      console.log("[DRY RUN] Would delete location document");
    }
  } else {
    console.log("No location document found");
    stats.collections["companies/locations"] = 0;
  }
  
  // 6. Root locations collection
  console.log("\n--- ROOT LOCATIONS COLLECTION ---");
  const rootLocationDoc = await db.collection("locations").doc(locationId).get();
  
  if (rootLocationDoc.exists) {
    const rootLocationData = rootLocationDoc.data();
    if (rootLocationData.companyId === companyId) {
      console.log(`Found root location: locations/${locationId}`);
      console.log(`  - ${rootLocationData.name || "Unnamed location"}`);
      stats.collections["locations"] = 1;
      stats.totalDocs += 1;
      
      if (!dryRun) {
        await rootLocationDoc.ref.delete();
        console.log("✓ Deleted root location document");
      } else {
        console.log("[DRY RUN] Would delete root location document");
      }
    } else {
      console.log(`Root location exists but belongs to different company: ${rootLocationData.companyId}`);
      stats.collections["locations"] = 0;
    }
  } else {
    console.log("No root location document found");
    stats.collections["locations"] = 0;
  }
  
  // 7. Company members subcollection
  console.log("\n--- COMPANY MEMBERS ---");
  const membersSnap = await db.collection("companies").doc(companyId)
    .collection("members").get();
  
  if (!membersSnap.empty) {
    console.log(`Found ${membersSnap.size} members`);
    membersSnap.forEach(doc => {
      const member = doc.data();
      console.log(`  - ${member.email || doc.id}`);
    });
    stats.collections["companies/members"] = membersSnap.size;
    stats.totalDocs += membersSnap.size;
    
    if (!dryRun) {
      const batch = db.batch();
      membersSnap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`✓ Deleted ${membersSnap.size} members`);
    } else {
      console.log(`[DRY RUN] Would delete ${membersSnap.size} members`);
    }
  } else {
    console.log("No members found");
    stats.collections["companies/members"] = 0;
  }
  
  // 8. Company document
  console.log("\n--- COMPANY DOCUMENT ---");
  const companyDoc = await db.collection("companies").doc(companyId).get();
  
  if (companyDoc.exists) {
    console.log(`Found company: companies/${companyId}`);
    const companyData = companyDoc.data();
    console.log(`  - ${companyData.name || companyData.companyName || "Unnamed company"}`);
    stats.collections["companies"] = 1;
    stats.totalDocs += 1;
    
    if (!dryRun) {
      await companyDoc.ref.delete();
      console.log("✓ Deleted company document");
    } else {
      console.log("[DRY RUN] Would delete company document");
    }
  } else {
    console.log("No company document found");
    stats.collections["companies"] = 0;
  }
  
  // 9. Live profile (if exists)
  if (liveProfileDoc.exists && !dryRun) {
    await liveProfileDoc.ref.delete();
    console.log(`✓ Deleted live profile: ${liveProfileId}`);
  } else if (liveProfileDoc.exists) {
    console.log(`[DRY RUN] Would delete live profile: ${liveProfileId}`);
  }
  
  // 10. Users collection and Auth
  stats.collections["users"] = allUserDocs.size;
  stats.totalDocs += allUserDocs.size;
  
  if (!dryRun && allUserDocs.size > 0) {
    const batch = db.batch();
    allUserDocs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`✓ Deleted ${allUserDocs.size} user documents from Firestore`);
  } else if (allUserDocs.size > 0) {
    console.log(`[DRY RUN] Would delete ${allUserDocs.size} user documents from Firestore`);
  }
  
  // 11. Firebase Auth users
  await deleteAuthUsers(Array.from(allUserDocs.values()), dryRun);
  
  // Print summary
  console.log("\n" + "=".repeat(80));
  console.log("=== DELETION SUMMARY ===");
  console.log("=".repeat(80));
  console.log("\nDocuments by collection:");
  Object.entries(stats.collections).forEach(([collection, count]) => {
    if (count > 0) {
      console.log(`  ${collection}: ${count} documents`);
    }
  });
  console.log(`\nFirebase Auth users: ${stats.authUsers}`);
  console.log(`Total Firestore documents: ${stats.totalDocs}`);
  console.log(`Errors: ${stats.errors}`);
  
  if (dryRun) {
    console.log("\n⚠️  DRY RUN COMPLETE - No data was deleted");
    console.log("To perform real deletion, run with --confirm flag:");
    console.log(`node functions/scripts/deleteCompanyById.js --companyId=${companyId} --locationId=${locationId} --confirm`);
  } else {
    console.log("\n✅ DELETION COMPLETE");
    console.log(`Deleted ${stats.totalDocs} Firestore documents and ${stats.authUsers} Auth users`);
  }
  
  console.log("\n" + "=".repeat(80));
}

// Run the deletion
deleteCompanyData()
  .then(() => {
    console.log("\nScript completed successfully");
    process.exit(0);
  })
  .catch(err => {
    console.error("\n❌ Fatal error:", err);
    process.exit(1);
  });
