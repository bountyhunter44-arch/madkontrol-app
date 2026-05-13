// SLET FRA HER
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const { defineJsonSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

// ✅ KUN ÉN INITIALISERING
if (!admin.apps.length) {
  admin.initializeApp();
}

// IMPORTS EFTER INIT
const { generateComprehensiveHaccp, generateTaskTemplatesFromKcps } = require("./generateComprehensiveHaccp");
const { generateScenarioBasedHaccp } = require("./scenarioBasedHaccp");
const processInstances = require("./processInstances");
const { guardDangerousOperation } = require("./security/environmentGuard");
const demoMode = require("./admin/demoMode");
const softArchive = require("./admin/softArchive");
const { closeDailyRun } = require("./closeDailyRun");
const { generateAndSaveEgenkontrolProgram } = require("./egenkontrol/egenkontrolGenerator");
const provisioning = require("./provisioning");
const Stripe = require("stripe");
// TIL HER

// === AI RULES ===
// Read functions/egenkontrol/operationalTemplateReference.js first
// Use it as source of truth
// Only generate operational templates
// Never use schema.titleKey or descriptionKey
// No GAG / CCP / compliance logic
// Always use guideKey
// =================

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });
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
    heroImageUrl: sanitizeString(config?.heroImageUrl || "", 2000) || null,
    ctaText: sanitizeString(config?.ctaText || "", 120) || null,
    ctaUrl: sanitizeString(config?.ctaUrl || "", 500) || null,
    phone: sanitizeString(config?.phone || "", 80) || null,
    address: sanitizeString(config?.address || "", 220) || null,
    themePrimary: sanitizeString(config?.theme?.primary || "", 20) || "#1f7a3d",
    themeSecondary: sanitizeString(config?.theme?.secondary || "", 20) || "#f8f4ea",
    themeAccent: sanitizeString(config?.theme?.accent || "", 20) || "#b91c1c",
    themeText: sanitizeString(config?.theme?.text || "", 20) || "#1f2937",
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

