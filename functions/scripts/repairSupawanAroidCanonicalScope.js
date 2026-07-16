const path = require("path");
const admin = require("firebase-admin");
const { OWNER_KIND, buildOwnerScopeMetadata } = require("../lib/ownerScope");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "../../serviceAccountKey.json");

const APPLY = process.argv.includes("--apply");
const REPAIR_SOURCE = "repairSupawanAroidCanonicalScope";
const REPAIR_REASON = "restore-paid-stripe-onboarding-scope";

const EMAIL_CANDIDATES = ["supawan@aoid.dk", "supawan@aroid.dk"];
const CANONICAL_COMPANY_ID = "onboarding_aroi-d_42405000";
const CANONICAL_LOCATION_ID = "onboarding_aroi-d_42405000__main";
const REQUIRED_MODULES = ["pos", "koerselskontrol"];
const TARGET_OWNER_SCOPE = buildOwnerScopeMetadata(OWNER_KIND.REAL_OWNER);

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();
const auth = admin.auth();
const FieldValue = admin.firestore.FieldValue;

function unique(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function asDate(value) {
  return value && typeof value.toDate === "function" ? value.toDate().toISOString() : value;
}

function printable(value) {
  if (value && value.constructor && value.constructor.name === "FieldValue") return "[serverTimestamp]";
  if (Array.isArray(value)) return value.map(printable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, printable(item)]));
  }
  return asDate(value);
}

function summarize(data = {}) {
  return printable({
    uid: data.uid,
    userId: data.userId,
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    roles: data.roles,
    status: data.status,
    companyId: data.companyId,
    organizationId: data.organizationId,
    locationId: data.locationId,
    primaryLocationId: data.primaryLocationId,
    locationIds: data.locationIds,
    activeCompanyId: data.activeCompanyId,
    activeLocationId: data.activeLocationId,
    activeModules: data.activeModules,
    modules: data.modules,
    madkontrollen: data.madkontrollen,
    restoredBy: data.restoredBy,
    restoredAt: data.restoredAt,
    repairSource: data.repairSource,
    repairReason: data.repairReason,
    repairedAt: data.repairedAt,
    updatedAt: data.updatedAt
  });
}

function readModules(data = {}) {
  const modules = new Set();
  for (const value of [data.selectedModules, data.activeModules, data.latestPurchasedModules]) {
    if (Array.isArray(value)) value.forEach((moduleKey) => modules.add(String(moduleKey || "").trim()));
  }
  if (data.pricingSnapshot && Array.isArray(data.pricingSnapshot.selectedModules)) {
    data.pricingSnapshot.selectedModules.forEach((moduleKey) => modules.add(String(moduleKey || "").trim()));
  }
  if (data.subscription && Array.isArray(data.subscription.selectedModules)) {
    data.subscription.selectedModules.forEach((moduleKey) => modules.add(String(moduleKey || "").trim()));
  }
  if (data.subscription && Array.isArray(data.subscription.latestPurchasedModules)) {
    data.subscription.latestPurchasedModules.forEach((moduleKey) => modules.add(String(moduleKey || "").trim()));
  }
  return unique([...modules]);
}

function hasRequiredModules(modules) {
  const set = new Set(unique(modules));
  return REQUIRED_MODULES.every((moduleKey) => set.has(moduleKey));
}

async function findUser() {
  const attempts = [];
  for (const email of EMAIL_CANDIDATES) {
    try {
      const user = await auth.getUserByEmail(email);
      attempts.push({ email, found: true, uid: user.uid, authEmail: user.email, displayName: user.displayName || "" });
      return { user, attempts };
    } catch (error) {
      attempts.push({ email, found: false, code: error.code || "", message: error.message || "" });
    }
  }
  const error = new Error("Supawan Auth user not found for any candidate email.");
  error.attempts = attempts;
  throw error;
}

async function readDoc(ref) {
  const snap = await ref.get();
  return {
    ref,
    exists: snap.exists,
    data: snap.exists ? snap.data() : {}
  };
}

