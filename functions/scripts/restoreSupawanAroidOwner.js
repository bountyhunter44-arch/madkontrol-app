const path = require("path");
const admin = require("firebase-admin");
const { OWNER_KIND, buildOwnerScopeMetadata } = require("../lib/ownerScope");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "../../serviceAccountKey.json");

const APPLY = process.argv.includes("--apply");
const RESTORE_BY = "restoreSupawanAroidOwner";
const RESTORE_REASON = "Return Supawan from super-admin to owner of Aroi-D 42405000";

const SUPAWAN_UID = "HNcGHMrzsUPqbyBcmodsxBuWuJc2";
const SUPAWAN_EMAIL = "supawan@aroid.dk";
const SUPAWAN_NAME = "Supawan";

const COMPANY_ID = "company_1778453641187_xxaoilz18";
const LOCATION_ID = "location_1778453641187_fbljxh1ym";
const REQUIRED_MODULES = ["egenkontrol", "koerselskontrol"];
const TARGET_OWNER_SCOPE = buildOwnerScopeMetadata(OWNER_KIND.REAL_OWNER);

const PROTECTED_COLLECTIONS = [
  "task_entries",
  "task_instances",
  "task_templates",
  "daily_runs",
  "daily_reports",
  "deviations",
  "alerts",
  "equipment"
];

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const refs = {
  user: db.collection("users").doc(SUPAWAN_UID),
  liveProfile: db.collection("live_user_profiles").doc(SUPAWAN_UID),
  member: db.collection("companies").doc(COMPANY_ID).collection("members").doc(SUPAWAN_UID),
  company: db.collection("companies").doc(COMPANY_ID),
  companyLocation: db.collection("companies").doc(COMPANY_ID).collection("locations").doc(LOCATION_ID),
  rootLocation: db.collection("locations").doc(LOCATION_ID)
};

const allowedWritePaths = new Set(Object.values(refs).map((ref) => ref.path));

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function ensureModules(existing = []) {
  return unique([...(Array.isArray(existing) ? existing : []), ...REQUIRED_MODULES]);
}

function ensureModulesMap(existing = {}) {
  const next = existing && typeof existing === "object" && !Array.isArray(existing)
    ? { ...existing }
    : {};
  for (const moduleName of REQUIRED_MODULES) {
    next[moduleName] = true;
  }
  return next;
}

function ownerIdentityPatch(existing = {}, includeRestoreReason = false) {
  const patch = {
    uid: SUPAWAN_UID,
    userId: SUPAWAN_UID,
    email: SUPAWAN_EMAIL,
    displayName: SUPAWAN_NAME,
    role: "owner",
    roles: ["owner"],
    isSuperAdmin: false,
    status: "active",
    companyId: COMPANY_ID,
    locationId: LOCATION_ID,
    primaryLocationId: LOCATION_ID,
    locationIds: [LOCATION_ID],
    activeModules: REQUIRED_MODULES,
    ...TARGET_OWNER_SCOPE,
    restoredAt: FieldValue.serverTimestamp(),
    restoredBy: RESTORE_BY
  };

  if (includeRestoreReason) {
    patch.restoreReason = RESTORE_REASON;
  }

  if (existing.modules && typeof existing.modules === "object" && !Array.isArray(existing.modules)) {
    patch.modules = ensureModulesMap(existing.modules);
  }

  return patch;
}

function memberPatch(existing = {}) {
  const patch = {
    uid: SUPAWAN_UID,
    userId: SUPAWAN_UID,
    email: SUPAWAN_EMAIL,
    displayName: SUPAWAN_NAME,
    role: "owner",
    roles: ["owner"],
    status: "active",
    companyId: COMPANY_ID,
    organizationId: COMPANY_ID,
    locationIds: [LOCATION_ID],
    ...TARGET_OWNER_SCOPE,
    access: "all-locations",
    restoredAt: FieldValue.serverTimestamp(),
    restoredBy: RESTORE_BY
  };

  if (existing.modules && typeof existing.modules === "object" && !Array.isArray(existing.modules)) {
    patch.modules = ensureModulesMap(existing.modules);
  }

  return patch;
}

function companyPatch(existing = {}) {
  const patch = {
    ownerId: SUPAWAN_UID,
    ownerEmail: SUPAWAN_EMAIL,
    activeModules: ensureModules(existing.activeModules),
    ...TARGET_OWNER_SCOPE,
    restoredOwnerAt: FieldValue.serverTimestamp(),
    restoredOwnerBy: RESTORE_BY
  };

  if ("ownerUid" in existing) {
    patch.ownerUid = SUPAWAN_UID;
  }

  if ("cvr" in existing) {
    patch.cvr = existing.cvr || "42405000";
  } else {
    patch.cvr = "42405000";
  }

  if (existing.modules && typeof existing.modules === "object" && !Array.isArray(existing.modules)) {
    patch.modules = ensureModulesMap(existing.modules);
  }

  return patch;
}

function locationPatch(existing = {}) {
  const patch = {
    companyId: COMPANY_ID,
    organizationId: COMPANY_ID,
    locationId: LOCATION_ID,
    activeModules: ensureModules(existing.activeModules),
    ...TARGET_OWNER_SCOPE,
    restoredOwnerAt: FieldValue.serverTimestamp(),
    restoredOwnerBy: RESTORE_BY
  };

  if ("ownerId" in existing) {
    patch.ownerId = SUPAWAN_UID;
  }

  if ("ownerUid" in existing) {
    patch.ownerUid = SUPAWAN_UID;
  }

  if (existing.modules && typeof existing.modules === "object" && !Array.isArray(existing.modules)) {
    patch.modules = ensureModulesMap(existing.modules);
  }

  return patch;
}

