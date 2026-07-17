// Load environment variables from .env file (for local development)
require("dotenv").config();

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const { defineJsonSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const egenkontrol = require("./egenkontrol");
// âœ… KUN Ã‰N INITIALISERING
if (!admin.apps.length) {
  admin.initializeApp();
}

// IMPORTS EFTER INIT
const { generateComprehensiveHaccp, generateTaskTemplatesFromKcps } = require("./generateComprehensiveHaccp");
const { generateScenarioBasedHaccp } = require("./scenarioBasedHaccp");
const { guardDangerousOperation } = require("./security/environmentGuard");
const demoMode = require("./admin/demoMode");
const softArchive = require("./admin/softArchive");
const {
  closeDailyRun,
  startCoolingProcess,
  addCoolingMeasurement,
  completeCoolingProcess,
  startReheatingProcess,
  completeReheatingProcess,
  disposeCoolingProcess,
  startNewCoolingFromReheating,
  loadActiveProcessInstances,
  pauseEgenkontrolRoutine,
  reactivateEgenkontrolRoutine,
  setRoutinePauseState,
  updateEgenkontrolRoutineFrequency
} = require("./modules/egenkontrol");
const { generateAndSaveEgenkontrolProgram } = require("./egenkontrol/egenkontrolGenerator");
const provisioning = require("./provisioning");
Object.assign(exports, require("./modules/pos"));
const Stripe = require("stripe");
const { OWNER_KIND, buildOwnerScopeMetadata } = require("./lib/ownerScope");
const { normalizeRoutineType } = require("./js/canonicalRoutines");

// === AI RULES ===
// Read functions/egenkontrol/operationalTemplateReference.js first
// Use it as source of truth
// Only generate operational templates
// Never use schema.titleKey or descriptionKey
// No GAG / CCP / compliance logic
// Always use guideKey
// =================

const db = admin.firestore();
const { getUserLocationIds, getUserAccessProfile, assertLexiCustomerAccess, assertStartDayAccess, assertAdminAccess, assertSeoGeneratorAccess } = require("./lib/access")({ db });
db.settings({ ignoreUndefinedProperties: true });
const { FieldValue } = admin.firestore;
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const FUNCTIONS_CONFIG = defineJsonSecret("FUNCTIONS_CONFIG_EXPORT");

function getStripeConfig() {
  const config = FUNCTIONS_CONFIG.value();

  if (!config || typeof config !== "object") {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "FUNCTIONS_CONFIG_EXPORT mangler eller er ikke et JSON object."
    );
  }

  if (!config.stripe || typeof config.stripe !== "object") {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "FUNCTIONS_CONFIG_EXPORT.stripe mangler."
    );
  }

  const secretKey = String(config.stripe.secret_key || "").trim();
  const priceMonthly = String(config.stripe.price_monthly || "").trim();
  const priceYearly = String(config.stripe.price_yearly || "").trim();

  if (!secretKey.startsWith("sk_")) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Stripe secret_key mangler eller er ugyldig i FUNCTIONS_CONFIG_EXPORT.stripe.secret_key."
    );
  }

  if (!priceMonthly.startsWith("price_")) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Stripe monthly price mangler eller er ugyldig i FUNCTIONS_CONFIG_EXPORT.stripe.price_monthly."
    );
  }

  if (!priceYearly.startsWith("price_")) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Stripe yearly price mangler eller er ugyldig i FUNCTIONS_CONFIG_EXPORT.stripe.price_yearly."
    );
  }

  return {
    secretKey,
    priceMonthly,
    priceYearly
  };
}

function getStripeClient() {
  const { secretKey } = getStripeConfig();
  return new Stripe(secretKey, { apiVersion: "2023-10-16" });
}

// â”€â”€â”€ STRIPE WEBHOOK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const { onRequest } = require("firebase-functions/v2/https");
const { sanitizeString, sanitizeStringList, sanitizeBoolean, toArray, toPositiveInt, toDocSafeId, toAsciiSlug, toLegacyId, getDateKey, addDays, daysBetween, normalizeDateKey, removeUndefinedFields, getWeekdayFromDateKey, sanitizeRelativePath, parsePageCount } = require("./lib/util");

exports.stripeWebhook = onRequest(
  {
    region: "us-central1",
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  },
  async (req, res) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    });

    let event;

    try {
      const sig = req.headers["stripe-signature"];

      if (!sig) {
        console.error("âŒ Missing Stripe signature");
        return res.status(400).send("Missing signature");
      }

      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("âŒ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log("âœ… Stripe event:", event.type);

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const companyId = session.metadata?.companyId;

          if (!companyId) break;

          await db.collection("companies").doc(companyId).set(
            {
              subscription: {
                plan: session.metadata?.plan || "unknown",
                status: "active",
                stripeCustomerId: session.customer,
                stripeSubscriptionId: session.subscription,
                updatedAt: FieldValue.serverTimestamp(),
              },
            },
            { merge: true }
          );
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object;

          const snap = await db
            .collection("companies")
            .where("subscription.stripeCustomerId", "==", sub.customer)
            .get();

          for (const doc of snap.docs) {
            await doc.ref.update({
              "subscription.status": sub.status,
              "subscription.currentPeriodEnd": sub.current_period_end,
              "subscription.updatedAt": FieldValue.serverTimestamp(),
            });
          }
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object;

          const snap = await db
            .collection("companies")
            .where("subscription.stripeCustomerId", "==", sub.customer)
            .get();

          for (const doc of snap.docs) {
            await doc.ref.update({
              "subscription.status": "canceled",
              "subscription.updatedAt": FieldValue.serverTimestamp(),
            });
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object;

          const snap = await db
            .collection("companies")
            .where("subscription.stripeCustomerId", "==", invoice.customer)
            .get();

          for (const doc of snap.docs) {
            await doc.ref.update({
              "subscription.status": "payment_failed",
              "subscription.updatedAt": FieldValue.serverTimestamp(),
            });
          }
          break;
        }

        case "invoice.paid": {
          const invoice = event.data.object;

          const snap = await db
            .collection("companies")
            .where("subscription.stripeCustomerId", "==", invoice.customer)
            .get();

          for (const doc of snap.docs) {
            await doc.ref.update({
              "subscription.status": "active",
              "subscription.updatedAt": FieldValue.serverTimestamp(),
            });
          }
          break;
        }

        default:
          console.log("Unhandled event type:", event.type);
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("âŒ Webhook handler error:", error);
      res.status(500).send("Server error");
    }
  }
);

const ADDON_CATALOG = {
  egenkontrol: { name: "Egenkontrol", amount: 14900 },
  kalkulation: { name: "Kalkulation", amount: 24900 },
  seo: { name: "SEO & Hjemmeside", amount: 34900 },
  accounting: { name: "Accounting", amount: 69900 },
  pos: { name: "POS", amount: 59900 },
  "bon-ai": { name: "Bon-AI", amount: 39900 },
  connector: { name: "Connector Support", amount: 29900 }
};

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
// ðŸ”¹ SIMPLE API (temporarily commented out due to 1st Gen to 2nd Gen upgrade conflict)
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
// ðŸ”¹ HJÃ†LPEFUNKTIONER
//
function normalizeTaskInstanceDateInId(instanceId = "", dateKey = "") {
  const id = sanitizeString(instanceId, 240);
  const normalizedDateKey = normalizeDateKey(dateKey);
  if (!id || !normalizedDateKey) return id;
  return id.replace(/\d{4}[-_]\d{2}[-_]\d{2}/, normalizedDateKey);
}

function buildRoutineInstanceId(companyId = "", locationId = "", dateKey = "", identity = "") {
  const normalizedDateKey = normalizeDateKey(dateKey) || getDateKey();
  const identityKey = toDocSafeId(identity || "routine");
  return `${companyId}__${locationId}__${normalizedDateKey}__${identityKey}`.slice(0, 180);
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
  if (type === "yearly" || type === "annual" || type === "aarlig" || type === "Ã¥rlig") {
    type = "interval_days";
    days = 365;
  } else if (type === "monthly" || type === "maanedlig" || type === "mÃ¥nedlig") {
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
    } else if (legacy === "monthly" || legacy === "maanedlig" || legacy === "mÃ¥nedlig") {
      type = "interval_days";
      days = 30;
    } else if (legacy === "yearly" || legacy === "annual" || legacy === "aarlig" || legacy === "Ã¥rlig") {
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
    // Step 4: Varmholdelse/NedkÃ¸ling
    holdsHotFood: sanitizeBoolean(profile.holdsHotFood),
    holdsHotFoodDetails: sanitizeString(profile.holdsHotFoodDetails, 2000),
    holdsHotFoodCritical: sanitizeBoolean(profile.holdsHotFoodCritical),
    coolsHotFood: sanitizeBoolean(profile.coolsHotFood),
    coolsHotFoodDetails: sanitizeString(profile.coolsHotFoodDetails, 2000),
    coolsHotFoodCritical: sanitizeBoolean(profile.coolsHotFoodCritical),
    // Step 5: HÃ¥ndtering/Allergener
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

  // â”€â”€ Modtagelse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (profile.receivesChilledGoods || profile.fridgeCount > 0 || profile.antalKoeleskabe > 0 || profile.modtagerKoelevarer) {
    processes.push("receive_chilled_goods");
  }
  if (profile.receivesFrozenGoods || profile.freezerCount > 0 || profile.antalFrysere > 0 || profile.modtagerFrostvarer) {
    processes.push("receive_frozen_goods");
  }

  // â”€â”€ Opbevaring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (profile.storesChilledGoods || profile.receivesChilledGoods || profile.fridgeCount > 0 || profile.antalKoeleskabe > 0) {
    processes.push("store_chilled_goods");
  }
  if (profile.storesFrozenGoods || profile.receivesFrozenGoods || profile.freezerCount > 0 || profile.antalFrysere > 0) {
    processes.push("store_frozen_goods");
  }

  // â”€â”€ Tilberedning â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (profile.preparesHotFood || profile.servesHotFood || profile.hasWarmKitchen || profile.tilberederVarmMad) {
    processes.push("cook_food");
  }

  // â”€â”€ Varmholdelse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (profile.holdsHotFood || profile.hasHotHolding || profile.varmholder) {
    processes.push("hot_hold_food");
  }

  // â”€â”€ NedkÃ¸ling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (profile.coolsHotFood || profile.nedkoelerMad) {
    processes.push("cool_food");
  }

  // â”€â”€ Genopvarmning: kun relevant nÃ¥r der tilberedes OG evt. nedkÃ¸les â”€â”€â”€â”€â”€â”€
  if (profile.preparesHotFood || profile.servesHotFood || profile.tilberederVarmMad) {
    processes.push("reheat_food");
  }

  // â”€â”€ Servering koldt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Areas: afledt fra lokaleboolanerne i profilen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const areas = ["kitchen"]; // alle lokationer har et kÃ¸kken
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

