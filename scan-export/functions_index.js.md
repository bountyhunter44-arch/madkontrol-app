# FILE: functions/index.js

```javascript
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const { defineJsonSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const { generateComprehensiveHaccp, generateTaskTemplatesFromKcps } = require("./generateComprehensiveHaccp");
const { generateScenarioBasedHaccp } = require("./scenarioBasedHaccp");
const processInstances = require("./processInstances");
const { guardDangerousOperation } = require("./security/environmentGuard");
const demoMode = require("./admin/demoMode");
const softArchive = require("./admin/softArchive");
const Stripe = require("stripe");

admin.initializeApp();

const db = admin.firestore();
const { FieldValue } = admin.firestore;
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const FUNCTIONS_CONFIG = defineJsonSecret("FUNCTIONS_CONFIG_EXPORT");

function getStripeClient() {
  const config = FUNCTIONS_CONFIG.value() || {};
  const secretKey = config?.stripe?.secret_key || process.env.STRIPE_SECRET_KEY || "";

  if (!secretKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Stripe secret key mangler. Sæt STRIPE_SECRET_KEY miljøvariabel eller FUNCTIONS_CONFIG_EXPORT secret."
    );
  }

  return new Stripe(secretKey, { apiVersion: "2024-06-20" });
}

const ADDON_CATALOG = {
  egenkontrol: { name: "Egenkontrol", amount: 14900 },
  kalkulation: { name: "Kalkulation", amount: 24900 },
  seo: { name: "SEO & Hjemmeside", amount: 34900 },
  accounting: { name: "Accounting", amount: 69900 },
  pos: { name: "POS", amount: 59900 },
  "bon-ai": { name: "Bon-AI", amount: 39900 },
  connector: { name: "Connector Support", amount: 29900 }
};

function toAsciiSlug(value, maxLen = 120) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
}

function toLegacyId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("onboarding_")) {
    return raw.replace(/^onboarding_/, "");
  }
  return raw;
}

function sanitizeRelativePath(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.includes("..") || raw.includes("\\")) return fallback;
  return raw;
}

const CHECKOUT_FALLBACK_ORIGIN = "https://madkontrollen.dk";

function isAllowedCheckoutHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  if (!host) return false;
  if (host === "madkontrollen.dk") return true;
  if (host === "www.madkontrollen.dk") return true;
  if (host === "madkontrollen.web.app") return true;
  if (host === "localhost") return true;
  if (host === "127.0.0.1") return true;
  return host.endsWith(".madkontrollen.dk");
}

function normalizeCheckoutOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return CHECKOUT_FALLBACK_ORIGIN;

  try {
    const parsed = new URL(raw);
    const host = String(parsed.hostname || "").toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1";

    if (host === "madkontrollen.dk" || host === "www.madkontrollen.dk") {
      return "https://madkontrollen.dk";
    }

    if (!isAllowedCheckoutHost(host)) {
      return CHECKOUT_FALLBACK_ORIGIN;
    }

    if (isLocal) {
      const port = parsed.port ? `:${parsed.port}` : "";
      return `http://${host}${port}`;
    }

    return `https://${host}`;
  } catch (_error) {
    return CHECKOUT_FALLBACK_ORIGIN;
  }
}

function parsePageCount(value, fallback = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  if (rounded < 1) return 1;
  if (rounded > 300) return 300;
  return rounded;
}

function buildSeoLandingPages(config, count) {
  const businessName = sanitizeString(config?.businessName || "Restaurant", 140) || "Restaurant";
  const cuisineType = sanitizeString(config?.cuisineType || "Restaurant", 80) || "Restaurant";
  const city = sanitizeString(config?.city || "Kobenhavn", 80) || "Kobenhavn";
  const keyword = sanitizeString(config?.keyword || `bedste ${String(cuisineType).toLowerCase()} i ${city}`, 120);
  const subdomain = sanitizeString(config?.subdomain || toAsciiSlug(businessName), 120);

  const seeds = [
    keyword,
    `${cuisineType} i ${city}`,
    `Takeaway ${city}`,
    `Restaurant ${city}`,
    `Bedste ${String(cuisineType).toLowerCase()} i ${city}`,
    `Billig ${String(cuisineType).toLowerCase()} i ${city}`,
    `Familie restaurant i ${city}`,
    `Online bestilling ${city}`,
    `${cuisineType} menu i ${city}`,
    `${subdomain}.madkontrollen.dk`
  ];

  const pages = [];
  for (let i = 0; i < count; i += 1) {
    const seed = sanitizeString(seeds[i % seeds.length], 140) || `Landing side ${i + 1}`;
    const variant = Math.floor(i / seeds.length) + 1;
    const pageTitleSeed = `${businessName} - ${seed}${variant > 1 ? ` #${variant}` : ""}`;
    const slugBase = toAsciiSlug(`${seed}${variant > 1 ? `-${variant}` : ""}`, 100) || `landing-side-${i + 1}`;
    const title = sanitizeString(`${businessName} | ${seed}`, 220);
    const metaDescription = sanitizeString(
      `${businessName} i ${city}. ${seed}. Book bord eller bestil online via ${subdomain}.madkontrollen.dk.`,
      320
    );

    pages.push({
      sourceTitle: pageTitleSeed,
      slug: slugBase,
      keyword: seed,
      title,
      metaDescription,
      h1: sanitizeString(`${businessName} - ${seed}`, 220),
      h2: sanitizeString(`Hvorfor vaelge ${businessName} i ${city}?`, 220),
      h3: sanitizeString(`Bestil ${String(cuisineType).toLowerCase()} online i ${city}`, 220),
      canonicalPath: `/${slugBase}`
    });
  }

  return pages;
}

async function upsertWebsiteAndSeoPages({ companyId, locationId, config, activatedByUid }) {
  const subdomain = sanitizeString(config?.subdomain || "", 120);
  const businessName = sanitizeString(config?.businessName || "", 140);
  const description = sanitizeString(config?.description || "", 800);
  const selectedTemplate = sanitizeString(config?.selectedTemplate || "classic", 60) || "classic";
  const pageCount = parsePageCount(config?.pageCount, 50);
  const logoDataUrl = sanitizeString(config?.logoDataUrl || "", 500000);

  if (!subdomain) {
    throw new functions.https.HttpsError("invalid-argument", "Subdomaene mangler i generator-konfigurationen.");
  }

  const websiteId = toDocSafeId(`${companyId}__${locationId}__${subdomain}`);
  const websiteRef = db.collection("websites").doc(websiteId);

  await websiteRef.set({
    organizationId: companyId,
    companyId,
    locationId,
    subdomain,
    template: selectedTemplate,
    brandMode: "madkontrollen_default",
    logoUrl: logoDataUrl || null,
    heroTitle: businessName || subdomain,
    heroText: description || "Autogenereret website fra SEO-generator.",
    status: "published",
    seoPreviewEnabled: true,
    seoModuleActive: true,
    customDomain: null,
    updatedAt: FieldValue.serverTimestamp(),
    activatedBy: activatedByUid
  }, { merge: true });

  const pages = buildSeoLandingPages(config, pageCount);
  const batch = db.batch();

  pages.forEach((page, index) => {
    const pageId = toDocSafeId(`${websiteId}__${page.slug}`);
    const pageRef = db.collection("seo_pages").doc(pageId);
    batch.set(pageRef, {
      organizationId: companyId,
      companyId,
      locationId,
      websiteId,
      subdomain,
      slug: page.slug,
      url: `https://${subdomain}.madkontrollen.dk/${page.slug}`,
      keyword: page.keyword,
      title: page.title,
      metaDescription: page.metaDescription,
      h1: page.h1,
      h2: page.h2,
      h3: page.h3,
      canonicalPath: page.canonicalPath,
      sourceTitle: page.sourceTitle,
      ordering: index + 1,
      status: "published",
      generatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      generatedBy: activatedByUid
    }, { merge: true });
  });

  await batch.commit();

  return {
    websiteId,
    generatedPages: pages.length,
    subdomain
  };
}

function sanitizeAddonKeys(raw) {
  if (!Array.isArray(raw)) return [];

  const keys = raw
    .map((item) => String(item || "").trim())
    .filter((key) => Object.prototype.hasOwnProperty.call(ADDON_CATALOG, key));

  return [...new Set(keys)];
}

//
// 🔹 SIMPLE API (temporarily commented out due to 1st Gen to 2nd Gen upgrade conflict)
//
// exports.api = functions.https.onRequest((req, res) => {
//   if (req.path === "/hello") {
//     return res.json({ message: "Hello from Firebase API!" });
//   }

//   if (req.path === "/lexivoice/customer-context") {
//     if (req.method !== "GET") {
//       return res.status(405).json({
//         ok: false,
//         error: "method-not-allowed",
//         message: "Brug GET til dette endpoint."
//       });
//     }

//     const requiredApiKey = String(process.env.LEXIVOICE_API_KEY || "").trim();
//     if (requiredApiKey) {
//       const providedApiKey = String(req.get("x-api-key") || "").trim();
//       if (!providedApiKey || providedApiKey !== requiredApiKey) {
//         return res.status(401).json({
//           ok: false,
//           error: "unauthorized",
//           message: "Ugyldig API noegle."
//         });
//       }
//     }

//     const companyId = sanitizeString(req.query.companyId || "", 120);
//     const locationId = sanitizeString(req.query.locationId || "", 120);

//     if (!companyId || !locationId) {
//       return res.status(400).json({
//         ok: false,
//         error: "invalid-argument",
//         message: "companyId og locationId er paakraevet."
//       });
//     }

//     return getLexiCustomerStatusPayload({ companyId, locationId })
//       .then((statusPayload) => {
//         return res.json({
//           ok: true,
//           ...statusPayload
//         });
//       })
//       .catch((error) => {
//         console.error("Fejl i /lexivoice/customer-context:", error);
//         return res.status(500).json({
//           ok: false,
//           error: "internal",
//           message: "Kunne ikke hente kundestatus."
//         });
//       });
//   }

//   return res.json({ status: "API is running" });
// });

//
// 🔹 HJÆLPEFUNKTIONER
//
function getDateKey() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(now);
}