function daysBetween(dateKey1, dateKey2) {
  const [y1, m1, d1] = dateKey1.split("-").map(Number);
  const [y2, m2, d2] = dateKey2.split("-").map(Number);
  const date1 = new Date(Date.UTC(y1, m1 - 1, d1));
  const date2 = new Date(Date.UTC(y2, m2 - 1, d2));
  const diffMs = date2 - date1;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
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

  // Normalize named interval types to interval_days
  if (type === "yearly" || type === "annual" || type === "aarlig" || type === "årlig") {
    type = "interval_days";
    days = 365;
  } else if (type === "monthly" || type === "maanedlig" || type === "månedlig") {
    type = "interval_days";
    days = 30;
  } else if (type === "weekly" || type === "ugentlig") {
    type = "interval_days";
    days = 7;
  }

  if (!type) {
    if (!legacy || legacy === "daily" || legacy === "daglig") {
      type = "daily";
    } else if (legacy === "weekly" || legacy === "ugentlig") {
      type = "interval_days";
      days = 7;
    } else if (legacy === "monthly" || legacy === "maanedlig" || legacy === "månedlig") {
      type = "interval_days";
      days = 30;
    } else if (legacy === "yearly" || legacy === "annual" || legacy === "aarlig" || legacy === "årlig") {
      type = "interval_days";
      days = 365;
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
    companyName: sanitizeString(profile.companyName || profile.name, 140),
    cvr: sanitizeString(profile.cvr, 30),
    address: sanitizeString(profile.address, 180),
    city: sanitizeString(profile.city, 80),
    zip: sanitizeString(profile.zip, 20),
    companyType: sanitizeString(profile.companyType || profile.businessType, 80),
    ownerName: sanitizeString(profile.ownerName || profile.contactName || profile.leader, 120),
    phone: sanitizeString(profile.phone || profile.phoneNumber, 40),
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
    suppliers: sanitizeStringList(profile.suppliers, 80, 140),
    // Activity fields from onboarding (Danish names)
    tilberederVarmMad: sanitizeBoolean(profile.tilberederVarmMad),
    modtagerKoelevarer: sanitizeBoolean(profile.modtagerKoelevarer),
    modtagerFrostvarer: sanitizeBoolean(profile.modtagerFrostvarer),
    varmholder: sanitizeBoolean(profile.varmholder),
    nedkoelerMad: sanitizeBoolean(profile.nedkoelerMad),
    servererKoldMad: sanitizeBoolean(profile.servererKoldMad),
    antalKoeleskabe: toPositiveInt(profile.antalKoeleskabe),
    antalFrysere: toPositiveInt(profile.antalFrysere),
    walkInCoolerCount: toPositiveInt(profile.walkInCoolerCount),
    walkInFreezerCount: toPositiveInt(profile.walkInFreezerCount),
    antalIsterningemaskiner: toPositiveInt(profile.antalIsterningemaskiner),
    antalIsbokse: toPositiveInt(profile.antalIsbokse),
    antalFrityreGryder: toPositiveInt(profile.antalFrityreGryder),
    hasIceMachine: sanitizeBoolean(profile.hasIceMachine || profile.hasIsterningemaskine),
    hasIsboks: sanitizeBoolean(profile.hasIsboks),
    hasFrituregryde: sanitizeBoolean(profile.hasFrituregryde),
    madkoncept: sanitizeString(profile.madkoncept, 500),
    produkter: sanitizeString(profile.produkter, 1000)
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

  // ── Modtagelse ──────────────────────────────────────────────────────────
  if (profile.receivesChilledGoods || profile.fridgeCount > 0 || profile.antalKoeleskabe > 0 || profile.modtagerKoelevarer) {
    processes.push("receive_chilled_goods");
  }
  if (profile.receivesFrozenGoods || profile.freezerCount > 0 || profile.antalFrysere > 0 || profile.modtagerFrostvarer) {
    processes.push("receive_frozen_goods");
  }

  // ── Opbevaring ──────────────────────────────────────────────────────────
  if (profile.storesChilledGoods || profile.receivesChilledGoods || profile.fridgeCount > 0 || profile.antalKoeleskabe > 0) {
    processes.push("store_chilled_goods");
  }
  if (profile.storesFrozenGoods || profile.receivesFrozenGoods || profile.freezerCount > 0 || profile.antalFrysere > 0) {
    processes.push("store_frozen_goods");
  }

  // ── Tilberedning ─────────────────────────────────────────────────────────
  if (profile.preparesHotFood || profile.servesHotFood || profile.hasWarmKitchen || profile.tilberederVarmMad) {
    processes.push("cook_food");
  }

  // ── Varmholdelse ─────────────────────────────────────────────────────────
  if (profile.holdsHotFood || profile.hasHotHolding || profile.varmholder) {
    processes.push("hot_hold_food");
  }

  // ── Nedkøling ────────────────────────────────────────────────────────────
  if (profile.coolsHotFood || profile.nedkoelerMad) {
    processes.push("cool_food");
  }

  // ── Genopvarmning: kun relevant når der tilberedes OG evt. nedkøles ──────
  if (profile.preparesHotFood || profile.servesHotFood || profile.tilberederVarmMad) {
    processes.push("reheat_food");
  }

  // ── Servering koldt ──────────────────────────────────────────────────────
  if (profile.servesColdFood || profile.hasColdKitchen || profile.servererKoldMad || profile.preparesColdFood) {
    processes.push("serve_cold_food");
  }

  if (profile.packsTakeaway || profile.transportsHotTakeaway || profile.transportsChilledGoods || profile.transportsFrozenGoods) {
    specialConditions.push("transport_food");
    serviceTypes.push("takeaway");
  }

  if (profile.hasServingArea) {
    serviceTypes.push("dine_in");
  }

  if (!serviceTypes.length) {
    serviceTypes.push("production_only");
  }

  if (profile.handlesAllergens || profile.handlesDifferentFoods || profile.sellsFoodWithAllergens) {
    specialConditions.push("handles_allergens");
  }

  if (profile.sellsRawFish) {
    ingredients.push("raw_fish");
  }

  if (profile.makesDesserts) {
    ingredients.push("desserts");
  }

  // ── Areas: afledt fra lokaleboolanerne i profilen ────────────────────────
  const areas = ["kitchen"]; // alle lokationer har et køkken
  if (profile.hasProductionKitchen) areas.push("production_kitchen");
  if (profile.hasServingArea)       areas.push("serving_area");
  if (profile.hasDryStorage)        areas.push("dry_storage");
  if (profile.hasToilet)            areas.push("toilet");
  if (profile.hasDishwashing)       areas.push("dishwashing_area");
  if (profile.hasWashingRoom)       areas.push("washing_room");
  if (profile.hasVegetableRoom)     areas.push("vegetable_room");
  if (profile.hasWalkInCooler || profile.walkInCoolerCount > 0)   areas.push("walk_in_cooler_room");
  if (profile.hasWalkInFreezer || profile.walkInFreezerCount > 0) areas.push("walk_in_freezer_room");

  return {
    businessTypes: [businessTypeSlug],
    processes: [...new Set(processes)],
    ingredients: [...new Set(ingredients)],
    serviceTypes: [...new Set(serviceTypes)],
    specialConditions: [...new Set(specialConditions)],
    areas: [...new Set(areas)],
    equipmentCounts: {
      fridge: toPositiveInt(profile.antalKoeleskabe || profile.fridgeCount),
      freezer: toPositiveInt(profile.antalFrysere || profile.freezerCount),
      walk_in_cooler: toPositiveInt(profile.walkInCoolerCount) || (profile.hasWalkInCooler ? 1 : 0),
      walk_in_freezer: toPositiveInt(profile.walkInFreezerCount) || (profile.hasWalkInFreezer ? 1 : 0),
      ice_machine: toPositiveInt(profile.antalIsterningemaskiner) || (profile.hasIceMachine ? 1 : 0),
      ice_box: toPositiveInt(profile.antalIsbokse) || (profile.hasIsboks ? 1 : 0),
      fryer: toPositiveInt(profile.antalFrityreGryder) || (profile.hasFrituregryde ? 1 : 0),
      softice_machine: profile.hasSofticeachine ? 1 : 0
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

function buildLiveUserProfilePayload({ profile = {}, riskModel = {}, companyId, locationId, userId, userEmail, summary, cloudinaryAssets, draftId, checkoutSessionId }) {
  const sanitizedProfile = sanitizeOnboardingProfile(profile);
  const sanitizedRiskModel = sanitizeRiskModelInput(riskModel);
  const onboardingAnswers = deriveOnboardingAnswers(sanitizedProfile);
  
  return {
    documentType: "live_user_profile",
    companyId,
    locationId,
    organizationId: companyId,
    userId,
    userEmail: sanitizeString(userEmail, 160),
    profile: sanitizedProfile,
    riskModel: sanitizedRiskModel,
    onboardingAnswers,
    summary: summary || {},
    cloudinaryAssets: cloudinaryAssets || [],
    draftId: sanitizeString(draftId, 180),
    checkoutSessionId: sanitizeString(checkoutSessionId, 220),
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

function buildHaccpSnapshotPayload({ profile = {}, riskModel = {}, companyId, locationId, userId }) {
  const sanitizedProfile = sanitizeOnboardingProfile(profile);
  const sanitizedRiskModel = sanitizeRiskModelInput(riskModel);
  const normalizedAddress = [sanitizedProfile.address, sanitizedProfile.zip, sanitizedProfile.city]
    .filter(Boolean)
    .join(", ");
  const now = new Date();
