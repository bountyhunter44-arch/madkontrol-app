"use strict";

const { getAppByKey, getAppRegistry } = require("./app-registry");

function normalizeEntitlement(value) {
  const key = String(value || "").trim().toLowerCase();
  const compact = key
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]/g, "");
  const aliases = {
    "madkontrollen-core": "core",
    kalkulation: "calculation",
    akademi: "academy",
    sensorer: "sensors",
    vedligehold: "maintenance",
    bilag: "receipts",
    moms: "vat",
    indkob: "purchasing",
    leverandorer: "suppliers",
    raavarer: "ingredients",
    "råvarer": "ingredients",
    koersel: "koerselskontrol",
    kørsel: "koerselskontrol",
    koerekontrol: "koerselskontrol",
    kørekontrol: "koerselskontrol",
    kørselskontrol: "koerselskontrol",
    "kørsel kontrol": "koerselskontrol",
    "kørsels kontrol": "koerselskontrol",
    driving: "koerselskontrol",
    drivingcontrol: "koerselskontrol",
    koerebog: "koerselskontrol"
  };
  const compactAliases = {
    korsel: "koerselskontrol",
    koersel: "koerselskontrol",
    korselkontrol: "koerselskontrol",
    koerselkontrol: "koerselskontrol",
    korekontrol: "koerselskontrol",
    koerekontrol: "koerselskontrol",
    korselskontrol: "koerselskontrol",
    koerselskontrol: "koerselskontrol",
    drivingcontrol: "koerselskontrol",
    koerebog: "koerselskontrol",
    korebog: "koerselskontrol"
  };
  return aliases[key] || compactAliases[compact] || key;
}

function getEnabledAppKeys(context = {}) {
  const enabled = Array.isArray(context.enabledApps) ? context.enabledApps : [];
  const keys = enabled.map(normalizeEntitlement).filter(Boolean);
  if (!keys.includes("core")) keys.push("core");
  return [...new Set(keys)];
}

function getAppAccess(appKey, context = {}) {
  const app = typeof appKey === "object" ? appKey : getAppByKey(appKey);
  if (!app) return { ok: false, reason: "app_not_found", app: null };
  if (app.status !== "active") return { ok: false, reason: "app_not_active", app };
  if (Array.isArray(app.requiredRoles) && app.requiredRoles.length && !app.requiredRoles.includes(String(context.role || ""))) {
    return { ok: false, reason: "role_denied", app };
  }
  const entitlement = normalizeEntitlement(app.requiredEntitlement || app.appKey);
  if (entitlement && !getEnabledAppKeys(context).includes(entitlement)) {
    return { ok: false, reason: "missing_entitlement", app };
  }
  return { ok: true, reason: "ok", app };
}

function getEnabledApps(context = {}) {
  return getAppRegistry().filter((app) => getAppAccess(app, context).ok);
}

module.exports = {
  normalizeEntitlement,
  getEnabledAppKeys,
  getAppAccess,
  getEnabledApps
};