function addDays(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function getWeekdayFromDateKey(dateKey) {
  const [y, m, d] = String(dateKey || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function normalizeDateKey(value) {
  if (!value) return null;
  const str = String(value).trim();
  const match = str.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function sanitizeString(value, maxLen = 500) {
  return String(value || "").trim().slice(0, maxLen);
}

function parseFrequencyConfig(template, prefix = "frequency") {
  const typeKey = `${prefix}Type`;
  const daysKey = `${prefix}Days`;

  const explicitType = sanitizeString(template?.[typeKey], 60).toLowerCase();
  const explicitDays = Number(template?.[daysKey] || 0);
  const legacy = sanitizeString(template?.[prefix], 80).toLowerCase();

  let type = explicitType;
  let days = Number.isFinite(explicitDays) && explicitDays > 0 ? Math.floor(explicitDays) : 1;

  if (!type) {
    if (!legacy || legacy === "daily" || legacy === "daglig") {
      type = "daily";
    } else if (legacy === "weekly" || legacy === "ugentlig") {
      type = "interval_days";
      days = 7;
    } else if (legacy === "monthly" || legacy === "maanedlig" || legacy === "månedlig") {
      type = "interval_days";
      days = 30;
    } else if (legacy === "weekdays") {
      type = "weekdays";
    } else if (legacy === "weekends") {
      type = "weekends";
    } else {
      const match = legacy.match(/(\d+)/);
      if (match) {
        type = "interval_days";
        days = Math.max(1, Number(match[1]));
      } else {
        type = "daily";
      }
    }
  }

  return {
    type: type || "daily",
    days: Math.max(1, days)
  };
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeBoolean(value) {
  return value === true;
}

function sanitizeStringList(value, maxItems = 50, maxLen = 140) {
  return toArray(value)
    .map((item) => sanitizeString(item, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeOnboardingProfile(profile = {}) {
  return {
    companyName: sanitizeString(profile.companyName, 140),
    cvr: sanitizeString(profile.cvr, 30),
    address: sanitizeString(profile.address, 180),
    city: sanitizeString(profile.city, 80),
    zip: sanitizeString(profile.zip, 20),
    companyType: sanitizeString(profile.companyType, 80),
    ownerName: sanitizeString(profile.ownerName || profile.contactName, 120),
    accountEmail: sanitizeString(profile.accountEmail, 160),
    accountPassword: sanitizeString(profile.accountPassword, 200),
    registrationDate: sanitizeString(profile.registrationDate, 40),
    cleaningNotes: sanitizeString(profile.cleaningNotes, 2000),
    supplierInput: sanitizeString(profile.supplierInput, 2000),
    // Step 1: Modtagelse
    receivesChilledGoods: sanitizeBoolean(profile.receivesChilledGoods),
    receivesChilledGoodsDetails: sanitizeString(profile.receivesChilledGoodsDetails, 2000),
    receivesFrozenGoods: sanitizeBoolean(profile.receivesFrozenGoods),
    receivesFrozenGoodsDetails: sanitizeString(profile.receivesFrozenGoodsDetails, 2000),
    receivesFrozenGoodsCritical: sanitizeBoolean(profile.receivesFrozenGoodsCritical),
    receivesRoomTempGoods: sanitizeBoolean(profile.receivesRoomTempGoods),
    receivesRoomTempGoodsDetails: sanitizeString(profile.receivesRoomTempGoodsDetails, 2000),
    // Step 2: Opbevaring
    storesChilledGoods: sanitizeBoolean(profile.storesChilledGoods),
    storesChilledGoodsDetails: sanitizeString(profile.storesChilledGoodsDetails, 2000),
    storesChilledGoodsCritical: sanitizeBoolean(profile.storesChilledGoodsCritical),
    storesFrozenGoods: sanitizeBoolean(profile.storesFrozenGoods),
    storesFrozenGoodsDetails: sanitizeString(profile.storesFrozenGoodsDetails, 2000),
    storesFrozenGoodsCritical: sanitizeBoolean(profile.storesFrozenGoodsCritical),
    storesRoomTempGoods: sanitizeBoolean(profile.storesRoomTempGoods),
    storesRoomTempGoodsDetails: sanitizeString(profile.storesRoomTempGoodsDetails, 2000),
    // Step 3: Tilberedning
    preparesHotFood: sanitizeBoolean(profile.preparesHotFood),
    preparesHotFoodDetails: sanitizeString(profile.preparesHotFoodDetails, 2000),
    preparesHotFoodCritical: sanitizeBoolean(profile.preparesHotFoodCritical),
    preparesColdFood: sanitizeBoolean(profile.preparesColdFood),
    preparesColdFoodDetails: sanitizeString(profile.preparesColdFoodDetails, 2000),
    preparesColdFoodCritical: sanitizeBoolean(profile.preparesColdFoodCritical),
    // Step 4: Varmholdelse/Nedkøling
    holdsHotFood: sanitizeBoolean(profile.holdsHotFood),
    holdsHotFoodDetails: sanitizeString(profile.holdsHotFoodDetails, 2000),
    holdsHotFoodCritical: sanitizeBoolean(profile.holdsHotFoodCritical),
    coolsHotFood: sanitizeBoolean(profile.coolsHotFood),
    coolsHotFoodDetails: sanitizeString(profile.coolsHotFoodDetails, 2000),
    coolsHotFoodCritical: sanitizeBoolean(profile.coolsHotFoodCritical),
    // Step 5: Håndtering/Allergener
    handlesDifferentFoods: sanitizeBoolean(profile.handlesDifferentFoods),
    handlesDifferentFoodsDetails: sanitizeString(profile.handlesDifferentFoodsDetails, 2000),
    handlesAllergens: sanitizeBoolean(profile.handlesAllergens),
    handlesAllergensDetails: sanitizeString(profile.handlesAllergensDetails, 2000),
    handlesAllergensCritical: sanitizeBoolean(profile.handlesAllergensCritical),
    // Step 6: Salg og servering
    sellsPackagedChilled: sanitizeBoolean(profile.sellsPackagedChilled),
    sellsPackagedFrozen: sanitizeBoolean(profile.sellsPackagedFrozen),
    sellsPackagedRoomTemp: sanitizeBoolean(profile.sellsPackagedRoomTemp),
    sellsUnpackagedChilled: sanitizeBoolean(profile.sellsUnpackagedChilled),
    sellsUnpackagedRoomTemp: sanitizeBoolean(profile.sellsUnpackagedRoomTemp),
    sellsFoodWithAllergens: sanitizeBoolean(profile.sellsFoodWithAllergens),
    sellsFoodWithAllergensDetails: sanitizeString(profile.sellsFoodWithAllergensDetails, 2000),
    packagesOwnFood: sanitizeBoolean(profile.packagesOwnFood),
    packagesOwnFoodDetails: sanitizeString(profile.packagesOwnFoodDetails, 2000),
    // Step 7: Transport
    transportsChilledGoods: sanitizeBoolean(profile.transportsChilledGoods),
    transportsFrozenGoods: sanitizeBoolean(profile.transportsFrozenGoods),
    transportsRoomTempGoods: sanitizeBoolean(profile.transportsRoomTempGoods),
    transportsHotTakeaway: sanitizeBoolean(profile.transportsHotTakeaway),
    transportsHotTakeawayDetails: sanitizeString(profile.transportsHotTakeawayDetails, 2000),
    // Legacy fields
    servesHotFood: sanitizeBoolean(profile.servesHotFood),
    servesColdFood: sanitizeBoolean(profile.servesColdFood),
    sellsRawFish: sanitizeBoolean(profile.sellsRawFish),
    makesDesserts: sanitizeBoolean(profile.makesDesserts),
    packsTakeaway: sanitizeBoolean(profile.packsTakeaway),
    hasHotHolding: sanitizeBoolean(profile.hasHotHolding),
    hasDryStorage: sanitizeBoolean(profile.hasDryStorage),
    hasProductionKitchen: sanitizeBoolean(profile.hasProductionKitchen),
    hasServingArea: sanitizeBoolean(profile.hasServingArea),
    hasToilet: sanitizeBoolean(profile.hasToilet),
    hasDishwashing: sanitizeBoolean(profile.hasDishwashing),
    hasWarmKitchen: sanitizeBoolean(profile.hasWarmKitchen),
    hasColdKitchen: sanitizeBoolean(profile.hasColdKitchen),
    hasHandwash: sanitizeBoolean(profile.hasHandwash),
    hasWashingRoom: sanitizeBoolean(profile.hasWashingRoom),
    hasVegetableRoom: sanitizeBoolean(profile.hasVegetableRoom),
    hasWalkInFreezer: sanitizeBoolean(profile.hasWalkInFreezer),
    hasWalkInCooler: sanitizeBoolean(profile.hasWalkInCooler),
    hasSofticeachine: sanitizeBoolean(profile.hasSofticeachine),
    hasOvens: sanitizeBoolean(profile.hasOvens),
    fridgeCount: toPositiveInt(profile.fridgeCount),
    freezerCount: toPositiveInt(profile.freezerCount),
    suppliers: sanitizeStringList(profile.suppliers, 80, 140)
  };
}

function sanitizeRiskModelInput(riskModel = {}) {
  return {
    hazards: toArray(riskModel.hazards).slice(0, 100).map((hazard) => ({
      name: sanitizeString(hazard?.name, 180),
      riskLevel: sanitizeString(hazard?.riskLevel, 40),
      control: sanitizeString(hazard?.control, 220),
      frequency: sanitizeString(hazard?.frequency, 80)
    })),
    controls: sanitizeStringList(riskModel.controls, 100, 180),
    tasks: sanitizeStringList(riskModel.tasks, 200, 180),
    suppliers: sanitizeStringList(riskModel.suppliers, 100, 140),
    companyType: sanitizeString(riskModel.companyType, 80),
    organizationName: sanitizeString(riskModel.organizationName, 140),
    generatedAt: sanitizeString(riskModel.generatedAt, 80)
  };
}

function extractCloudinaryAssets(...candidates) {
  const assets = [];

  candidates.forEach((candidate) => {
    toArray(candidate).forEach((item) => {
      if (!item || typeof item !== "object") return;

      const asset = {
        assetId: sanitizeString(item.assetId || item.cloudinaryAssetId || item.id, 180),
        publicId: sanitizeString(item.publicId || item.cloudinaryPublicId, 240),
        url: sanitizeString(item.url || item.secureUrl || item.secure_url, 2000),
        thumbnailUrl: sanitizeString(item.thumbnailUrl || item.thumbnail_url, 2000),
        format: sanitizeString(item.format, 40),
        bytes: Number(item.bytes || 0) || 0,
        width: Number(item.width || 0) || 0,
        height: Number(item.height || 0) || 0,
        moduleType: sanitizeString(item.moduleType, 80),
        itemId: sanitizeString(item.itemId, 180),
        uploadedAt: sanitizeString(item.uploadedAt || item.createdAt, 80)
      };

      if (!asset.url && !asset.publicId && !asset.assetId) return;
      assets.push(asset);
    });
  });

  const deduped = [];
  const seen = new Set();

  assets.forEach((asset) => {
    const key = asset.assetId || asset.publicId || asset.url;
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(asset);
  });

  return deduped.slice(0, 50);
}

function deriveOnboardingAnswers(profile = {}) {
  const businessTypeSlug = toAsciiSlug(profile.companyType || "restaurant", 80) || "restaurant";
  const processes = [];
  const specialConditions = [];
  const ingredients = [];
  const serviceTypes = [];

  if (profile.fridgeCount > 0) {
    processes.push("receive_chilled_goods", "store_chilled_goods");
  }

  if (profile.freezerCount > 0) {
    processes.push("receive_frozen_goods", "store_frozen_goods");
  }

  if (profile.servesHotFood || profile.hasWarmKitchen) {
    processes.push("cook_food");
  }

  if (profile.hasHotHolding) {
    processes.push("hot_hold_food");
  }

  if (profile.servesColdFood || profile.hasColdKitchen) {
    processes.push("serve_cold_food");
  }

  if (profile.packsTakeaway) {
    specialConditions.push("transport_food");
    serviceTypes.push("takeaway");
  }

  if (profile.hasServingArea) {
    serviceTypes.push("dine_in");
  }

  if (!serviceTypes.length) {
    serviceTypes.push("production_only");
  }

  if (profile.handlesAllergens) {
    specialConditions.push("handles_allergens");
  }

  if (profile.sellsRawFish) {
    ingredients.push("raw_fish");
  }

  if (profile.makesDesserts) {
    ingredients.push("desserts");
  }

  return {
    businessTypes: [businessTypeSlug],
    processes: [...new Set(processes)],
    ingredients: [...new Set(ingredients)],
    serviceTypes: [...new Set(serviceTypes)],
    specialConditions: [...new Set(specialConditions)],
    equipmentCounts: {
      fridge: toPositiveInt(profile.fridgeCount),
      freezer: toPositiveInt(profile.freezerCount)
    }
  };
}

function deriveCriticalPoints(riskModel = {}) {
  const controls = sanitizeStringList(riskModel.controls, 10, 160);
  if (controls.length) {
    return controls.slice(0, 3);
  }

  return toArray(riskModel.hazards)
    .map((hazard) => sanitizeString(hazard?.name, 160))
    .filter(Boolean)
    .slice(0, 3);
}

function deriveCustomerName({ profile = {}, userData = {}, email = "" }) {
  const rawName =
    sanitizeString(profile.ownerName || profile.contactName, 120) ||
    sanitizeString(userData.displayName || userData.name || userData.fullName, 120) ||
    sanitizeString(String(email || "").split("@")[0], 80) ||
    "Velkommen";

  return sanitizeString(rawName.split(/\s+/)[0], 80) || "Velkommen";
}

function buildOnboardingSummary({ profile = {}, riskModel = {}, customerName = "Velkommen" }) {
  return {
    customerName,
    companyName: sanitizeString(profile.companyName, 140),
    companyType: sanitizeString(profile.companyType || riskModel.companyType, 80) || "Restaurant",
    city: sanitizeString(profile.city, 80),
    criticalPoints: deriveCriticalPoints(riskModel)
  };
}

function buildHaccpSnapshotPayload({ profile = {}, riskModel = {}, companyId, locationId, userId }) {
  const sanitizedProfile = sanitizeOnboardingProfile(profile);
  const sanitizedRiskModel = sanitizeRiskModelInput(riskModel);
  const normalizedAddress = [sanitizedProfile.address, sanitizedProfile.zip, sanitizedProfile.city]
    .filter(Boolean)
    .join(", ");
  const now = new Date();

  // Generate comprehensive HACCP with all 7 KCPs (legacy)
  const comprehensiveHaccp = generateComprehensiveHaccp({
    profile: sanitizedProfile,
    companyType: sanitizedProfile.companyType
  });

  // Generate task templates from KCPs (legacy)
  const generatedTasks = generateTaskTemplatesFromKcps(comprehensiveHaccp.kcps);
  
  // Generate scenario-based HACCP (new motor)
  const scenarioHaccp = generateScenarioBasedHaccp({
    profile: sanitizedProfile,
    companyType: sanitizedProfile.companyType
  });
  
  // Derive legacy fields from new motor (preserve object shape)
  const derivedHazards = scenarioHaccp.hazards.map(h => ({
    name: h.title || "",
    riskLevel: h.riskLevel || "medium",
    control: h.controlMeasure || "",
    frequency: h.monitoring?.frequency || "daily"
  }));
  const derivedControls = [...new Set(scenarioHaccp.hazards.map(h => h.controlMeasure).filter(Boolean))];
  const derivedTasks = scenarioHaccp.taskTemplates.map(t => t.title);

  return {
    documentType: "lovpligtig_risikoanalyse_haccp",
    title: `Lovpligtig Risikoanalyse & HACCP for ${sanitizedProfile.companyName || "Virksomhed"}`,
    organizationId: companyId,
    companyId,
    locationId,
    createdBy: userId,
    companyName: sanitizedProfile.companyName,
    cvr: sanitizedProfile.cvr,
    address: normalizedAddress,
    companyType: sanitizedProfile.companyType,
    profile: {
      ...sanitizedProfile,
      address: sanitizedProfile.address,
      zip: sanitizedProfile.zip,
      city: sanitizedProfile.city,
      suppliers: sanitizedRiskModel.suppliers.length ? sanitizedRiskModel.suppliers : sanitizedProfile.suppliers
    },
    // NEW: Scenario-based HACCP structure (v3.0)
    haccp: {
      version: scenarioHaccp.version,
      scenarios: scenarioHaccp.scenarios,
      processes: scenarioHaccp.processes,
      hazards: scenarioHaccp.hazards,
      verificationTasks: scenarioHaccp.verificationTasks,
      documentationRequirements: scenarioHaccp.documentationRequirements,
      taskTemplates: scenarioHaccp.taskTemplates,
      summary: scenarioHaccp.summary,
      // Legacy KCP structure for backward compatibility
      kcps: comprehensiveHaccp.kcps,
      generatedTasks: generatedTasks,
      totalKcps: comprehensiveHaccp.summary.totalKcps
    },
    // LEGACY: Keep old structure for backwards compatibility
    generated: {
      hazards: sanitizedRiskModel.hazards.length ? sanitizedRiskModel.hazards : derivedHazards,
      controls: sanitizedRiskModel.controls.length ? sanitizedRiskModel.controls : derivedControls,
      tasks: sanitizedRiskModel.tasks.length ? sanitizedRiskModel.tasks : derivedTasks,
      suppliers: sanitizedRiskModel.suppliers.length ? sanitizedRiskModel.suppliers : sanitizedProfile.suppliers
    },
    status: "generated",
    source: "onboarding",
    createdAt: FieldValue.serverTimestamp(),
    createdAtIso: now.toISOString(),
    createdAtEpochMs: now.getTime()
  };
}

async function createHaccpSnapshotDocument({ profile = {}, riskModel = {}, companyId, locationId, userId }) {
  const payload = buildHaccpSnapshotPayload({
    profile,
    riskModel,
    companyId,
    locationId,
    userId
  });

  const docRef = await db.collection("haccp_snapshots").add(payload);
  return {
    snapshotId: docRef.id,
    payload
  };
}

function buildLiveUserProfilePayload({
  profile = {},
  riskModel = {},
  companyId,
  locationId,
  userId,
  userEmail = "",
  summary = {},
  cloudinaryAssets = [],
  draftId = "",
  checkoutSessionId = ""
}) {
  const sanitizedProfile = sanitizeOnboardingProfile(profile);
  const sanitizedRiskModel = sanitizeRiskModelInput(riskModel);
  const onboardingAnswers = deriveOnboardingAnswers(sanitizedProfile);
  const normalizedAddress = [sanitizedProfile.address, sanitizedProfile.zip, sanitizedProfile.city]
    .filter(Boolean)
    .join(", ");

  return {
    organizationId: companyId,
    companyId,
    locationId,
    userId,
    userEmail: sanitizeString(userEmail, 160),
    companyName: sanitizedProfile.companyName,
    companyType: sanitizedProfile.companyType,
    customerName: sanitizeString(summary.customerName, 80),
    profile: sanitizedProfile,
    riskModel: sanitizedRiskModel,
    summary: {
      customerName: sanitizeString(summary.customerName, 80),
      companyName: sanitizeString(summary.companyName, 140),
      companyType: sanitizeString(summary.companyType, 80),
      city: sanitizeString(summary.city, 80),
      criticalPoints: sanitizeStringList(summary.criticalPoints, 6, 160)
    },
    onboardingAnswers: {
      ...onboardingAnswers,
      cloudinaryAssets
    },
    address: normalizedAddress,
    cloudinaryAssets,
    onboardingDraftId: sanitizeString(draftId, 180),
    checkoutSessionId: sanitizeString(checkoutSessionId, 220),
    status: "live",
    source: "onboarding_checkout",
    activatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function upsertOnboardingAnswersDocument({ companyId, locationId, userId, liveProfilePayload }) {
  const onboardingDocId = toDocSafeId(`${companyId}__${locationId}__onboarding`);
  const onboardingRef = db.collection("onboarding_answers").doc(onboardingDocId);
  const answers = liveProfilePayload.onboardingAnswers || {};

  await onboardingRef.set({
    companyId,
    locationId,
    organizationId: companyId,
    businessTypes: toArray(answers.businessTypes),
    processes: toArray(answers.processes),
    ingredients: toArray(answers.ingredients),
    serviceTypes: toArray(answers.serviceTypes),
    specialConditions: toArray(answers.specialConditions),
    equipmentCounts: answers.equipmentCounts || {},
    cloudinaryAssets: toArray(answers.cloudinaryAssets),
    createdBy: sanitizeString(userId, 120),
    source: "onboarding_checkout",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return onboardingDocId;
}

function resolveOperatingMode(data, todayKey) {
  if (!data || data.isActive === false) return "open";

  const untilDateKey =
    normalizeDateKey(data.untilDateKey) ||
    normalizeDateKey(data.until) ||
    normalizeDateKey(data.endDate);

  const stillValid = !untilDateKey || todayKey <= untilDateKey;
  if (!stillValid) return "open";

  if (data.closed === true) return "closed";
  if (data.vacation === true) return "vacation";
  return "open";
}

async function getOperatingModeForLocation({ companyId, locationId, todayKey }) {
  const queries = [
    db.collection("operating_overrides")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .limit(1),
    db.collection("operating_overrides")
      .where("locationId", "==", locationId)
      .limit(1)
  ];

  for (const q of queries) {
    const snap = await q.get();
    if (snap.empty) continue;

    const mode = resolveOperatingMode(snap.docs[0].data() || {}, todayKey);
    if (mode !== "open") return mode;
  }

  return "open";
}

function resolveLexiStatus({ operatingMode, totalActive, dueToday }) {
  if (operatingMode === "closed") return "lukket";
  if (operatingMode === "vacation") return "ferie";
  if (totalActive <= 0) return "ingen_rutiner";
  if (dueToday > 0) return "mangler_opgaver";
  return "opdateret";
}

function getUserLocationIds(userData) {
  const ids = [];
  if (Array.isArray(userData?.locationIds)) {
    for (const value of userData.locationIds) {
      const id = sanitizeString(value, 120);
      if (id) ids.push(id);
    }
  }

  const primaryLocationId = sanitizeString(
    userData?.primaryLocationId || userData?.locationId,
    120
  );
  if (primaryLocationId) ids.push(primaryLocationId);

  return [...new Set(ids)];
}

function isDemoScopedId(value) {
  return sanitizeString(value, 120).toLowerCase().includes("demo");
}

function buildPreferredLocationIds(userData, preferredLocationId = "") {
  const existingIds = getUserLocationIds(userData);
  const normalizedPreferred = sanitizeString(preferredLocationId, 120);
  const hasLivePreferred = normalizedPreferred && !isDemoScopedId(normalizedPreferred);

  const preservedIds = hasLivePreferred
    ? existingIds.filter((item) => !isDemoScopedId(item))
    : existingIds;

  if (normalizedPreferred && !preservedIds.includes(normalizedPreferred)) {
    preservedIds.push(normalizedPreferred);
  }

  return [...new Set(preservedIds.filter(Boolean))];
}

async function getUserAccessProfile({ uid, email }) {
  const byUid = await db.collection("users").doc(uid).get();
  if (byUid.exists) {
    return byUid.data() || {};
  }

  const normalizedEmail = sanitizeString(email, 160).toLowerCase();
  if (!normalizedEmail) return null;

  const byEmail = await db
    .collection("users")
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();

  if (byEmail.empty) return null;
  return byEmail.docs[0].data() || {};
}

async function assertLexiCustomerAccess({ uid, email, companyId, locationId }) {
  const userData = await getUserAccessProfile({ uid, email });
  if (!userData) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Brugerprofil blev ikke fundet."
    );
  }

  const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 120);
  if (!userCompanyId || userCompanyId !== companyId) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Adgang til companyId afvist."
    );
  }

  const locationIds = getUserLocationIds(userData);
  if (locationIds.length > 0 && !locationIds.includes(locationId)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Adgang til locationId afvist."
    );
  }
}

async function assertStartDayAccess({ uid, email, companyId, locationId }) {
  const userData = await getUserAccessProfile({ uid, email });
  if (!userData) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Brugerprofil blev ikke fundet."
    );
  }

  const role = sanitizeString(userData.role || "", 80).toLowerCase();
  const allowedRoles = ["owner", "hq_admin", "location_manager", "admin", "manager", "employee", "super-admin"];
  if (!allowedRoles.includes(role)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Brugerrolle maa ikke starte dagen."
    );
  }

  // Super-admin can access any company/location (for impersonation)
  if (role === "super-admin") {
    return;
  }

  const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 120);
  if (!userCompanyId || userCompanyId !== companyId) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Adgang til companyId afvist."
    );
  }

  const locationIds = getUserLocationIds(userData);
  if (locationIds.length > 0 && !locationIds.includes(locationId)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Adgang til locationId afvist."
    );
  }
}

async function assertAdminAccess({ uid, email, companyId, locationId }) {
  const userData = await getUserAccessProfile({ uid, email });
  if (!userData) {
    throw new functions.https.HttpsError("permission-denied", "Brugerprofil blev ikke fundet.");
  }

  const role = sanitizeString(userData.role || "", 80).toLowerCase();
  const allowedRoles = ["owner", "hq_admin", "location_manager", "admin", "super-admin"];
  if (!allowedRoles.includes(role)) {
    throw new functions.https.HttpsError("permission-denied", "Kun admin maa udfoere denne handling.");
  }

  // Super-admin can access any company/location (for impersonation)
  if (role === "super-admin") {
    return;
  }

  const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 120);
  if (!userCompanyId || userCompanyId !== companyId) {
    throw new functions.https.HttpsError("permission-denied", "Adgang til companyId afvist.");
  }

  const locationIds = getUserLocationIds(userData);
  if (locationIds.length > 0 && !locationIds.includes(locationId)) {
    throw new functions.https.HttpsError("permission-denied", "Adgang til locationId afvist.");
  }
}

async function assertSeoGeneratorAccess({ uid, email, companyId, locationId }) {
  const userData = await getUserAccessProfile({ uid, email });
  if (!userData) {
    throw new functions.https.HttpsError("permission-denied", "Brugerprofil blev ikke fundet.");
  }

  const role = sanitizeString(userData.role || "", 80).toLowerCase();
  const allowedRoles = ["owner", "hq_admin", "location_manager", "admin", "manager", "employee"];
  if (!allowedRoles.includes(role)) {
    throw new functions.https.HttpsError("permission-denied", "Brugerrolle maa ikke bruge SEO-generatoren.");
  }

  const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 120);
  if (!userCompanyId || userCompanyId !== companyId) {
    throw new functions.https.HttpsError("permission-denied", "Adgang til companyId afvist.");
  }

  const locationIds = getUserLocationIds(userData);
  if (locationIds.length > 0 && !locationIds.includes(locationId)) {
    throw new functions.https.HttpsError("permission-denied", "Adgang til locationId afvist.");
  }
}

function normalizeEmploymentRole(value) {
  const raw = sanitizeString(value, 80).toLowerCase();
  if (raw === "ansat") return "ansat";
  if (raw === "employee" || raw === "medarbejder") return "medarbejder";
  return "medarbejder";
}

function buildScopedUserResponse(userId, data = {}) {
  const locationIds = getUserLocationIds(data);
  const createdAt = data?.createdAt && typeof data.createdAt.toDate === "function"
    ? data.createdAt.toDate().toISOString()
    : null;

  return {
    userId,
    displayName: sanitizeString(data.displayName || data.name || "", 160),
    email: sanitizeString(data.email || "", 160).toLowerCase(),
    role: sanitizeString(data.role || "employee", 80).toLowerCase() || "employee",
    employmentRole: normalizeEmploymentRole(data.employmentRole || data.roleLabel || data.role),
    companyId: sanitizeString(data.companyId || data.organizationId || "", 120),
    primaryLocationId: sanitizeString(data.primaryLocationId || data.locationId || "", 120),
    locationIds,
    createdAt,
    status: sanitizeString(data.status || "active", 60).toLowerCase() || "active"
  };
}

function toDocSafeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function deleteScopedCollectionDocs({ collectionName, companyId, locationId }) {
  const refsByPath = new Map();
  const variantQueries = [
    db.collection(collectionName)
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId),
    db.collection(collectionName)
      .where("organizationId", "==", companyId)
      .where("locationId", "==", locationId)
  ];

  for (const q of variantQueries) {
    const snap = await q.get();
    for (const doc of snap.docs) {
      refsByPath.set(doc.ref.path, doc.ref);
    }
  }

  const refs = Array.from(refsByPath.values());
  if (!refs.length) return 0;

  let deleted = 0;
  for (let i = 0; i < refs.length; i += 450) {
    const chunk = refs.slice(i, i + 450);
    const batch = db.batch();
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

async function loadActiveTaskTemplates({ companyId, locationId }) {
  const refsByPath = new Map();
  const variants = [
    { companyField: "companyId", companyValue: companyId, locationValue: locationId },
    { companyField: "organizationId", companyValue: companyId, locationValue: locationId },
    { companyField: "companyId", companyValue: companyId, locationValue: toLegacyId(locationId) },
    { companyField: "organizationId", companyValue: companyId, locationValue: toLegacyId(locationId) }
  ].filter((variant) => variant.companyValue && variant.locationValue);

  for (const variant of variants) {
    const normalizedCompanyValue = sanitizeString(variant.companyValue, 120);
    const normalizedLocationValue = sanitizeString(variant.locationValue, 120);
    if (!normalizedCompanyValue || !normalizedLocationValue) continue;

    const snapshot = await db
      .collection("task_templates")
      .where(variant.companyField, "==", normalizedCompanyValue)
      .where("locationId", "==", normalizedLocationValue)
      .get();

    for (const doc of snapshot.docs) {
      refsByPath.set(doc.ref.path, doc);
    }
  }

  return Array.from(refsByPath.values()).filter((doc) => {
    const data = doc.data() || {};
    if (data.isActive === false) return false;
    if (data.active === false) return false;
    return true;
  });
}

async function getExistingTaskInstanceMap({ companyId, locationId, todayKey }) {
  const snapshot = await db
    .collection("task_instances")
    .where("locationId", "==", locationId)
    .where("dateKey", "==", todayKey)
    .get();

  const taskMap = new Map();

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const organizationId = sanitizeString(data.companyId || data.organizationId, 120);
    if (companyId && organizationId && organizationId !== companyId) continue;

    const taskId = sanitizeString(data.taskId, 120);
    if (!taskId) continue;

    const equipmentId = sanitizeString(data.equipmentId, 120);
    const uniqueKey = equipmentId ? `${taskId}__${equipmentId}` : taskId;

    taskMap.set(uniqueKey, {
      ref: doc.ref,
      data
    });
  }

  return taskMap;
}