function buildLiveUserProfilePayload({ profile = {}, riskModel = {}, companyId, locationId, userId, userEmail, summary, cloudinaryAssets, draftId, checkoutSessionId, ownerScopeMetadata = {} }) {
  const sanitizedProfile = sanitizeOnboardingProfile(profile);
  const sanitizedRiskModel = sanitizeRiskModelInput(riskModel);
  const onboardingAnswers = deriveOnboardingAnswers(sanitizedProfile);
  
  return {
    documentType: "live_user_profile",
    companyId,
    locationId,
    organizationId: companyId,
    ...ownerScopeMetadata,
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

function buildHaccpSnapshotPayload({ profile = {}, riskModel = {}, companyId, locationId, userId, ownerScopeMetadata = {} }) {
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

  // Transform risk analysis hazards to routine templates using controls field

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
    ...ownerScopeMetadata,
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

function buildOwnerScopeUpdatePatch(existing = {}, ownerScopeMetadata = {}) {
  const patch = {};
  for (const field of ["ownerKind", "ownerLabel", "isDemoScope", "scopeType"]) {
    if (ownerScopeMetadata[field] !== undefined && existing[field] !== ownerScopeMetadata[field]) {
      patch[field] = ownerScopeMetadata[field];
    }
  }
  return patch;
}

async function createHaccpSnapshotDocument({ profile = {}, riskModel = {}, companyId, locationId, userId, ownerScopeMetadata = {} }) {
  const payload = buildHaccpSnapshotPayload({
    profile,
    riskModel,
    companyId,
    locationId,
    userId,
    ownerScopeMetadata
  });

  // Remove undefined fields to prevent Firestore errors
  const cleanedPayload = removeUndefinedFields(payload);

  const docRef = await db.collection("haccp_snapshots").add(cleanedPayload);
  
  // Create egenkontrol_programs document to enable operational task generation
  const programId = `${companyId}__${locationId}`;
  const programRef = db.collection("egenkontrol_programs").doc(programId);
  
  await programRef.set({
    companyId,
    locationId,
    organizationId: companyId,
    ...ownerScopeMetadata,
    personalisering: {
      antalKoeleskabe: parseInt(profile.antalKoeleskabe || 0, 10),
      antalFrysere: parseInt(profile.antalFrysere || 0, 10),
      tilberederVarmMad: profile.tilberederVarmMad || false,
      nedkoelerMad: profile.nedkoelerMad || false,
      varmholder: profile.varmholder || false
    },
    createdBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  
  return {
    snapshotId: docRef.id,
    payload: cleanedPayload,
    activatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function upsertOnboardingAnswersDocument({ companyId, locationId, userId, liveProfilePayload, ownerScopeMetadata = {} }) {
  const onboardingDocId = toDocSafeId(`${companyId}__${locationId}__onboarding`);
  const onboardingRef = db.collection("onboarding_answers").doc(onboardingDocId);
  const answers = liveProfilePayload.onboardingAnswers || {};

  await onboardingRef.set({
    companyId,
    locationId,
    organizationId: companyId,
    ...ownerScopeMetadata,
    businessTypes: toArray(answers.businessTypes),
    processes: toArray(answers.processes),
    ingredients: toArray(answers.ingredients),
    serviceTypes: toArray(answers.serviceTypes),
    specialConditions: toArray(answers.specialConditions),
    areas: toArray(answers.areas),
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

    // NÃ¸glen er doc.id â€” kompatibel med nyt templateDocId__[equipmentId__]dateKey skema
    taskMap.set(doc.id, {
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
    text.includes("kÃ¸l") ||
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

  if (text.includes("rengÃ¸r") || text.includes("rengor") || text.includes("lukker")) {
    return {
      category: text.includes("lukker") ? "lukkerutine" : "rengÃ¸ring",
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
      { key: "measurement", label: "MÃ¥ling", type: "number", required: true },
      { key: "comment", label: "Kommentar", type: "textarea", required: false },
      { key: "deviationReason", label: "Ã…rsag ved afvigelse", type: "textarea", required: false }
    ];
  }

  if (formType === "receiving") {
    return [
      { key: "supplier", label: "LeverandÃ¸r", type: suppliers.length ? "select" : "text", required: true, options: suppliers },
      { key: "status", label: "Status", type: "radio", required: true, options: ["OK", "Afvigelse"] },
      { key: "comment", label: "Kommentar", type: "textarea", required: false },
      { key: "deviationReason", label: "Ã…rsag ved afvigelse", type: "textarea", required: false }
    ];
  }

  if (formType === "checklist") {
    return [
      { key: "completed", label: "UdfÃ¸rt", type: "checkbox", required: false },
      { key: "comment", label: "Kommentar", type: "textarea", required: false },
      { key: "deviationReason", label: "Ã…rsag ved afvigelse", type: "textarea", required: false }
    ];
  }

  return [
    { key: "status", label: "Status", type: "radio", required: true, options: ["OK", "Afvigelse"] },
    { key: "comment", label: "Kommentar", type: "textarea", required: false },
    { key: "deviationReason", label: "Ã…rsag ved afvigelse", type: "textarea", required: false }
  ];
}

function buildProvisionedTemplateAlertRules(formType, title, riskLevel) {
  if (formType === "temperature") {
    return [{
      type: "measurement_out_of_range",
      severity: riskLevel === "high" ? "critical" : "warning",
      message: `${sanitizeString(title, 160)} krÃ¦ver temperaturkontrol`
    }];
  }

  return [{
    type: "status_equals",
    value: "Afvigelse",
    severity: riskLevel === "high" ? "critical" : "warning",
    message: `${sanitizeString(title, 160)} krÃ¦ver handling`
  }];
}

function extractTemperatureLimits(kcp) {
  if (!kcp || !kcp.criticalLimit) return { minValue: null, maxValue: null, unit: "Â°C" };
  
  const criticalLimit = kcp.criticalLimit;
  const category = (kcp.category || "").toLowerCase();
  const title = (kcp.title || "").toLowerCase();
  
  // KCP 1: Modtagelse (Receiving) - Default to chilled goods temperature
  if (category.includes("modtagelse") || title.includes("modtagelse") || title.includes("varemodtagelse")) {
    return { minValue: 0, maxValue: 5, unit: "Â°C", target: "KÃ¸levarer" };
  }
  
  // KCP 2: Opbevaring - KÃ¸l/Frost
  if (category.includes("opbevaring") || title.includes("lager")) {
    if (title.includes("kÃ¸l") || title.includes("fridge")) {
      return { minValue: 0, maxValue: 5, unit: "Â°C", target: "KÃ¸leskab" };
    }
    if (title.includes("frost") || title.includes("frys")) {
      return { minValue: -25, maxValue: -18, unit: "Â°C", target: "Fryser" };
    }
    // Default for storage
    return { minValue: 0, maxValue: 5, unit: "Â°C", target: "KÃ¸l" };
  }
  
  // KCP 3: Tilberedning
  if (category.includes("tilberedning") || title.includes("tilberedning") || title.includes("opvarmning")) {
    return { minValue: 75, maxValue: 100, unit: "Â°C", target: "Kernetemperatur" };
  }
  
  // KCP 4: NedkÃ¸ling
  if (category.includes("nedkoeling") || title.includes("nedkÃ¸l")) {
    return { minValue: 0, maxValue: 10, unit: "Â°C", target: "Sluttemperatur", timeLimit: "4 timer" };
  }
  
  // KCP 5: Varmholdelse
  if (category.includes("varmholdelse") || title.includes("varmhold")) {
    return { minValue: 60, maxValue: 100, unit: "Â°C", target: "Varmholdelse", timeLimit: "3 timer" };
  }
  
  return { minValue: null, maxValue: null, unit: "Â°C" };
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
    actions.push(`**Ã˜jeblikkelig handling:** ${correctiveAction.immediate}`);
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
  
  if (category.includes("nedkoeling") || title.includes("nedkÃ¸l")) {
    return {
      guidePurpose: "At sikre at tilberedte retter nedkÃ¸les hurtigt nok til at forhindre bakterievÃ¦kst. Langsom nedkÃ¸ling mellem 10Â°C og 60Â°C er farligt.",
      guideExecutionTimes: "Efter hver tilberedning af retter der skal opbevares kÃ¸ligt",
      guideCriticalLimit: "Sluttemperatur under 10Â°C inden for 4 timer fra 60Â°C",
      guideSteps: [
        "MÃ¥l og noter starttemperatur umiddelbart efter tilberedning (skal vÃ¦re under 60Â°C)",
        "Placer maden i blast chiller eller kÃ¸l med god luftcirkulation",
        "TildÃ¦k maden korrekt og mÃ¦rk med dato og tidspunkt",
        "MÃ¥l sluttemperatur efter nedkÃ¸ling",
        "RegistrÃ©r bÃ¥de start- og sluttemperatur samt nedkÃ¸lingstid i systemet"
      ],
      guideWhatToRegister: ["Dato og klokkeslÃ¦t for start", "Starttemperatur", "Sluttemperatur", "NedkÃ¸lingstid", "Hvem der har udfÃ¸rt kontrollen", "Eventuel kommentar"],
      guideApproval: ["Sluttemperatur er under 10Â°C", "NedkÃ¸ling tog mindre end 4 timer", "Maden er korrekt tildÃ¦kket og mÃ¦rket", "Dokumentation er registreret"],
      guideDeviationCriteria: ["Sluttemperatur over 10Â°C efter 4 timer", "Blast chiller fungerer ikke", "Maden blev ikke tildÃ¦kket korrekt", "NedkÃ¸lingstid overskred 4 timer"],
      guideIfNotOk: [
        "RegistrÃ©r afvigelsen straks med prÃ¦cise temperaturer og tidspunkter",
        "Hvis over 10Â°C efter 4 timer: KassÃ©r maden omgÃ¥ende - bakterievÃ¦kst kan vÃ¦re farlig",
        "Hvis blast chiller defekt: Brug isvandsbad eller fordel i mindre portioner i kÃ¸l",
        "Flyt andre varer til fungerende udstyr",
        "InformÃ©r kÃ¸kkenchef eller ansvarlig leder",
        "Bestil service pÃ¥ blast chiller hvis nÃ¸dvendigt",
        "Ved tvivl om fÃ¸devaresikkerhed: KassÃ©r altid maden"
      ],
      guideShortTips: ["MÃ¥l altid roligt og korrekt", "Brug kalibreret termometer", "Skriv den rigtige temperatur, ikke et gÃ¦t", "Ved afvigelse skal du altid handle med det samme", "DokumentÃ©r alt"]
    };
  }
  
  if (category.includes("tilberedning") || title.includes("tilberedning") || title.includes("opvarmning")) {
    return {
      guidePurpose: "At sikre at maden tilberedes korrekt til en sikker temperatur for at forhindre bakterievÃ¦kst.",
      guideExecutionTimes: "FÃ¸r hver servering af tilberedte retter",
      guideCriticalLimit: "Kernetemperatur pÃ¥ minimum 75Â°C",
      guideSteps: [
        "Stik termometeret i den tykkeste del af kÃ¸det eller fjerkrÃ¦et",
        "Vent 10 sekunder for at fÃ¥ en stabil mÃ¥ling",
        "AflÃ¦s temperaturen og sikr dig at den er minimum 75Â°C",
        "RegistrÃ©r temperaturen i systemet"
      ],
      guideWhatToRegister: ["Dato og klokkeslÃ¦t for mÃ¥ling", "Kernetemperatur", "Hvem der har udfÃ¸rt kontrollen", "Eventuel kommentar"],
      guideApproval: ["Kernetemperatur er minimum 75Â°C", "Maden ser appetitlig ud", "Dokumentation er registreret"],
      guideDeviationCriteria: ["Kernetemperatur under 75Â°C", "Termometeret er ikke kalibreret", "Maden ser ikke appetitlig ud"],
      guideIfNotOk: [
        "RegistrÃ©r afvigelsen straks med prÃ¦cise temperaturer og tidspunkter",
        "Hvis under 75Â°C: Tilbered maden lÃ¦ngere ved lavere varme",
        "Hvis termometeret ikke er kalibreret: KalibrÃ©r det fÃ¸r nÃ¦ste brug",
        "Hvis maden ikke ser appetitlig ud: KassÃ©r den",
        "InformÃ©r kÃ¸kkenchef eller ansvarlig leder",
        "Ved tvivl om fÃ¸devaresikkerhed: KassÃ©r altid maden"
      ],
      guideShortTips: ["Brug altid et kalibreret termometer", "MÃ¥l kernetemperaturen korrekt", "Skriv den rigtige temperatur, ikke et gÃ¦t", "Ved afvigelse skal du altid handle med det samme", "DokumentÃ©r alt"]
    };
  }
  
  if (category.includes("varmholdelse") || title.includes("varmhold")) {
    return {
      guideAreas: ["Temperatur (min 60Â°C)", "Varighed (max 3 timer)", "Madkvalitet"],
      guideSteps: ["MÃ¥l i midten af retten", "Tjek varmeskab temperatur", "Noter starttidspunkt", "Registrer data"],
      guideApproval: ["Minimum 60Â°C", "Under 3 timer", "Ser appetitlig ud"],
      guideIfNotOk: ["Under 60Â°C: Varm til 75Â°C eller kassÃ©r", "Over 3 timer: KassÃ©r maden", "Varmeskab defekt: Flyt eller server", "Ved tvivl: KassÃ©r", "Registrer afvigelse"]
    };
  }
  
  if (category.includes("modtagelse") || title.includes("modtagelse")) {
    return {
      guideAreas: ["Temperatur (kÃ¸l max 5Â°C, frost max -12Â°C)", "Emballage-integritet", "Holdbarhedsdato", "Sensorisk vurdering"],
      guideSteps: ["Tjek temperaturer", "Inspicer emballage", "Tjek datoer", "Lugt og se pÃ¥ varerne"],
      guideApproval: ["Temperaturer OK", "Emballage intakt", "Datoer acceptable", "Frisk lugt og udseende"],
      guideIfNotOk: ["KÃ¸levarer over 5Â°C: Afvis", "Frostvarer optÃ¸ede: Afvis", "Beskadiget emballage: Afvis eller dokumenter", "DÃ¥rlig lugt: Afvis altid", "Kort holdbarhed: Afvis eller brug samme dag", "Dokumenter med billeder"]
    };
  }
  
  if (category.includes("opbevaring") || title.includes("lager")) {
    return {
      guideAreas: ["Temperatur (kÃ¸l 0-5Â°C, frost -18 til -25Â°C)", "FIFO-princip", "Adskillelse rÃ¥t/tilberedt", "TildÃ¦kning og mÃ¦rkning"],
      guideSteps: ["MÃ¥l temperaturer", "Tjek FIFO", "KontrollÃ©r adskillelse", "Verificer mÃ¦rkning"],
      guideApproval: ["Temperaturer korrekte", "FIFO overholdt", "Ingen krydskontaminering", "Alt mÃ¦rket"],
      guideIfNotOk: ["HÃ¸j temperatur: Tjek dÃ¸re, kontakt tekniker", "RÃ¥t over tilberedt: Flyt og rengÃ¸r", "UmÃ¦rket: MÃ¦rk nu eller kassÃ©r", "Gammelt mad: KassÃ©r", "Gentagne problemer: Tag ud af drift", "Registrer afvigelse"]
    };
  }
  
  if (category.includes("allergen")) {
    return {
      guideAreas: ["AllergenmÃ¦rkning pÃ¥ menukort", "Separate redskaber", "RengÃ¸ring mellem retter", "Personaleviden"],
      guideSteps: ["GennemgÃ¥ menukort", "Tjek separate redskaber", "Test personaleviden", "KontrollÃ©r rengÃ¸ring"],
      guideApproval: ["Alt mÃ¦rket korrekt", "Separate redskaber findes", "Personale kender allergener", "RengÃ¸ring forhindrer krydskontaminering"],
      guideIfNotOk: ["Mangler mÃ¦rkning: Opdater omgÃ¥ende", "Personale ukyndigt: Hold briefing nu", "Ingen separate redskaber: Anskaf eller vask grundigt", "Krydskontaminering: KassÃ©r og lav ny", "Allergisk reaktion: Ring 112 hvis alvorligt", "TrÃ¦n personale"]
    };
  }
  
  if (category.includes("rengoering") || category.includes("cleaning")) {
    return {
      guideAreas: ["Arbejdsflader og redskaber", "KÃ¸le/frostenheder", "AflÃ¸b og gulve", "Maskiner"],
      guideSteps: ["Inspicer visuelt", "Tjek kritiske omrÃ¥der", "Verificer rengÃ¸ringsplan", "Test med hvid klud"],
      guideApproval: ["Visuelt rent", "Ingen dÃ¥rlig lugt", "Plan fulgt", "Hvid klud-test OK"],
      guideIfNotOk: ["Synligt snavs: RengÃ¸r omgÃ¥ende", "AflÃ¸b lugter: Rens dagligt", "Beskidte tÃ¦tninger: RengÃ¸r og desinficer", "Maskiner urene: Stop brug og rengÃ¸r", "Gentagne problemer: Ekstra instruktion", "Skadedyr: Kontakt bekÃ¦mpelse", "Registrer afvigelse"]
    };
  }
  
  return {
    guideAreas: ["KontrollÃ©r visuelt", "BekrÃ¦ft udfÃ¸relse", "Beskriv afvigelser"],
    guideSteps: ["Vask hÃ¦nder", "GennemfÃ¸r kontrol", "Gem dokumentation"],
    guideApproval: ["Rent og vedligeholdt", "UdfÃ¸rt uden mangler", "Gemt i systemet"],
    guideIfNotOk: ["RegistrÃ©r afvigelse", "UdfÃ¸r korrigerende handling", "Informer ansvarlig"]
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
    throw new functions.https.HttpsError("unauthenticated", "Du skal vÃ¦re logget ind for at synkronisere task-skabeloner.");
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

// â”€â”€â”€ ADMIN: RE-PROVISION EQUIPMENT FOR EXISTING LOCATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Kald dette for lokationer som ikke gik igennem det nye checkout-flow.
// Populerer `equipment` collection, rydder op i cleaning/maintenance templates.
exports.adminReprovisionEquipment = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;

  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vÃ¦re logget ind.");
  }

  const uid = sanitizeString(auth.uid, 160);
  const email = sanitizeString(auth.token?.email || "", 160).toLowerCase();
  const companyId = sanitizeString(data?.companyId, 120);
  const locationId = sanitizeString(data?.locationId, 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
  }

  await assertAdminAccess({ uid, email, companyId, locationId });

  // Accept explicit counts or fall back to live_user_profiles â†’ profile
  let equipmentCounts = {};
  let profile = {};

  if (data?.equipmentCounts && typeof data.equipmentCounts === "object") {
    equipmentCounts = data.equipmentCounts;
  } else {
    // Try to load from live_user_profiles
    const liveSnap = await db.collection("live_user_profiles")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .limit(1)
      .get();

    if (!liveSnap.empty) {
      const liveData = liveSnap.docs[0].data() || {};
      profile = liveData.profile || {};
      equipmentCounts = liveData.onboardingAnswers?.equipmentCounts || {};
    }
  }

  const eqResult = await syncOnboardingEquipmentUnits({ db, companyId, locationId, equipmentCounts, profile });
  const cleanResult = await syncEquipmentCleaningTemplates({ db, companyId, locationId });
  const maintResult = await syncEquipmentMaintenanceTemplates({ db, companyId, locationId });
  const areaResult  = await syncAreaCleaningTemplates({ db, companyId, locationId });
  const driftResult = await syncProcessDriftTemplates({ db, companyId, locationId });
  const waterResult = await syncWaterControlTemplates({ db, companyId, locationId });

  // Steg 4: Generer/opdater risks fra onboarding
  const { generateRisksFromOnboardingAnswers } = require("./admin/generateRisksFromOnboardingAnswers");
  const risksResult = await generateRisksFromOnboardingAnswers({ locationId });

  // Steg 5: Byg task_templates fra risks
  const { generateEgenkontrolFromRiskAnalysis } = require("./admin/generateEgenkontrolFromRiskAnalysis");
  const templatesResult = await generateEgenkontrolFromRiskAnalysis({ locationId, db });

  return {
    ok: true,
    companyId,
    locationId,
    equipment: eqResult,
    cleaningTemplates: cleanResult,
    maintenanceTemplates: maintResult,
    areaTemplates: areaResult,
    driftTemplates: driftResult,
    waterControlTemplates: waterResult,
    risks: risksResult,
    riskTemplates: templatesResult
  };
});

// â”€â”€â”€ ADMIN: GENERER RISKS FRA ONBOARDING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.generateRisksForLocation = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;

  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vÃ¦re logget ind.");
  }

  const uid = sanitizeString(auth.uid, 160);
  const email = sanitizeString(auth.token?.email || "", 160).toLowerCase();
  const companyId = sanitizeString(data?.companyId, 120);
  const locationId = sanitizeString(data?.locationId, 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
  }

  await assertAdminAccess({ uid, email, companyId, locationId });

  const { generateRisksFromOnboardingAnswers } = require("./admin/generateRisksFromOnboardingAnswers");
  const result = await generateRisksFromOnboardingAnswers({ locationId });

  return { ok: true, ...result };
});

// â”€â”€â”€ ADMIN: GENERER EGENKONTROL-TEMPLATES FRA RISKS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.generateTemplatesForLocation = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;

  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vÃ¦re logget ind.");
  }

  const uid = sanitizeString(auth.uid, 160);
  const email = sanitizeString(auth.token?.email || "", 160).toLowerCase();
  const companyId = sanitizeString(data?.companyId, 120);
  const locationId = sanitizeString(data?.locationId, 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
  }

  await assertAdminAccess({ uid, email, companyId, locationId });

  const { generateEgenkontrolFromRiskAnalysis } = require("./admin/generateEgenkontrolFromRiskAnalysis");
  const result = await generateEgenkontrolFromRiskAnalysis({ locationId, db });

  return { ok: true, ...result };
});

async function getLexiCustomerStatusPayload({ companyId, locationId }) {
  const todayKey = getDateKey();
  const operatingMode = await getOperatingModeForLocation({
    companyId,
    locationId,
    todayKey
  });

  // Ensure location has temperature control settings for new schedule system
  let locationTemperatureSettings = null;
  try {
    locationTemperatureSettings = await ensureLocationTemperatureSettings(db, companyId, locationId, todayKey);
  } catch (err) {
    console.warn("[getLexiCustomerStatusPayload] ensureLocationTemperatureSettings failed:", err.message);
  }

  // Load equipment units with temperatureControl settings
  const equipmentUnitMap = new Map();
  try {
    const equipmentSnap = await db.collection("equipment")
      .where("locationId", "==", locationId)
      .get();
    
    for (const equipmentDoc of equipmentSnap.docs) {
      const equipment = equipmentDoc.data() || {};
      if (equipment.active === false) continue;
      const normalized = {
        id: equipmentDoc.id,
        type: sanitizeEquipmentType(equipment.type || equipment.equipmentType),
        temperatureControl: equipment.temperatureControl || null
      };
      
      try {
        const normalizedUnit = await ensureEquipmentTemperatureControl(db, locationId, normalized);
        if (normalizedUnit.temperatureControl) {
          normalized.temperatureControl = normalizedUnit.temperatureControl;
        }
      } catch (err) {
        console.warn(`[getLexiCustomerStatusPayload] ensureEquipmentTemperatureControl failed for ${normalized.id}:`, err.message);
      }
      
      equipmentUnitMap.set(normalized.id, normalized);
    }
  } catch (err) {
    console.warn("[getLexiCustomerStatusPayload] Failed to load equipment:", err.message);
  }

  const [templateDocs] = await Promise.all([
    loadActiveTaskTemplates({ companyId, locationId })
  ]);

  const routineChecks = await Promise.all(templateDocs.map(async (doc) => {
    const template = doc.data() || {};
    const taskId = sanitizeString(template.taskId, 120);

    try {
      // Resolve schedule configuration combining template, location and unit settings
      const equipmentUnitId = template.equipmentUnit || template.equipmentId || "";
      const unitForTemplate = equipmentUnitId ? equipmentUnitMap.get(equipmentUnitId) : null;
      
      const resolvedSchedule = resolveTemplateSchedule({
        template,
        locationTemperatureSettings,
        unitTemperatureControl: unitForTemplate?.temperatureControl || null,
        todayKey
      });

      // Check if unit is disabled - skip if so
      if (resolvedSchedule && resolvedSchedule.enabled === false) {
        return { dueToday: false };
      }

      const lastCompletedDateKey = taskId
        ? await getLastCompleted(taskId, locationId)
        : null;
      
      // Use new schedule system if available, otherwise fallback to legacy
      let dueToday = false;
      if (resolvedSchedule && resolvedSchedule.useNewSchedule) {
        const anchorDate = resolvedSchedule.anchorDate || locationTemperatureSettings?.anchorDate || todayKey;
        dueToday = shouldRunToday(resolvedSchedule, todayKey, anchorDate, lastCompletedDateKey);
      } else {
        dueToday = isDueToday(template, todayKey, lastCompletedDateKey);
      }
      
      // Debug logging for schedule consistency validation
      console.log("[SCHEDULE_DEBUG]", {
        templateId: doc.id,
        taskId: taskId,
        hasScheduleConfig: !!template.scheduleConfig,
        resolvedSchedule: resolvedSchedule ? {
          useNewSchedule: resolvedSchedule.useNewSchedule,
          enabled: resolvedSchedule.enabled,
          scheduleType: resolvedSchedule.scheduleType,
          recurrenceMode: resolvedSchedule.recurrenceMode,
          recurrenceValue: resolvedSchedule.recurrenceValue
        } : null,
        lastCompletedDateKey: lastCompletedDateKey,
        dueToday: dueToday,
        source: "lexi"
      });
      
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
    ...(await getLexiCustomerStatusPayload({ companyId, locationId }))
  };
});

//
// ðŸ”¹ FREKVENS LOGIK
//

/**
 * Ny unified schedule evaluator med support for scheduleConfig.
 * UnderstÃ¸tter: daily, every_n_days, weekly_days, monthly, yearly, firstRunImmediately.
 */
function shouldRunToday(scheduleConfig, todayKey, anchorDateKey, lastCompletedDateKey) {
  if (!scheduleConfig) return false;

  const scheduleType = scheduleConfig.scheduleType || "operational";
  const firstRunImmediately = scheduleConfig.firstRunImmediately === true;
  let recurrenceMode = scheduleConfig.documentedIntervalMode || scheduleConfig.recurrenceMode || "daily";

  // Alias: writers emit "interval_days" / "days" for the same "every N days" cadence
  // that this function implements under the "every_n_days" branch. Normalize so the
  // existing every_n_days logic is reused unchanged.
  if (recurrenceMode === "interval_days" || recurrenceMode === "days") {
    recurrenceMode = "every_n_days";
  }

  const recurrenceValue = Number(scheduleConfig.documentedIntervalValue || scheduleConfig.recurrenceValue || 1);
  const weekdays = scheduleConfig.weekdays || [];
  const monthDays = scheduleConfig.monthDays || [];
  const anchor = anchorDateKey || todayKey;

  if (scheduleType === "event_driven") return false;

  if (scheduleType === "maintenance") {
    if (firstRunImmediately && !lastCompletedDateKey) {
      console.log("[shouldRunToday] Maintenance task - first run immediately");
      return true;
    }
    if (!lastCompletedDateKey) return false;
    
    const yearlyInterval = recurrenceMode === "yearly" ? (recurrenceValue || 1) * 365 : 365;
    const nextDue = addDays(lastCompletedDateKey, yearlyInterval);
    const due = todayKey >= nextDue;
    console.log("[shouldRunToday] Maintenance task - yearly check", { lastCompletedDateKey, nextDue, todayKey, due });
    return due;
  }

  if (todayKey < anchor) return false;

  if (recurrenceMode === "daily") return true;

  if (recurrenceMode === "every_n_days") {
    if (!lastCompletedDateKey) {
      console.log("[shouldRunToday] every_n_days - no completion, using anchor", { anchor, todayKey });
      const daysSinceAnchor = daysBetween(anchor, todayKey);
      const due = daysSinceAnchor % recurrenceValue === 0;
      console.log("[shouldRunToday] every_n_days from anchor", { daysSinceAnchor, recurrenceValue, due });
      return due;
    }
    const nextDue = addDays(lastCompletedDateKey, recurrenceValue);
    const due = todayKey >= nextDue;
    console.log("[shouldRunToday] every_n_days from last completion", { lastCompletedDateKey, nextDue, todayKey, recurrenceValue, due });
    return due;
  }

  if (recurrenceMode === "weekly_days") {
    if (weekdays.length === 0) return false;
    const weekday = getWeekdayFromDateKey(todayKey);
    return weekdays.includes(weekday);
  }

  if (recurrenceMode === "monthly") {
    if (monthDays.length === 0) return false;
    const day = Number(todayKey.slice(8, 10));
    return monthDays.includes(day);
  }

  if (recurrenceMode === "yearly") {
    if (!lastCompletedDateKey) {
      const daysSinceAnchor = daysBetween(anchor, todayKey);
      return daysSinceAnchor % 365 === 0;
    }
    const nextDue = addDays(lastCompletedDateKey, 365);
    return todayKey >= nextDue;
  }

  return false;
}

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
    deadlineAt: `${todayKey}T23:59:59`,
    overduePolicy: "end_of_day",
    overdueExplanationRequired: true
  };
}

/**
 * Resolver der kombinerer template scheduleConfig, location settings og unit overrides
 * til et normaliseret schedule-objekt klar til shouldRunToday().
 */
function resolveTemplateSchedule({
  template,
  locationTemperatureSettings = null,
  unitTemperatureControl = null,
  todayKey = null
}) {
  if (!template) return null;

  const templateKey = sanitizeString(template.templateKey || "", 80);
  const isTemperatureTemplate = templateKey === "temperature_control" || 
                                 (template.controlType || "").toLowerCase() === "temperature_check";

  // Regel 1: Hvis template har scheduleConfig, brug det som basis
  if (template.scheduleConfig && typeof template.scheduleConfig === "object") {
    const config = template.scheduleConfig;
    
    // Regel 3: Check unit override for temperature templates
    if (isTemperatureTemplate && unitTemperatureControl) {
      // Hvis unit er disabled, returner disabled schedule
      if (unitTemperatureControl.enabled === false) {
        return {
          enabled: false,
          useNewSchedule: true
        };
      }
      
      // Hvis unit har override og ikke bruger global schedule
      if (unitTemperatureControl.useGlobalSchedule === false && unitTemperatureControl.overrideSchedule) {
        const override = unitTemperatureControl.overrideSchedule;
        return {
          enabled: true,
          useNewSchedule: true,
          scheduleType: config.scheduleType || "operational",
          recurrenceMode: override.documentedIntervalMode || override.recurrenceMode || "every_n_days",
          recurrenceValue: Number(override.documentedIntervalValue || override.recurrenceValue || 7),
          anchorDate: override.anchorDate || (locationTemperatureSettings?.anchorDate) || todayKey,
          firstRunImmediately: config.firstRunImmediately === true,
          useDailyObservation: override.useDailyObservation !== false,
          weekdays: override.weekdays || [],
          monthDays: override.monthDays || []
        };
      }
    }
    
    // Regel 2: Temperature template med location settings
    if (isTemperatureTemplate && locationTemperatureSettings && locationTemperatureSettings.enabled !== false) {
      return {
        enabled: true,
        useNewSchedule: true,
        scheduleType: config.scheduleType || "operational",
        recurrenceMode: locationTemperatureSettings.documentedIntervalMode || config.documentedIntervalMode || "every_n_days",
        recurrenceValue: Number(locationTemperatureSettings.documentedIntervalValue || config.documentedIntervalValue || 7),
        anchorDate: locationTemperatureSettings.anchorDate || todayKey,
        firstRunImmediately: config.firstRunImmediately === true,
        useDailyObservation: locationTemperatureSettings.useDailyObservation !== false,
        weekdays: config.weekdays || [],
        monthDays: config.monthDays || []
      };
    }
    
    // Standard scheduleConfig uden overrides
    return {
      enabled: true,
      useNewSchedule: true,
      scheduleType: config.scheduleType || "operational",
      recurrenceMode: config.documentedIntervalMode || config.recurrenceMode || "daily",
      recurrenceValue: Number(config.documentedIntervalValue || config.recurrenceValue || 1),
      anchorDate: config.anchorDate || template.startDate || todayKey,
      firstRunImmediately: config.firstRunImmediately === true,
      useDailyObservation: config.useDailyObservation === true,
      weekdays: config.weekdays || [],
      monthDays: config.monthDays || []
    };
  }
  
  // Regel 4: Default schedule for templates without scheduleConfig.
  // Do not fall back to legacy isDueToday(), because that path can make
  // interval-based templates due too often when no completion exists yet.
  return {
    useNewSchedule: true,
    enabled: true,
    scheduleType: "operational",
    recurrenceMode: template.frequency || "every_n_days",
    recurrenceValue: 7,
    anchorDate: template.startDate || todayKey
  };
}

/**
 * Sikrer at en location har temperatureControlSettings med defaults.
 * Opretter eller fylder manglende felter uden at overskrive brugerdata.
 * 
 * @param {Object} db - Firestore database reference
 * @param {string} companyId - company ID
 * @param {string} locationId - location ID
 * @param {string} todayKey - dagens dateKey (YYYY-MM-DD) til anchorDate default
 * @returns {Promise<Object>} det endelige temperatureControlSettings objekt
 */
async function ensureLocationTemperatureSettings(db, companyId, locationId, todayKey) {
  if (!companyId || !locationId) {
    console.warn("[ensureLocationTemperatureSettings] missing companyId or locationId");
    return null;
  }

  const locationRef = db.collection("companies").doc(companyId)
    .collection("locations").doc(locationId);
  
  const locationSnap = await locationRef.get();
  
  if (!locationSnap.exists) {
    console.warn(`[ensureLocationTemperatureSettings] location ${locationId} does not exist`);
    return null;
  }

  const locationData = locationSnap.data() || {};
  const existing = locationData.temperatureControlSettings || {};

  // Default settings
  const defaults = {
    enabled: true,
    documentedIntervalMode: "every_n_days",
    documentedIntervalValue: 7,
    anchorDate: todayKey || getDateKey(),
    defaultTimes: ["09:00"],
    appliesTo: {
      fridge: true,
      freezer: true
    },
    useDailyObservation: true
  };

  // Merge: bevar eksisterende brugerdata, tilfÃ¸j kun manglende felter
  const merged = {
    enabled: existing.enabled !== undefined ? existing.enabled : defaults.enabled,
    documentedIntervalMode: existing.documentedIntervalMode || defaults.documentedIntervalMode,
    documentedIntervalValue: existing.documentedIntervalValue !== undefined 
      ? Number(existing.documentedIntervalValue) 
      : defaults.documentedIntervalValue,
    anchorDate: existing.anchorDate || defaults.anchorDate,
    defaultTimes: Array.isArray(existing.defaultTimes) && existing.defaultTimes.length > 0
      ? existing.defaultTimes
      : defaults.defaultTimes,
    appliesTo: existing.appliesTo && typeof existing.appliesTo === "object"
      ? { ...defaults.appliesTo, ...existing.appliesTo }
      : defaults.appliesTo,
    useDailyObservation: existing.useDailyObservation !== undefined 
      ? existing.useDailyObservation 
      : defaults.useDailyObservation
  };

  // Kun opdater hvis der er Ã¦ndringer
  const needsUpdate = JSON.stringify(existing) !== JSON.stringify(merged);
  
  if (needsUpdate) {
    await locationRef.update({
      temperatureControlSettings: merged,
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log(`[ensureLocationTemperatureSettings] Updated settings for location ${locationId}`);
  }

  return merged;
}

/**
 * Sikrer at temperature-relevante equipment units har temperatureControl med defaults.
 * Opretter eller fylder manglende felter uden at overskrive brugerdata.
 * 
 * @param {Object} db - Firestore database reference
 * @param {string} locationId - location ID
 * @param {Object} unit - equipment unit objekt
 * @returns {Promise<Object>} det normaliserede unit objekt med temperatureControl
 */
async function ensureEquipmentTemperatureControl(db, locationId, unit) {
  if (!unit || !unit.id) {
    console.warn("[ensureEquipmentTemperatureControl] missing unit or unit.id");
    return unit;
  }

  const unitType = sanitizeEquipmentType(unit.type || unit.equipmentType || "");
  
  // Kun relevante typer fÃ¥r temperatureControl
  const temperatureRelevantTypes = [
    "fridge", "freezer", "walk_in_cooler", "walk_in_freezer",
    "display_fridge", "isboks", "ice_machine", "softice_machine"
  ];
  
  if (!temperatureRelevantTypes.includes(unitType)) {
    return unit;
  }

  const existing = unit.temperatureControl || {};

  // Default settings
  const defaults = {
    enabled: true,
    useGlobalSchedule: true,
    useDailyObservation: true,
    overrideSchedule: null
  };

  // Merge: bevar eksisterende brugerdata, tilfÃ¸j kun manglende felter
  const merged = {
    enabled: existing.enabled !== undefined ? existing.enabled : defaults.enabled,
    useGlobalSchedule: existing.useGlobalSchedule !== undefined ? existing.useGlobalSchedule : defaults.useGlobalSchedule,
    useDailyObservation: existing.useDailyObservation !== undefined ? existing.useDailyObservation : defaults.useDailyObservation,
    overrideSchedule: existing.overrideSchedule || defaults.overrideSchedule
  };

  // Kun opdater hvis der er Ã¦ndringer
  const needsUpdate = JSON.stringify(existing) !== JSON.stringify(merged);
  
  if (needsUpdate) {
    const unitRef = db.collection("equipment").doc(unit.id);
    await unitRef.update({
      temperatureControl: merged,
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log(`[ensureEquipmentTemperatureControl] Updated temperatureControl for unit ${unit.id}`);
  }

  // Returner unit med opdateret temperatureControl
  return {
    ...unit,
    temperatureControl: merged
  };
}

//
// ðŸ”¹ HENT SENESTE FULDFÃ˜RTE
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
  const normalized = sanitizeString(value, 80).toLowerCase().replace(/[\s-]+/g, "_");
  const aliases = {
    "pÃ¥lÃ¦gsmaskine": "paalaegsmaskine",
    paalaegsmaskine: "paalaegsmaskine",
    slicer: "slicer",
    slicing_machine: "slicing_machine",
    softice: "softice_machine",
    softice_machine: "softice_machine",
    softice_maskine: "softice_machine",
    "softice-maskine": "softice_machine",
    ice_machine: "ice_machine",
    ismaskine: "ismaskine",
    isemaskine: "ismaskine",
    "is-maskine": "ismaskine",
    walkin_cooler: "walk_in_cooler",
    walkin_koeler: "walk_in_cooler",
    walkin_freezer: "walk_in_freezer",
    walkin_fryser: "walk_in_freezer",
    refrigerated_display: "display_fridge",
    koledisk: "display_fridge",
    hot_cabinet: "warming_cabinet",
    varmeskab: "warming_cabinet"
  };
  return aliases[normalized] || normalized;
}

/**
 * Beregner status for en temperaturtask ud fra threshold og mÃ¥lt temperatur.
 * @param {{ measuredTemperature?: number, thresholds?: { mode: string, value: number } }} opts
 * @returns {"ok" | "deviation" | "unknown"}
 */
function deriveTemperatureStatus({ measuredTemperature, thresholds } = {}) {
  if (measuredTemperature === null || measuredTemperature === undefined || typeof measuredTemperature !== "number") {
    return "unknown";
  }
  if (!thresholds || typeof thresholds.value !== "number") {
    return "unknown";
  }
  const mode  = thresholds.mode || "max";
  const limit = thresholds.value;
  if (mode === "max") return measuredTemperature <= limit ? "ok" : "deviation";
  if (mode === "min") return measuredTemperature >= limit ? "ok" : "deviation";
  return "unknown";
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
    fridge: "KÃ¸leskab",
    freezer: "Fryser",
    dishwasher: "Opvaskemaskine",
    warming_cabinet: "Varmeskab",
    blast_chiller: "Blast chiller",
    display_fridge: "DisplaykÃ¸l"
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

function getEquipmentByAnyType(equipmentByType, types = []) {
  const seen = new Set();
  const units = [];

  for (const rawType of types) {
    const type = sanitizeEquipmentType(rawType);
    const matches = equipmentByType[type] || [];
    for (const unit of matches) {
      if (!unit?.id || seen.has(unit.id)) continue;
      seen.add(unit.id);
      units.push(unit);
    }
  }

  return units;
}

function buildStartDayTargets({ template, templateDocId, equipmentByType, allEquipment, areas }) {
  const controlType = (template.controlType || "").toLowerCase();
  const docId = (templateDocId || "").toLowerCase();
  const routineType = sanitizeString(template.routineType || template.templateKey || template.taskKey || "", 120).toLowerCase();

  // If template is pinned to a specific unit, return only that unit (no cross-join)
  if (template.equipmentId) {
    const unit = allEquipment.find(u => u.id === template.equipmentId);
    if (!unit) return [];
    return [{
      suffix:        unit.id,
      equipmentId:   unit.id,
      equipmentType: unit.type,
      equipmentName: unit.displayName || unit.name || unit.id
    }];
  }

  const routineEquipmentTypes = {
    paalaegsmaskine_rengoering: ["slicer", "paalaegsmaskine", "slicing_machine"],
    softice_maskine_rengoering: ["softice_machine", "ice_machine", "ismaskine"]
  };

  if (routineEquipmentTypes[routineType]) {
    const units = getEquipmentByAnyType(equipmentByType, routineEquipmentTypes[routineType]);
    if (units.length === 0) return [];
    return units.map((u) => ({
      suffix:        u.id,
      equipmentId:   u.id,
      equipmentType: u.type,
      equipmentName: u.displayName || u.name || u.id
    }));
  }

  if (controlType === "temperature_check") {
    // Prefer explicit equipmentType on template, else infer from doc ID
    const templateEqType = sanitizeEquipmentType(template.equipmentType || "");
    let lookupKey = templateEqType;
    if (!lookupKey) {
      if (docId.includes("walk_in_cooler"))  lookupKey = "walk_in_cooler";
      else if (docId.includes("walk_in_freezer")) lookupKey = "walk_in_freezer";
      else if (docId.includes("display"))    lookupKey = "display_fridge";
      else if (docId.includes("softice"))    lookupKey = "softice_machine";
      else if (docId.includes("fridge"))     lookupKey = "fridge";
      else if (docId.includes("freezer"))    lookupKey = "freezer";
    }
    const units = lookupKey ? (equipmentByType[lookupKey] || []) : [];
    // ingen generisk fallback â€” hvis ingen units, skip template
    if (units.length === 0) return [];
    return units.map((u) => ({
      suffix:        u.id,
      equipmentId:   u.id,
      equipmentType: u.type,
      equipmentName: u.displayName || u.name || u.id
    }));
  }

  // Generic per-unit expansion: any template with explicit equipmentType (e.g. cleaning_check)
  const explicitEqType = sanitizeEquipmentType(template.equipmentType || "");
  if (explicitEqType) {
    const units = equipmentByType[explicitEqType] || [];
    if (units.length === 0) return [];
    return units.map((u) => ({
      suffix:        u.id,
      equipmentId:   u.id,
      equipmentType: u.type,
      equipmentName: u.displayName || u.name || u.id
    }));
  }

  return [{ suffix: "default" }];
}

function buildEquipmentSeedKey({ companyId, locationId, equipmentType, unitNumber }) {
  return [
    toDocSafeId(companyId || "company"),
    toDocSafeId(locationId || "location"),
    toDocSafeId(equipmentType || "equipment"),
    toPositiveInt(unitNumber) || 1
  ].join("__");
}

function buildEquipmentDocId({ companyId, locationId, equipmentType, unitNumber }) {
  return `onboarding__${buildEquipmentSeedKey({ companyId, locationId, equipmentType, unitNumber }).slice(0, 170)}`;
}

function parseEquipmentUnitNumberFromId(id = "", equipmentType = "") {
  const raw = String(id || "");
  const scopedMatch = raw.match(/__(\d+)$/);
  if (scopedMatch) return toPositiveInt(scopedMatch[1]);

  const legacyPrefix = `onboarding_${equipmentType}_`;
  if (equipmentType && raw.startsWith(legacyPrefix)) {
    return toPositiveInt(raw.slice(legacyPrefix.length));
  }

  const trailingMatch = raw.match(/_(\d+)$/);
  return trailingMatch ? toPositiveInt(trailingMatch[1]) : 0;
}

function buildEquipmentRuntimeFlags(equipmentType = "", controlTypes = []) {
  const type = sanitizeEquipmentType(equipmentType);
  const temperatureTypes = new Set([
    "fridge",
    "freezer",
    "walk_in_cooler",
    "walk_in_freezer",
    "display_fridge",
    "ice_box",
    "blast_chiller",
    "warming_cabinet",
    "softice_machine"
  ]);
  const limits = {
    fridge: { minTemp: 0, maxTemp: 5 },
    freezer: { minTemp: -30, maxTemp: -18 },
    walk_in_cooler: { minTemp: 0, maxTemp: 5 },
    walk_in_freezer: { minTemp: -30, maxTemp: -18 },
    display_fridge: { minTemp: 0, maxTemp: 5 },
    ice_box: { minTemp: -30, maxTemp: -18 },
    blast_chiller: { minTemp: 0, maxTemp: 5 },
    warming_cabinet: { minTemp: 65, maxTemp: null },
    softice_machine: { minTemp: 0, maxTemp: 5 }
  };
  const temperatureRequired = temperatureTypes.has(type) || controlTypes.includes("temperature_check");
  return {
    haccpRelevant: true,
    routineRelevant: true,
    temperatureRequired,
    minTemp: limits[type]?.minTemp ?? null,
    maxTemp: limits[type]?.maxTemp ?? null,
    cleaningRequired: true,
    cleaningFrequency: ["freezer", "walk_in_freezer", "ice_box"].includes(type) ? "monthly" : "weekly",
    serviceRequired: true,
    serviceFrequency: "yearly",
    calibrationRequired: temperatureRequired,
    calibrationFrequency: temperatureRequired ? "yearly" : ""
  };
}

// â”€â”€â”€ ONBOARDING EQUIPMENT SYNC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ EQUIPMENT-BASED CLEANING TEMPLATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Defines which equipment types should generate a per-unit cleaning task.
// controlType "cleaning_check" + explicit equipmentType triggers per-unit expansion.

const EQUIPMENT_CLEANING_TEMPLATE_DEFINITIONS = [
  { key: "cleaning_fridge_control",         equipmentType: "fridge",          titleBase: "RengÃ¸ringskontrol", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "RengÃ¸r og desinficÃ©r kÃ¸leskab grundigt. Fjern alle varer. RengÃ¸r hylder, skuffer og gummilister. TÃ¸r indvendigt tÃ¸rt. Placer varerne tilbage. KontrollÃ©r at dÃ¸ren lukker tÃ¦t." },
  { key: "cleaning_freezer_control",        equipmentType: "freezer",         titleBase: "RengÃ¸ringskontrol", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Afrim og rengÃ¸r fryser. Fjern alle varer og isbelÃ¦gning. RengÃ¸r indvendigt med godkendt middel. TÃ¸r af og sÃ¦t varerne tilbage. KontrollÃ©r temperatur efterfÃ¸lgende." },
  { key: "cleaning_fryer_control",          equipmentType: "fryer",           titleBase: "RengÃ¸ringskontrol", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Sluk og afkÃ¸l frituregryden. TÃ¸m og filtrer olien. RengÃ¸r kar, kurve og varmeelementet. KontrollÃ©r oliernes kvalitet (friture-test). Varm op til driftstemperatur igen." },
  { key: "cleaning_dishwasher_control",     equipmentType: "dishwasher",      titleBase: "RengÃ¸ringskontrol", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rens opvaskemaskinens filtre, arme og indre vÃ¦gge. KontrollÃ©r afkalkningsmiddel og skyllemiddel. KÃ¸r et tomt program. KontrollÃ©r skylletemperatur (min. 82Â°C)." },
  { key: "paalaegsmaskine_rengoering",      equipmentType: "slicer",          routineType: "paalaegsmaskine_rengoering", templateKey: "paalaegsmaskine_rengoering", titleBase: "PÃ¥lÃ¦gsmaskine rengÃ¸ring", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "RengÃ¸r og desinficÃ©r pÃ¥lÃ¦gsmaskinens kniv, slÃ¦de, afskÃ¦rmning og fÃ¸devarekontaktflader. KontrollÃ©r at der ikke er synlige madrester, fedt, belÃ¦gninger eller snavs, og at aftagelige dele er samlet korrekt." },
  { key: "softice_maskine_rengoering",      equipmentType: "softice_machine", routineType: "softice_maskine_rengoering", templateKey: "softice_maskine_rengoering", titleBase: "Ismaskine / softicemaskine rengÃ¸ring", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "RengÃ¸r og desinficÃ©r ismaskine eller softicemaskine efter virksomhedens plan og producentens anvisning. KontrollÃ©r kontaktflader, dyser, tappetud, beholdere, aftagelige dele og omrÃ¥det omkring maskinen." },
  { key: "cleaning_display_fridge_control", equipmentType: "display_fridge",  titleBase: "RengÃ¸ringskontrol", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "TÃ¸m displaykÃ¸l. RengÃ¸r hylder og vÃ¦gge indvendigt. KontrollÃ©r gummilister og lÃ¥ger. TÃ¸r af og fyld op med korrekt placerede varer. KontrollÃ©r temperatur." },
  { key: "cleaning_warming_cabinet_control",equipmentType: "warming_cabinet", titleBase: "RengÃ¸ringskontrol", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "RengÃ¸r varmeskab. Fjern mad-rester fra hylder og vÃ¦gge. RengÃ¸r med varmt vand og godkendt rengÃ¸ringsmiddel. TÃ¸r af. KontrollÃ©r varmeelementer og termostat." },
  { key: "cleaning_blast_chiller_control",  equipmentType: "blast_chiller",   titleBase: "RengÃ¸ringskontrol", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "RengÃ¸r blast chiller efter brug. Fjern alle madrester. RengÃ¸r indvendigt med godkendt middel. KontrollÃ©r fordamper for isophobning. TÃ¸r og klargÃ¸r til nÃ¦ste brug." },
];

async function syncEquipmentCleaningTemplates({ db: dbRef, companyId, locationId, ownerScopeMetadata = {} }) {
  if (!companyId || !locationId) {
    console.warn("[syncEquipmentCleaningTemplates] missing companyId or locationId, skipping");
    return { ok: false, created: 0 };
  }

  // Get active equipment types for this location
  const eqSnap = await dbRef.collection("equipment")
    .where("locationId", "==", locationId)
    .get();

  const activeTypes = new Set();
  for (const doc of eqSnap.docs) {
    const d = doc.data() || {};
    if (d.active === false) continue;
    const type = sanitizeEquipmentType(d.type || d.equipmentType || "");
    if (type) activeTypes.add(type);
  }

  if (activeTypes.has("paalaegsmaskine") || activeTypes.has("slicing_machine")) {
    activeTypes.add("slicer");
  }
  if (activeTypes.has("ice_machine") || activeTypes.has("ismaskine")) {
    activeTypes.add("softice_machine");
  }

  // Also check onboarding_answers fallback (same as startDayForLocation)
  if (activeTypes.size === 0) {
    try {
      const oaSnap = await dbRef.collection("onboarding_answers")
        .where("locationId", "==", locationId)
        .limit(1)
        .get();
      if (!oaSnap.empty) {
        const counts = oaSnap.docs[0].data()?.equipmentCounts || {};
        for (const [k, v] of Object.entries(counts)) {
          const n = Math.max(0, Math.floor(Number(v) || 0));
          if (n > 0) activeTypes.add(sanitizeEquipmentType(k));
        }
        if (activeTypes.has("paalaegsmaskine") || activeTypes.has("slicing_machine")) {
          activeTypes.add("slicer");
        }
        if (activeTypes.has("ice_machine") || activeTypes.has("ismaskine")) {
          activeTypes.add("softice_machine");
        }
      }
    } catch (_) { /* silent */ }
  }

  const nowTs = FieldValue.serverTimestamp();
  let created = 0;

  for (const def of EQUIPMENT_CLEANING_TEMPLATE_DEFINITIONS) {
    if (!activeTypes.has(def.equipmentType)) continue;

    const docId = `${companyId}_${locationId}_${def.key}`;
    const ref = dbRef.collection("task_templates").doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
      // Patch title if stale (e.g. old code stored equipment type in title)
      const existing = snap.data() || {};
      const patch = buildOwnerScopeUpdatePatch(existing, ownerScopeMetadata);
      if (existing.title !== def.titleBase) {
        patch.title = def.titleBase;
        patch.guideTitle = `Vejledning: ${def.titleBase}`;
      }
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = nowTs;
        await ref.update(patch);
      }
      continue;
    }

    await ref.set({
      templateId:    docId,
      id:            def.key,
      companyId,
      organizationId: companyId,
      locationId,
      ...ownerScopeMetadata,
      routineType:   def.routineType || def.key,
      templateKey:   def.templateKey || def.routineType || def.key,
      taskKey:       def.templateKey || def.routineType || def.key,
      title:         def.titleBase,
      displayTitle:  def.titleBase,
      templateTitle: def.titleBase,
      name:          def.titleBase,
      description:   def.guideBody || "",
      category:      def.category,
      controlType:   def.controlType,
      equipmentType: def.equipmentType,
      libraryType:   "operational",
      templateType:  "operational",
      templateSource: "equipment_cleaning_library",
      sourceType:    "equipment_cleaning_library",
      frequency:     def.frequency,
      frequencyType: def.frequency,
      frequencyDays: def.frequency === "weekly" ? 7 : 1,
      riskLevel:     def.riskLevel,
      fields:        [],
      rules:         [],
      actions:       { allowApprove: true, allowDeviation: true },
      guideTitle:    `Vejledning: ${def.titleBase}`,
      guideBody:     def.guideBody || "",
      schemaVersion: 1,
      isActive:      true,
      active:        true,
      createdAt:     nowTs,
      updatedAt:     nowTs,
    });
    created++;
    console.log(`[syncEquipmentCleaningTemplates] created ${docId}`);
  }

  console.log(`[syncEquipmentCleaningTemplates] done â€” created=${created}, activeTypes=${[...activeTypes].join(",")}`);
  return { ok: true, created };
}
// â”€â”€â”€ EQUIPMENT-BASED MAINTENANCE TEMPLATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Defines which equipment types should generate a per-unit maintenance task.
// controlType "maintenance_check" + explicit equipmentType triggers per-unit expansion.

const EQUIPMENT_MAINTENANCE_TEMPLATE_DEFINITIONS = [
  { key: "maintenance_fridge_control",        equipmentType: "fridge",          titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r kÃ¸leskab for mekaniske fejl. Tjek termostat, kompressor og ventilator. KontrollÃ©r gummilister og dÃ¸rlukning. Afrim om nÃ¸dvendigt. Rens kondensatorbakke." },
  { key: "maintenance_freezer_control",       equipmentType: "freezer",         titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r fryser for mekaniske fejl. Tjek termostat, kompressor og lÃ¥s. KontrollÃ©r gummilister. Afrim og rengÃ¸r kondensatorbakke." },
  { key: "maintenance_walk_in_cooler_control",equipmentType: "walk_in_cooler",  titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r walk-in kÃ¸ler. Tjek kompressor, fordamper, lys og dÃ¸rlukning. KontrollÃ©r pakninger og lÃ¥semekanisme. KontrollÃ©r gulvaflÃ¸b." },
  { key: "maintenance_walk_in_freezer_control",equipmentType: "walk_in_freezer",titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r walk-in fryser. Tjek kompressor, fordamper, lys og dÃ¸rlukning. AfgÃ¸rende: ingen isophobning pÃ¥ fordamper. KontrollÃ©r pakninger og lÃ¥semekanisme." },
  { key: "maintenance_fryer_control",         equipmentType: "fryer",           titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r frituregryde. Tjek termostat og sikkerhedsafbryder. KontrollÃ©r varmeelement og drÃ¦nsystem. KontrollÃ©r oliestanden og oliernes kvalitet." },
  { key: "maintenance_dishwasher_control",    equipmentType: "dishwasher",      titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r opvaskemaskine. Tjek skylletemperatur (min. 82Â°C), vandtryk og doseringssystem. Rens filtre og sprÃ¸jtearme. KontrollÃ©r tÃ¦tninger og lÃ¥ger." },
  { key: "maintenance_ice_machine_control",   equipmentType: "ice_machine",     titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r isterningemaskine. Tjek vandfilter og afkÃ¸lingssystem. KontrollÃ©r at ingen slim eller alger er synlige. Efterse vandindlÃ¸b og aflÃ¸b." },
  { key: "maintenance_blast_chiller_control", equipmentType: "blast_chiller",   titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r blast chiller. Tjek kompressor, fordamper og temperaturprobe. KontrollÃ©r dÃ¸rlukning og pakninger. KontrollÃ©r at fordamper er fri for isophobning." },
  { key: "maintenance_warming_cabinet_control",equipmentType: "warming_cabinet",titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r varmeskab. Tjek termostat og varmeelement. KontrollÃ©r temperaturjustering og dÃ¸rlukning. Eftersyn af pakninger og vandskuffe (ved dampvarmeskabe)." },
  { key: "maintenance_display_fridge_control",equipmentType: "display_fridge",  titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r displaykÃ¸l. Tjek kompressor, belysning og dÃ¸rlukning. KontrollÃ©r gummilister og hyldeplaceringer. Rens kondensatorgitter og kontrollÃ©r aflÃ¸b." },
  { key: "maintenance_softice_control",       equipmentType: "softice_machine", titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r softice-maskine. Tjek blandeenhed, pumper og seals. KontrollÃ©r temperatur og viskositet. KontrollÃ©r at sikkerhedstermostat fungerer korrekt." },
];

async function syncEquipmentMaintenanceTemplates({ db: dbRef, companyId, locationId, ownerScopeMetadata = {} }) {
  if (!companyId || !locationId) {
    console.warn("[syncEquipmentMaintenanceTemplates] missing companyId or locationId, skipping");
    return { ok: false, created: 0 };
  }

  const eqSnap = await dbRef.collection("equipment")
    .where("locationId", "==", locationId)
    .get();

  const activeTypes = new Set();
  for (const doc of eqSnap.docs) {
    const d = doc.data() || {};
    if (d.active === false) continue;
    const type = sanitizeEquipmentType(d.type || d.equipmentType || "");
    if (type) activeTypes.add(type);
  }

  if (activeTypes.size === 0) {
    try {
      const oaSnap = await dbRef.collection("onboarding_answers")
        .where("locationId", "==", locationId)
        .limit(1)
        .get();
      if (!oaSnap.empty) {
        const counts = oaSnap.docs[0].data()?.equipmentCounts || {};
        for (const [k, v] of Object.entries(counts)) {
          const n = Math.max(0, Math.floor(Number(v) || 0));
          if (n > 0) activeTypes.add(k.toLowerCase());
        }
      }
    } catch (_) { /* silent */ }
  }

  const nowTs = FieldValue.serverTimestamp();
  let created = 0;

  for (const def of EQUIPMENT_MAINTENANCE_TEMPLATE_DEFINITIONS) {
    if (!activeTypes.has(def.equipmentType)) continue;

    const docId = `${companyId}_${locationId}_${def.key}`;
    const ref = dbRef.collection("task_templates").doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
      const existing = snap.data() || {};
      const patch = buildOwnerScopeUpdatePatch(existing, ownerScopeMetadata);
      if (existing.title !== def.titleBase) {
        patch.title = def.titleBase;
        patch.guideTitle = `Vejledning: ${def.titleBase}`;
      }
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = nowTs;
        await ref.update(patch);
      }
      continue;
    }

    const freqConfig = parseFrequencyConfig({ frequency: def.frequency }, "frequency");
    await ref.set({
      templateId:     docId,
      id:             def.key,
      companyId,
      organizationId: companyId,
      locationId,
      ...ownerScopeMetadata,
      title:          def.titleBase,
      description:    def.guideBody || "",
      category:       def.category,
      controlType:    def.controlType,
      equipmentType:  def.equipmentType,
      libraryType:    "operational",
      templateType:   "operational",
      templateSource: "equipment_maintenance_library",
      sourceType:     "equipment_maintenance_library",
      frequency:      def.frequency,
      frequencyType:  freqConfig.type,
      frequencyDays:  freqConfig.days,
      interval_days:  freqConfig.days,
      riskLevel:      def.riskLevel,
      fields:         [],
      rules:          [],
      actions:        { allowApprove: true, allowDeviation: true },
      guideTitle:     `Vejledning: ${def.titleBase}`,
      guideBody:      def.guideBody || "",
      schemaVersion:  1,
      isActive:       true,
      active:         true,
      scheduleConfig: {
        scheduleType: "maintenance",
        recurrenceMode: "yearly",
        recurrenceValue: 1,
        firstRunImmediately: true,
        useDailyObservation: false
      },
      createdAt:      nowTs,
      updatedAt:      nowTs,
    });
    created++;
    console.log(`[syncEquipmentMaintenanceTemplates] created ${docId}`);
  }

  console.log(`[syncEquipmentMaintenanceTemplates] done â€” created=${created}, activeTypes=${[...activeTypes].join(",")}`);
  return { ok: true, created };
}

// â”€â”€â”€ AREA-BASEREDE RENGÃ˜RINGSRUTINER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Ã‰n template per rengÃ¸ringsomrÃ¥de afledt af onboarding_answers.areas[].
// templateSource = "area_cleaning_library"  templateType = "operational"

const AREA_CLEANING_DEFINITIONS = [
  { areaKey: "kitchen",              title: "RengÃ¸ring af kÃ¸kken",                  frequency: "daily",   riskLevel: "high",   guideBody: "RengÃ¸r og desinficÃ©r alle kÃ¸kkenoverflader: bordplader, gulv, vaskestationer og udstyr. Tjek at der er rene karklude. Tip affald ud. DokumentÃ©r udfÃ¸relse." },
  { areaKey: "production_kitchen",   title: "RengÃ¸ring af produktionskÃ¸kken",       frequency: "daily",   riskLevel: "high",   guideBody: "RengÃ¸r produktionsoverflader og -udstyr. Tip affaldsposer og skift. RengÃ¸r gulv, vask og drÃ¦n. KontrollÃ©r at ingen fÃ¸devareaffald er tilbage." },
  { areaKey: "serving_area",         title: "RengÃ¸ring af serveringsomrÃ¥de",        frequency: "daily",   riskLevel: "medium", guideBody: "RengÃ¸r borde, stole, buffet og serveringsstationer. RengÃ¸r gulv og sÃ¸rg for at alle overflader gÃ¦ster har kontakt med er rene." },
  { areaKey: "dry_storage",          title: "RengÃ¸ring af tÃ¸rlager",                frequency: "weekly",  riskLevel: "low",    guideBody: "RengÃ¸r hylder og gulv. KontrollÃ©r at alle varer er hÃ¦vet fra gulvet og korrekt opbevaret. KontrollÃ©r holdbarhedsdatoer. Tjek for skadedyr." },
  { areaKey: "toilet",               title: "RengÃ¸ring af toilet og hÃ¥ndvask",      frequency: "daily",   riskLevel: "high",   guideBody: "RengÃ¸r og desinficÃ©r toilet, hÃ¥ndvask og gulv. Fyld sÃ¦be og papirhÃ¥ndklÃ¦der op. KontrollÃ©r at der er hÃ¥ndsprit tilgÃ¦ngeligt for personale." },
  { areaKey: "dishwashing_area",     title: "RengÃ¸ring af opvaskomrÃ¥de",            frequency: "daily",   riskLevel: "medium", guideBody: "RengÃ¸r opvaskemaskine, bakkestativ og gulvaflÃ¸b. Tip madrester ud. KontrollÃ©r rengÃ¸ringsmidler og skyllemidler. Tjek at alle overflader er rene." },
  { areaKey: "washing_room",         title: "RengÃ¸ring af vaskerum",                frequency: "daily",   riskLevel: "medium", guideBody: "RengÃ¸r vaskerum og drÃ¦n. KontrollÃ©r at lagervarer er ryddeligt placeret og hÃ¦vet fra gulvet." },
  { areaKey: "vegetable_room",       title: "RengÃ¸ring af grÃ¸ntrum",                frequency: "daily",   riskLevel: "medium", guideBody: "RengÃ¸r hylder og gulv. Fjern blade og affald. Tjek at temperatur er korrekt (typisk 10â€“12Â°C). KontrollÃ©r at ingen rÃ¥d/mug pÃ¥ varer." },
  { areaKey: "walk_in_cooler_room",  title: "RengÃ¸ring af kÃ¸lerum",                 frequency: "daily",   riskLevel: "high",   guideBody: "RengÃ¸r gulv og hylder. Tjek at alle varer er korrekt dÃ¦kket og mÃ¦rket. KontrollÃ©r at gulvaflÃ¸bet ikke er tilstoppet. RengÃ¸r dÃ¸rpakninger." },
  { areaKey: "walk_in_freezer_room", title: "RengÃ¸ring af fryserum",                frequency: "weekly",  riskLevel: "medium", guideBody: "RengÃ¸r gulv og hylder. Tjek at alle varer er korrekt dÃ¦kket og mÃ¦rket. Afrim om nÃ¸dvendigt. KontrollÃ©r at dÃ¸r lukker tÃ¦t og pakninger er intakte." },
];

async function syncAreaCleaningTemplates({ db: dbRef, companyId, locationId, ownerScopeMetadata = {} }) {
  if (!companyId || !locationId) {
    console.warn("[syncAreaCleaningTemplates] missing companyId or locationId, skipping");
    return { ok: false, created: 0 };
  }

  // Hent areas fra onboarding_answers â€” lÃ¦s canonical doc direkte for at undgÃ¥ at ramme forkert doc
  const canonicalDocId = `${companyId}__${locationId}__onboarding`;
  const oaDoc = await dbRef.collection("onboarding_answers").doc(canonicalDocId).get();
  const oaData = oaDoc.exists ? oaDoc.data() : {};
  const areas = toArray(oaData.areas);

  // Fallback: alle lokationer har et kÃ¸kken
  const activeAreas = new Set(areas.length > 0 ? areas : ["kitchen"]);

  const nowTs = FieldValue.serverTimestamp();
  let created = 0, skipped = 0;

  for (const def of AREA_CLEANING_DEFINITIONS) {
    if (!activeAreas.has(def.areaKey)) continue;

    const docId = `${companyId}_${locationId}_area_cleaning_${def.areaKey}`;
    const ref   = dbRef.collection("task_templates").doc(docId);
    const snap  = await ref.get();
    if (snap.exists) {
      const patch = buildOwnerScopeUpdatePatch(snap.data() || {}, ownerScopeMetadata);
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = nowTs;
        await ref.update(patch);
      }
      skipped++;
      continue;
    }

    await ref.set({
      templateId:     docId,
      companyId,
      organizationId: companyId,
      locationId,
      ...ownerScopeMetadata,
      areaKey:        def.areaKey,
      title:          def.title,
      description:    def.guideBody,
      category:       "area_cleaning",
      controlType:    "cleaning_check",
      libraryType:    "operational",
      templateType:   "operational",
      templateSource: "area_cleaning_library",
      sourceType:     "area_cleaning_library",
      frequency:      def.frequency,
      frequencyType:  def.frequency,
      riskLevel:      def.riskLevel,
      fields:         [],
      rules:          [],
      actions:        { allowApprove: true, allowDeviation: true },
      guideTitle:     `Vejledning: ${def.title}`,
      guideBody:      def.guideBody,
      schemaVersion:  1,
      isActive:       true,
      active:         true,
      createdAt:      nowTs,
      updatedAt:      nowTs,
    });
    created++;
    console.log(`[syncAreaCleaningTemplates] created ${docId}`);
  }

  console.log(`[syncAreaCleaningTemplates] done â€” created=${created} skipped=${skipped} areas=${[...activeAreas].join(",")}`);
  return { ok: true, created, skipped };
}

// â”€â”€â”€ PROCES-BASEREDE DRIFTSOPGAVER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Ã‰n template per driftsopgave afledt af onboarding_answers.processes[].
// Visse opgaver genereres altid (datokontrol, adskillelse, luk dag).
// 3-timers regel genereres kun ved buffet/servering uden permanent kÃ¸l/varme.
// templateSource = "process_drift_library"

const PROCESS_DRIFT_TEMPLATE_DEFINITIONS = [
  {
    key:         "process_drift_varemodtagelse",
    title:       "Varemodtagelse",
    description: "KontrollÃ©r temperatur, emballage og holdbarhed ved modtagelse af fÃ¸devarer.",
    frequency:   "daily",
    category:    "modtagelse",
    controlType: "receiving_control",
    guideKey:    "receiving_goods",
    sortOrder:   10,
    alwaysInclude: true,
  },
  {
    key:         "process_drift_nedkoeling",
    title:       "NedkÃ¸ling",
    description: "KontrollÃ©r at varmebehandlede fÃ¸devarer nedkÃ¸les korrekt fra +65Â°C til under +10Â°C inden for 4 timer (lovkrav).",
    frequency:   "daily",
    category:    "nedkoeling",
    controlType: "cooling_process",
    guideKey:    "cooling_process",
    sortOrder:   20,
    alwaysInclude: false,
    requiresProcessAny: ["cool_food"],
  },
  {
    key:         "process_drift_varmholdelse",
    title:       "Varmholdelse",
    description: "KontrollÃ©r at varme retter holdes ved minimum 60Â°C og ikke varmholdes i mere end 3 timer.",
    frequency:   "daily",
    category:    "varmholdelse",
    controlType: "hot_holding",
    guideKey:    "hot_holding",
    sortOrder:   30,
    alwaysInclude: false,
    requiresProcessAny: ["hot_hold_food"],
  },
  {
    key:         "process_drift_opvarmning",
    title:       "Opvarmning",
    description: "KontrollÃ©r at genopvarmede fÃ¸devarer nÃ¥r minimum 75Â°C i kernen.",
    frequency:   "daily",
    category:    "opvarmning",
    controlType: "reheating_process",
    guideKey:    "hot_preparation_core_temperature",
    sortOrder:   40,
    alwaysInclude: false,
    requiresProcessAny: ["reheat_food", "cook_food"],
  },
  {
    key:         "process_drift_datokontrol",
    title:       "Datokontrol",
    description: "KontrollÃ©r holdbarhedsdatoer pÃ¥ alle opbevarede fÃ¸devarer. Fjern udgÃ¥ede varer og fÃ¸lg FIFO-princippet (fÃ¸rst ind, fÃ¸rst ud).",
    frequency:   "daily",
    category:    "drift",
    controlType: "date_control",
    guideKey:    "date_check",
    sortOrder:   50,
    alwaysInclude: true,
  },
  {
    key:         "process_drift_adskillelse",
    title:       "Adskillelse",
    description: "KontrollÃ©r korrekt adskillelse af rÃ¥ og tilberedte fÃ¸devarer i kÃ¸l, pÃ¥ arbejdsborde og med redskaber.",
    frequency:   "daily",
    category:    "drift",
    controlType: "separation_control",
    guideKey:    "separation_control",
    sortOrder:   60,
    alwaysInclude: true,
  },
  {
    key:         "process_drift_tre_timers_regel",
    title:       "3-timers regel",
    description: "KontrollÃ©r at fÃ¸devarer uden aktiv kÃ¸l eller varme ikke har stÃ¥et i farezonen (8â€“65Â°C) i mere end 3 timer.",
    frequency:   "daily",
    category:    "drift",
    controlType: "three_hour_rule",
    guideKey:    "three_hour_rule",
    sortOrder:   70,
    alwaysInclude: false,
    requiresProcessAny: ["serve_cold_food", "hot_hold_food"],
  },
];

async function syncProcessDriftTemplates({ db: dbRef, companyId, locationId, ownerScopeMetadata = {} }) {
  if (!companyId || !locationId) {
    console.warn("[syncProcessDriftTemplates] missing companyId or locationId, skipping");
    return { ok: false, created: 0, skipped: 0 };
  }

  // Hent aktive processes fra onboarding_answers (canonical doc)
  const canonicalDocId = `${companyId}__${locationId}__onboarding`;
  const oaDoc = await dbRef.collection("onboarding_answers").doc(canonicalDocId).get();
  const processes = oaDoc.exists ? (oaDoc.data().processes || []) : [];

  const nowTs = FieldValue.serverTimestamp();
  let created = 0, skipped = 0;

  for (const def of PROCESS_DRIFT_TEMPLATE_DEFINITIONS) {
    // Feature-flag: spring over hvis requiresProcessAny ikke er opfyldt
    if (!def.alwaysInclude && def.requiresProcessAny) {
      const hasAny = def.requiresProcessAny.some((p) => processes.includes(p));
      if (!hasAny) continue;
    }

    const docId = `${companyId}_${locationId}_${def.key}`;
    const ref   = dbRef.collection("task_templates").doc(docId);
    const snap  = await ref.get();

    if (snap.exists) {
      // Patch title/description hvis stale
      const existing = snap.data() || {};
      const patch = buildOwnerScopeUpdatePatch(existing, ownerScopeMetadata);
      if (existing.title !== def.title || existing.description !== def.description) {
        patch.title = def.title;
        patch.description = def.description;
      }
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = nowTs;
        await ref.update(patch);
      }
      skipped++;
      continue;
    }

    await ref.set({
      templateId:     docId,
      companyId,
      organizationId: companyId,
      locationId,
      ...ownerScopeMetadata,
      title:          def.title,
      description:    def.description,
      category:       def.category,
      controlType:    def.controlType,
      guideKey:       def.guideKey,
      libraryType:    "operational",
      templateType:   "operational",
      templateSource: "process_drift_library",
      sourceType:     "process_drift_library",
      frequency:      def.frequency,
      frequencyType:  def.frequency,
      frequencyDays:  1,
      riskLevel:      "medium",
      sortOrder:      def.sortOrder || 100,
      fields:         [],
      rules:          [],
      actions:        { allowApprove: true, allowDeviation: true },
      guideTitle:     `Vejledning: ${def.title}`,
      guideBody:      def.description,
      schemaVersion:  1,
      isActive:       true,
      active:         true,
      createdAt:      nowTs,
      updatedAt:      nowTs,
    });
    created++;
    console.log(`[syncProcessDriftTemplates] created ${docId}`);
  }

  console.log(`[syncProcessDriftTemplates] done â€” created=${created} skipped=${skipped}`);
  return { ok: true, created, skipped };
}

// â”€â”€â”€ VANDKONTROL RUTINER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Ã‰n template per vandroutine. drikkevand og filter er altid aktive.
// isterningemaskine genereres kun hvis ice_machine-udstyr er registreret.
// controlType "water_control" â†’ specifik UI-formular i rutiner.html

const WATER_CONTROL_TEMPLATE_DEFINITIONS = [
  {
    key:            "water_control_drikkevand",
    title:          "Kontrol af drikkevand",
    description:    "KontrollÃ©r drikkevandets udseende (klar/uklar), lugt og smag. MÃ¥l temperatur hvis relevant (koldt vand max 12Â°C, varmt min 55Â°C). NotÃ©r visuel status og eventuelle afvigelser.",
    frequency:      "daily",
    category:       "vandkontrol",
    controlType:    "water_control",
    guideKey:       "water_control",
    riskLevel:      "high",
    alwaysInclude:  true,
  },
  // REMOVED: water_control_isterningemaskine
  // Ice machines are covered by softice_maskine_rengoering in EQUIPMENT_CLEANING_TEMPLATE_DEFINITIONS.
  // Water control for ice machines is redundant and creates duplicate routines.
  {
    key:            "water_control_filter",
    title:          "Kontrol af vandfilter",
    description:    "InspicÃ©r vandfilter for tilstopning eller misfarvning. KontrollÃ©r filtrets levetid og udskiftningsdato. NotÃ©r filterets aktuelle status.",
    frequency:      "weekly",
    category:       "vandkontrol",
    controlType:    "water_control",
    guideKey:       "water_control",
    riskLevel:      "medium",
    alwaysInclude:  true,
  },
];

async function syncWaterControlTemplates({ db: dbRef, companyId, locationId, ownerScopeMetadata = {} }) {
  if (!companyId || !locationId) {
    console.warn("[syncWaterControlTemplates] missing companyId or locationId, skipping");
    return { ok: false, created: 0, skipped: 0 };
  }

  // Hent aktive equipment types for isterningemaskine-check
  const eqSnap = await dbRef.collection("equipment")
    .where("locationId", "==", locationId)
    .get();

  const activeEquipmentTypes = new Set();
  for (const doc of eqSnap.docs) {
    const d = doc.data() || {};
    if (d.active === false) continue;
    const type = sanitizeEquipmentType(d.type || d.equipmentType || "");
    if (type) activeEquipmentTypes.add(type);
  }

  // Fallback: check onboarding_answers for equipment counts
  if (activeEquipmentTypes.size === 0) {
    try {
      const oaSnap = await dbRef.collection("onboarding_answers")
        .where("locationId", "==", locationId)
        .limit(1)
        .get();
      if (!oaSnap.empty) {
        const counts = oaSnap.docs[0].data()?.equipmentCounts || {};
        for (const [k, v] of Object.entries(counts)) {
          const n = Math.max(0, Math.floor(Number(v) || 0));
          if (n > 0) activeEquipmentTypes.add(k.toLowerCase());
        }
      }
    } catch (_) { /* silent */ }
  }

  const nowTs = FieldValue.serverTimestamp();
  let created = 0, skipped = 0;

  for (const def of WATER_CONTROL_TEMPLATE_DEFINITIONS) {
    // Skip equipment-gated templates if equipment not present
    if (!def.alwaysInclude && def.requiresEquipmentAny) {
      const hasAny = def.requiresEquipmentAny.some((t) => activeEquipmentTypes.has(t));
      if (!hasAny) continue;
    }

    const docId = `${companyId}_${locationId}_${def.key}`;
    const ref = dbRef.collection("task_templates").doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
      const existing = snap.data() || {};
      const patch = buildOwnerScopeUpdatePatch(existing, ownerScopeMetadata);
      if (existing.title !== def.title || existing.description !== def.description) {
        patch.title = def.title;
        patch.description = def.description;
      }
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = nowTs;
        await ref.update(patch);
      }
      skipped++;
      continue;
    }

    const freqConfig = parseFrequencyConfig({ frequency: def.frequency }, "frequency");
    await ref.set({
      templateId:     docId,
      companyId,
      organizationId: companyId,
      locationId,
      ...ownerScopeMetadata,
      title:          def.title,
      description:    def.description,
      category:       def.category,
      controlType:    def.controlType,
      guideKey:       def.guideKey,
      libraryType:    "operational",
      templateType:   "operational",
      templateSource: "water_control_library",
      sourceType:     "water_control_library",
      frequency:      def.frequency,
      frequencyType:  freqConfig.type,
      frequencyDays:  freqConfig.days,
      riskLevel:      def.riskLevel,
      fields:         [],
      rules:          [],
      actions:        { allowApprove: true, allowDeviation: true },
      guideTitle:     `Vejledning: ${def.title}`,
      guideBody:      def.description,
      schemaVersion:  1,
      isActive:       true,
      active:         true,
      createdAt:      nowTs,
      updatedAt:      nowTs,
    });
    created++;
    console.log(`[syncWaterControlTemplates] created ${docId}`);
  }

  console.log(`[syncWaterControlTemplates] done â€” created=${created} skipped=${skipped}`);
  return { ok: true, created, skipped };
}

const EQUIPMENT_COUNT_MAPPING = [
  { countKeys: ["fridge", "fridgeCount", "antalKoeleskabe"],                equipmentType: "fridge",          titleBase: "KÃ¸leskab",          controlTypes: ["temperature_check"] },
  { countKeys: ["freezer", "freezerCount", "antalFrysere"],                 equipmentType: "freezer",         titleBase: "Fryser",            controlTypes: ["temperature_check"] },
  { countKeys: ["walk_in_cooler", "walkinCoolerCount", "walkInCooler", "walkInCoolerCount"],     equipmentType: "walk_in_cooler",   titleBase: "Walk-in kÃ¸ler",     controlTypes: ["temperature_check"] },
  { countKeys: ["walk_in_freezer", "walkinFreezerCount", "walkInFreezer", "walkInFreezerCount"],  equipmentType: "walk_in_freezer",  titleBase: "Walk-in fryser",    controlTypes: ["temperature_check"] },
  { countKeys: ["ice_machine", "iceMachine", "antalIsterningemaskiner"],    equipmentType: "ice_machine",      titleBase: "Isterningemaskine", controlTypes: [] },
  { countKeys: ["ice_box", "isboks", "antalIsbokse"],                       equipmentType: "ice_box",          titleBase: "Isboks",            controlTypes: ["temperature_check"] },
  { countKeys: ["fryer", "antalFrityreGryder"],                             equipmentType: "fryer",            titleBase: "Frituregryden",     controlTypes: [] },
  { countKeys: ["dishwasher", "dishwasherCount", "antalOpvaskemaskiner"],   equipmentType: "dishwasher",       titleBase: "Opvaskemaskine",    controlTypes: [] },
  { countKeys: ["oven", "ovenCount", "antalOvne"],                          equipmentType: "oven",             titleBase: "Ovn",               controlTypes: [] },
  { countKeys: ["stove", "stoveCount", "antalKomfurer"],                    equipmentType: "stove",            titleBase: "Komfur",            controlTypes: [] },
  { countKeys: ["blast_chiller", "blastChiller", "antalBlastChillere"],     equipmentType: "blast_chiller",    titleBase: "Blast chiller",     controlTypes: ["temperature_check"] },
  { countKeys: ["warming_cabinet", "hotCabinetCount", "warmingCabinet", "antalVarmeskabe"],    equipmentType: "warming_cabinet",  titleBase: "Varmeskab",         controlTypes: ["temperature_check"] },
  { countKeys: ["display_fridge", "refrigeratedDisplayCount", "displayFridge", "antalDisplaykoele"],   equipmentType: "display_fridge",   titleBase: "DisplaykÃ¸l",        controlTypes: ["temperature_check"] },
  { countKeys: ["slicer", "slicerCount", "antalPaalaegsmaskiner"],          equipmentType: "slicer",           titleBase: "PÃ¥lÃ¦gsmaskine",    controlTypes: [] },
  { countKeys: ["smoke_oven", "smokeOvenCount", "antalRoegeovne"],          equipmentType: "smoke_oven",       titleBase: "RÃ¸geovn",          controlTypes: ["temperature_check"] },
  { countKeys: ["proofing_cabinet", "proofingCabinetCount", "antalRasteskabe"], equipmentType: "proofing_cabinet", titleBase: "Rasteskab", controlTypes: [] },
  { countKeys: ["softice_machine", "softiceMachine"],                       equipmentType: "softice_machine",  titleBase: "Softice maskine",   controlTypes: ["temperature_check"] },
];

function normalizeEquipmentCounts(rawCounts = {}, profile = {}) {
  const result = {};
  for (const mapping of EQUIPMENT_COUNT_MAPPING) {
    let count = 0;
    for (const key of mapping.countKeys) {
      const val = rawCounts[key] != null ? rawCounts[key] : profile[key];
      if (val != null) {
        count = toPositiveInt(val);
        break;
      }
    }
    // Boolean fallbacks for single-unit types
    if (count === 0 && mapping.equipmentType === "walk_in_cooler" && profile.hasWalkInCooler) count = 1;
    if (count === 0 && mapping.equipmentType === "walk_in_freezer" && profile.hasWalkInFreezer) count = 1;
    if (count === 0 && mapping.equipmentType === "ice_machine"     && profile.hasIceMachine)    count = 1;
    if (count === 0 && mapping.equipmentType === "softice_machine" && profile.hasSofticeachine) count = 1;
    if (count === 0 && mapping.equipmentType === "ice_box"         && profile.hasIsboks)        count = 1;
    result[mapping.equipmentType] = count;
  }
  return result;
}

async function syncOnboardingEquipmentUnits({ db: dbRef, companyId, locationId, equipmentCounts = {}, profile = {}, ownerScopeMetadata = {} }) {
  if (!companyId || !locationId) {
    console.warn("[syncOnboardingEquipmentUnits] missing companyId or locationId, skipping");
    return { ok: false, error: "missing companyId or locationId" };
  }
  console.log("[syncOnboardingEquipmentUnits] start", { companyId, locationId });

  const normalizedCounts = normalizeEquipmentCounts(equipmentCounts, profile);
  console.log("[syncOnboardingEquipmentUnits] normalizedCounts", normalizedCounts);

  const existingSnap = await dbRef
    .collection("equipment")
    .where("locationId", "==", locationId)
    .where("source", "==", "onboarding")
    .get();

  const existingById = new Map();
  const existingBySeedKey = new Map();
  const existingByType = new Map();
  for (const doc of existingSnap.docs) {
    const data = doc.data() || {};
    const itemCompanyId = sanitizeString(data.companyId || data.organizationId, 120);
    if (itemCompanyId && itemCompanyId !== companyId) continue;
    const itemType = sanitizeEquipmentType(data.type || data.equipmentType || "");
    const unitNumber = toPositiveInt(data.unitNumber) || parseEquipmentUnitNumberFromId(doc.id, itemType);
    const entry = { id: doc.id, ref: doc.ref, data, type: itemType, unitNumber };
    existingById.set(doc.id, entry);
    if (data.seedKey) existingBySeedKey.set(String(data.seedKey), entry);
    if (!existingByType.has(itemType)) existingByType.set(itemType, []);
    existingByType.get(itemType).push(entry);
  }

  const batch = dbRef.batch();
  let created = 0, updated = 0, deactivated = 0, kept = 0;
  const equipmentIds = [];
  const nowTs = FieldValue.serverTimestamp();

  for (const mapping of EQUIPMENT_COUNT_MAPPING) {
    const count = normalizedCounts[mapping.equipmentType] || 0;
    const { equipmentType, titleBase, controlTypes } = mapping;

    // Upsert active units 1..count
    for (let i = 1; i <= count; i++) {
      const seedKey = buildEquipmentSeedKey({ companyId, locationId, equipmentType, unitNumber: i });
      const scopedDocId = buildEquipmentDocId({ companyId, locationId, equipmentType, unitNumber: i });
      const legacyDocId = `onboarding_${equipmentType}_${i}`;
      const title = `${titleBase} ${i}`;
      const existing = existingBySeedKey.get(seedKey) || existingById.get(scopedDocId) || existingById.get(legacyDocId);
      const docId = existing?.id || scopedDocId;
      const ref = existing?.ref || dbRef.collection("equipment").doc(docId);
      const runtimeFlags = buildEquipmentRuntimeFlags(equipmentType, controlTypes);
      const payload = {
        companyId,
        organizationId: companyId,
        locationId,
        ...ownerScopeMetadata,
        source: "onboarding",
        onboardingSource: existing?.data?.onboardingSource || "quick_onboarding",
        equipmentId: docId,
        seedKey,
        equipmentType,
        type: equipmentType,
        controlTypes,
        controlType: controlTypes[0] || "",
        title,
        name: title,
        displayName: title,
        unitNumber: i,
        active: true,
        isActive: true,
        ...runtimeFlags,
        updatedAt: nowTs
      };

      if (existing) {
        batch.set(ref, payload, { merge: true });
        if (existing.data.active === false) { updated++; } else { kept++; }
      } else {
        batch.set(ref, { ...payload, createdAt: nowTs });
        created++;
        console.log(`[syncOnboardingEquipmentUnits] created ${docId}`);
      }
      equipmentIds.push(docId);
    }

    // Deactivate units above current count
    for (const existing of existingByType.get(equipmentType) || []) {
      if (toPositiveInt(existing.unitNumber) > count && existing.data.active !== false) {
        batch.set(existing.ref, { active: false, isActive: false, updatedAt: nowTs }, { merge: true });
        deactivated++;
        console.log(`[syncOnboardingEquipmentUnits] deactivated ${existing.id}`);
      }
    }
  }

  await batch.commit();
  
  // Ensure temperature-relevant units have temperatureControl settings
  let tempControlUpdated = 0;
  for (const equipmentId of equipmentIds) {
    try {
      const unitRef = dbRef.collection("equipment").doc(equipmentId);
      const unitSnap = await unitRef.get();
      if (unitSnap.exists) {
        const unitData = unitSnap.data() || {};
        const normalizedUnit = await ensureEquipmentTemperatureControl(dbRef, locationId, {
          id: equipmentId,
          ...unitData
        });
        
        // Only update if temperatureControl was added/changed
        if (normalizedUnit.temperatureControl && 
            JSON.stringify(unitData.temperatureControl) !== JSON.stringify(normalizedUnit.temperatureControl)) {
          await unitRef.update({
            temperatureControl: normalizedUnit.temperatureControl,
            updatedAt: FieldValue.serverTimestamp()
          });
          tempControlUpdated++;
        }
      }
    } catch (tempErr) {
      console.warn(`[syncOnboardingEquipmentUnits] ensureEquipmentTemperatureControl failed for ${equipmentId}:`, tempErr.message);
    }
  }
  
  if (tempControlUpdated > 0) {
    console.log(`[syncOnboardingEquipmentUnits] Added temperatureControl to ${tempControlUpdated} units`);
  }
  
  // Create temperature control templates for all active units
  const units = [];
  for (const equipmentId of equipmentIds) {
    const unitSnap = await dbRef.collection("equipment").doc(equipmentId).get();
    if (unitSnap.exists) {
      const unitData = unitSnap.data() || {};
      units.push({
        id: equipmentId,
        name: unitData.name || unitData.title,
        type: unitData.type || unitData.equipmentType
      });
    }
  }
  
  if (units.length > 0) {
    console.log(`[syncOnboardingEquipmentUnits] Creating temperature templates for ${units.length} units`);
    await ensureEgenkontrolTaskTemplates({
      db: dbRef,
      companyId,
      locationId,
      units,
      ownerScopeMetadata
    });
  }
  
  const summary = { ok: true, created, updated, deactivated, kept, equipmentIds, tempControlUpdated };
  console.log("[syncOnboardingEquipmentUnits] summary", summary);
  return summary;
}

exports.saveLocationEquipmentUnits = functions.https.onCall(async (request, context) => {
  const data = request.data || request;

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vÃ¦re logget ind.");
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
  }

  const userData = await getUserAccessProfile({
    uid: context.auth.uid,
    email: context.auth.token?.email || ""
  });

  if (!userData) {
    throw new functions.https.HttpsError("permission-denied", "Brugerprofil blev ikke fundet.");
  }

  const role = sanitizeString(userData.role || "", 80).toLowerCase();
  if (role !== "owner") {
    throw new functions.https.HttpsError("permission-denied", "Kun owner kan redigere enheder.");
  }

  const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 120);
  if (!userCompanyId || userCompanyId !== companyId) {
    throw new functions.https.HttpsError("permission-denied", "Adgang til companyId afvist.");
  }

  const allowedLocationIds = getUserLocationIds(userData);
  if (allowedLocationIds.length > 0 && !allowedLocationIds.includes(locationId)) {
    throw new functions.https.HttpsError("permission-denied", "Adgang til locationId afvist.");
  }

  const supportedTypeMap = new Map(
    EQUIPMENT_COUNT_MAPPING.map((item) => [sanitizeEquipmentType(item.equipmentType), item])
  );
  const inputUnits = Array.isArray(data?.units) ? data.units : [];

  const existingSnap = await db
    .collection("equipment")
    .where("locationId", "==", locationId)
    .where("source", "==", "onboarding")
    .get();

  const existingById = new Map();
  const existingByType = new Map();

  for (const docSnap of existingSnap.docs) {
    const item = docSnap.data() || {};
    const itemCompanyId = sanitizeString(item.companyId || item.organizationId, 120);
    const itemType = sanitizeEquipmentType(item.type || item.equipmentType || "");
    if (itemCompanyId !== companyId || !supportedTypeMap.has(itemType)) continue;

    let unitNumber = toPositiveInt(item.unitNumber);
    if (!unitNumber) {
      unitNumber = parseEquipmentUnitNumberFromId(docSnap.id, itemType);
    }

    const entry = {
      id: docSnap.id,
      ref: docSnap.ref,
      data: item,
      type: itemType,
      unitNumber
    };

    existingById.set(docSnap.id, entry);
    if (!existingByType.has(itemType)) existingByType.set(itemType, []);
    existingByType.get(itemType).push(entry);
  }

  for (const entries of existingByType.values()) {
    entries.sort((left, right) => (left.unitNumber || 0) - (right.unitNumber || 0));
  }

  const reservedIds = new Set();
  const desiredUnits = [];

  for (const rawUnit of inputUnits) {
    const type = sanitizeEquipmentType(rawUnit?.type || "");
    if (!supportedTypeMap.has(type)) continue;

    const id = sanitizeString(rawUnit?.id || "", 180);
    const active = rawUnit?.active !== false;
    const name = sanitizeString(rawUnit?.name || rawUnit?.displayName || "", 140);

    if (id) reservedIds.add(id);
    desiredUnits.push({ id, type, active, name });
  }

  const reusableInactiveByType = new Map();
  const maxNumberByType = new Map();

  for (const [type, entries] of existingByType.entries()) {
    reusableInactiveByType.set(
      type,
      entries.filter((entry) => entry.data.active === false && !reservedIds.has(entry.id))
    );
    maxNumberByType.set(
      type,
      entries.reduce((maxValue, entry) => Math.max(maxValue, toPositiveInt(entry.unitNumber)), 0)
    );
  }

  const batch = db.batch();
  const nowTs = FieldValue.serverTimestamp();
  const normalizedUnits = [];
  let created = 0;
  let updated = 0;
  let deactivated = 0;
  let kept = 0;

  for (const desired of desiredUnits) {
    let existing = desired.id ? existingById.get(desired.id) : null;

    if (existing && existing.type !== desired.type) {
      throw new functions.https.HttpsError("invalid-argument", "Enhedstype matcher ikke eksisterende enhed.");
    }

    let unitNumber = toPositiveInt(existing?.unitNumber);
    let docId = existing?.id || "";

    if (!docId) {
      const reusablePool = reusableInactiveByType.get(desired.type) || [];
      const reusable = reusablePool.shift() || null;
      if (reusable) {
        existing = reusable;
        docId = reusable.id;
        unitNumber = toPositiveInt(reusable.unitNumber);
      } else {
        unitNumber = (maxNumberByType.get(desired.type) || 0) + 1;
        maxNumberByType.set(desired.type, unitNumber);
        docId = buildEquipmentDocId({
          companyId,
          locationId,
          equipmentType: desired.type,
          unitNumber
        });
      }
    }

    if (!unitNumber) {
      unitNumber = parseEquipmentUnitNumberFromId(docId, desired.type);
    }
    if (!unitNumber) {
      unitNumber = (maxNumberByType.get(desired.type) || 0) + 1;
      maxNumberByType.set(desired.type, unitNumber);
    }

    const meta = supportedTypeMap.get(desired.type);
    const fallbackName = `${meta.titleBase} ${unitNumber}`;
    const displayName = desired.name || fallbackName;
    const nextActive = desired.active !== false;
    const ref = existing?.ref || db.collection("equipment").doc(docId);
    const seedKey = buildEquipmentSeedKey({
      companyId,
      locationId,
      equipmentType: desired.type,
      unitNumber
    });

    batch.set(ref, {
      companyId,
      organizationId: companyId,
      locationId,
      source: "onboarding",
      onboardingSource: existing?.data?.onboardingSource || "equipment_page",
      equipmentId: docId,
      seedKey,
      equipmentType: desired.type,
      type: desired.type,
      controlTypes: meta.controlTypes,
      controlType: meta.controlTypes[0] || "",
      title: displayName,
      name: displayName,
      displayName,
      unitNumber,
      active: nextActive,
      isActive: nextActive,
      ...buildEquipmentRuntimeFlags(desired.type, meta.controlTypes),
      updatedAt: nowTs,
      ...(existing ? {} : { createdAt: nowTs })
    }, { merge: true });

    normalizedUnits.push({
      id: docId,
      type: desired.type,
      active: nextActive,
      name: displayName,
      unitNumber
    });

    if (!existing) {
      created++;
    } else if (!nextActive && existing.data.active !== false) {
      deactivated++;
    } else {
      const previousName = sanitizeString(
        existing.data.displayName || existing.data.name || existing.data.title || "",
        140
      );
      const wasActive = existing.data.active !== false;
      if (previousName !== displayName || wasActive !== nextActive) {
        updated++;
      } else {
        kept++;
      }
    }
  }

  await batch.commit();

  const activeUnits = normalizedUnits
    .filter((unit) => unit.active !== false)
    .sort((left, right) => {
      if (left.type !== right.type) return left.type.localeCompare(right.type, "da");
      return (left.unitNumber || 0) - (right.unitNumber || 0);
    })
    .map((unit) => ({
      id: unit.id,
      type: unit.type,
      name: unit.name,
      displayName: unit.name
    }));

  const equipmentCounts = {};
  for (const key of supportedTypeMap.keys()) {
    equipmentCounts[key] = 0;
  }
  for (const unit of activeUnits) {
    equipmentCounts[unit.type] = (equipmentCounts[unit.type] || 0) + 1;
  }

  await db.collection("onboarding_answers").doc(`${companyId}__${locationId}__onboarding`).set({
    companyId,
    organizationId: companyId,
    locationId,
    equipmentCounts,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const liveProfileRef = db.collection("live_user_profiles").doc(`${companyId}__${locationId}__live_profile`);
  const liveProfileSnap = await liveProfileRef.get();
  if (liveProfileSnap.exists) {
    await liveProfileRef.set({
      onboardingAnswers: {
        ...(liveProfileSnap.data()?.onboardingAnswers || {}),
        equipmentCounts
      },
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  try {
    const todayKey = new Date().toISOString().slice(0, 10);
    await ensureLocationTemperatureSettings(db, companyId, locationId, todayKey);
  } catch (tempErr) {
    console.error("[saveLocationEquipmentUnits] ensureLocationTemperatureSettings failed:", tempErr.message);
  }

  for (const unit of activeUnits) {
    try {
      await ensureEquipmentTemperatureControl(db, locationId, unit);
    } catch (tempErr) {
      console.warn(`[saveLocationEquipmentUnits] ensureEquipmentTemperatureControl failed for ${unit.id}:`, tempErr.message);
    }
  }

  await ensureEgenkontrolTaskTemplates({
    db,
    companyId,
    locationId,
    units: activeUnits
  });

  await syncEquipmentCleaningTemplates({ db, companyId, locationId });
  await syncEquipmentMaintenanceTemplates({ db, companyId, locationId });
  await syncWaterControlTemplates({ db, companyId, locationId });

  return {
    ok: true,
    companyId,
    locationId,
    created,
    updated,
    deactivated,
    kept,
    equipmentCounts,
    activeUnitCount: activeUnits.length
  };
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      toPositiveInt(counts["køleskab"]) ||
      toPositiveInt(counts["køleskabe"]),
    freezers:
      toPositiveInt(counts.freezer) ||
      toPositiveInt(counts.freezers) ||
      toPositiveInt(counts.fryser) ||
      toPositiveInt(counts.frysere)
  };
}

function createTaskTemplate(templateId, schema, schemaKey, unit, companyId, locationId, userId, userEmail, nowIso, formType, frequency, frequencyDays, customTitle = null, cleaningArea = null) {
  // TRACE LOGGING - PROBLEM A - v2
  console.log(`[createTaskTemplate] INPUT: schemaKey=${schemaKey}, schema.titleKey=${schema.titleKey}, schema.descriptionKey=${schema.descriptionKey}, customTitle=${customTitle}`);
  
  // Danish title and description mappings
  const schemaTitles = {
    'varemodtagelse': 'Varemodtagelse af kÃ¸le- og frostvarer',
    'koel_frost': 'Temperaturkontrol af kÃ¸le- og frostudstyr',
    'opvarmning': 'Opvarmning og genopvarmning',
    'varmholdelse': 'Varmholdelse af tilberedte retter',
    'nedkoeling': 'NedkÃ¸ling af varmbehandlede fÃ¸devarer',
    'rengoering': 'RengÃ¸ring og hygiejne',
    'adskillelse': 'Adskillelse og krydskontaminering',
    'opvaskemaskine': 'Opvaskemaskine - kontrol og rengÃ¸ring'
  };
  
  const schemaDescriptions = {
    'varemodtagelse': 'Kontroller temperatur, emballage og kvalitet ved modtagelse af kÃ¸le- og frostvarer. Registrer temperatur og eventuelle afvigelser.',
    'koel_frost': 'Daglig temperaturkontrol af kÃ¸leskabe og frysere. Temperaturen skal vÃ¦re max 5Â°C for kÃ¸l og max -18Â°C for frost.',
    'opvarmning': 'Kontroller at kernetemperaturen nÃ¥r minimum 75Â°C i mindst 2 minutter ved opvarmning og genopvarmning af fÃ¸devarer.',
    'varmholdelse': 'Varmholdte retter skal holdes ved minimum 65Â°C. Kontroller temperaturen regelmÃ¦ssigt.',
    'nedkoeling': 'NedkÃ¸l varmebehandlede fÃ¸devarer fra +65Â°C til under +10Â°C pÃ¥ maksimalt 4 timer (lovkrav). Registrer start- og sluttidspunkt samt temperaturer.',
    'rengoering': 'Daglig rengÃ¸ring og hygiejnekontrol af arbejdsflader, udstyr og lokaler. FÃ¸lg rengÃ¸ringsplanen.',
    'adskillelse': 'Kontroller adskillelse mellem rÃ¥varer og fÃ¦rdige produkter. Brug separate redskaber og skÃ¦rebrÃ¦tter.',
    'opvaskemaskine': 'Kontroller opvaskemaskinens temperatur og rengÃ¸ring. Skylletemperatur skal vÃ¦re minimum 82Â°C.'
  };
  
  const title = customTitle || schemaTitles[schemaKey] || schemaKey;
  
  let description = schemaDescriptions[schemaKey] || '';
  
  if (schemaKey === 'koel_frost' && unit) {
    if (unit.type === 'fridge') {
      description = 'Kontroller og registrer temperaturen for dette kÃ¸leskab. Temperaturen mÃ¥ hÃ¸jst vÃ¦re 5Â°C.';
    } else if (unit.type === 'freezer') {
      description = 'Kontroller og registrer temperaturen for denne fryser. Temperaturen skal vÃ¦re -18Â°C eller koldere.';
    } else if (unit.type === 'ice_machine') {
      description = 'Kontroller renhed, drift og temperaturforhold for denne isterningemaskine.';
    }
  }
  
  // TRACE LOGGING - PROBLEM A
  console.log(`[createTaskTemplate] OUTPUT: final title="${title}", final description="${description}"`);
  if (title.includes('schema.') || title.includes('skema')) {
    console.error(`[createTaskTemplate] ERROR: Title contains i18n key! title="${title}"`);
  }
  if (description.includes('schema.') || description.includes('skema')) {
    console.error(`[createTaskTemplate] ERROR: Description contains i18n key! description="${description}"`);
  }
  
  return {
    id: templateId,
    companyId,
    organizationId: companyId,
    locationId,
    title,
    description,
    category: schema.key || 'egenkontrol',
    frequency,
    frequencyType: frequency,
    frequencyDays,
    registrationFrequency: frequency,
    registrationFrequencyType: frequency,
    registrationFrequencyDays: frequencyDays,
    riskLevel: schema.isCCP ? 'high' : 'medium',
    isCCP: schema.isCCP || false,
    ccpNumber: schema.ccpNumber || 0,
    isGAG: schema.isGAG || false,
    controlPoint: schema.controlPointKey || '',
    formType,
    fields: [],
    alertRules: [],
    sourceType: 'egenkontrol_program',
    templateType: 'operational',
    templateSource: 'egenkontrol_generator',
    egenkontrolSchemaKey: schemaKey,
    criticalLimits: schema.criticalLimits || {},
    equipmentUnit: unit ? {
      id: unit.id,
      type: unit.type,
      name: unit.fallbackName,
      limits: unit.limits
    } : null,
    cleaningArea: cleaningArea,
    active: true,
    isActive: true,
    createdBy: userId,
    createdByName: userEmail,
    updatedBy: userId,
    generatedAt: nowIso,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function ensureEgenkontrolTaskTemplates({
  db,
  companyId,
  locationId,
  units = [],
  ownerScopeMetadata = {}
}) {
  const templatesRef = db.collection("task_templates");

  async function createTemplateIfNotExists(template) {
    const docRef = templatesRef.doc(template.templateId);
    const snap = await docRef.get();
    if (snap.exists) {
      const existing = snap.data() || {};
      const patch = buildOwnerScopeUpdatePatch(existing, ownerScopeMetadata);
      if (!existing.templateType || existing.templateType !== "operational") {
        patch.templateType = "operational";
      }

      for (const field of [
        "routineType",
        "routineKey",
        "taskKey",
        "equipmentId",
        "equipmentType",
        "equipmentName",
        "unitId",
        "unitName"
      ]) {
        if (template[field] && !existing[field]) patch[field] = template[field];
      }

      if (template.equipmentUnit && !existing.equipmentUnit) {
        patch.equipmentUnit = template.equipmentUnit;
      }

      if (Object.keys(patch).length > 0) {
        patch.updatedAt = new Date();
        await docRef.update(patch);
        console.log(`[ensureEgenkontrolTaskTemplates] Updated equipment metadata for ${template.templateId}`);
      }
      return;
    }
    await docRef.set(template);
    console.log(`[ensureEgenkontrolTaskTemplates] Created ${template.templateId}`);
  }

  const baseMeta = {
    companyId,
    locationId,
    ...ownerScopeMetadata,
    templateType: "operational",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const temperatureRoutineByType = {
    fridge: "koeleskab_temperatur",
    freezer: "fryser_temperatur",
    walk_in_cooler: "walkin_koeler_temperatur",
    walk_in_freezer: "walkin_fryser_temperatur",
    display_fridge: "koledisk_temperatur",
    blast_chiller: "blaesekoeler_temperatur",
    warming_cabinet: "varmeskab_temperatur",
    softice_machine: "softice_temperatur_kontrol",
    dishwasher: "opvaskemaskine_skyllevand"
  };

  const cleaningRoutineByType = {
    fridge: "koeleskab_rengoering",
    freezer: "fryser_rengoering",
    walk_in_cooler: "walkin_koeler_rengoering",
    walk_in_freezer: "walkin_fryser_rengoering",
    display_fridge: "koledisk_rengoering",
    blast_chiller: "blaesekoeler_rengoering",
    warming_cabinet: "varmeskab_rengoering",
    dishwasher: "opvaskemaskine_rengoering",
    fryer: "friture_rengoering",
    friture: "friture_rengoering",
    slicer: "paalaegsmaskine_rengoering",
    paalaegsmaskine: "paalaegsmaskine_rengoering",
    softice_machine: "softice_maskine_rengoering",
    ice_machine: "softice_maskine_rengoering",
    oven: "ovn_rengoering",
    stove: "komfur_rengoering",
    smoke_oven: "roegeovn_rengoering",
    proofing_cabinet: "rasteskab_rengoering"
  };

  // TEMPERATUR PER UNIT
  for (const unit of units) {
    const unitType = sanitizeEquipmentType(unit.type || unit.equipmentType || "");
    const unitId = sanitizeString(unit.id || unit.equipmentId || "", 180);
    if (!unitId || !unitType) continue;

    let guideKey = null;
    let cleanGuideKey = null;
    const label = unit.name || unit.displayName || unit.equipmentName || "Enhed";
    const equipmentMeta = {
      equipmentId: unitId,
      equipmentType: unitType,
      equipmentName: label,
      unitId,
      unitName: label,
      equipmentUnit: unitId
    };
    const temperatureRoutineKey = temperatureRoutineByType[unitType] || "";
    const cleaningRoutineKey = cleaningRoutineByType[unitType] || "";

    if (unitType === "fridge")           { guideKey = "fridge_temperature";          cleanGuideKey = "cleaning_control"; }
    if (unitType === "freezer")          { guideKey = "freezer_temperature";         cleanGuideKey = "cleaning_control"; }
    if (unitType === "walk_in_cooler")   { guideKey = "walkin_cooler_temperature";   cleanGuideKey = "cleaning_control"; }
    if (unitType === "walk_in_freezer")  { guideKey = "walk_in_freezer_temperature"; cleanGuideKey = "cleaning_control"; }
    if (unitType === "ice_machine")      { guideKey = "ice_machine_cleaning";        cleanGuideKey = "ice_machine_cleaning"; }
    if (unitType === "ice_box" || unitType === "isboks") { guideKey = "freezer_temperature"; cleanGuideKey = "cleaning_control"; }
    if (unitType === "fryer" || unitType === "friture")  { cleanGuideKey = "friture_control"; }
    if (unitType === "dishwasher")       { guideKey = "dishwasher_control";          cleanGuideKey = "cleaning_control"; }
    if (unitType === "blast_chiller")    { guideKey = "blast_chiller_temperature";   cleanGuideKey = "cleaning_control"; }
    if (unitType === "display_fridge")   { guideKey = "display_fridge_temperature";  cleanGuideKey = "cleaning_control"; }
    if (unitType === "warming_cabinet")  { guideKey = "warming_cabinet_temperature"; cleanGuideKey = "cleaning_control"; }
    if (unitType === "softice_machine")  { guideKey = "softice_temperature";         cleanGuideKey = "softice_machine_cleaning"; }
    if (unitType === "oven" || unitType === "stove" || unitType === "smoke_oven" || unitType === "proofing_cabinet") {
      cleanGuideKey = "cleaning_control";
    }

    // Temperaturrutine (kun for kÃ¸le/fryse-enheder og friture)
    if (guideKey && temperatureRoutineKey && unitType !== "ice_machine") {
      const description = unitType === "blast_chiller"
        ? "Intern skÃ¦rpet kontrol: NedkÃ¸l til under +5Â°C inden for 90 min (ikke lovkrav)"
        : "Kontroller og registrer temperatur";
      
      await createTemplateIfNotExists({
        templateId: `${companyId}__${locationId}__temp__${unitId}`,
        ...baseMeta,
        templateKey: temperatureRoutineKey,
        taskKey: temperatureRoutineKey,
        routineKey: temperatureRoutineKey,
        routineType: temperatureRoutineKey,
        title: `Temperaturkontrol â€“ ${label}`,
        description: description,
        guideKey,
        frequency: "daily",
        ...equipmentMeta,
        scheduleConfig: {
          scheduleType: "operational",
          recurrenceMode: "every_n_days",
          recurrenceValue: 7,
          firstRunImmediately: false,
          useDailyObservation: true
        }
      });
    }

    // RengÃ¸ringsrutine per enhed
    if (cleanGuideKey && cleaningRoutineKey) {
      await createTemplateIfNotExists({
        templateId: `${companyId}__${locationId}__clean__${unitId}`,
        ...baseMeta,
        templateKey: cleaningRoutineKey,
        taskKey: cleaningRoutineKey,
        routineKey: cleaningRoutineKey,
        routineType: cleaningRoutineKey,
        title: `RengÃ¸ring â€“ ${label}`,
        description: `RengÃ¸r og desinficer ${label.toLowerCase()} grundigt`,
        guideKey: cleanGuideKey,
        frequency: unitType === "fridge" || unitType === "freezer" || unitType === "ice_box" || unitType === "isboks" ? "weekly" : "daily",
        ...equipmentMeta
      });
    }
  }

  // LOG A: After template creation/update
  const tempTemplateCount = units.filter(u => 
    u.type === "fridge" || u.type === "freezer" || u.type === "walk_in_cooler" || 
    u.type === "walk_in_freezer" || u.type === "isboks" || u.type === "friture" || u.type === "blast_chiller"
  ).length;
  
  console.log(`[LOG A - ensureEgenkontrolTaskTemplates] Temperature templates processed: ${tempTemplateCount}`);
  for (const unit of units) {
    if (unit.type === "fridge" || unit.type === "freezer" || unit.type === "walk_in_cooler" || 
        unit.type === "walk_in_freezer" || unit.type === "isboks" || unit.type === "friture" || unit.type === "blast_chiller") {
      const templateId = `${companyId}__${locationId}__temp__${unit.id}`;
      console.log(`[LOG A] Temperature template: ${templateId}`, {
        title: `Temperaturkontrol â€“ ${unit.name || "Enhed"}`,
        templateType: "operational",
        unitId: unit.id,
        unitType: unit.type,
        unitName: unit.name
      });
    }
  }
  
  return { ok: true };
}

// â”€â”€â”€ START-DAY IDEMPOTENCY HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const INSTANCE_COMPARABLE_FIELDS = [
  "companyId", "locationId", "dateKey",
  "templateId", "taskId",
  "equipmentId", "equipmentType", "equipmentName",
  "title", "description",
  "controlType", "category", "formType",
  "areaId", "areaType",
  "status",
  "requiresMeasurement", "requiresRegistration", "registrationDeferred",
  "deadlineAt", "overduePolicy", "overdueExplanationRequired",
  "frequency", "frequencyType", "frequencyDays",
  "completedAt", "completedBy", "completedByName",
  "isCCP", "riskLevel", "visibility", "sortOrder",
  "fields", "alertRules", "criticalLimits", "thresholds",
  "guideKey", "templateType", "templateSource", "sourceType"
];

function stableNormalize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && !Array.isArray(value) && value.constructor?.name === "Timestamp") {
    // Firestore Timestamp â€” convert to ms for stable comparison
    return typeof value.toMillis === "function" ? value.toMillis() : String(value);
  }
  if (Array.isArray(value)) {
    return value.map(stableNormalize).sort((a, b) => {
      const sa = JSON.stringify(a) || "";
      const sb = JSON.stringify(b) || "";
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
  }
  if (typeof value === "object") {
    const sorted = {};
    for (const k of Object.keys(value).sort()) sorted[k] = stableNormalize(value[k]);
    return sorted;
  }
  return value;
}

function buildComparableInstancePayload(data) {
  const out = {};
  for (const field of INSTANCE_COMPARABLE_FIELDS) {
    out[field] = stableNormalize(data[field] !== undefined ? data[field] : null);
  }
  return out;
}

function materiallyEqualInstance(existingDocData, nextData) {
  const a = buildComparableInstancePayload(existingDocData || {});
  const b = buildComparableInstancePayload(nextData || {});
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffComparableFields(existingComparable, nextComparable) {
  const changed = [];
  for (const field of INSTANCE_COMPARABLE_FIELDS) {
    if (JSON.stringify(existingComparable[field]) !== JSON.stringify(nextComparable[field])) {
      changed.push(field);
    }
  }
  return changed;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Helper: Unified rule for daily routine template filtering
function shouldGenerateDailyRoutineTemplate(template) {
  const templateSource = template.templateSource || template.source || "";
  const templateType = (template.templateType || "").toLowerCase();
  const category = (template.category || "").toLowerCase();
  const controlType = (template.controlType || "").toLowerCase();
  const taskType = (template.taskType || "").toLowerCase();
  const guideKey = (template.guideKey || "").toLowerCase();
  const title = (template.title || "").toLowerCase();

  const blocked = (
    templateSource === "equipment_maintenance_library" ||
    templateType === "maintenance" ||
    category === "vedligeholdelse" ||
    controlType === "maintenance_check" ||
    taskType === "vedligeholdelse" ||
    title.startsWith("vedligeholdelse -") ||
    title.includes("drikkevand")
  );

  if (blocked) return false;

  return templateType === "operational";
}

// Updated: 2026-04-09 - New schedule-based task generation

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

  // Ensure location has temperature control settings for new schedule system
  let locationTemperatureSettings = null;
  try {
    locationTemperatureSettings = await ensureLocationTemperatureSettings(db, companyId, locationId, todayKey);
  } catch (err) {
    console.warn("[startDayForLocation] ensureLocationTemperatureSettings failed:", err.message);
  }

  const runRef = db.collection("daily_runs").doc(runId);
  const runSnap = await runRef.get();
  const alreadyStarted = runSnap.exists;

  const operatingMode = await getOperatingModeForLocation({
    companyId,
    locationId,
    todayKey
  });

  if (operatingMode === "closed") {
    return {
      ok: false,
      blocked: true,
      message: "Lokationen er lukket. Automatiske rutiner er sat pÃ¥ pause for i dag."
    };
  }

  if (operatingMode === "vacation") {
    return {
      ok: false,
      blocked: true,
      message: "Lokationen er i ferie-mode. Automatiske rutiner er sat pÃ¥ pause for i dag."
    };
  }

  // ðŸ”¹ hent templates (kun operational - ikke verification)
  // Templates skal allerede eksistere (genereret via checkout eller adminReprovisionEquipment)
  const allTemplateDocs = await loadActiveTaskTemplates({ companyId, locationId });
  
  // LOG B: After templates are loaded
  console.log(`[LOG B - startDayForLocation] Templates total: ${allTemplateDocs.length}`);
  const tempTemplatesLoaded = allTemplateDocs.filter(doc => {
    const t = doc.data();
    const id = doc.id || "";
    const title = (t.title || "").toLowerCase();
    const guideKey = (t.guideKey || "").toLowerCase();
    const templateKey = (t.templateKey || "").toLowerCase();
    return title.includes("temperatur") || guideKey.includes("temperature") || 
           templateKey === "temperature_control" || id.includes("__temp__");
  });
  console.log(`[LOG B] Temperature templates loaded: ${tempTemplatesLoaded.length}`);
  tempTemplatesLoaded.forEach(doc => {
    const t = doc.data();
    console.log(`[LOG B] Loaded temp template: ${doc.id}`, {
      title: t.title,
      templateType: t.templateType,
      templateKey: t.templateKey,
      guideKey: t.guideKey,
      equipmentUnit: t.equipmentUnit,
      scheduleConfig: t.scheduleConfig
    });
  });
  
  const hasUnitSpecificKoelFrost = allTemplateDocs.some(doc => {
    const id = doc.id || "";
    return id.includes("egenkontrol_koel_frost__") && (id.includes("fridge_") || id.includes("freezer_") || id.includes("ice_machine_"));
  });
  
  const filterResults = new Map();
  const templateDocs = allTemplateDocs.filter(doc => {
    const template = doc.data();
    const id = doc.id || "";
    
    // ðŸš« Fjern gamle auto templates
    if (id.includes("auto_task")) {
      filterResults.set(id, "DROP: auto_task");
      return false;
    }
    
    // ðŸš« Fjern gamle KCP templates (ikke aggregerede)
    if (id.includes("kcp_") && !template.isAggregated) {
      filterResults.set(id, "DROP: kcp without aggregation");
      return false;
    }
    
    // ðŸš« Ekstra sikkerhed: fjern hvis title indikerer gammel struktur
    const title = (template.title || "").toLowerCase();
    if (title.includes("kcp") && !template.isAggregated) {
      filterResults.set(id, "DROP: kcp in title without aggregation");
      return false;
    }
    
    // ðŸš« Fjern generisk koel_frost template hvis der findes unit-specifikke templates
    if (hasUnitSpecificKoelFrost && id.match(/egenkontrol_koel_frost$/) && !id.includes("__fridge_") && !id.includes("__freezer_") && !id.includes("__ice_machine_")) {
      console.log(`[egenkontrol] Skipping legacy generic koel_frost template: ${id}`);
      filterResults.set(id, "DROP: legacy generic koel_frost");
      return false;
    }
    
    // âœ… Use unified daily routine filter
    const passed = shouldGenerateDailyRoutineTemplate(template);
    if (passed) {
      filterResults.set(id, "KEEP: passed shouldGenerateDailyRoutineTemplate");
    } else {
      const templateType = (template.templateType || "").toLowerCase();
      filterResults.set(id, `DROP: shouldGenerateDailyRoutineTemplate returned false (templateType='${templateType}')`);
    }
    return passed;
  });
  
  // LOG C: After filter is applied
  console.log(`[LOG C - startDayForLocation] Templates after filter: ${templateDocs.length}`);
  tempTemplatesLoaded.forEach(doc => {
    const result = filterResults.get(doc.id) || "UNKNOWN";
    console.log(`[LOG C] Temperature template filter result: ${doc.id} -> ${result}`);
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

  const equipmentByType = {};
  const allEquipment = [];
  const equipmentUnitMap = new Map();

  for (const equipmentDoc of equipmentSnap.docs) {
    const equipment = equipmentDoc.data() || {};
    if (equipment.active === false) continue;
    const type = sanitizeEquipmentType(equipment.type || equipment.equipmentType);
    const normalized = {
      id: equipmentDoc.id,
      type,
      name: sanitizeString(equipment.name || equipment.displayName || equipment.equipmentName, 140),
      displayName: sanitizeString(equipment.displayName || equipment.name || equipment.equipmentName, 140),
      temperatureControl: equipment.temperatureControl || null
    };

    // Ensure temperature-relevant units have temperatureControl settings
    try {
      const normalizedUnit = await ensureEquipmentTemperatureControl(db, locationId, normalized);
      if (normalizedUnit.temperatureControl) {
        normalized.temperatureControl = normalizedUnit.temperatureControl;
      }
    } catch (err) {
      console.warn(`[startDayForLocation] ensureEquipmentTemperatureControl failed for ${normalized.id}:`, err.message);
    }

    equipmentUnitMap.set(normalized.id, normalized);
    if (!equipmentByType[type]) equipmentByType[type] = [];
    equipmentByType[type].push(normalized);
    allEquipment.push(normalized);
  }

  // Legacy compat keys (used by fallback logic and buildStartDayTargets inference)
  if (!equipmentByType.fridge)   equipmentByType.fridge   = allEquipment.filter((x) => x.type.includes("fridge") || x.type.includes("koleskab") || x.type.includes("kÃ¸leskab"));
  if (!equipmentByType.freezer)  equipmentByType.freezer  = allEquipment.filter((x) => x.type.includes("freezer") || x.type.includes("fryser"));
  if (!equipmentByType.slicer) equipmentByType.slicer = allEquipment.filter((x) => x.type === "slicer");
  if (!equipmentByType.paalaegsmaskine) equipmentByType.paalaegsmaskine = allEquipment.filter((x) => x.type === "paalaegsmaskine");
  if (!equipmentByType.slicing_machine) equipmentByType.slicing_machine = allEquipment.filter((x) => x.type === "slicing_machine");
  if (!equipmentByType.softice_machine) equipmentByType.softice_machine = allEquipment.filter((x) => x.type === "softice_machine");
  if (!equipmentByType.ice_machine) equipmentByType.ice_machine = allEquipment.filter((x) => x.type === "ice_machine");
  if (!equipmentByType.ismaskine) equipmentByType.ismaskine = allEquipment.filter((x) => x.type === "ismaskine");

  // Fallback: brug onboarding counts hvis equipment docs ikke er oprettet endnu.
  if (equipmentByType.fridge.length === 0 || equipmentByType.freezer.length === 0) {
    try {
      const counts = await getOnboardingEquipmentCounts({ companyId, locationId });

      const syntheticEquipment = buildSyntheticEquipmentFromCounts(counts.rawCounts || {});
      for (const equipment of syntheticEquipment) {
        const alreadyExists = allEquipment.some((item) => item.id === equipment.id);
        if (alreadyExists) continue;
        allEquipment.push(equipment);
        const stype = equipment.type || "";
        if (!equipmentByType[stype]) equipmentByType[stype] = [];
        equipmentByType[stype].push(equipment);
      }

      if (equipmentByType.fridge.length === 0 && counts.fridges > 0) {
        equipmentByType.fridge = allEquipment.filter((item) => item.type.includes("fridge") || item.type.includes("koleskab") || item.type.includes("kÃ¸leskab"));
      }

      if (equipmentByType.freezer.length === 0 && counts.freezers > 0) {
        equipmentByType.freezer = allEquipment.filter((item) => item.type.includes("freezer") || item.type.includes("fryser"));
      }
    } catch (error) {
      console.warn("Kunne ikke lÃ¦se equipmentCounts fra onboarding_answers:", error);
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
  let skippedCount = 0;
  let ensuredCount = 0;
  let newScheduleCount = 0;
  let legacyScheduleCount = 0;
  let disabledUnitCount = 0;
  const existingTaskMap = await getExistingTaskInstanceMap({ companyId, locationId, todayKey });

  for (const doc of templateDocs) {
    const template = doc.data();
    const baseTaskId = sanitizeString(
      template.taskId || template.id || doc.id,
      120
    ) || doc.id;

    // âœ… Use unified daily routine filter
    if (!shouldGenerateDailyRoutineTemplate(template)) {
      console.log("[startDayForLocation] SKIP blocked template", {
        templateId: template.id || null,
        title: template.title || null,
        templateType: template.templateType || null,
        templateSource: template.templateSource || null,
        category: template.category || null
      });
      continue;
    }

    const targets = buildStartDayTargets({
      template,
      templateDocId: doc.id,
      equipmentByType,
      allEquipment,
      areas
    });

    for (const target of targets) {
      const baseTitle = sanitizeString(template.title, 220) || "Rutine";
      // Don't append equipment name if template is already pinned to a specific unit
      // (the title was built with the unit name already embedded)
      const scopedTitle = (target.equipmentName && !template.equipmentId)
        ? `${baseTitle} - ${target.equipmentName}`
        : baseTitle;

      const scopedTaskId = target.suffix && target.suffix !== "default"
        ? `${baseTaskId}__${target.suffix}`
        : baseTaskId;

      // Resolve schedule configuration combining template, location and unit settings
      const equipmentUnitId = target.equipmentId || template.equipmentUnit || template.equipmentId || "";
      const unitForTemplate = equipmentUnitId ? equipmentUnitMap.get(equipmentUnitId) : null;
      
      const resolvedSchedule = resolveTemplateSchedule({
        template,
        locationTemperatureSettings,
        unitTemperatureControl: unitForTemplate?.temperatureControl || null,
        todayKey
      });

      // Check if unit is disabled - skip task creation if so
      if (resolvedSchedule && resolvedSchedule.enabled === false) {
        disabledUnitCount++;
        continue;
      }

      const lastCompleted = await getLastCompleted(scopedTaskId, locationId);
      
      // Use new schedule system if available, otherwise fallback to legacy
      let due = false;
      if (resolvedSchedule && resolvedSchedule.useNewSchedule) {
        newScheduleCount++;
        const anchorDate = resolvedSchedule.anchorDate || locationTemperatureSettings?.anchorDate || todayKey;
        due = shouldRunToday(resolvedSchedule, todayKey, anchorDate, lastCompleted);
      } else {
        legacyScheduleCount++;
        due = isDueToday(template, todayKey, lastCompleted, "frequency");
      }
      
      const registrationDue = isDueToday(template, todayKey, lastCompleted, "registrationFrequency");
      
      // Debug logging for schedule consistency validation
      console.log("[SCHEDULE_DEBUG]", {
        templateId: template.id || doc.id,
        title: template.title || null,
        category: template.category || null,
        frequency: template.frequency || null,
        registrationFrequency: template.registrationFrequency || null,
        scheduleConfig: template.scheduleConfig || null,
        lastCompleted: lastCompleted || null,
        due,
        registrationDue
      });
      
      if (!due) {
        console.log("[SCHEDULE_DROP_NOT_DUE]", {
          templateId: template.id || doc.id,
          title: template.title || null,
          frequency: template.frequency || null,
          registrationFrequency: template.registrationFrequency || null,
          lastCompleted: lastCompleted || null
        });
        continue;
      }

      const deadlineMeta = buildTaskDeadlineMeta(template, todayKey);

      const formType = sanitizeString(template.formType, 60).toLowerCase();
      const templateRequiresMeasurement = template.requiresMeasurement === true || formType === "temperature";
      const requiresMeasurementToday = templateRequiresMeasurement && registrationDue;

      const equipmentId = target.equipmentId || template.equipmentId || "";
      const instanceId  = equipmentId
        ? `${doc.id}__${equipmentId}__${todayKey}`
        : `${doc.id}__${todayKey}`;
      const uniqueKey  = instanceId;
      const existing   = existingTaskMap.get(uniqueKey) || null;
      const ref        = existing?.ref || db.collection("task_instances").doc(instanceId);
      const existingData = existing?.data || {};
      const existingStatus = sanitizeString(existingData.status, 40) || "pending";
      const isClosedLegacyStatus = ["completed", "failed", "not_in_use"].includes(existingStatus);
      const nextActiveUntilDateKey = normalizeDateKey(existingData.activeUntilDateKey) || addDays(todayKey, 7);

      const instanceData = {
        ...template,
        companyId,
        organizationId: companyId,
        locationId,
        taskId: doc.id,
        title: scopedTitle,
        description: template.description || '',
        templateId: doc.id,
        dateKey: todayKey,
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
        status: isClosedLegacyStatus ? existingStatus : (existingStatus === "active" || existingStatus === "open" ? existingStatus : "pending"),
        activeUntilDateKey: nextActiveUntilDateKey,
        entryCount: Number(existingData.entryCount || 0),
        lastEntryAt: existingData.lastEntryAt || null,
        lastEntryStatus: existingData.lastEntryStatus || "",
        completedAt: isClosedLegacyStatus ? existingData.completedAt || null : null,
        completedBy: isClosedLegacyStatus ? existingData.completedBy || "" : "",
        completedByName: isClosedLegacyStatus ? existingData.completedByName || "" : "",
        createdAt: existingData.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      if (!existing) {
        batch.set(ref, instanceData, { merge: true });
        createdCount++;
        console.log("[startDay] create instance", { instanceId });
      } else if (materiallyEqualInstance(existingData, instanceData)) {
        skippedCount++;
        // ingen write
      } else {
        const changedFields = diffComparableFields(
          buildComparableInstancePayload(existingData),
          buildComparableInstancePayload(instanceData)
        );
        batch.set(ref, instanceData, { merge: false });
        updatedCount++;
        console.log("[startDay] update instance", { instanceId, changedFields });
      }
      ensuredCount++;
    }
  }

  // ðŸ”¹ gem daily run
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

  console.log(`[startDayForLocation] Schedule system usage: newSchedule=${newScheduleCount}, legacy=${legacyScheduleCount}, disabledUnits=${disabledUnitCount}`);

  return {
    ok: true,
    alreadyStarted,
    created: createdCount,
    updated: updatedCount,
    skipped: skippedCount,
    message: runSnap.exists
      ? `Dagens kort er opdateret (${createdCount} nye, ${updatedCount} opdateret, ${skippedCount} uÃ¦ndret).`
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
  const rawTaskInstanceId = sanitizeString(data?.taskInstanceId || "", 120);
  const taskDateKeyHint = normalizeDateKey(data?.taskDateKey || data?.dateKey || data?.selectedDateKey || "") || getDateKey();
  
  logger.info("saveRoutineTask called", {
    userId: auth.uid,
    companyId,
    locationId,
    rawTaskInstanceId,
    taskDateKeyHint
  });
  const taskIdHint = sanitizeString(data?.taskId || "", 120);
  const templateIdHint = sanitizeString(data?.templateId || data?.taskTemplateId || "", 120);
  const templateKeyHint = sanitizeString(data?.templateKey || "", 120);
  const routineKeyHint = sanitizeString(data?.routineKey || data?.routineType || "", 120);
  const actionType = sanitizeString(data?.actionType || "save", 60);
  const rawTaskInstanceHasDate = /\d{4}[-_]\d{2}[-_]\d{2}/.test(rawTaskInstanceId);
  const taskInstanceId = rawTaskInstanceHasDate
    ? normalizeTaskInstanceDateInId(rawTaskInstanceId, taskDateKeyHint)
    : buildRoutineInstanceId(companyId, locationId, taskDateKeyHint, routineKeyHint || templateKeyHint || templateIdHint || taskIdHint || rawTaskInstanceId);

  if (!companyId || !locationId || !taskInstanceId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId, locationId og taskInstanceId er paakraevet.");
  }

  await assertStartDayAccess({
    uid: auth.uid,
    email: auth.token?.email || "",
    companyId,
    locationId
  });

  const todayKey = taskDateKeyHint || getDateKey();
  let taskRef = db.collection("task_instances").doc(taskInstanceId);
  let taskSnap = await taskRef.get();

  if (!taskSnap.exists && rawTaskInstanceId && rawTaskInstanceId !== taskInstanceId) {
    const rawTaskSnap = await db.collection("task_instances").doc(rawTaskInstanceId).get();
    if (rawTaskSnap.exists) {
      taskSnap = rawTaskSnap;
    }
  }

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

  // Additional fallback: try routineType/canonicalTaskKey
  if (!taskSnap.exists && routineKeyHint && taskDateKeyHint) {
    const routineKey = routineKeyHint;
    let routineFallbackQuery = db
      .collection("task_instances")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .where("dateKey", "==", taskDateKeyHint);

    const routineFallbackSnap = await routineFallbackQuery.limit(20).get();
    for (const doc of routineFallbackSnap.docs) {
      const candidate = doc.data() || {};
      const candidateRoutineKey = candidate.routineType || candidate.canonicalTaskKey || candidate.templateKey || "";
      if (candidateRoutineKey === routineKey) {
        taskRef = doc.ref;
        taskSnap = doc;
        logger.info("Found task via routineKey fallback", { routineKey, docId: doc.id });
        break;
      }
    }
  }

  // Lazy-create exactly one selected-date task instance when a template card is saved.
  // This preserves the lazy-create model: normal routine load must not generate daily instances.
  if (!taskSnap.exists) {
    const templateCandidateIds = [
      templateIdHint,
      taskIdHint,
      templateKeyHint
    ].map((value) => sanitizeString(value, 160)).filter(Boolean);

    if (!templateCandidateIds.length && !routineKeyHint) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Rutinen mangler templateId, templateKey eller routineKey, saa den kan ikke oprettes for den valgte dato."
      );
    }

    let templateSnap = null;
    let templateCollectionName = "";

    for (const collectionName of ["task_templates", "verification_templates"]) {
      for (const candidateId of templateCandidateIds) {
        const candidateSnap = await db.collection(collectionName).doc(candidateId).get();
        if (!candidateSnap.exists) continue;

        const candidate = candidateSnap.data() || {};
        const candidateCompanyId = sanitizeString(candidate.companyId || candidate.organizationId, 120);
        const candidateLocationId = sanitizeString(candidate.locationId || "", 120);
        const companyMatches = !candidateCompanyId || candidateCompanyId === companyId;
        const locationMatches = !candidateLocationId || candidateLocationId === locationId;

        if (companyMatches && locationMatches) {
          templateSnap = candidateSnap;
          templateCollectionName = collectionName;
          break;
        }
      }
      if (templateSnap) break;
    }

    if (!templateSnap && routineKeyHint) {
      for (const collectionName of ["task_templates", "verification_templates"]) {
        const templateQuerySnap = await db
          .collection(collectionName)
          .where("companyId", "==", companyId)
          .where("locationId", "==", locationId)
          .limit(100)
          .get();

        for (const doc of templateQuerySnap.docs) {
          const candidate = doc.data() || {};
          const candidateRoutineKeys = [
            candidate.routineKey,
            candidate.routineType,
            candidate.canonicalRoutineType,
            candidate.templateKey,
            candidate.taskKey,
            candidate.taskId,
            doc.id
          ].map((value) => sanitizeString(value, 120)).filter(Boolean);

          if (candidateRoutineKeys.includes(routineKeyHint)) {
            templateSnap = doc;
            templateCollectionName = collectionName;
            break;
          }
        }
        if (templateSnap) break;
      }
    }

    if (templateSnap) {
      const template = templateSnap.data() || {};
      const lazyDateKey = normalizeDateKey(taskDateKeyHint) || todayKey;
      const resolvedRoutineKey = sanitizeString(
        routineKeyHint ||
        template.routineKey ||
        template.routineType ||
        template.canonicalRoutineType ||
        template.templateKey ||
        template.taskKey ||
        templateSnap.id,
        120
      );
      const lazyTaskPayload = {
        companyId,
        organizationId: companyId,
        locationId,
        unitId: sanitizeString(data?.unitId || template.unitId || "", 120),
        taskId: sanitizeString(template.taskId || templateSnap.id, 120),
        templateId: templateSnap.id,
        linkedTemplateId: templateSnap.id,
        templateKey: sanitizeString(template.templateKey || template.taskKey || templateSnap.id, 120),
        templateSource: templateCollectionName,
        source: "lazy_save",
        title: sanitizeString(template.title || data?.title || "Rutine", 220),
        description: sanitizeString(template.description || "", 1000),
        category: sanitizeString(template.category || data?.category || "", 120),
        controlPoint: sanitizeString(template.controlPoint || data?.controlPoint || template.category || "", 160),
        type: sanitizeString(template.type || template.taskType || "", 80),
        taskType: sanitizeString(template.taskType || template.type || "", 80),
        routineKey: resolvedRoutineKey,
        routineType: sanitizeString(template.routineType || resolvedRoutineKey, 120),
        canonicalTaskKey: sanitizeString(template.canonicalTaskKey || resolvedRoutineKey, 120),
        canonicalRoutineType: sanitizeString(template.canonicalRoutineType || resolvedRoutineKey, 120),
        equipmentId: sanitizeString(template.equipmentId || "", 120),
        equipmentName: sanitizeString(template.equipmentName || template.unitName || "", 140),
        equipmentType: sanitizeString(template.equipmentType || "", 80),
        frequency: sanitizeString(template.frequency || "daily", 40),
        dateKey: lazyDateKey,
        status: "active",
        documented: false,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: auth.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: auth.uid
      };

      await taskRef.set(lazyTaskPayload, { merge: true });
      taskSnap = await taskRef.get();

      logger.info("Lazy-created task instance for saveRoutineTask", {
        userId: auth.uid,
        companyId,
        locationId,
        taskInstanceId,
        templateId: templateSnap.id,
        templateCollectionName,
        routineKey: resolvedRoutineKey
      });
    }
  }

  if (!taskSnap.exists) {
    logger.warn("Task instance not found", {
      userId: auth.uid,
      companyId,
      locationId,
      taskInstanceId,
      taskIdHint,
      templateIdHint,
      templateKeyHint,
      routineKeyHint,
      taskDateKeyHint
    });
    throw new functions.https.HttpsError(
      "not-found",
      `Rutinen blev ikke fundet, og lazy-create kunne ikke finde en template for ${taskDateKeyHint}.`
    );
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
  const note = sanitizeString(entryData.note || entryData.comment || "", 2000);
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
        return `${scope} udfÃ¸rt kl. ${timeLabel}. MÃ¥ling registreret: ${measurementValue}${measurementUnit || ""}.`;
      }
      return `${scope} udfÃ¸rt kl. ${timeLabel}. OmrÃ¥de/maskine kontrolleret og dokumenteret.`;
    }

    return "";
  })();

  const resolvedTemplateId = sanitizeString(task.templateId || task.linkedTemplateId || templateIdHint || "", 120);
  const resolvedTemplateKey = sanitizeString(task.templateKey || templateKeyHint || resolvedTemplateId || task.taskId || taskIdHint || "", 120);
  const resolvedRoutineKey = sanitizeString(
    data?.routineKey ||
    task.routineKey ||
    task.routineType ||
    task.canonicalRoutineType ||
    task.canonicalTaskKey ||
    resolvedTemplateKey ||
    task.taskId ||
    taskIdHint ||
    "",
    120
  );
  const resolvedRoutineType = sanitizeString(task.routineType || data?.routineType || resolvedRoutineKey, 120);
  const resolvedCanonicalTaskKey = sanitizeString(task.canonicalTaskKey || data?.canonicalTaskKey || resolvedRoutineKey || resolvedTemplateKey, 120);
  const coolingData = entryData?.coolingData || {};
  const isCoolingEntry =
    entryType === "cooling_control" ||
    String(data?.actionType || entryData?.actionType || "").toLowerCase().includes("cooling") ||
    normalizeRoutineType(resolvedRoutineKey || resolvedTemplateKey || task.routineKey || task.templateKey || "") === "nedkoeling";
  const coolingFoodItem = sanitizeString(
    entryData.foodItem ||
    entryData.productName ||
    data?.foodItem ||
    data?.productName ||
    coolingData.foodItem ||
    coolingData.productName ||
    "",
    180
  );
  const coolingMethod = sanitizeString(entryData.method || data?.method || coolingData.coolingMethodLabel || coolingData.coolingMethod || "", 140);
  const coolingPerformedByUid = sanitizeString(entryData.performedByUid || data?.performedByUid || entryData.completedBy || completedBy, 120) || completedBy;
  const coolingPerformedByName = sanitizeString(entryData.performedByName || data?.performedByName || entryData.completedByName || completedByName, 140) || completedByName;
  const latestComment = sanitizeString(entryData.comment || entryData.note || "", 2000);
  const startTime = sanitizeString(entryData.startTime || entryData.startAt || entryData.cooling_startTime || entryData.coolingData?.startedAt || "", 120);
  const endTime = sanitizeString(entryData.endTime || entryData.endAt || entryData.finishedAt || entryData.cooling_endTime || entryData.coolingData?.finishedAt || "", 120);

  const entryPayload = {
    taskInstanceId: resolvedTaskInstanceId,
    taskId: sanitizeString(task.taskId || "", 120),
    sourceTaskInstanceId: resolvedTaskInstanceId,
    companyId,
    organizationId: companyId,
    unitId: sanitizeString(data?.unitId || task.unitId || "", 120),
    locationId,
    routineKey: resolvedRoutineKey,
    routineType: resolvedRoutineType,
    canonicalTaskKey: resolvedCanonicalTaskKey,
    canonicalRoutineType: sanitizeString(task.canonicalRoutineType || resolvedRoutineType, 120),
    templateKey: resolvedTemplateKey,
    templateId: resolvedTemplateId,
    taskTitle: sanitizeString(task.title || "", 220),
    title: sanitizeString(task.title || "", 220),
    taskType: sanitizeString(task.type || task.category || "", 80),
    category: sanitizeString(task.category || "", 120),
    controlPoint: sanitizeString(task.controlPoint || "", 160),
    equipmentId: sanitizeString(task.equipmentId || "", 120),
    equipmentName: sanitizeString(task.equipmentName || "", 140),
    equipmentType: sanitizeString(task.equipmentType || "", 80),
    entryType,
    measurementValue,
    measurementUnit,
    valueLabel,
    status: entryStatus,
    startTime,
    startAt: sanitizeString(entryData.startAt || startTime || "", 120),
    endTime,
    endAt: sanitizeString(entryData.endAt || endTime || "", 120),
    note: autoDocumentationNote,
    comment: latestComment || autoDocumentationNote,
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
    actionType: entryStatus === "not_relevant_today" ? "not_relevant_today" : actionType
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
  if (isCoolingEntry) {
    entryPayload.foodItem = coolingFoodItem;
    entryPayload.productName = coolingFoodItem;
    entryPayload.performedByUid = coolingPerformedByUid;
    entryPayload.performedByName = coolingPerformedByName;
    entryPayload.completedByName = coolingPerformedByName;
    entryPayload.method = coolingMethod;
    entryPayload.documentation = autoDocumentationNote;
    entryPayload.coolingData = {
      foodItem: coolingFoodItem,
      productName: coolingFoodItem,
      quantityBucket: sanitizeString(coolingData.quantityBucket || entryData.quantityBucket || "", 80),
      coolingMethod: sanitizeString(coolingData.coolingMethod || entryData.coolingMethod || "", 80),
      coolingMethodLabel: sanitizeString(coolingData.coolingMethodLabel || coolingMethod || "", 140),
      startTemp: coolingData.startTemp ?? entryData.startTemp ?? null,
      endTemp: coolingData.endTemp ?? entryData.endTemp ?? measurementValue,
      coolingDuration: coolingData.coolingDuration ?? entryData.coolingDuration ?? null,
      startedAt: sanitizeString(coolingData.startedAt || entryData.startedAt || "", 80),
      finishedAt: sanitizeString(coolingData.finishedAt || entryData.completedAt || data?.completedAt || "", 80),
      aborted: coolingData.aborted === true || entryData.aborted === true
    };
  }

  const entryRef = await db.collection("task_entries").add(entryPayload);
  
  logger.info("Task entry created", {
    userId: auth.uid,
    companyId,
    locationId,
    taskInstanceId,
    entryId: entryRef.id,
    status: entryStatus
  });

  const sourceDateKey = normalizeDateKey(task.dateKey) || todayKey;
  const activeUntilDateKey = normalizeDateKey(task.activeUntilDateKey) || addDays(sourceDateKey, 7);
  const instanceUpdate = {
    status: "active",
    statusForSelectedDate: entryStatus,
    dateKey: todayKey,
    taskInstanceId: resolvedTaskInstanceId,
    sourceTaskInstanceId: resolvedTaskInstanceId,
    routineKey: resolvedRoutineKey,
    routineType: resolvedRoutineType,
    canonicalTaskKey: resolvedCanonicalTaskKey,
    canonicalRoutineType: sanitizeString(task.canonicalRoutineType || resolvedRoutineType, 120),
    templateKey: resolvedTemplateKey,
    templateId: resolvedTemplateId,
    latestEntryId: entryRef.id,
    latestEntryAt: FieldValue.serverTimestamp(),
    latestEntryStatus: entryStatus,
    latestEntrySummary: autoDocumentationNote,
    latestEntryByName: isCoolingEntry ? coolingPerformedByName : completedByName,
    latestMeasurement: measurementValue,
    latestComment,
    startTime,
    startAt: sanitizeString(entryData.startAt || startTime || "", 120),
    endTime,
    endAt: sanitizeString(entryData.endAt || endTime || "", 120),
    lastEntryStatus: entryStatus,
    documented: true,
    lastEntryAt: FieldValue.serverTimestamp(),
    lastEntrySummary: autoDocumentationNote,
    entryCount: FieldValue.increment(1),
    activeUntilDateKey,
    lastCompletedBy: completedBy,
    lastCompletedByName: isCoolingEntry ? coolingPerformedByName : completedByName,
    completedAt: FieldValue.serverTimestamp(),
    completedBy,
    completedByName: isCoolingEntry ? coolingPerformedByName : completedByName,
    completedLate,
    overdueResolvedAt: completedLate ? FieldValue.serverTimestamp() : null,
    updatedAt: FieldValue.serverTimestamp()
  };

  if (entryStatus === "not_relevant_today" || actionType === "not_relevant_today") {
    instanceUpdate.notRelevantAt = FieldValue.serverTimestamp();
    instanceUpdate.skippedAt = FieldValue.serverTimestamp();
  }

  await taskRef.set(instanceUpdate, { merge: true });

  if (result?.shouldCreateDeviation === true) {
    const deviationTitle = sanitizeString(result.deviationTitle || "", 220);
    const deviationType = sanitizeString(result.deviationType || "task_failure", 80) || "task_failure";
    const deviationDescription = sanitizeString(result.deviationDescription || "", 500);
    const deviationData = entryData?.deviationData || {};

    let exists = false;
    const existingDeviations = await db
      .collection("deviations")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .where("taskInstanceId", "==", resolvedTaskInstanceId)
      .where("dateKey", "==", todayKey)
      .where("status", "==", "open")
      .get();

    if (!existingDeviations.empty) {
      exists = existingDeviations.docs.some((doc) => sanitizeString(doc.data()?.title || "", 220) === deviationTitle);
    }

    if (!exists) {
      await db.collection("deviations").add({
        companyId,
        organizationId: companyId,
        locationId,
        taskInstanceId: resolvedTaskInstanceId,
        templateKey: sanitizeString(deviationData.templateKey || task.templateKey || "", 120),
        deviationType,
        severity: "high",
        status: "open",
        title: deviationTitle,
        description: deviationDescription,
        failureReason: sanitizeString(deviationData.failureReason || "", 500),
        productName: sanitizeString(deviationData.productName || "", 140),
        quantityBucket: sanitizeString(deviationData.quantityBucket || "", 80),
        coolingMethod: sanitizeString(deviationData.coolingMethod || "", 80),
        coolingMethodLabel: sanitizeString(deviationData.coolingMethodLabel || "", 140),
        startTemp: deviationData.startTemp || null,
        endTemp: deviationData.endTemp || null,
        durationMinutes: deviationData.durationMinutes || null,
        startedAt: sanitizeString(deviationData.startedAt || "", 80),
        finishedAt: sanitizeString(deviationData.finishedAt || "", 80),
        correctiveActionRequired: deviationData.correctiveActionRequired === true,
        correctiveActionText: "",
        dateKey: todayKey,
        createdBy: completedBy,
        createdByName: completedByName,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      
      logger.info("Deviation created for cooling failure", {
        companyId,
        locationId,
        taskInstanceId: resolvedTaskInstanceId,
        deviationType,
        productName: deviationData.productName
      });
    }
  }
  
  // Legacy alert support (keep for backward compatibility)
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
    entryId: entryRef.id,
    taskEntryId: entryRef.id,
    taskInstanceId: resolvedTaskInstanceId,
    dateKey: todayKey,
    entryStatus,
    instanceStatus: "active",
    statusForSelectedDate: entryStatus,
    latestEntryId: entryRef.id,
    latestEntryAt: new Date().toISOString(),
    latestEntryStatus: entryStatus,
    latestEntrySummary: autoDocumentationNote,
    latestEntryByName: isCoolingEntry ? coolingPerformedByName : completedByName,
    latestMeasurement: measurementValue,
    latestComment,
    startTime,
    startAt: sanitizeString(entryData.startAt || startTime || "", 120),
    endTime,
    endAt: sanitizeString(entryData.endAt || endTime || "", 120),
    completedAt: new Date().toISOString(),
    completedByName: isCoolingEntry ? coolingPerformedByName : completedByName,
    foodItem: isCoolingEntry ? coolingFoodItem : "",
    productName: isCoolingEntry ? coolingFoodItem : "",
    performedByUid: isCoolingEntry ? coolingPerformedByUid : "",
    performedByName: isCoolingEntry ? coolingPerformedByName : "",
    activeUntilDateKey,
    entryCount: Number(task.entryCount || 0) + 1
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
      title: "KÃ¸leskab 1 temperatur",
      description: "MÃ¥l temperatur i kÃ¸leskab 1 og udfyld mÃ¥lefelt.",
      type: "measurement",
      measurementUnit: "Â°C",
      minValue: 0,
      maxValue: 5,
      equipmentType: "fridge",
      equipmentName: "KÃ¸leskab 1"
    },
    {
      taskId: "demo_fridge_temperature_2",
      title: "KÃ¸leskab 2 temperatur",
      description: "MÃ¥l temperatur i kÃ¸leskab 2 og udfyld mÃ¥lefelt.",
      type: "measurement",
      measurementUnit: "Â°C",
      minValue: 0,
      maxValue: 5,
      equipmentType: "fridge",
      equipmentName: "KÃ¸leskab 2"
    },
    {
      taskId: "demo_freezer_temperature_1",
      title: "Fryser 1 temperatur",
      description: "MÃ¥l temperatur i fryser 1 og udfyld mÃ¥lefelt.",
      type: "measurement",
      measurementUnit: "Â°C",
      minValue: -30,
      maxValue: -18,
      equipmentType: "freezer",
      equipmentName: "Fryser 1"
    },
    {
      taskId: "demo_cleaning_surface",
      title: "RengÃ¸ring af arbejdsflader",
      description: "Kontroller at arbejdsflader er rengjort og kryds af.",
      type: "check",
      equipmentType: "cleaning",
      equipmentName: "Arbejdsflader"
    },
    {
      taskId: "demo_allergen_separation",
      title: "Adskillelse af allergener",
      description: "BekrÃ¦ft adskillelse mellem allergenvarer og Ã¸vrige varer.",
      type: "check",
      equipmentType: "storage",
      equipmentName: "TÃ¸rvarelager"
    },
    {
      taskId: "demo_receiving_check",
      title: "Varemodtagelse kontrol",
      description: "Kontroller emballage, temperatur og datomÃ¦rkning.",
      type: "check",
      equipmentType: "receiving",
      equipmentName: "Varemodtagelse"
    },
    {
      taskId: "demo_softice_cleaning",
      title: "Softice-maskine rengÃ¸ring",
      description: "RengÃ¸r softice-maskine inkl. tappetud, slanger, pakninger og drypbakke.",
      type: "check",
      equipmentType: "softice",
      equipmentName: "Softice-maskine",
      guideTitle: "Softice-maskine - rengÃ¸ring af maskine og dele",
      guideIntro: "Maskinen skal adskilles og rengÃ¸res efter producentens procedure for at undgÃ¥ bakterievÃ¦kst.",
      guideAreas: [
        "Tappetud, pakninger, slanger, omrÃ¸rer og drypbakke",
        "Beholder og alle produktberÃ¸rte kontaktflader",
        "Korrekt samling af alle dele efter rengÃ¸ring"
      ],
      guideSteps: [
        "Stop drift, tÃ¸m produkt og adskil de dele der skal rengÃ¸res.",
        "Vask, skyl og desinficÃ©r delene efter godkendt rengÃ¸ringsinstruks.",
        "Saml maskinen igen, kÃ¸r test/skyl og registrÃ©r opgaven."
      ],
      guideApproval: [
        "Alle dele er synligt rene og korrekt monteret.",
        "Ingen rester af produkt eller rengÃ¸ringsmiddel.",
        "Maskinen er klar til sikker drift."
      ],
      guideIfNotOk: [
        "RegistrÃ©r afvigelse med hvilken del der ikke er ok.",
        "Gentag rengÃ¸ring fÃ¸r maskinen tages i brug.",
        "Informer ansvarlig ved teknisk fejl eller manglende tÃ¦thed."
      ]
    },
    {
      taskId: "demo_oven_cleaning_and_temp",
      title: "Ovn rengÃ¸ring og temperaturkontrol",
      description: "RengÃ¸r ovn og verificÃ©r at ovntemperatur er korrekt.",
      type: "measurement",
      measurementUnit: "Â°C",
      minValue: 160,
      maxValue: 260,
      equipmentType: "oven",
      equipmentName: "Kombiovn 1",
      guideTitle: "Ovn - rengÃ¸ring og temperaturkontrol",
      guideIntro: "Ovnen skal vÃ¦re ren og holde den temperatur der er sat for sikker tilberedning.",
      guideAreas: [
        "Ovnrum, riste, plader, tÃ¦tningslister og hÃ¥ndtag",
        "Temperaturvisning og evt. kernetermometer",
        "Luftcirkulation og ventilationsÃ¥bninger"
      ],
      guideSteps: [
        "RengÃ¸r ovnens indvendige flader og tilbehÃ¸r.",
        "Forvarm ovnen og mÃ¥l faktisk temperatur med kalibreret termometer.",
        "Indtast mÃ¥lingen og registrÃ©r kommentar ved afvigelse."
      ],
      guideApproval: [
        "Ovnen er fri for fastbrÃ¦ndte rester.",
        "MÃ¥lt temperatur ligger inden for tilladt interval.",
        "Kontrollen er dokumenteret i systemet."
      ],
      guideIfNotOk: [
        "Opret afvigelse med mÃ¥lt temperatur og forventet vÃ¦rdi.",
        "Tag ovn ud af drift ved kritisk temperaturfejl.",
        "Bestil service/kalibrering."
      ]
    },
    {
      taskId: "demo_industrial_dishwasher_temp",
      title: "Industriopvaskemaskine temperaturkontrol",
      description: "KontrollÃ©r vaske-/slutskylletemperatur og rengÃ¸r filtre/dyser.",
      type: "measurement",
      measurementUnit: "Â°C",
      minValue: 60,
      maxValue: 90,
      equipmentType: "dishwasher",
      equipmentName: "Industriopvaskemaskine",
      guideTitle: "Industriopvaskemaskine - rengÃ¸ring og temperatur",
      guideIntro: "Maskinen skal vÃ¦re ren, og temperaturer skal sikre hygiejnisk opvask.",
      guideAreas: [
        "Filtre, dyser, skyllearme og tank",
        "SÃ¦be-/afspÃ¦ndingsdosering",
        "Vaske- og slutskylletemperatur"
      ],
      guideSteps: [
        "RengÃ¸r filtre, dyser og tank efter daglig rutine.",
        "KÃ¸r testprogram og aflÃ¦s temperaturer.",
        "RegistrÃ©r temperaturmÃ¥ling og evt. afvigelse."
      ],
      guideApproval: [
        "Maskinen er rengjort uden madrester.",
        "MÃ¥lt temperatur ligger inden for tilladt interval.",
        "Dokumentation er gemt."
      ],
      guideIfNotOk: [
        "Opret afvigelse med mÃ¥lte temperaturer.",
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
        "LÃ¦s opgaven",
        "Udfyld mÃ¥ling eller vÃ¦lg udfÃ¸rt",
        "TilfÃ¸j kommentar ved afvigelse"
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

exports.listLocationUsers = onCall(
  { region: "us-central1" },
  async (request) => {
    console.log("listLocationUsers v2 debug", {
      hasAuth: !!request.auth,
      uid: request.auth?.uid || null,
      email: request.auth?.token?.email || null,
      data: request.data || null
    });

    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Du skal vaere logget ind.");
    }

    const companyId = sanitizeString(request.data?.companyId || "", 120);
    const locationId = sanitizeString(request.data?.locationId || "", 120);

    if (!companyId || !locationId) {
      throw new HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
    }

    await assertAdminAccess({
      uid: request.auth.uid,
      email: request.auth.token?.email || "",
      companyId,
      locationId
    });

    try {
      const usersSnapshot = await db.collection("users")
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .get();

      const users = [];
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        users.push({
          userId: doc.id,
          displayName: userData.displayName || "",
          email: userData.email || "",
          role: userData.role || "medarbejder",
          employmentRole: userData.employmentRole || userData.role || "medarbejder",
          status: userData.status || "active",
          createdAt: userData.createdAt || null
        });
      });

      return { users };
    } catch (error) {
      console.error("Fejl ved hentning af lokationsbrugere:", error);
      throw new HttpsError("internal", "Kunne ikke hente brugere.");
    }
  }
);

exports.createLocationUser = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Du skal vaere logget ind.");
    }

    const companyId = sanitizeString(request.data?.companyId || "", 120);
    const locationId = sanitizeString(request.data?.locationId || "", 120);
    const displayName = sanitizeString(request.data?.displayName || "", 100);
    const email = sanitizeString(request.data?.email || "", 100);
    const password = sanitizeString(request.data?.password || "", 100);
    const role = sanitizeString(request.data?.role || "employee", 50);
    const employmentRole = sanitizeString(request.data?.employmentRole || "medarbejder", 50);

    if (!companyId || !locationId || !displayName || !email || !password) {
      throw new HttpsError("invalid-argument", "companyId, locationId, displayName, email og password er paakraevet.");
    }

    if (password.length < 6) {
      throw new HttpsError("invalid-argument", "Password skal vaere mindst 6 tegn.");
    }

    await assertAdminAccess({
      uid: request.auth.uid,
      email: request.auth.token?.email || "",
      companyId,
      locationId
    });

    try {
      const existingUser = await db.collection("users")
        .where("email", "==", email)
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .limit(1)
        .get();

      if (!existingUser.empty) {
        throw new HttpsError("already-exists", "Bruger med denne email eksisterer allerede.");
      }

      // Get owner/admin profile to copy access fields
      const ownerDoc = await db.collection("users").doc(request.auth.uid).get();
      const ownerData = ownerDoc.exists ? (ownerDoc.data() || {}) : {};

      // Create Firebase Auth user
      const authUser = await admin.auth().createUser({
        email,
        password,
        displayName,
        emailVerified: false
      });

      // Build employee user document with same access fields as owner
      const userPayload = {
        // Employee-specific fields
        uid: authUser.uid,
        displayName,
        email,
        role,
        employmentRole,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
        
        // Copy access fields from owner/admin
        companyId: companyId || ownerData.companyId,
        organizationId: companyId || ownerData.organizationId || ownerData.companyId,
        locationId: locationId || ownerData.locationId,
        primaryLocationId: locationId || ownerData.primaryLocationId || ownerData.locationId,
        locationIds: [locationId].filter(Boolean).length > 0 
          ? [locationId] 
          : (ownerData.locationIds || [locationId || ownerData.locationId].filter(Boolean)),
        
        // Copy optional access fields if they exist
        ...(ownerData.latestLiveProfileId && { latestLiveProfileId: ownerData.latestLiveProfileId }),
        ...(ownerData.activeLocationId && { activeLocationId: ownerData.activeLocationId }),
        ...(ownerData.companyName && { companyName: ownerData.companyName }),
        ...(ownerData.profileCompanyName && { profileCompanyName: ownerData.profileCompanyName })
      };

      // Create Firestore user document
      const userRef = db.collection("users").doc(authUser.uid);
      await userRef.set(userPayload);

      console.log("[createLocationUser] Created employee with access fields:", {
        uid: authUser.uid,
        companyId: userPayload.companyId,
        locationId: userPayload.locationId,
        locationIds: userPayload.locationIds,
        role: userPayload.role
      });

      return {
        success: true,
        userId: authUser.uid,
        message: "Bruger oprettet med login-adgang."
      };
    } catch (error) {
      console.error("Fejl ved oprettelse af lokationsbruger:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Kunne ikke oprette bruger.");
    }
  }
);

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

// â”€â”€â”€ BILLING PLANS REGISTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BILLING_PLANS = {
  monthly: {
    code: "monthly",
    label: "MÃ¥nedsabonnement",
    interval: "month",
    intervalCount: 1,
    exVatOre: 14900,
    vatRate: 0.25,
    inclVatOre: 18625
  },
  yearly: {
    code: "yearly",
    label: "Ã…rsabonnement (Spar 10%)",
    interval: "year",
    intervalCount: 1,
    exVatOre: 160920,
    vatRate: 0.25,
    inclVatOre: 201150
  }
};

function getBillingPlan(planCode) {
  const plan = BILLING_PLANS[planCode];
  if (!plan) {
    throw new functions.https.HttpsError("invalid-argument", "Ugyldig billingPlan");
  }
  return plan;
}

// â”€â”€â”€ CANONICAL COMPANY ID (STABLE SLUG-BASED) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// VIGTIGT: companyId mÃ¥ IKKE bruge Date.now() (ikke stabil ved re-runs)
// VIGTIGT: companyId mÃ¥ IKKE kun bruge slug (collision mellem virksomheder med samme navn)
// LÃ˜SNING: slug + CVR (hvis findes) eller slug + hash (fallback for uniqueness)

function buildCanonicalCompanyId(input) {
  const crypto = require("crypto");
  
  const slug = (input.companyName || "company")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const cleanCvr = String(input.cvr || "").replace(/\D/g, "");

  // Path 1: CVR findes â†’ slug + CVR (garanteret unik)
  if (/^\d{8}$/.test(cleanCvr)) {
    return `onboarding_${slug}_${cleanCvr}`;
  }

  // Path 2: Ingen CVR â†’ slug + stabil hash baseret pÃ¥ fallback-seed
  // Hash sikrer uniqueness selv ved samme company name
  const fallbackSeed = `${input.companyName || ""}_${input.address || ""}_${input.zip || ""}_${input.city || ""}`
    .toLowerCase()
    .replace(/\s+/g, "");
  
  const hash = crypto
    .createHash("sha256")
    .update(fallbackSeed)
    .digest("hex")
    .slice(0, 8);

  return `onboarding_${slug}_${hash}`;
}

// â”€â”€â”€ COMPANY KEY (DEDUPLICATION) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildCompanyKey({ cvr, companyName, address, zip, city }) {
  const cleanCvr = String(cvr || "").replace(/\D/g, "");

  if (/^\d{8}$/.test(cleanCvr)) {
    return {
      companyKey: `cvr_${cleanCvr}`,
      keyType: "cvr"
    };
  }

  const slug = `${companyName}_${address}_${zip}_${city}` 
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 120);

  return {
    companyKey: `fallback_${slug}`,
    keyType: "fallback"
  };
}

// â”€â”€â”€ CREATE OR GET COMPANY (TRANSACTION) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function getOrCreateCompany(tx, input) {
  const { companyKey, keyType } = buildCompanyKey(input);

  const registryRef = db.collection("company_registry").doc(companyKey);
  const registrySnap = await tx.get(registryRef);

  // Registry hit: company already exists, return canonical companyId
  if (registrySnap.exists) {
    return {
      companyId: registrySnap.data().companyId,
      companyKey,
      keyType,
      alreadyExists: true
    };
  }

  // Generate canonical companyId (CVR-based or hash-based for uniqueness)
  let companyId = buildCanonicalCompanyId(input);
  let companyRef = db.collection("companies").doc(companyId);
  let companySnap = await tx.get(companyRef);

  // Collision check: if companies/{companyId} already exists, append suffix
  if (companySnap.exists) {
    const crypto = require("crypto");
    const collisionSuffix = crypto
      .createHash("sha256")
      .update(companyKey)
      .digest("hex")
      .slice(0, 6);
    
    companyId = `${companyId}_${collisionSuffix}`;
    companyRef = db.collection("companies").doc(companyId);
  }

  tx.set(companyRef, {
    companyId,
    companyKey,
    keyType,
    name: input.companyName || "",
    displayName: input.companyName || "",
    cvr: input.cvr || null,
    address: input.address || null,
    zip: input.zip || null,
    city: input.city || null,
    status: "pending_payment",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  tx.set(registryRef, {
    companyId,
    companyKey,
    keyType,
    createdAt: FieldValue.serverTimestamp()
  });

  return {
    companyId,
    companyKey,
    keyType,
    alreadyExists: false
  };
}

// â”€â”€â”€ ONBOARDING CHECKOUT SESSION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CHECKOUT_ALLOWED_MODULES = new Set(["pos", "lagerkontrol", "bogforing", "egenkontrol", "menu", "seo", "kalkulation", "koerselskontrol"]);
const CHECKOUT_MODULE_ALIASES = {
  accounting: "bogforing",
  bogfoering: "bogforing",
  "bogføring": "bogforing"
};

function normalizeCheckoutSelectedModules(...sources) {
  const result = [];
  const pushValue = (value) => {
    if (Array.isArray(value)) {
      value.forEach(pushValue);
      return;
    }
    String(value || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .forEach((item) => {
        const moduleKey = CHECKOUT_MODULE_ALIASES[item] || item;
        if (CHECKOUT_ALLOWED_MODULES.has(moduleKey) && !result.includes(moduleKey)) {
          result.push(moduleKey);
        }
      });
  };
  sources.forEach(pushValue);
  return result;
}

function buildCheckoutModuleAccess(selectedModules = [], source = "onboarding_checkout") {
  return selectedModules.reduce((acc, moduleKey) => {
    acc[moduleKey] = {
      enabled: true,
      status: "active",
      source,
      activatedAt: FieldValue.serverTimestamp()
    };
    return acc;
  }, {});
}

function buildCheckoutModuleMap(selectedModules = []) {
  return selectedModules.reduce((acc, moduleKey) => {
    acc[moduleKey] = true;
    return acc;
  }, {});
}

exports.createOnboardingCheckoutSession = functions.https.onCall(
  { secrets: ["FUNCTIONS_CONFIG_EXPORT"] },
  async (request, context) => {
  const data = request.data || request;

  console.log("=== BACKEND DEBUG START ===");
  console.log("Received data type:", typeof data);
  console.log("Received data keys:", data ? Object.keys(data) : "null");
  console.log("data.profile exists?", data?.profile ? "YES" : "NO");
  console.log("data.profile.companyName:", data?.profile?.companyName);
  console.log("data.profile.accountEmail:", data?.profile?.accountEmail);
  console.log("data.profile.accountPassword length:", data?.profile?.accountPassword?.length || 0);
  console.log("=== BACKEND DEBUG END ===");

  const stripe = getStripeClient();
  const stripeConfig = getStripeConfig();
  const authUid = sanitizeString(context.auth?.uid || "", 160);
  const authEmail = sanitizeString(context.auth?.token?.email || "", 160);
  
  // Merge profile and company data - frontend sends both
  const mergedProfile = {
    ...(data?.profile || {}),
    companyName: data?.profile?.companyName || data?.company?.name || "",
    accountEmail: data?.profile?.accountEmail || data?.company?.email || "",
    accountPassword: data?.profile?.accountPassword || data?.company?.accountPassword || "",
    cvr: data?.profile?.cvr || data?.company?.cvr || "",
    address: data?.profile?.address || data?.company?.address || "",
    zip: data?.profile?.zip || data?.company?.zip || "",
    city: data?.profile?.city || data?.company?.city || "",
    phone: data?.profile?.phone || data?.company?.phone || "",
    ownerName: data?.profile?.ownerName || data?.company?.leader || "",
    companyType: data?.profile?.companyType || data?.company?.businessType || ""
  };
  
  const profile = sanitizeOnboardingProfile(mergedProfile);
  const requestedCompanyId = sanitizeString(data?.companyId || "", 120);
  const requestedLocationId = sanitizeString(data?.locationId || "", 120);
  const selectedModules = normalizeCheckoutSelectedModules(
    data?.selectedModules,
    data?.checkoutSummary?.selectedModules,
    data?.module,
    data?.modules
  );
  if (!selectedModules.length) {
    throw new functions.https.HttpsError("invalid-argument", "Vælg mindst ét modul for at fortsætte.");
  }

  // STEP 1: Read and validate billingPlan from frontend
  const normalizedBillingPlan = String(data.billingPlan || "monthly").toLowerCase();
  const selectedStripePriceId = normalizedBillingPlan === "yearly"
    ? stripeConfig.priceYearly
    : stripeConfig.priceMonthly;

  console.log("[createOnboardingCheckoutSession] Selected billing plan:", normalizedBillingPlan);
  console.log("[createOnboardingCheckoutSession] Selected price ID:", selectedStripePriceId);
  console.log("[createOnboardingCheckoutSession] Selected modules:", selectedModules);

  console.log("=== COMPANY/LOCATION ID GENERATION ===");
  console.log("Sanitized profile.companyName:", profile.companyName);
  console.log("requestedCompanyId:", requestedCompanyId);
  console.log("requestedLocationId:", requestedLocationId);

  // Reject placeholder IDs from frontend
  const isPlaceholderCompanyId = !requestedCompanyId || requestedCompanyId.startsWith("company_");
  const isPlaceholderLocationId = !requestedLocationId || requestedLocationId.startsWith("location_");

  if (isPlaceholderCompanyId) {
    console.log("[ID_GENERATION] Rejecting placeholder companyId, will generate real ID");
  }
  if (isPlaceholderLocationId) {
    console.log("[ID_GENERATION] Rejecting placeholder locationId, will generate real ID");
  }

  // STEP 2: Get or create company via transaction (deduplication)
  let companyId = null;
  let companyKey = null;
  let keyType = null;
  let companyAlreadyExists = false;

  // Always generate real company ID (ignore placeholders)
  if (isPlaceholderCompanyId) {
    const companyResult = await db.runTransaction(async (tx) => {
      return await getOrCreateCompany(tx, {
        cvr: profile.cvr,
        companyName: profile.companyName,
        address: profile.address,
        zip: profile.zip,
        city: profile.city
      });
    });

    companyId = companyResult.companyId;
    companyKey = companyResult.companyKey;
    keyType = companyResult.keyType;
    companyAlreadyExists = companyResult.alreadyExists;

    console.log("[COMPANY] Created/found:", companyId, "Key:", companyKey, "Type:", keyType, "Exists:", companyAlreadyExists);
  } else {
    companyId = requestedCompanyId;
    console.log("[COMPANY] Using requested companyId:", companyId);
  }

  // Always generate real location ID (ignore placeholders)
  const locationId = isPlaceholderLocationId 
    ? toDocSafeId(`${companyId}__main`).slice(0, 120)
    : requestedLocationId;

  console.log("Generated companyId:", companyId);
  console.log("Generated locationId:", locationId);
  console.log("=== END ID GENERATION ===");

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
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
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
  let quickOnboardingSetup = null;
  if (data?.setup && typeof data.setup === "object") {
    try {
      const { normalizeQuickOnboardingSetup } = require("./js/setupToCanonicalRoutines");
      quickOnboardingSetup = normalizeQuickOnboardingSetup(data.setup || {});
    } catch (setupErr) {
      console.warn("[createOnboardingCheckoutSession] quick setup normalization failed:", setupErr.message);
    }
  }
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

  const sourceType = sanitizeString(data?.source || "onboarding_checkout", 60);

  const draftRef = await db.collection("onboarding_checkout_drafts").add({
    uid: authUid || "",
    userEmail: authEmail || onboardingEmail,
    onboardingEmail,
    provisioningToken,
    companyId,
    organizationId: companyId,
    locationId,
    selectedModules,
    activeModules: selectedModules,
    moduleAccess: buildCheckoutModuleAccess(selectedModules),
    profile,
    setup: quickOnboardingSetup,
    quickOnboardingSetup,
    riskModel,
    summary,
    cloudinaryAssets,
    billingPlan: normalizedBillingPlan,
    stripePriceId: selectedStripePriceId,
    source: sourceType,
    status: "awaiting_payment",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

// STEP 3: Build Stripe line items using price ID from config
  const lineItems = [
    {
      price: selectedStripePriceId,
      quantity: 1
    }
  ];

  console.log("[BILLING] Line items created with price ID:", selectedStripePriceId);

  const successUrl = `${origin}${successPath}${successPath.includes("?") ? "&" : "?"}draftId=${encodeURIComponent(draftRef.id)}`;
  const successUrlWithToken = `${successUrl}&provisioning_token=${encodeURIComponent(provisioningToken)}`;
  const cancelUrl = `${origin}${cancelPath}${cancelPath.includes("?") ? "&" : "?"}draftId=${encodeURIComponent(draftRef.id)}&provisioning_token=${encodeURIComponent(provisioningToken)}`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: lineItems,
    customer_email: onboardingEmail || authEmail || undefined,
    success_url: successUrlWithToken,
    cancel_url: cancelUrl,
    metadata: {
      source: sourceType,
      uid: authUid || "guest",
      companyId,
      locationId,
      draftId: draftRef.id,
      provisioningToken,
      onboardingEmail,
      selectedModules: selectedModules.join(","),
      plan: normalizedBillingPlan,
      companyKey: companyKey || "",
      keyType: keyType || ""
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
    source: sourceType,
    uid: authUid || "",
    companyId,
    locationId,
    addonKeys: [],
    selectedModules,
    activeModules: selectedModules,
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
    summary
  };
});

exports.checkSubdomainAvailability = functions.https.onCall(async (data, context) => {
  try {
    const payload =
      data?.data && typeof data.data === "object"
        ? data.data
        : data;

    console.log("RAW DATA - companyId:", payload?.companyId, "locationId:", payload?.locationId, "subdomain:", payload?.subdomain);
    console.log("PARSED PAYLOAD - keys:", Object.keys(payload || {}));

    const companyId = String(payload?.companyId || "").trim();
    const locationId = String(payload?.locationId || "").trim();
    const subdomain = String(payload?.subdomain || "").trim().toLowerCase();

    console.log("companyId:", companyId);
    console.log("locationId:", locationId);
    console.log("subdomain:", subdomain);

    if (!companyId || !locationId) {
      return {
        ok: false,
        error: "companyId og locationId mangler"
      };
    }

    if (!subdomain) {
      return {
        ok: false,
        error: "subdomain mangler"
      };
    }

    if (subdomain.length < 3) {
      return {
        ok: true,
        subdomain,
        available: false,
        reason: "for_short"
      };
    }

    const snap = await db
      .collection("websites")
      .where("subdomain", "==", subdomain)
      .limit(1)
      .get();

    if (snap.empty) {
      return {
        ok: true,
        subdomain,
        available: true
      };
    }

    const existing = snap.docs[0].data() || {};
    const existingCompanyId = String(existing.organizationId || existing.companyId || "").trim();
    const existingLocationId = String(existing.locationId || "").trim();
    const sameLocation = existingCompanyId === companyId && existingLocationId === locationId;

    return {
      ok: true,
      subdomain,
      available: sameLocation,
      reason: sameLocation ? "owned_by_current_location" : "taken"
    };
  } catch (err) {
    console.error("SUBDOMAIN ERROR:", String(err?.message || "Unknown error"));
    
    return {
      ok: false,
      error: String(err?.message || "Internal error")
    };
  }
});

exports.saveSeoGeneratorConfig = functions.https.onCall(async (data, context) => {
  try {
    const payload =
      data?.data && typeof data.data === "object"
        ? data.data
        : data;

    console.log("RAW DATA - companyId:", payload?.companyId, "locationId:", payload?.locationId);
    console.log("PARSED PAYLOAD - keys:", Object.keys(payload || {}));
    
    const companyId = sanitizeString(payload?.companyId || "", 120);
    const locationId = sanitizeString(payload?.locationId || "", 120);

    console.log("companyId:", companyId);
    console.log("locationId:", locationId);
    const config = payload?.config || {};
    const isOnboarding = companyId.toLowerCase().startsWith("onboarding_");

    if (!companyId || !locationId) {
      throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
    }

    if (!isOnboarding && !context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Log ind for at gemme generator-data.");
    }

    if (!isOnboarding) {
      await assertSeoGeneratorAccess({
        uid: context.auth.uid,
        email: context.auth.token?.email || "",
        companyId,
        locationId
      });
    }

    const configDocId = sanitizeString(payload?.configId || "", 180) || toDocSafeId(`${companyId}__${locationId}__${Date.now()}`);
    const subdomain = toAsciiSlug(config?.subdomain || config?.businessName || "restaurant", 120) || "restaurant";

    const dbPayload = {
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
      heroImageUrl: sanitizeString(config?.heroImageUrl || "", 2000),
      ctaText: sanitizeString(config?.ctaText || "", 120),
      ctaUrl: sanitizeString(config?.ctaUrl || "", 500),
      landingPages: Array.isArray(config?.landingPages) ? config.landingPages.slice(0, 200).map(p => ({
        canonicalPath: sanitizeString(p?.canonicalPath || "", 220),
        keyword:       sanitizeString(p?.keyword || "", 140),
        title:         sanitizeString(p?.title || "", 220),
        h1:            sanitizeString(p?.h1 || "", 220),
        h2:            sanitizeString(p?.h2 || "", 220),
        h3:            sanitizeString(p?.h3 || "", 220),
        metaDescription: sanitizeString(p?.metaDescription || "", 320)
      })) : [],
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: context.auth?.uid || null,
      updatedByEmail: sanitizeString(context.auth?.token?.email || "", 160)
    };

    await db.collection("seo_generator_configs").doc(configDocId).set({
      ...dbPayload,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: context.auth?.uid || null
    }, { merge: true });

    return {
      ok: true,
      configId: configDocId,
      subdomain
    };
  } catch (err) {
    console.error("SAVE CONFIG ERROR:", String(err?.message || "Unknown error"));
    
    if (err instanceof functions.https.HttpsError) {
      throw err;
    }
    
    throw new functions.https.HttpsError("internal", String(err?.message || "Internal error"));
  }
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

exports.adminActivateSeoSite = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at aktivere SEO-site.");
  }
  const companyId  = sanitizeString(data?.companyId  || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
  }
  await assertAdminAccess({ uid: context.auth.uid, email: context.auth.token?.email || "", companyId, locationId });

  // Use provided inline config or load saved config from Firestore
  let config = data?.config || null;
  if (!config) {
    const configId = sanitizeString(data?.configId || "", 180);
    if (!configId) throw new functions.https.HttpsError("invalid-argument", "config eller configId er pÃ¥krÃ¦vet.");
    const snap = await db.collection("seo_generator_configs").doc(configId).get();
    if (!snap.exists) throw new functions.https.HttpsError("not-found", "Generator-konfiguration ikke fundet.");
    config = snap.data();
  }

  const result = await upsertWebsiteAndSeoPages({ companyId, locationId, config, activatedByUid: context.auth.uid });

  // Mark SEO addon as active on the company location
  await db.collection("company_locations").doc(`${companyId}__${locationId}`).set({
    addons: { seo: true },
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true }).catch(() => {});

  return { ok: true, websiteId: result.websiteId, generatedPages: result.generatedPages, subdomain: result.subdomain };
});

// â”€â”€ SEO SITE RENDERER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// HTTP function â€” serves *.madkontrollen.dk subdomains as real HTML pages
// Map *.madkontrollen.dk â†’ this function via Google Cloud Run custom domains
exports.seoSiteRenderer = functions.https.onRequest(async (req, res) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");

  const host = (req.headers.host || "").toLowerCase().split(":")[0];
  const match = host.match(/^([a-z0-9-]+)\.madkontrollen\.dk$/);
  if (!match) {
    res.status(400).send("Ugyldigt domÃ¦ne.");
    return;
  }
  const subdomain = sanitizeString(match[1], 120);

  let websiteDoc = null;
  let websiteDocId = null;
  try {
    const snap = await db.collection("websites")
      .where("subdomain", "==", subdomain)
      .where("status", "==", "published")
      .limit(1)
      .get();
    if (!snap.empty) {
      websiteDoc = snap.docs[0].data();
      websiteDocId = snap.docs[0].id;
    }
  } catch (e) {
    console.error("seoSiteRenderer: website lookup error", e);
  }

  if (!websiteDoc) {
    res.status(404).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Siden findes ikke</title></head><body style="font-family:sans-serif;padding:40px;text-align:center"><h1>404</h1><p>Siden <strong>${subdomain}.madkontrollen.dk</strong> findes ikke.</p></body></html>`);
    return;
  }

  const websiteId = websiteDocId;
  let seoPages = [];
  try {
    const pagesSnap = await db.collection("seo_pages")
      .where("websiteId", "==", websiteId)
      .where("status", "==", "published")
      .orderBy("ordering", "asc")
      .limit(60)
      .get();
    seoPages = pagesSnap.docs.map(d => d.data());
  } catch (e) {
    console.warn("seoSiteRenderer: pages lookup error", e);
  }

  const slugPath = (req.path || "/").replace(/^\//,"").replace(/\/$/,"") || "";
  const page = seoPages.find(p => p.slug === slugPath) || null;

  const esc = (v) => String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  
  const title = esc(page?.title || websiteDoc.heroTitle || subdomain);
  const metaDesc = esc(page?.metaDescription || websiteDoc.heroText || "");
  const h1 = esc(page?.h1 || websiteDoc.heroTitle || subdomain);
  const intro = esc(page?.bodyText || page?.metaDescription || websiteDoc.heroText || "");
  const heroImg = esc(websiteDoc.heroImageUrl || "");
  const phone = esc(websiteDoc.phone || "");
  const address = esc(websiteDoc.address || "");
  const companyName = esc(websiteDoc.heroTitle || subdomain);
  const externalWebsite = esc(websiteDoc.ctaUrl || "");
  const slug = esc(page?.slug || "");
  
  const logoInitials = companyName.split(" ").slice(0,2).map(w=>w.charAt(0).toUpperCase()).join("") || "MK";
  
  const themePrimary = esc(websiteDoc.themePrimary || "#1f7a3d");
  const themeSecondary = esc(websiteDoc.themeSecondary || "#f8f4ea");
  const themeAccent = esc(websiteDoc.themeAccent || "#b91c1c");
  const themeText = esc(websiteDoc.themeText || "#1f2937");
  
  const sectionsHtml = page?.h2 ? `<div class="section"><h2>${esc(page.h2)}</h2><p>${intro}</p></div>` : "";

  const html = `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${metaDesc}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://madkontrollen.dk/landing-pages/${slug}/">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f5f5f5; color: #1f2937; line-height: 1.6; }
.landing-page { --theme-primary: ${themePrimary}; --theme-secondary: ${themeSecondary}; --theme-accent: ${themeAccent}; --theme-text: ${themeText}; --theme-hero-overlay: rgba(0, 0, 0, 0.42); --markise-stripe-width: 80px; --markise-height: 70px; --markise-wave-height: 40px; }
.markise-bar { width: 100%; height: var(--markise-height); position: relative; z-index: 20; background-image: repeating-linear-gradient(90deg, var(--theme-primary) 0, var(--theme-primary) calc(var(--markise-stripe-width) / 2), var(--theme-secondary) calc(var(--markise-stripe-width) / 2), var(--theme-secondary) var(--markise-stripe-width)); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12); }
.markise-bar::after { content: ""; position: absolute; left: 0; bottom: calc(var(--markise-wave-height) * -0.5); width: 100%; height: var(--markise-wave-height); background-image: radial-gradient(circle at 50% 0, var(--theme-primary) 50%, transparent 50%), radial-gradient(circle at 50% 0, var(--theme-secondary) 50%, transparent 50%); background-size: calc(var(--markise-stripe-width) / 2) var(--markise-wave-height); background-position: 0 0, calc(var(--markise-stripe-width) / 2) 0; background-repeat: repeat-x; }
.hero { position: relative; min-height: 620px; background-image: url('${heroImg}'); background-size: cover; background-position: center; overflow: hidden; }
.hero::before { content: ""; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0, 0, 0, 0.22), var(--theme-hero-overlay)); }
.hero-inner { position: relative; z-index: 2; max-width: 1200px; margin: 0 auto; padding: 120px 24px 90px; text-align: center; color: #ffffff; }
.hero-logo { width: 110px; height: 110px; margin: 0 auto 20px; border-radius: 999px; background: rgba(255, 255, 255, 0.94); border: 5px solid var(--theme-primary); display: grid; place-items: center; color: var(--theme-primary); font-weight: 800; font-size: 28px; box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18); }
.hero-title { margin: 0; font-size: clamp(42px, 7vw, 84px); line-height: 0.95; font-weight: 900; letter-spacing: -0.03em; text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); }
.hero-subtitle { margin: 18px auto 0; max-width: 760px; font-size: clamp(20px, 2.2vw, 34px); line-height: 1.2; font-weight: 700; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25); }
.hero-actions { margin-top: 34px; display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
.hero-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 180px; padding: 16px 26px; border-radius: 14px; text-decoration: none; font-weight: 800; font-size: 18px; transition: transform 0.18s ease, opacity 0.18s ease; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18); }
.hero-btn:hover { transform: translateY(-2px); opacity: 0.96; }
.hero-btn--primary { background: var(--theme-accent); color: #ffffff; }
.hero-btn--secondary { background: var(--theme-secondary); color: var(--theme-primary); }
.hero-btn--ghost { background: var(--theme-primary); color: #ffffff; }
.content { max-width: 1200px; margin: 0 auto; padding: 60px 24px; }
.section { margin-bottom: 48px; background: #ffffff; padding: 32px; border-radius: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06); }
.section h2 { margin: 0 0 16px; font-size: 28px; font-weight: 800; color: var(--theme-primary); }
.section p { margin: 0; font-size: 18px; line-height: 1.7; color: #4b5563; }
.footer { background: var(--theme-primary); color: #ffffff; padding: 40px 24px; text-align: center; }
.footer-info { max-width: 800px; margin: 0 auto; font-size: 16px; }
.footer-info p { margin: 8px 0; }
@media (max-width: 768px) { .markise-bar { --markise-stripe-width: 60px; --markise-height: 55px; --markise-wave-height: 30px; } .hero { min-height: 520px; } .hero-inner { padding: 108px 18px 72px; } .hero-actions { gap: 10px; } .hero-btn { width: 100%; max-width: 320px; } .content { padding: 40px 18px; } .section { padding: 24px; } }
</style>
</head>
<body>
<div class="landing-page">
  <div class="markise-bar"></div>
  <div class="hero">
    <div class="hero-inner">
      <div class="hero-logo">${logoInitials}</div>
      <h1 class="hero-title">${h1}</h1>
      <p class="hero-subtitle">${intro}</p>
      <div class="hero-actions">
        <a href="/index.html" class="hero-btn hero-btn--primary">GÃ¥ til forsiden</a>
        <a href="/index.html#menu" class="hero-btn hero-btn--secondary">Se menu</a>
        ${phone ? `<a href="tel:${phone}" class="hero-btn hero-btn--ghost">Ring nu</a>` : ""}
        ${externalWebsite ? `<a href="${externalWebsite}" class="hero-btn hero-btn--ghost" target="_blank" rel="noopener">BesÃ¸g vores hjemmeside</a>` : ""}
      </div>
    </div>
  </div>
  <div class="content">${sectionsHtml}</div>
  <footer class="footer">
    <div class="footer-info">
      <p><strong>${companyName}</strong></p>
      <p>${address}</p>
      <p>Telefon: ${phone}</p>
      <p style="margin-top:20px;"><a href="/index.html" style="color:#fff;text-decoration:underline;">â† Tilbage til forsiden</a></p>
      ${externalWebsite ? `<p><a href="${externalWebsite}" target="_blank" rel="noopener" style="color:#fff;text-decoration:underline;">BesÃ¸g vores hjemmeside â†’</a></p>` : ""}
    </div>
  </footer>
</div>
</body>
</html>`;

  res.set("Cache-Control", "public, max-age=300, s-maxage=600");
  res.status(200).type("text/html").send(html);
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

// â”€â”€â”€ PROVISION RISK ANALYSIS SNAPSHOT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Auto-generates HACCP snapshot from central risk library
// Idempotent: Won't overwrite manual edits
exports.provisionRiskAnalysisSnapshot = functions.https.onCall(async (request, context) => {
  const data = request.data || request;
  const { generateRiskAnalysisSnapshot } = require("./riskAnalysisLibrary");
  
  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const organizationId = sanitizeString(data?.organizationId || companyId, 120);
  const industry = sanitizeString(data?.industry || "restaurant", 60);
  const companyName = sanitizeString(data?.companyName || "", 160);
  const profile = data?.profile || {};
  
  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
  }
  
  console.log("[provisionRiskAnalysisSnapshot] START", { companyId, locationId, industry });
  
  try {
    // Check if snapshot already exists
    const existingSnapshotsQuery = await db.collection("haccp_snapshots")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    
    if (!existingSnapshotsQuery.empty) {
      const existingSnapshot = existingSnapshotsQuery.docs[0].data();
      
      // Don't overwrite manual edits
      if (existingSnapshot.manualEdited || existingSnapshot.manualOverride) {
        console.log("[provisionRiskAnalysisSnapshot] Snapshot has manual edits, skipping update");
        return {
          ok: true,
          skipped: true,
          reason: "manual_edits_present",
          snapshotId: existingSnapshotsQuery.docs[0].id
        };
      }
      
      // Update auto-generated snapshot if version is older
      if (existingSnapshot.autoGenerated) {
        const existingVersion = existingSnapshot.version || "0.0.0";
        const newVersion = "2.0.0";
        
        if (existingVersion >= newVersion) {
          console.log("[provisionRiskAnalysisSnapshot] Snapshot is up to date");
          return {
            ok: true,
            skipped: true,
            reason: "already_up_to_date",
            snapshotId: existingSnapshotsQuery.docs[0].id,
            version: existingVersion
          };
        }
        
        console.log("[provisionRiskAnalysisSnapshot] Updating auto-generated snapshot");
        const updatedSnapshot = generateRiskAnalysisSnapshot({
          companyId,
          locationId,
          organizationId,
          industry,
          companyName,
          profile
        });
        
        await existingSnapshotsQuery.docs[0].ref.update({
          ...updatedSnapshot,
          updatedAt: FieldValue.serverTimestamp()
        });
        
        return {
          ok: true,
          updated: true,
          snapshotId: existingSnapshotsQuery.docs[0].id,
          controlPointsCount: updatedSnapshot.controlPoints.length
        };
      }
    }
    
    // Create new snapshot
    console.log("[provisionRiskAnalysisSnapshot] Creating new snapshot");
    const snapshot = generateRiskAnalysisSnapshot({
      companyId,
      locationId,
      organizationId,
      industry,
      companyName,
      profile
    });
    
    const docRef = await db.collection("haccp_snapshots").add({
      ...snapshot,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log("[provisionRiskAnalysisSnapshot] SUCCESS", {
      snapshotId: docRef.id,
      controlPointsCount: snapshot.controlPoints.length
    });
    
    return {
      ok: true,
      created: true,
      snapshotId: docRef.id,
      controlPointsCount: snapshot.controlPoints.length,
      industry: snapshot.industry,
      industryDisplayName: snapshot.industryDisplayName
    };
    
  } catch (error) {
    console.error("[provisionRiskAnalysisSnapshot] ERROR:", error);
    throw new functions.https.HttpsError("internal", `Kunne ikke oprette risikoanalyse: ${error.message}`);
  }
});

// â”€â”€â”€ CREATE QUICK ONBOARDING ACCOUNT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Creates Auth user AND all Firestore documents in one atomic operation
exports.createQuickOnboardingAccount = onCall(async (request) => {
  const { generateRiskAnalysisSnapshot } = require("./riskAnalysisLibrary");
  
  // V2 callable: payload is in request.data
  const payload = request.data || {};
  
  console.log("[createQuickOnboardingAccount] Received payload keys:", Object.keys(payload).join(", "));
  
  // Parse input
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const companyName = String(payload.companyName || "").trim();
  const address = String(payload.address || "").trim();
  const postalCode = String(payload.postalCode || "").trim();
  const city = String(payload.city || "").trim();
  const phone = String(payload.phone || "").trim();
  const industry = String(payload.industry || "restaurant").trim();
  const profile = payload.profile || {};

  const allowedQuickModules = new Set(["pos", "lagerkontrol", "bogforing", "egenkontrol", "menu", "seo", "kalkulation", "koerselskontrol"]);
  const quickModuleAliases = {
    accounting: "bogforing",
    bogfoering: "bogforing",
    "bogføring": "bogforing"
  };
  const selectedModules = Array.isArray(payload.selectedModules)
    ? payload.selectedModules
        .map((moduleSlug) => String(moduleSlug || "").trim().toLowerCase())
        .map((moduleSlug) => quickModuleAliases[moduleSlug] || moduleSlug)
        .filter((moduleSlug) => allowedQuickModules.has(moduleSlug))
    : [];

  const enabledModules = Array.from(new Set(selectedModules));
  if (!enabledModules.length) {
    throw new HttpsError("invalid-argument", "Vælg mindst ét modul for at fortsætte.");
  }

  const hasEgenkontrol = selectedModules.includes("egenkontrol");
  const hasPos = selectedModules.includes("pos");
  const hasLagerkontrol = selectedModules.includes("lagerkontrol");
  const hasBogforing = selectedModules.includes("bogforing");
  const hasMenu = selectedModules.includes("menu");
  const hasSeo = selectedModules.includes("seo");

  const moduleAccess = enabledModules.reduce((acc, moduleSlug) => {
    acc[moduleSlug] = {
      enabled: true,
      status: "trial",
      source: "quick-onboarding",
      activatedAt: FieldValue.serverTimestamp()
    };
    return acc;
  }, {});
  
  console.log("[createQuickOnboardingAccount] parsed:", {
    hasEmail: !!email,
    hasPassword: !!password,
    hasCompanyName: !!companyName,
    hasAddress: !!address,
    hasPhone: !!phone,
    industry,
    selectedModules: enabledModules,
    moduleFlags: {
      hasEgenkontrol,
      hasPos,
      hasLagerkontrol,
      hasBogforing,
      hasMenu,
      hasSeo
    }
  });
  
  // Validate input
  if (!email || !password || !companyName) {
    throw new HttpsError("invalid-argument", "Email, password og firmanavn er pÃ¥krÃ¦vet.");
  }
  
  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "Kodeordet skal vÃ¦re mindst 6 tegn.");
  }
  
  console.log("[createQuickOnboardingAccount] START", { email, companyName, industry });
  
  let uid;
  let companyId;
  let locationId;
  
  try {
    // Step 1: Create Firebase Auth user with Admin SDK
    console.log("[createQuickOnboardingAccount] STEP 1: Creating Auth user...");
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: companyName,
        emailVerified: false
      });
      console.log("[createQuickOnboardingAccount] STEP 1: SUCCESS - uid:", userRecord.uid);
    } catch (authError) {
      console.error("[createQuickOnboardingAccount] STEP 1 FAILED:", authError.code, authError.message);
      if (authError.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "Denne email er allerede i brug.");
      }
      throw new HttpsError("internal", `Auth user creation failed: ${authError.message}`);
    }
    
    uid = userRecord.uid;
    
    // Step 2: Generate IDs
    console.log("[createQuickOnboardingAccount] STEP 2: Generating IDs...");
    companyId = `company_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    locationId = `location_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const organizationId = companyId;
    console.log("[createQuickOnboardingAccount] STEP 2: SUCCESS - companyId:", companyId, "locationId:", locationId);
    
    // Step 3: Calculate trial dates
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days
    const ownerScopeMetadata = buildOwnerScopeMetadata(OWNER_KIND.REAL_OWNER);
    
    // Step 4: Create company document
    console.log("[createQuickOnboardingAccount] STEP 3: Creating company...");
    try {
      await db.collection("companies").doc(companyId).set({
      id: companyId,
      name: companyName,
      companyName: companyName,
      organizationId: companyId,
      ...ownerScopeMetadata,
      ownerUid: uid,
      address: address,
      postalCode: postalCode,
      city: city,
      phone: phone,
      status: "trial",
      subscriptionStatus: "trial",
      isPaid: false,
      selectedModules: enabledModules,
      enabledModules: enabledModules,
      activeModules: enabledModules,
      moduleAccess: moduleAccess,
      modules: moduleAccess,
      trialStartedAt: FieldValue.serverTimestamp(),
      trialEndsAt: trialEndsAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
      console.log("[createQuickOnboardingAccount] STEP 3: SUCCESS");
    } catch (companyError) {
      console.error("[createQuickOnboardingAccount] STEP 3 FAILED:", companyError);
      throw new HttpsError("internal", `Company creation failed: ${companyError.message}`);
    }
    
    // Step 5: Create location document
    console.log("[createQuickOnboardingAccount] STEP 4: Creating location...");
    try {
      const locationData = {
        id: locationId,
        locationId: locationId,
        companyId: companyId,
        organizationId: companyId,
        ...ownerScopeMetadata,
        name: companyName,
        companyName: companyName,
        prettyName: companyName,
        address: address,
        postalCode: postalCode,
        city: city,
        phone: phone,
        status: "active",
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      
      // Create in main locations collection
      await db.collection("locations").doc(locationId).set(locationData);
      
      // ALSO create in companies/{companyId}/locations subcollection (for prettyName.js)
      await db.collection("companies").doc(companyId).collection("locations").doc(locationId).set(locationData);
      
      console.log("[createQuickOnboardingAccount] STEP 4: SUCCESS (created in both locations and companies/{companyId}/locations)");
    } catch (locationError) {
      console.error("[createQuickOnboardingAccount] STEP 4 FAILED:", locationError);
      throw new HttpsError("internal", `Location creation failed: ${locationError.message}`);
    }
    
    // Step 6: Create user document
    console.log("[createQuickOnboardingAccount] STEP 5: Creating user document...");
    try {
      await db.collection("users").doc(uid).set({
      uid: uid,
      email: email,
      companyId: companyId,
      locationId: locationId,
      locationIds: [locationId],
      organizationId: companyId,
      ...ownerScopeMetadata,
      role: "owner",
      onboardingCompleted: false,
      trialStartedAt: FieldValue.serverTimestamp(),
      trialEndsAt: trialEndsAt,
      isPaid: false,
      subscriptionStatus: "trial",
      selectedModules: enabledModules,
      enabledModules: enabledModules,
      activeModules: enabledModules,
      moduleAccess: moduleAccess,
      modules: moduleAccess,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
      console.log("[createQuickOnboardingAccount] STEP 5: SUCCESS");
    } catch (userError) {
      console.error("[createQuickOnboardingAccount] STEP 5 FAILED:", userError);
      throw new HttpsError("internal", `User document creation failed: ${userError.message}`);
    }
    
    // Step 7: Create live_user_profiles document
    console.log("[createQuickOnboardingAccount] STEP 6: Creating live_user_profiles...");
    try {
    const liveProfileId = `${companyId}__${locationId}__live_profile`;
    await db.collection("live_user_profiles").doc(liveProfileId).set({
      uid: uid,
      email: email,
      companyId: companyId,
      locationId: locationId,
      organizationId: companyId,
      ...ownerScopeMetadata,
      role: "owner",
      
      profile: {
        // KRITISK FELTER (primÃ¦re)
        companyName: companyName,
        profileCompanyName: companyName,
        accountEmail: email,
        
        // FALLBACK FELTER (bruges i UI)
        name: companyName,
        displayName: companyName,
        
        // KONTAKT FELTER (fra input)
        address: address,
        postalCode: postalCode,
        city: city,
        phone: phone,
        cvr: "",
        
        // STRUKTUR KONSISTENS
        locationName: "Hovedlokation"
      },
      
      latestLiveProfileId: liveProfileId,
      
      status: "active",
      subscriptionStatus: "trial",
      isPaid: false,
      selectedModules: enabledModules,
      enabledModules: enabledModules,
      activeModules: enabledModules,
      moduleAccess: moduleAccess,
      modules: moduleAccess,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
      console.log("[createQuickOnboardingAccount] STEP 6: SUCCESS");
    } catch (profileError) {
      console.error("[createQuickOnboardingAccount] STEP 6 FAILED:", profileError);
      throw new HttpsError("internal", `Live profile creation failed: ${profileError.message}`);
    }
    
    // Step 7: Complete Egenkontrol onboarding with equipment and routines
    console.log("[createQuickOnboardingAccount] STEP 7: Completing onboarding with setup...");
    let onboardingResult = null;
    // Module-driven provisioning via the central MODULE_PROVISIONERS map (no scattered if-statements).
    // selectedModules decide which provisioner runs; egenkontrol keeps its exact previous behavior,
    // other modules are registry-ready no-ops until they have their own setup/runtime.
    const { runModuleProvisioners } = require("./modules/onboarding/moduleProvisioners");
    const moduleSetup = (payload.moduleSetup && typeof payload.moduleSetup === "object") ? payload.moduleSetup : {};
    const provisionResults = await runModuleProvisioners(enabledModules, {
      db,
      FieldValue,
      companyId,
      locationId,
      userId: uid,
      industry,
      // prefer the new moduleSetup.egenkontrol; fall back to the legacy flat setup payload
      setup: moduleSetup.egenkontrol || payload.setup,
      ownerScopeMetadata,
      generateCanonicalTaskTemplates,
      startDayForLocationCanonical
    });
    console.log("[createQuickOnboardingAccount] STEP 7 module provisioning:", provisionResults);

    const egenkontrolResult = provisionResults.egenkontrol;
    onboardingResult = (egenkontrolResult && !egenkontrolResult.error && !egenkontrolResult.skipped)
      ? egenkontrolResult
      : null;
    
    console.log("[createQuickOnboardingAccount] ALL STEPS COMPLETE", {
      uid,
      companyId,
      locationId,
      onboardingCompleted: !!onboardingResult
    });
    
    return {
      ok: true,
      uid: uid,
      email: email,
      companyId: companyId,
      locationId: locationId,
      organizationId: organizationId,
      selectedModules: enabledModules,
      enabledModules: enabledModules,
      ...(onboardingResult || {})
    };
    
  } catch (error) {
    console.error("[createQuickOnboardingAccount] ERROR:", error);
    
    // If error is already HttpsError, rethrow it
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError("internal", `Kunne ikke oprette konto: ${error.message}`);
  }
});

// â”€â”€â”€ COMPLETE QUICK ONBOARDING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Complete quick onboarding with setup-based equipment and routines
exports.completeQuickOnboarding = onCall({ region: "us-central1" }, async (request) => {
  const {
    normalizeQuickOnboardingSetup,
    resolveCanonicalRoutineKeysFromSetup,
    buildEquipmentFromSetup
  } = require("./js/setupToCanonicalRoutines");
  
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Du skal vÃ¦re logget ind.");
  }
  
  const payload = request.data || {};
  const userId = request.auth.uid;
  
  console.log("[completeQuickOnboarding] START", {
    userId,
    hasSetup: !!payload.setup,
    hasCompanyId: !!payload.companyId,
    hasLocationId: !!payload.locationId
  });
  
  try {
    // Validate required fields
    const companyId = String(payload.companyId || "").trim();
    const locationId = String(payload.locationId || "").trim();
    
    if (!companyId || !locationId) {
      throw new HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
    }

    const companySnap = await db.collection("companies").doc(companyId).get();
    const ownerScopeMetadata = buildOwnerScopeMetadata(companySnap.data()?.ownerKind || OWNER_KIND.REAL_OWNER);
    const companyModules = Array.isArray(companySnap.data()?.activeModules)
      ? companySnap.data().activeModules.map((moduleSlug) => String(moduleSlug || "").trim().toLowerCase()).filter(Boolean)
      : [];
    if (companyModules.length && !companyModules.includes("egenkontrol")) {
      console.log("[completeQuickOnboarding] skipped: Egenkontrol not active for company", {
        companyId,
        locationId,
        activeModules: companyModules
      });
      return {
        ok: true,
        skipped: true,
        reason: "egenkontrol_not_selected",
        companyId,
        locationId
      };
    }
    
    // Normalize setup
    const setup = normalizeQuickOnboardingSetup(payload.setup || {});
    console.log("[completeQuickOnboarding] Normalized setup:", setup);
    
    // Resolve routine keys
    const routineKeys = resolveCanonicalRoutineKeysFromSetup(setup);
    console.log("[completeQuickOnboarding] Routine keys:", routineKeys);
    
    // Build equipment
    const equipmentUnits = buildEquipmentFromSetup(setup, {
      companyId,
      locationId,
      userId
    }).map((unit) => ({ ...unit, ...ownerScopeMetadata }));
    console.log("[completeQuickOnboarding] Equipment units:", equipmentUnits.length);
    
    // Save equipment to Firestore
    for (const unit of equipmentUnits) {
      await db.collection("equipment").doc(unit.id).set(unit, { merge: true });
    }
    console.log("[completeQuickOnboarding] Equipment saved");

    const equipmentCounts = equipmentUnits.reduce((acc, unit) => {
      const type = String(unit.type || unit.equipmentType || "").trim();
      if (type) acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    await db.collection("onboarding_answers").doc(`${companyId}__${locationId}__onboarding`).set({
      companyId,
      organizationId: companyId,
      locationId,
      ...ownerScopeMetadata,
      equipmentCounts,
      quickOnboardingSetup: setup,
      source: "quick_onboarding",
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Generate canonical templates (FILTERED by routineKeys)
    const templatesResult = await generateCanonicalTaskTemplates({
      db,
      companyId,
      locationId,
      routineKeys,
      units: equipmentUnits,
      ownerScopeMetadata
    });
    console.log("[completeQuickOnboarding] Templates generated:", templatesResult);
    
    // Generate instances for today (FILTERED by routineKeys)
    const todayDateKey = new Date().toISOString().slice(0, 10);
    const instancesResult = await startDayForLocationCanonical({
      db,
      companyId,
      locationId,
      dateKey: todayDateKey,
      createdBy: userId,
      routineKeys,
      ownerScopeMetadata
    });
    console.log("[completeQuickOnboarding] Instances generated:", instancesResult);
    
    // Update company with setup
    await db.collection("companies").doc(companyId).update({
      quickOnboardingSetup: setup,
      quickOnboardingCompletedAt: FieldValue.serverTimestamp(),
      ...ownerScopeMetadata,
      updatedAt: FieldValue.serverTimestamp()
    });
    
    // Update location with setup
    await db.collection("locations").doc(locationId).update({
      quickOnboardingSetup: setup,
      quickOnboardingCompletedAt: FieldValue.serverTimestamp(),
      ...ownerScopeMetadata,
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log("[completeQuickOnboarding] SUCCESS", {
      companyId,
      locationId,
      equipmentCount: equipmentUnits.length,
      templatesCount: templatesResult.created + templatesResult.updated,
      instancesCount: instancesResult.instancesCreated,
      routineKeys: routineKeys.length
    });
    
    return {
      ok: true,
      companyId,
      locationId,
      equipmentCount: equipmentUnits.length,
      templatesCount: templatesResult.created + templatesResult.updated,
      instancesCount: instancesResult.instancesCreated,
      routineKeys
    };
    
  } catch (error) {
    console.error("[completeQuickOnboarding] ERROR:", error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError("internal", `Kunne ikke fÃ¦rdiggÃ¸re onboarding: ${error.message}`);
  }
});

// â”€â”€â”€ PROVISION QUICK ONBOARDING ACCOUNT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DEPRECATED: Use createQuickOnboardingAccount instead
// Creates all Firestore documents for quick onboarding after Auth user is created
exports.provisionQuickOnboardingAccount = functions.https.onCall(async (request, context) => {
  const data = request.data || request;
  const { generateRiskAnalysisSnapshot } = require("./riskAnalysisLibrary");
  
  const uid = sanitizeString(data?.uid || "", 160);
  const email = sanitizeString(data?.email || "", 160);
  const companyName = sanitizeString(data?.companyName || "", 160);
  const industry = sanitizeString(data?.industry || "restaurant", 60);
  const profile = data?.profile || data?.setup ? {
    equipment: data?.setup?.equipment || data?.equipment || {}
  } : {};
  
  // Verify authentication
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vÃ¦re logget ind.");
  }
  
  if (context.auth.uid !== uid) {
    throw new functions.https.HttpsError("permission-denied", "UID matcher ikke.");
  }
  
  if (!email || !companyName) {
    throw new functions.https.HttpsError("invalid-argument", "Email og firmanavn er pÃ¥krÃ¦vet.");
  }
  
  console.log("[provisionQuickOnboardingAccount] START", { uid, email, companyName, industry });
  
  try {
    // Generate IDs
    const companyId = `company_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const locationId = `location_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const organizationId = companyId;
    
    // Calculate trial dates
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days
    const ownerScopeMetadata = buildOwnerScopeMetadata(OWNER_KIND.REAL_OWNER);
    
    console.log("[provisionQuickOnboardingAccount] Creating company:", companyId);
    
    // Create company document
    await db.collection("companies").doc(companyId).set({
      id: companyId,
      name: companyName,
      companyName: companyName,
      organizationId: companyId,
      ...ownerScopeMetadata,
      ownerUid: uid,
      status: "trial",
      subscriptionStatus: "trial",
      isPaid: false,
      trialStartedAt: FieldValue.serverTimestamp(),
      trialEndsAt: trialEndsAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log("[provisionQuickOnboardingAccount] Creating location:", locationId);
    
    // Create location document
    await db.collection("locations").doc(locationId).set({
      id: locationId,
      locationId: locationId,
      companyId: companyId,
      organizationId: companyId,
      ...ownerScopeMetadata,
      name: "Hovedlokation",
      prettyName: "Hovedlokation",
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log("[provisionQuickOnboardingAccount] Creating user document:", uid);
    
    // Create user document
    await db.collection("users").doc(uid).set({
      uid: uid,
      email: email,
      companyId: companyId,
      locationId: locationId,
      locationIds: [locationId],
      organizationId: companyId,
      ...ownerScopeMetadata,
      role: "owner",
      onboardingCompleted: false,
      trialStartedAt: FieldValue.serverTimestamp(),
      trialEndsAt: trialEndsAt,
      isPaid: false,
      subscriptionStatus: "trial",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log("[provisionQuickOnboardingAccount] Creating live_user_profiles document...");
    
    // Create live_user_profiles document
    const liveProfileId = `${companyId}__${locationId}__live_profile`;
    await db.collection("live_user_profiles").doc(liveProfileId).set({
      uid: uid,
      email: email,
      companyId: companyId,
      locationId: locationId,
      organizationId: companyId,
      ...ownerScopeMetadata,
      role: "owner",
      profile: {
        companyName: companyName,
        accountEmail: email
      },
      status: "active",
      subscriptionStatus: "trial",
      isPaid: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log("[provisionQuickOnboardingAccount] Creating haccp_snapshots document...");
    
    // Create haccp_snapshots via risk library
    const snapshot = generateRiskAnalysisSnapshot({
      companyId,
      locationId,
      organizationId,
      industry,
      companyName,
      profile
    });
    
    await db.collection("haccp_snapshots").add({
      ...snapshot,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log("[provisionQuickOnboardingAccount] SUCCESS", {
      companyId,
      locationId,
      uid,
      controlPointsCount: snapshot.controlPoints.length
    });
    
    return {
      ok: true,
      companyId,
      locationId,
      organizationId,
      uid,
      controlPointsCount: snapshot.controlPoints.length,
      industry: snapshot.industry,
      industryDisplayName: snapshot.industryDisplayName
    };
    
  } catch (error) {
    console.error("[provisionQuickOnboardingAccount] ERROR:", error);
    throw new functions.https.HttpsError("internal", `Kunne ikke oprette konto: ${error.message}`);
  }
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
    throw new functions.https.HttpsError("invalid-argument", "sessionId er pÃ¥krÃ¦vet.");
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
  const billingPlan = sanitizeString(checkoutSession?.metadata?.plan || "monthly", 40);
  
  console.log("[FINALIZE] Billing plan from metadata:", billingPlan);

  if (source !== "onboarding_checkout") {
    throw new functions.https.HttpsError("failed-precondition", "Checkout-session tilhÃ¸rer ikke onboarding-flowet.");
  }

  if (!draftId || !companyId || !locationId) {
    throw new functions.https.HttpsError("failed-precondition", "Checkout-session mangler draft/company/location metadata.");
  }

  const isPaid = sessionStatus === "complete" && (paymentStatus === "paid" || paymentStatus === "no_payment_required");
  if (!isPaid) {
    throw new functions.https.HttpsError("failed-precondition", "Betalingen er ikke gennemfÃ¸rt endnu.");
  }

  const draftRef = db.collection("onboarding_checkout_drafts").doc(draftId);
  const draftSnap = await draftRef.get();
  if (!draftSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Onboarding-draft blev ikke fundet.");
  }

  const draft = draftSnap.data() || {};
  if (sanitizeString(draft.companyId || draft.organizationId, 120) !== companyId || sanitizeString(draft.locationId, 120) !== locationId) {
    throw new functions.https.HttpsError("permission-denied", "Draft tilhÃ¸rer ikke valgt company/location.");
  }

  const selectedModules = normalizeCheckoutSelectedModules(
    draft.selectedModules,
    checkoutSession?.metadata?.selectedModules,
    data?.selectedModules,
    draft.checkoutSummary?.selectedModules
  );
  if (!selectedModules.length) {
    throw new functions.https.HttpsError("failed-precondition", "Checkout-draft mangler valgte moduler.");
  }
  const hasEgenkontrol = selectedModules.includes("egenkontrol");
  const hasPos = selectedModules.includes("pos");
  const hasLagerkontrol = selectedModules.includes("lagerkontrol");
  const hasBogforing = selectedModules.includes("bogforing");
  const hasMenu = selectedModules.includes("menu");
  const hasSeo = selectedModules.includes("seo");
  const moduleAccess = buildCheckoutModuleAccess(selectedModules);
  const moduleMap = buildCheckoutModuleMap(selectedModules);

  console.log("[FINALIZE] Selected modules:", {
    selectedModules,
    hasEgenkontrol,
    hasPos,
    hasLagerkontrol,
    hasBogforing,
    hasMenu,
    hasSeo
  });

  const effectiveProvisioningToken = requestedProvisioningToken || metadataProvisioningToken;
  const draftProvisioningToken = sanitizeString(draft.provisioningToken || "", 220);
  const tokenMatches = Boolean(effectiveProvisioningToken && draftProvisioningToken && effectiveProvisioningToken === draftProvisioningToken);
  const sameAuthOwner = Boolean(authUid && sanitizeString(draft.uid || "", 160) === authUid);

  if (!tokenMatches && !sameAuthOwner) {
    throw new functions.https.HttpsError("permission-denied", "Ugyldig eller manglende provisioning-token.");
  }

  const actorUserId = authUid || sanitizeString(draft.uid || "", 160) || `checkout_guest_${draftId}`;
  const actorEmail = authEmail || sanitizeString(draft.userEmail || draft.onboardingEmail || "", 160);
  const ownerScopeMetadata = buildOwnerScopeMetadata(OWNER_KIND.REAL_OWNER);

  const existingSnapshotId = sanitizeString(draft.snapshotId, 180);
  const existingLiveProfileId = sanitizeString(draft.liveProfileId, 180);
  if (existingSnapshotId && existingLiveProfileId) {
    console.log(`âš ï¸ Onboarding already provisioned for ${companyId}__${locationId}, but checking risk analysis...`);
    
    // Check if risk analysis exists, if not generate it
    if (hasEgenkontrol) {
      const profile = sanitizeOnboardingProfile(draft.profile || draft.company || {});
      const riskRef = db.collection("companies").doc(companyId).collection("locations").doc(locationId).collection("risk_analysis").doc("current");
      const riskSnap = await riskRef.get();

      if (!riskSnap.exists) {
        console.log('ðŸ” Risk analysis missing, generating now...');
        try {
          const { buildStructuredHaccpData } = require('./provisioning');
          const controlPoints = buildStructuredHaccpData(profile);

          await riskRef.set({
            status: "generated",
            ...ownerScopeMetadata,
            onboardingSnapshot: profile,
            controlPoints: controlPoints,
            totalControlPoints: controlPoints.length,
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });

          console.log(`âœ… Risk analysis generated: ${controlPoints.length} control points`);
        } catch (riskError) {
          console.error('âŒ Risk analysis generation failed:', riskError);
        }
      } else {
        console.log('âœ… Risk analysis already exists');
      }
    } else {
      console.log("[FINALIZE] Risk analysis check skipped: Egenkontrol not selected", { selectedModules });
    }
    
    return {
      ok: true,
      alreadyProvisioned: true,
      draftId,
      snapshotId: existingSnapshotId,
      liveProfileId: existingLiveProfileId,
      selectedModules,
      summary: draft.summary || {}
    };
  }

  const userData = authUid
    ? (await getUserAccessProfile({ uid: authUid, email: authEmail }) || {})
    : {};
  const profile = sanitizeOnboardingProfile(draft.profile || draft.company || {});
  const riskModel = sanitizeRiskModelInput(draft.riskModel || {});
  let quickOnboardingSetup = null;
  let quickEquipmentUnits = [];
  let quickRoutineKeys = [];
  if ((draft.quickOnboardingSetup || draft.setup) && hasEgenkontrol) {
    try {
      const {
        normalizeQuickOnboardingSetup,
        resolveCanonicalRoutineKeysFromSetup,
        buildEquipmentFromSetup
      } = require("./js/setupToCanonicalRoutines");
      quickOnboardingSetup = normalizeQuickOnboardingSetup(draft.quickOnboardingSetup || draft.setup || {});
      quickRoutineKeys = resolveCanonicalRoutineKeysFromSetup(quickOnboardingSetup);
      quickEquipmentUnits = buildEquipmentFromSetup(quickOnboardingSetup, {
        companyId,
        locationId,
        userId: actorUserId,
        onboardingDraftId: draftId
      }).map((unit) => ({ ...unit, ...ownerScopeMetadata }));
    } catch (quickSetupErr) {
      console.warn("[finalizeOnboardingCheckoutProvisioning] quick setup normalization failed:", quickSetupErr.message);
    }
  }
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
    checkoutSessionId: sessionId,
    ownerScopeMetadata
  });
  if (quickOnboardingSetup) {
    liveProfilePayload.quickOnboardingSetup = quickOnboardingSetup;
    liveProfilePayload.onboardingAnswers = liveProfilePayload.onboardingAnswers || {};
    liveProfilePayload.onboardingAnswers.equipmentCounts = quickEquipmentUnits.reduce((acc, unit) => {
      const type = String(unit.type || unit.equipmentType || "").trim();
      if (type) acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }

  let snapshotId = "";
  let onboardingAnswersId = "";

  if (hasEgenkontrol) {
    const snapshotResult = await createHaccpSnapshotDocument({
      profile,
      riskModel,
      companyId,
      locationId,
      userId: actorUserId,
      ownerScopeMetadata
    });
    snapshotId = snapshotResult.snapshotId;

    // FJERNET: generateAndSaveEgenkontrolProgram (skriver til egenkontrol_programs, lÃ¦ses ikke af startDay)
    // FJERNET: buildStructuredHaccpData / companies/{id}/locations/... (isoleret, lÃ¦ses ingensteds)

    onboardingAnswersId = await upsertOnboardingAnswersDocument({
      companyId,
      locationId,
      userId: actorUserId,
      liveProfilePayload,
      ownerScopeMetadata
    });

    // â”€â”€â”€ PIPELINE: onboarding_answers â†’ risks â†’ task_templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Steg 1: Skriv risks fra onboarding (processer â†’ CCP/GAG regler)
    try {
      const { generateRisksFromOnboardingAnswers } = require("./admin/generateRisksFromOnboardingAnswers");
      const risksResult = await generateRisksFromOnboardingAnswers({ locationId });
      console.log("[provisioning] generateRisksFromOnboardingAnswers:", risksResult);
    } catch (risksErr) {
      console.error("[provisioning] generateRisksFromOnboardingAnswers failed:", risksErr.message);
    }

    // Steg 2: Byg task_templates fra risks (aggregeret per kontrolkategori)
    try {
      const { generateEgenkontrolFromRiskAnalysis } = require("./admin/generateEgenkontrolFromRiskAnalysis");
      const templatesResult = await generateEgenkontrolFromRiskAnalysis({ locationId, db });
      console.log("[provisioning] generateEgenkontrolFromRiskAnalysis:", templatesResult);
    } catch (templatesErr) {
      console.error("[provisioning] generateEgenkontrolFromRiskAnalysis failed:", templatesErr.message);
    }

    // Materialiser Quick Onboarding equipment til konkrete equipment docs
    if (quickEquipmentUnits.length > 0) {
      try {
        for (const unit of quickEquipmentUnits) {
          await db.collection("equipment").doc(unit.id).set(unit, { merge: true });
        }
        const templatesResult = await generateCanonicalTaskTemplates({
          db,
          companyId,
          locationId,
          routineKeys: quickRoutineKeys,
          units: quickEquipmentUnits,
          ownerScopeMetadata
        });
        console.log("[finalizeOnboardingCheckoutProvisioning] quick canonical templates:", templatesResult);
      } catch (quickEqErr) {
        console.error("[finalizeOnboardingCheckoutProvisioning] quick equipment/template sync failed:", quickEqErr.message);
      }
    }

    // Materialiser equipment counts til konkrete equipment docs
    try {
      if (quickEquipmentUnits.length === 0) {
        await syncOnboardingEquipmentUnits({
          db,
          companyId,
          locationId,
          equipmentCounts: liveProfilePayload.onboardingAnswers?.equipmentCounts || {},
          profile,
          ownerScopeMetadata
        });
      }
    } catch (eqErr) {
      console.error("[finalizeOnboardingCheckoutProvisioning] syncOnboardingEquipmentUnits failed:", eqErr.message);
    }

    // Ensure location has temperatureControlSettings for new schedule system
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      await ensureLocationTemperatureSettings(db, companyId, locationId, todayKey);
      console.log("[finalizeOnboardingCheckoutProvisioning] ensureLocationTemperatureSettings completed");
    } catch (tempErr) {
      console.error("[finalizeOnboardingCheckoutProvisioning] ensureLocationTemperatureSettings failed:", tempErr.message);
    }

    // Sync equipment-based cleaning task templates
    try {
      await syncEquipmentCleaningTemplates({ db, companyId, locationId, ownerScopeMetadata });
    } catch (cleanErr) {
      console.error("[finalizeOnboardingCheckoutProvisioning] syncEquipmentCleaningTemplates failed:", cleanErr.message);
    }

    // Sync equipment-based maintenance task templates
    try {
      await syncEquipmentMaintenanceTemplates({ db, companyId, locationId, ownerScopeMetadata });
    } catch (maintErr) {
      console.error("[finalizeOnboardingCheckoutProvisioning] syncEquipmentMaintenanceTemplates failed:", maintErr.message);
    }

    // Sync area-based cleaning task templates
    try {
      await syncAreaCleaningTemplates({ db, companyId, locationId, ownerScopeMetadata });
    } catch (areaErr) {
      console.error("[finalizeOnboardingCheckoutProvisioning] syncAreaCleaningTemplates failed:", areaErr.message);
    }

    // Sync process-based drift task templates
    try {
      await syncProcessDriftTemplates({ db, companyId, locationId, ownerScopeMetadata });
    } catch (driftErr) {
      console.error("[finalizeOnboardingCheckoutProvisioning] syncProcessDriftTemplates failed:", driftErr.message);
    }

    // Sync water control task templates
    try {
      await syncWaterControlTemplates({ db, companyId, locationId, ownerScopeMetadata });
    } catch (waterErr) {
      console.error("[finalizeOnboardingCheckoutProvisioning] syncWaterControlTemplates failed:", waterErr.message);
    }
  } else {
    console.log("[FINALIZE] Egenkontrol/HACCP provisioning skipped", { selectedModules });
  }

  const liveProfileUpdate = {
    ...liveProfilePayload,
    selectedModules,
    enabledModules: selectedModules,
    activeModules: selectedModules,
    moduleAccess,
    modules: moduleMap,
    updatedAt: FieldValue.serverTimestamp()
  };
  if (snapshotId) liveProfileUpdate.haccpSnapshotId = snapshotId;
  if (onboardingAnswersId) liveProfileUpdate.onboardingAnswersId = onboardingAnswersId;

  await db.collection("live_user_profiles").doc(liveProfileId).set(liveProfileUpdate, { merge: true });

  // FJERNET: ensureLiveTaskTemplatesForProvisioning â€” genererede scenario_based_haccp templates
  // som startDayForLocation eksplicit filtrerÃ©de vÃ¦k. Erstattet af risks-pipeline ovenfor.

  let finalUserId = authUid;

  // If user is not logged in, create a new Firebase Auth user and Firestore user document
  if (!authUid && profile.accountEmail && profile.accountPassword) {
    const email = sanitizeString(profile.accountEmail, 160).toLowerCase();
    const password = String(profile.accountPassword || "").trim();
    const displayName = sanitizeString(profile.ownerName || profile.companyName || "Ejer", 120);

    console.log(`ðŸ” User creation attempt - Email: ${email}, Password length: ${password.length}, DisplayName: ${displayName}`);

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
            ...ownerScopeMetadata,
            primaryLocationId: locationId,
            locationId,
            locationIds: [locationId],
            latestLiveProfileId: liveProfileId,
            latestHaccpSnapshotId: snapshotId || "",
            selectedModules,
            enabledModules: selectedModules,
            activeModules: selectedModules,
            moduleAccess,
            modules: moduleMap,
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
      ...ownerScopeMetadata,
      email: actorEmail,
      primaryLocationId: locationId,
      locationId,
      locationIds: nextLocationIds,
      latestLiveProfileId: liveProfileId,
      latestHaccpSnapshotId: snapshotId || "",
      selectedModules,
      enabledModules: selectedModules,
      activeModules: selectedModules,
      moduleAccess,
      modules: moduleMap,
      onboardingStatus: "completed",
      onboardingCompletedAt: FieldValue.serverTimestamp(),
      latestCloudinaryAssets: cloudinaryAssets,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  // STEP 5: Update company status to active with subscription info
  const companyRef = db.collection("companies").doc(companyId);
  const locationRef = companyRef.collection("locations").doc(locationId);
  const companyDisplayName = sanitizeString(profile.companyName || "", 160);
  const locationDisplayName =
    sanitizeString(profile.locationName || "", 160) ||
    (String(locationId || "").trim().endsWith("__main") ? "Hovedlokation" : "") ||
    companyDisplayName ||
    locationId;

  await companyRef.set({
    companyId,
    name: companyDisplayName || companyId,
    displayName: companyDisplayName || companyId,
    ...ownerScopeMetadata,
    address: sanitizeString(profile.address || "", 220) || null,
    zip: sanitizeString(profile.zip || "", 40) || null,
    city: sanitizeString(profile.city || "", 120) || null,
    status: "active",
    selectedModules,
    enabledModules: selectedModules,
    activeModules: selectedModules,
    moduleAccess,
    modules: moduleMap,
    subscription: {
      plan: billingPlan,
      selectedModules,
      startedAt: FieldValue.serverTimestamp(),
      stripeSessionId: sessionId
    },
    activatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await locationRef.set({
    companyId,
    organizationId: companyId,
    locationId,
    ...ownerScopeMetadata,
    name: locationDisplayName,
    displayName: locationDisplayName,
    address: sanitizeString(profile.address || "", 220) || null,
    zip: sanitizeString(profile.zip || "", 40) || null,
    city: sanitizeString(profile.city || "", 120) || null,
    status: "active",
    selectedModules,
    enabledModules: selectedModules,
    activeModules: selectedModules,
    moduleAccess,
    modules: moduleMap,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await companyRef.collection("subscriptions").doc("current").set({
    status: "active",
    ...ownerScopeMetadata,
    plan: billingPlan,
    selectedModules,
    activeModules: selectedModules,
    stripeSessionId: sessionId,
    source: "onboarding_checkout",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const accessBatch = db.batch();
  selectedModules.forEach((moduleKey) => {
    const accessDocId = `${toDocSafeId(moduleKey)}__location_${toDocSafeId(locationId)}__all-users`;
    accessBatch.set(companyRef.collection("module_access").doc(accessDocId), {
      moduleKey,
      status: "active",
      source: "onboarding_checkout",
      assignedToCompanyId: companyId,
      assignedToLocationId: locationId,
      assignedToUserId: "",
      stripeSessionId: sessionId,
      billingPlan,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  await accessBatch.commit();
  
  console.log("[FINALIZE] Company status updated to active with subscription:", billingPlan);

  const draftCompletionUpdate = {
    summary,
    cloudinaryAssets,
    liveProfileId,
    stripeSessionId: sessionId,
    billingPlan,
    selectedModules,
    activeModules: selectedModules,
    moduleAccess,
    status: "completed",
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  if (snapshotId) draftCompletionUpdate.snapshotId = snapshotId;
  if (onboardingAnswersId) draftCompletionUpdate.onboardingAnswersId = onboardingAnswersId;
  await draftRef.set(draftCompletionUpdate, { merge: true });

  const matchingCheckoutSessions = await db
    .collection("checkout_sessions")
    .where("stripeSessionId", "==", sessionId)
    .limit(5)
    .get();

  if (!matchingCheckoutSessions.empty) {
    const batch = db.batch();
    matchingCheckoutSessions.docs.forEach((docSnap) => {
      const checkoutUpdate = {
        status: "completed",
        onboardingProvisioned: true,
        onboardingDraftId: draftId,
        liveProfileId,
        selectedModules,
        activeModules: selectedModules,
        updatedAt: FieldValue.serverTimestamp()
      };
      if (onboardingAnswersId) checkoutUpdate.onboardingAnswersId = onboardingAnswersId;
      if (snapshotId) checkoutUpdate.haccpSnapshotId = snapshotId;
      batch.set(docSnap.ref, checkoutUpdate, { merge: true });
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
    selectedModules,
    taskTemplateCount: 0,
    dashboardUrl: hasEgenkontrol ? "/dashboard#haccp-print-section" : "/dashboard.html",
    summary
  };
});

exports.getCloudinarySignature = onCall({ region: "us-central1", secrets: ["FUNCTIONS_CONFIG_EXPORT"] }, async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Log ind for at uploade billeder.");
  }

  const crypto = require("crypto");
  let config = {};
  try {
    const secretConfig = FUNCTIONS_CONFIG.value();
    config = typeof secretConfig === "string"
      ? JSON.parse(secretConfig || "{}")
      : (secretConfig || {});
  } catch (_) {
    try { config = JSON.parse(process.env.FUNCTIONS_CONFIG_EXPORT || "{}"); } catch (_) {}
  }

  const cloudName =
    config?.cloudinary?.cloud_name ||
    process.env.CLOUDINARY_CLOUD_NAME ||
    "";
  const apiKey =
    config?.cloudinary?.api_key ||
    process.env.CLOUDINARY_API_KEY ||
    "";
  const apiSecret =
    config?.cloudinary?.api_secret ||
    process.env.CLOUDINARY_API_SECRET ||
    "";

  console.log("[Cloudinary] Config check:", {
    hasCloudName: Boolean(cloudName),
    hasApiKey: Boolean(apiKey),
    hasApiSecret: Boolean(apiSecret),
    cloudNameSource: cloudName ? (config?.cloudinary?.cloud_name ? "FUNCTIONS_CONFIG_EXPORT" : "process.env") : "none",
    envVarsAvailable: {
      CLOUDINARY_CLOUD_NAME: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
      CLOUDINARY_API_KEY: Boolean(process.env.CLOUDINARY_API_KEY),
      CLOUDINARY_API_SECRET: Boolean(process.env.CLOUDINARY_API_SECRET)
    }
  });

  if (!cloudName || !apiKey || !apiSecret) {
    console.error("[Cloudinary] Missing credentials. Check functions/.env file or Firebase secrets.");
    throw new HttpsError(
      "failed-precondition",
      "Cloudinary er ikke konfigureret. Kontakt administrator. Se CLOUDINARY_SETUP.md for instruktioner."
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
  const userId = request.auth.uid;

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

function buildVisionPrompt({ moduleType, itemId, contextType, citizenProfile, taskTitle, taskCategory, autoRoute = false }) {
  const moduleLower = sanitizeString(moduleType || "egenkontrol", 80).toLowerCase();
  const contextLower = sanitizeString(contextType || "", 80).toLowerCase();
  const categoryLower = sanitizeString(taskCategory || "", 80).toLowerCase();

  const commonRules = [
    "Skriv kort, professionelt og juridisk egnet pÃ¥ dansk.",
    "Vurder kun det, der kan ses i billedet.",
    "UndgÃ¥ gÃ¦t om usynlige forhold.",
    "FOKUS: KoncentrÃ©r dig om det primÃ¦re objekt/omrÃ¥de i billedet â€“ ignorer rod, kaos eller stÃ¸j i baggrunden medmindre det er en direkte hygiejnerisiko.",
    "PROAKTIV SCANNING: Selv hvis du ikke er blevet bedt specifikt om det, skal du ALTID rÃ¥be op med '[AFVIGELSE]' hvis du ser: Ã¥bne beholdere uden lÃ¥g, redskaber (skeer, knive, sleev) placeret direkte i madvarer, udÃ¦kkede rÃ¥varer, spild eller dryp pÃ¥ hylder, datostempler der er overskredet, eller lignende konkrete hygiejnerisici. Forklar prÃ¦cist hvad der skal gÃ¸res.",
    "AI maa kun give et forslag til manuel vurdering. AI maa aldrig afgoere eller oprette en afvigelse alene.",
    "Skriv IKKE '[AFVIGELSE]' som kommando. Brug i stedet severity, confidenceScore og suggestedIssue til at beskrive mulig risiko.",
    "Hvis du ser mulig hygiejnerisiko, formuler det som et manuelt forslag brugeren skal bekraefte.",
    "Returner KUN gyldig JSON med de aftalte felter."
  ].join(" ");

  // AI-Router mode: Auto-categorize image type
  if (autoRoute) {
    return [
      "Du er en hygiejne-inspektÃ¸r og revisor for et professionelt kÃ¸kken-dokumentationssystem.",
      "AnalysÃ©r dette optimerede billede med kritisk blik og identificÃ©r hvad det viser:",
      "1. FAKTURA/BILAG: Hvis du ser tekst med belÃ¸b, leverandÃ¸rnavn, fakturanummer, eller regnskabsbilag â†’ kategori: 'finance'",
      "   - UdtrÃ¦k leverandÃ¸r, totalbelÃ¸b, momsbelÃ¸b (25%), fakturadato.",
      "   - Vurder om teksten er lÃ¦sbar til bogfÃ¸ring.",
      "2. EGENKONTROL (MASKINE/UDSTYR): Hvis du ser kÃ¸kkenudstyr (ovn, kÃ¸leskab, emhÃ¦tte, opvaskemaskine) â†’ kategori: 'egenkontrol'",
      "   - LED EFTER: Madrester, fedt, snavs, eller urenheder.",
      "   - Hvis det er et display: UdtrÃ¦k temperatur med prÃ¦cis vÃ¦rdi og enhed (f.eks. '+4Â°C' eller '-18Â°C').",
      "   - Hvis du finder fejl (synligt snavs, madrester, fedt, hÃ¸j temperatur >+8Â°C eller lav temperatur >-15Â°C), skal dit svar STARTE med '[AFVIGELSE]'.",
      "   - Beskriv hvad du ser (f.eks. 'Ovn rengjort, ingen restprodukter' eller '[AFVIGELSE] Synlige madrester i hjÃ¸rner, fedt pÃ¥ pakninger').",
      "3. MADANRETNING: Hvis du ser en tallerken med mad, dysfagi-kost, eller portion til borger â†’ kategori: 'institution'",
      "   - Vurder konsistens, tekstur, dysfagi-egnethed.",
      "Vurder billedets KLARHED (image_clarity): 'clear' hvis alle detaljer er synlige, 'unclear' hvis uskarpt/mÃ¸rkt/utydeligt.",
      commonRules,
      "Returner kategori baseret pÃ¥ hvad billedet FAKTISK viser, ikke hvad brugeren siger.",
      "Husk: Start beskrivelse med '[AFVIGELSE]' hvis du finder hygiejneproblemer eller temperaturafvigelser."
    ].join(" ");
  }

  // Specific module prompts (existing logic)
  if (moduleLower === "finance") {
    return [
      "Du analyserer et foto af et regnskabsbilag fra professionel foodservice-drift.",
      "UdtrÃ¦k leverandÃ¸rnavn, totalbelÃ¸b, momsbelÃ¸b og fakturadato, hvis synligt.",
      "Vurder om bilaget er lÃ¦sbart til bogfÃ¸ring.",
      commonRules,
      "Brug kategori: finance."
    ].join(" ");
  }

  if (moduleLower === "institution" || contextLower === "institution") {
    const citizenInfo = sanitizeString(citizenProfile || "", 300);
    return [
      "Du analyserer et billede af en anretning i institutionskÃ¸kken.",
      "Vurder konsistens ift. dysfagi/blÃ¸d kost, synlige klumper, tekstur og ensartethed.",
      citizenInfo ? `Borgerprofil: ${citizenInfo}.` : "Borgerprofil: Ikke angivet.",
      commonRules,
      "Brug kategori: institution."
    ].join(" ");
  }

  if (moduleLower === "commercial" || contextLower === "commercial") {
    return [
      "Du analyserer et rengÃ¸rings- eller udstyrsfoto fra et kommercielt kÃ¸kken.",
      "Vurder renhedsgrad for ovne, emhÃ¦tter, kÃ¸lediske og synlige filtre/tÃ¸mning.",
      commonRules,
      "Brug kategori: commercial."
    ].join(" ");
  }

  const scopedItem = sanitizeString(itemId || taskTitle || "udstyr", 180);
  const scopedItemLower = scopedItem.toLowerCase();

  // ADSKILLELSE / SEPARATION
  if (categoryLower.includes("adskillelse") || categoryLower.includes("separation") || categoryLower.includes("kryds") || scopedItemLower.includes("adskillelse") || scopedItemLower.includes("separation") || scopedItemLower.includes("kryds")) {
    return [
      "Du er en HACCP-inspektÃ¸r. AnalysÃ©r dette billede med fokus pÃ¥ ADSKILLELSE af rÃ¥varer og kryds-kontaminationsrisiko.",
      `Opgave: ${scopedItem}.`,
      "Tjek SPECIFIKT:",
      "1. FARVEKODER: Bruges de rigtige farver til skÃ¦rebrÃ¦tter/knive (rÃ¸d=rÃ¥t kÃ¸d, gul=fjerkrÃ¦, grÃ¸n=grÃ¸nt, blÃ¥=fisk, hvid=mejeriprodukter)?",
      "2. ADSKILLELSE: Er rÃ¥t kÃ¸d/fisk adskilt fra tilberedte varer med fysisk afstand, separat emballage, eller skillevÃ¦g?",
      "3. OPBEVARINGSHÃ˜JDE: Er rÃ¥t kÃ¸d/fisk placeret UNDER tilberedte varer (ikke over)?",
      "4. KONTAMINATIONSRISIKO: Er der dryp, spild, eller uhygiejnisk kontakt mellem produkttyper?",
      "Hvis du finder ADSKILLELSESPROBLEM: Start med '[AFVIGELSE]' og forklar risikoen (kryds-kontaminering = alvorlig Salmonella/E.coli-risiko).",
      "Hvis adskillelsen er korrekt: BekrÃ¦ft med kort professionel beskrivelse.",
      commonRules,
      "Brug kategori: egenkontrol."
    ].join(" ");
  }

  // TEMPERATUR KONTROL
  if (categoryLower.includes("temperatur") || categoryLower.includes("kÃ¸l") || categoryLower.includes("frost") || categoryLower.includes("varmt") || categoryLower.includes("varmhold") || scopedItemLower.includes("temp") || scopedItemLower.includes("kÃ¸l") || scopedItemLower.includes("frost") || scopedItemLower.includes("Â°c")) {
    return [
      "Du er en HACCP-temperaturekspert. AnalysÃ©r dette billede med FOKUS PÃ… TEMPERATUR.",
      `Udstyr/opgave: ${scopedItem}.`,
      "Hvis du ser et DISPLAY eller TERMOMETER:",
      "- AflÃ¦s temperaturen med PRÃ†CISION (f.eks. '-18.2Â°C' eller '+4.1Â°C').",
      "- Returner tallet med fortegn i temperature_value (f.eks. -18.2 eller 4.1).",
      "- GRÃ†NSEVÃ†RDIER: KÃ¸l â‰¤+5Â°C, Frost â‰¤-18Â°C, Varmholdelse â‰¥+65Â°C.",
      "- Er temperaturen INDEN FOR grÃ¦nsen? â†’ handling_udfort: true og bekrÃ¦ft.",
      "- Er temperaturen UDENFOR grÃ¦nsen? â†’ Start med '[AFVIGELSE]' og forklar risikoen (bakterievÃ¦kst, HACCP-brud).",
      "Hvis du IKKE kan se temperaturen tydeligt: Angiv image_clarity: 'unclear'.",
      "Tjek ogsÃ¥: Er udstyret lukket korrekt? Er der rim/is-dannelse (tegn pÃ¥ temperatursvingninger)?",
      commonRules,
      "Brug kategori: egenkontrol."
    ].join(" ");
  }

  // OPBEVARING / STORAGE
  if (categoryLower.includes("opbevaring") || categoryLower.includes("storage") || categoryLower.includes("lager") || categoryLower.includes("hylde") || scopedItemLower.includes("opbevaring") || scopedItemLower.includes("lager") || scopedItemLower.includes("hylde")) {
    return [
      "Du er en hygiejnekonsulent. AnalysÃ©r dette billede med fokus pÃ¥ KORREKT OPBEVARING af fÃ¸devarer.",
      `OmrÃ¥de/opgave: ${scopedItem}.`,
      "Tjek SPECIFIKT:",
      "1. Ã…BNE BEHOLDERE: Er der beholdere, gryder, skÃ¥le eller pakker uden lÃ¥g/dÃ¦kning? En Ã¥ben beholder = kontaminationsrisiko (hÃ¥rhygiejne, insekter, luftbÃ¥rne bakterier). Forklar hvad der mangler (lÃ¥g, plastikfilm, dÃ¦kkende emballage).",
      "2. REDSKABER I MAD: Er der en ske, slev, kniv eller andet redskab placeret DIREKTE I en madbeholder? Det er en hygiejnerisiko (kryds-kontaminering, bakterievÃ¦kst pÃ¥ hÃ¥ndtaget). RÃ¥b op: forklar at redskabet skal fjernes og opbevares separat.",
      "3. EMBALLAGE: Er alle Ã¸vrige varer forsvarligt emballerede/dÃ¦kkede?",
      "4. DATOSTEMPLING: Er varer mÃ¦rket med Ã¥bningsdato/holdbarhed? Kan du se udlÃ¸bsdatoer?",
      "5. RÃ†KKEFÃ˜LGE (FIFO): Er Ã¦ldste varer placeret forrest (First In, First Out)?",
      "6. HYGIEJNE: Er hylder/enheder rene? Rester, spild eller kondensvand?",
      "7. ADSKILLELSE: Er rÃ¥varer og tilberedte varer adskilt korrekt (rÃ¥t under, tilberedt over)?",
      "Hvis du finder OPBEVARINGSFEJL: Start med '[AFVIGELSE]' og forklar den konkrete risiko.",
      "Hvis opbevaringen er korrekt: BekrÃ¦ft med kort professionel beskrivelse.",
      commonRules,
      "Brug kategori: egenkontrol."
    ].join(" ");
  }

  // MODTAGEKONTROL / VAREMODTAGELSE
  if (categoryLower.includes("modtagelse") || categoryLower.includes("levering") || categoryLower.includes("varemodtagelse") || scopedItemLower.includes("modtagelse") || scopedItemLower.includes("levering")) {
    return [
      "Du er en varekontrollÃ¸r. AnalysÃ©r dette billede med fokus pÃ¥ VAREMODTAGELSE.",
      `Ordre/vare: ${scopedItem}.`,
      "Tjek SPECIFIKT:",
      "1. TEMPERATUR: Er der synlig temperatur pÃ¥ mÃ¦rkat eller thermometer? KÃ¸dvarer â‰¤+5Â°C, Fisk â‰¤+2Â°C, Frost â‰¤-18Â°C.",
      "2. EMBALLAGE: Er emballagen hel, ren og ubeskadiget (ingen huller, misfarvning, kondensation)?",
      "3. SYNLIGE FEJL: Misfarvning, lugtproblemer (skriv 'kan ikke vurdere lugt fra billede'), beskadigelse?",
      "4. MÃ†RKNING: Er produktet korrekt mÃ¦rket (art, mÃ¦ngde, holdbarhed)?",
      "Hvis du finder FEJL ved modtagelsen: Start med '[AFVIGELSE]' â€“ varen skal AFVISES og returneres til leverandÃ¸ren.",
      "Hvis varen er OK: BekrÃ¦ft med 'Vare godkendt til modtagelse' og noter relevante observationer.",
      commonRules,
      "Brug kategori: egenkontrol."
    ].join(" ");
  }

  // RENGÃ˜RING / CLEANING
  if (categoryLower.includes("rengÃ¸ring") || categoryLower.includes("rengoring") || categoryLower.includes("cleaning") || categoryLower.includes("hygiejne") || scopedItemLower.includes("rengÃ¸r") || scopedItemLower.includes("rengor")) {
    return [
      "Du er en hygiejneinspektÃ¸r. AnalysÃ©r dette billede med KRITISK blik pÃ¥ RENGÃ˜RINGSRESULTATET.",
      `OmrÃ¥de/udstyr: ${scopedItem}.`,
      "LED SPECIFIKT EFTER:",
      "1. MADRESTER: Synlige rester af mad, fedt, eller organisk materiale?",
      "2. OVERFLADERENHED: Er overflader rent og fri for fedtfilm?",
      "3. HJÃ˜RNER OG SAMLINGER: Er hjÃ¸rner, revner og samlinger rene (skjulesteder for bakterier)?",
      "4. DRIFTSSLID: Misfarvning i stÃ¥l, patina og normalt slid er IKKE hygiejnerisiko â€“ beskriv det som acceptabelt.",
      "Hvis du finder SYNLIG SNAVS eller MADRESTER: Start med '[AFVIGELSE]' og forklar risikoen.",
      "Hvis rengÃ¸ringen er tilfredsstillende: BekrÃ¦ft kort og professionelt.",
      commonRules,
      "Brug kategori: egenkontrol."
    ].join(" ");
  }
  if (scopedItemLower.includes("gulv") || scopedItemLower.includes("aflÃ¸b") || scopedItemLower.includes("rist") || scopedItemLower.includes("drain") || scopedItemLower.includes("floor")) {
    return [
      "Du er en erfaren kÃ¸kkenchef-mentor. AnalysÃ©r dette billede af et gulvaflÃ¸b eller en rist med FAGLIGT blik.",
      "VÃ¦r STRENG med hygiejne (madrester, organisk materiale), men REALISTISK med driftsslid (misfarvning i stÃ¥l, slid pÃ¥ pakninger).",
      "Tjek SPECIFIKT for:",
      "1. ORGANISK MATERIALE: Er der synlige madrester, fedtslam eller snavs i risten eller under koppen?",
      "2. VANDLÃ…S: Er der vand i vandlÃ¥sen (for at undgÃ¥ lugtgener)?",
      "3. RIST: Sidder risten korrekt pÃ¥ plads?",
      "Hvis du finder MADRESTER i aflÃ¸bet:",
      "- Dit svar skal STARTE med '[AFVIGELSE]'",
      "- Forklar HVORFOR det er et problem: 'Madrester fundet i aflÃ¸b. Dette tiltrÃ¦kker skadedyr (rotter, kakerlakker) og skaber bakterievÃ¦kst (Salmonella, E. coli). Skal fjernes straks.'",
      "- SÃ¦t handling_udfort til false",
      "Hvis aflÃ¸bet er RENT, men har misfarvning/patina:",
      "- Beskriv: 'AflÃ¸b rengjort. Ingen madrester. Misfarvning i stÃ¥l er normalt driftsslid, ikke hygiejnerisiko. Rist korrekt placeret.'",
      "- SÃ¦t handling_udfort til true",
      "Hvis aflÃ¸bet er RENT:",
      "- Beskriv: 'AflÃ¸b rengjort. Ingen madrester. Rist korrekt placeret. VandlÃ¥s OK.'",
      "- SÃ¦t handling_udfort til true",
      commonRules,
      "Brug kategori: egenkontrol.",
      "Husk: Forklar HVORFOR noget er et problem (risiko for skadedyr, bakterievÃ¦kst), ikke bare 'beskidt'. VÃ¦r realistisk om normal slid vs. hygiejnerisiko."
    ].join(" ");
  }

  return [
    "Du er en erfaren kÃ¸kkenchef-mentor. AnalysÃ©r dette optimerede billede fra et professionelt kÃ¸kken med FAGLIGT blik.",
    `Objekt/opgave: ${scopedItem}.`,
    "VÃ¦r STRENG med hygiejne (madrester, temperatur), men REALISTISK med driftsslid (misfarvning, slid pÃ¥ pakninger).",
    "LED EFTER: Madrester, fedt, snavs, urenheder, eller temperaturafvigelser.",
    "Hvis det er en maskine: Er den ren? Synlige madrester? Fedt pÃ¥ pakninger eller lister? Hvis du ser misfarvning i stÃ¥l eller normal slid, forklar at det er acceptabelt driftsslid.",
    "Hvis det er et DISPLAY (temperatur): Find temperaturen pÃ¥ displayet. Returner tallet med fortegn i temperature_value (f.eks. '-18.5' eller '+4.0').",
    "Hvis det er et filter: Er det tÃ¸mt? Synligt snavs?",
    "Hvis du finder HYGIEJNE-FEJL (madrester, fedt, temperaturafvigelser):",
    "- Dit svar skal STARTE med '[AFVIGELSE]'",
    "- Forklar HVORFOR det er et problem (f.eks. 'Madrester tiltrÃ¦kker skadedyr', 'Temperatur >8Â°C giver bakterievÃ¦kst', 'Fedt pÃ¥ pakninger skaber biofilm')",
    "- VÃ¦r SPECIFIK om risikoen, ikke bare 'beskidt'",
    "Hvis du ser NORMAL SLID (misfarvning, patina, slid pÃ¥ overflader):",
    "- Beskriv: 'Udstyr rengjort. Misfarvning/slid er normalt driftsslid, ikke hygiejnerisiko.'",
    "- SÃ¦t handling_udfort til true",
    "Skriv en kort, formel bekrÃ¦ftelse pÃ¥ dansk til en egenkontrol-rapport.",
    commonRules,
    "Brug kategori: egenkontrol.",
    "Husk: Forklar HVORFOR problemer er farlige. VÃ¦r realistisk om forskellen pÃ¥ hygiejnerisiko vs. normal slid. Du er en lÃ¦remester, ikke en politibetjent."
  ].join(" ");
}

exports.analyzeCloudinaryAsset = onCall(
  { secrets: [OPENAI_API_KEY], region: "us-central1" },
  async (request) => {
  const data = request.data;
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Log ind for at analysere billeder.");
  }

  const imageUrl = sanitizeString(data?.imageUrl || "", 2000);
  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const moduleType = sanitizeString(data?.moduleType || "egenkontrol", 80);
  const itemId = sanitizeString(data?.itemId || "", 180);
  const contextType = sanitizeString(data?.contextType || "", 80);
  const taskTitle = sanitizeString(data?.taskTitle || "", 220);
  const taskCategory = sanitizeString(data?.taskCategory || "", 80);
  const citizenProfile = sanitizeString(data?.citizenProfile || "", 320);

  if (!imageUrl || !/^https:\/\//i.test(imageUrl)) {
    throw new functions.https.HttpsError("invalid-argument", "imageUrl mangler eller er ugyldig.");
  }

  if (companyId && locationId) {
    await assertStartDayAccess({
      uid: request.auth.uid,
      email: request.auth.token?.email || "",
      companyId,
      locationId
    });
  }

  const openAiApiKey =
    OPENAI_API_KEY.value() ||
    process.env.OPENAI_API_KEY ||
    "";

  if (!openAiApiKey) {
    throw new HttpsError(
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
    taskCategory,
    autoRoute: true
  });

  const jsonShape = [
    "Returner JSON med disse felter:",
    "handling_udfort: boolean",
    "beskrivelse: string",
    "confidence: number mellem 0 og 1",
    "confidenceScore: number mellem 0 og 1",
    "severity: string ('low', 'medium', 'high' eller 'critical')",
    "suggestedIssue: string|null (kort forslag til hvad brugeren manuelt bÃ¸r kontrollere)",
    "kategori: string (finance, egenkontrol, eller institution)",
    "image_clarity: string ('clear' eller 'unclear')",
    "temperature_value: number|null (hvis display viser temperatur, returner tallet med fortegn, f.eks. -18.5 eller 4.0)",
    "has_fresh_fish: boolean (true hvis du ser fersk fisk pÃ¥ billedet)",
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
            content: "Du er fÃ¸devaresikkerheds-assistent for egenkontrol og dokumentation. Lever kun validerbar, sober vurdering."
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
    throw new HttpsError("internal", "Kunne ikke gennemfÃ¸re billedanalyse.");
  }

  const rawText = String(
    responseData?.choices?.[0]?.message?.content || ""
  ).trim();

  const parsed = extractJsonBlock(rawText) || {};

  const handlingUdfort = parsed?.handling_udfort === true;
  const beskrivelse = sanitizeString(
    parsed?.beskrivelse || "Billedet er analyseret automatisk. VerificÃ©r resultatet manuelt fÃ¸r godkendelse.",
    1800
  );
  const confidenceRaw = Number(parsed?.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : 0.55;
  const confidenceScoreRaw = Number(parsed?.confidenceScore);
  const confidenceScore = Number.isFinite(confidenceScoreRaw)
    ? Math.max(0, Math.min(1, confidenceScoreRaw))
    : confidence;
  const severityCandidate = sanitizeString(parsed?.severity || "", 40).toLowerCase();
  const severity = ["low", "medium", "high", "critical"].includes(severityCandidate)
    ? severityCandidate
    : (Array.isArray(parsed?.risikoflag) && parsed.risikoflag.length ? "medium" : "low");
  const suggestedIssue = sanitizeString(
    parsed?.suggestedIssue ||
      (Array.isArray(parsed?.risikoflag) && parsed.risikoflag.length ? parsed.risikoflag[0] : "") ||
      "",
    360
  );

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
    confidenceScore,
    severity,
    suggestedIssue,
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
        ? "Utydeligt billede â€“ prÃ¸v igen for korrekt dokumentation"
        : `Billede kategoriseret som: ${detectedCategory === "finance" ? "Faktura/Regnskab" : detectedCategory === "institution" ? "Madanretning/Institution" : "Egenkontrol"}`
    }
  };
});

exports.getCloudinaryAssets = onCall({ region: "us-central1", secrets: ["FUNCTIONS_CONFIG_EXPORT"] }, async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Log ind for at hente billeder.");
  }

  let config = {};
  try { config = JSON.parse(process.env.FUNCTIONS_CONFIG_EXPORT || "{}"); } catch (_) {}
  const cloudName = config?.cloudinary?.cloud_name || process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = config?.cloudinary?.api_key || process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = config?.cloudinary?.api_secret || process.env.CLOUDINARY_API_SECRET || "";

  if (!cloudName || !apiKey || !apiSecret) {
    throw new HttpsError(
      "failed-precondition",
      "Cloudinary er ikke konfigureret. Kontakt administrator."
    );
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const userId = request.auth.uid;
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
    throw new HttpsError(
      "internal",
      `Kunne ikke hente billeder fra Cloudinary: ${error.message}`
    );
  }
});

function scoreStockPhoto(photo) {
  let score = 0;
  const w = photo.width || 0;
  const h = photo.height || 0;
  if (w > 0 && h > 0) {
    const ratio = w / h;
    if (ratio >= 1.6 && ratio <= 1.85) score += 30;
    else if (ratio >= 1.3) score += 15;
    else if (ratio < 1) score -= 30;
  }
  if (w >= 1920) score += 20;
  else if (w >= 1280) score += 10;
  if (photo.src && photo.src.large2x) score += 10;
  return score;
}

exports.searchRestaurantImages = onCall(
  { secrets: ["FUNCTIONS_CONFIG_EXPORT"], region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Log ind for at sÃ¸ge billeder.");
    }

    const data = request.data;
    const query = sanitizeString(data?.query || "", 200);
    const perPage = Math.min(Math.max(1, Number(data?.perPage) || 15), 24);

    if (!query) {
      throw new HttpsError("invalid-argument", "SÃ¸geord mangler.");
    }

    let config = {};
    try { config = JSON.parse(process.env.FUNCTIONS_CONFIG_EXPORT || "{}"); } catch (_) {}
    const pexelsKey = config?.pexels?.api_key || process.env.PEXELS_API_KEY || "";
    const cloudName = config?.cloudinary?.cloud_name || process.env.CLOUDINARY_CLOUD_NAME || "";

    if (!pexelsKey) {
      throw new HttpsError(
        "failed-precondition",
        "Pexels API nÃ¸gle ikke konfigureret. KÃ¸r: firebase functions:config:set pexels.api_key=\"DIN_NÃ˜GLE\" og redeploy."
      );
    }

    const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;
    const pexelsResp = await fetch(pexelsUrl, { headers: { Authorization: pexelsKey } });

    if (!pexelsResp.ok) {
      const errText = await pexelsResp.text().catch(() => "");
      throw new HttpsError("internal", `Pexels API fejlede: ${pexelsResp.status}. ${errText.slice(0, 200)}`);
    }

    const pexelsData = await pexelsResp.json();

    const photos = (pexelsData.photos || [])
      .map(p => ({
        id: String(p.id),
        url: p.src?.large2x || p.src?.large || p.src?.original || "",
        thumbUrl: p.src?.medium || p.src?.small || "",
        width: p.width || 0,
        height: p.height || 0,
        photographer: sanitizeString(p.photographer || "", 120),
        photographerUrl: sanitizeString(p.photographer_url || "", 300),
        source: "pexels",
        sourceUrl: sanitizeString(p.url || "", 300),
        alt: sanitizeString(p.alt || query, 200),
        _raw: p
      }))
      .filter(p => p.url)
      .sort((a, b) => scoreStockPhoto(b._raw) - scoreStockPhoto(a._raw))
      .map(({ _raw, ...rest }) => rest);

    return { photos, cloudName };
  }
);

exports.saveRestaurantHeroImage = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Log ind for at gemme billede.");
    }

    const data = request.data;
    const companyId = sanitizeString(data?.companyId || "", 120);
    const locationId = sanitizeString(data?.locationId || "", 120);
    const url = sanitizeString(data?.url || "", 1000);

    if (!companyId || !locationId || !url) {
      throw new HttpsError("invalid-argument", "companyId, locationId og url er pÃ¥krÃ¦vet.");
    }

    const docId = `${companyId}__${locationId}__hero_${Date.now()}`;
    await db.collection("seo_hero_images").doc(docId).set({
      companyId,
      locationId,
      url,
      thumbUrl: sanitizeString(data?.thumbUrl || "", 1000),
      enhancedUrl: sanitizeString(data?.enhancedUrl || "", 2000),
      category: sanitizeString(data?.category || "", 80),
      style: sanitizeString(data?.style || "", 80),
      source: sanitizeString(data?.source || "pexels", 40),
      sourceUrl: sanitizeString(data?.sourceUrl || "", 400),
      photographer: sanitizeString(data?.photographer || "", 120),
      photographerUrl: sanitizeString(data?.photographerUrl || "", 400),
      alt: sanitizeString(data?.alt || "", 200),
      createdBy: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      isActive: true
    });

    return { ok: true, docId };
  }
);

exports.enhanceAndUploadRestaurantImage = onCall(
  { secrets: ["FUNCTIONS_CONFIG_EXPORT"], region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Log ind for at behandle billeder.");
    }

    const data = request.data;
    const imageUrl = sanitizeString(data?.url || "", 2000);
    const style = sanitizeString(data?.style || "warm", 40);
    const companyId = sanitizeString(data?.companyId || "", 120);
    const locationId = sanitizeString(data?.locationId || "", 120);
    const category = sanitizeString(data?.category || "", 80);
    const thumbUrl = sanitizeString(data?.thumbUrl || "", 1000);
    const source = sanitizeString(data?.source || "pexels", 40);
    const sourceUrl = sanitizeString(data?.sourceUrl || "", 400);
    const photographer = sanitizeString(data?.photographer || "", 120);
    const photographerUrl = sanitizeString(data?.photographerUrl || "", 400);
    const alt = sanitizeString(data?.alt || "", 200);

    if (!imageUrl || !companyId || !locationId) {
      throw new HttpsError("invalid-argument", "url, companyId og locationId er pÃ¥krÃ¦vet.");
    }

    const SEO_HERO_TRANSFORMS = {
      warm:   "e_improve,e_vibrance:35,e_sharpen,ar_16:9,c_fill,w_1600,q_auto,f_auto",
      nordic: "e_improve,e_brightness:8,e_sharpen,ar_16:9,c_fill,w_1600,q_auto,f_auto",
      dark:   "e_improve,e_brightness:-25,e_contrast:25,ar_16:9,c_fill,w_1600,q_auto,f_auto",
      street: "e_improve,e_vibrance:55,e_sharpen:80,ar_16:9,c_fill,w_1600,q_auto,f_auto",
      clean:  "e_improve,e_sharpen,ar_16:9,c_fill,w_1600,q_auto,f_auto"
    };

    let config = {};
    try { config = JSON.parse(process.env.FUNCTIONS_CONFIG_EXPORT || "{}"); } catch (_) {}
    const cloudName = config?.cloudinary?.cloud_name || process.env.CLOUDINARY_CLOUD_NAME || "";
    const apiKey = config?.cloudinary?.api_key || process.env.CLOUDINARY_API_KEY || "";
    const apiSecret = config?.cloudinary?.api_secret || process.env.CLOUDINARY_API_SECRET || "";

    if (!cloudName || !apiKey || !apiSecret) {
      throw new HttpsError("failed-precondition", "Cloudinary er ikke konfigureret.");
    }

    const crypto = require("crypto");
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `madkontrol/${toAsciiSlug(companyId, 60)}/${toAsciiSlug(locationId, 60)}/seo_hero`;

    // Signature: sorted params excluding api_key, resource_type, file
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto.createHash("sha1").update(paramsToSign + apiSecret).digest("hex");

    let publicId = "";
    let originalCloudinaryUrl = imageUrl;
    let enhanced = false;

    try {
      const uploadParams = new URLSearchParams();
      uploadParams.append("file", imageUrl);
      uploadParams.append("folder", folder);
      uploadParams.append("timestamp", String(timestamp));
      uploadParams.append("api_key", apiKey);
      uploadParams.append("signature", signature);

      const uploadResp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: uploadParams.toString()
      });

      if (!uploadResp.ok) {
        const errText = await uploadResp.text().catch(() => "");
        throw new Error(`Cloudinary upload: ${uploadResp.status} â€” ${errText.slice(0, 200)}`);
      }

      const uploadResult = await uploadResp.json();
      publicId = uploadResult.public_id || "";
      originalCloudinaryUrl = uploadResult.secure_url || imageUrl;
      enhanced = true;
    } catch (uploadErr) {
      console.error("[enhanceAndUploadRestaurantImage] Upload fejlede, bruger original:", uploadErr.message);
    }

    const transforms = SEO_HERO_TRANSFORMS[style] || SEO_HERO_TRANSFORMS.warm;
    const enhancedUrl = (enhanced && publicId)
      ? `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${publicId}`
      : imageUrl;

    const docId = `${companyId}__${locationId}__hero_${Date.now()}`;
    await db.collection("seo_hero_images").doc(docId).set({
      companyId, locationId,
      url: originalCloudinaryUrl,
      thumbUrl, enhancedUrl: enhanced ? enhancedUrl : "",
      category, style, source, sourceUrl, photographer, photographerUrl, alt,
      publicId, cloudName, enhanced,
      createdBy: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      isActive: true
    });

    // Push hero image to any already-published websites for this location
    try {
      const sitesSnap = await db.collection("websites")
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .where("status", "==", "published")
        .limit(5)
        .get();
      if (!sitesSnap.empty) {
        const siteBatch = db.batch();
        sitesSnap.docs.forEach(d => {
          siteBatch.set(d.ref, {
            heroImageUrl: enhanced ? enhancedUrl : imageUrl,
            heroThumbUrl: thumbUrl,
            heroImageStyle: style,
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
        });
        await siteBatch.commit();
      }
    } catch (siteErr) {
      console.warn("[enhanceAndUpload] Kunne ikke opdatere websites:", siteErr.message);
    }

    return { ok: true, docId, url: originalCloudinaryUrl, enhancedUrl, enhanced };
  }
);

exports.generateSeoAiSuggestions = onCall(
  { secrets: [OPENAI_API_KEY], region: "us-central1" },
  async (request) => {
    const data = request.data;

    const businessName = sanitizeString(data?.businessName || "", 200);
    const address = sanitizeString(data?.address || "", 300);
    const city = sanitizeString(data?.city || "", 100);
    const cuisineType = sanitizeString(data?.cuisineType || "", 100);
    const offerings = sanitizeString(data?.offerings || "", 300);
    const description = sanitizeString(data?.description || "", 1000);
    const keyword = sanitizeString(data?.keyword || "", 200);
    let websiteUrl = sanitizeString(data?.websiteUrl || "", 500);

    if (!businessName && !cuisineType) {
      throw new HttpsError("invalid-argument", "Mindst restaurantnavn eller kÃ¸kkentype skal angives.");
    }

    if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) {
      websiteUrl = "";
    }

    let websiteContent = "";
    let websiteFetchOk = false;
    let usedWebsite = false;

    if (websiteUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(websiteUrl, {
          method: "GET",
          headers: { "User-Agent": "MadkontrolBot/1.0" },
          signal: controller.signal,
          redirect: "follow"
        });

        clearTimeout(timeout);

        if (response.ok) {
          const html = await response.text();
          websiteContent = extractSeoRelevantText(html);
          websiteFetchOk = true;
          usedWebsite = !!websiteContent;
        }
      } catch (err) {
        console.warn("Website fetch fejlede:", websiteUrl, err.message);
      }
    }

    const openAiApiKey =
      OPENAI_API_KEY.value() || process.env.OPENAI_API_KEY || "";

    if (!openAiApiKey) {
      throw new HttpsError(
        "failed-precondition",
        "OpenAI API-nÃ¸gle mangler. SÃ¦t OPENAI_API_KEY som function secret."
      );
    }

    const prompt = buildSeoAiPrompt({
      businessName,
      address,
      city,
      cuisineType,
      offerings,
      description,
      keyword,
      websiteContent
    });

    let responseData;

    try {
      const resp = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiApiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "Du er en dansk SEO-ekspert specialiseret i lokal restaurant-SEO. Du returnerer ALTID valid JSON uden ekstra tekst. Hvis du er i tvivl, returnÃ©r {}."
              },
              { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 800,
            response_format: { type: "json_object" }
          })
        }
      );

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error(`OpenAI API fejl: ${resp.status} ${errText}`);
      }

      responseData = await resp.json();
    } catch (err) {
      console.error("OpenAI API kald fejlede:", err);
      throw new HttpsError(
        "internal",
        `AI-generering fejlede: ${err.message}`
      );
    }

    // ðŸ”¥ STABIL PARSING (det her var dit problem)
    const aiContent =
      responseData?.choices?.[0]?.message?.content || "";

    let suggestions = null;

    try {
      if (typeof aiContent === "string" && aiContent.trim()) {
        suggestions = JSON.parse(aiContent);
      }
    } catch (err) {
      console.warn("Kunne ikke parse AI JSON:", aiContent);
    }

    // ðŸ”¥ FALLBACK (sikrer aldrig "no result")
    if (!suggestions || typeof suggestions !== "object") {
      suggestions = {
        primaryKeyword:
          keyword || `${cuisineType} ${city}`.trim(),
        shortDescription:
          description ||
          `${businessName || cuisineType} i ${city}`.trim()
      };
    }

    return {
      ...suggestions,
      meta: {
        usedWebsite,
        websiteFetchOk
      }
    };
  }
);

function extractSeoRelevantText(html) {
  if (!html || typeof html !== "string") return "";

  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";

  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : "";

  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, "").trim() : "";

  text = text.slice(0, 2000);

  return [
    title ? `Title: ${title}` : "",
    metaDesc ? `Meta: ${metaDesc}` : "",
    h1 ? `H1: ${h1}` : "",
    text ? `Content: ${text}` : ""
  ].filter(Boolean).join(" | ").slice(0, 3000);
}

function buildSeoAiPrompt({ businessName, address, city, cuisineType, offerings, description, keyword, websiteContent }) {
  const parts = [
    "Generer SEO-forslag til en dansk restaurant.",
    businessName ? `Navn: ${businessName}` : "",
    city ? `By: ${city}` : "",
    address ? `Adresse: ${address}` : "",
    cuisineType ? `Type: ${cuisineType}` : "",
    offerings ? `Udbud: ${offerings}` : "",
    description ? `Beskrivelse: ${description}` : "",
    keyword ? `NuvÃ¦rende sÃ¸geord: ${keyword}` : "",
    websiteContent ? `Website-indhold: ${websiteContent}` : ""
  ].filter(Boolean).join("\n");

  return `${parts}

Returner JSON med fÃ¸lgende struktur:
{
  "primaryKeyword": "primÃ¦rt lokalt sÃ¸geord (fx 'thai restaurant hvidovre')",
  "secondaryKeywords": ["sekundÃ¦rt sÃ¸geord 1", "sekundÃ¦rt sÃ¸geord 2", "sekundÃ¦rt sÃ¸geord 3"],
  "shortDescription": "kort beskrivelse 1-2 sÃ¦tninger pÃ¥ dansk",
  "seoTitle": "SEO title tag inkl. restaurantnavn og by",
  "metaDescription": "meta description 150-160 tegn pÃ¥ dansk",
  "extractedWebsiteSummary": "kort opsummering af hvad du fandt pÃ¥ hjemmesiden (eller tom hvis ingen website)"
}

Fokuser pÃ¥ lokal SEO. Brug faktiske oplysninger. Skriv pÃ¥ dansk. Hvis website-indhold er tilgÃ¦ngeligt, brug det til at gÃ¸re forslagene mere prÃ¦cise.`;
}

exports.startCoolingProcess = startCoolingProcess;
exports.createEgenkontrolProgramForLocation =
  egenkontrol.createEgenkontrolProgramForLocation({
    db,
    sanitizeString,
    getUserAccessProfile,
    assertSeoGeneratorAccess,
    sanitizeOnboardingProfile,
    sanitizeRiskModelInput
  });
  
exports.addCoolingMeasurement = addCoolingMeasurement;
exports.completeCoolingProcess = completeCoolingProcess;
exports.startReheatingProcess = startReheatingProcess;
exports.completeReheatingProcess = completeReheatingProcess;
exports.disposeCoolingProcess = disposeCoolingProcess;
exports.startNewCoolingFromReheating = startNewCoolingFromReheating;
exports.loadActiveProcessInstances = loadActiveProcessInstances;
exports.pauseEgenkontrolRoutine = pauseEgenkontrolRoutine;
exports.reactivateEgenkontrolRoutine = reactivateEgenkontrolRoutine;
exports.setRoutinePauseState = setRoutinePauseState;
exports.updateEgenkontrolRoutineFrequency = updateEgenkontrolRoutineFrequency;

// Demo Mode - DEVELOPER ONLY (not for production customers)
exports.enableDemoMode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal vÃ¦re logget ind");
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
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal vÃ¦re logget ind");
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
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal vÃ¦re logget ind");
  }

  const { companyId, locationId, periodName } = data;

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende pÃ¥krÃ¦vede felter");
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
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal vÃ¦re logget ind");
  }

  // CRITICAL: This is a dangerous operation - guard it
  guardDangerousOperation(context, "archiveCompany");

  const { companyId, reason } = data;

  if (!companyId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende pÃ¥krÃ¦vede felter");
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
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal vÃ¦re logget ind");
  }

  // CRITICAL: This is a dangerous operation - guard it
  guardDangerousOperation(context, "restoreCompany");

  const { companyId } = data;

  if (!companyId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende pÃ¥krÃ¦vede felter");
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
exports.closeDailyRun = closeDailyRun;

exports.cleanupTaskTemplates = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vÃ¦re logget ind.");
  }

  guardDangerousOperation(context, "cleanupTaskTemplates");

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
  }

  await assertAdminAccess({
    uid: context.auth.uid,
    email: context.auth.token?.email || "",
    companyId,
    locationId
  });

  try {
    const templatesRef = db.collection("task_templates");
    const snapshot = await templatesRef
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .get();

    if (snapshot.empty) {
      return { archived: 0, deleted: 0, message: "Ingen templates fundet." };
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.set(doc.ref, {
        active: false,
        isActive: false,
        archived: true,
        status: "inactive",
        archivedAt: FieldValue.serverTimestamp(),
        archivedByUid: context.auth.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: context.auth.uid
      }, { merge: true });
    });

    await batch.commit();

    return {
      archived: snapshot.size,
      deleted: 0,
      message: `Arkiverede ${snapshot.size} task templates.`
    };
  } catch (error) {
    console.error("cleanupTaskTemplates fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.lookupCvr = functions.https.onCall(async (data, context) => {
  const cvr = String(data?.cvr || "").replace(/\D/g, "");

  if (!/^\d{8}$/.test(cvr)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "CVR skal vÃ¦re 8 cifre."
    );
  }

  try {
    const response = await fetch(`https://cvrapi.dk/api?search=${cvr}&country=dk`);
    const result = await response.json();

    if (!response.ok || !result || result.error) {
      throw new Error(result?.error || "CVR-opslag fejlede.");
    }

    return {
      name: result.name || "",
      address: result.address || "",
      zip: result.zipcode || "",
      city: result.city || "",
      leader: ""
    };
  } catch (error) {
    console.error("lookupCvr fejl:", error);
    throw new functions.https.HttpsError(
      "internal",
      error?.message || "Kunne ikke hente CVR-data."
    );
  }
});

// Manual risk analysis generator for existing onboardings
exports.manualGenerateRiskAnalysis = functions.https.onCall(async (data, context) => {
  console.log("ðŸ”¥ manualGenerateRiskAnalysis START");

  try {
    const payload =
      data?.companyId || data?.locationId
        ? data
        : data?.data?.companyId || data?.data?.locationId
          ? data.data
          : {};

    const companyId = sanitizeString(payload?.companyId || "", 120);
    const locationId = sanitizeString(payload?.locationId || "", 120);

    console.log("companyId:", companyId, "locationId:", locationId);

    if (!companyId || !locationId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "companyId og locationId er pÃ¥krÃ¦vet."
      );
    }

    // Load profile from haccp_snapshots (query by field, not doc ID)
    const snapshotQuery = await db.collection("haccp_snapshots")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .limit(1)
      .get();

    if (snapshotQuery.empty) {
      throw new functions.https.HttpsError(
        "not-found",
        `Ingen HACCP snapshot fundet for ${companyId} / ${locationId}`
      );
    }

    const snapshot = snapshotQuery.docs[0].data();
    const profile = snapshot?.profile || snapshot || {};

    console.log("ðŸ“¦ Loading buildStructuredHaccpData...");
    const { buildStructuredHaccpData } = require("./provisioning");

    if (!buildStructuredHaccpData) {
      throw new Error("buildStructuredHaccpData not found in provisioning module");
    }

    const controlPoints = buildStructuredHaccpData(profile);
    console.log(`ðŸ“Š Generated ${controlPoints.length} control points`);

    await db
      .collection("companies")
      .doc(companyId)
      .collection("locations")
      .doc(locationId)
      .collection("risk_analysis")
      .doc("current")
      .set({
        status: "generated",
        onboardingSnapshot: profile,
        controlPoints: controlPoints,
        totalControlPoints: controlPoints.length,
        generatedBy: "manualGenerateRiskAnalysis",
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

    console.log(`âœ… Risk analysis saved: ${controlPoints.length} control points`);

    return {
      ok: true,
      companyId,
      locationId,
      totalControlPoints: controlPoints.length
    };
  } catch (error) {
    console.error("âŒ manualGenerateRiskAnalysis FAILED:", error?.message);
    console.error("âŒ stack:", error?.stack || null);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      "internal",
      error?.message || "manualGenerateRiskAnalysis crashed"
    );
  }
});

// â”€â”€â”€ REGENERATE TASK TEMPLATES FOR LOCATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.regenerateTaskTemplatesForLocation = functions.https.onCall(async (request, context) => {
  try {
    const data = request.data || request;
    const authUid = context.auth?.uid;
    
    if (!authUid) {
      throw new functions.https.HttpsError("unauthenticated", "Du skal vÃ¦re logget ind.");
    }

    const companyId = sanitizeString(data?.companyId || "", 120);
    const locationId = sanitizeString(data?.locationId || "", 120);

    if (!companyId || !locationId) {
      throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
    }

    console.log(`[regenerateTaskTemplatesForLocation] START for ${companyId}/${locationId}`);

    // Verify user has access to this location
    const userDoc = await db.collection("users").doc(authUid).get();
    const userData = userDoc.data() || {};
    const userCompanyId = userData.companyId || userData.organizationId;
    
    if (userCompanyId !== companyId) {
      throw new functions.https.HttpsError("permission-denied", "Du har ikke adgang til denne virksomhed.");
    }

    // Fetch onboarding data for this location
    const canonicalDocId = `${companyId}__${locationId}__onboarding`;
    const oaDoc = await db.collection("onboarding_answers").doc(canonicalDocId).get();
    
    if (!oaDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Onboarding data ikke fundet for denne location.");
    }

    const oaData = oaDoc.data() || {};
    const profile = oaData.profile || {};
    const equipmentCounts = oaData.equipmentCounts || {};

    console.log(`[regenerateTaskTemplatesForLocation] Found onboarding data`);

    // Regenerate all template types
    const results = {
      equipment: { created: 0, skipped: 0 },
      cleaning: { created: 0, skipped: 0 },
      maintenance: { created: 0, skipped: 0 },
      area: { created: 0, skipped: 0 },
      drift: { created: 0, skipped: 0 },
      water: { created: 0, skipped: 0 }
    };

    // 1. Equipment units
    try {
      const eqResult = await syncOnboardingEquipmentUnits({ db, companyId, locationId, equipmentCounts, profile });
      results.equipment = { created: eqResult.created || 0, updated: eqResult.updated || 0 };
      console.log(`[regenerateTaskTemplatesForLocation] Equipment: created=${eqResult.created}, updated=${eqResult.updated}`);
    } catch (err) {
      console.error(`[regenerateTaskTemplatesForLocation] Equipment sync failed:`, err.message);
    }

    // 2. Equipment cleaning templates
    try {
      const cleanResult = await syncEquipmentCleaningTemplates({ db, companyId, locationId });
      results.cleaning = { created: cleanResult.created || 0 };
      console.log(`[regenerateTaskTemplatesForLocation] Cleaning: created=${cleanResult.created}`);
    } catch (err) {
      console.error(`[regenerateTaskTemplatesForLocation] Cleaning sync failed:`, err.message);
    }

    // 3. Equipment maintenance templates
    try {
      const maintResult = await syncEquipmentMaintenanceTemplates({ db, companyId, locationId });
      results.maintenance = { created: maintResult.created || 0 };
      console.log(`[regenerateTaskTemplatesForLocation] Maintenance: created=${maintResult.created}`);
    } catch (err) {
      console.error(`[regenerateTaskTemplatesForLocation] Maintenance sync failed:`, err.message);
    }

    // 4. Area cleaning templates
    try {
      const areaResult = await syncAreaCleaningTemplates({ db, companyId, locationId });
      results.area = { created: areaResult.created || 0, skipped: areaResult.skipped || 0 };
      console.log(`[regenerateTaskTemplatesForLocation] Area: created=${areaResult.created}, skipped=${areaResult.skipped}`);
    } catch (err) {
      console.error(`[regenerateTaskTemplatesForLocation] Area sync failed:`, err.message);
    }

    // 5. Process drift templates
    try {
      const driftResult = await syncProcessDriftTemplates({ db, companyId, locationId });
      results.drift = { created: driftResult.created || 0, skipped: driftResult.skipped || 0 };
      console.log(`[regenerateTaskTemplatesForLocation] Drift: created=${driftResult.created}, skipped=${driftResult.skipped}`);
    } catch (err) {
      console.error(`[regenerateTaskTemplatesForLocation] Drift sync failed:`, err.message);
    }

    // 6. Water control templates
    try {
      const waterResult = await syncWaterControlTemplates({ db, companyId, locationId });
      results.water = { created: waterResult.created || 0, skipped: waterResult.skipped || 0 };
      console.log(`[regenerateTaskTemplatesForLocation] Water: created=${waterResult.created}, skipped=${waterResult.skipped}`);
    } catch (err) {
      console.error(`[regenerateTaskTemplatesForLocation] Water sync failed:`, err.message);
    }

    console.log(`[regenerateTaskTemplatesForLocation] DONE`, results);

    return {
      ok: true,
      companyId,
      locationId,
      results
    };

  } catch (error) {
    console.error("[regenerateTaskTemplatesForLocation] ERROR:", error.message);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError("internal", error.message || "Regenerering fejlede");
  }
});

// â”€â”€â”€ WATER MODULE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Object.assign(exports, require("./water-module"));

// â”€â”€â”€ AUDIT TOOLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const { auditCompanyLocationIntegrity } = require("./auditCompanyLocation");
exports.auditCompanyLocationIntegrity = auditCompanyLocationIntegrity;

// â”€â”€â”€ ONBOARDING FIX â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const { fixOnboardingStructure } = require("./fixOnboardingStructure");
exports.fixOnboardingStructure = fixOnboardingStructure;

// â”€â”€â”€ CANONICAL TASK ENGINE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const {
  generateCanonicalTaskTemplates,
  ensureSingleTaskInstance,
  startDayForLocationCanonical
} = require("./canonicalTaskEngine");

exports.generateCanonicalTaskTemplates = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vÃ¦re logget ind.");
  }
  
  const companyId = sanitizeString(data?.companyId, 120);
  const locationId = sanitizeString(data?.locationId, 120);
  
  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
  }
  
  let ownerScopeMetadata = {};
  const locationSnap = await db.collection("companies").doc(companyId).collection("locations").doc(locationId).get();
  const companySnap = await db.collection("companies").doc(companyId).get();
  const inheritedOwnerKind = locationSnap.data()?.ownerKind || companySnap.data()?.ownerKind || "";
  if (inheritedOwnerKind) {
    ownerScopeMetadata = buildOwnerScopeMetadata(inheritedOwnerKind);
  }
  const result = await generateCanonicalTaskTemplates({ db, companyId, locationId, ownerScopeMetadata });
  
  return {
    ok: true,
    ...result
  };
});

// â”€â”€â”€ CREATE DEMO ENVIRONMENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.createDemoEnvironment = functions.https.onCall(async (request) => {
  const data = request.data || {};
  const origin = String(data.origin || "https://madkontrollen.dk").replace(/\/+$/, "");
  
  try {
    const demoEmail = `demo_${Date.now()}@madkontrollen.dk`;
    const demoPassword = Math.random().toString(36).slice(2, 12);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    
    // Create user
    const userRecord = await admin.auth().createUser({
      email: demoEmail,
      password: demoPassword,
      displayName: "Demo Bruger"
    });
    
    const userId = userRecord.uid;
    
    // Create company and location
    const companyRef = db.collection("companies").doc();
    const locationRef = db.collection("locations").doc();
    
    const companyId = companyRef.id;
    const locationId = locationRef.id;
    
    const nowTs = FieldValue.serverTimestamp();
    const ownerScopeMetadata = buildOwnerScopeMetadata(OWNER_KIND.DEMO_OWNER);
    
    await companyRef.set({
      id: companyId,
      companyId,
      organizationId: companyId,
      ...ownerScopeMetadata,
      name: "Demo Restaurant",
      displayName: "Demo Restaurant",
      status: "active",
      isDemo: true,
      demoMode: true,
      demoExpiresAt: expiresAt,
      demoCreatedBy: userId,
      createdBy: userId,
      createdAt: nowTs,
      updatedAt: nowTs
    });
    
    const locationData = {
      id: locationId,
      locationId,
      companyId,
      organizationId: companyId,
      ...ownerScopeMetadata,
      name: "Demo Lokation",
      displayName: "Demo Lokation",
      status: "active",
      isDemo: true,
      demoMode: true,
      demoExpiresAt: expiresAt,
      demoCreatedBy: userId,
      createdBy: userId,
      createdAt: nowTs,
      updatedAt: nowTs
    };
    await locationRef.set(locationData);
    await db.collection("companies").doc(companyId).collection("locations").doc(locationId).set(locationData);
    
    // Create user documents
    await db.collection("users").doc(userId).set({
      uid: userId,
      email: demoEmail,
      displayName: "Demo Bruger",
      companyId,
      organizationId: companyId,
      locationId,
      locationIds: [locationId],
      primaryLocationId: locationId,
      ...ownerScopeMetadata,
      role: "owner",
      roles: ["owner", "admin", "demo"],
      status: "active",
      isDemo: true,
      demoMode: true,
      demoExpiresAt: expiresAt,
      onboardingStatus: "completed",
      subscriptionStatus: "demo",
      createdAt: nowTs,
      updatedAt: nowTs
    });
    
    await db.collection("companies").doc(companyId).collection("members").doc(userId).set({
      uid: userId,
      userId,
      email: demoEmail,
      role: "owner",
      roles: ["owner", "admin", "demo"],
      companyId,
      organizationId: companyId,
      locationId,
      locationIds: [locationId],
      ...ownerScopeMetadata,
      status: "active",
      isDemo: true,
      demoMode: true,
      demoExpiresAt: expiresAt,
      createdAt: nowTs,
      updatedAt: nowTs
    });
    
    // Create demo equipment units
    const equipmentUnits = [
      { id: "demo_fridge_1", name: "KÃ¸leskab 1", type: "fridge" },
      { id: "demo_freezer_1", name: "Fryser 1", type: "freezer" },
      { id: "demo_dishwasher_1", name: "Opvaskemaskine 1", type: "dishwasher" },
      { id: "demo_fryer_1", name: "Friture 1", type: "fryer" },
      { id: "demo_slicer_1", name: "PÃ¥lÃ¦gsmaskine 1", type: "slicer" },
      { id: "demo_softice_1", name: "Softicemaskine 1", type: "softice_machine" },
      { id: "demo_walkin_cooler_1", name: "Walk-in kÃ¸ler", type: "walkin_cooler" },
      { id: "demo_walkin_freezer_1", name: "Walk-in fryser", type: "walkin_freezer" }
    ];
    
    for (const unit of equipmentUnits) {
      await db.collection("equipment").doc(unit.id).set({
        id: unit.id,
        equipmentId: unit.id,
        companyId,
        organizationId: companyId,
        locationId,
        ...ownerScopeMetadata,
        name: unit.name,
        displayName: unit.name,
        type: unit.type,
        equipmentType: unit.type,
        category: unit.type,
        isActive: true,
        active: true,
        isDemo: true,
        createdBy: userId,
        createdAt: nowTs,
        updatedAt: nowTs
      });
    }
    
    console.log("[createDemoEnvironment] Created 8 equipment units");
    
    // Generate canonical templates
    const templatesResult = await generateCanonicalTaskTemplates({
      db,
      companyId,
      locationId,
      ownerScopeMetadata
    });
    
    console.log("[createDemoEnvironment] Templates generated:", templatesResult);
    
    // Verify templates were created
    const verifySnap = await db.collection("task_templates")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .get();
    
    console.log("[createDemoEnvironment] Templates verification:", verifySnap.size);
    
    if (verifySnap.empty) {
      throw new Error("CRITICAL: No templates were created for demo!");
    }
    
    // Generate instances for today using canonical engine
    const todayDateKey = new Date().toISOString().slice(0, 10);
    const instancesResult = await startDayForLocationCanonical({
      db,
      companyId,
      locationId,
      dateKey: todayDateKey,
      createdBy: userId,
      ownerScopeMetadata
    });
    
    console.log("[createDemoEnvironment] Instances generated:", instancesResult);
    
    console.log("[createDemoEnvironment] Demo created successfully", {
      userId,
      companyId,
      locationId,
      equipment: equipmentUnits.length,
      templates: templatesResult.created + templatesResult.updated,
      verified: verifySnap.size,
      instances: instancesResult.instancesCreated
    });
    
    return {
      ok: true,
      email: demoEmail,
      password: demoPassword,
      userId,
      uid: userId,
      companyId,
      locationId,
      demoCompanyId: companyId,
      demoLocationId: locationId,
      demoExpiresAt: expiresAt.toISOString(),
      equipment: equipmentUnits.length,
      templates: verifySnap.size,
      instances: instancesResult.instancesCreated,
      dashboardUrl: `${origin}/modules/egenkontrol/rutiner.html`
    };
    
  } catch (error) {
    console.error("[createDemoEnvironment] ERROR:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// â”€â”€â”€ ADD MISSING PROCESSES TO ONBOARDING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.addMissingProcessesToOnboarding = functions.https.onCall(async (request, context) => {
  const { companyId, locationId, processesToAdd } = request.data || {};
  
  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId and locationId required");
  }
  
  if (!Array.isArray(processesToAdd) || processesToAdd.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "processesToAdd must be a non-empty array");
  }
  
  try {
    const canonicalDocId = `${companyId}__${locationId}__onboarding`;
    const oaRef = db.collection("onboarding_answers").doc(canonicalDocId);
    const oaSnap = await oaRef.get();
    
    let currentProcesses = [];
    if (oaSnap.exists) {
      currentProcesses = oaSnap.data().processes || [];
    }
    
    // Add missing processes
    const updatedProcesses = [...new Set([...currentProcesses, ...processesToAdd])];
    
    await oaRef.set({
      companyId,
      organizationId: companyId,
      locationId,
      processes: updatedProcesses,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log(`[addMissingProcessesToOnboarding] Updated processes for ${companyId}/${locationId}:`, {
      before: currentProcesses,
      after: updatedProcesses,
      added: processesToAdd
    });
    
    // Regenerate process drift templates
    const driftResult = await syncProcessDriftTemplates({ db, companyId, locationId });
    
    console.log(`[addMissingProcessesToOnboarding] Regenerated templates:`, driftResult);
    
    return {
      ok: true,
      processesAdded: processesToAdd,
      currentProcesses: updatedProcesses,
      templatesCreated: driftResult.created,
      templatesSkipped: driftResult.skipped
    };
  } catch (error) {
    console.error("[addMissingProcessesToOnboarding] ERROR:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// â”€â”€â”€ CVR ENRICHMENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

exports.enrichNextCvrBatch = functions.https.onCall(async (request, context) => {
  const data = request.data || request;
  const auth = context.auth;

  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at berige CVR data");
  }

  const jobId = sanitizeString(data?.jobId || "", 120);
  const batchSize = Math.min(Math.max(parseInt(data?.batchSize) || 50, 1), 100);

  if (!jobId) {
    throw new functions.https.HttpsError("invalid-argument", "jobId er pÃ¥krÃ¦vet");
  }

  console.log("[enrichNextCvrBatch] Starting batch:", { jobId, batchSize, uid: auth.uid });

  try {
    // Verify user has access
    const userDoc = await db.collection("users").doc(auth.uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("permission-denied", "Bruger ikke fundet");
    }

    const userRole = userDoc.data().role;
    if (!["owner", "admin", "hq_admin", "super-admin"].includes(userRole)) {
      throw new functions.https.HttpsError("permission-denied", "Kun admin brugere kan berige CVR data");
    }

    // Get job
    const jobRef = db.collection("cvr_enrichment_jobs").doc(jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Job ikke fundet");
    }

    const job = jobDoc.data();

    // Get next batch of pending items
    const itemsSnapshot = await db
      .collection("cvr_enrichment_jobs")
      .doc(jobId)
      .collection("items")
      .where("status", "==", "pending")
      .limit(batchSize)
      .get();

    if (itemsSnapshot.empty) {
      console.log("[enrichNextCvrBatch] No more pending items");
      
      await jobRef.update({
        status: "completed",
        updatedAt: FieldValue.serverTimestamp()
      });

      return {
        ok: true,
        completed: true,
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        message: "Ingen flere CVR at behandle"
      };
    }

    let successCount = 0;
    let failedCount = 0;

    // Process each CVR
    for (const itemDoc of itemsSnapshot.docs) {
      const item = itemDoc.data();
      const cvr = item.cvr;

      console.log("[enrichNextCvrBatch] Processing CVR:", cvr);

      // Mark as processing
      await itemDoc.ref.update({
        status: "processing",
        attempts: (item.attempts || 0) + 1,
        updatedAt: FieldValue.serverTimestamp()
      });

      try {
        // Call CVR API
        const cvrData = await fetchCvrData(cvr);

        if (!cvrData) {
          throw new Error("Ingen data fra CVR API");
        }

        // Normalize data
        const normalizedData = {
          cvr: cvr,
          companyName: cvrData.name || "",
          name: cvrData.name || "",
          address: cvrData.address || "",
          zip: cvrData.zipcode || "",
          city: cvrData.city || "",
          phone: cvrData.phone || "",
          email: cvrData.email || "",
          website: cvrData.website || "",
          source: "cvr_api"
        };

        // Save to item
        await itemDoc.ref.update({
          status: "completed",
          data: normalizedData,
          enrichedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        // Save to prospects collection with merge
        const prospectRef = db.collection("prospects").doc(cvr);
        const prospectDoc = await prospectRef.get();
        const existingData = prospectDoc.exists ? prospectDoc.data() : {};

        // Build payload - don't overwrite existing manual data
        const prospectPayload = {
          cvr: cvr,
          updatedAt: FieldValue.serverTimestamp(),
          enrichedAt: FieldValue.serverTimestamp(),
          importSource: "cvr_enrichment_app"
        };

        // Only update if we have data and it's not already set
        if (normalizedData.companyName && !existingData.companyName) {
          prospectPayload.companyName = normalizedData.companyName;
          prospectPayload.name = normalizedData.companyName;
        }

        if (normalizedData.address && !existingData.address) {
          prospectPayload.address = normalizedData.address;
        }

        if (normalizedData.zip && !existingData.zip) {
          prospectPayload.zip = normalizedData.zip;
        }

        if (normalizedData.city && !existingData.city) {
          prospectPayload.city = normalizedData.city;
        }

        if (normalizedData.phone && !existingData.phone) {
          prospectPayload.phone = normalizedData.phone;
        }

        if (normalizedData.email && !existingData.email) {
          prospectPayload.email = normalizedData.email;
        }

        if (normalizedData.website && !existingData.website) {
          prospectPayload.website = normalizedData.website;
        }

        // Set default status if not exists
        if (!existingData.status) {
          prospectPayload.status = "prospect";
        }

        if (!existingData.source) {
          prospectPayload.source = "cvr_enrichment";
        }

        await prospectRef.set(prospectPayload, { merge: true });

        successCount++;
        console.log("[enrichNextCvrBatch] Success:", cvr);

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error("[enrichNextCvrBatch] Failed CVR:", cvr, error);

        await itemDoc.ref.update({
          status: "failed",
          lastError: error.message || "Ukendt fejl",
          updatedAt: FieldValue.serverTimestamp()
        });

        failedCount++;
      }
    }

    // Update job stats
    const updatedProcessedCount = (job.processedCount || 0) + successCount + failedCount;
    const updatedSuccessCount = (job.successCount || 0) + successCount;
    const updatedFailedCount = (job.failedCount || 0) + failedCount;

    await jobRef.update({
      processedCount: updatedProcessedCount,
      successCount: updatedSuccessCount,
      failedCount: updatedFailedCount,
      updatedAt: FieldValue.serverTimestamp()
    });

    // Check if job is complete
    const remainingSnapshot = await db
      .collection("cvr_enrichment_jobs")
      .doc(jobId)
      .collection("items")
      .where("status", "==", "pending")
      .limit(1)
      .get();

    const isComplete = remainingSnapshot.empty;

    if (isComplete) {
      await jobRef.update({
        status: "completed",
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    console.log("[enrichNextCvrBatch] Batch complete:", {
      successCount,
      failedCount,
      isComplete
    });

    return {
      ok: true,
      completed: isComplete,
      processedCount: successCount + failedCount,
      successCount,
      failedCount,
      message: `Behandlet ${successCount + failedCount} CVR (${successCount} success, ${failedCount} fejl)`
    };

  } catch (error) {
    console.error("[enrichNextCvrBatch] ERROR:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

async function fetchCvrData(cvr) {
  const https = require("https");

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "cvrapi.dk",
      path: `/api?search=${cvr}&country=dk`,
      method: "GET",
      headers: {
        "User-Agent": "MadkontrollenPro/1.0"
      }
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (error) {
            reject(new Error("Kunne ikke parse CVR API response"));
          }
        } else if (res.statusCode === 404) {
          reject(new Error("CVR ikke fundet"));
        } else if (res.statusCode === 429) {
          reject(new Error("Rate limit overskredet - vent venligst"));
        } else {
          reject(new Error(`CVR API fejl: ${res.statusCode}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(new Error(`NetvÃ¦rksfejl: ${error.message}`));
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("CVR API timeout"));
    });

    req.end();
  });
}



