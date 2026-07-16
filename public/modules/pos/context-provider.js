import { auth, db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function readJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function readSession(key) {
  try {
    return window.sessionStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function readLocal(key) {
  try {
    return window.localStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeSession(key, value) {
  try {
    if (value !== undefined && value !== null && value !== "") {
      window.sessionStorage?.setItem(key, String(value));
    }
  } catch {
    // Best-effort only.
  }
}

function writeLocal(key, value) {
  try {
    if (value !== undefined && value !== null && value !== "") {
      window.localStorage?.setItem(key, String(value));
    }
  } catch {
    // Best-effort only.
  }
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstText(...values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function getUrlContext(search = window.location.search) {
  const params = new URLSearchParams(search || "");
  return {
    uid: params.get("uid") || "",
    companyId: params.get("companyId") || "",
    locationId: params.get("locationId") || "",
    role: params.get("role") || "",
    sourceApp: params.get("sourceApp") || "",
    returnUrl: params.get("returnUrl") || "",
    enabledApps: normalizeList(params.get("enabledApps") || "")
  };
}

function readStoredCompanyProfile() {
  return readJson(readSession("mkp_company_profile"), null) ||
    readJson(readSession("mkp_quick_onboarding_company_profile"), null) ||
    readJson(readLocal("mkp_company_profile"), null) ||
    readJson(readLocal("mkp_quick_onboarding_company_profile"), null) ||
    readJson(readLocal("pos_business_profile"), null) ||
    {};
}

function getStoredPlatformContext() {
  return readJson(readSession("PlatformContext"), null) ||
    readJson(readLocal("PlatformContext"), null) ||
    {};
}

function getWindowProfile() {
  return window.currentUserProfile ||
    window.userProfile ||
    window.PlatformUserProfile ||
    readJson(readSession("mkp_user_profile"), null) ||
    readJson(readLocal("mkp_user_profile"), null) ||
    {};
}

function getStoredIds() {
  return {
    companyId: firstText(
      readSession("mkp_user_companyId"),
      readLocal("mkp_user_companyId"),
      readSession("companyId"),
      readLocal("companyId")
    ),
    locationId: firstText(
      readSession("mkp_selected_locationId"),
      readLocal("mkp_selected_locationId"),
      readSession("selectedLocationId"),
      readLocal("selectedLocationId"),
      readSession("locationId"),
      readLocal("locationId")
    )
  };
}

function getProfileLocationIds(profile = {}) {
  return [
    ...normalizeList(profile.locationIds),
    ...normalizeList(profile.locations?.map?.((location) => location.id || location.locationId) || []),
    profile.primaryLocationId,
    profile.locationId
  ].map(String).map((value) => value.trim()).filter(Boolean);
}

function resolveLocationId(profile = {}, currentLocationId = "") {
  if (currentLocationId) return currentLocationId;
  const locationIds = [...new Set(getProfileLocationIds(profile))];
  return firstText(profile.primaryLocationId, profile.locationId, locationIds[0]);
}

async function readUserProfile(uid = "") {
  if (!uid) return {};
  const profiles = [];
  for (const collectionName of ["users", "live_user_profiles"]) {
    try {
      const snap = await getDoc(doc(db, collectionName, uid));
      if (snap.exists()) {
        profiles.push({ id: snap.id, ...snap.data(), source: collectionName });
      }
    } catch (error) {
      console.warn(`[pos-context] ${collectionName}/${uid} lookup failed`, error);
    }
  }
  return Object.assign({}, ...profiles);
}

async function readCompanyLocation(companyId = "", locationId = "") {
  if (!companyId) return {};
  try {
    const companySnap = await getDoc(doc(db, "companies", companyId));
    const company = companySnap.exists() ? companySnap.data() || {} : {};
    let location = {};
    if (locationId) {
      const locationSnap = await getDoc(doc(db, "companies", companyId, "locations", locationId));
      location = locationSnap.exists() ? locationSnap.data() || {} : {};
    }
    return { ...company, location, source: companySnap.exists() || Object.keys(location).length ? "company" : "" };
  } catch (error) {
    console.warn("[pos-context] company/location lookup failed", error);
    return {};
  }
}

export function normalizePlatformCompanyContext(input = {}, source = "") {
  const company = input.company && typeof input.company === "object" ? input.company : {};
  const location = input.location && typeof input.location === "object" ? input.location : {};
  const activeModules = [
    ...normalizeList(input.activeModules),
    ...normalizeList(input.selectedModules),
    ...normalizeList(input.enabledApps),
    ...normalizeList(input.modules)
  ];

  const context = {
    uid: firstText(input.uid),
    companyId: firstText(input.companyId, input.organizationId, company.companyId, company.id),
    locationId: firstText(
      input.locationId,
      input.primaryLocationId,
      Array.isArray(input.locationIds) ? input.locationIds[0] : "",
      location.locationId,
      location.id
    ),
    companyName: firstText(input.companyName, input.businessName, input.name, company.companyName, company.name),
    cvr: firstText(input.cvr, input.cvrNumber, company.cvr, company.cvrNumber),
    address: firstText(input.address, company.address, location.address, location.street),
    postalCode: firstText(input.postalCode, input.zip, company.postalCode, company.zip, location.postalCode, location.zip),
    city: firstText(input.city, company.city, location.city),
    phone: firstText(input.phone, company.phone, location.phone),
    email: firstText(input.email, input.accountEmail, company.email, location.email),
    industryCode: firstText(input.industryCode, company.industryCode),
    industryText: firstText(input.industryText, input.industry, company.industryText, company.industry),
    activeModules: [...new Set(activeModules.map((moduleKey) => String(moduleKey).toLowerCase()))],
    source: source || input.source || company.source || ""
  };

  if (!context.source) {
    context.source = context.companyId || context.companyName || context.cvr ? "company" : "missing";
  }
  return context;
}

export async function resolvePlatformContext(overrides = {}) {
  const user = overrides.user || auth.currentUser || window.currentUser || null;
  const uid = user?.uid || "";
  const urlContext = getUrlContext();
  const storedIds = getStoredIds();
  const storedContext = getStoredPlatformContext();
  const storedCompany = readStoredCompanyProfile();
  const storedProfile = getWindowProfile();
  const firestoreProfile = await readUserProfile(uid);

  const mergedProfile = {
    ...storedProfile,
    ...firestoreProfile,
    uid: firstText(uid, storedProfile.uid, firestoreProfile.uid)
  };
  const profileCompanyId = firstText(mergedProfile.companyId, mergedProfile.organizationId);
  const companyId = firstText(
    overrides.companyId,
    urlContext.companyId,
    storedContext.companyId,
    storedIds.companyId,
    profileCompanyId,
    storedCompany.companyId,
    storedCompany.organizationId
  );
  const locationId = resolveLocationId(mergedProfile, firstText(
    overrides.locationId,
    urlContext.locationId,
    storedContext.locationId,
    storedIds.locationId,
    storedCompany.locationId,
    storedCompany.primaryLocationId
  ));
  const companyLocation = await readCompanyLocation(companyId, locationId);

  const base = normalizePlatformCompanyContext({
    ...storedCompany,
    ...mergedProfile,
    ...storedContext,
    ...urlContext,
    ...companyLocation,
    ...overrides,
    uid: firstText(overrides.uid, urlContext.uid, mergedProfile.uid, uid),
    companyId,
    locationId
  }, companyLocation.source || storedCompany.source || mergedProfile.source || storedContext.source || "");
  const enabledApps = [
    ...normalizeList(base.activeModules),
    ...normalizeList(mergedProfile.enabledApps),
    ...normalizeList(mergedProfile.modules),
    ...normalizeList(storedContext.enabledApps),
    ...normalizeList(urlContext.enabledApps),
    ...normalizeList(readSession("mkp_enabled_apps")),
    ...normalizeList(overrides.enabledApps),
    "core",
    "pos"
  ];
  const locationOptions = [...new Set(getProfileLocationIds(mergedProfile))];

  const context = {
    ...base,
    uid: firstText(base.uid, uid),
    companyId,
    locationId,
    role: firstText(overrides.role, urlContext.role, storedContext.role, mergedProfile.role),
    sourceApp: firstText(overrides.sourceApp, urlContext.sourceApp, storedContext.sourceApp, "pos"),
    returnUrl: firstText(overrides.returnUrl, urlContext.returnUrl, storedContext.returnUrl),
    enabledApps: [...new Set(enabledApps.map((app) => String(app).toLowerCase()))],
    locationOptions,
    needsLocationSelection: Boolean(companyId && !locationId && locationOptions.length > 1)
  };

  context.activeModules = [...new Set([...normalizeList(context.activeModules), ...context.enabledApps])];
  context.source = context.companyId || context.companyName || context.cvr ? context.source || "company" : "missing";
  window.PlatformContext = context;
  writeSession("PlatformContext", JSON.stringify(context));
  writeLocal("PlatformContext", JSON.stringify(context));
  writeSession("mkp_user_companyId", context.companyId);
  writeSession("mkp_selected_locationId", context.locationId);
  writeSession("mkp_company_profile", JSON.stringify(getBusinessSnapshotFromContext(context)));
  writeLocal("mkp_company_profile", JSON.stringify(getBusinessSnapshotFromContext(context)));
  return context;
}

export function setPlatformContext(nextContext = {}) {
  const merged = {
    ...getStoredPlatformContext(),
    ...(window.PlatformContext || {}),
    ...normalizePlatformCompanyContext(nextContext, nextContext.source),
    ...nextContext
  };
  window.PlatformContext = merged;
  writeSession("PlatformContext", JSON.stringify(merged));
  writeLocal("PlatformContext", JSON.stringify(merged));
  writeSession("mkp_company_profile", JSON.stringify(getBusinessSnapshotFromContext(merged)));
  writeLocal("mkp_company_profile", JSON.stringify(getBusinessSnapshotFromContext(merged)));
  return merged;
}

export function getBusinessSnapshotFromContext(context = {}) {
  const normalized = normalizePlatformCompanyContext(context, context.source);
  return {
    uid: normalized.uid,
    companyId: normalized.companyId,
    locationId: normalized.locationId,
    companyName: normalized.companyName,
    cvr: normalized.cvr,
    address: normalized.address,
    postalCode: normalized.postalCode,
    city: normalized.city,
    phone: normalized.phone,
    email: normalized.email,
    industryCode: normalized.industryCode,
    industryText: normalized.industryText,
    activeModules: normalized.activeModules,
    source: normalized.source
  };
}