async function getOperatingOverrideDataForLocation({ companyId, locationId }) {
  const snapshot = await db
    .collection("operating_overrides")
    .where("locationId", "==", locationId)
    .limit(10)
    .get();

  if (snapshot.empty) return null;

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const organizationId = sanitizeString(data.companyId || data.organizationId, 120);
    if (companyId && organizationId && organizationId !== companyId) continue;

    return {
      id: doc.id,
      ...data
    };
  }

  return null;
}

async function loadDashboardTaskInstances({ companyId, locationId, dateKey }) {
  const snapshot = await db
    .collection("task_instances")
    .where("locationId", "==", locationId)
    .where("dateKey", "==", dateKey)
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((item) => {
      const organizationId = sanitizeString(item.companyId || item.organizationId, 120);
      return !companyId || !organizationId || organizationId === companyId;
    });
}

async function loadDashboardAlertCount({ companyId, locationId, dateKey }) {
  const snapshot = await db
    .collection("alerts")
    .where("locationId", "==", locationId)
    .where("dateKey", "==", dateKey)
    .get();

  return snapshot.docs.filter((doc) => {
    const data = doc.data() || {};
    const organizationId = sanitizeString(data.companyId || data.organizationId, 120);
    const status = sanitizeString(data.status || "", 40);
    return (!companyId || !organizationId || organizationId === companyId) && status === "open";
  }).length;
}

function getSnapshotEpoch(snapshotData) {
  const epoch = Number(snapshotData?.createdAtEpochMs || 0);
  if (Number.isFinite(epoch) && epoch > 0) return epoch;

  if (snapshotData?.createdAt && typeof snapshotData.createdAt.toMillis === "function") {
    return snapshotData.createdAt.toMillis();
  }

  return 0;
}

async function loadLatestHaccpSnapshot({ companyId }) {
  const queries = [
    db.collection("haccp_snapshots")
      .where("companyId", "==", companyId)
      .limit(50),
    db.collection("haccp_snapshots")
      .where("organizationId", "==", companyId)
      .limit(50)
  ];

  for (const q of queries) {
    const snapshot = await q.get();
    if (snapshot.empty) continue;

    let best = null;
    for (const doc of snapshot.docs) {
      const data = doc.data() || {};
      if (!best || getSnapshotEpoch(data) > getSnapshotEpoch(best)) {
        best = data;
      }
    }

    if (best) return best;
  }

  return null;
}

function inferProvisionedTemplateMeta(title = "", hazard = {}) {
  const text = sanitizeString(title, 220).toLowerCase();
  const hazardName = sanitizeString(hazard?.name || "", 220);
  const controlPoint = sanitizeString(hazard?.control || title, 220) || title;

  if (
    text.includes("temperatur") ||
    text.includes("køl") ||
    text.includes("kol") ||
    text.includes("frys") ||
    text.includes("varmhold") ||
    text.includes("opvask")
  ) {
    return {
      category: text.includes("modtage") ? "modtagelse" : "temperatur",
      formType: "temperature",
      riskLevel: sanitizeString(hazard?.riskLevel || "high", 20).toLowerCase() || "high",
      controlPoint,
      sourceHazard: hazardName
    };
  }

  if (text.includes("modtage") || text.includes("leveran")) {
    return {
      category: "modtagelse",
      formType: "receiving",
      riskLevel: sanitizeString(hazard?.riskLevel || "medium", 20).toLowerCase() || "medium",
      controlPoint,
      sourceHazard: hazardName
    };
  }

  if (text.includes("rengør") || text.includes("rengor") || text.includes("lukker")) {
    return {
      category: text.includes("lukker") ? "lukkerutine" : "rengøring",
      formType: "checklist",
      riskLevel: sanitizeString(hazard?.riskLevel || "medium", 20).toLowerCase() || "medium",
      controlPoint,
      sourceHazard: hazardName
    };
  }

  return {
    category: "egenkontrol",
    formType: "check",
    riskLevel: sanitizeString(hazard?.riskLevel || "medium", 20).toLowerCase() || "medium",
    controlPoint,
    sourceHazard: hazardName
  };
}

function buildProvisionedTemplateFields(formType, suppliers = []) {
  if (formType === "temperature") {
    return [
      { key: "measurement", label: "Måling", type: "number", required: true },
      { key: "comment", label: "Kommentar", type: "textarea", required: false },
      { key: "deviationReason", label: "Årsag ved afvigelse", type: "textarea", required: false }
    ];
  }

  if (formType === "receiving") {
    return [
      { key: "supplier", label: "Leverandør", type: suppliers.length ? "select" : "text", required: true, options: suppliers },
      { key: "status", label: "Status", type: "radio", required: true, options: ["OK", "Afvigelse"] },
      { key: "comment", label: "Kommentar", type: "textarea", required: false },
      { key: "deviationReason", label: "Årsag ved afvigelse", type: "textarea", required: false }
    ];
  }

  if (formType === "checklist") {
    return [
      { key: "completed", label: "Udført", type: "checkbox", required: false },
      { key: "comment", label: "Kommentar", type: "textarea", required: false },
      { key: "deviationReason", label: "Årsag ved afvigelse", type: "textarea", required: false }
    ];
  }

  return [
    { key: "status", label: "Status", type: "radio", required: true, options: ["OK", "Afvigelse"] },
    { key: "comment", label: "Kommentar", type: "textarea", required: false },
    { key: "deviationReason", label: "Årsag ved afvigelse", type: "textarea", required: false }
  ];
}

function buildProvisionedTemplateAlertRules(formType, title, riskLevel) {
  if (formType === "temperature") {
    return [{
      type: "measurement_out_of_range",
      severity: riskLevel === "high" ? "critical" : "warning",
      message: `${sanitizeString(title, 160)} kræver temperaturkontrol`
    }];
  }

  return [{
    type: "status_equals",
    value: "Afvigelse",
    severity: riskLevel === "high" ? "critical" : "warning",
    message: `${sanitizeString(title, 160)} kræver handling`
  }];
}

function extractTemperatureLimits(kcp) {
  if (!kcp || !kcp.criticalLimit) return { minValue: null, maxValue: null, unit: "°C" };
  
  const criticalLimit = kcp.criticalLimit;
  const category = (kcp.category || "").toLowerCase();
  const title = (kcp.title || "").toLowerCase();
  
  // KCP 1: Modtagelse (Receiving) - Default to chilled goods temperature
  if (category.includes("modtagelse") || title.includes("modtagelse") || title.includes("varemodtagelse")) {
    return { minValue: 0, maxValue: 5, unit: "°C", target: "Kølevarer" };
  }
  
  // KCP 2: Opbevaring - Køl/Frost
  if (category.includes("opbevaring") || title.includes("lager")) {
    if (title.includes("køl") || title.includes("fridge")) {
      return { minValue: 0, maxValue: 5, unit: "°C", target: "Køleskab" };
    }
    if (title.includes("frost") || title.includes("frys")) {
      return { minValue: -25, maxValue: -18, unit: "°C", target: "Fryser" };
    }
    // Default for storage
    return { minValue: 0, maxValue: 5, unit: "°C", target: "Køl" };
  }
  
  // KCP 3: Tilberedning
  if (category.includes("tilberedning") || title.includes("tilberedning") || title.includes("opvarmning")) {
    return { minValue: 75, maxValue: 100, unit: "°C", target: "Kernetemperatur" };
  }
  
  // KCP 4: Nedkøling
  if (category.includes("nedkoeling") || title.includes("nedkøl")) {
    return { minValue: 0, maxValue: 10, unit: "°C", target: "Sluttemperatur", timeLimit: "4 timer" };
  }
  
  // KCP 5: Varmholdelse
  if (category.includes("varmholdelse") || title.includes("varmhold")) {
    return { minValue: 60, maxValue: 100, unit: "°C", target: "Varmholdelse", timeLimit: "3 timer" };
  }
  
  return { minValue: null, maxValue: null, unit: "°C" };
}

function formatInstructions(kcp) {
  if (!kcp || !kcp.monitoring) return null;
  
  const monitoring = kcp.monitoring;
  const instructions = [];
  
  if (monitoring.what) {
    instructions.push(`**Hvad skal kontrolleres:** ${monitoring.what}`);
  }
  
  if (monitoring.how) {
    instructions.push(`**Hvordan:** ${monitoring.how}`);
  }
  
  if (monitoring.frequency) {
    instructions.push(`**Frekvens:** ${monitoring.frequency}`);
  }
  
  if (monitoring.responsible) {
    instructions.push(`**Ansvarlig:** ${monitoring.responsible}`);
  }
  
  return instructions.length > 0 ? instructions.join("\n\n") : null;
}

function formatCriticalLimits(kcp) {
  if (!kcp || !kcp.criticalLimit) return null;
  
  const limits = [];
  const criticalLimit = kcp.criticalLimit;
  
  Object.entries(criticalLimit).forEach(([key, value]) => {
    if (value && typeof value === "string") {
      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
      limits.push(`**${label}:** ${value}`);
    }
  });
  
  return limits.length > 0 ? limits.join("\n\n") : null;
}

function formatCorrectiveActions(kcp) {
  if (!kcp || !kcp.correctiveAction) return null;
  
  const actions = [];
  const correctiveAction = kcp.correctiveAction;
  
  if (correctiveAction.immediate) {
    actions.push(`**Øjeblikkelig handling:** ${correctiveAction.immediate}`);
  }
  
  if (correctiveAction.prevention) {
    actions.push(`**Forebyggelse:** ${correctiveAction.prevention}`);
  }
  
  if (correctiveAction.documentation) {
    actions.push(`**Dokumentation:** ${correctiveAction.documentation}`);
  }
  
  Object.entries(correctiveAction).forEach(([key, value]) => {
    if (value && typeof value === "string" && !["immediate", "prevention", "documentation", "training"].includes(key)) {
      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
      actions.push(`**${label}:** ${value}`);
    }
  });
  
  return actions.length > 0 ? actions.join("\n\n") : null;
}

function buildSpecificGuideContent(kcp) {
  const category = (kcp?.category || "").toLowerCase();
  const title = (kcp?.title || "").toLowerCase();
  
  if (category.includes("nedkoeling") || title.includes("nedkøl")) {
    return {
      guidePurpose: "At sikre at tilberedte retter nedkøles hurtigt nok til at forhindre bakterievækst. Langsom nedkøling mellem 10°C og 60°C er farligt.",
      guideExecutionTimes: "Efter hver tilberedning af retter der skal opbevares køligt",
      guideCriticalLimit: "Sluttemperatur under 10°C inden for 4 timer fra 60°C",
      guideSteps: [
        "Mål og noter starttemperatur umiddelbart efter tilberedning (skal være under 60°C)",
        "Placer maden i blast chiller eller køl med god luftcirkulation",
        "Tildæk maden korrekt og mærk med dato og tidspunkt",
        "Mål sluttemperatur efter nedkøling",
        "Registrér både start- og sluttemperatur samt nedkølingstid i systemet"
      ],
      guideWhatToRegister: ["Dato og klokkeslæt for start", "Starttemperatur", "Sluttemperatur", "Nedkølingstid", "Hvem der har udført kontrollen", "Eventuel kommentar"],
      guideApproval: ["Sluttemperatur er under 10°C", "Nedkøling tog mindre end 4 timer", "Maden er korrekt tildækket og mærket", "Dokumentation er registreret"],
      guideDeviationCriteria: ["Sluttemperatur over 10°C efter 4 timer", "Blast chiller fungerer ikke", "Maden blev ikke tildækket korrekt", "Nedkølingstid overskred 4 timer"],
      guideIfNotOk: [
        "Registrér afvigelsen straks med præcise temperaturer og tidspunkter",
        "Hvis over 10°C efter 4 timer: Kassér maden omgående - bakterievækst kan være farlig",
        "Hvis blast chiller defekt: Brug isvandsbad eller fordel i mindre portioner i køl",
        "Flyt andre varer til fungerende udstyr",
        "Informér køkkenchef eller ansvarlig leder",
        "Bestil service på blast chiller hvis nødvendigt",
        "Ved tvivl om fødevaresikkerhed: Kassér altid maden"
      ],
      guideShortTips: ["Mål altid roligt og korrekt", "Brug kalibreret termometer", "Skriv den rigtige temperatur, ikke et gæt", "Ved afvigelse skal du altid handle med det samme", "Dokumentér alt"]
    };
  }
  
  if (category.includes("tilberedning") || title.includes("tilberedning") || title.includes("opvarmning")) {
    return {
      guidePurpose: "At sikre at maden tilberedes korrekt til en sikker temperatur for at forhindre bakterievækst.",
      guideExecutionTimes: "Før hver servering af tilberedte retter",
      guideCriticalLimit: "Kernetemperatur på minimum 75°C",
      guideSteps: [
        "Stik termometeret i den tykkeste del af kødet eller fjerkræet",
        "Vent 10 sekunder for at få en stabil måling",
        "Aflæs temperaturen og sikr dig at den er minimum 75°C",
        "Registrér temperaturen i systemet"
      ],
      guideWhatToRegister: ["Dato og klokkeslæt for måling", "Kernetemperatur", "Hvem der har udført kontrollen", "Eventuel kommentar"],
      guideApproval: ["Kernetemperatur er minimum 75°C", "Maden ser appetitlig ud", "Dokumentation er registreret"],
      guideDeviationCriteria: ["Kernetemperatur under 75°C", "Termometeret er ikke kalibreret", "Maden ser ikke appetitlig ud"],
      guideIfNotOk: [
        "Registrér afvigelsen straks med præcise temperaturer og tidspunkter",
        "Hvis under 75°C: Tilbered maden længere ved lavere varme",
        "Hvis termometeret ikke er kalibreret: Kalibrér det før næste brug",
        "Hvis maden ikke ser appetitlig ud: Kassér den",
        "Informér køkkenchef eller ansvarlig leder",
        "Ved tvivl om fødevaresikkerhed: Kassér altid maden"
      ],
      guideShortTips: ["Brug altid et kalibreret termometer", "Mål kernetemperaturen korrekt", "Skriv den rigtige temperatur, ikke et gæt", "Ved afvigelse skal du altid handle med det samme", "Dokumentér alt"]
    };
  }
  
  if (category.includes("varmholdelse") || title.includes("varmhold")) {
    return {
      guideAreas: ["Temperatur (min 60°C)", "Varighed (max 3 timer)", "Madkvalitet"],
      guideSteps: ["Mål i midten af retten", "Tjek varmeskab temperatur", "Noter starttidspunkt", "Registrer data"],
      guideApproval: ["Minimum 60°C", "Under 3 timer", "Ser appetitlig ud"],
      guideIfNotOk: ["Under 60°C: Varm til 75°C eller kassér", "Over 3 timer: Kassér maden", "Varmeskab defekt: Flyt eller server", "Ved tvivl: Kassér", "Registrer afvigelse"]
    };
  }
  
  if (category.includes("modtagelse") || title.includes("modtagelse")) {
    return {
      guideAreas: ["Temperatur (køl max 5°C, frost max -12°C)", "Emballage-integritet", "Holdbarhedsdato", "Sensorisk vurdering"],
      guideSteps: ["Tjek temperaturer", "Inspicer emballage", "Tjek datoer", "Lugt og se på varerne"],
      guideApproval: ["Temperaturer OK", "Emballage intakt", "Datoer acceptable", "Frisk lugt og udseende"],
      guideIfNotOk: ["Kølevarer over 5°C: Afvis", "Frostvarer optøede: Afvis", "Beskadiget emballage: Afvis eller dokumenter", "Dårlig lugt: Afvis altid", "Kort holdbarhed: Afvis eller brug samme dag", "Dokumenter med billeder"]
    };
  }
  
  if (category.includes("opbevaring") || title.includes("lager")) {
    return {
      guideAreas: ["Temperatur (køl 0-5°C, frost -18 til -25°C)", "FIFO-princip", "Adskillelse råt/tilberedt", "Tildækning og mærkning"],
      guideSteps: ["Mål temperaturer", "Tjek FIFO", "Kontrollér adskillelse", "Verificer mærkning"],
      guideApproval: ["Temperaturer korrekte", "FIFO overholdt", "Ingen krydskontaminering", "Alt mærket"],
      guideIfNotOk: ["Høj temperatur: Tjek døre, kontakt tekniker", "Råt over tilberedt: Flyt og rengør", "Umærket: Mærk nu eller kassér", "Gammelt mad: Kassér", "Gentagne problemer: Tag ud af drift", "Registrer afvigelse"]
    };
  }
  
  if (category.includes("allergen")) {
    return {
      guideAreas: ["Allergenmærkning på menukort", "Separate redskaber", "Rengøring mellem retter", "Personaleviden"],
      guideSteps: ["Gennemgå menukort", "Tjek separate redskaber", "Test personaleviden", "Kontrollér rengøring"],
      guideApproval: ["Alt mærket korrekt", "Separate redskaber findes", "Personale kender allergener", "Rengøring forhindrer krydskontaminering"],
      guideIfNotOk: ["Mangler mærkning: Opdater omgående", "Personale ukyndigt: Hold briefing nu", "Ingen separate redskaber: Anskaf eller vask grundigt", "Krydskontaminering: Kassér og lav ny", "Allergisk reaktion: Ring 112 hvis alvorligt", "Træn personale"]
    };
  }
  
  if (category.includes("rengoering") || category.includes("cleaning")) {
    return {
      guideAreas: ["Arbejdsflader og redskaber", "Køle/frostenheder", "Afløb og gulve", "Maskiner"],
      guideSteps: ["Inspicer visuelt", "Tjek kritiske områder", "Verificer rengøringsplan", "Test med hvid klud"],
      guideApproval: ["Visuelt rent", "Ingen dårlig lugt", "Plan fulgt", "Hvid klud-test OK"],
      guideIfNotOk: ["Synligt snavs: Rengør omgående", "Afløb lugter: Rens dagligt", "Beskidte tætninger: Rengør og desinficer", "Maskiner urene: Stop brug og rengør", "Gentagne problemer: Ekstra instruktion", "Skadedyr: Kontakt bekæmpelse", "Registrer afvigelse"]
    };
  }
  
  return {
    guideAreas: ["Kontrollér visuelt", "Bekræft udførelse", "Beskriv afvigelser"],
    guideSteps: ["Vask hænder", "Gennemfør kontrol", "Gem dokumentation"],
    guideApproval: ["Rent og vedligeholdt", "Udført uden mangler", "Gemt i systemet"],
    guideIfNotOk: ["Registrér afvigelse", "Udfør korrigerende handling", "Informer ansvarlig"]
  };
}

