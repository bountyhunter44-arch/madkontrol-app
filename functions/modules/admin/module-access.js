"use strict";

const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAppRegistry } = require("../../platform/app-registry");
const { PLATFORM_MODULE_PRICING } = require("../../platform/module-pricing");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const ADMIN_SOURCE = "admin_override";
const ACTIVE_STATUS = "active";
const INACTIVE_STATUS = "inactive";
const SUPER_ADMIN_EMAILS = new Set(["mn@aroid.dk", "michael@madkontrollen.dk"]);
const ADMIN_ROLES = new Set(["owner", "hq_admin", "location_manager", "admin", "super-admin", "superadmin"]);
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "paid"]);

function sanitizeString(value, maxLen = 500) {
  return String(value || "").trim().slice(0, maxLen);
}

function safeDocPart(value, fallback = "all") {
  const normalized = sanitizeString(value || fallback, 140)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeModuleKey(value) {
  const raw = sanitizeString(value, 80).toLowerCase();
  const aliases = {
    accounting: "bogforing",
    bogføring: "bogforing",
    bogfoering: "bogforing",
    "lagerkontrol-pro": "lagerkontrol",
    opskrifter: "menu",
    "opskrifter-menu": "menu",
    recipes: "recipes",
    kalkulation: "calculation",
    koersel: "koerselskontrol",
    kørsel: "koerselskontrol",
    koerekontrol: "koerselskontrol",
    kørekontrol: "koerselskontrol",
    kørselskontrol: "koerselskontrol",
    driving: "koerselskontrol",
    drivingcontrol: "koerselskontrol",
    koerebog: "koerselskontrol"
  };
  return aliases[raw] || raw;
}

function getAssignableModules() {
  const modules = new Map();

  Object.values(PLATFORM_MODULE_PRICING || {}).forEach((entry) => {
    const key = normalizeModuleKey(entry.key);
    if (!key) return;
    modules.set(key, {
      moduleKey: key,
      name: entry.name || key,
      status: "active",
      sourceCatalog: "module_pricing"
    });
  });

  getAppRegistry().forEach((app) => {
    const appKey = normalizeModuleKey(app.appKey);
    const entitlement = normalizeModuleKey(app.requiredEntitlement || appKey);
    const key = entitlement || appKey;
    if (!key || ["core", "madkontrollen-core", "ops-center"].includes(key)) return;
    if (app.status && !["active", "planned"].includes(app.status)) return;
    const existing = modules.get(key) || {};
    modules.set(key, {
      moduleKey: key,
      name: existing.name || app.name || key,
      status: app.status || existing.status || "active",
      entryUrl: app.entryUrl || existing.entryUrl || "",
      sourceCatalog: existing.sourceCatalog || "app_registry"
    });
  });

  return [...modules.values()].sort((a, b) => a.name.localeCompare(b.name, "da"));
}

function assertKnownModule(moduleKey) {
  const key = normalizeModuleKey(moduleKey);
  const known = getAssignableModules().some((module) => module.moduleKey === key);
  if (!known) {
    throw new HttpsError("invalid-argument", `Ukendt modulnøgle: ${moduleKey}`);
  }
  return key;
}

function accessDocId({ moduleKey, locationId, userId }) {
  const locationPart = locationId ? `location_${safeDocPart(locationId)}` : "company";
  const userPart = userId ? `user_${safeDocPart(userId)}` : "all-users";
  return `${safeDocPart(moduleKey)}__${locationPart}__${userPart}`;
}

function parseTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function timestampOrNull(value) {
  const parsed = parseTimestamp(value);
  return parsed ? admin.firestore.Timestamp.fromDate(parsed) : null;
}

function addSource(sourceMap, moduleKey, source) {
  const key = normalizeModuleKey(moduleKey);
  const cleanSource = sanitizeString(source, 60);
  if (!key || !cleanSource) return;
  if (!sourceMap[key]) sourceMap[key] = new Set();
  sourceMap[key].add(cleanSource);
}

function addModuleMapSources(sourceMap, modules, source) {
  if (!modules || typeof modules !== "object" || Array.isArray(modules)) return;
  Object.entries(modules).forEach(([moduleKey, enabled]) => {
    if (enabled === true) addSource(sourceMap, moduleKey, source);
  });
}

function hasActiveSubscription(subscription = {}) {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(sanitizeString(subscription.status, 60).toLowerCase());
}

function addSubscriptionSources(sourceMap, data = {}) {
  const subscription = data.subscription && typeof data.subscription === "object" ? data.subscription : {};
  if (hasActiveSubscription(subscription)) {
    normalizeList(subscription.selectedModules).forEach((moduleKey) => {
      addSource(sourceMap, moduleKey, "paid_subscription");
    });
  }

  const subscriptionStatus = sanitizeString(data.subscriptionStatus || data.status, 60).toLowerCase();
  if (subscriptionStatus === "trial") {
    normalizeList(data.activeModules).forEach((moduleKey) => addSource(sourceMap, moduleKey, "trial"));
  } else if (subscriptionStatus === "demo" || data.demoMode === true || data.isDemo === true) {
    normalizeList(data.activeModules).forEach((moduleKey) => addSource(sourceMap, moduleKey, "demo"));
  }
}

async function addCurrentSubscriptionSources(companyId, sourceMap) {
  const currentSnap = await db.collection("companies").doc(companyId).collection("subscriptions").doc("current").get();
  if (currentSnap.exists && hasActiveSubscription(currentSnap.data() || {})) {
    normalizeList(currentSnap.data().selectedModules).forEach((moduleKey) => {
      addSource(sourceMap, moduleKey, "paid_subscription");
    });
  }
}

function accessDocApplies(data = {}, { companyId, locationId, userId }) {
  if (data.assignedToCompanyId && data.assignedToCompanyId !== companyId) return false;
  if (data.assignedToLocationId && data.assignedToLocationId !== locationId) return false;
  if (data.assignedToUserId && data.assignedToUserId !== userId) return false;
  if (data.expiresAt) {
    const expiresAt = parseTimestamp(data.expiresAt);
    if (expiresAt && expiresAt.getTime() <= Date.now()) return false;
  }
  return true;
}

async function collectEffectiveSources({ companyId, locationId = "", userId = "", includeQuickLists = true }) {
  const sourceMap = {};
  const companyRef = db.collection("companies").doc(companyId);
  const companySnap = await companyRef.get();
  const companyData = companySnap.exists ? (companySnap.data() || {}) : {};
  const locationRef = locationId ? companyRef.collection("locations").doc(locationId) : null;
  const locationSnap = locationRef ? await locationRef.get() : null;
  const locationData = locationSnap?.exists ? (locationSnap.data() || {}) : {};

  addSubscriptionSources(sourceMap, companyData);
  addSubscriptionSources(sourceMap, locationData);
  await addCurrentSubscriptionSources(companyId, sourceMap);

  if (includeQuickLists) {
    const fallbackSource = companyData.demoMode || companyData.isDemo
      ? "demo"
      : sanitizeString(companyData.subscriptionStatus || companyData.status, 60).toLowerCase() === "trial"
        ? "trial"
        : hasActiveSubscription(companyData.subscription)
          ? "paid_subscription"
          : "internal";
    normalizeList(companyData.activeModules).forEach((moduleKey) => addSource(sourceMap, moduleKey, fallbackSource));
    normalizeList(locationData.activeModules).forEach((moduleKey) => addSource(sourceMap, moduleKey, fallbackSource));
    addModuleMapSources(sourceMap, companyData.modules, fallbackSource);
    addModuleMapSources(sourceMap, locationData.modules, fallbackSource);
  }

  const accessSnap = await companyRef.collection("module_access").get();
  const accessDocs = [];
  accessSnap.forEach((item) => {
    const data = item.data() || {};
    const moduleKey = normalizeModuleKey(data.moduleKey || item.id.split("__")[0]);
    const docData = { id: item.id, ...data, moduleKey };
    accessDocs.push(docData);
    if (data.status === ACTIVE_STATUS && accessDocApplies(docData, { companyId, locationId, userId })) {
      addSource(sourceMap, moduleKey, data.source || ADMIN_SOURCE);
    }
  });

  const moduleSources = Object.fromEntries(
    Object.entries(sourceMap).map(([moduleKey, sources]) => [moduleKey, [...sources]])
  );
  const activeModules = Object.keys(moduleSources).sort();

  return {
    activeModules,
    moduleSources,
    accessDocs,
    company: companyData,
    location: locationData
  };
}

async function getEffectiveActiveModules(companyId, locationId = "", userId = "") {
  const result = await collectEffectiveSources({ companyId, locationId, userId, includeQuickLists: true });
  return {
    activeModules: result.activeModules,
    moduleSources: result.moduleSources
  };
}

async function syncQuickLists({ companyId, locationId, moduleKey, status }) {
  const companyRef = db.collection("companies").doc(companyId);
  const locationRef = locationId ? companyRef.collection("locations").doc(locationId) : null;

  if (status === ACTIVE_STATUS) {
    await companyRef.set({
      activeModules: FieldValue.arrayUnion(moduleKey),
      modules: {
        [moduleKey]: true
      },
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    if (locationRef) {
      await locationRef.set({
        activeModules: FieldValue.arrayUnion(moduleKey),
        modules: {
          [moduleKey]: true
        },
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    return;
  }

  const durable = await collectEffectiveSources({ companyId, locationId, userId: "", includeQuickLists: false });
  const stillActive = Array.isArray(durable.moduleSources[moduleKey]) && durable.moduleSources[moduleKey].length > 0;
  if (stillActive) return;

  await companyRef.set({
    activeModules: FieldValue.arrayRemove(moduleKey),
    modules: {
      [moduleKey]: FieldValue.delete()
    },
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  if (locationRef) {
    await locationRef.set({
      activeModules: FieldValue.arrayRemove(moduleKey),
      modules: {
        [moduleKey]: FieldValue.delete()
      },
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
}

async function getUserProfile(uid, email = "") {
  if (uid) {
    const snap = await db.collection("users").doc(uid).get();
    if (snap.exists) return { id: snap.id, ...(snap.data() || {}) };
  }
  const cleanEmail = sanitizeString(email, 180).toLowerCase();
  if (!cleanEmail) return null;
  const snap = await db.collection("users").where("email", "==", cleanEmail).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...(snap.docs[0].data() || {}) };
}

function getUserLocationIds(userData = {}) {
  const ids = [];
  const push = (value) => {
    const clean = sanitizeString(value, 140);
    if (clean) ids.push(clean);
  };
  push(userData.locationId);
  push(userData.primaryLocationId);
  if (Array.isArray(userData.locationIds)) userData.locationIds.forEach(push);
  return [...new Set(ids)];
}

async function assertAdminAccess({ uid, email, companyId, locationId }) {
  const userData = await getUserProfile(uid, email);
  if (!userData) throw new HttpsError("permission-denied", "Brugerprofil blev ikke fundet.");

  const role = sanitizeString(userData.role, 80).toLowerCase();
  const isSuperAdmin = role === "super-admin" || role === "superadmin";
  if (!ADMIN_ROLES.has(role)) {
    throw new HttpsError("permission-denied", "Kun admin-brugere må ændre moduladgang.");
  }

  if (isSuperAdmin) {
    const tokenEmail = sanitizeString(email, 180).toLowerCase();
    if (!SUPER_ADMIN_EMAILS.has(tokenEmail) && !SUPER_ADMIN_EMAILS.has(sanitizeString(userData.email, 180).toLowerCase())) {
      throw new HttpsError("permission-denied", "Super-admin email er ikke godkendt til intern adgangsstyring.");
    }
    return { userData, role, isSuperAdmin };
  }

  const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 140);
  if (!companyId || userCompanyId !== companyId) {
    throw new HttpsError("permission-denied", "Adgang til virksomheden er afvist.");
  }

  const locationIds = getUserLocationIds(userData);
  if (locationId && locationIds.length > 0 && !locationIds.includes(locationId)) {
    throw new HttpsError("permission-denied", "Adgang til lokationen er afvist.");
  }

  return { userData, role, isSuperAdmin: false };
}

async function assertTargetUserAllowed({ userId, companyId, isSuperAdmin }) {
  if (!userId) return null;
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Brugeren blev ikke fundet.");
  const data = snap.data() || {};
  const targetCompanyId = sanitizeString(data.companyId || data.organizationId, 140);
  if (!isSuperAdmin && targetCompanyId !== companyId) {
    throw new HttpsError("permission-denied", "Målbrugeren hører ikke til virksomheden.");
  }
  return { id: snap.id, ...data };
}

async function logAudit({ companyId, action, adminUid, locationId, userId, moduleKey, oldStatus, newStatus, reason }) {
  await db.collection("companies").doc(companyId).collection("admin_audit_log").add({
    eventType: "admin_module_access_changed",
    action,
    adminUid,
    companyId,
    locationId: locationId || "",
    userId: userId || "",
    moduleKey,
    oldStatus: oldStatus || "",
    newStatus,
    source: ADMIN_SOURCE,
    reason: reason || "",
    createdAt: FieldValue.serverTimestamp()
  });
}

async function setModuleAccess({ auth, payload }) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Log ind for at ændre moduladgang.");

  const companyId = sanitizeString(payload.companyId, 140);
  const locationId = sanitizeString(payload.locationId, 140);
  const userId = sanitizeString(payload.userId, 140);
  const status = sanitizeString(payload.status || ACTIVE_STATUS, 40).toLowerCase();
  const source = sanitizeString(payload.source || ADMIN_SOURCE, 60);
  const reason = sanitizeString(payload.reason, 500);
  const expiresAt = timestampOrNull(payload.expiresAt);
  const moduleKey = assertKnownModule(payload.moduleKey);

  if (!companyId) throw new HttpsError("invalid-argument", "companyId er påkrævet.");
  if (![ACTIVE_STATUS, INACTIVE_STATUS].includes(status)) {
    throw new HttpsError("invalid-argument", "status skal være active eller inactive.");
  }
  if (source !== ADMIN_SOURCE) {
    throw new HttpsError("invalid-argument", "Admin-styring må kun skrive source admin_override.");
  }

  const access = await assertAdminAccess({
    uid: auth.uid,
    email: auth.token?.email || "",
    companyId,
    locationId
  });
  await assertTargetUserAllowed({ userId, companyId, isSuperAdmin: access.isSuperAdmin });

  const docRef = db.collection("companies").doc(companyId).collection("module_access").doc(accessDocId({ moduleKey, locationId, userId }));
  const oldSnap = await docRef.get();
  const oldStatus = oldSnap.exists ? sanitizeString(oldSnap.data().status, 40) : "";
  const now = FieldValue.serverTimestamp();

  const data = {
    moduleKey,
    status,
    source: ADMIN_SOURCE,
    assignedBy: auth.uid,
    assignedToUserId: userId || "",
    assignedToCompanyId: companyId,
    assignedToLocationId: locationId || "",
    reason,
    updatedAt: now,
    expiresAt
  };
  if (!oldSnap.exists) data.createdAt = now;

  await docRef.set(data, { merge: true });
  await logAudit({
    companyId,
    action: status === ACTIVE_STATUS ? "grant" : "revoke",
    adminUid: auth.uid,
    locationId,
    userId,
    moduleKey,
    oldStatus,
    newStatus: status,
    reason
  });
  await syncQuickLists({ companyId, locationId, moduleKey, status });

  return getEffectiveActiveModules(companyId, locationId, userId);
}

async function listLocations(companyId) {
  const snap = await db.collection("companies").doc(companyId).collection("locations").limit(100).get();
  return snap.docs.map((item) => ({ id: item.id, ...(item.data() || {}) }));
}

async function listUsers(companyId) {
  const byCompany = await db.collection("users").where("companyId", "==", companyId).limit(100).get();
  const users = new Map();
  byCompany.forEach((item) => users.set(item.id, { userId: item.id, ...(item.data() || {}) }));

  const byOrg = await db.collection("users").where("organizationId", "==", companyId).limit(100).get();
  byOrg.forEach((item) => users.set(item.id, { userId: item.id, ...(item.data() || {}) }));

  return [...users.values()].map((user) => ({
    userId: user.userId,
    displayName: user.displayName || user.name || user.email || user.userId,
    email: user.email || "",
    role: user.role || "",
    locationId: user.locationId || user.primaryLocationId || "",
    locationIds: Array.isArray(user.locationIds) ? user.locationIds : []
  }));
}

exports.adminSetModuleAccess = onCall({ region: "us-central1" }, async (request) => {
  const effective = await setModuleAccess({ auth: request.auth, payload: request.data || {} });
  return { ok: true, ...effective };
});

exports.adminSetAllModulesAccess = onCall({ region: "us-central1", timeoutSeconds: 60 }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Log ind for at ændre moduladgang.");

  const data = request.data || {};
  const companyId = sanitizeString(data.companyId, 140);
  const locationId = sanitizeString(data.locationId, 140);
  const userId = sanitizeString(data.userId, 140);
  const status = sanitizeString(data.status || ACTIVE_STATUS, 40).toLowerCase();
  const reason = sanitizeString(data.reason, 500);
  const expiresAt = data.expiresAt || null;
  const moduleKeys = Array.isArray(data.moduleKeys) && data.moduleKeys.length
    ? data.moduleKeys.map(assertKnownModule)
    : getAssignableModules().map((module) => module.moduleKey);

  if (!companyId) throw new HttpsError("invalid-argument", "companyId er påkrævet.");
  if (![ACTIVE_STATUS, INACTIVE_STATUS].includes(status)) {
    throw new HttpsError("invalid-argument", "status skal være active eller inactive.");
  }

  for (const moduleKey of [...new Set(moduleKeys)]) {
    await setModuleAccess({
      auth: request.auth,
      payload: {
        companyId,
        locationId,
        userId,
        moduleKey,
        status,
        source: ADMIN_SOURCE,
        reason,
        expiresAt
      }
    });
  }

  const effective = await getEffectiveActiveModules(companyId, locationId, userId);
  return { ok: true, changedModules: [...new Set(moduleKeys)], ...effective };
});

exports.adminGetModuleAccess = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Log ind for at se moduladgang.");

  const data = request.data || {};
  const companyId = sanitizeString(data.companyId, 140);
  const locationId = sanitizeString(data.locationId, 140);
  const userId = sanitizeString(data.userId, 140);
  if (!companyId) throw new HttpsError("invalid-argument", "companyId er påkrævet.");

  await assertAdminAccess({
    uid: request.auth.uid,
    email: request.auth.token?.email || "",
    companyId,
    locationId
  });

  const effective = await collectEffectiveSources({ companyId, locationId, userId, includeQuickLists: true });
  const modules = getAssignableModules();
  const accessByModule = modules.map((module) => {
    const docs = effective.accessDocs.filter((item) => item.moduleKey === module.moduleKey);
    const matchingDocs = docs.filter((item) => accessDocApplies(item, { companyId, locationId, userId }));
    const adminOverrideActive = matchingDocs.some((item) => item.status === ACTIVE_STATUS && item.source === ADMIN_SOURCE);
    const activeDoc = matchingDocs.find((item) => item.status === ACTIVE_STATUS && item.source === ADMIN_SOURCE) || null;
    return {
      ...module,
      active: effective.activeModules.includes(module.moduleKey),
      adminOverrideActive,
      sources: effective.moduleSources[module.moduleKey] || [],
      expiresAt: activeDoc?.expiresAt || null,
      reason: activeDoc?.reason || ""
    };
  });

  const [locations, users] = await Promise.all([
    listLocations(companyId),
    listUsers(companyId)
  ]);

  return {
    ok: true,
    companyId,
    locationId,
    userId,
    activeModules: effective.activeModules,
    moduleSources: effective.moduleSources,
    modules: accessByModule,
    locations,
    users
  };
});

module.exports.getEffectiveActiveModules = getEffectiveActiveModules;
module.exports.getAssignableModules = getAssignableModules;
