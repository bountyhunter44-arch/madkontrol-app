export const MODULE_ID = "lagerkontrol";

const READ_ONLY_ERROR = "Lagerkontrol staging read-only mangler platform context.";

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
}

function normalizeEntitlements(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).map(([key, entitlement]) => [
    String(key || "").trim().toLowerCase(),
    entitlement
  ]));
}

function readGlobalPlatformContext() {
  if (typeof globalThis === "undefined") return null;
  const candidates = [
    globalThis.MadkontrollenPlatformContext,
    globalThis.__MADKONTROLLEN_PLATFORM_CONTEXT__,
    globalThis.madkontrollenPlatformContext,
    globalThis.platformContext
  ];
  return candidates.find((candidate) => candidate && typeof candidate === "object") || null;
}

export function normalizePlatformContext(rawContext = {}) {
  const activeModules = normalizeList(rawContext.activeModules || rawContext.enabledApps || rawContext.modules);
  const moduleAccess = normalizeEntitlements(rawContext.moduleAccess);
  const entitlements = normalizeEntitlements(rawContext.entitlements);

  return {
    uid: rawContext.uid || rawContext.userId || rawContext.user?.uid || null,
    companyId: rawContext.companyId || rawContext.company?.id || null,
    locationId: rawContext.locationId || rawContext.location?.id || null,
    role: rawContext.role || rawContext.userRole || null,
    activeModules,
    entitlements,
    moduleAccess,
    subscriptionStatus: rawContext.subscriptionStatus || "none",
    source: rawContext.source || "staging-readonly",
    readOnly: true,
    staging: true
  };
}

export function assertContextReady(context) {
  if (!context || typeof context !== "object") {
    throw new Error(READ_ONLY_ERROR);
  }
  if (!context.companyId) {
    throw new Error("Lagerkontrol staging read-only mangler companyId.");
  }
  return context;
}

export async function getCurrentContext() {
  const rawContext = readGlobalPlatformContext();
  if (!rawContext) {
    return {
      ok: false,
      error: READ_ONLY_ERROR,
      moduleId: MODULE_ID,
      readOnly: true,
      staging: true
    };
  }
  return {
    ok: true,
    moduleId: MODULE_ID,
    context: normalizePlatformContext(rawContext),
    readOnly: true,
    staging: true
  };
}

export async function requireModuleAccess(moduleId = MODULE_ID) {
  const response = await getCurrentContext();
  if (!response.ok) {
    throw new Error(response.error);
  }

  const context = assertContextReady(response.context);
  const key = String(moduleId || MODULE_ID).trim().toLowerCase();
  const entitlement = context.entitlements[key];
  const access = context.moduleAccess[key];
  const active = context.activeModules.includes(key);
  const entitlementActive = entitlement === true || entitlement?.active === true || entitlement?.status === "active";
  const accessActive = access === true || access?.active === true || access?.status === "active";

  if (!active && !entitlementActive && !accessActive) {
    throw new Error("Lagerkontrol er ikke aktiv for denne virksomhed eller lokation.");
  }

  return {
    ok: true,
    moduleId: key,
    companyId: context.companyId,
    locationId: context.locationId,
    role: context.role,
    readOnly: true,
    staging: true
  };
}

export async function getIdToken() {
  const rawContext = readGlobalPlatformContext();
  const tokenProvider = rawContext?.getIdToken || rawContext?.auth?.currentUser?.getIdToken;
  if (typeof tokenProvider !== "function") {
    throw new Error("Login-token er ikke tilgængelig i Lagerkontrol staging read-only.");
  }
  return tokenProvider.call(rawContext?.auth?.currentUser || rawContext);
}