function buildProvisionedTaskTemplates({ companyId, locationId, profile = {}, riskModel = {}, userId = "", userEmail = "" }) {
  const suppliers = sanitizeStringList(riskModel?.suppliers || profile?.suppliers || [], 20, 120);
  const nowIso = new Date().toISOString();
  
  // Generate scenario-based HACCP (new motor)
  const scenarioHaccp = generateScenarioBasedHaccp({
    profile: profile,
    companyType: profile.companyType
  });
  
  // Use scenario-based task templates if available
  const scenarioTasks = scenarioHaccp.taskTemplates || [];
  
  if (scenarioTasks.length > 0) {
    // Use new scenario-based templates
    return scenarioTasks.map((task, index) => {
      const templateId = task.id || toDocSafeId(`${companyId}__${locationId}__${task.sourceType}_${task.title}`).slice(0, 120);
      
      // Robust fallback for fields and alertRules
      const taskFields = Array.isArray(task.fields) && task.fields.length > 0 
        ? task.fields 
        : buildProvisionedTemplateFields(task.formType, suppliers);
      
      const taskAlertRules = Array.isArray(task.alertRules) && task.alertRules.length > 0 
        ? task.alertRules 
        : buildProvisionedTemplateAlertRules(task.formType, task.title, task.riskLevel);
      
      // Defensive defaults for objects/arrays
      const safeCriticalLimits = task.criticalLimits && typeof task.criticalLimits === "object" 
        ? task.criticalLimits 
        : {};
      
      const safeProcedure = Array.isArray(task.procedure) 
        ? task.procedure 
        : [];
      
      const safeDeviationActions = Array.isArray(task.deviationActions) 
        ? task.deviationActions 
        : [];
      
      return {
        id: templateId,
        companyId,
        organizationId: companyId,
        locationId,
        title: sanitizeString(task.title, 220),
        description: sanitizeString(task.description, 500),
        category: sanitizeString(task.category, 80),
        frequency: task.frequency || task.frequencyType || "daily",
        frequencyType: task.frequencyType || "daily",
        frequencyDays: task.frequencyDays || 1,
        registrationFrequency: task.registrationFrequency || task.frequency || "daily",
        registrationFrequencyType: task.registrationFrequencyType || task.frequencyType || "daily",
        registrationFrequencyDays: task.registrationFrequencyDays || task.frequencyDays || 1,
        riskLevel: sanitizeString(task.riskLevel, 40) || "medium",
        isCCP: task.isCCP || false,
        controlPoint: sanitizeString(task.controlPoint, 180),
        controlPointType: sanitizeString(task.controlPointType, 80),
        formType: sanitizeString(task.formType, 40) || "checklist",
        fields: taskFields,
        alertRules: taskAlertRules,
        sourceHazardId: task.sourceHazardId,
        sourceHazard: task.sourceHazard,
        sourceProcessKey: task.sourceProcessKey,
        sourceType: task.sourceType || "hazard",
        templateType: task.templateType || "operational",
        templateSource: "scenario_based_haccp",
        haccpVersion: scenarioHaccp.version || "3.0_scenario_based",
        criticalLimits: safeCriticalLimits,
        procedure: safeProcedure,
        deviationActions: safeDeviationActions,
        active: task.active !== false,
        isActive: task.isActive !== false,
        createdBy: userId,
        createdByName: userEmail,
        updatedBy: userId,
        generatedAt: nowIso,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        relatedProcessKeys: Array.isArray(task.relatedProcessKeys) ? task.relatedProcessKeys : [],
        relatedHazardIds: Array.isArray(task.relatedHazardIds) ? task.relatedHazardIds : []
      };
    });
  }
  
  // Fallback to legacy KCP-based templates
  const comprehensiveHaccp = generateComprehensiveHaccp({
    profile: profile,
    companyType: profile.companyType
  });
  
  const kcpTasks = generateTaskTemplatesFromKcps(comprehensiveHaccp.kcps);
  
  return kcpTasks.map((task, index) => {
    const templateId = toDocSafeId(`${companyId}__${locationId}__kcp_${task.kcpNumber}_${task.title}`).slice(0, 120);
    
    // Find the corresponding KCP for detailed information
    const kcp = comprehensiveHaccp.kcps.find(k => k.id === task.kcpId);
    
    // Extract temperature limits if this is a temperature task
    const tempLimits = task.formType === "temperature" ? extractTemperatureLimits(kcp) : {};
    
    // Format instructions and corrective actions
    const instructions = kcp ? formatInstructions(kcp) : null;
    const criticalLimits = kcp ? formatCriticalLimits(kcp) : null;
    const correctiveActions = kcp ? formatCorrectiveActions(kcp) : null;
    
    // Get specific guide content based on KCP type
    const specificGuide = kcp ? buildSpecificGuideContent(kcp) : null;
    
    const baseTemplate = {
      id: templateId,
      companyId,
      organizationId: companyId,
      locationId,
      title: sanitizeString(task.title, 220),
      description: sanitizeString(task.description, 500),
      category: sanitizeString(task.category, 80),
      frequency: task.frequency || "daily",
      frequencyType: task.frequency || "daily",
      frequencyDays: task.frequency === "weekly" ? 7 : task.frequency === "monthly" ? 30 : 1,
      registrationFrequency: task.frequency || "daily",
      registrationFrequencyType: task.frequency || "daily",
      registrationFrequencyDays: task.frequency === "weekly" ? 7 : task.frequency === "monthly" ? 30 : 1,
      riskLevel: sanitizeString(task.riskLevel, 40) || "medium",
      controlPoint: sanitizeString(task.controlPoint, 180),
      formType: sanitizeString(task.formType, 40) || "checklist",
      fields: buildProvisionedTemplateFields(task.formType, suppliers),
      alertRules: buildProvisionedTemplateAlertRules(task.formType, task.title, task.riskLevel),
      kcpNumber: task.kcpNumber,
      kcpId: sanitizeString(task.kcpId, 120),
      isVerification: task.isVerification === true,
      sourceHazard: sanitizeString(task.controlPoint, 180),
      sourceType: "kcp_comprehensive_haccp",
      haccpVersion: "2.0_comprehensive",
      active: true,
      isActive: true,
      createdBy: userId,
      createdByName: userEmail,
      updatedBy: userId,
      generatedAt: nowIso,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    
    // Add temperature limits if applicable
    if (tempLimits.minValue !== null && tempLimits.minValue !== undefined) {
      baseTemplate.minValue = tempLimits.minValue;
    }
    if (tempLimits.maxValue !== null && tempLimits.maxValue !== undefined) {
      baseTemplate.maxValue = tempLimits.maxValue;
    }
    if (tempLimits.unit) {
      baseTemplate.measurementUnit = tempLimits.unit;
    }
    if (tempLimits.target) {
      baseTemplate.measurementTarget = tempLimits.target;
    }
    if (tempLimits.timeLimit) {
      baseTemplate.timeLimit = tempLimits.timeLimit;
    }
    
    // Add instructions and guidance
    if (instructions) {
      baseTemplate.instructions = instructions;
    }
    if (criticalLimits) {
      baseTemplate.criticalLimitsText = criticalLimits;
    }
    if (correctiveActions) {
      baseTemplate.correctiveActionsText = correctiveActions;
    }
    
    // Add hazard information from KCP
    if (kcp && kcp.hazard) {
      baseTemplate.hazardInfo = kcp.hazard;
    }
    
    // Add regulatory reference
    if (kcp && kcp.regulatoryReference) {
      baseTemplate.regulatoryReference = kcp.regulatoryReference;
    }
    
    // Add specific guide content
    if (specificGuide) {
      if (specificGuide.guidePurpose) {
        baseTemplate.guidePurpose = specificGuide.guidePurpose;
      }
      if (specificGuide.guideExecutionTimes) {
        baseTemplate.guideExecutionTimes = specificGuide.guideExecutionTimes;
      }
      if (specificGuide.guideCriticalLimit) {
        baseTemplate.guideCriticalLimit = specificGuide.guideCriticalLimit;
      }
      if (specificGuide.guideAreas) {
        baseTemplate.guideAreas = specificGuide.guideAreas;
      }
      if (specificGuide.guideSteps) {
        baseTemplate.guideSteps = specificGuide.guideSteps;
      }
      if (specificGuide.guideWhatToRegister) {
        baseTemplate.guideWhatToRegister = specificGuide.guideWhatToRegister;
      }
      if (specificGuide.guideApproval) {
        baseTemplate.guideApproval = specificGuide.guideApproval;
      }
      if (specificGuide.guideDeviationCriteria) {
        baseTemplate.guideDeviationCriteria = specificGuide.guideDeviationCriteria;
      }
      if (specificGuide.guideIfNotOk) {
        baseTemplate.guideIfNotOk = specificGuide.guideIfNotOk;
      }
      if (specificGuide.guideShortTips) {
        baseTemplate.guideShortTips = specificGuide.guideShortTips;
      }
      baseTemplate.guideEnabled = true;
    }
    
    return baseTemplate;
  });
}

async function ensureLiveTaskTemplatesForProvisioning({ companyId, locationId, profile, riskModel, userId, userEmail }) {
  const templates = buildProvisionedTaskTemplates({
    companyId,
    locationId,
    profile,
    riskModel,
    userId,
    userEmail
  });

  if (!templates.length) {
    return { created: 0 };
  }

  await Promise.all(templates.map((template) => db.collection("task_templates").doc(template.id).set(template, { merge: true })));
  return { created: templates.length };
}

function getComparableEpoch(item = {}) {
  const epoch = Number(item?.createdAtEpochMs || item?.updatedAtEpochMs || 0);
  if (Number.isFinite(epoch) && epoch > 0) return epoch;

  const iso = sanitizeString(item?.createdAtIso || item?.updatedAtIso || "", 80);
  if (iso) {
    const parsed = new Date(iso).getTime();
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const timestamp = item?.createdAt || item?.updatedAt;
  if (timestamp && typeof timestamp.toDate === "function") {
    const parsed = timestamp.toDate().getTime();
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 0;
}

async function loadLatestScopedRiskSource({ companyId, locationId }) {
  const variants = [
    { companyField: "companyId", companyValue: companyId, locationValue: locationId },
    { companyField: "organizationId", companyValue: companyId, locationValue: locationId },
    { companyField: "companyId", companyValue: toLegacyId(companyId), locationValue: toLegacyId(locationId) },
    { companyField: "organizationId", companyValue: toLegacyId(companyId), locationValue: toLegacyId(locationId) }
  ];

  for (const variant of variants) {
    const normalizedCompanyValue = sanitizeString(variant.companyValue, 120);
    const normalizedLocationValue = sanitizeString(variant.locationValue, 120);
    if (!normalizedCompanyValue || !normalizedLocationValue) continue;

    for (const collectionName of ["live_user_profiles", "haccp_snapshots"]) {
      try {
        const snapshot = await db
          .collection(collectionName)
          .where(variant.companyField, "==", normalizedCompanyValue)
          .where("locationId", "==", normalizedLocationValue)
          .limit(20)
          .get();

        if (!snapshot.empty) {
          const docs = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
            .sort((a, b) => getComparableEpoch(b) - getComparableEpoch(a));

          const latest = docs[0] || null;
          if (latest) {
            return {
              sourceCollection: collectionName,
              payload: latest
            };
          }
        }
      } catch (error) {
        console.warn(`Kunne ikke hente ${collectionName} for ${variant.companyField}:`, error);
      }
    }
  }

  return null;
}

exports.syncRiskTaskTemplates = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind for at synkronisere task-skabeloner.");
  }

  const uid = sanitizeString(auth.uid, 160);
  const email = sanitizeString(auth.token?.email || "", 160).toLowerCase();
  const userData = await getUserAccessProfile({ uid, email });

  if (!userData) {
    throw new functions.https.HttpsError("permission-denied", "Brugerprofil blev ikke fundet.");
  }

  const requestedCompanyId = sanitizeString(data?.companyId, 120);
  const requestedLocationId = sanitizeString(data?.locationId, 120);

  const companyId = requestedCompanyId || sanitizeString(userData.companyId || userData.organizationId, 120);
  const locationIds = getUserLocationIds(userData);
  const locationId = requestedLocationId || locationIds[0] || sanitizeString(userData.primaryLocationId || userData.locationId, 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("failed-precondition", "companyId eller locationId mangler.");
  }

  await assertLexiCustomerAccess({ uid, email, companyId, locationId });

  const riskSource = await loadLatestScopedRiskSource({ companyId, locationId });
  if (!riskSource?.payload) {
    throw new functions.https.HttpsError("not-found", "Ingen live risikoanalyse fundet for denne lokation.");
  }

  const payload = riskSource.payload || {};
  const profile = sanitizeOnboardingProfile(payload.profile || {
    companyName: payload.companyName,
    companyType: payload.companyType,
    cvr: payload.cvr,
    address: payload.address
  });
  const riskModel = sanitizeRiskModelInput(payload.riskModel || payload.generated || {});

  // Generate scenario-based HACCP analysis
  const scenarioHaccp = generateScenarioBasedHaccp({
    profile: profile,
    companyType: profile.companyType
  });

  // Save comprehensive HACCP snapshot to haccp_snapshots collection
  const snapshotId = toDocSafeId(`${companyId}__${locationId}__${Date.now()}`);
  await db.collection("haccp_snapshots").doc(snapshotId).set({
    companyId,
    organizationId: companyId,
    locationId,
    profile,
    riskModel,
    // Scenario-based data structures
    scenarios: scenarioHaccp.scenarios || [],
    processes: scenarioHaccp.processes || [],
    hazards: scenarioHaccp.hazards || [],
    controlMeasures: scenarioHaccp.controlMeasures || [],
    criticalLimits: scenarioHaccp.criticalLimits || [],
    monitoringProcedures: scenarioHaccp.monitoringProcedures || [],
    correctiveActions: scenarioHaccp.correctiveActions || [],
    verificationTasks: scenarioHaccp.verificationTasks || [],
    documentationRequirements: scenarioHaccp.documentationRequirements || [],
    taskTemplates: scenarioHaccp.taskTemplates || [],
    // Backward compatible KCPs
    kcps: scenarioHaccp.kcps || [],
    // Metadata
    version: scenarioHaccp.version || "3.0_scenario_based",
    summary: scenarioHaccp.summary || {},
    generatedAt: scenarioHaccp.generatedAt || new Date().toISOString(),
    generatedBy: uid,
    generatedByEmail: email,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  const summary = await ensureLiveTaskTemplatesForProvisioning({
    companyId,
    locationId,
    profile,
    riskModel,
    userId: uid,
    userEmail: email
  });

  return {
    ok: true,
    companyId,
    locationId,
    sourceCollection: riskSource.sourceCollection,
    snapshotId,
    taskTemplateCount: Number(summary?.created || 0),
    scenarioCount: scenarioHaccp.scenarios?.length || 0,
    processCount: scenarioHaccp.processes?.length || 0,
    hazardCount: scenarioHaccp.hazards?.length || 0,
    controlMeasureCount: scenarioHaccp.controlMeasures?.length || 0,
    ccpCount: scenarioHaccp.summary?.totalCCPs || 0,
    cpCount: scenarioHaccp.summary?.totalCPs || 0
  };
});

async function getLexiCustomerStatusPayload({ companyId, locationId }) {
  const todayKey = getDateKey();
  const operatingMode = await getOperatingModeForLocation({
    companyId,
    locationId,
    todayKey
  });

  const [templateDocs] = await Promise.all([
    loadActiveTaskTemplates({ companyId, locationId })
  ]);

  const routineChecks = await Promise.all(templateDocs.map(async (doc) => {
    const template = doc.data() || {};
    const taskId = sanitizeString(template.taskId, 120);

    try {
      const lastCompletedDateKey = taskId
        ? await getLastCompleted(taskId, locationId)
        : null;
      const dueToday = isDueToday(template, todayKey, lastCompletedDateKey);
      return { dueToday };
    } catch (error) {
      console.error(`Kunne ikke beregne rutine for template ${doc.id}:`, error);
      return { dueToday: true };
    }
  }));

  const totalActive = routineChecks.length;
  const dueToday = routineChecks.filter((routine) => routine.dueToday).length;
  const status = resolveLexiStatus({ operatingMode, totalActive, dueToday });

  return {
    source: "madkontrol",
    companyId,
    locationId,
    dateKey: todayKey,
    operatingMode,
    status,
    antal_rutiner: totalActive,
    antal_forfaldne_rutiner: dueToday
  };
}

exports.getLexiCustomerStatus = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Du skal vaere logget ind for at hente kundestatus."
    );
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "companyId og locationId er paakraevet."
    );
  }

  await assertLexiCustomerAccess({
    uid: auth.uid,
    email: auth.token?.email || "",
    companyId,
    locationId
  });

  return {
    ok: true,
    ...(await getLexiCustomerStatusPayload({ companyId, locationId }))
  };
});

//
// 🔹 FREKVENS LOGIK
//
function isDueToday(template, todayKey, lastCompletedDateKey, prefix = "frequency") {
  const config = parseFrequencyConfig(template, prefix);
  const type = config.type;
  const days = config.days;
  const startDate = template.startDate || todayKey;

  if (todayKey < startDate) return false;

  if (type === "daily") return true;

  if (type === "weekdays") {
    const weekday = getWeekdayFromDateKey(todayKey);
    return weekday !== 0 && weekday !== 6;
  }

  if (type === "weekends") {
    const weekday = getWeekdayFromDateKey(todayKey);
    return weekday === 0 || weekday === 6;
  }

  if (type === "interval_days") {
    if (!lastCompletedDateKey) {
      return true;
    }

    const nextDue = addDays(lastCompletedDateKey, days);
    return todayKey >= nextDue;
  }

  return true;
}

function buildTaskDeadlineMeta(template, todayKey) {
  const execution = parseFrequencyConfig(template, "frequency");
  const registration = parseFrequencyConfig(template, "registrationFrequency");
  const cadenceDays = Math.max(execution.days || 1, registration.days || 1);
  const usesInterval = execution.type === "interval_days" || registration.type === "interval_days";

  if (!usesInterval || cadenceDays < 7) {
    return {
      deadlineAt: "",
      overduePolicy: "",
      overdueExplanationRequired: false
    };
  }

  return {
    deadlineAt: `${todayKey}T12:00:00`,
    overduePolicy: "midday_due",
    overdueExplanationRequired: true
  };
}

//
// 🔹 HENT SENESTE FULDFØRTE
//
async function getLastCompleted(taskId, locationId) {
  if (!taskId || !locationId) return null;

  const snap = await db
    .collection("task_entries")
    .where("taskId", "==", taskId)
    .where("locationId", "==", locationId)
    .get();

  if (snap.empty) return null;

  let latest = null;
  for (const doc of snap.docs) {
    const dateKey = normalizeDateKey(doc.data()?.dateKey);
    if (!dateKey) continue;
    if (!latest || dateKey > latest) {
      latest = dateKey;
    }
  }

  return latest;
}

function sanitizeEquipmentType(value) {
  return sanitizeString(value, 80).toLowerCase();
}

function getEquipmentDisplayName(item, fallbackLabel) {
  const explicit = sanitizeString(
    item?.displayName || item?.name || item?.equipmentName || fallbackLabel,
    140
  );
  return explicit || fallbackLabel;
}

function prettyEquipmentTypeName(type) {
  const map = {
    fridge: "Køleskab",
    freezer: "Fryser",
    dishwasher: "Opvaskemaskine",
    warming_cabinet: "Varmeskab",
    blast_chiller: "Blast chiller",
    display_fridge: "Displaykøl"
  };
  const normalized = sanitizeEquipmentType(type);
  return map[normalized] || normalized || "Maskine";
}

function buildSyntheticEquipmentFromCounts(counts = {}) {
  const equipment = [];

  for (const [rawType, rawCount] of Object.entries(counts || {})) {
    const type = sanitizeEquipmentType(rawType);
    if (!type) continue;

    const count = toPositiveInt(rawCount);
    if (count <= 0) continue;

    for (let i = 1; i <= count; i++) {
      const label = `${prettyEquipmentTypeName(type)} ${i}`;
      equipment.push({
        id: `onboarding_${type}_${i}`,
        type,
        name: label,
        displayName: label
      });
    }
  }

  return equipment;
}

function buildStartDayTargets({ template, equipmentByType, allEquipment, areas }) {
  // Simplified: Always return single target per template to avoid creating too many instances
  // Equipment-specific details can be added in comments/notes when completing the task
  return [{ suffix: "default" }];
}

function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

async function getOnboardingEquipmentCounts({ companyId, locationId }) {
  const byLocation = await db
    .collection("onboarding_answers")
    .where("locationId", "==", locationId)
    .limit(1)
    .get();

  let data = byLocation.empty ? null : (byLocation.docs[0].data() || {});

  if (!data) {
    const byCompanyAndLocation = await db
      .collection("onboarding_answers")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .limit(1)
      .get();

    data = byCompanyAndLocation.empty ? null : (byCompanyAndLocation.docs[0].data() || {});
  }

  const counts = data?.equipmentCounts || {};

  return {
    rawCounts: counts,
    fridges:
      toPositiveInt(counts.fridge) ||
      toPositiveInt(counts.fridges) ||
      toPositiveInt(counts.koleskab) ||
      toPositiveInt(counts.koleskabe) ||
      toPositiveInt(counts.køleskab) ||
      toPositiveInt(counts.køleskabe),
    freezers:
      toPositiveInt(counts.freezer) ||
      toPositiveInt(counts.freezers) ||
      toPositiveInt(counts.fryser) ||
      toPositiveInt(counts.frysere)
  };
}

