const path = require("path");
const admin = require("firebase-admin");
const { OWNER_KIND, buildOwnerScopeMetadata, normalizeOwnerKind } = require("../lib/ownerScope");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "../../serviceAccountKey.json");
const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function parseArgs(argv) {
  const args = {};
  for (const item of argv.slice(2)) {
    if (item === "--apply") {
      args.apply = true;
      continue;
    }
    if (item === "--includeHistoricalReports") {
      args.includeHistoricalReports = true;
      continue;
    }
    const match = item.match(/^--([^=]+)=(.*)$/);
    if (match) {
      args[match[1]] = match[2].replace(/^"|"$/g, "");
    }
  }
  return args;
}

function requireArg(args, name) {
  const value = String(args[name] || "").trim();
  if (!value) throw new Error(`Missing required --${name}`);
  return value;
}

function docKey(ref) {
  return ref.path;
}

function dedupeDocs(docs) {
  const seen = new Set();
  const result = [];
  for (const item of docs) {
    const key = docKey(item.ref);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

async function getDocIfExists(ref, label) {
  const snap = await ref.get();
  return snap.exists ? [{ label, ref, data: snap.data() || {} }] : [];
}

async function getQueryDocs(query, label, filter = () => true) {
  const snap = await query.get();
  return snap.docs
    .map((doc) => ({ label, ref: doc.ref, data: doc.data() || {} }))
    .filter(filter);
}

function locationMatches(data, locationId) {
  if (data.locationId === locationId || data.primaryLocationId === locationId || data.activeLocationId === locationId) return true;
  return Array.isArray(data.locationIds) && data.locationIds.includes(locationId);
}

async function buildTargets({ companyId, locationId, includeHistoricalReports }) {
  const targets = [];

  targets.push(...await getDocIfExists(db.collection("companies").doc(companyId), "companies/{companyId}"));
  targets.push(...await getDocIfExists(
    db.collection("companies").doc(companyId).collection("locations").doc(locationId),
    "companies/{companyId}/locations/{locationId}"
  ));
  targets.push(...await getDocIfExists(db.collection("locations").doc(locationId), "locations/{locationId}"));
  targets.push(...await getDocIfExists(
    db.collection("companies").doc(companyId).collection("locations").doc(locationId).collection("risk_analysis").doc("current"),
    "companies/{companyId}/locations/{locationId}/risk_analysis/current"
  ));

  targets.push(...await getQueryDocs(
    db.collection("companies").doc(companyId).collection("members"),
    "companies/{companyId}/members/{uid}",
    (item) => !item.data.locationId || locationMatches(item.data, locationId)
  ));

  targets.push(...await getQueryDocs(
    db.collection("users").where("companyId", "==", companyId),
    "users/{uid}",
    (item) => locationMatches(item.data, locationId)
  ));

  targets.push(...await getQueryDocs(
    db.collection("live_user_profiles").where("companyId", "==", companyId).where("locationId", "==", locationId),
    "live_user_profiles/{uid}"
  ));

  for (const collectionName of ["task_templates", "verification_templates", "equipment", "onboarding_answers"]) {
    targets.push(...await getQueryDocs(
      db.collection(collectionName).where("companyId", "==", companyId).where("locationId", "==", locationId),
      `${collectionName}/{docId}`
    ));
  }

  if (includeHistoricalReports) {
    for (const collectionName of ["haccp_snapshots", "daily_reports", "reports"]) {
      targets.push(...await getQueryDocs(
        db.collection(collectionName).where("companyId", "==", companyId).where("locationId", "==", locationId),
        `${collectionName}/{docId}`
      ));
    }
  }

  return dedupeDocs(targets);
}

function existingOwnerKinds(targets) {
  const kinds = new Map();
  for (const item of targets) {
    const ownerKind = String(item.data.ownerKind || "").trim();
    if (!ownerKind) continue;
    if (!kinds.has(ownerKind)) kinds.set(ownerKind, []);
    kinds.get(ownerKind).push(item.ref.path);
  }
  return kinds;
}

function assertSafeOwnerKinds(targets, requestedOwnerKind) {
  const kinds = existingOwnerKinds(targets);
  const presentKinds = [...kinds.keys()];
  if (presentKinds.length > 1) {
    throw new Error(`Refusing to write: mixed ownerKind values already exist: ${presentKinds.join(", ")}`);
  }
  if (presentKinds.length === 1 && presentKinds[0] !== requestedOwnerKind) {
    throw new Error(`Refusing to write: existing ownerKind=${presentKinds[0]} does not match requested ownerKind=${requestedOwnerKind}`);
  }
  for (const kind of presentKinds) {
    normalizeOwnerKind(kind);
  }
}

function buildPatch(data, ownerScopeMetadata) {
  const patch = {};
  for (const [field, value] of Object.entries(ownerScopeMetadata)) {
    if (data[field] !== value) patch[field] = value;
  }
  if (Object.keys(patch).length > 0) {
    patch.ownerScopeBackfilledAt = FieldValue.serverTimestamp();
    patch.ownerScopeBackfilledBy = "backfillOwnerScopes";
  }
  return patch;
}

function printable(value) {
  if (value && value.constructor && value.constructor.name === "FieldValue") return "[serverTimestamp]";
  if (Array.isArray(value)) return value.map(printable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, printable(item)]));
  }
  return value;
}

