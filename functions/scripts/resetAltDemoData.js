/**
 * HARD RESET AF DEMODATA
 *
 * Sletter ALLE dokumenter i:
 * - task_templates
 * - task_instances
 * - verification_instances
 * - users
 * - live_user_profiles
 * - daily_runs
 * - onboarding_answers
 * - deviations
 * - haccp_snapshots
 * - equipment
 * - locations
 * - companies
 *
 * Og kan også slette Firebase Auth-brugere.
 *
 * KØR:
 *   node functions\scripts\resetAltDemoData.js
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const SERVICE_ACCOUNT_PATH = path.resolve("D:\\madkontrol-app\\serviceAccountKey.json");

// SÆT TIL false NÅR DU VIL SLETTE RIGTIGT
const DRY_RUN = false;

// SÆT TIL true HVIS AUTH-BRUGERE OGSÅ SKAL SLETTES
const DELETE_AUTH_USERS = true;

// Hvis tom => sletter ALLE brugere i Firebase Auth
// Hvis du kun vil slette bestemte mails, så skriv dem her:
const ONLY_AUTH_EMAILS = [
  // "supawan@aroid.dk",
];

// Top-level collections der skal tømmes helt
const TOP_LEVEL_COLLECTIONS = [
  "task_templates",
  "task_instances",
  "verification_instances",
  "users",
  "live_user_profiles",
  "daily_runs",
  "onboarding_answers",
  "deviations",
  "haccp_snapshots",
  "equipment",
  "locations",
  "companies",
];

// Hjælpefunktion
function log(...args) {
  console.log(...args);
}

function warn(...args) {
  console.warn(...args);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function initFirebase() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(`Service account ikke fundet: ${SERVICE_ACCOUNT_PATH}`);
  }

  const serviceAccount = require(SERVICE_ACCOUNT_PATH);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  log(`[initFirebase] Service account: ${SERVICE_ACCOUNT_PATH}`);
  log(`[initFirebase] PROJECT: ${serviceAccount.project_id}`);
}

async function deleteBatchFromQuery(query, label) {
  let deleted = 0;

  while (true) {
    const snap = await query.limit(200).get();
    if (snap.empty) break;

    log(`  -> ${label}: fandt ${snap.size} docs`);

    if (!DRY_RUN) {
      const batch = admin.firestore().batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    deleted += snap.size;

    if (snap.size < 200) break;
    await sleep(100);
  }

  return deleted;
}

async function deleteCollectionRecursive(collectionPath) {
  const db = admin.firestore();
  const collectionRef = db.collection(collectionPath);

  let totalDeleted = 0;

  while (true) {
    const snap = await collectionRef.limit(100).get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      totalDeleted += await deleteDocumentRecursive(doc.ref);
    }
  }

  return totalDeleted;
}

async function deleteDocumentRecursive(docRef) {
  let deletedCount = 0;

  const subcollections = await docRef.listCollections();

  for (const subcol of subcollections) {
    deletedCount += await deleteCollectionRecursive(subcol.path);
  }

  if (!DRY_RUN) {
    await docRef.delete();
  }

  return deletedCount + 1;
}

async function deleteTopLevelCollections() {
  log("======================================");
  log("SLETTER TOP-LEVEL COLLECTIONS");
  log("======================================");

  for (const collectionName of TOP_LEVEL_COLLECTIONS) {
    log(`Sletter collection: ${collectionName}`);

    try {
      const deleted = await deleteCollectionRecursive(collectionName);
      log(`  -> Slettet ${deleted} docs fra ${collectionName}`);
    } catch (error) {
      warn(`  -> FEJL i ${collectionName}: ${error.message}`);
    }
  }
}

async function listAllAuthUsers() {
  const allUsers = [];
  let nextPageToken;

  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    allUsers.push(...result.users);
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  return allUsers;
}

async function deleteAuthUsers() {
  if (!DELETE_AUTH_USERS) {
    log("Auth-sletning er slået fra.");
    return;
  }

  log("======================================");
  log("SLETTER FIREBASE AUTH-BRUGERE");
  log("======================================");

  const users = await listAllAuthUsers();

  let targets = users;

  if (ONLY_AUTH_EMAILS.length > 0) {
    const emailSet = new Set(ONLY_AUTH_EMAILS.map((v) => String(v).trim().toLowerCase()));
    targets = users.filter((u) => emailSet.has(String(u.email || "").trim().toLowerCase()));
  }

  if (!targets.length) {
    log("Ingen Auth-brugere matchede filteret.");
    return;
  }

  log(`Auth-brugere fundet til sletning: ${targets.length}`);

  for (const user of targets) {
    const label = `${user.uid} ${user.email || "(ingen email)"}`;
    if (DRY_RUN) {
      log(`  [DRY_RUN] Ville slette Auth-bruger: ${label}`);
    } else {
      await admin.auth().deleteUser(user.uid);
      log(`  -> Slettet Auth-bruger: ${label}`);
    }
  }
}

async function main() {
  initFirebase();

  log("======================================");
  log("HARD RESET DEMODATA");
  log("======================================");
  log(`DRY_RUN: ${DRY_RUN}`);
  log(`DELETE_AUTH_USERS: ${DELETE_AUTH_USERS}`);
  log(`ONLY_AUTH_EMAILS: ${ONLY_AUTH_EMAILS.length ? ONLY_AUTH_EMAILS.join(", ") : "(tom = alle)"}`);

  await deleteTopLevelCollections();
  await deleteAuthUsers();

  log("======================================");
  log(DRY_RUN ? "DRY RUN FÆRDIG" : "ALT DEMODATA SLETTET");
  log("======================================");
}

main().catch((error) => {
  console.error("FATAL FEJL:", error);
  process.exit(1);
});