//
// 🔹 START DAG (VIGTIG)
//
exports.startDayForLocation = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Du skal vaere logget ind for at starte dagen."
    );
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "companyId og locationId er paakraevet."
    );
  }

  await assertStartDayAccess({
    uid: auth.uid,
    email: auth.token?.email || "",
    companyId,
    locationId
  });

  const todayKey = getDateKey();
  const forceRefresh = data?.forceRefresh === true;
  const runId = `${companyId}__${locationId}__${todayKey}`;

  const runRef = db.collection("daily_runs").doc(runId);
  const runSnap = await runRef.get();

  if (runSnap.exists && !forceRefresh) {
    return {
      alreadyStarted: true,
      message: "Dagen er allerede startet"
    };
  }

  const operatingMode = await getOperatingModeForLocation({
    companyId,
    locationId,
    todayKey
  });

  if (operatingMode === "closed") {
    return {
      ok: false,
      blocked: true,
      message: "Lokationen er lukket. Automatiske rutiner er sat på pause for i dag."
    };
  }

  if (operatingMode === "vacation") {
    return {
      ok: false,
      blocked: true,
      message: "Lokationen er i ferie-mode. Automatiske rutiner er sat på pause for i dag."
    };
  }

  // 🔹 hent templates (kun operational - ikke verification)
  const allTemplateDocs = await loadActiveTaskTemplates({ companyId, locationId });
  const templateDocs = allTemplateDocs.filter(doc => {
    const template = doc.data();
    const templateType = template.templateType || "operational";
    const id = doc.id || "";
    
    // 🚫 Fjern gamle auto templates
    if (id.includes("auto_task")) return false;
    
    // 🚫 Fjern gamle KCP templates (ikke aggregerede)
    if (id.includes("kcp_") && !template.isAggregated) return false;
    
    // 🚫 Ekstra sikkerhed: fjern hvis title indikerer gammel struktur
    const title = (template.title || "").toLowerCase();
    if (title.includes("kcp") && !template.isAggregated) return false;
    
    return templateType === "operational";
  });
  
  console.log("Templates total:", allTemplateDocs.length);
  console.log("Templates after filter:", templateDocs.length);
  templateDocs.forEach(doc => {
    const t = doc.data();
    console.log("USED:", doc.id, t.title, t.templateType);
  });

  const [equipmentSnap, areasSnap] = await Promise.all([
    db.collection("equipment")
      .where("locationId", "==", locationId)
      .get(),
    db.collection("areas")
      .where("locationId", "==", locationId)
      .get()
  ]);

  const equipmentByType = {
    fridge: [],
    freezer: []
  };
  const allEquipment = [];

  for (const equipmentDoc of equipmentSnap.docs) {
    const equipment = equipmentDoc.data() || {};
    const type = sanitizeEquipmentType(equipment.type || equipment.equipmentType);
    const normalized = {
      id: equipmentDoc.id,
      type,
      name: sanitizeString(equipment.name || equipment.displayName || equipment.equipmentName, 140),
      displayName: sanitizeString(equipment.displayName || equipment.name || equipment.equipmentName, 140)
    };

    if (type.includes("fridge") || type.includes("koleskab") || type.includes("køleskab")) {
      equipmentByType.fridge.push(normalized);
    }

    if (type.includes("freezer") || type.includes("fryser")) {
      equipmentByType.freezer.push(normalized);
    }

    allEquipment.push(normalized);
  }

  // Fallback: brug onboarding counts hvis equipment docs ikke er oprettet endnu.
  if (allEquipment.length === 0 || equipmentByType.fridge.length === 0 || equipmentByType.freezer.length === 0) {
    try {
      const counts = await getOnboardingEquipmentCounts({ companyId, locationId });

      const syntheticEquipment = buildSyntheticEquipmentFromCounts(counts.rawCounts || {});
      for (const equipment of syntheticEquipment) {
        const alreadyExists = allEquipment.some((item) => item.id === equipment.id);
        if (alreadyExists) continue;
        allEquipment.push(equipment);
      }

      if (equipmentByType.fridge.length === 0 && counts.fridges > 0) {
        equipmentByType.fridge = allEquipment.filter((item) => item.type.includes("fridge") || item.type.includes("koleskab") || item.type.includes("køleskab"));
      }

      if (equipmentByType.freezer.length === 0 && counts.freezers > 0) {
        equipmentByType.freezer = allEquipment.filter((item) => item.type.includes("freezer") || item.type.includes("fryser"));
      }
    } catch (error) {
      console.warn("Kunne ikke læse equipmentCounts fra onboarding_answers:", error);
    }
  }

  const areas = areasSnap.docs.map((areaDoc) => {
    const area = areaDoc.data() || {};
    return {
      id: areaDoc.id,
      name: sanitizeString(area.name, 140),
      areaType: sanitizeString(area.areaType, 80)
    };
  });

  const batch = db.batch();
  let createdCount = 0;
  let updatedCount = 0;
  let ensuredCount = 0;
  const existingTaskMap = await getExistingTaskInstanceMap({ companyId, locationId, todayKey });

  for (const doc of templateDocs) {
    const template = doc.data();
    const baseTaskId = sanitizeString(
      template.taskId || template.id || doc.id,
      120
    ) || doc.id;

    const targets = buildStartDayTargets({
      template,
      equipmentByType,
      allEquipment,
      areas
    });

    for (const target of targets) {
      const baseTitle = sanitizeString(template.title, 220) || "Rutine";
      const scopedTitle = target.equipmentName
        ? `${baseTitle} - ${target.equipmentName}`
        : baseTitle;

      const scopedTaskId = target.suffix && target.suffix !== "default"
        ? `${baseTaskId}__${target.suffix}`
        : baseTaskId;

      const lastCompleted = await getLastCompleted(scopedTaskId, locationId);
      const due = isDueToday(template, todayKey, lastCompleted, "frequency");
      if (!due) continue;

      const registrationDue = isDueToday(template, todayKey, lastCompleted, "registrationFrequency");
      const deadlineMeta = buildTaskDeadlineMeta(template, todayKey);

      const formType = sanitizeString(template.formType, 60).toLowerCase();
      const templateRequiresMeasurement = template.requiresMeasurement === true || formType === "temperature";
      const requiresMeasurementToday = templateRequiresMeasurement && registrationDue;

      const equipmentId = target.equipmentId || template.equipmentId || "";
      const uniqueKey = equipmentId ? `${scopedTaskId}__${equipmentId}` : scopedTaskId;
      const existing = existingTaskMap.get(uniqueKey) || null;
      const ref = existing?.ref || db.collection("task_instances").doc();
      const existingData = existing?.data || {};
      const existingStatus = sanitizeString(existingData.status, 40) || "pending";
      const isCompleted = ["completed", "failed", "not_in_use"].includes(existingStatus);

      batch.set(ref, {
        ...template,
        companyId,
        organizationId: companyId,
        locationId,
        taskId: scopedTaskId,
        title: scopedTitle,
        templateId: doc.id,
        dateKey: todayKey,
        status: "pending",
        equipmentId: target.equipmentId || template.equipmentId || "",
        equipmentType: target.equipmentType || template.equipmentType || "",
        equipmentName: target.equipmentName || template.equipmentName || "",
        areaId: target.areaId || template.areaId || "",
        areaType: target.areaType || template.areaType || "",
        requiresMeasurement: requiresMeasurementToday,
        requiresRegistration: registrationDue,
        registrationDeferred: !registrationDue,
        deadlineAt: deadlineMeta.deadlineAt,
        overduePolicy: deadlineMeta.overduePolicy,
        overdueExplanationRequired: deadlineMeta.overdueExplanationRequired,
        status: isCompleted ? existingStatus : "pending",
        completedAt: isCompleted ? existingData.completedAt || null : null,
        completedBy: isCompleted ? existingData.completedBy || "" : "",
        completedByName: isCompleted ? existingData.completedByName || "" : "",
        createdAt: existingData.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      if (existing) {
        updatedCount++;
      } else {
        createdCount++;
      }
      ensuredCount++;
    }
  }

  // 🔹 gem daily run
  batch.set(runRef, {
    companyId,
    organizationId: companyId,
    locationId,
    dateKey: todayKey,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    taskCount: ensuredCount
  }, { merge: true });

  await batch.commit();

  return {
    ok: true,
    created: createdCount,
    updated: updatedCount,
    message: runSnap.exists
      ? `Dagens kort er opdateret (${createdCount} nye, ${updatedCount} opdateret).`
      : `Oprettet ${createdCount} opgaver`
  };
});

exports.saveRoutineTask = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vaere logget ind for at gemme en rutine.");
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const taskInstanceId = sanitizeString(data?.taskInstanceId || "", 120);
  
  logger.info("saveRoutineTask called", {
    userId: auth.uid,
    companyId,
    locationId,
    taskInstanceId
  });
  const taskIdHint = sanitizeString(data?.taskId || "", 120);
  const taskDateKeyHint = sanitizeString(data?.taskDateKey || "", 40);
  const actionType = sanitizeString(data?.actionType || "save", 60);

  if (!companyId || !locationId || !taskInstanceId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId, locationId og taskInstanceId er paakraevet.");
  }

  await assertStartDayAccess({
    uid: auth.uid,
    email: auth.token?.email || "",
    companyId,
    locationId
  });

  let taskRef = db.collection("task_instances").doc(taskInstanceId);
  let taskSnap = await taskRef.get();

  if (!taskSnap.exists && taskIdHint) {
    let fallbackQuery = db
      .collection("task_instances")
      .where("locationId", "==", locationId)
      .where("taskId", "==", taskIdHint);

    if (taskDateKeyHint) {
      fallbackQuery = fallbackQuery.where("dateKey", "==", taskDateKeyHint);
    }

    const fallbackSnap = await fallbackQuery.limit(10).get();
    for (const doc of fallbackSnap.docs) {
      const candidate = doc.data() || {};
      const candidateOrgId = sanitizeString(candidate.companyId || candidate.organizationId, 120);
      if (!candidateOrgId || candidateOrgId === companyId) {
        taskRef = doc.ref;
        taskSnap = doc;
        break;
      }
    }
  }

  if (!taskSnap.exists) {
    logger.warn("Task instance not found", {
      userId: auth.uid,
      companyId,
      locationId,
      taskInstanceId
    });
    throw new functions.https.HttpsError("not-found", "Rutinen blev ikke fundet.");
  }

  const task = taskSnap.data() || {};
  const taskOrgId = sanitizeString(task.companyId || task.organizationId, 120);
  const taskLocationId = sanitizeString(task.locationId || "", 120);

  if (taskOrgId !== companyId || taskLocationId !== locationId) {
    throw new functions.https.HttpsError("permission-denied", "Rutinen tilhoerer ikke denne lokation.");
  }

  const entryData = data?.entryData || {};
  const result = data?.result || {};
  const completedBy = sanitizeString(data?.completedBy || auth.uid, 120) || auth.uid;
  const completedByName = sanitizeString(data?.completedByName || auth.token?.name || auth.token?.email || auth.uid, 140);
  const note = sanitizeString(entryData.note || "", 2000);
  const aiBeskrivelse = sanitizeString(entryData.beskrivelse || entryData.aiDescription || "", 4000);
  const aiSource = sanitizeString(entryData.ai_source || "", 80);
  const aiCategory = sanitizeString(entryData.ai_category || "", 80);
  const aiHandlingUdfort =
    entryData.handling_udfort === true ||
    entryData.handlingUdfort === true;
  const hasAiHandlingFlag =
    typeof entryData.handling_udfort === "boolean" ||
    typeof entryData.handlingUdfort === "boolean";
  const aiConfidenceRaw = entryData.ai_confidence;
  const aiConfidenceValue =
    aiConfidenceRaw === null || aiConfidenceRaw === undefined || aiConfidenceRaw === ""
      ? null
      : Number(aiConfidenceRaw);
  const aiConfidence = Number.isFinite(aiConfidenceValue)
    ? Math.max(0, Math.min(1, aiConfidenceValue))
    : null;
  const contextMachineName = sanitizeString(result?.contextMachineName || "", 140);
  const contextAreaName = sanitizeString(result?.contextAreaName || "", 140);
  const contextAreaType = sanitizeString(result?.contextAreaType || "", 80);
  const contextSpecificLabel = sanitizeString(result?.contextSpecificLabel || "", 220);
  const measurementUnit = sanitizeString(entryData.measurementUnit || "", 20);
  const valueLabel = sanitizeString(entryData.valueLabel || "", 120);
  const entryType = sanitizeString(entryData.entryType || "check", 40);
  const instanceStatus = sanitizeString(result.instanceStatus || "completed", 40) || "completed";
  const entryStatus = sanitizeString(result.entryStatus || instanceStatus, 40) || instanceStatus;
  const deadlineAt = sanitizeString(data?.deadlineAt || task.deadlineAt || "", 80);
  const completedLate = data?.completedLate === true;
  const overdueLogged = data?.overdueLogged === true;

  let measurementValue = null;
  if (entryData.measurementValue !== null && entryData.measurementValue !== undefined && entryData.measurementValue !== "") {
    measurementValue = Number(entryData.measurementValue);
    if (!Number.isFinite(measurementValue)) {
      throw new functions.https.HttpsError("invalid-argument", "Maalevaerdi er ugyldig.");
    }
  }

  if (actionType === "save" && task.status === "overdue" && !note) {
    throw new functions.https.HttpsError("invalid-argument", "Forklaring er paakraevet, fordi rutinen er gaaet over tid.");
  }

  const todayKey = getDateKey();
  const resolvedTaskInstanceId = taskRef.id;

  const autoDocumentationNote = (() => {
    if (note) return note;
    const scope = contextSpecificLabel || contextMachineName || contextAreaName || sanitizeString(task.equipmentName || task.title || "Rutine", 220);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const timeLabel = `${hh}:${mm}`;

    if (actionType === "save") {
      if (measurementValue !== null && measurementValue !== undefined) {
        return `${scope} udført kl. ${timeLabel}. Måling registreret: ${measurementValue}${measurementUnit || ""}.`;
      }
      return `${scope} udført kl. ${timeLabel}. Område/maskine kontrolleret og dokumenteret.`;
    }

    return "";
  })();

  const entryPayload = {
    taskInstanceId: resolvedTaskInstanceId,
    taskId: sanitizeString(task.taskId || "", 120),
    companyId,
    organizationId: companyId,
    unitId: sanitizeString(data?.unitId || task.unitId || "", 120),
    locationId,
    taskTitle: sanitizeString(task.title || "", 220),
    taskType: sanitizeString(task.type || task.category || "", 80),
    equipmentId: sanitizeString(task.equipmentId || "", 120),
    equipmentName: sanitizeString(task.equipmentName || "", 140),
    equipmentType: sanitizeString(task.equipmentType || "", 80),
    entryType,
    measurementValue,
    measurementUnit,
    valueLabel,
    status: entryStatus,
    note: autoDocumentationNote,
    beskrivelse: aiBeskrivelse || autoDocumentationNote,
    handling_udfort: hasAiHandlingFlag ? aiHandlingUdfort : actionType === "save",
    deadlineAt,
    completedLate,
    overdueLogged,
    dateKey: todayKey,
    completedBy,
    completedByName,
    completedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    actionType
  };

  if (aiSource) entryPayload.aiSource = aiSource;
  if (aiCategory) entryPayload.aiCategory = aiCategory;
  if (aiConfidence !== null) entryPayload.aiConfidence = aiConfidence;

  const entryRiskId = Array.isArray(task.linkedRiskIds) && task.linkedRiskIds.length
    ? sanitizeString(task.linkedRiskIds[0], 120)
    : sanitizeString(task.sourceRiskAnalysisId || task.sourceHazard || "", 120);
  const sourceRiskAnalysisId = sanitizeString(task.sourceRiskAnalysisId || "", 120);
  const sourceHazard = sanitizeString(task.sourceHazard || "", 220);

  if (contextMachineName) entryPayload.machineName = contextMachineName;
  if (contextAreaName) entryPayload.areaName = contextAreaName;
  if (contextAreaType) entryPayload.areaType = contextAreaType;
  if (contextSpecificLabel) entryPayload.specificLabel = contextSpecificLabel;
  if (entryRiskId) entryPayload.riskId = entryRiskId;
  if (sourceRiskAnalysisId) entryPayload.sourceRiskAnalysisId = sourceRiskAnalysisId;
  if (sourceHazard) entryPayload.sourceHazard = sourceHazard;

  const entryRef = await db.collection("task_entries").add(entryPayload);
  
  logger.info("Task entry created", {
    userId: auth.uid,
    companyId,
    locationId,
    taskInstanceId,
    entryId: entryRef.id,
    status: entryStatus
  });

  const instanceUpdate = {
    status: instanceStatus,
    completedAt: FieldValue.serverTimestamp(),
    completedBy,
    completedByName,
    completedLate,
    overdueResolvedAt: completedLate ? FieldValue.serverTimestamp() : null,
    updatedAt: FieldValue.serverTimestamp()
  };

  await taskRef.set(instanceUpdate, { merge: true });

  if (result?.shouldCreateAlert === true) {
    const alertTitle = sanitizeString(result.alertTitle || "", 220);
    const alertType = sanitizeString(result.alertType || "task_failure", 80) || "task_failure";
    const alertDescription = sanitizeString(result.alertDescription || "", 500);

    let exists = false;
    const existingAlerts = await db
      .collection("alerts")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .where("sourceTaskInstanceId", "==", resolvedTaskInstanceId)
      .where("dateKey", "==", todayKey)
      .where("status", "==", "open")
      .get();

    if (!existingAlerts.empty) {
      exists = existingAlerts.docs.some((doc) => sanitizeString(doc.data()?.title || "", 220) === alertTitle);
    }

    if (!exists) {
      await db.collection("alerts").add({
        companyId,
        organizationId: companyId,
        unitId: sanitizeString(data?.unitId || task.unitId || "", 120),
        locationId,
        alertType,
        severity: sanitizeString(task.alertSeverityOnFailure || "medium", 40) || "medium",
        status: "open",
        title: alertTitle,
        description: alertDescription,
        equipmentId: sanitizeString(task.equipmentId || "", 120),
        equipmentName: sanitizeString(task.equipmentName || "", 140),
        equipmentType: sanitizeString(task.equipmentType || "", 80),
        riskId: Array.isArray(task.linkedRiskIds) && task.linkedRiskIds.length
          ? sanitizeString(task.linkedRiskIds[0], 120)
          : "",
        sourceTaskId: sanitizeString(task.taskId || "", 120),
        sourceTaskInstanceId: resolvedTaskInstanceId,
        sourceType: "task_entry",
        sourceId: entryRef.id,
        dateKey: todayKey,
        assignedTo: completedByName,
        requiresAction: true,
        machineName: contextMachineName || sanitizeString(task.machineName || task.equipmentName || "", 140) || null,
        areaName: contextAreaName || sanitizeString(task.areaName || task.equipmentName || "", 140) || null,
        areaType: contextAreaType || sanitizeString(task.areaType || task.equipmentType || "", 80) || null,
        specificLabel: contextSpecificLabel || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  }

  return {
    ok: true,
    entryId: entryRef.id
  };
}); // Added closing brace here

exports.getDashboardSnapshot = functions.https.onCall(async (request) => {
  // Firebase Functions v2: auth is in request.auth, data is in request.data
  const data = request.data;
  const auth = request.auth;
  
  console.log("DEBUG getDashboardSnapshot - request.auth:", auth ? {
    uid: auth.uid,
    email: auth.token?.email
  } : "NULL");
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vaere logget ind for at hente dashboard-data.");
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const dateKey = sanitizeString(data?.dateKey || getDateKey(), 40) || getDateKey();

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
  }

  await assertStartDayAccess({
    uid: auth.uid,
    email: auth.token?.email || "",
    companyId,
    locationId
  });

  const [operatingOverride, tasks, alertCount, haccpSnapshot] = await Promise.all([
    getOperatingOverrideDataForLocation({ companyId, locationId }),
    loadDashboardTaskInstances({ companyId, locationId, dateKey }),
    loadDashboardAlertCount({ companyId, locationId, dateKey }),
    loadLatestHaccpSnapshot({ companyId })
  ]);

  return {
    ok: true,
    dateKey,
    operatingOverride,
    tasks,
    alertCount,
    haccpSnapshot
  };
});

