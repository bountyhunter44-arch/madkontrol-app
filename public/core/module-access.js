import {
  collection,
  doc,
  getDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const SOURCE_LABELS = {
  paid_subscription: "Betalt",
  admin_override: "Admin",
  trial: "Trial",
  demo: "Demo",
  internal: "Intern"
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "paid"]);

export function normalizeModuleKey(value) {
  const raw = String(value || "").trim().toLowerCase();
  const compact = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]/g, "");
  const aliases = {
    accounting: "bogforing",
    "bogføring": "bogforing",
    bogfoering: "bogforing",
    "lagerkontrol-pro": "lagerkontrol",
    opskrifter: "menu",
    "opskrifter-menu": "menu",
    kalkulation: "calculation",
    koersel: "koerselskontrol",
    koerekontrol: "koerselskontrol",
    "kørekontrol": "koerselskontrol",
    "kørselskontrol": "koerselskontrol",
    "kørekontrol": "koerselskontrol",
    "kørselskontrol": "koerselskontrol",
    "kørsel": "koerselskontrol",
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
    korebog: "koerselskontrol",
    bogforing: "bogforing",
    bogfoering: "bogforing"
  };
  return aliases[raw] || compactAliases[compact] || raw;
}

export function formatModuleSourceLabel(source) {
  return SOURCE_LABELS[source] || source;
}

export function formatModuleSources(sources = []) {
  return [...new Set(sources)]
    .map(formatModuleSourceLabel)
    .filter(Boolean)
    .join(" + ");
}

function normalizeModuleKeys(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeModuleKey).filter(Boolean))];
}

function addSource(map, moduleKey, source) {
  const key = normalizeModuleKey(moduleKey);
  if (!key || !source) return;
  if (!map[key]) map[key] = new Set();
  map[key].add(source);
}

function addModuleMapSources(map, modules, source) {
  if (!modules || typeof modules !== "object" || Array.isArray(modules)) return;
  Object.entries(modules).forEach(([moduleKey, enabled]) => {
    if (enabled === true) addSource(map, moduleKey, source);
  });
}

function subscriptionIsActive(subscription = {}) {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(String(subscription?.status || "").trim().toLowerCase());
}

function addSubscriptionSources(map, data = {}) {
  const subscription = data?.subscription && typeof data.subscription === "object" ? data.subscription : {};
  if (subscriptionIsActive(subscription)) {
    normalizeModuleKeys(subscription.selectedModules).forEach((moduleKey) => {
      addSource(map, moduleKey, "paid_subscription");
    });
  }

  const status = String(data?.subscriptionStatus || data?.status || "").trim().toLowerCase();
  if (status === "trial") {
    normalizeModuleKeys(data.activeModules).forEach((moduleKey) => addSource(map, moduleKey, "trial"));
  } else if (status === "demo" || data?.demoMode === true || data?.isDemo === true) {
    normalizeModuleKeys(data.activeModules).forEach((moduleKey) => addSource(map, moduleKey, "demo"));
  }
}

function parseDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function accessApplies(data = {}, { companyId, locationId, userId }) {
  if (data.assignedToCompanyId && data.assignedToCompanyId !== companyId) return false;
  if (data.assignedToLocationId && data.assignedToLocationId !== locationId) return false;
  if (data.assignedToUserId && data.assignedToUserId !== userId) return false;
  const expiresAt = parseDate(data.expiresAt);
  if (expiresAt && expiresAt.getTime() <= Date.now()) return false;
  return true;
}

export async function getEffectiveActiveModules(db, {
  companyId,
  locationId = "",
  userId = ""
} = {}) {
  const cleanCompanyId = String(companyId || "").trim();
  const cleanLocationId = String(locationId || "").trim();
  const cleanUserId = String(userId || "").trim();
  const sourceMap = {};

  if (!cleanCompanyId) {
    return { activeModules: [], moduleSources: {} };
  }

  let companyData = {};
  try {
    const companySnap = await getDoc(doc(db, "companies", cleanCompanyId));
    companyData = companySnap.exists() ? (companySnap.data() || {}) : {};
  } catch (error) {
    console.warn("[module access] Kunne ikke læse virksomhed:", error);
  }

  let locationData = {};
  if (cleanLocationId) {
    try {
      const locationSnap = await getDoc(doc(db, "companies", cleanCompanyId, "locations", cleanLocationId));
      locationData = locationSnap.exists() ? (locationSnap.data() || {}) : {};
    } catch (error) {
      console.warn("[module access] Kunne ikke læse lokation:", error);
    }
  }

  addSubscriptionSources(sourceMap, companyData);
  addSubscriptionSources(sourceMap, locationData);

  try {
    const currentSubSnap = await getDoc(doc(db, "companies", cleanCompanyId, "subscriptions", "current"));
    if (currentSubSnap.exists() && subscriptionIsActive(currentSubSnap.data())) {
      normalizeModuleKeys(currentSubSnap.data().selectedModules).forEach((moduleKey) => {
        addSource(sourceMap, moduleKey, "paid_subscription");
      });
    }
  } catch (error) {
    console.warn("[module access] Kunne ikke læse abonnement:", error);
  }

  const fallbackSource = companyData.demoMode || companyData.isDemo
    ? "demo"
    : String(companyData.subscriptionStatus || companyData.status || "").trim().toLowerCase() === "trial"
      ? "trial"
      : subscriptionIsActive(companyData.subscription)
        ? "paid_subscription"
        : "internal";

  normalizeModuleKeys(companyData.activeModules).forEach((moduleKey) => addSource(sourceMap, moduleKey, fallbackSource));
  normalizeModuleKeys(locationData.activeModules).forEach((moduleKey) => addSource(sourceMap, moduleKey, fallbackSource));
  addModuleMapSources(sourceMap, companyData.modules, fallbackSource);
  addModuleMapSources(sourceMap, locationData.modules, fallbackSource);

  try {
    const accessSnap = await getDocs(collection(db, "companies", cleanCompanyId, "module_access"));
    accessSnap.forEach((item) => {
      const data = item.data() || {};
      const moduleKey = normalizeModuleKey(data.moduleKey || item.id.split("__")[0]);
      if (data.status === "active" && accessApplies(data, {
        companyId: cleanCompanyId,
        locationId: cleanLocationId,
        userId: cleanUserId
      })) {
        addSource(sourceMap, moduleKey, data.source || "admin_override");
      }
    });
  } catch (error) {
    console.warn("[module access] Kunne ikke læse admin overrides:", error);
  }

  const moduleSources = Object.fromEntries(
    Object.entries(sourceMap).map(([moduleKey, sources]) => [moduleKey, [...sources]])
  );

  return {
    activeModules: Object.keys(moduleSources).sort(),
    moduleSources
  };
}