function printable(value) {
  if (value && value.constructor && value.constructor.name === "FieldValue") {
    return "[serverTimestamp]";
  }
  if (Array.isArray(value)) {
    return value.map(printable);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, printable(item)]));
  }
  return value;
}

function summarize(data = {}) {
  return {
    uid: data.uid,
    userId: data.userId,
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    roles: data.roles,
    isSuperAdmin: data.isSuperAdmin,
    status: data.status,
    companyId: data.companyId,
    organizationId: data.organizationId,
    locationId: data.locationId,
    primaryLocationId: data.primaryLocationId,
    locationIds: data.locationIds,
    activeModules: data.activeModules,
    modules: data.modules,
    ownerId: data.ownerId,
    ownerUid: data.ownerUid,
    ownerEmail: data.ownerEmail,
    cvr: data.cvr,
    access: data.access
  };
}

async function readRef(name, ref) {
  const snap = await ref.get();
  return {
    name,
    ref,
    exists: snap.exists,
    data: snap.exists ? snap.data() : {}
  };
}

function assertAllowedPath(ref) {
  if (!allowedWritePaths.has(ref.path)) {
    throw new Error(`Refusing to write outside allowlist: ${ref.path}`);
  }
}

async function queueSet(batch, ref, patch) {
  assertAllowedPath(ref);
  batch.set(ref, patch, { merge: true });
}

async function countCollection(collectionName) {
  const companyIdCount = await db.collection(collectionName)
    .where("companyId", "==", COMPANY_ID)
    .where("locationId", "==", LOCATION_ID)
    .count()
    .get();

  return companyIdCount.data().count;
}

async function buildPlan() {
  const documents = await Promise.all([
    readRef("users uid profile", refs.user),
    readRef("live_user_profiles uid profile", refs.liveProfile),
    readRef("company member", refs.member),
    readRef("company", refs.company),
    readRef("company location", refs.companyLocation),
    readRef("root location", refs.rootLocation)
  ]);

  const byName = Object.fromEntries(documents.map((doc) => [doc.name, doc]));

  return [
    {
      label: "users/HNcGHMrzsUPqbyBcmodsxBuWuJc2",
      ref: refs.user,
      before: byName["users uid profile"],
      patch: ownerIdentityPatch(byName["users uid profile"].data, true)
    },
    {
      label: "live_user_profiles/HNcGHMrzsUPqbyBcmodsxBuWuJc2",
      ref: refs.liveProfile,
      before: byName["live_user_profiles uid profile"],
      patch: ownerIdentityPatch(byName["live_user_profiles uid profile"].data)
    },
    {
      label: `companies/${COMPANY_ID}/members/${SUPAWAN_UID}`,
      ref: refs.member,
      before: byName["company member"],
      patch: memberPatch(byName["company member"].data)
    },
    {
      label: `companies/${COMPANY_ID}`,
      ref: refs.company,
      before: byName.company,
      patch: companyPatch(byName.company.data)
    },
    {
      label: `companies/${COMPANY_ID}/locations/${LOCATION_ID}`,
      ref: refs.companyLocation,
      before: byName["company location"],
      patch: locationPatch(byName["company location"].data)
    },
    {
      label: `locations/${LOCATION_ID}`,
      ref: refs.rootLocation,
      before: byName["root location"],
      patch: locationPatch(byName["root location"].data)
    }
  ];
}

async function verifyAfterApply() {
  const [userSnap, liveSnap, memberSnap, companySnap, companyLocationSnap, rootLocationSnap] = await Promise.all([
    refs.user.get(),
    refs.liveProfile.get(),
    refs.member.get(),
    refs.company.get(),
    refs.companyLocation.get(),
    refs.rootLocation.get()
  ]);

  const counts = {};
  for (const collectionName of PROTECTED_COLLECTIONS) {
    counts[collectionName] = await countCollection(collectionName);
  }

  return {
    user: summarize(userSnap.data() || {}),
    liveProfile: summarize(liveSnap.data() || {}),
    memberExists: memberSnap.exists,
    member: summarize(memberSnap.data() || {}),
    company: summarize(companySnap.data() || {}),
    companyLocation: summarize(companyLocationSnap.data() || {}),
    rootLocation: summarize(rootLocationSnap.data() || {}),
    protectedCounts: counts
  };
}

async function main() {
  console.log(`Project: ${serviceAccount.project_id}`);
  console.log(`Mode: ${APPLY ? "APPLY - writes enabled" : "DRY RUN - no writes"}`);
  console.log("");

  const plan = await buildPlan();

  console.log("Planned writes:");
  for (const item of plan) {
    console.log(`\n${item.label}`);
    console.log("  exists:", item.before.exists);
    console.log("  before:", JSON.stringify(summarize(item.before.data), null, 2));
    console.log("  merge patch:", JSON.stringify(printable(item.patch), null, 2));
  }

  console.log("\nProtected collection counts before:");
  const beforeCounts = {};
  for (const collectionName of PROTECTED_COLLECTIONS) {
    beforeCounts[collectionName] = await countCollection(collectionName);
  }
  console.log(JSON.stringify(beforeCounts, null, 2));

  if (!APPLY) {
    console.log("\nDry-run complete. No Firestore writes were made.");
    console.log("Run with --apply to write only the six allowlisted owner/access documents.");
    return;
  }

  const batch = db.batch();
  for (const item of plan) {
    await queueSet(batch, item.ref, item.patch);
  }
  await batch.commit();

  console.log("\nApply complete. Wrote only allowlisted owner/access documents.");
  console.log("\nPost-apply verification:");
  console.log(JSON.stringify(printable(await verifyAfterApply()), null, 2));
}

main()
  .catch((error) => {
    console.error("restoreSupawanAroidOwner failed:", error);
    process.exitCode = 1;
  });