exports.seedDemoData = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vaere logget ind for at oprette demo-data.");
  }

  // CRITICAL: Block seed demo in production
  guardDangerousOperation(context, "seedDemoData");

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
  }

  await assertAdminAccess({
    uid: context.auth.uid,
    email: context.auth.token?.email || "",
    companyId,
    locationId
  });

  const dateKey = getDateKey();
  const nowIso = new Date().toISOString();

  const demoTasks = [
    {
      taskId: "demo_fridge_temperature_1",
      title: "Køleskab 1 temperatur",
      description: "Mål temperatur i køleskab 1 og udfyld målefelt.",
      type: "measurement",
      measurementUnit: "°C",
      minValue: 0,
      maxValue: 5,
      equipmentType: "fridge",
      equipmentName: "Køleskab 1"
    },
    {
      taskId: "demo_fridge_temperature_2",
      title: "Køleskab 2 temperatur",
      description: "Mål temperatur i køleskab 2 og udfyld målefelt.",
      type: "measurement",
      measurementUnit: "°C",
      minValue: 0,
      maxValue: 5,
      equipmentType: "fridge",
      equipmentName: "Køleskab 2"
    },
    {
      taskId: "demo_freezer_temperature_1",
      title: "Fryser 1 temperatur",
      description: "Mål temperatur i fryser 1 og udfyld målefelt.",
      type: "measurement",
      measurementUnit: "°C",
      minValue: -30,
      maxValue: -18,
      equipmentType: "freezer",
      equipmentName: "Fryser 1"
    },
    {
      taskId: "demo_cleaning_surface",
      title: "Rengøring af arbejdsflader",
      description: "Kontroller at arbejdsflader er rengjort og kryds af.",
      type: "check",
      equipmentType: "cleaning",
      equipmentName: "Arbejdsflader"
    },
    {
      taskId: "demo_allergen_separation",
      title: "Adskillelse af allergener",
      description: "Bekræft adskillelse mellem allergenvarer og øvrige varer.",
      type: "check",
      equipmentType: "storage",
      equipmentName: "Tørvarelager"
    },
    {
      taskId: "demo_receiving_check",
      title: "Varemodtagelse kontrol",
      description: "Kontroller emballage, temperatur og datomærkning.",
      type: "check",
      equipmentType: "receiving",
      equipmentName: "Varemodtagelse"
    },
    {
      taskId: "demo_softice_cleaning",
      title: "Softice-maskine rengøring",
      description: "Rengør softice-maskine inkl. tappetud, slanger, pakninger og drypbakke.",
      type: "check",
      equipmentType: "softice",
      equipmentName: "Softice-maskine",
      guideTitle: "Softice-maskine - rengøring af maskine og dele",
      guideIntro: "Maskinen skal adskilles og rengøres efter producentens procedure for at undgå bakterievækst.",
      guideAreas: [
        "Tappetud, pakninger, slanger, omrører og drypbakke",
        "Beholder og alle produktberørte kontaktflader",
        "Korrekt samling af alle dele efter rengøring"
      ],
      guideSteps: [
        "Stop drift, tøm produkt og adskil de dele der skal rengøres.",
        "Vask, skyl og desinficér delene efter godkendt rengøringsinstruks.",
        "Saml maskinen igen, kør test/skyl og registrér opgaven."
      ],
      guideApproval: [
        "Alle dele er synligt rene og korrekt monteret.",
        "Ingen rester af produkt eller rengøringsmiddel.",
        "Maskinen er klar til sikker drift."
      ],
      guideIfNotOk: [
        "Registrér afvigelse med hvilken del der ikke er ok.",
        "Gentag rengøring før maskinen tages i brug.",
        "Informer ansvarlig ved teknisk fejl eller manglende tæthed."
      ]
    },
    {
      taskId: "demo_oven_cleaning_and_temp",
      title: "Ovn rengøring og temperaturkontrol",
      description: "Rengør ovn og verificér at ovntemperatur er korrekt.",
      type: "measurement",
      measurementUnit: "°C",
      minValue: 160,
      maxValue: 260,
      equipmentType: "oven",
      equipmentName: "Kombiovn 1",
      guideTitle: "Ovn - rengøring og temperaturkontrol",
      guideIntro: "Ovnen skal være ren og holde den temperatur der er sat for sikker tilberedning.",
      guideAreas: [
        "Ovnrum, riste, plader, tætningslister og håndtag",
        "Temperaturvisning og evt. kernetermometer",
        "Luftcirkulation og ventilationsåbninger"
      ],
      guideSteps: [
        "Rengør ovnens indvendige flader og tilbehør.",
        "Forvarm ovnen og mål faktisk temperatur med kalibreret termometer.",
        "Indtast målingen og registrér kommentar ved afvigelse."
      ],
      guideApproval: [
        "Ovnen er fri for fastbrændte rester.",
        "Målt temperatur ligger inden for tilladt interval.",
        "Kontrollen er dokumenteret i systemet."
      ],
      guideIfNotOk: [
        "Opret afvigelse med målt temperatur og forventet værdi.",
        "Tag ovn ud af drift ved kritisk temperaturfejl.",
        "Bestil service/kalibrering."
      ]
    },
    {
      taskId: "demo_industrial_dishwasher_temp",
      title: "Industriopvaskemaskine temperaturkontrol",
      description: "Kontrollér vaske-/slutskylletemperatur og rengør filtre/dyser.",
      type: "measurement",
      measurementUnit: "°C",
      minValue: 60,
      maxValue: 90,
      equipmentType: "dishwasher",
      equipmentName: "Industriopvaskemaskine",
      guideTitle: "Industriopvaskemaskine - rengøring og temperatur",
      guideIntro: "Maskinen skal være ren, og temperaturer skal sikre hygiejnisk opvask.",
      guideAreas: [
        "Filtre, dyser, skyllearme og tank",
        "Sæbe-/afspændingsdosering",
        "Vaske- og slutskylletemperatur"
      ],
      guideSteps: [
        "Rengør filtre, dyser og tank efter daglig rutine.",
        "Kør testprogram og aflæs temperaturer.",
        "Registrér temperaturmåling og evt. afvigelse."
      ],
      guideApproval: [
        "Maskinen er rengjort uden madrester.",
        "Målt temperatur ligger inden for tilladt interval.",
        "Dokumentation er gemt."
      ],
      guideIfNotOk: [
        "Opret afvigelse med målte temperaturer.",
        "Stop brug ved kritisk afvigelse.",
        "Kontakt service ved gentagne fejl."
      ]
    }
  ];

  const batch = db.batch();
  let createdCount = 0;

  for (const item of demoTasks) {
    const docId = toDocSafeId(`demo__${companyId}__${locationId}__${dateKey}__${item.taskId}`);
    const ref = db.collection("task_instances").doc(docId);
    const snap = await ref.get();
    if (snap.exists) continue;

    batch.set(ref, {
      taskId: item.taskId,
      companyId,
      organizationId: companyId,
      locationId,
      unitId: "",
      title: item.title,
      description: item.description,
      category: "egenkontrol",
      dateKey,
      status: "pending",
      type: item.type,
      requiresMeasurement: item.type === "measurement",
      measurementUnit: item.measurementUnit || "",
      minValue: Number.isFinite(item.minValue) ? item.minValue : null,
      maxValue: Number.isFinite(item.maxValue) ? item.maxValue : null,
      equipmentId: item.taskId,
      equipmentName: item.equipmentName || "",
      equipmentType: item.equipmentType || "",
      guideEnabled: true,
      guideTitle: item.guideTitle || `${item.title} - demo guide`,
      guideIntro: item.guideIntro || "Dette er demo-data. Udfyld kun felter som en medarbejder normalt udfylder.",
      guideAreas: Array.isArray(item.guideAreas) ? item.guideAreas : [],
      guideSteps: Array.isArray(item.guideSteps) ? item.guideSteps : [
        "Læs opgaven",
        "Udfyld måling eller vælg udført",
        "Tilføj kommentar ved afvigelse"
      ],
      guideApproval: Array.isArray(item.guideApproval) ? item.guideApproval : [],
      guideIfNotOk: Array.isArray(item.guideIfNotOk) ? item.guideIfNotOk : [],
      frequency: "daily",
      frequencyType: "daily",
      registrationFrequency: "daily",
      registrationFrequencyType: "daily",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      demoSeed: true,
      demoSeedVersion: 1,
      demoSeededAtIso: nowIso
    }, { merge: true });

    createdCount++;
  }

  if (createdCount > 0) {
    await batch.commit();
  }

  return {
    ok: true,
    created: createdCount,
    dateKey
  };
});

exports.resetDemoData = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  

  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vaere logget ind.");
  }

  // CRITICAL: Block reset demo in production
  guardDangerousOperation(request, "resetDemoData");

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
  }

  await assertAdminAccess({
    uid: auth.uid,
    email: auth.token?.email || "",
    companyId,
    locationId
  });

  const snapshots = await Promise.all([
    db.collection("users").where("companyId", "==", companyId).limit(100).get(),
    db.collection("users").where("organizationId", "==", companyId).limit(100).get()
  ]);

  const usersById = new Map();
  snapshots.forEach((snap) => {
    snap.docs.forEach((docSnap) => {
      if (!usersById.has(docSnap.id)) {
        usersById.set(docSnap.id, docSnap.data() || {});
      }
    });
  });

  const users = [...usersById.entries()]
    .filter(([, userData]) => {
      const locationIds = getUserLocationIds(userData);
      if (!locationIds.length) return true;
      return locationIds.includes(locationId);
    })
    .map(([userId, userData]) => buildScopedUserResponse(userId, userData))
    .sort((left, right) => {
      const leftName = String(left.displayName || left.email || left.userId || "").toLowerCase();
      const rightName = String(right.displayName || right.email || right.userId || "").toLowerCase();
      return leftName.localeCompare(rightName, "da");
    });

  return { ok: true, users };
});

exports.resetTaskInstances = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vaere logget ind.");
  }

  // CRITICAL: Block reset task instances in production
  guardDangerousOperation(request, "resetTaskInstances");

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
  }

  await assertAdminAccess({
    uid: auth.uid,
    email: auth.token?.email || "",
    companyId,
    locationId
  });

  const [deletedTaskInstances, deletedDailyRuns] = await Promise.all([
    deleteScopedCollectionDocs({ collectionName: "task_instances", companyId, locationId }),
    deleteScopedCollectionDocs({ collectionName: "daily_runs", companyId, locationId })
  ]);

  return {
    ok: true,
    deleted: {
      task_instances: deletedTaskInstances,
      daily_runs: deletedDailyRuns
    },
    message: `Slettet ${deletedTaskInstances} task instances og ${deletedDailyRuns} daily runs`
  };
});

exports.createLocationUser = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vaere logget ind.");
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const displayName = sanitizeString(data?.displayName || "", 160);
  const email = sanitizeString(data?.email || "", 160).toLowerCase();
  const password = String(data?.password || "").trim();
  const employmentRole = normalizeEmploymentRole(data?.employmentRole || data?.role || "medarbejder");

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
  }

  if (!displayName) {
    throw new functions.https.HttpsError("invalid-argument", "Navn er paakraevet.");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new functions.https.HttpsError("invalid-argument", "Gyldig email er paakraevet.");
  }

  if (password.length < 8) {
    throw new functions.https.HttpsError("invalid-argument", "Midlertidigt password skal vaere mindst 8 tegn.");
  }

  await assertAdminAccess({
    uid: context.auth.uid,
    email: context.auth.token?.email || "",
    companyId,
    locationId
  });

  try {
    await admin.auth().getUserByEmail(email);
    throw new functions.https.HttpsError("already-exists", "Der findes allerede en bruger med den email.");
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    if (error?.code !== "auth/user-not-found") {
      console.error("Kunne ikke kontrollere eksisterende bruger:", error);
      throw new functions.https.HttpsError("internal", "Kunne ikke kontrollere email-adressen.");
    }
  }

  let createdUserRecord = null;

  try {
    createdUserRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: false,
      disabled: false
    });

    const userPayload = {
      userId: createdUserRecord.uid,
      displayName,
      email,
      role: "employee",
      employmentRole,
      companyId,
      organizationId: companyId,
      primaryLocationId: locationId,
      locationId,
      locationIds: [locationId],
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: context.auth.uid
    };

    await db.collection("users").doc(createdUserRecord.uid).set(userPayload, { merge: true });

    return {
      ok: true,
      user: buildScopedUserResponse(createdUserRecord.uid, userPayload)
    };
  } catch (error) {
    if (createdUserRecord?.uid) {
      try {
        await admin.auth().deleteUser(createdUserRecord.uid);
      } catch (cleanupError) {
        console.error("Kunne ikke rydde auth-bruger op efter fejl:", cleanupError);
      }
    }

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    const authCode = String(error?.code || "").toLowerCase();
    if (authCode.includes("email-already-exists")) {
      throw new functions.https.HttpsError("already-exists", "Der findes allerede en bruger med den email.");
    }

    console.error("Kunne ikke oprette lokationsbruger:", error);
    throw new functions.https.HttpsError("internal", "Kunne ikke oprette brugeren.");
  }
});

exports.createStripeCheckoutSession = functions.https.onCall(
  { secrets: ["FUNCTIONS_CONFIG_EXPORT"] },
  async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at oprette checkout.");
  }

  const stripe = getStripeClient();

  const addonKeys = sanitizeAddonKeys(data?.addonKeys);
  const origin = normalizeCheckoutOrigin(data?.origin);
  const companyId = String(data?.companyId || "").trim();
  const locationId = String(data?.locationId || "").trim();
  const generatorConfigId = sanitizeString(data?.generatorConfigId || "", 180);
  const successPath = sanitizeRelativePath(data?.successPath, "/modules/business/vision.html?checkout=success&session_id={CHECKOUT_SESSION_ID}");
  const cancelPath = sanitizeRelativePath(data?.cancelPath, "/modules/business/vision.html?checkout=cancel");

  const config = FUNCTIONS_CONFIG.value() || {};
  const stripePriceCore = sanitizeString(config?.stripe?.price_core || process.env.STRIPE_PRICE_CORE || "", 180);

  const coreLineItem = stripePriceCore
    ? { quantity: 1, price: stripePriceCore }
    : {
      quantity: 1,
      price_data: {
        currency: "dkk",
        unit_amount: 199900,
        recurring: { interval: "month" },
        product_data: {
          name: "Madkontrollen Core"
        }
      }
    };

  const lineItems = [
    coreLineItem,
    ...addonKeys.map((key) => {
      const addon = ADDON_CATALOG[key];
      const dynamicPriceKey = `price_${key.replace(/-/g, "_")}`;
      const configuredPriceId = sanitizeString(
        process.env[`STRIPE_${dynamicPriceKey.toUpperCase()}`] || "",
        180
      );

      if (configuredPriceId) {
        return {
          quantity: 1,
          price: configuredPriceId
        };
      }

      return {
        quantity: 1,
        price_data: {
          currency: "dkk",
          unit_amount: addon.amount,
          recurring: { interval: "month" },
          product_data: {
            name: addon.name
          }
        }
      };
    })
  ];

  const successUrl = `${origin}${successPath}`;
  const cancelUrl = `${origin}${cancelPath}`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      source: "vision_page",
      uid: context.auth.uid,
      companyId,
      locationId,
      addons: addonKeys.join(","),
      generatorConfigId
    }
  });

  await db.collection("checkout_sessions").add({
    provider: "stripe",
    mode: "subscription",
    status: "created",
    source: "vision_page",
    uid: context.auth.uid,
    companyId,
    locationId,
    addonKeys,
    generatorConfigId,
    stripeSessionId: session.id,
    stripeUrl: session.url || "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return {
    ok: true,
    sessionId: session.id,
    url: session.url
  };
});

exports.createOnboardingCheckoutSession = functions.https.onCall(
  { secrets: ["FUNCTIONS_CONFIG_EXPORT"] },
  async (request, context) => {
  const data = request.data || request;

  console.log("=== BACKEND DEBUG START ===");
  console.log("Received data type:", typeof data);
  console.log("Received data keys:", data ? Object.keys(data) : "null");
  console.log("data.profile exists?", data?.profile ? "YES" : "NO");
  console.log("data.profile.companyName:", data?.profile?.companyName);
  console.log("=== BACKEND DEBUG END ===");

  const stripe = getStripeClient();
  const authUid = sanitizeString(context.auth?.uid || "", 160);
  const authEmail = sanitizeString(context.auth?.token?.email || "", 160);
  const profile = sanitizeOnboardingProfile(data?.profile || {});
  const requestedCompanyId = sanitizeString(data?.companyId || "", 120);
  const requestedLocationId = sanitizeString(data?.locationId || "", 120);
  const companyId = requestedCompanyId || toDocSafeId(`onboarding_${profile.companyName || Date.now()}`).slice(0, 120);
  const locationId = requestedLocationId || toDocSafeId(`${companyId}__main`).slice(0, 120);
  const origin = normalizeCheckoutOrigin(data?.origin);
  const successPath = sanitizeRelativePath(
    data?.successPath,
    "/tak?checkout=success&session_id={CHECKOUT_SESSION_ID}"
  );
  const cancelPath = sanitizeRelativePath(
    data?.cancelPath,
    "/modules/egenkontrol/onboarding.html?checkout=cancel"
  );

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
  }

  if (authUid && requestedCompanyId && requestedLocationId) {
    await assertSeoGeneratorAccess({
      uid: authUid,
      email: authEmail,
      companyId,
      locationId
    });
  }

  const riskModel = sanitizeRiskModelInput(data?.riskModel || {});
  const cloudinaryAssets = extractCloudinaryAssets(
    data?.cloudinaryAssets,
    data?.profile?.cloudinaryAssets,
    data?.profile?.attachments,
    data?.profile?.images
  );
  const onboardingEmail = sanitizeString(data?.profile?.accountEmail || data?.email || "", 160);
  const provisioningToken = toDocSafeId(`${Date.now()}_${Math.random().toString(36).slice(2)}_${companyId}_${locationId}`).slice(0, 180);

  if (!profile.companyName) {
    console.error("BACKEND ERROR: companyName missing. Received profile:", JSON.stringify(data?.profile || {}));
    console.error("BACKEND ERROR: Sanitized profile.companyName:", profile.companyName);
    throw new functions.https.HttpsError(
      "invalid-argument", 
      `Virksomhedsnavn mangler. Modtaget: '${data?.profile?.companyName}', Saniteret: '${profile.companyName}'`
    );
  }

  const userData = authUid
    ? (await getUserAccessProfile({ uid: authUid, email: authEmail }) || {})
    : {};
  const customerName = deriveCustomerName({
    profile,
    userData,
    email: authEmail || onboardingEmail
  });
  const summary = buildOnboardingSummary({
    profile,
    riskModel,
    customerName
  });

  const draftRef = await db.collection("onboarding_checkout_drafts").add({
    uid: authUid || "",
    userEmail: authEmail || onboardingEmail,
    onboardingEmail,
    provisioningToken,
    companyId,
    organizationId: companyId,
    locationId,
    profile,
    riskModel,
    summary,
    cloudinaryAssets,
    source: "onboarding_checkout",
    status: "awaiting_payment",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  const stripePriceCore = sanitizeString(process.env.STRIPE_PRICE_CORE || "", 180);
  const lineItems = stripePriceCore
    ? [{ quantity: 1, price: stripePriceCore }]
    : [{
      quantity: 1,
      price_data: {
        currency: "dkk",
        unit_amount: 18625,
        recurring: { interval: "month" },
        product_data: {
          name: "Madkontrollen Kernen (149 DKK + 25% moms)"
        }
      }
    }];

  const successUrl = `${origin}${successPath}${successPath.includes("?") ? "&" : "?"}draftId=${encodeURIComponent(draftRef.id)}`;
  const successUrlWithToken = `${successUrl}&provisioning_token=${encodeURIComponent(provisioningToken)}`;
  const cancelUrl = `${origin}${cancelPath}${cancelPath.includes("?") ? "&" : "?"}draftId=${encodeURIComponent(draftRef.id)}&provisioning_token=${encodeURIComponent(provisioningToken)}`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: lineItems,
    success_url: successUrlWithToken,
    cancel_url: cancelUrl,
    metadata: {
      source: "onboarding_checkout",
      uid: authUid || "guest",
      companyId,
      locationId,
      draftId: draftRef.id,
      provisioningToken,
      onboardingEmail
    }
  });

  await draftRef.set({
    stripeSessionId: session.id,
    stripeUrl: session.url || "",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await db.collection("checkout_sessions").add({
    provider: "stripe",
    mode: "subscription",
    status: "created",
    source: "onboarding_checkout",
    uid: authUid || "",
    companyId,
    locationId,
    addonKeys: [],
    onboardingDraftId: draftRef.id,
    stripeSessionId: session.id,
    stripeUrl: session.url || "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return {
    ok: true,
    draftId: draftRef.id,
    sessionId: session.id,
    url: session.url,
    provisioningToken,
    summary
  };
});

exports.checkSubdomainAvailability = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at tjekke subdomaene.");
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const rawSubdomain = sanitizeString(data?.subdomain || "", 160);
  const subdomain = toAsciiSlug(rawSubdomain, 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
  }

  await assertSeoGeneratorAccess({
    uid: context.auth.uid,
    email: context.auth.token?.email || "",
    companyId,
    locationId
  });

  if (!subdomain || subdomain.length < 3) {
    return {
      ok: true,
      subdomain,
      available: false,
      reason: "for_short"
    };
  }

  const snap = await db.collection("websites").where("subdomain", "==", subdomain).limit(1).get();
  if (snap.empty) {
    return { ok: true, subdomain, available: true };
  }

  const existing = snap.docs[0].data() || {};
  const sameLocation =
    sanitizeString(existing.organizationId || existing.companyId, 120) === companyId &&
    sanitizeString(existing.locationId || "", 120) === locationId;

  return {
    ok: true,
    subdomain,
    available: sameLocation,
    reason: sameLocation ? "owned_by_current_location" : "taken"
  };
});

