import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getPlatformFirebaseClient, waitForPlatformAuth } from "./firebase-client.js";
import { isPlatformAdmin, buildPlatformContext } from "../core/platform-admin.js";

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
    // Session storage is best-effort only.
  }
}

function writeLocal(key, value) {
  try {
    if (value !== undefined && value !== null && value !== "") {
      window.localStorage?.setItem(key, String(value));
    }
  } catch {
    // Local storage is a fallback only.
  }
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getWindowProfile() {
  return window.currentUserProfile ||
    window.userProfile ||
    window.PlatformUserProfile ||
    readJson(readSession("mkp_user_profile"), null) ||
    readJson(readLocal("mkp_user_profile"), null) ||
    {};
}

function firstText(...values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function readStoredCompanyProfile() {
  return readJson(readSession("mkp_company_profile"), null) ||
    readJson(readSession("mkp_quick_onboarding_company_profile"), null) ||
    readJson(readLocal("mkp_company_profile"), null) ||
    readJson(readLocal("mkp_quick_onboarding_company_profile"), null) ||
    {};
}

export function normalizePlatformCompanyContext(input = {}, source = "") {
  const company = input.company && typeof input.company === "object" ? input.company : {};
  const profile = input.profile && typeof input.profile === "object" ? input.profile : {};
  const setup = input.setup && typeof input.setup === "object" ? input.setup : {};
  const location = input.location && typeof input.location === "object" ? input.location : {};
  const activeModules = [
    ...normalizeList(input.activeModules),
    ...normalizeList(input.selectedModules),
    ...normalizeList(input.enabledApps),
    ...normalizeList(input.modules),
    ...normalizeList(profile.activeModules),
    ...normalizeList(profile.selectedModules),
    ...normalizeList(profile.enabledApps),
    ...normalizeList(profile.modules)
  ];

  const context = {
    uid: firstText(input.uid, profile.uid),
    companyId: firstText(input.companyId, input.organizationId, profile.companyId, profile.organizationId, company.companyId, company.id),
    locationId: firstText(
      input.locationId,
      input.primaryLocationId,
      profile.locationId,
      profile.primaryLocationId,
      Array.isArray(input.locationIds) ? input.locationIds[0] : "",
      Array.isArray(profile.locationIds) ? profile.locationIds[0] : "",
      location.locationId,
      location.id
    ),
    companyName: firstText(input.companyName, input.businessName, input.name, profile.companyName, profile.businessName, company.companyName, company.name),
    cvr: firstText(input.cvr, input.cvrNumber, profile.cvr, profile.cvrNumber, company.cvr, company.cvrNumber),
    address: firstText(input.address, profile.address, company.address, location.address, location.street),
    postalCode: firstText(input.postalCode, input.zip, profile.postalCode, profile.zip, company.postalCode, company.zip, location.postalCode, location.zip),
    city: firstText(input.city, profile.city, company.city, location.city),
    phone: firstText(input.phone, profile.phone, company.phone, location.phone),
    email: firstText(input.email, input.accountEmail, profile.email, profile.accountEmail, company.email, location.email),
    industryCode: firstText(input.industryCode, profile.industryCode, company.industryCode, setup.industryCode),
    industryText: firstText(input.industryText, input.industry, profile.industryText, profile.industry, company.industryText, company.industry, setup.industryText, setup.industry),
    activeModules: [...new Set(activeModules.map((moduleKey) => String(moduleKey).toLowerCase()))],
    source: source || input.source || profile.source || company.source || ""
  };

  if (!context.source) {
    context.source = context.companyId || context.companyName || context.cvr ? "company" : "missing";
  }
  return context;
}

export function getUrlContext(search = window.location.search) {
  const params = new URLSearchParams(search || "");
  return {
    uid: params.get("uid") || "",
    companyId: params.get("companyId") || "",
    locationId: params.get("locationId") || "",
    role: params.get("role") || "",
    sourceApp: params.get("sourceApp") || "",
    targetEntityType: params.get("targetEntityType") || "",
    targetEntityId: params.get("targetEntityId") || "",
    returnUrl: params.get("returnUrl") || "",
    enabledApps: normalizeList(params.get("enabledApps") || "")
  };
}

export function getStoredPlatformContext() {
  return readJson(readSession("PlatformContext"), null) ||
    readJson(readLocal("PlatformContext"), null) ||
    {};
}

export async function resolvePlatformContext(overrides = {}) {
  const profile = await getPlatformProfile();

  // Platform/super-admins get a platform context — no companyId/locationId required.
  if (isPlatformAdmin(null, profile)) {
    const platformCtx = {
      ...buildPlatformContext(null, profile),
      enabledApps: ["core", "crm"],
      activeModules: ["core", "crm"],
      source: "platform"
    };
    window.PlatformContext = platformCtx;
    writeSession("PlatformContext", JSON.stringify(platformCtx));
    writeLocal("PlatformContext", JSON.stringify(platformCtx));
    return platformCtx;
  }

  const urlContext = getUrlContext();
  const storedContext = getStoredPlatformContext();
  const storedCompany = readStoredCompanyProfile();
  const authUid = window.auth?.currentUser?.uid || window.firebase?.auth?.currentUser?.uid || "";
  const baseCompany = normalizePlatformCompanyContext({
    ...storedCompany,
    ...profile,
    ...storedContext,
    ...urlContext,
    ...overrides
  }, storedCompany.source || profile.source || storedContext.source || "");
  const enabledApps = [
    ...normalizeList(baseCompany.activeModules),
    ...normalizeList(profile.enabledApps),
    ...normalizeList(profile.modules),
    ...normalizeList(profile.addons),
    ...normalizeList(storedContext.enabledApps),
    ...normalizeList(urlContext.enabledApps),
    ...normalizeList(readSession("mkp_enabled_apps")),
    ...normalizeList(overrides.enabledApps)
  ];

  const context = {
    ...baseCompany,
    uid: overrides.uid || urlContext.uid || storedContext.uid || profile.uid || baseCompany.uid || authUid || "",
    companyId: overrides.companyId || urlContext.companyId || storedContext.companyId || profile.companyId || profile.organizationId || baseCompany.companyId || readSession("mkp_user_companyId") || "",
    locationId: overrides.locationId || urlContext.locationId || storedContext.locationId || profile.primaryLocationId || profile.locationId || baseCompany.locationId || readSession("mkp_selected_locationId") || "",
    role: overrides.role || urlContext.role || storedContext.role || profile.role || "",
    enabledApps: [...new Set(enabledApps.map((app) => String(app).toLowerCase()))],
    sourceApp: overrides.sourceApp || urlContext.sourceApp || storedContext.sourceApp || "",
    targetEntityType: overrides.targetEntityType || urlContext.targetEntityType || storedContext.targetEntityType || "",
    targetEntityId: overrides.targetEntityId || urlContext.targetEntityId || storedContext.targetEntityId || "",
    returnUrl: overrides.returnUrl || urlContext.returnUrl || storedContext.returnUrl || ""
  };

  const firestoreCompany = await getCompanyProfileFromFirestore(context.companyId, context.locationId);
  Object.assign(context, normalizePlatformCompanyContext({
    ...context,
    ...firestoreCompany,
    uid: context.uid,
    activeModules: [...context.enabledApps, ...normalizeList(firestoreCompany.activeModules)]
  }, firestoreCompany.source || context.source));

  if (!context.enabledApps.includes("core")) context.enabledApps.push("core");
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

async function getCompanyProfileFromFirestore(companyId, locationId) {
  if (!companyId) return {};
  try {
    const { db } = await getPlatformFirebaseClient();
    const companySnap = await getDoc(doc(db, "companies", companyId));
    const company = companySnap.exists() ? companySnap.data() || {} : {};
    let location = {};
    if (locationId) {
      const locationSnap = await getDoc(doc(db, "companies", companyId, "locations", locationId));
      location = locationSnap.exists() ? locationSnap.data() || {} : {};
    }
    return { ...company, location, source: companySnap.exists() || Object.keys(location).length ? "company" : "" };
  } catch (error) {
    console.warn("[platform-context] company profile fallback failed", error);
    return {};
  }
}

async function getPlatformProfile() {
  const profile = getWindowProfile();
  if (profile.companyId || profile.organizationId || profile.primaryLocationId || profile.locationId || profile.role) {
    return profile;
  }

  try {
    const user = await waitForPlatformAuth(3500);
    if (!user) return profile;
    const { db } = await getPlatformFirebaseClient();
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return { ...profile, uid: user.uid };
    const data = snap.data() || {};
    const locationId = data.primaryLocationId ||
      data.locationId ||
      (Array.isArray(data.locationIds) ? data.locationIds[0] : "") ||
      "";
    const resolved = {
      ...profile,
      ...data,
      uid: user.uid,
      companyId: data.companyId || data.organizationId || profile.companyId || "",
      locationId,
      primaryLocationId: locationId
    };
    window.PlatformUserProfile = resolved;
    return resolved;
  } catch (error) {
    console.warn("[platform-context] auth profile fallback failed", error);
    return profile;
  }
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