function contextPatch(existing, { uid, email, displayName, canonicalModules, includeRestoreReason }) {
  const patch = {
    uid,
    userId: uid,
    email,
    displayName: displayName || existing.displayName || "Supawan",
    companyId: CANONICAL_COMPANY_ID,
    organizationId: CANONICAL_COMPANY_ID,
    locationId: CANONICAL_LOCATION_ID,
    primaryLocationId: CANONICAL_LOCATION_ID,
    locationIds: [CANONICAL_LOCATION_ID],
    activeCompanyId: CANONICAL_COMPANY_ID,
    activeLocationId: CANONICAL_LOCATION_ID,
    activeModules: canonicalModules,
    ...TARGET_OWNER_SCOPE,
    status: existing.status || "active",
    repairSource: REPAIR_SOURCE,
    repairReason: REPAIR_REASON,
    repairedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  if (Array.isArray(existing.roles)) patch.roles = existing.roles;
  if (existing.role) patch.role = existing.role;
  if (existing.modules && typeof existing.modules === "object" && !Array.isArray(existing.modules)) {
    patch.modules = Object.fromEntries(canonicalModules.map((moduleKey) => [moduleKey, true]));
  }
  if (existing.madkontrollen && typeof existing.madkontrollen === "object" && !Array.isArray(existing.madkontrollen)) {
    patch.madkontrollen = {
      ...existing.madkontrollen,
      companyId: CANONICAL_COMPANY_ID,
      locationId: CANONICAL_LOCATION_ID
    };
  }
  if (includeRestoreReason) {
    patch.previousRestoreSource = existing.restoredBy || "";
    patch.previousRestoreReason = existing.restoreReason || "";
  }

  return patch;
}

function memberPatch(existing, { uid, email, displayName, canonicalModules }) {
  const patch = {
    uid,
    userId: uid,
    email,
    displayName: displayName || existing.displayName || "Supawan",
    companyId: CANONICAL_COMPANY_ID,
    organizationId: CANONICAL_COMPANY_ID,
    locationId: CANONICAL_LOCATION_ID,
    primaryLocationId: CANONICAL_LOCATION_ID,
    locationIds: [CANONICAL_LOCATION_ID],
    role: existing.role || "owner",
    roles: Array.isArray(existing.roles) ? existing.roles : ["owner"],
    status: existing.status || "active",
    access: existing.access || "all-locations",
    activeModules: canonicalModules,
    ...TARGET_OWNER_SCOPE,
    repairSource: REPAIR_SOURCE,
    repairReason: REPAIR_REASON,
    repairedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  if (existing.modules && typeof existing.modules === "object" && !Array.isArray(existing.modules)) {
    patch.modules = Object.fromEntries(canonicalModules.map((moduleKey) => [moduleKey, true]));
  }

  return patch;
}

function diffSummary(before, patch) {
  const afterKeys = Object.keys(patch).sort();
  return afterKeys.map((key) => ({
    field: key,
    before: printable(before[key]),
    after: printable(patch[key])
  }));
}

async function buildPlan() {
  const { user, attempts } = await findUser();
  const uid = user.uid;
  const email = user.email || "supawan@aroid.dk";
  const authDisplayName = user.displayName || "Supawan";

  const refs = {
    user: db.collection("users").doc(uid),
    liveProfile: db.collection("live_user_profiles").doc(uid),
    canonicalCompany: db.collection("companies").doc(CANONICAL_COMPANY_ID),
    canonicalLocation: db.collection("companies").doc(CANONICAL_COMPANY_ID).collection("locations").doc(CANONICAL_LOCATION_ID),
    rootCanonicalLocation: db.collection("locations").doc(CANONICAL_LOCATION_ID),
    canonicalSubscription: db.collection("companies").doc(CANONICAL_COMPANY_ID).collection("subscriptions").doc("current"),
    canonicalMember: db.collection("companies").doc(CANONICAL_COMPANY_ID).collection("members").doc(uid)
  };

  const [
    userDoc,
    liveProfileDoc,
    canonicalCompanyDoc,
    canonicalLocationDoc,
    rootCanonicalLocationDoc,
    canonicalSubscriptionDoc,
    canonicalMemberDoc
  ] = await Promise.all([
    readDoc(refs.user),
    readDoc(refs.liveProfile),
    readDoc(refs.canonicalCompany),
    readDoc(refs.canonicalLocation),
    readDoc(refs.rootCanonicalLocation),
    readDoc(refs.canonicalSubscription),
    readDoc(refs.canonicalMember)
  ]);

  if (!canonicalCompanyDoc.exists) throw new Error(`Canonical company missing: ${refs.canonicalCompany.path}`);
  if (!canonicalLocationDoc.exists && !rootCanonicalLocationDoc.exists) {
    throw new Error(`Canonical location missing: ${CANONICAL_LOCATION_ID}`);
  }
  if (!canonicalSubscriptionDoc.exists) throw new Error(`Canonical subscription missing: ${refs.canonicalSubscription.path}`);

  const canonicalModules = unique([
    ...readModules(canonicalCompanyDoc.data),
    ...readModules(canonicalSubscriptionDoc.data),
    ...readModules(canonicalLocationDoc.data),
    ...readModules(rootCanonicalLocationDoc.data)
  ]);

  if (!hasRequiredModules(canonicalModules)) {
    throw new Error(`Canonical subscription/company does not include required modules: ${REQUIRED_MODULES.join(", ")}`);
  }

  const displayName = userDoc.data.displayName || liveProfileDoc.data.displayName || authDisplayName;

  const writes = [
    {
      label: refs.user.path,
      ref: refs.user,
      before: userDoc,
      patch: contextPatch(userDoc.data, { uid, email, displayName, canonicalModules, includeRestoreReason: true })
    },
    {
      label: refs.liveProfile.path,
      ref: refs.liveProfile,
      before: liveProfileDoc,
      patch: contextPatch(liveProfileDoc.data, { uid, email, displayName, canonicalModules, includeRestoreReason: false })
    },
    {
      label: refs.canonicalMember.path,
      ref: refs.canonicalMember,
      before: canonicalMemberDoc,
      patch: memberPatch(canonicalMemberDoc.data, { uid, email, displayName, canonicalModules })
    }
  ];

  return {
    uid,
    email,
    attempts,
    canonical: {
      company: canonicalCompanyDoc,
      location: canonicalLocationDoc,
      rootLocation: rootCanonicalLocationDoc,
      subscription: canonicalSubscriptionDoc,
      modules: canonicalModules
    },
    writes
  };
}

async function main() {
  const plan = await buildPlan();
  const allowedPaths = new Set(plan.writes.map((item) => item.ref.path));

  console.log(`Project: ${serviceAccount.project_id}`);
  console.log(`Mode: ${APPLY ? "APPLY - writes enabled" : "DRY RUN - no writes"}`);
  console.log("");
  console.log("Auth lookup:");
  console.log(JSON.stringify(plan.attempts, null, 2));
  console.log("");
  console.log("Canonical scope:");
  console.log(JSON.stringify({
    companyId: CANONICAL_COMPANY_ID,
    locationId: CANONICAL_LOCATION_ID,
    companyExists: plan.canonical.company.exists,
    locationExists: plan.canonical.location.exists || plan.canonical.rootLocation.exists,
    subscriptionExists: plan.canonical.subscription.exists,
    subscriptionStatus: plan.canonical.subscription.data.status,
    modules: plan.canonical.modules
  }, null, 2));

  console.log("");
  console.log("Planned context writes:");
  for (const item of plan.writes) {
    console.log(`\n${item.label}`);
    console.log("  exists:", item.before.exists);
    console.log("  before:", JSON.stringify(summarize(item.before.data), null, 2));
    console.log("  patch:", JSON.stringify(printable(item.patch), null, 2));
    console.log("  changed fields:", JSON.stringify(diffSummary(item.before.data, item.patch), null, 2));
  }

  if (!APPLY) {
    console.log("\nDry-run complete. No Firestore writes were made.");
    console.log("Run with --apply to write only the allowlisted context documents above.");
    return;
  }

  const batch = db.batch();
  for (const item of plan.writes) {
    if (!allowedPaths.has(item.ref.path)) {
      throw new Error(`Refusing to write outside allowlist: ${item.ref.path}`);
    }
    batch.set(item.ref, item.patch, { merge: true });
  }
  await batch.commit();

  const postUser = await readDoc(db.collection("users").doc(plan.uid));
  const postLiveProfile = await readDoc(db.collection("live_user_profiles").doc(plan.uid));
  const postMember = await readDoc(db.collection("companies").doc(CANONICAL_COMPANY_ID).collection("members").doc(plan.uid));

  console.log("\nApply complete. Wrote only allowlisted context documents.");
  console.log("Post-apply context:");
  console.log(JSON.stringify({
    user: summarize(postUser.data),
    liveProfile: summarize(postLiveProfile.data),
    canonicalMember: summarize(postMember.data)
  }, null, 2));
}

main().catch((error) => {
  console.error(REPAIR_SOURCE, "failed:", error);
  process.exitCode = 1;
});