exports.saveSeoGeneratorConfig = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at gemme generator-data.");
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const config = data?.config || {};

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
  }

  await assertSeoGeneratorAccess({
    uid: context.auth.uid,
    email: context.auth.token?.email || "",
    companyId,
    locationId
  });

  const configDocId = sanitizeString(data?.configId || "", 180) || toDocSafeId(`${companyId}__${locationId}__${Date.now()}`);
  const subdomain = toAsciiSlug(config?.subdomain || config?.businessName || "restaurant", 120) || "restaurant";

  const payload = {
    companyId,
    organizationId: companyId,
    locationId,
    businessName: sanitizeString(config?.businessName || "", 140),
    subdomain,
    city: sanitizeString(config?.city || "", 80),
    cuisineType: sanitizeString(config?.cuisineType || "", 80),
    offerings: sanitizeString(config?.offerings || "", 240),
    keyword: sanitizeString(config?.keyword || "", 140),
    phone: sanitizeString(config?.phone || "", 80),
    address: sanitizeString(config?.address || "", 220),
    description: sanitizeString(config?.description || "", 1200),
    selectedTemplate: sanitizeString(config?.selectedTemplate || "classic", 80),
    pageCount: parsePageCount(config?.pageCount, 50),
    logoPosition: sanitizeString(config?.logoPosition || "card", 40),
    logoDataUrl: sanitizeString(config?.logoDataUrl || "", 500000),
    seoNarrative: sanitizeString(config?.seoNarrative || "", 2000),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: context.auth.uid,
    updatedByEmail: sanitizeString(context.auth.token?.email || "", 160)
  };

  await db.collection("seo_generator_configs").doc(configDocId).set({
    ...payload,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: context.auth.uid
  }, { merge: true });

  return {
    ok: true,
    configId: configDocId,
    subdomain
  };
});