async function commitInBatches(writes) {
  let committed = 0;
  for (let i = 0; i < writes.length; i += 450) {
    const batch = db.batch();
    const chunk = writes.slice(i, i + 450);
    for (const item of chunk) {
      batch.set(item.ref, item.patch, { merge: true });
    }
    await batch.commit();
    committed += chunk.length;
  }
  return committed;
}

async function main() {
  const args = parseArgs(process.argv);
  const companyId = requireArg(args, "companyId");
  const locationId = requireArg(args, "locationId");
  const ownerKind = normalizeOwnerKind(requireArg(args, "ownerKind"));
  const ownerScopeMetadata = buildOwnerScopeMetadata(ownerKind);
  const apply = args.apply === true;

  if (![OWNER_KIND.DEMO_OWNER, OWNER_KIND.REAL_OWNER].includes(ownerKind)) {
    throw new Error(`Unsupported ownerKind: ${ownerKind}`);
  }

  console.log(`Project: ${serviceAccount.project_id}`);
  console.log(`Mode: ${apply ? "APPLY - writes enabled" : "DRY RUN - no writes"}`);
  console.log(JSON.stringify({ companyId, locationId, ownerKind, includeHistoricalReports: !!args.includeHistoricalReports }, null, 2));

  const targets = await buildTargets({ companyId, locationId, includeHistoricalReports: !!args.includeHistoricalReports });
  assertSafeOwnerKinds(targets, ownerKind);

  const writes = targets
    .map((item) => ({ ...item, patch: buildPatch(item.data, ownerScopeMetadata) }))
    .filter((item) => Object.keys(item.patch).length > 0);

  const countsByLabel = {};
  for (const item of targets) countsByLabel[item.label] = (countsByLabel[item.label] || 0) + 1;

  console.log("\nTarget documents found:");
  console.log(JSON.stringify(countsByLabel, null, 2));

  console.log("\nPlanned writes:");
  if (writes.length === 0) {
    console.log("No writes needed.");
  } else {
    for (const item of writes) {
      console.log(`\n${item.ref.path}`);
      console.log(JSON.stringify(printable(item.patch), null, 2));
    }
  }

  if (!apply) {
    console.log("\nDry-run complete. No Firestore writes were made.");
    console.log("Run with --apply to write the planned owner scope metadata.");
    return;
  }

  const committed = await commitInBatches(writes);
  console.log(`\nApply complete. Wrote ${committed} document(s).`);
}

main().catch((error) => {
  console.error("backfillOwnerScopes failed:", error);
  process.exitCode = 1;
});