exports.finalizeSeoCheckoutProvisioning = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at aktivere SEO-modulet.");
  }

  const stripe = getStripeClient();
  const sessionId = sanitizeString(data?.sessionId || "", 220);
  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const configId = sanitizeString(data?.configId || "", 180);

  if (!sessionId || !companyId || !locationId || !configId) {
    throw new functions.https.HttpsError("invalid-argument", "sessionId, companyId, locationId og configId er paakraevet.");
  }

  await assertAdminAccess({
    uid: context.auth.uid,
    email: context.auth.token?.email || "",
    companyId,
    locationId
  });

  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
  const status = sanitizeString(checkoutSession?.status || "", 40).toLowerCase();
  const paymentStatus = sanitizeString(checkoutSession?.payment_status || "", 40).toLowerCase();
  const addonKeys = sanitizeAddonKeys(
    String(checkoutSession?.metadata?.addons || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  if (!addonKeys.includes("seo")) {
    throw new functions.https.HttpsError("failed-precondition", "Checkout-session indeholder ikke SEO-modulet.");
  }

  const isPaid = status === "complete" && (paymentStatus === "paid" || paymentStatus === "no_payment_required");
  if (!isPaid) {
    throw new functions.https.HttpsError("failed-precondition", "Checkout er ikke gennemfoert endnu.");
  }

  const configSnap = await db.collection("seo_generator_configs").doc(configId).get();
  if (!configSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Generator-konfiguration blev ikke fundet.");
  }

  const config = configSnap.data() || {};
  if (
    sanitizeString(config.companyId || config.organizationId, 120) !== companyId ||
    sanitizeString(config.locationId || "", 120) !== locationId
  ) {
    throw new functions.https.HttpsError("permission-denied", "Konfigurationen tilhoerer ikke valgt company/location.");
  }

  const result = await upsertWebsiteAndSeoPages({
    companyId,
    locationId,
    config,
    activatedByUid: context.auth.uid
  });

  const matchingCheckoutSessions = await db
    .collection("checkout_sessions")
    .where("stripeSessionId", "==", sessionId)
    .limit(5)
    .get();

  if (!matchingCheckoutSessions.empty) {
    const batch = db.batch();
    matchingCheckoutSessions.docs.forEach((docSnap) => {
      batch.set(docSnap.ref, {
        status: "completed",
        addonKeys,
        generatorConfigId: configId,
        seoProvisioned: true,
        seoWebsiteId: result.websiteId,
        seoGeneratedPages: result.generatedPages,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
  }

  await db.collection("seo_generator_configs").doc(configId).set({
    seoModuleActive: true,
    seoWebsiteId: result.websiteId,
    seoGeneratedPages: result.generatedPages,
    seoProvisionedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return {
    ok: true,
    websiteId: result.websiteId,
    generatedPages: result.generatedPages,
    subdomain: result.subdomain
  };
});

exports.createHaccpSnapshotFromOnboarding = functions.https.onCall(async (data, context) => {
  const userId = context.auth?.uid || "signup_anonymous";
  const companyId = sanitizeString(data?.companyId || "", 120) || "signup_unassigned";
  const locationId = sanitizeString(data?.locationId || "", 120) || "signup_unassigned";

  return {
    ok: true,
    ...(await createHaccpSnapshotDocument({
      profile: data?.profile || {},
      riskModel: data?.riskModel || {},
      companyId,
      locationId,
      userId
    }))
  };
});

exports.finalizeOnboardingCheckoutProvisioning = functions.https.onCall(
  { secrets: ["FUNCTIONS_CONFIG_EXPORT"] },
  async (request, context) => {
  // Firebase Functions v2 callable wraps payload in request.data
  const data = request.data || request;
  const stripe = getStripeClient();
  const authUid = sanitizeString(context.auth?.uid || "", 160);
  const authEmail = sanitizeString(context.auth?.token?.email || "", 160);
  const sessionId = sanitizeString(data?.sessionId || "", 220);
  const requestedDraftId = sanitizeString(data?.draftId || "", 180);
  const requestedProvisioningToken = sanitizeString(data?.provisioningToken || "", 220);

  if (!sessionId) {
    throw new functions.https.HttpsError("invalid-argument", "sessionId er påkrævet.");
  }

  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
  const sessionStatus = sanitizeString(checkoutSession?.status || "", 40).toLowerCase();
  const paymentStatus = sanitizeString(checkoutSession?.payment_status || "", 40).toLowerCase();
  const metadataDraftId = sanitizeString(checkoutSession?.metadata?.draftId || "", 180);
  const draftId = requestedDraftId || metadataDraftId;
  const companyId = sanitizeString(checkoutSession?.metadata?.companyId || data?.companyId || "", 120);
  const locationId = sanitizeString(checkoutSession?.metadata?.locationId || data?.locationId || "", 120);
  const metadataProvisioningToken = sanitizeString(checkoutSession?.metadata?.provisioningToken || "", 220);
  const source = sanitizeString(checkoutSession?.metadata?.source || "", 80);

  if (source !== "onboarding_checkout") {
    throw new functions.https.HttpsError("failed-precondition", "Checkout-session tilhører ikke onboarding-flowet.");
  }

  if (!draftId || !companyId || !locationId) {
    throw new functions.https.HttpsError("failed-precondition", "Checkout-session mangler draft/company/location metadata.");
  }

  const isPaid = sessionStatus === "complete" && (paymentStatus === "paid" || paymentStatus === "no_payment_required");
  if (!isPaid) {
    throw new functions.https.HttpsError("failed-precondition", "Betalingen er ikke gennemført endnu.");
  }

  const draftRef = db.collection("onboarding_checkout_drafts").doc(draftId);
  const draftSnap = await draftRef.get();
  if (!draftSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Onboarding-draft blev ikke fundet.");
  }

  const draft = draftSnap.data() || {};
  if (sanitizeString(draft.companyId || draft.organizationId, 120) !== companyId || sanitizeString(draft.locationId, 120) !== locationId) {
    throw new functions.https.HttpsError("permission-denied", "Draft tilhører ikke valgt company/location.");
  }

  const effectiveProvisioningToken = requestedProvisioningToken || metadataProvisioningToken;
  const draftProvisioningToken = sanitizeString(draft.provisioningToken || "", 220);
  const tokenMatches = Boolean(effectiveProvisioningToken && draftProvisioningToken && effectiveProvisioningToken === draftProvisioningToken);
  const sameAuthOwner = Boolean(authUid && sanitizeString(draft.uid || "", 160) === authUid);

  if (!tokenMatches && !sameAuthOwner) {
    throw new functions.https.HttpsError("permission-denied", "Ugyldig eller manglende provisioning-token.");
  }

  const actorUserId = authUid || sanitizeString(draft.uid || "", 160) || `checkout_guest_${draftId}`;
  const actorEmail = authEmail || sanitizeString(draft.userEmail || draft.onboardingEmail || "", 160);

  const existingSnapshotId = sanitizeString(draft.snapshotId, 180);
  const existingLiveProfileId = sanitizeString(draft.liveProfileId, 180);
  if (existingSnapshotId && existingLiveProfileId) {
    return {
      ok: true,
      alreadyProvisioned: true,
      draftId,
      snapshotId: existingSnapshotId,
      liveProfileId: existingLiveProfileId,
      summary: draft.summary || {}
    };
  }

  const userData = authUid
    ? (await getUserAccessProfile({ uid: authUid, email: authEmail }) || {})
    : {};
  const profile = sanitizeOnboardingProfile(draft.profile || {});
  const riskModel = sanitizeRiskModelInput(draft.riskModel || {});
  const customerName = deriveCustomerName({
    profile,
    userData,
    email: actorEmail
  });
  const summary = buildOnboardingSummary({
    profile,
    riskModel,
    customerName
  });
  const cloudinaryAssets = extractCloudinaryAssets(
    draft.cloudinaryAssets,
    draft.profile?.cloudinaryAssets,
    draft.profile?.attachments,
    draft.profile?.images
  );

  const liveProfileId = toDocSafeId(`${companyId}__${locationId}__live_profile`);
  const liveProfilePayload = buildLiveUserProfilePayload({
    profile,
    riskModel,
    companyId,
    locationId,
    userId: actorUserId,
    userEmail: actorEmail,
    summary,
    cloudinaryAssets,
    draftId,
    checkoutSessionId: sessionId
  });

  const { snapshotId } = await createHaccpSnapshotDocument({
    profile,
    riskModel,
    companyId,
    locationId,
    userId: actorUserId
  });

  const onboardingAnswersId = await upsertOnboardingAnswersDocument({
    companyId,
    locationId,
    userId: actorUserId,
    liveProfilePayload
  });

  await db.collection("live_user_profiles").doc(liveProfileId).set({
    ...liveProfilePayload,
    haccpSnapshotId: snapshotId,
    onboardingAnswersId,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const taskTemplateSummary = await ensureLiveTaskTemplatesForProvisioning({
    companyId,
    locationId,
    profile,
    riskModel,
    userId: actorUserId,
    userEmail: actorEmail
  });

  let finalUserId = authUid;

  // If user is not logged in, create a new Firebase Auth user and Firestore user document
  if (!authUid && profile.accountEmail && profile.accountPassword) {
    const email = sanitizeString(profile.accountEmail, 160).toLowerCase();
    const password = String(profile.accountPassword || "").trim();
    const displayName = sanitizeString(profile.ownerName || profile.companyName || "Ejer", 120);

    if (email && password.length >= 8) {
      try {
        // Check if user already exists
        let userRecord = null;
        try {
          userRecord = await admin.auth().getUserByEmail(email);
        } catch (error) {
          if (error?.code === "auth/user-not-found") {
            // Create new Firebase Auth user
            userRecord = await admin.auth().createUser({
              email,
              password,
              displayName,
              emailVerified: false,
              disabled: false
            });

            console.log(`Created new Firebase Auth user: ${userRecord.uid} (${email})`);
          } else {
            throw error;
          }
        }

        if (userRecord) {
          finalUserId = userRecord.uid;

          // Create or update Firestore users document
          await db.collection("users").doc(userRecord.uid).set({
            userId: userRecord.uid,
            displayName,
            email,
            role: "owner",
            companyId,
            organizationId: companyId,
            primaryLocationId: locationId,
            locationId,
            locationIds: [locationId],
            latestLiveProfileId: liveProfileId,
            latestHaccpSnapshotId: snapshotId,
            onboardingStatus: "completed",
            onboardingCompletedAt: FieldValue.serverTimestamp(),
            latestCloudinaryAssets: cloudinaryAssets,
            status: "active",
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });

          console.log(`Created Firestore user document for: ${userRecord.uid}`);
        }
      } catch (error) {
        console.error("Failed to create user account during onboarding provisioning:", error);
        // Don't throw - continue with provisioning even if user creation fails
      }
    }
  } else if (authUid) {
    // User is already logged in - update their existing document
    const userRef = db.collection("users").doc(authUid);
    const userSnap = await userRef.get();
    const existingUserData = userSnap.exists ? (userSnap.data() || {}) : {};
    const nextLocationIds = buildPreferredLocationIds(existingUserData, locationId);

    await db.collection("users").doc(authUid).set({
      companyId,
      organizationId: companyId,
      email: actorEmail,
      primaryLocationId: locationId,
      locationId,
      locationIds: nextLocationIds,
      latestLiveProfileId: liveProfileId,
      latestHaccpSnapshotId: snapshotId,
      onboardingStatus: "completed",
      onboardingCompletedAt: FieldValue.serverTimestamp(),
      latestCloudinaryAssets: cloudinaryAssets,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  await draftRef.set({
    summary,
    cloudinaryAssets,
    liveProfileId,
    onboardingAnswersId,
    snapshotId,
    stripeSessionId: sessionId,
    status: "completed",
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const matchingCheckoutSessions = await db
    .collection("checkout_sessions")
    .where("stripeSessionId", "==", sessionId)
    .limit(5)
    .get();

  if (!matchingCheckoutSessions.empty) {
    const batch = db.batch();
    matchingCheckoutSessions.docs.forEach((docSnap) => {
      batch.set(docSnap.ref, {
        status: "completed",
        onboardingProvisioned: true,
        onboardingDraftId: draftId,
        liveProfileId,
        onboardingAnswersId,
        haccpSnapshotId: snapshotId,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
  }

  return {
    ok: true,
    draftId,
    companyId,
    locationId,
    snapshotId,
    liveProfileId,
    onboardingAnswersId,
    taskTemplateCount: taskTemplateSummary.created,
    dashboardUrl: "/dashboard#haccp-print-section",
    summary
  };
});

exports.getCloudinarySignature = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at uploade billeder.");
  }

  const crypto = require("crypto");

  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME ||
    "";
  const apiKey =
    process.env.CLOUDINARY_API_KEY ||
    "";
  const apiSecret =
    process.env.CLOUDINARY_API_SECRET ||
    "";

  if (!cloudName || !apiKey || !apiSecret) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Cloudinary er ikke konfigureret. Kontakt administrator."
    );
  }

  const cleanMetaValue = (value, maxLen = 160) => String(value || "")
    .trim()
    .replace(/[|=\\]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, maxLen);

  const companyId = sanitizeString(data?.companyId || "", 120) || "unknown";
  const locationId = sanitizeString(data?.locationId || "", 120) || "unknown";
  const moduleType = cleanMetaValue(data?.moduleType || "Egenkontrol", 60) || "Egenkontrol";
  const itemId = cleanMetaValue(data?.itemId || "Dokumentation", 140) || "Dokumentation";
  const taskInstanceId = sanitizeString(data?.taskInstanceId || "", 140);
  const taskId = sanitizeString(data?.taskId || "", 140);
  const userId = context.auth.uid;

  const folder = `madkontrol/${companyId}/${locationId}/${toAsciiSlug(moduleType || "module", 40) || "module"}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${toAsciiSlug(userId, 60) || "user"}-${Date.now()}`;

  const tags = [
    `user_${toAsciiSlug(userId, 60) || "unknown"}`,
    `module_${toAsciiSlug(moduleType, 40) || "unknown"}`,
    `item_${toAsciiSlug(itemId, 80) || "unknown"}`,
    `company_${toAsciiSlug(companyId, 60) || "unknown"}`,
    `location_${toAsciiSlug(locationId, 60) || "unknown"}`
  ].join(",");

  const contextPairs = [
    `user_id=${cleanMetaValue(userId, 120)}`,
    `module_type=${cleanMetaValue(moduleType, 80)}`,
    `item_id=${cleanMetaValue(itemId, 160)}`,
    `company_id=${cleanMetaValue(companyId, 120)}`,
    `location_id=${cleanMetaValue(locationId, 120)}`,
    `task_instance_id=${cleanMetaValue(taskInstanceId, 140)}`,
    `task_id=${cleanMetaValue(taskId, 140)}`
  ].filter((pair) => !pair.endsWith("="));

  const contextValue = contextPairs.join("|");

  // Signature: alphabetically sorted params joined with &, then append api_secret, SHA1
  const paramsToSign = [
    `context=${contextValue}`,
    `folder=${folder}`,
    `public_id=${publicId}`,
    `tags=${tags}`,
    `timestamp=${timestamp}`
  ].join("&");
  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + apiSecret)
    .digest("hex");

  return {
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder,
    publicId,
    tags,
    context: contextValue,
    moduleType,
    itemId,
    userId
  };
});

function extractJsonBlock(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_error) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (_errorInner) {
      return null;
    }
  }
}

function buildVisionPrompt({ moduleType, itemId, contextType, citizenProfile, taskTitle, autoRoute = false }) {
  const moduleLower = sanitizeString(moduleType || "egenkontrol", 80).toLowerCase();
  const contextLower = sanitizeString(contextType || "", 80).toLowerCase();

  const commonRules = [
    "Skriv kort, professionelt og juridisk egnet på dansk.",
    "Vurder kun det, der kan ses i billedet.",
    "Undgå gæt om usynlige forhold.",
    "Returner KUN gyldig JSON med de aftalte felter."
  ].join(" ");

  // AI-Router mode: Auto-categorize image type
  if (autoRoute) {
    return [
      "Du er en hygiejne-inspektør og revisor for et professionelt køkken-dokumentationssystem.",
      "Analysér dette optimerede billede med kritisk blik og identificér hvad det viser:",
      "1. FAKTURA/BILAG: Hvis du ser tekst med beløb, leverandørnavn, fakturanummer, eller regnskabsbilag → kategori: 'finance'",
      "   - Udtræk leverandør, totalbeløb, momsbeløb (25%), fakturadato.",
      "   - Vurder om teksten er læsbar til bogføring.",
      "2. EGENKONTROL (MASKINE/UDSTYR): Hvis du ser køkkenudstyr (ovn, køleskab, emhætte, opvaskemaskine) → kategori: 'egenkontrol'",
      "   - LED EFTER: Madrester, fedt, snavs, eller urenheder.",
      "   - Hvis det er et display: Udtræk temperatur med præcis værdi og enhed (f.eks. '+4°C' eller '-18°C').",
      "   - Hvis du finder fejl (synligt snavs, madrester, fedt, høj temperatur >+8°C eller lav temperatur >-15°C), skal dit svar STARTE med '[AFVIGELSE]'.",
      "   - Beskriv hvad du ser (f.eks. 'Ovn rengjort, ingen restprodukter' eller '[AFVIGELSE] Synlige madrester i hjørner, fedt på pakninger').",
      "3. MADANRETNING: Hvis du ser en tallerken med mad, dysfagi-kost, eller portion til borger → kategori: 'institution'",
      "   - Vurder konsistens, tekstur, dysfagi-egnethed.",
      "Vurder billedets KLARHED (image_clarity): 'clear' hvis alle detaljer er synlige, 'unclear' hvis uskarpt/mørkt/utydeligt.",
      commonRules,
      "Returner kategori baseret på hvad billedet FAKTISK viser, ikke hvad brugeren siger.",
      "Husk: Start beskrivelse med '[AFVIGELSE]' hvis du finder hygiejneproblemer eller temperaturafvigelser."
    ].join(" ");
  }

  // Specific module prompts (existing logic)
  if (moduleLower === "finance") {
    return [
      "Du analyserer et foto af et regnskabsbilag fra professionel foodservice-drift.",
      "Udtræk leverandørnavn, totalbeløb, momsbeløb og fakturadato, hvis synligt.",
      "Vurder om bilaget er læsbart til bogføring.",
      commonRules,
      "Brug kategori: finance."
    ].join(" ");
  }

  if (moduleLower === "institution" || contextLower === "institution") {
    const citizenInfo = sanitizeString(citizenProfile || "", 300);
    return [
      "Du analyserer et billede af en anretning i institutionskøkken.",
      "Vurder konsistens ift. dysfagi/blød kost, synlige klumper, tekstur og ensartethed.",
      citizenInfo ? `Borgerprofil: ${citizenInfo}.` : "Borgerprofil: Ikke angivet.",
      commonRules,
      "Brug kategori: institution."
    ].join(" ");
  }

  if (moduleLower === "commercial" || contextLower === "commercial") {
    return [
      "Du analyserer et rengørings- eller udstyrsfoto fra et kommercielt køkken.",
      "Vurder renhedsgrad for ovne, emhætter, kølediske og synlige filtre/tømning.",
      commonRules,
      "Brug kategori: commercial."
    ].join(" ");
  }

  const scopedItem = sanitizeString(itemId || taskTitle || "udstyr", 180);
  const scopedItemLower = scopedItem.toLowerCase();

  // SPECIFIC PROMPT FOR FLOOR DRAIN CLEANING
  if (scopedItemLower.includes("gulv") || scopedItemLower.includes("afløb") || scopedItemLower.includes("rist") || scopedItemLower.includes("drain") || scopedItemLower.includes("floor")) {
    return [
      "Du er en erfaren køkkenchef-mentor. Analysér dette billede af et gulvafløb eller en rist med FAGLIGT blik.",
      "Vær STRENG med hygiejne (madrester, organisk materiale), men REALISTISK med driftsslid (misfarvning i stål, slid på pakninger).",
      "Tjek SPECIFIKT for:",
      "1. ORGANISK MATERIALE: Er der synlige madrester, fedtslam eller snavs i risten eller under koppen?",
      "2. VANDLÅS: Er der vand i vandlåsen (for at undgå lugtgener)?",
      "3. RIST: Sidder risten korrekt på plads?",
      "Hvis du finder MADRESTER i afløbet:",
      "- Dit svar skal STARTE med '[AFVIGELSE]'",
      "- Forklar HVORFOR det er et problem: 'Madrester fundet i afløb. Dette tiltrækker skadedyr (rotter, kakerlakker) og skaber bakterievækst (Salmonella, E. coli). Skal fjernes straks.'",
      "- Sæt handling_udfort til false",
      "Hvis afløbet er RENT, men har misfarvning/patina:",
      "- Beskriv: 'Afløb rengjort. Ingen madrester. Misfarvning i stål er normalt driftsslid, ikke hygiejnerisiko. Rist korrekt placeret.'",
      "- Sæt handling_udfort til true",
      "Hvis afløbet er RENT:",
      "- Beskriv: 'Afløb rengjort. Ingen madrester. Rist korrekt placeret. Vandlås OK.'",
      "- Sæt handling_udfort til true",
      commonRules,
      "Brug kategori: egenkontrol.",
      "Husk: Forklar HVORFOR noget er et problem (risiko for skadedyr, bakterievækst), ikke bare 'beskidt'. Vær realistisk om normal slid vs. hygiejnerisiko."
    ].join(" ");
  }

  return [
    "Du er en erfaren køkkenchef-mentor. Analysér dette optimerede billede fra et professionelt køkken med FAGLIGT blik.",
    `Objekt/opgave: ${scopedItem}.`,
    "Vær STRENG med hygiejne (madrester, temperatur), men REALISTISK med driftsslid (misfarvning, slid på pakninger).",
    "LED EFTER: Madrester, fedt, snavs, urenheder, eller temperaturafvigelser.",
    "Hvis det er en maskine: Er den ren? Synlige madrester? Fedt på pakninger eller lister? Hvis du ser misfarvning i stål eller normal slid, forklar at det er acceptabelt driftsslid.",
    "Hvis det er et DISPLAY (temperatur): Find temperaturen på displayet. Returner tallet med fortegn i temperature_value (f.eks. '-18.5' eller '+4.0').",
    "Hvis det er et filter: Er det tømt? Synligt snavs?",
    "Hvis du finder HYGIEJNE-FEJL (madrester, fedt, temperaturafvigelser):",
    "- Dit svar skal STARTE med '[AFVIGELSE]'",
    "- Forklar HVORFOR det er et problem (f.eks. 'Madrester tiltrækker skadedyr', 'Temperatur >8°C giver bakterievækst', 'Fedt på pakninger skaber biofilm')",
    "- Vær SPECIFIK om risikoen, ikke bare 'beskidt'",
    "Hvis du ser NORMAL SLID (misfarvning, patina, slid på overflader):",
    "- Beskriv: 'Udstyr rengjort. Misfarvning/slid er normalt driftsslid, ikke hygiejnerisiko.'",
    "- Sæt handling_udfort til true",
    "Skriv en kort, formel bekræftelse på dansk til en egenkontrol-rapport.",
    commonRules,
    "Brug kategori: egenkontrol.",
    "Husk: Forklar HVORFOR problemer er farlige. Vær realistisk om forskellen på hygiejnerisiko vs. normal slid. Du er en læremester, ikke en politibetjent."
  ].join(" ");
}

exports.analyzeCloudinaryAsset = functions.https.onCall(
  { secrets: [OPENAI_API_KEY] },
  async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at analysere billeder.");
  }

  const imageUrl = sanitizeString(data?.imageUrl || "", 2000);
  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const moduleType = sanitizeString(data?.moduleType || "egenkontrol", 80);
  const itemId = sanitizeString(data?.itemId || "", 180);
  const contextType = sanitizeString(data?.contextType || "", 80);
  const taskTitle = sanitizeString(data?.taskTitle || "", 220);
  const citizenProfile = sanitizeString(data?.citizenProfile || "", 320);

  if (!imageUrl || !/^https:\/\//i.test(imageUrl)) {
    throw new functions.https.HttpsError("invalid-argument", "imageUrl mangler eller er ugyldig.");
  }

  if (companyId && locationId) {
    await assertStartDayAccess({
      uid: context.auth.uid,
      email: context.auth.token?.email || "",
      companyId,
      locationId
    });
  }

  const openAiApiKey =
    OPENAI_API_KEY.value() ||
    process.env.OPENAI_API_KEY ||
    "";

  if (!openAiApiKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Vision AI API-noegle mangler. Saet OPENAI_API_KEY som function secret."
    );
  }

  const modelName =
    sanitizeString(process.env.OPENAI_VISION_MODEL || "", 120) ||
    "gpt-4o-mini";

  const promptText = buildVisionPrompt({
    moduleType,
    itemId,
    contextType,
    citizenProfile,
    taskTitle,
    autoRoute: true
  });

  const jsonShape = [
    "Returner JSON med disse felter:",
    "handling_udfort: boolean",
    "beskrivelse: string",
    "confidence: number mellem 0 og 1",
    "kategori: string (finance, egenkontrol, eller institution)",
    "image_clarity: string ('clear' eller 'unclear')",
    "temperature_value: number|null (hvis display viser temperatur, returner tallet med fortegn, f.eks. -18.5 eller 4.0)",
    "has_fresh_fish: boolean (true hvis du ser fersk fisk på billedet)",
    "observationer: array af strings",
    "commercial: { cleanliness_score: number|null, filter_tomt: boolean|null }",
    "institution: { dysfagi_match: boolean|null, dysfagi_note: string }",
    "finance: { leverandor: string, total_belob: number|null, moms_belob: number|null, faktura_dato: string }",
    "risikoflag: array af strings"
  ].join("\n");

  let responseData;
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiApiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content: "Du er fødevaresikkerheds-assistent for egenkontrol og dokumentation. Lever kun validerbar, sober vurdering."
          },
          {
            role: "user",
            content: [
              { type: "text", text: `${promptText}\n\n${jsonShape}` },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ]
      })
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`Vision API fejl (${resp.status}): ${errorText}`);
    }

    responseData = await resp.json();
  } catch (error) {
    console.error("Vision API kald fejlede:", error);
    throw new functions.https.HttpsError("internal", "Kunne ikke gennemføre billedanalyse.");
  }

  const rawText = String(
    responseData?.choices?.[0]?.message?.content || ""
  ).trim();

  const parsed = extractJsonBlock(rawText) || {};

  const handlingUdfort = parsed?.handling_udfort === true;
  const beskrivelse = sanitizeString(
    parsed?.beskrivelse || "Billedet er analyseret automatisk. Verificér resultatet manuelt før godkendelse.",
    1800
  );
  const confidenceRaw = Number(parsed?.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : 0.55;

  // AI-Router: Extract image clarity and category
  const imageClarity = String(parsed?.image_clarity || "").toLowerCase();
  const aiCategory = sanitizeString(parsed?.kategori || "", 80).toLowerCase();
  const isUnclear = imageClarity === "unclear" || confidence < 0.4;
  
  // Determine routing based on AI analysis
  const detectedCategory = ["finance", "egenkontrol", "institution"].includes(aiCategory) 
    ? aiCategory 
    : "egenkontrol";

  const temperatureValue = Number.isFinite(Number(parsed?.temperature_value))
    ? Number(parsed.temperature_value)
    : null;
  const hasFreshFish = parsed?.has_fresh_fish === true;

  const result = {
    handling_udfort: handlingUdfort,
    beskrivelse,
    confidence,
    kategori: detectedCategory,
    image_clarity: imageClarity || (confidence >= 0.6 ? "clear" : "unclear"),
    is_unclear: isUnclear,
    routing_suggestion: detectedCategory,
    temperature_value: temperatureValue,
    has_fresh_fish: hasFreshFish,
    observationer: Array.isArray(parsed?.observationer)
      ? parsed.observationer.map((item) => sanitizeString(item, 220)).filter(Boolean).slice(0, 8)
      : [],
    commercial: {
      cleanliness_score: Number.isFinite(Number(parsed?.commercial?.cleanliness_score))
        ? Math.max(0, Math.min(100, Number(parsed.commercial.cleanliness_score)))
        : null,
      filter_tomt:
        typeof parsed?.commercial?.filter_tomt === "boolean"
          ? parsed.commercial.filter_tomt
          : null
    },
    institution: {
      dysfagi_match:
        typeof parsed?.institution?.dysfagi_match === "boolean"
          ? parsed.institution.dysfagi_match
          : null,
      dysfagi_note: sanitizeString(parsed?.institution?.dysfagi_note || "", 260)
    },
    finance: {
      leverandor: sanitizeString(parsed?.finance?.leverandor || "", 160),
      total_belob: Number.isFinite(Number(parsed?.finance?.total_belob))
        ? Number(parsed.finance.total_belob)
        : null,
      moms_belob: Number.isFinite(Number(parsed?.finance?.moms_belob))
        ? Number(parsed.finance.moms_belob)
        : null,
      faktura_dato: sanitizeString(parsed?.finance?.faktura_dato || "", 40)
    },
    risikoflag: Array.isArray(parsed?.risikoflag)
      ? parsed.risikoflag.map((item) => sanitizeString(item, 180)).filter(Boolean).slice(0, 6)
      : []
  };

  return {
    ok: true,
    model: modelName,
    result,
    routing: {
      suggested_module: detectedCategory,
      is_unclear: isUnclear,
      confidence,
      user_message: isUnclear 
        ? "Utydeligt billede – prøv igen for korrekt dokumentation"
        : `Billede kategoriseret som: ${detectedCategory === "finance" ? "Faktura/Regnskab" : detectedCategory === "institution" ? "Madanretning/Institution" : "Egenkontrol"}`
    }
  };
});

exports.getCloudinaryAssets = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at hente billeder.");
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || "";

  if (!cloudName || !apiKey || !apiSecret) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Cloudinary er ikke konfigureret. Kontakt administrator."
    );
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const userId = context.auth.uid;
  const maxResults = Math.min(Math.max(1, Number(data?.maxResults) || 500), 500);

  // Build Cloudinary Admin API URL to search for resources
  const crypto = require("crypto");
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Build search expression for user's images
  let expression = `tags=user_${toAsciiSlug(userId, 60)}`;
  
  if (companyId) {
    expression += ` AND tags=company_${toAsciiSlug(companyId, 60)}`;
  }
  
  if (locationId) {
    expression += ` AND tags=location_${toAsciiSlug(locationId, 60)}`;
  }

  // Create signature for Admin API
  const paramsToSign = `expression=${expression}&max_results=${maxResults}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(paramsToSign).digest("hex");

  // Call Cloudinary Admin API
  const searchUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/search`;
  const formData = new URLSearchParams();
  formData.append("expression", expression);
  formData.append("max_results", String(maxResults));
  formData.append("timestamp", String(timestamp));
  formData.append("api_key", apiKey);
  formData.append("signature", signature);

  try {
    const response = await fetch(searchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudinary API fejl (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const resources = result.resources || [];

    // Transform to our format
    const assets = resources.map((resource) => ({
      id: resource.asset_id || resource.public_id,
      publicId: resource.public_id,
      secureUrl: resource.secure_url,
      optimizedUrl: resource.secure_url?.replace("/upload/", "/upload/f_auto,q_auto/") || resource.secure_url,
      format: resource.format,
      width: resource.width,
      height: resource.height,
      bytes: resource.bytes,
      createdAt: resource.created_at,
      tags: resource.tags || [],
      context: resource.context?.custom || {},
      resourceType: resource.resource_type
    }));

    return {
      ok: true,
      total: result.total_count || assets.length,
      assets
    };
  } catch (error) {
    console.error("Cloudinary fetch fejl:", error);
    throw new functions.https.HttpsError(
      "internal",
      `Kunne ikke hente billeder fra Cloudinary: ${error.message}`
    );
  }
});

// Process Instance Management
exports.startCoolingProcess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { companyId, locationId, productName, batchSize, container, startTemperature } = data;

  if (!companyId || !locationId || !productName || startTemperature === undefined) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.startCoolingProcess({
      companyId,
      locationId,
      userId: context.auth.uid,
      productName,
      batchSize,
      container,
      startTemperature
    });
  } catch (error) {
    console.error("Start cooling process fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.addCoolingMeasurement = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { processId, temperature, note } = data;

  if (!processId || temperature === undefined) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.addCoolingMeasurement({
      processId,
      temperature,
      note,
      userId: context.auth.uid
    });
  } catch (error) {
    console.error("Add cooling measurement fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.completeCoolingProcess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { processId, endTemperature, note } = data;

  if (!processId || endTemperature === undefined) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.completeCoolingProcess({
      processId,
      endTemperature,
      note,
      userId: context.auth.uid
    });
  } catch (error) {
    console.error("Complete cooling process fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.startReheatingProcess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { companyId, locationId, failedCoolingProcessId } = data;

  if (!companyId || !locationId || !failedCoolingProcessId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.startReheatingProcess({
      companyId,
      locationId,
      userId: context.auth.uid,
      failedCoolingProcessId
    });
  } catch (error) {
    console.error("Start reheating process fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.completeReheatingProcess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { processId, endTemperature, note } = data;

  if (!processId || endTemperature === undefined) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.completeReheatingProcess({
      processId,
      endTemperature,
      note,
      userId: context.auth.uid
    });
  } catch (error) {
    console.error("Complete reheating process fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.disposeCoolingProcess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { processId, disposalReason } = data;

  if (!processId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.disposeCoolingProcess({
      processId,
      disposalReason,
      userId: context.auth.uid
    });
  } catch (error) {
    console.error("Dispose cooling process fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.startNewCoolingFromReheating = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { reheatingProcessId } = data;

  if (!reheatingProcessId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.startNewCoolingFromReheating({
      reheatingProcessId,
      userId: context.auth.uid
    });
  } catch (error) {
    console.error("Start new cooling from reheating fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.loadActiveProcessInstances = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { locationId } = data;

  if (!locationId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.loadActiveProcessInstances({ locationId });
  } catch (error) {
    console.error("Load active process instances fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// Demo Mode - DEVELOPER ONLY (not for production customers)
exports.enableDemoMode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  // CRITICAL: Demo mode is DEVELOPER ONLY
  guardDangerousOperation(context, "enableDemoMode");

  try {
    const userDoc = await db.collection("users").doc(context.auth.uid).get();
    const userData = userDoc.data();

    const result = await demoMode.enableDemoMode({
      userId: context.auth.uid,
      userData
    });

    return result;
  } catch (error) {
    console.error("Enable demo mode fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.disableDemoMode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  try {
    const userDoc = await db.collection("users").doc(context.auth.uid).get();
    const userData = userDoc.data();

    const result = await demoMode.disableDemoMode({
      userId: context.auth.uid,
      userData
    });

    return result;
  } catch (error) {
    console.error("Disable demo mode fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// Soft Archive - Safe alternative to hard delete
exports.startNewPeriod = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { companyId, locationId, periodName } = data;

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  // CRITICAL: Verify user owns this company/location
  const userDoc = await db.collection("users").doc(context.auth.uid).get();
  const userData = userDoc.data();

  if (!userData) {
    throw new functions.https.HttpsError("not-found", "Brugerprofil ikke fundet");
  }

  // Check company ownership
  const userCompanyId = userData.companyId || userData.organizationId;
  if (userCompanyId !== companyId) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Du kan kun starte ny periode for din egen virksomhed"
    );
  }

  // Check role - only owner or location_admin
  const userRole = String(userData.role || "").toLowerCase();
  if (userRole !== "owner" && userRole !== "location_admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Kun owner eller location_admin kan starte ny periode"
    );
  }

  // Check location access
  const userLocationIds = userData.locationIds || [];
  if (!userLocationIds.includes(locationId)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Du har ikke adgang til denne lokation"
    );
  }

  try {
    const result = await softArchive.startNewPeriod({
      companyId,
      locationId,
      periodName,
      startedBy: context.auth.uid
    });

    return result;
  } catch (error) {
    console.error("Start new period fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.archiveCompany = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  // CRITICAL: This is a dangerous operation - guard it
  guardDangerousOperation(context, "archiveCompany");

  const { companyId, reason } = data;

  if (!companyId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    const result = await softArchive.archiveCompany({
      companyId,
      reason,
      archivedBy: context.auth.uid
    });

    return result;
  } catch (error) {
    console.error("Archive company fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.restoreCompany = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  // CRITICAL: This is a dangerous operation - guard it
  guardDangerousOperation(context, "restoreCompany");

  const { companyId } = data;

  if (!companyId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    const result = await softArchive.restoreCompany({
      companyId,
      restoredBy: context.auth.uid
    });

    return result;
  } catch (error) {
    console.error("Restore company fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});
const egenkontrolGenerator = require("./egenkontrolGenerator");

exports.generateDailyTaskInstances = egenkontrolGenerator.generateDailyTaskInstances;
exports.generateTaskInstancesNow = egenkontrolGenerator.generateTaskInstancesNow;
```
