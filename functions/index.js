// Load environment variables from .env file (for local development)
require("dotenv").config();

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const { defineJsonSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const egenkontrol = require("./egenkontrol");
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
const PEXELS_API_KEY = defineSecret("PEXELS_API_KEY");
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

// ─── STRIPE WEBHOOK ─────────────────────────────────────────────────────────

const { onRequest } = require("firebase-functions/v2/https");

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
        console.error("❌ Missing Stripe signature");
        return res.status(400).send("Missing signature");
      }

      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log("✅ Stripe event:", event.type);

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
      console.error("❌ Webhook handler error:", error);
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

function toAsciiSlug(value, maxLen = 120) {
  return String(value || "")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
}

function buildSeoFolderRoute(config = {}) {
  const citySlug = toAsciiSlug(config.citySlug || config.displayCityName || config.cityName || config.city || "by", 80) || "by";
  const businessSlug = toAsciiSlug(config.subdomain || config.businessSlug || config.businessName || "restaurant", 120) || "restaurant";
  const routePath = "/";
  return {
    citySlug,
    businessSlug,
    routePath,
    outputPath: `${businessSlug}/index.html`,
    canonicalUrl: `https://${businessSlug}.madkontrollen.dk/`
  };
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
  const city = sanitizeString(config?.displayCityName || config?.cityName || config?.city || "København", 80) || "København";
  const keyword = sanitizeString(config?.keyword || `bedste ${String(cuisineType).toLowerCase()} i ${city}`, 120);
  const route = buildSeoFolderRoute(config);
  const title = sanitizeString(`${businessName} | ${keyword}`, 220);
  const metaDescription = sanitizeString(
    `${businessName} i ${city}. ${keyword}. Book bord eller bestil online via madkontrollen.dk${route.routePath}.`,
    320
  );

  return [{
    sourceTitle: `${businessName} - ${keyword}`,
    slug: `${route.citySlug}/${route.businessSlug}`,
    citySlug: route.citySlug,
    businessSlug: route.businessSlug,
    cityName: city,
    displayCityName: city,
    businessName,
    displayBusinessName: businessName,
    outputPath: route.outputPath,
    keyword,
    title,
    metaDescription,
    h1: sanitizeString(`${businessName} - ${keyword}`, 220),
    h2: sanitizeString(`Hvorfor vælge ${businessName} i ${city}?`, 220),
    h3: sanitizeString(`Bestil ${String(cuisineType).toLowerCase()} online i ${city}`, 220),
    canonicalPath: route.routePath
  }];
}

function buildSeoPublishedPages(config, count) {
  const businessName = sanitizeString(config?.businessName || "Restaurant", 140) || "Restaurant";
  const cuisineType = sanitizeString(config?.cuisineType || "Restaurant", 80) || "Restaurant";
  const city = sanitizeString(config?.displayCityName || config?.cityName || config?.city || "Koebenhavn", 80) || "Koebenhavn";
  const keyword = sanitizeString(config?.keyword || `bedste ${String(cuisineType).toLowerCase()} i ${city}`, 120);
  const route = buildSeoFolderRoute(config);
  const pages = [];
  const rootDescription = sanitizeString(
    config?.description || `${businessName}. ${keyword}. Book bord eller bestil online.`,
    800
  );

  pages.push({
    sourceTitle: businessName,
    slug: "root",
    routePath: "/",
    canonicalPath: "/",
    pageType: "business_root",
    citySlug: "",
    businessSlug: route.businessSlug,
    cityName: "",
    displayCityName: "",
    businessName,
    displayBusinessName: businessName,
    outputPath: `${route.businessSlug}/index.html`,
    keyword,
    title: sanitizeString(businessName, 220),
    metaDescription: sanitizeString(rootDescription, 320),
    h1: sanitizeString(businessName, 220),
    h2: sanitizeString(`Velkommen til ${businessName}`, 220),
    h3: sanitizeString(`Bestil ${String(cuisineType).toLowerCase()} online`, 220),
    bodyText: rootDescription,
    content: rootDescription
  });

  const cityPages = new Map();
  const addCityPage = (source = {}) => {
    const displayCityName = sanitizeString(source.displayCityName || source.cityName || source.city || city, 80) || city;
    const citySlug = toAsciiSlug(source.citySlug || displayCityName, 80) || route.citySlug;
    if (!citySlug || cityPages.has(citySlug)) return;

    const pageKeyword = sanitizeString(source.keyword || keyword || `${String(cuisineType).toLowerCase()} i ${displayCityName}`, 140);
    const pageDescription = sanitizeString(
      source.bodyText || source.content || source.metaDescription ||
        `${businessName} i ${displayCityName}. ${pageKeyword}. Book bord eller bestil online.`,
      800
    );

    cityPages.set(citySlug, {
      sourceTitle: sanitizeString(source.sourceTitle || `${businessName} i ${displayCityName}`, 220),
      slug: citySlug,
      routePath: `/${citySlug}/`,
      canonicalPath: `/${citySlug}/`,
      pageType: "city_landing",
      citySlug,
      businessSlug: route.businessSlug,
      cityName: displayCityName,
      displayCityName,
      businessName,
      displayBusinessName: businessName,
      outputPath: `${citySlug}/${route.businessSlug}/index.html`,
      keyword: pageKeyword,
      title: sanitizeString(source.title || `${businessName} i ${displayCityName}`, 220),
      metaDescription: sanitizeString(source.metaDescription || pageDescription, 320),
      h1: sanitizeString(source.h1 || `${businessName} i ${displayCityName}`, 220),
      h2: sanitizeString(source.h2 || `Hvorfor vælge ${businessName} i ${displayCityName}?`, 220),
      h3: sanitizeString(source.h3 || `Bestil ${String(cuisineType).toLowerCase()} online i ${displayCityName}`, 220),
      bodyText: pageDescription,
      content: pageDescription
    });
  };

  addCityPage({ citySlug: route.citySlug, displayCityName: city });
  if (Array.isArray(config?.landingPages)) {
    config.landingPages.slice(0, count).forEach((page) => {
      if (page?.citySlug || page?.displayCityName || page?.cityName || page?.city) addCityPage(page);
    });
  }

  return pages.concat([...cityPages.values()]);
}

function firstSeoValue(...values) {
  for (const value of values) {
    const text = sanitizeString(value || "", 500);
    if (text) return text;
  }
  return "";
}

function buildSeoAddressFromDoc(data = {}) {
  const address = firstSeoValue(data.address, data.companyAddress, data.streetAddress);
  const postal = firstSeoValue(data.postalCode, data.zip);
  const city = firstSeoValue(data.city, data.by);
  return [address, [postal, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function mapQuickIndustryToSeoCuisine(value) {
  const raw = sanitizeString(value || "", 120);
  const key = raw.toLowerCase();
  const map = {
    restaurant: "Klassisk dansk restaurant",
    cafe: "Cafe",
    "café": "Cafe",
    takeaway: "Takeaway",
    ice_shop: "Isbutik",
    bakery: "Bageri og konditori",
    kiosk: "Takeaway",
    catering: "Catering",
    other: "Restaurant"
  };
  return map[key] || raw || "Restaurant";
}

async function readSeoDoc(ref) {
  try {
    const snap = await ref.get();
    return snap.exists ? (snap.data() || {}) : {};
  } catch (error) {
    logger.warn("SEO publish source read failed", { error: error?.message || String(error) });
    return {};
  }
}

async function buildSeoPublishConfigFromFirestore({ companyId, locationId, overrides = {}, baseConfig = {} }) {
  const liveId = `${companyId}__${locationId}__live_profile`;
  const [company, locationRoot, locationNested, live] = await Promise.all([
    readSeoDoc(db.collection("companies").doc(companyId)),
    readSeoDoc(db.collection("locations").doc(locationId)),
    readSeoDoc(db.collection("companies").doc(companyId).collection("locations").doc(locationId)),
    readSeoDoc(db.collection("live_user_profiles").doc(liveId))
  ]);

  const location = { ...locationRoot, ...locationNested };
  const liveProfile = live.profile || {};
  const merged = { ...(baseConfig || {}), ...(overrides || {}) };
  const businessName = firstSeoValue(
    merged.businessName,
    liveProfile.companyName,
    liveProfile.profileCompanyName,
    liveProfile.name,
    company.companyName,
    company.name,
    company.displayName,
    location.companyName,
    location.name,
    "Restaurant"
  );
  const city = firstSeoValue(
    merged.city,
    merged.displayCityName,
    liveProfile.city,
    company.city,
    location.city,
    "Kobenhavn"
  );
  const cuisineType = mapQuickIndustryToSeoCuisine(firstSeoValue(
    merged.cuisineType,
    liveProfile.kitchenType,
    liveProfile.businessType,
    liveProfile.companyType,
    company.kitchenType,
    company.businessType,
    company.industry,
    location.kitchenType,
    location.businessType,
    "Restaurant"
  ));
  const offerings = firstSeoValue(
    merged.offerings,
    liveProfile.offerings,
    liveProfile.description,
    liveProfile.businessDescription,
    company.offerings,
    company.description,
    company.industryText,
    cuisineType
  );
  const keyword = firstSeoValue(
    merged.keyword,
    cuisineType && city ? `${cuisineType} ${city}` : "",
    businessName && city ? `${businessName} ${city}` : ""
  );
  const description = firstSeoValue(
    merged.description,
    liveProfile.description,
    liveProfile.businessDescription,
    company.description,
    company.industryText,
    offerings ? `${businessName} tilbyder ${offerings}${city ? ` i ${city}` : ""}.` : ""
  );
  const address = firstSeoValue(
    merged.address,
    buildSeoAddressFromDoc(liveProfile),
    buildSeoAddressFromDoc(company),
    buildSeoAddressFromDoc(location)
  );
  const phone = firstSeoValue(
    merged.phone,
    liveProfile.phone,
    liveProfile.phoneNumber,
    liveProfile.companyPhone,
    company.phone,
    company.phoneNumber,
    location.phone,
    location.phoneNumber
  );
  const subdomain = toAsciiSlug(merged.subdomain || businessName, 120) || "restaurant";

  return {
    ...merged,
    businessName,
    displayBusinessName: firstSeoValue(merged.displayBusinessName, businessName),
    subdomain,
    city,
    cityName: city,
    displayCityName: firstSeoValue(merged.displayCityName, city),
    cuisineType,
    offerings,
    keyword,
    phone,
    address,
    description,
    selectedTemplate: sanitizeString(merged.selectedTemplate || merged.design || "classic", 80) || "classic",
    pageCount: parsePageCount(merged.pageCount, 50),
    theme: merged.theme || {},
    heroImageUrl: sanitizeString(merged.heroImageUrl || "", 2000),
    ctaText: sanitizeString(merged.ctaText || "", 120),
    ctaUrl: sanitizeString(merged.ctaUrl || "", 500)
  };
}

function getSeoGatewayInvalidateConfig() {
  let functionsConfig = {};
  try {
    functionsConfig = FUNCTIONS_CONFIG.value() || {};
  } catch (_error) {
    functionsConfig = {};
  }

  const seoGatewayConfig = functionsConfig?.seo_gateway || functionsConfig?.seoGateway || {};
  const baseUrl = String(
    process.env.SEO_GATEWAY_INVALIDATE_URL ||
    seoGatewayConfig.invalidate_url ||
    seoGatewayConfig.invalidateUrl ||
    ""
  ).trim().replace(/\/+$/, "");
  const token = String(
    process.env.SEO_GATEWAY_INTERNAL_TOKEN ||
    seoGatewayConfig.internal_token ||
    seoGatewayConfig.internalToken ||
    ""
  ).trim();

  if (!baseUrl || !token) {
    return {
      ok: false,
      result: {
        attempted: false,
        reason: "missing_config"
      }
    };
  }

  try {
    const parsed = new URL(baseUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return {
        ok: false,
        result: {
          attempted: false,
          reason: "invalid_config"
        }
      };
    }
  } catch (_error) {
    return {
      ok: false,
      result: {
        attempted: false,
        reason: "invalid_config"
      }
    };
  }

  return { ok: true, baseUrl, token };
}

async function invalidateSeoGatewayCache({ citySlug, businessSlug }) {
  const config = getSeoGatewayInvalidateConfig();
  if (!config.ok) return config.result;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`${config.baseUrl}/__internal/seo-cache/invalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`
      },
      body: JSON.stringify({ citySlug, businessSlug }),
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        attempted: true,
        ok: false,
        error: `http_${response.status}`
      };
    }

    return {
      attempted: true,
      ok: true
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      error: error?.name === "AbortError" ? "timeout" : String(error?.message || "request_failed").slice(0, 180)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function upsertWebsiteAndSeoPages({ companyId, locationId, config, activatedByUid }) {
  const subdomain = sanitizeString(config?.subdomain || "", 120);
  const businessName = sanitizeString(config?.businessName || "", 140);
  const displayBusinessName = sanitizeString(config?.displayBusinessName || config?.businessName || "", 140);
  const cityName = sanitizeString(config?.displayCityName || config?.cityName || config?.city || "", 80);
  const description = sanitizeString(config?.description || "", 800);
  const selectedTemplate = sanitizeString(config?.selectedTemplate || "classic", 60) || "classic";
  const pageCount = parsePageCount(config?.pageCount, 50);
  const logoDataUrl = sanitizeString(config?.logoDataUrl || "", 500000);
  const route = buildSeoFolderRoute({ ...config, subdomain });

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
    citySlug: route.citySlug,
    businessSlug: route.businessSlug,
    cityName: cityName || route.citySlug,
    displayCityName: cityName || route.citySlug,
    businessName: displayBusinessName || businessName || subdomain,
    displayBusinessName: displayBusinessName || businessName || subdomain,
    routePath: route.routePath,
    outputPath: route.outputPath,
    template: selectedTemplate,
    brandMode: "madkontrollen_default",
    logoUrl: logoDataUrl || null,
    heroTitle: displayBusinessName || businessName || subdomain,
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

  const pages = buildSeoPublishedPages(config, pageCount);
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
      citySlug: page.citySlug || route.citySlug,
      businessSlug: page.businessSlug || route.businessSlug,
      cityName: page.cityName || cityName || route.citySlug,
      displayCityName: page.displayCityName || cityName || route.citySlug,
      businessName: page.businessName || displayBusinessName || businessName || subdomain,
      displayBusinessName: page.displayBusinessName || displayBusinessName || businessName || subdomain,
      pageType: page.pageType || "city_landing",
      routePath: page.routePath || page.canonicalPath || route.routePath,
      outputPath: page.outputPath || route.outputPath,
      slug: page.slug,
      url: `https://${route.businessSlug}.madkontrollen.dk${page.canonicalPath}`,
      keyword: page.keyword,
      title: page.title,
      metaDescription: page.metaDescription,
      h1: page.h1,
      h2: page.h2,
      h3: page.h3,
      bodyText: page.bodyText || page.content || page.metaDescription || "",
      content: page.content || page.bodyText || page.metaDescription || "",
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

  const cacheInvalidation = await invalidateSeoGatewayCache({
    citySlug: route.citySlug,
    businessSlug: route.businessSlug
  });

  if (cacheInvalidation.attempted && !cacheInvalidation.ok) {
    logger.warn("SEO gateway cache invalidation failed", {
      citySlug: route.citySlug,
      businessSlug: route.businessSlug,
      error: cacheInvalidation.error || "unknown"
    });
  }

  return {
    websiteId,
    generatedPages: pages.length,
    subdomain,
    citySlug: route.citySlug,
    businessSlug: route.businessSlug,
    cacheInvalidation
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

function removeUndefinedFields(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item)).filter(item => item !== undefined);
  }
  
  const cleaned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (value !== undefined) {
        cleaned[key] = removeUndefinedFields(value);
      }
    }
  }
  return cleaned;
}

async function createHaccpSnapshotDocument({ profile = {}, riskModel = {}, companyId, locationId, userId }) {
  const payload = buildHaccpSnapshotPayload({
    profile,
    riskModel,
    companyId,
    locationId,
    userId
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
  const isSuperAdmin = role === "super-admin";
  if (isSuperAdmin) {
    return;
  }

  const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 120);
  if (!userCompanyId || userCompanyId !== companyId) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Adgang til companyId afvist."
    );
  }

  const allowedLocationIds = getUserLocationIds(userData);

  // OWNER override: owners can always access their own location
  const isOwner =
    role === "owner" &&
    (
      userData.locationId === locationId ||
      userData.primaryLocationId === locationId ||
      (userData.locationIds || []).includes(locationId)
    );

  // Debug logging
  console.log("[AUTH CHECK startDayForLocation]", {
    uid,
    role,
    locationId,
    allowedLocationIds,
    isOwner,
    isSuperAdmin
  });

  if (!isSuperAdmin && !isOwner && !allowedLocationIds.includes(locationId)) {
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
  const allowedRoles = ["owner", "hq_admin", "location_manager", "admin", "manager", "employee", "customer", "signup", "onboarding", "onboarding_user", "pending"];
  if (role && !allowedRoles.includes(role)) {
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

    // Nøglen er doc.id — kompatibel med nyt templateDocId__[equipmentId__]dateKey skema
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

// ─── ADMIN: RE-PROVISION EQUIPMENT FOR EXISTING LOCATION ────────────────────
// Kald dette for lokationer som ikke gik igennem det nye checkout-flow.
// Populerer `equipment` collection, rydder op i cleaning/maintenance templates.
exports.adminReprovisionEquipment = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;

  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind.");
  }

  const uid = sanitizeString(auth.uid, 160);
  const email = sanitizeString(auth.token?.email || "", 160).toLowerCase();
  const companyId = sanitizeString(data?.companyId, 120);
  const locationId = sanitizeString(data?.locationId, 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
  }

  await assertAdminAccess({ uid, email, companyId, locationId });

  // Accept explicit counts or fall back to live_user_profiles → profile
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

// ─── ADMIN: GENERER RISKS FRA ONBOARDING ─────────────────────────────────────
exports.generateRisksForLocation = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;

  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind.");
  }

  const uid = sanitizeString(auth.uid, 160);
  const email = sanitizeString(auth.token?.email || "", 160).toLowerCase();
  const companyId = sanitizeString(data?.companyId, 120);
  const locationId = sanitizeString(data?.locationId, 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
  }

  await assertAdminAccess({ uid, email, companyId, locationId });

  const { generateRisksFromOnboardingAnswers } = require("./admin/generateRisksFromOnboardingAnswers");
  const result = await generateRisksFromOnboardingAnswers({ locationId });

  return { ok: true, ...result };
});

// ─── ADMIN: GENERER EGENKONTROL-TEMPLATES FRA RISKS ──────────────────────────
exports.generateTemplatesForLocation = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;

  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind.");
  }

  const uid = sanitizeString(auth.uid, 160);
  const email = sanitizeString(auth.token?.email || "", 160).toLowerCase();
  const companyId = sanitizeString(data?.companyId, 120);
  const locationId = sanitizeString(data?.locationId, 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
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
// 🔹 FREKVENS LOGIK
//

/**
 * Ny unified schedule evaluator med support for scheduleConfig.
 * Understøtter: daily, every_n_days, weekly_days, monthly, yearly, firstRunImmediately.
 */
function shouldRunToday(scheduleConfig, todayKey, anchorDateKey, lastCompletedDateKey) {
  if (!scheduleConfig) return false;

  const scheduleType = scheduleConfig.scheduleType || "operational";
  const firstRunImmediately = scheduleConfig.firstRunImmediately === true;
  const recurrenceMode = scheduleConfig.documentedIntervalMode || scheduleConfig.recurrenceMode || "daily";
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

  // Merge: bevar eksisterende brugerdata, tilføj kun manglende felter
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

  // Kun opdater hvis der er ændringer
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
  
  // Kun relevante typer får temperatureControl
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

  // Merge: bevar eksisterende brugerdata, tilføj kun manglende felter
  const merged = {
    enabled: existing.enabled !== undefined ? existing.enabled : defaults.enabled,
    useGlobalSchedule: existing.useGlobalSchedule !== undefined ? existing.useGlobalSchedule : defaults.useGlobalSchedule,
    useDailyObservation: existing.useDailyObservation !== undefined ? existing.useDailyObservation : defaults.useDailyObservation,
    overrideSchedule: existing.overrideSchedule || defaults.overrideSchedule
  };

  // Kun opdater hvis der er ændringer
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
  const normalized = sanitizeString(value, 80).toLowerCase().replace(/[\s-]+/g, "_");
  const aliases = {
    "pålægsmaskine": "paalaegsmaskine",
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
    "is-maskine": "ismaskine"
  };
  return aliases[normalized] || normalized;
}

/**
 * Beregner status for en temperaturtask ud fra threshold og målt temperatur.
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
    // ingen generisk fallback — hvis ingen units, skip template
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

function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

// ─── ONBOARDING EQUIPMENT SYNC ───────────────────────────────────────────────

// ─── EQUIPMENT-BASED CLEANING TEMPLATES ──────────────────────────────────────
// Defines which equipment types should generate a per-unit cleaning task.
// controlType "cleaning_check" + explicit equipmentType triggers per-unit expansion.

const EQUIPMENT_CLEANING_TEMPLATE_DEFINITIONS = [
  { key: "cleaning_fridge_control",         equipmentType: "fridge",          titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rengør og desinficér køleskab grundigt. Fjern alle varer. Rengør hylder, skuffer og gummilister. Tør indvendigt tørt. Placer varerne tilbage. Kontrollér at døren lukker tæt." },
  { key: "cleaning_freezer_control",        equipmentType: "freezer",         titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Afrim og rengør fryser. Fjern alle varer og isbelægning. Rengør indvendigt med godkendt middel. Tør af og sæt varerne tilbage. Kontrollér temperatur efterfølgende." },
  { key: "cleaning_fryer_control",          equipmentType: "fryer",           titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Sluk og afkøl frituregryden. Tøm og filtrer olien. Rengør kar, kurve og varmeelementet. Kontrollér oliernes kvalitet (friture-test). Varm op til driftstemperatur igen." },
  { key: "cleaning_dishwasher_control",     equipmentType: "dishwasher",      titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rens opvaskemaskinens filtre, arme og indre vægge. Kontrollér afkalkningsmiddel og skyllemiddel. Kør et tomt program. Kontrollér skylletemperatur (min. 82°C)." },
  { key: "paalaegsmaskine_rengoering",      equipmentType: "slicer",          routineType: "paalaegsmaskine_rengoering", templateKey: "paalaegsmaskine_rengoering", titleBase: "Pålægsmaskine rengøring", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rengør og desinficér pålægsmaskinens kniv, slæde, afskærmning og fødevarekontaktflader. Kontrollér at der ikke er synlige madrester, fedt, belægninger eller snavs, og at aftagelige dele er samlet korrekt." },
  { key: "softice_maskine_rengoering",      equipmentType: "softice_machine", routineType: "softice_maskine_rengoering", templateKey: "softice_maskine_rengoering", titleBase: "Ismaskine / softicemaskine rengøring", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rengør og desinficér ismaskine eller softicemaskine efter virksomhedens plan og producentens anvisning. Kontrollér kontaktflader, dyser, tappetud, beholdere, aftagelige dele og området omkring maskinen." },
  { key: "cleaning_display_fridge_control", equipmentType: "display_fridge",  titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Tøm displaykøl. Rengør hylder og vægge indvendigt. Kontrollér gummilister og låger. Tør af og fyld op med korrekt placerede varer. Kontrollér temperatur." },
  { key: "cleaning_warming_cabinet_control",equipmentType: "warming_cabinet", titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rengør varmeskab. Fjern mad-rester fra hylder og vægge. Rengør med varmt vand og godkendt rengøringsmiddel. Tør af. Kontrollér varmeelementer og termostat." },
  { key: "cleaning_blast_chiller_control",  equipmentType: "blast_chiller",   titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rengør blast chiller efter brug. Fjern alle madrester. Rengør indvendigt med godkendt middel. Kontrollér fordamper for isophobning. Tør og klargør til næste brug." },
];

async function syncEquipmentCleaningTemplates({ db: dbRef, companyId, locationId }) {
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
      if (existing.title !== def.titleBase) {
        await ref.update({ title: def.titleBase, guideTitle: `Vejledning: ${def.titleBase}`, updatedAt: nowTs });
      }
      continue;
    }

    await ref.set({
      templateId:    docId,
      id:            def.key,
      companyId,
      organizationId: companyId,
      locationId,
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

  console.log(`[syncEquipmentCleaningTemplates] done — created=${created}, activeTypes=${[...activeTypes].join(",")}`);
  return { ok: true, created };
}
// ─── EQUIPMENT-BASED MAINTENANCE TEMPLATES ───────────────────────────────────
// Defines which equipment types should generate a per-unit maintenance task.
// controlType "maintenance_check" + explicit equipmentType triggers per-unit expansion.

const EQUIPMENT_MAINTENANCE_TEMPLATE_DEFINITIONS = [
  { key: "maintenance_fridge_control",        equipmentType: "fridge",          titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér køleskab for mekaniske fejl. Tjek termostat, kompressor og ventilator. Kontrollér gummilister og dørlukning. Afrim om nødvendigt. Rens kondensatorbakke." },
  { key: "maintenance_freezer_control",       equipmentType: "freezer",         titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér fryser for mekaniske fejl. Tjek termostat, kompressor og lås. Kontrollér gummilister. Afrim og rengør kondensatorbakke." },
  { key: "maintenance_walk_in_cooler_control",equipmentType: "walk_in_cooler",  titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér walk-in køler. Tjek kompressor, fordamper, lys og dørlukning. Kontrollér pakninger og låsemekanisme. Kontrollér gulvafløb." },
  { key: "maintenance_walk_in_freezer_control",equipmentType: "walk_in_freezer",titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér walk-in fryser. Tjek kompressor, fordamper, lys og dørlukning. Afgørende: ingen isophobning på fordamper. Kontrollér pakninger og låsemekanisme." },
  { key: "maintenance_fryer_control",         equipmentType: "fryer",           titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér frituregryde. Tjek termostat og sikkerhedsafbryder. Kontrollér varmeelement og drænsystem. Kontrollér oliestanden og oliernes kvalitet." },
  { key: "maintenance_dishwasher_control",    equipmentType: "dishwasher",      titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér opvaskemaskine. Tjek skylletemperatur (min. 82°C), vandtryk og doseringssystem. Rens filtre og sprøjtearme. Kontrollér tætninger og låger." },
  { key: "maintenance_ice_machine_control",   equipmentType: "ice_machine",     titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér isterningemaskine. Tjek vandfilter og afkølingssystem. Kontrollér at ingen slim eller alger er synlige. Efterse vandindløb og afløb." },
  { key: "maintenance_blast_chiller_control", equipmentType: "blast_chiller",   titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér blast chiller. Tjek kompressor, fordamper og temperaturprobe. Kontrollér dørlukning og pakninger. Kontrollér at fordamper er fri for isophobning." },
  { key: "maintenance_warming_cabinet_control",equipmentType: "warming_cabinet",titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér varmeskab. Tjek termostat og varmeelement. Kontrollér temperaturjustering og dørlukning. Eftersyn af pakninger og vandskuffe (ved dampvarmeskabe)." },
  { key: "maintenance_display_fridge_control",equipmentType: "display_fridge",  titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér displaykøl. Tjek kompressor, belysning og dørlukning. Kontrollér gummilister og hyldeplaceringer. Rens kondensatorgitter og kontrollér afløb." },
  { key: "maintenance_softice_control",       equipmentType: "softice_machine", titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér softice-maskine. Tjek blandeenhed, pumper og seals. Kontrollér temperatur og viskositet. Kontrollér at sikkerhedstermostat fungerer korrekt." },
];

async function syncEquipmentMaintenanceTemplates({ db: dbRef, companyId, locationId }) {
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
      if (existing.title !== def.titleBase) {
        await ref.update({ title: def.titleBase, guideTitle: `Vejledning: ${def.titleBase}`, updatedAt: nowTs });
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

  console.log(`[syncEquipmentMaintenanceTemplates] done — created=${created}, activeTypes=${[...activeTypes].join(",")}`);
  return { ok: true, created };
}

// ─── AREA-BASEREDE RENGØRINGSRUTINER ─────────────────────────────────────────
// Én template per rengøringsområde afledt af onboarding_answers.areas[].
// templateSource = "area_cleaning_library"  templateType = "operational"

const AREA_CLEANING_DEFINITIONS = [
  { areaKey: "kitchen",              title: "Rengøring af køkken",                  frequency: "daily",   riskLevel: "high",   guideBody: "Rengør og desinficér alle køkkenoverflader: bordplader, gulv, vaskestationer og udstyr. Tjek at der er rene karklude. Tip affald ud. Dokumentér udførelse." },
  { areaKey: "production_kitchen",   title: "Rengøring af produktionskøkken",       frequency: "daily",   riskLevel: "high",   guideBody: "Rengør produktionsoverflader og -udstyr. Tip affaldsposer og skift. Rengør gulv, vask og dræn. Kontrollér at ingen fødevareaffald er tilbage." },
  { areaKey: "serving_area",         title: "Rengøring af serveringsområde",        frequency: "daily",   riskLevel: "medium", guideBody: "Rengør borde, stole, buffet og serveringsstationer. Rengør gulv og sørg for at alle overflader gæster har kontakt med er rene." },
  { areaKey: "dry_storage",          title: "Rengøring af tørlager",                frequency: "weekly",  riskLevel: "low",    guideBody: "Rengør hylder og gulv. Kontrollér at alle varer er hævet fra gulvet og korrekt opbevaret. Kontrollér holdbarhedsdatoer. Tjek for skadedyr." },
  { areaKey: "toilet",               title: "Rengøring af toilet og håndvask",      frequency: "daily",   riskLevel: "high",   guideBody: "Rengør og desinficér toilet, håndvask og gulv. Fyld sæbe og papirhåndklæder op. Kontrollér at der er håndsprit tilgængeligt for personale." },
  { areaKey: "dishwashing_area",     title: "Rengøring af opvaskområde",            frequency: "daily",   riskLevel: "medium", guideBody: "Rengør opvaskemaskine, bakkestativ og gulvafløb. Tip madrester ud. Kontrollér rengøringsmidler og skyllemidler. Tjek at alle overflader er rene." },
  { areaKey: "washing_room",         title: "Rengøring af vaskerum",                frequency: "daily",   riskLevel: "medium", guideBody: "Rengør vaskerum og dræn. Kontrollér at lagervarer er ryddeligt placeret og hævet fra gulvet." },
  { areaKey: "vegetable_room",       title: "Rengøring af grøntrum",                frequency: "daily",   riskLevel: "medium", guideBody: "Rengør hylder og gulv. Fjern blade og affald. Tjek at temperatur er korrekt (typisk 10–12°C). Kontrollér at ingen råd/mug på varer." },
  { areaKey: "walk_in_cooler_room",  title: "Rengøring af kølerum",                 frequency: "daily",   riskLevel: "high",   guideBody: "Rengør gulv og hylder. Tjek at alle varer er korrekt dækket og mærket. Kontrollér at gulvafløbet ikke er tilstoppet. Rengør dørpakninger." },
  { areaKey: "walk_in_freezer_room", title: "Rengøring af fryserum",                frequency: "weekly",  riskLevel: "medium", guideBody: "Rengør gulv og hylder. Tjek at alle varer er korrekt dækket og mærket. Afrim om nødvendigt. Kontrollér at dør lukker tæt og pakninger er intakte." },
];

async function syncAreaCleaningTemplates({ db: dbRef, companyId, locationId }) {
  if (!companyId || !locationId) {
    console.warn("[syncAreaCleaningTemplates] missing companyId or locationId, skipping");
    return { ok: false, created: 0 };
  }

  // Hent areas fra onboarding_answers — læs canonical doc direkte for at undgå at ramme forkert doc
  const canonicalDocId = `${companyId}__${locationId}__onboarding`;
  const oaDoc = await dbRef.collection("onboarding_answers").doc(canonicalDocId).get();
  const oaData = oaDoc.exists ? oaDoc.data() : {};
  const areas = toArray(oaData.areas);

  // Fallback: alle lokationer har et køkken
  const activeAreas = new Set(areas.length > 0 ? areas : ["kitchen"]);

  const nowTs = FieldValue.serverTimestamp();
  let created = 0, skipped = 0;

  for (const def of AREA_CLEANING_DEFINITIONS) {
    if (!activeAreas.has(def.areaKey)) continue;

    const docId = `${companyId}_${locationId}_area_cleaning_${def.areaKey}`;
    const ref   = dbRef.collection("task_templates").doc(docId);
    const snap  = await ref.get();
    if (snap.exists) { skipped++; continue; }

    await ref.set({
      templateId:     docId,
      companyId,
      organizationId: companyId,
      locationId,
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

  console.log(`[syncAreaCleaningTemplates] done — created=${created} skipped=${skipped} areas=${[...activeAreas].join(",")}`);
  return { ok: true, created, skipped };
}

// ─── PROCES-BASEREDE DRIFTSOPGAVER ───────────────────────────────────────────
// Én template per driftsopgave afledt af onboarding_answers.processes[].
// Visse opgaver genereres altid (datokontrol, adskillelse, luk dag).
// 3-timers regel genereres kun ved buffet/servering uden permanent køl/varme.
// templateSource = "process_drift_library"

const PROCESS_DRIFT_TEMPLATE_DEFINITIONS = [
  {
    key:         "process_drift_varemodtagelse",
    title:       "Varemodtagelse",
    description: "Kontrollér temperatur, emballage og holdbarhed ved modtagelse af fødevarer.",
    frequency:   "daily",
    category:    "modtagelse",
    controlType: "receiving_control",
    guideKey:    "receiving_goods",
    sortOrder:   10,
    alwaysInclude: true,
  },
  {
    key:         "process_drift_nedkoeling",
    title:       "Nedkøling",
    description: "Kontrollér at varmebehandlede fødevarer nedkøles korrekt fra +65°C til under +10°C inden for 4 timer (lovkrav).",
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
    description: "Kontrollér at varme retter holdes ved minimum 60°C og ikke varmholdes i mere end 3 timer.",
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
    description: "Kontrollér at genopvarmede fødevarer når minimum 75°C i kernen.",
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
    description: "Kontrollér holdbarhedsdatoer på alle opbevarede fødevarer. Fjern udgåede varer og følg FIFO-princippet (først ind, først ud).",
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
    description: "Kontrollér korrekt adskillelse af rå og tilberedte fødevarer i køl, på arbejdsborde og med redskaber.",
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
    description: "Kontrollér at fødevarer uden aktiv køl eller varme ikke har stået i farezonen (8–65°C) i mere end 3 timer.",
    frequency:   "daily",
    category:    "drift",
    controlType: "three_hour_rule",
    guideKey:    "three_hour_rule",
    sortOrder:   70,
    alwaysInclude: false,
    requiresProcessAny: ["serve_cold_food", "hot_hold_food"],
  },
];

async function syncProcessDriftTemplates({ db: dbRef, companyId, locationId }) {
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
      if (existing.title !== def.title || existing.description !== def.description) {
        await ref.update({ title: def.title, description: def.description, updatedAt: nowTs });
      }
      skipped++;
      continue;
    }

    await ref.set({
      templateId:     docId,
      companyId,
      organizationId: companyId,
      locationId,
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

  console.log(`[syncProcessDriftTemplates] done — created=${created} skipped=${skipped}`);
  return { ok: true, created, skipped };
}

// ─── VANDKONTROL RUTINER ─────────────────────────────────────────────────────
// Én template per vandroutine. drikkevand og filter er altid aktive.
// isterningemaskine genereres kun hvis ice_machine-udstyr er registreret.
// controlType "water_control" → specifik UI-formular i rutiner.html

const WATER_CONTROL_TEMPLATE_DEFINITIONS = [
  {
    key:            "water_control_drikkevand",
    title:          "Kontrol af drikkevand",
    description:    "Kontrollér drikkevandets udseende (klar/uklar), lugt og smag. Mål temperatur hvis relevant (koldt vand max 12°C, varmt min 55°C). Notér visuel status og eventuelle afvigelser.",
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
    description:    "Inspicér vandfilter for tilstopning eller misfarvning. Kontrollér filtrets levetid og udskiftningsdato. Notér filterets aktuelle status.",
    frequency:      "weekly",
    category:       "vandkontrol",
    controlType:    "water_control",
    guideKey:       "water_control",
    riskLevel:      "medium",
    alwaysInclude:  true,
  },
];

async function syncWaterControlTemplates({ db: dbRef, companyId, locationId }) {
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
      if (existing.title !== def.title || existing.description !== def.description) {
        await ref.update({ title: def.title, description: def.description, updatedAt: nowTs });
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

  console.log(`[syncWaterControlTemplates] done — created=${created} skipped=${skipped}`);
  return { ok: true, created, skipped };
}

const EQUIPMENT_COUNT_MAPPING = [
  { countKeys: ["fridge", "fridgeCount", "antalKoeleskabe"],                equipmentType: "fridge",          titleBase: "Køleskab",          controlTypes: ["temperature_check"] },
  { countKeys: ["freezer", "freezerCount", "antalFrysere"],                 equipmentType: "freezer",         titleBase: "Fryser",            controlTypes: ["temperature_check"] },
  { countKeys: ["walk_in_cooler", "walkInCooler", "walkInCoolerCount"],     equipmentType: "walk_in_cooler",   titleBase: "Walk-in køler",     controlTypes: ["temperature_check"] },
  { countKeys: ["walk_in_freezer", "walkInFreezer", "walkInFreezerCount"],  equipmentType: "walk_in_freezer",  titleBase: "Walk-in fryser",    controlTypes: ["temperature_check"] },
  { countKeys: ["ice_machine", "iceMachine", "antalIsterningemaskiner"],    equipmentType: "ice_machine",      titleBase: "Isterningemaskine", controlTypes: [] },
  { countKeys: ["ice_box", "isboks", "antalIsbokse"],                       equipmentType: "ice_box",          titleBase: "Isboks",            controlTypes: ["temperature_check"] },
  { countKeys: ["fryer", "antalFrityreGryder"],                             equipmentType: "fryer",            titleBase: "Frituregryden",     controlTypes: [] },
  { countKeys: ["dishwasher", "antalOpvaskemaskiner"],                      equipmentType: "dishwasher",       titleBase: "Opvaskemaskine",    controlTypes: [] },
  { countKeys: ["blast_chiller", "blastChiller", "antalBlastChillere"],     equipmentType: "blast_chiller",    titleBase: "Blast chiller",     controlTypes: ["temperature_check"] },
  { countKeys: ["warming_cabinet", "warmingCabinet", "antalVarmeskabe"],    equipmentType: "warming_cabinet",  titleBase: "Varmeskab",         controlTypes: ["temperature_check"] },
  { countKeys: ["display_fridge", "displayFridge", "antalDisplaykoele"],   equipmentType: "display_fridge",   titleBase: "Displaykøl",        controlTypes: ["temperature_check"] },
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

async function syncOnboardingEquipmentUnits({ db: dbRef, companyId, locationId, equipmentCounts = {}, profile = {} }) {
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
  for (const doc of existingSnap.docs) {
    existingById.set(doc.id, { ref: doc.ref, data: doc.data() || {} });
  }

  const batch = dbRef.batch();
  let created = 0, updated = 0, deactivated = 0, kept = 0;
  const equipmentIds = [];
  const nowTs = FieldValue.serverTimestamp();

  for (const mapping of EQUIPMENT_COUNT_MAPPING) {
    const count = normalizedCounts[mapping.equipmentType] || 0;
    const { equipmentType, titleBase, controlTypes } = mapping;

    // Find highest existing unit number for this type
    let maxExisting = 0;
    for (const [id] of existingById) {
      const prefix = `onboarding_${equipmentType}_`;
      if (id.startsWith(prefix)) {
        const n = parseInt(id.slice(prefix.length), 10);
        if (!isNaN(n) && n > maxExisting) maxExisting = n;
      }
    }

    // Upsert active units 1..count
    for (let i = 1; i <= count; i++) {
      const docId = `onboarding_${equipmentType}_${i}`;
      const title = `${titleBase} ${i}`;
      const existing = existingById.get(docId);
      const ref = existing?.ref || dbRef.collection("equipment").doc(docId);

      if (existing) {
        batch.set(ref, {
          companyId, organizationId: companyId, locationId,
          source: "onboarding", equipmentType, type: equipmentType,
          controlTypes, controlType: controlTypes[0] || "",
          title, name: title, displayName: title,
          unitNumber: i, active: true,
          updatedAt: nowTs
        }, { merge: true });
        if (existing.data.active === false) { updated++; } else { kept++; }
      } else {
        batch.set(ref, {
          companyId, organizationId: companyId, locationId,
          source: "onboarding", equipmentType, type: equipmentType,
          controlTypes, controlType: controlTypes[0] || "",
          title, name: title, displayName: title,
          unitNumber: i, active: true,
          createdAt: nowTs, updatedAt: nowTs
        });
        created++;
        console.log(`[syncOnboardingEquipmentUnits] created ${docId}`);
      }
      equipmentIds.push(docId);
    }

    // Deactivate units above current count
    for (let i = count + 1; i <= maxExisting; i++) {
      const docId = `onboarding_${equipmentType}_${i}`;
      const existing = existingById.get(docId);
      if (existing && existing.data.active !== false) {
        batch.set(existing.ref, { active: false, updatedAt: nowTs }, { merge: true });
        deactivated++;
        console.log(`[syncOnboardingEquipmentUnits] deactivated ${docId}`);
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
      units
    });
  }
  
  const summary = { ok: true, created, updated, deactivated, kept, equipmentIds, tempControlUpdated };
  console.log("[syncOnboardingEquipmentUnits] summary", summary);
  return summary;
}

exports.saveLocationEquipmentUnits = functions.https.onCall(async (request, context) => {
  const data = request.data || request;

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind.");
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
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
      const prefix = `onboarding_${itemType}_`;
      if (docSnap.id.startsWith(prefix)) {
        unitNumber = toPositiveInt(docSnap.id.slice(prefix.length));
      }
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
        docId = `onboarding_${desired.type}_${unitNumber}`;
      }
    }

    if (!unitNumber) {
      const prefix = `onboarding_${desired.type}_`;
      if (docId.startsWith(prefix)) {
        unitNumber = toPositiveInt(docId.slice(prefix.length));
      }
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

    batch.set(ref, {
      companyId,
      organizationId: companyId,
      locationId,
      source: "onboarding",
      equipmentType: desired.type,
      type: desired.type,
      controlTypes: meta.controlTypes,
      controlType: meta.controlTypes[0] || "",
      title: displayName,
      name: displayName,
      displayName,
      unitNumber,
      active: nextActive,
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

// ─────────────────────────────────────────────────────────────────────────────

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

function createTaskTemplate(templateId, schema, schemaKey, unit, companyId, locationId, userId, userEmail, nowIso, formType, frequency, frequencyDays, customTitle = null, cleaningArea = null) {
  // TRACE LOGGING - PROBLEM A - v2
  console.log(`[createTaskTemplate] INPUT: schemaKey=${schemaKey}, schema.titleKey=${schema.titleKey}, schema.descriptionKey=${schema.descriptionKey}, customTitle=${customTitle}`);
  
  // Danish title and description mappings
  const schemaTitles = {
    'varemodtagelse': 'Varemodtagelse af køle- og frostvarer',
    'koel_frost': 'Temperaturkontrol af køle- og frostudstyr',
    'opvarmning': 'Opvarmning og genopvarmning',
    'varmholdelse': 'Varmholdelse af tilberedte retter',
    'nedkoeling': 'Nedkøling af varmbehandlede fødevarer',
    'rengoering': 'Rengøring og hygiejne',
    'adskillelse': 'Adskillelse og krydskontaminering',
    'opvaskemaskine': 'Opvaskemaskine - kontrol og rengøring'
  };
  
  const schemaDescriptions = {
    'varemodtagelse': 'Kontroller temperatur, emballage og kvalitet ved modtagelse af køle- og frostvarer. Registrer temperatur og eventuelle afvigelser.',
    'koel_frost': 'Daglig temperaturkontrol af køleskabe og frysere. Temperaturen skal være max 5°C for køl og max -18°C for frost.',
    'opvarmning': 'Kontroller at kernetemperaturen når minimum 75°C i mindst 2 minutter ved opvarmning og genopvarmning af fødevarer.',
    'varmholdelse': 'Varmholdte retter skal holdes ved minimum 65°C. Kontroller temperaturen regelmæssigt.',
    'nedkoeling': 'Nedkøl varmebehandlede fødevarer fra +65°C til under +10°C på maksimalt 4 timer (lovkrav). Registrer start- og sluttidspunkt samt temperaturer.',
    'rengoering': 'Daglig rengøring og hygiejnekontrol af arbejdsflader, udstyr og lokaler. Følg rengøringsplanen.',
    'adskillelse': 'Kontroller adskillelse mellem råvarer og færdige produkter. Brug separate redskaber og skærebrætter.',
    'opvaskemaskine': 'Kontroller opvaskemaskinens temperatur og rengøring. Skylletemperatur skal være minimum 82°C.'
  };
  
  const title = customTitle || schemaTitles[schemaKey] || schemaKey;
  
  let description = schemaDescriptions[schemaKey] || '';
  
  if (schemaKey === 'koel_frost' && unit) {
    if (unit.type === 'fridge') {
      description = 'Kontroller og registrer temperaturen for dette køleskab. Temperaturen må højst være 5°C.';
    } else if (unit.type === 'freezer') {
      description = 'Kontroller og registrer temperaturen for denne fryser. Temperaturen skal være -18°C eller koldere.';
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
  units = []
}) {
  const templatesRef = db.collection("task_templates");

  async function createTemplateIfNotExists(template) {
    const docRef = templatesRef.doc(template.templateId);
    const snap = await docRef.get();
    if (snap.exists) {
      const existing = snap.data() || {};
      // Update if templateType is missing or incorrect
      if (!existing.templateType || existing.templateType !== "operational") {
        await docRef.update({
          templateType: "operational",
          updatedAt: new Date()
        });
        console.log(`[ensureEgenkontrolTaskTemplates] Updated templateType for ${template.templateId}`);
      }
      return;
    }
    await docRef.set(template);
    console.log(`[ensureEgenkontrolTaskTemplates] Created ${template.templateId}`);
  }

  const baseMeta = {
    companyId,
    locationId,
    templateType: "operational",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // TEMPERATUR PER UNIT
  for (const unit of units) {
    let guideKey = null;
    let cleanGuideKey = null;
    const label = unit.name || "Enhed";

    if (unit.type === "fridge")           { guideKey = "fridge_temperature";          cleanGuideKey = "cleaning_control"; }
    if (unit.type === "freezer")          { guideKey = "freezer_temperature";         cleanGuideKey = "cleaning_control"; }
    if (unit.type === "walk_in_cooler")   { guideKey = "walkin_cooler_temperature";   cleanGuideKey = "cleaning_control"; }
    if (unit.type === "walk_in_freezer")  { guideKey = "walk_in_freezer_temperature"; cleanGuideKey = "cleaning_control"; }
    if (unit.type === "ice_machine")      { guideKey = "ice_machine_cleaning";        cleanGuideKey = "ice_machine_cleaning"; }
    if (unit.type === "isboks")           { guideKey = "freezer_temperature";         cleanGuideKey = "cleaning_control"; }
    if (unit.type === "friture")          { guideKey = "friture_control";             cleanGuideKey = "friture_control"; }
    if (unit.type === "blast_chiller")    { guideKey = "blast_chiller_temperature";   cleanGuideKey = "cleaning_control"; }

    // Temperaturrutine (kun for køle/fryse-enheder og friture)
    if (guideKey && unit.type !== "ice_machine") {
      const description = unit.type === "blast_chiller"
        ? "Intern skærpet kontrol: Nedkøl til under +5°C inden for 90 min (ikke lovkrav)"
        : "Kontroller og registrer temperatur";
      
      await createTemplateIfNotExists({
        templateId: `${companyId}__${locationId}__temp__${unit.id}`,
        ...baseMeta,
        templateKey: "temperature_control",
        title: `Temperaturkontrol – ${label}`,
        description: description,
        guideKey,
        frequency: "daily",
        equipmentUnit: unit.id,
        scheduleConfig: {
          scheduleType: "operational",
          recurrenceMode: "every_n_days",
          recurrenceValue: 7,
          firstRunImmediately: false,
          useDailyObservation: true
        }
      });
    }

    // Rengøringsrutine per enhed
    if (cleanGuideKey) {
      await createTemplateIfNotExists({
        templateId: `${companyId}__${locationId}__clean__${unit.id}`,
        ...baseMeta,
        templateKey: "cleaning_control",
        title: `Rengøring – ${label}`,
        description: `Rengør og desinficer ${label.toLowerCase()} grundigt`,
        guideKey: cleanGuideKey,
        frequency: unit.type === "fridge" || unit.type === "freezer" || unit.type === "isboks" ? "weekly" : "daily",
        equipmentUnit: unit.id
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
        title: `Temperaturkontrol – ${unit.name || "Enhed"}`,
        templateType: "operational",
        unitId: unit.id,
        unitType: unit.type,
        unitName: unit.name
      });
    }
  }
  
  return { ok: true };
}

// ─── START-DAY IDEMPOTENCY HELPERS ───────────────────────────────────────────

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
    // Firestore Timestamp — convert to ms for stable comparison
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

// ─────────────────────────────────────────────────────────────────────────────

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
    
    // 🚫 Fjern gamle auto templates
    if (id.includes("auto_task")) {
      filterResults.set(id, "DROP: auto_task");
      return false;
    }
    
    // 🚫 Fjern gamle KCP templates (ikke aggregerede)
    if (id.includes("kcp_") && !template.isAggregated) {
      filterResults.set(id, "DROP: kcp without aggregation");
      return false;
    }
    
    // 🚫 Ekstra sikkerhed: fjern hvis title indikerer gammel struktur
    const title = (template.title || "").toLowerCase();
    if (title.includes("kcp") && !template.isAggregated) {
      filterResults.set(id, "DROP: kcp in title without aggregation");
      return false;
    }
    
    // 🚫 Fjern generisk koel_frost template hvis der findes unit-specifikke templates
    if (hasUnitSpecificKoelFrost && id.match(/egenkontrol_koel_frost$/) && !id.includes("__fridge_") && !id.includes("__freezer_") && !id.includes("__ice_machine_")) {
      console.log(`[egenkontrol] Skipping legacy generic koel_frost template: ${id}`);
      filterResults.set(id, "DROP: legacy generic koel_frost");
      return false;
    }
    
    // ✅ Use unified daily routine filter
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
  if (!equipmentByType.fridge)   equipmentByType.fridge   = allEquipment.filter((x) => x.type.includes("fridge") || x.type.includes("koleskab") || x.type.includes("køleskab"));
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

    // ✅ Use unified daily routine filter
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

  console.log(`[startDayForLocation] Schedule system usage: newSchedule=${newScheduleCount}, legacy=${legacyScheduleCount}, disabledUnits=${disabledUnitCount}`);

  return {
    ok: true,
    alreadyStarted,
    created: createdCount,
    updated: updatedCount,
    skipped: skippedCount,
    message: runSnap.exists
      ? `Dagens kort er opdateret (${createdCount} nye, ${updatedCount} opdateret, ${skippedCount} uændret).`
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

  // Additional fallback: try routineType/canonicalTaskKey
  if (!taskSnap.exists && data?.routineKey && taskDateKeyHint) {
    const routineKey = sanitizeString(data.routineKey, 120);
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
    lastEntryStatus: entryStatus,
    documented: true,
    lastEntryAt: FieldValue.serverTimestamp(),
    entryCount: FieldValue.increment(1),
    activeUntilDateKey,
    lastCompletedBy: completedBy,
    lastCompletedByName: completedByName,
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
    entryStatus,
    instanceStatus: "active",
    activeUntilDateKey
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

// ─── BILLING PLANS REGISTER ──────────────────────────────────────────────────

const BILLING_PLANS = {
  monthly: {
    code: "monthly",
    label: "Månedsabonnement",
    interval: "month",
    intervalCount: 1,
    exVatOre: 14900,
    vatRate: 0.25,
    inclVatOre: 18625
  },
  yearly: {
    code: "yearly",
    label: "Årsabonnement (Spar 10%)",
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

// ─── CANONICAL COMPANY ID (STABLE SLUG-BASED) ───────────────────────────────
// VIGTIGT: companyId må IKKE bruge Date.now() (ikke stabil ved re-runs)
// VIGTIGT: companyId må IKKE kun bruge slug (collision mellem virksomheder med samme navn)
// LØSNING: slug + CVR (hvis findes) eller slug + hash (fallback for uniqueness)

function buildCanonicalCompanyId(input) {
  const crypto = require("crypto");
  
  const slug = (input.companyName || "company")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const cleanCvr = String(input.cvr || "").replace(/\D/g, "");

  // Path 1: CVR findes → slug + CVR (garanteret unik)
  if (/^\d{8}$/.test(cleanCvr)) {
    return `onboarding_${slug}_${cleanCvr}`;
  }

  // Path 2: Ingen CVR → slug + stabil hash baseret på fallback-seed
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

// ─── COMPANY KEY (DEDUPLICATION) ─────────────────────────────────────────────

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

// ─── CREATE OR GET COMPANY (TRANSACTION) ─────────────────────────────────────

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

// ─── ONBOARDING CHECKOUT SESSION ────────────────────────────────────────────

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

  // STEP 1: Read and validate billingPlan from frontend
  const normalizedBillingPlan = String(data.billingPlan || "monthly").toLowerCase();
  const selectedStripePriceId = normalizedBillingPlan === "yearly"
    ? stripeConfig.priceYearly
    : stripeConfig.priceMonthly;

  console.log("[createOnboardingCheckoutSession] Selected billing plan:", normalizedBillingPlan);
  console.log("[createOnboardingCheckoutSession] Selected price ID:", selectedStripePriceId);

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

  const sourceType = sanitizeString(data?.source || "onboarding_checkout", 60);

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
      displayBusinessName: sanitizeString(config?.displayBusinessName || config?.businessName || "", 140),
      subdomain,
      city: sanitizeString(config?.city || "", 80),
      cityName: sanitizeString(config?.cityName || config?.city || "", 80),
      displayCityName: sanitizeString(config?.displayCityName || config?.cityName || config?.city || "", 80),
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
        pageType:      sanitizeString(p?.pageType || "", 80),
        slug:          sanitizeString(p?.slug || "", 180),
        routePath:     sanitizeString(p?.routePath || "", 220),
        canonicalPath: sanitizeString(p?.canonicalPath || "", 220),
        outputPath:    sanitizeString(p?.outputPath || "", 260),
        citySlug:      sanitizeString(p?.citySlug || "", 100),
        businessSlug:  sanitizeString(p?.businessSlug || "", 120),
        cityName:      sanitizeString(p?.cityName || "", 120),
        displayCityName: sanitizeString(p?.displayCityName || "", 120),
        businessName:  sanitizeString(p?.businessName || "", 160),
        displayBusinessName: sanitizeString(p?.displayBusinessName || "", 160),
        keyword:       sanitizeString(p?.keyword || "", 140),
        title:         sanitizeString(p?.title || "", 220),
        h1:            sanitizeString(p?.h1 || "", 220),
        h2:            sanitizeString(p?.h2 || "", 220),
        h3:            sanitizeString(p?.h3 || "", 220),
        metaDescription: sanitizeString(p?.metaDescription || "", 320),
        bodyText:      sanitizeString(p?.bodyText || "", 1200),
        content:       sanitizeString(p?.content || "", 1200)
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
    subdomain: result.subdomain,
    liveUrl: `https://${result.businessSlug || result.subdomain}.madkontrollen.dk/`,
    cacheInvalidation: result.cacheInvalidation
  };
});

function normalizeSeoActivationData(data) {
  if (data?.data && typeof data.data === "object") {
    return data.data;
  }
  return data && typeof data === "object" ? data : {};
}

async function resolveSeoActivationAuth(data, context) {
  const payload = normalizeSeoActivationData(data);
  console.log("SEO LOG auth-start");
  console.log(`SEO LOG context-auth-present ${Boolean(context.auth?.uid)}`);
  const bearer = String(context.rawRequest?.headers?.authorization || "").trim();
  const bearerToken = bearer.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : "";
  const payloadToken = String(payload?.authToken || payload?.idToken || "").trim();
  const idToken = payloadToken || bearerToken;
  console.log(`SEO LOG fallback-token-present ${Boolean(idToken)}`);

  const contextUid = sanitizeString(context.auth?.uid || "", 160);
  if (contextUid) {
    return {
      uid: contextUid,
      email: sanitizeString(context.auth?.token?.email || "", 180),
      source: "callable-context"
    };
  }

  if (!idToken) {
    return { uid: "", email: "", source: "", reason: "token_missing" };
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = sanitizeString(decoded.uid || "", 160);
    console.log(`SEO LOG fallback-token-verified uid=${uid}`);
    return {
      uid,
      email: sanitizeString(decoded.email || "", 180),
      source: payloadToken ? "payload-token" : "authorization-header"
    };
  } catch (error) {
    console.log("SEO LOG access-result ok=false reason=token_verify_failed");
    return { uid: "", email: "", source: "invalid-token", reason: "token_verify_failed" };
  }
}

async function assertSeoPublishAccessWithLogs({ uid, email, companyId, locationId }) {
  try {
    const userData = await getUserAccessProfile({ uid, email });
    if (!userData) {
      console.log("SEO LOG profile-loaded role=");
      console.log("SEO LOG access-result ok=false reason=access_denied");
      throw new functions.https.HttpsError("permission-denied", "access_denied");
    }

    const role = sanitizeString(userData.role || "", 80).toLowerCase();
    console.log(`SEO LOG profile-loaded role=${role}`);

    const allowedRoles = ["owner", "hq_admin", "location_manager", "admin", "super-admin"];
    if (!allowedRoles.includes(role)) {
      console.log("SEO LOG access-result ok=false reason=access_denied");
      throw new functions.https.HttpsError("permission-denied", "access_denied");
    }

    if (role === "super-admin") {
      console.log("SEO LOG access-result ok=true reason=super_admin");
      return;
    }

    const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 120);
    if (!userCompanyId || userCompanyId !== companyId) {
      console.log("SEO LOG access-result ok=false reason=access_denied");
      throw new functions.https.HttpsError("permission-denied", "access_denied");
    }

    const locationIds = getUserLocationIds(userData);
    if (locationIds.length > 0 && !locationIds.includes(locationId)) {
      console.log("SEO LOG access-result ok=false reason=access_denied");
      throw new functions.https.HttpsError("permission-denied", "access_denied");
    }

    console.log("SEO LOG access-result ok=true reason=role_scope_ok");
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.log("SEO LOG access-result ok=false reason=access_denied");
    throw new functions.https.HttpsError("permission-denied", "access_denied");
  }
}

exports.adminActivateSeoSite = functions.https.onCall(async (data, context) => {
  const payload = normalizeSeoActivationData(data);
  const publishAuth = await resolveSeoActivationAuth(data, context);
  if (!publishAuth.uid) {
    const reason = publishAuth.reason === "token_verify_failed" ? "token_verify_failed" : "token_missing";
    if (reason === "token_missing") {
      console.log("SEO LOG access-result ok=false reason=token_missing");
    }
    throw new functions.https.HttpsError("unauthenticated", reason);
  }
  const companyId  = sanitizeString(payload?.companyId  || "", 120);
  const locationId = sanitizeString(payload?.locationId || "", 120);
  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
  }
  await assertSeoPublishAccessWithLogs({ uid: publishAuth.uid, email: publishAuth.email, companyId, locationId });

  // Use provided inline config or load saved config from Firestore
  let baseConfig = {};
  const overrides = payload?.overrides && typeof payload.overrides === "object"
    ? payload.overrides
    : (payload?.config && typeof payload.config === "object" ? payload.config : {});
  if (payload?.configId) {
    const configId = sanitizeString(payload?.configId || "", 180);
    if (!configId) throw new functions.https.HttpsError("invalid-argument", "config eller configId er påkrævet.");
    const snap = await db.collection("seo_generator_configs").doc(configId).get();
    if (!snap.exists) throw new functions.https.HttpsError("not-found", "Generator-konfiguration ikke fundet.");
    baseConfig = snap.data() || {};
  }

  const config = await buildSeoPublishConfigFromFirestore({
    companyId,
    locationId,
    baseConfig,
    overrides
  });

  const result = await upsertWebsiteAndSeoPages({ companyId, locationId, config, activatedByUid: publishAuth.uid });

  // Mark SEO addon as active on the company location
  await db.collection("company_locations").doc(`${companyId}__${locationId}`).set({
    addons: { seo: true },
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true }).catch(() => {});

  return {
    ok: true,
    websiteId: result.websiteId,
    generatedPages: result.generatedPages,
    subdomain: result.subdomain,
    cacheInvalidation: result.cacheInvalidation
  };
});

// ── SEO SITE RENDERER ────────────────────────────────────────────────────────
// HTTP function — serves *.madkontrollen.dk subdomains as real HTML pages
// Map *.madkontrollen.dk → this function via Google Cloud Run custom domains
exports.seoSiteRenderer = functions.https.onRequest(async (req, res) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");

  const host = (req.headers.host || "").toLowerCase().split(":")[0];
  const match = host.match(/^([a-z0-9-]+)\.madkontrollen\.dk$/);
  if (!match) {
    res.status(400).send("Ugyldigt domæne.");
    return;
  }
  const subdomain = sanitizeString(match[1], 120);
  const requestPath = (req.path || "/").replace(/^\//,"").replace(/\/$/,"") || "";
  const pathParts = requestPath.split("/").filter(Boolean);

  let websiteDoc = null;
  let websiteDocId = null;
  try {
    let snap = null;

    if (pathParts[0]) {
      snap = await db.collection("websites")
        .where("citySlug", "==", subdomain)
        .where("businessSlug", "==", pathParts[0])
        .where("status", "==", "published")
        .limit(1)
        .get();
    }

    if (!snap || snap.empty) {
      snap = await db.collection("websites")
        .where("subdomain", "==", subdomain)
        .where("status", "==", "published")
        .limit(1)
        .get();
    }

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

  const slugPath = requestPath || String(websiteDoc.routePath || "").replace(/^\//,"").replace(/\/$/,"") || "";
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
<link rel="canonical" href="${esc(page?.canonicalPath ? `https://madkontrollen.dk${page.canonicalPath}` : `https://madkontrollen.dk/${slug}/`)}">
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
        <a href="/index.html" class="hero-btn hero-btn--primary">Gå til forsiden</a>
        <a href="/index.html#menu" class="hero-btn hero-btn--secondary">Se menu</a>
        ${phone ? `<a href="tel:${phone}" class="hero-btn hero-btn--ghost">Ring nu</a>` : ""}
        ${externalWebsite ? `<a href="${externalWebsite}" class="hero-btn hero-btn--ghost" target="_blank" rel="noopener">Besøg vores hjemmeside</a>` : ""}
      </div>
    </div>
  </div>
  <div class="content">${sectionsHtml}</div>
  <footer class="footer">
    <div class="footer-info">
      <p><strong>${companyName}</strong></p>
      <p>${address}</p>
      <p>Telefon: ${phone}</p>
      <p style="margin-top:20px;"><a href="/index.html" style="color:#fff;text-decoration:underline;">← Tilbage til forsiden</a></p>
      ${externalWebsite ? `<p><a href="${externalWebsite}" target="_blank" rel="noopener" style="color:#fff;text-decoration:underline;">Besøg vores hjemmeside →</a></p>` : ""}
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

// ─── PROVISION RISK ANALYSIS SNAPSHOT ────────────────────────────────────────
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
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
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

// ─── CREATE QUICK ONBOARDING ACCOUNT ─────────────────────────────────────────
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
  
  console.log("[createQuickOnboardingAccount] parsed:", {
    hasEmail: !!email,
    hasPassword: !!password,
    hasCompanyName: !!companyName,
    hasAddress: !!address,
    hasPhone: !!phone,
    industry
  });
  
  // Validate input
  if (!email || !password || !companyName) {
    throw new HttpsError("invalid-argument", "Email, password og firmanavn er påkrævet.");
  }
  
  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "Kodeordet skal være mindst 6 tegn.");
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
    
    // Step 4: Create company document
    console.log("[createQuickOnboardingAccount] STEP 3: Creating company...");
    try {
      await db.collection("companies").doc(companyId).set({
      id: companyId,
      name: companyName,
      companyName: companyName,
      organizationId: companyId,
      ownerUid: uid,
      address: address,
      postalCode: postalCode,
      city: city,
      phone: phone,
      status: "trial",
      subscriptionStatus: "trial",
      isPaid: false,
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
      role: "owner",
      onboardingCompleted: false,
      trialStartedAt: FieldValue.serverTimestamp(),
      trialEndsAt: trialEndsAt,
      isPaid: false,
      subscriptionStatus: "trial",
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
      role: "owner",
      
      profile: {
        // KRITISK FELTER (primære)
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
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
      console.log("[createQuickOnboardingAccount] STEP 6: SUCCESS");
    } catch (profileError) {
      console.error("[createQuickOnboardingAccount] STEP 6 FAILED:", profileError);
      throw new HttpsError("internal", `Live profile creation failed: ${profileError.message}`);
    }
    
    // Step 7: Complete onboarding with equipment and routines
    console.log("[createQuickOnboardingAccount] STEP 7: Completing onboarding with setup...");
    let onboardingResult = null;
    try {
      const {
        normalizeQuickOnboardingSetup,
        resolveCanonicalRoutineKeysFromSetup,
        buildEquipmentFromSetup
      } = require("./js/setupToCanonicalRoutines");
      
      // Normalize setup from payload
      const setup = normalizeQuickOnboardingSetup(payload.setup || { industry });
      console.log("[createQuickOnboardingAccount] Setup normalized:", setup);
      
      // Resolve routine keys from setup (STRICT MODE - only selected routines)
      const routineKeys = resolveCanonicalRoutineKeysFromSetup(setup);
      console.log("[createQuickOnboardingAccount] Routine keys from setup:", routineKeys);
      
      // Build and save equipment
      const equipmentUnits = buildEquipmentFromSetup(setup, {
        companyId,
        locationId,
        userId: uid
      });
      
      for (const unit of equipmentUnits) {
        await db.collection("equipment").doc(unit.id).set(unit);
      }
      console.log("[createQuickOnboardingAccount] Equipment created:", equipmentUnits.length);
      
      // Generate templates (FILTERED by routineKeys)
      const templatesResult = await generateCanonicalTaskTemplates({
        db,
        companyId,
        locationId,
        routineKeys
      });
      console.log("[createQuickOnboardingAccount] Templates generated:", templatesResult);
      
      // Generate instances for today (FILTERED by routineKeys)
      const todayDateKey = new Date().toISOString().slice(0, 10);
      const instancesResult = await startDayForLocationCanonical({
        db,
        companyId,
        locationId,
        dateKey: todayDateKey,
        createdBy: uid,
        routineKeys
      });
      console.log("[createQuickOnboardingAccount] Instances generated:", instancesResult);
      
      onboardingResult = {
        equipmentCount: equipmentUnits.length,
        templatesCount: templatesResult.created + templatesResult.updated,
        instancesCount: instancesResult.instancesCreated,
        routineKeys
      };
      
      console.log("[createQuickOnboardingAccount] STEP 7: SUCCESS", onboardingResult);
    } catch (onboardingError) {
      console.error("[createQuickOnboardingAccount] STEP 7 FAILED (non-critical):", onboardingError.message);
      // Don't throw - onboarding setup is non-critical for account creation
    }
    
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

// ─── COMPLETE QUICK ONBOARDING ───────────────────────────────────────────────
// Complete quick onboarding with setup-based equipment and routines
exports.completeQuickOnboarding = onCall({ region: "us-central1" }, async (request) => {
  const {
    normalizeQuickOnboardingSetup,
    resolveCanonicalRoutineKeysFromSetup,
    buildEquipmentFromSetup
  } = require("./js/setupToCanonicalRoutines");
  
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Du skal være logget ind.");
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
      throw new HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
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
    });
    console.log("[completeQuickOnboarding] Equipment units:", equipmentUnits.length);
    
    // Save equipment to Firestore
    for (const unit of equipmentUnits) {
      await db.collection("equipment").doc(unit.id).set(unit);
    }
    console.log("[completeQuickOnboarding] Equipment saved");
    
    // Generate canonical templates (FILTERED by routineKeys)
    const templatesResult = await generateCanonicalTaskTemplates({
      db,
      companyId,
      locationId,
      routineKeys
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
      routineKeys
    });
    console.log("[completeQuickOnboarding] Instances generated:", instancesResult);
    
    // Update company with setup
    await db.collection("companies").doc(companyId).update({
      quickOnboardingSetup: setup,
      quickOnboardingCompletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    // Update location with setup
    await db.collection("locations").doc(locationId).update({
      quickOnboardingSetup: setup,
      quickOnboardingCompletedAt: FieldValue.serverTimestamp(),
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
    
    throw new HttpsError("internal", `Kunne ikke færdiggøre onboarding: ${error.message}`);
  }
});

// ─── PROVISION QUICK ONBOARDING ACCOUNT ──────────────────────────────────────
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
    throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind.");
  }
  
  if (context.auth.uid !== uid) {
    throw new functions.https.HttpsError("permission-denied", "UID matcher ikke.");
  }
  
  if (!email || !companyName) {
    throw new functions.https.HttpsError("invalid-argument", "Email og firmanavn er påkrævet.");
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
    
    console.log("[provisionQuickOnboardingAccount] Creating company:", companyId);
    
    // Create company document
    await db.collection("companies").doc(companyId).set({
      id: companyId,
      name: companyName,
      companyName: companyName,
      organizationId: companyId,
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
  const billingPlan = sanitizeString(checkoutSession?.metadata?.plan || "monthly", 40);
  
  console.log("[FINALIZE] Billing plan from metadata:", billingPlan);

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
    console.log(`⚠️ Onboarding already provisioned for ${companyId}__${locationId}, but checking risk analysis...`);
    
    // Check if risk analysis exists, if not generate it
    const profile = sanitizeOnboardingProfile(draft.profile || draft.company || {});
    const riskRef = db.collection("companies").doc(companyId).collection("locations").doc(locationId).collection("risk_analysis").doc("current");
    const riskSnap = await riskRef.get();
    
    if (!riskSnap.exists) {
      console.log('🔍 Risk analysis missing, generating now...');
      try {
        const { buildStructuredHaccpData } = require('./provisioning');
        const controlPoints = buildStructuredHaccpData(profile);
        
        await riskRef.set({
          status: "generated",
          onboardingSnapshot: profile,
          controlPoints: controlPoints,
          totalControlPoints: controlPoints.length,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log(`✅ Risk analysis generated: ${controlPoints.length} control points`);
      } catch (riskError) {
        console.error('❌ Risk analysis generation failed:', riskError);
      }
    } else {
      console.log('✅ Risk analysis already exists');
    }
    
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
  const profile = sanitizeOnboardingProfile(draft.profile || draft.company || {});
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

  // FJERNET: generateAndSaveEgenkontrolProgram (skriver til egenkontrol_programs, læses ikke af startDay)
  // FJERNET: buildStructuredHaccpData / companies/{id}/locations/... (isoleret, læses ingensteds)

  const onboardingAnswersId = await upsertOnboardingAnswersDocument({
    companyId,
    locationId,
    userId: actorUserId,
    liveProfilePayload
  });

  // ─── PIPELINE: onboarding_answers → risks → task_templates ───────────────
  // Steg 1: Skriv risks fra onboarding (processer → CCP/GAG regler)
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

  // Materialiser equipment counts til konkrete equipment docs
  try {
    await syncOnboardingEquipmentUnits({
      db,
      companyId,
      locationId,
      equipmentCounts: liveProfilePayload.onboardingAnswers?.equipmentCounts || {},
      profile
    });
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
    await syncEquipmentCleaningTemplates({ db, companyId, locationId });
  } catch (cleanErr) {
    console.error("[finalizeOnboardingCheckoutProvisioning] syncEquipmentCleaningTemplates failed:", cleanErr.message);
  }

  // Sync equipment-based maintenance task templates
  try {
    await syncEquipmentMaintenanceTemplates({ db, companyId, locationId });
  } catch (maintErr) {
    console.error("[finalizeOnboardingCheckoutProvisioning] syncEquipmentMaintenanceTemplates failed:", maintErr.message);
  }

  // Sync area-based cleaning task templates
  try {
    await syncAreaCleaningTemplates({ db, companyId, locationId });
  } catch (areaErr) {
    console.error("[finalizeOnboardingCheckoutProvisioning] syncAreaCleaningTemplates failed:", areaErr.message);
  }

  // Sync process-based drift task templates
  try {
    await syncProcessDriftTemplates({ db, companyId, locationId });
  } catch (driftErr) {
    console.error("[finalizeOnboardingCheckoutProvisioning] syncProcessDriftTemplates failed:", driftErr.message);
  }

  // Sync water control task templates
  try {
    await syncWaterControlTemplates({ db, companyId, locationId });
  } catch (waterErr) {
    console.error("[finalizeOnboardingCheckoutProvisioning] syncWaterControlTemplates failed:", waterErr.message);
  }

  await db.collection("live_user_profiles").doc(liveProfileId).set({
    ...liveProfilePayload,
    haccpSnapshotId: snapshotId,
    onboardingAnswersId,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  // FJERNET: ensureLiveTaskTemplatesForProvisioning — genererede scenario_based_haccp templates
  // som startDayForLocation eksplicit filtreréde væk. Erstattet af risks-pipeline ovenfor.

  let finalUserId = authUid;

  // If user is not logged in, create a new Firebase Auth user and Firestore user document
  if (!authUid && profile.accountEmail && profile.accountPassword) {
    const email = sanitizeString(profile.accountEmail, 160).toLowerCase();
    const password = String(profile.accountPassword || "").trim();
    const displayName = sanitizeString(profile.ownerName || profile.companyName || "Ejer", 120);

    console.log(`🔐 User creation attempt - Email: ${email}, Password length: ${password.length}, DisplayName: ${displayName}`);

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
    address: sanitizeString(profile.address || "", 220) || null,
    zip: sanitizeString(profile.zip || "", 40) || null,
    city: sanitizeString(profile.city || "", 120) || null,
    status: "active",
    subscription: {
      plan: billingPlan,
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
    name: locationDisplayName,
    displayName: locationDisplayName,
    address: sanitizeString(profile.address || "", 220) || null,
    zip: sanitizeString(profile.zip || "", 40) || null,
    city: sanitizeString(profile.city || "", 120) || null,
    status: "active",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  
  console.log("[FINALIZE] Company status updated to active with subscription:", billingPlan);

  await draftRef.set({
    summary,
    cloudinaryAssets,
    liveProfileId,
    onboardingAnswersId,
    snapshotId,
    stripeSessionId: sessionId,
    billingPlan,
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
    taskTemplateCount: 0,
    dashboardUrl: "/dashboard#haccp-print-section",
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
  try { config = JSON.parse(process.env.FUNCTIONS_CONFIG_EXPORT || "{}"); } catch (_) {}

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
    "Skriv kort, professionelt og juridisk egnet på dansk.",
    "Vurder kun det, der kan ses i billedet.",
    "Undgå gæt om usynlige forhold.",
    "FOKUS: Koncentrér dig om det primære objekt/område i billedet – ignorer rod, kaos eller støj i baggrunden medmindre det er en direkte hygiejnerisiko.",
    "PROAKTIV SCANNING: Selv hvis du ikke er blevet bedt specifikt om det, skal du ALTID råbe op med '[AFVIGELSE]' hvis du ser: åbne beholdere uden låg, redskaber (skeer, knive, sleev) placeret direkte i madvarer, udækkede råvarer, spild eller dryp på hylder, datostempler der er overskredet, eller lignende konkrete hygiejnerisici. Forklar præcist hvad der skal gøres.",
    "AI maa kun give et forslag til manuel vurdering. AI maa aldrig afgoere eller oprette en afvigelse alene.",
    "Skriv IKKE '[AFVIGELSE]' som kommando. Brug i stedet severity, confidenceScore og suggestedIssue til at beskrive mulig risiko.",
    "Hvis du ser mulig hygiejnerisiko, formuler det som et manuelt forslag brugeren skal bekraefte.",
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

  // ADSKILLELSE / SEPARATION
  if (categoryLower.includes("adskillelse") || categoryLower.includes("separation") || categoryLower.includes("kryds") || scopedItemLower.includes("adskillelse") || scopedItemLower.includes("separation") || scopedItemLower.includes("kryds")) {
    return [
      "Du er en HACCP-inspektør. Analysér dette billede med fokus på ADSKILLELSE af råvarer og kryds-kontaminationsrisiko.",
      `Opgave: ${scopedItem}.`,
      "Tjek SPECIFIKT:",
      "1. FARVEKODER: Bruges de rigtige farver til skærebrætter/knive (rød=råt kød, gul=fjerkræ, grøn=grønt, blå=fisk, hvid=mejeriprodukter)?",
      "2. ADSKILLELSE: Er råt kød/fisk adskilt fra tilberedte varer med fysisk afstand, separat emballage, eller skillevæg?",
      "3. OPBEVARINGSHØJDE: Er råt kød/fisk placeret UNDER tilberedte varer (ikke over)?",
      "4. KONTAMINATIONSRISIKO: Er der dryp, spild, eller uhygiejnisk kontakt mellem produkttyper?",
      "Hvis du finder ADSKILLELSESPROBLEM: Start med '[AFVIGELSE]' og forklar risikoen (kryds-kontaminering = alvorlig Salmonella/E.coli-risiko).",
      "Hvis adskillelsen er korrekt: Bekræft med kort professionel beskrivelse.",
      commonRules,
      "Brug kategori: egenkontrol."
    ].join(" ");
  }

  // TEMPERATUR KONTROL
  if (categoryLower.includes("temperatur") || categoryLower.includes("køl") || categoryLower.includes("frost") || categoryLower.includes("varmt") || categoryLower.includes("varmhold") || scopedItemLower.includes("temp") || scopedItemLower.includes("køl") || scopedItemLower.includes("frost") || scopedItemLower.includes("°c")) {
    return [
      "Du er en HACCP-temperaturekspert. Analysér dette billede med FOKUS PÅ TEMPERATUR.",
      `Udstyr/opgave: ${scopedItem}.`,
      "Hvis du ser et DISPLAY eller TERMOMETER:",
      "- Aflæs temperaturen med PRÆCISION (f.eks. '-18.2°C' eller '+4.1°C').",
      "- Returner tallet med fortegn i temperature_value (f.eks. -18.2 eller 4.1).",
      "- GRÆNSEVÆRDIER: Køl ≤+5°C, Frost ≤-18°C, Varmholdelse ≥+65°C.",
      "- Er temperaturen INDEN FOR grænsen? → handling_udfort: true og bekræft.",
      "- Er temperaturen UDENFOR grænsen? → Start med '[AFVIGELSE]' og forklar risikoen (bakterievækst, HACCP-brud).",
      "Hvis du IKKE kan se temperaturen tydeligt: Angiv image_clarity: 'unclear'.",
      "Tjek også: Er udstyret lukket korrekt? Er der rim/is-dannelse (tegn på temperatursvingninger)?",
      commonRules,
      "Brug kategori: egenkontrol."
    ].join(" ");
  }

  // OPBEVARING / STORAGE
  if (categoryLower.includes("opbevaring") || categoryLower.includes("storage") || categoryLower.includes("lager") || categoryLower.includes("hylde") || scopedItemLower.includes("opbevaring") || scopedItemLower.includes("lager") || scopedItemLower.includes("hylde")) {
    return [
      "Du er en hygiejnekonsulent. Analysér dette billede med fokus på KORREKT OPBEVARING af fødevarer.",
      `Område/opgave: ${scopedItem}.`,
      "Tjek SPECIFIKT:",
      "1. ÅBNE BEHOLDERE: Er der beholdere, gryder, skåle eller pakker uden låg/dækning? En åben beholder = kontaminationsrisiko (hårhygiejne, insekter, luftbårne bakterier). Forklar hvad der mangler (låg, plastikfilm, dækkende emballage).",
      "2. REDSKABER I MAD: Er der en ske, slev, kniv eller andet redskab placeret DIREKTE I en madbeholder? Det er en hygiejnerisiko (kryds-kontaminering, bakterievækst på håndtaget). Råb op: forklar at redskabet skal fjernes og opbevares separat.",
      "3. EMBALLAGE: Er alle øvrige varer forsvarligt emballerede/dækkede?",
      "4. DATOSTEMPLING: Er varer mærket med åbningsdato/holdbarhed? Kan du se udløbsdatoer?",
      "5. RÆKKEFØLGE (FIFO): Er ældste varer placeret forrest (First In, First Out)?",
      "6. HYGIEJNE: Er hylder/enheder rene? Rester, spild eller kondensvand?",
      "7. ADSKILLELSE: Er råvarer og tilberedte varer adskilt korrekt (råt under, tilberedt over)?",
      "Hvis du finder OPBEVARINGSFEJL: Start med '[AFVIGELSE]' og forklar den konkrete risiko.",
      "Hvis opbevaringen er korrekt: Bekræft med kort professionel beskrivelse.",
      commonRules,
      "Brug kategori: egenkontrol."
    ].join(" ");
  }

  // MODTAGEKONTROL / VAREMODTAGELSE
  if (categoryLower.includes("modtagelse") || categoryLower.includes("levering") || categoryLower.includes("varemodtagelse") || scopedItemLower.includes("modtagelse") || scopedItemLower.includes("levering")) {
    return [
      "Du er en varekontrollør. Analysér dette billede med fokus på VAREMODTAGELSE.",
      `Ordre/vare: ${scopedItem}.`,
      "Tjek SPECIFIKT:",
      "1. TEMPERATUR: Er der synlig temperatur på mærkat eller thermometer? Kødvarer ≤+5°C, Fisk ≤+2°C, Frost ≤-18°C.",
      "2. EMBALLAGE: Er emballagen hel, ren og ubeskadiget (ingen huller, misfarvning, kondensation)?",
      "3. SYNLIGE FEJL: Misfarvning, lugtproblemer (skriv 'kan ikke vurdere lugt fra billede'), beskadigelse?",
      "4. MÆRKNING: Er produktet korrekt mærket (art, mængde, holdbarhed)?",
      "Hvis du finder FEJL ved modtagelsen: Start med '[AFVIGELSE]' – varen skal AFVISES og returneres til leverandøren.",
      "Hvis varen er OK: Bekræft med 'Vare godkendt til modtagelse' og noter relevante observationer.",
      commonRules,
      "Brug kategori: egenkontrol."
    ].join(" ");
  }

  // RENGØRING / CLEANING
  if (categoryLower.includes("rengøring") || categoryLower.includes("rengoring") || categoryLower.includes("cleaning") || categoryLower.includes("hygiejne") || scopedItemLower.includes("rengør") || scopedItemLower.includes("rengor")) {
    return [
      "Du er en hygiejneinspektør. Analysér dette billede med KRITISK blik på RENGØRINGSRESULTATET.",
      `Område/udstyr: ${scopedItem}.`,
      "LED SPECIFIKT EFTER:",
      "1. MADRESTER: Synlige rester af mad, fedt, eller organisk materiale?",
      "2. OVERFLADERENHED: Er overflader rent og fri for fedtfilm?",
      "3. HJØRNER OG SAMLINGER: Er hjørner, revner og samlinger rene (skjulesteder for bakterier)?",
      "4. DRIFTSSLID: Misfarvning i stål, patina og normalt slid er IKKE hygiejnerisiko – beskriv det som acceptabelt.",
      "Hvis du finder SYNLIG SNAVS eller MADRESTER: Start med '[AFVIGELSE]' og forklar risikoen.",
      "Hvis rengøringen er tilfredsstillende: Bekræft kort og professionelt.",
      commonRules,
      "Brug kategori: egenkontrol."
    ].join(" ");
  }
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
    "suggestedIssue: string|null (kort forslag til hvad brugeren manuelt bør kontrollere)",
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
    throw new HttpsError("internal", "Kunne ikke gennemføre billedanalyse.");
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
        ? "Utydeligt billede – prøv igen for korrekt dokumentation"
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

const OFFICIAL_RECALL_PAGE_URL = "https://foedevarestyrelsen.dk/nyheder/tilbagekaldte-produkter";
let officialRecallFeedCache = {
  expiresAt: 0,
  payload: null
};

function decodeXmlEntities(value = "") {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

function stripHtml(value = "") {
  return decodeXmlEntities(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function readXmlTag(xml = "", tag = "") {
  const match = String(xml || "").match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXmlEntities(match[1]).trim() : "";
}

function absolutizeUrl(url = "", baseUrl = OFFICIAL_RECALL_PAGE_URL) {
  try {
    return new URL(decodeXmlEntities(url), baseUrl).toString();
  } catch (_error) {
    return "";
  }
}

function parseRecallFeedItems(xml = "") {
  const source = String(xml || "");
  const blocks = [...source.matchAll(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi)].map(match => match[0]);
  const feedBlocks = blocks.length
    ? blocks
    : [...source.matchAll(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi)].map(match => match[0]);

  return feedBlocks.slice(0, 10).map((block, index) => {
    const title = stripHtml(readXmlTag(block, "title"));
    const summary = stripHtml(readXmlTag(block, "description") || readXmlTag(block, "summary") || readXmlTag(block, "content")).slice(0, 280);
    let link = readXmlTag(block, "link");
    if (!link) {
      const linkHref = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      link = linkHref ? linkHref[1] : "";
    }
    const publishedAt = readXmlTag(block, "pubDate") || readXmlTag(block, "published") || readXmlTag(block, "updated") || "";
    const guid = stripHtml(readXmlTag(block, "guid") || readXmlTag(block, "id") || "");
    const normalizedLink = absolutizeUrl(link);
    const id = sanitizeString(guid || normalizedLink || `${title}_${publishedAt}_${index}`, 500);
    return {
      id,
      title: sanitizeString(title, 240),
      summary: sanitizeString(summary, 500),
      link: sanitizeString(normalizedLink, 800),
      publishedAt: sanitizeString(publishedAt, 120)
    };
  }).filter(item => item.title && item.link);
}

function discoverRecallRssUrl(pageHtml = "") {
  const links = [...String(pageHtml || "").matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const [, href, label] of links) {
    const cleanLabel = stripHtml(label).toLowerCase();
    if (cleanLabel === "rss" || cleanLabel.includes("rss")) {
      return absolutizeUrl(href, OFFICIAL_RECALL_PAGE_URL);
    }
  }

  const relMatch = String(pageHtml || "").match(/<link\b[^>]*(?:type=["']application\/rss\+xml["']|rel=["']alternate["'])[^>]*href=["']([^"']+)["'][^>]*>/i);
  return relMatch ? absolutizeUrl(relMatch[1], OFFICIAL_RECALL_PAGE_URL) : "";
}

async function fetchOfficialRecallFeed() {
  const pageResp = await fetch(OFFICIAL_RECALL_PAGE_URL, {
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "User-Agent": "Madkontrollen/1.0 recall-feed"
    }
  });
  if (!pageResp.ok) {
    throw new Error(`Official recall page failed: ${pageResp.status}`);
  }

  const pageHtml = await pageResp.text();
  const feedUrl = discoverRecallRssUrl(pageHtml);
  if (!feedUrl) {
    throw new Error("Official RSS link was not found on recall page.");
  }

  const feedResp = await fetch(feedUrl, {
    headers: {
      "Accept": "application/rss+xml,application/xml,text/xml",
      "User-Agent": "Madkontrollen/1.0 recall-feed"
    }
  });
  if (!feedResp.ok) {
    throw new Error(`Official recall RSS failed: ${feedResp.status}`);
  }

  const xml = await feedResp.text();
  const items = parseRecallFeedItems(xml);
  return {
    ok: true,
    sourcePageUrl: OFFICIAL_RECALL_PAGE_URL,
    feedUrl,
    items,
    fetchedAt: new Date().toISOString(),
    cacheMaxAgeMinutes: 60
  };
}

exports.getOfficialRecallFeed = onCall(
  { region: "us-central1", timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Log ind for at hente tilbagekaldelser.");
    }

    const now = Date.now();
    if (officialRecallFeedCache.payload && officialRecallFeedCache.expiresAt > now) {
      return {
        ...officialRecallFeedCache.payload,
        fromCache: true
      };
    }

    try {
      const payload = await fetchOfficialRecallFeed();
      officialRecallFeedCache = {
        payload,
        expiresAt: now + (60 * 60 * 1000)
      };
      return {
        ...payload,
        fromCache: false
      };
    } catch (error) {
      console.warn("[official recall feed] failed", error?.message || error);
      return {
        ok: false,
        sourcePageUrl: OFFICIAL_RECALL_PAGE_URL,
        feedUrl: "",
        items: [],
        error: sanitizeString(error?.message || "Feed kunne ikke hentes.", 300),
        fetchedAt: new Date().toISOString(),
        cacheMaxAgeMinutes: 60,
        fromCache: false
      };
    }
  }
);

function buildRestaurantHeroImagePrompt(data) {
  const businessName = sanitizeString(data?.businessName || "restaurant", 120);
  const cuisineType = sanitizeString(data?.cuisineType || "restaurant", 100);
  const mood = sanitizeString(data?.mood || data?.style || "warm cinematic", 100);
  const offerings = sanitizeString(data?.offerings || "", 240);
  const description = sanitizeString(data?.description || "", 400);
  const primary = sanitizeString(data?.theme?.primary || "", 20);
  const secondary = sanitizeString(data?.theme?.secondary || "", 20);
  const accent = sanitizeString(data?.theme?.accent || "", 20);
  const hasLogo = Boolean(data?.logoDataUrl || data?.hasLogo);
  const brandLine = hasLogo
    ? `Use the uploaded logo and brand colors as a subtle style reference. Brand colors: ${[primary, secondary, accent].filter(Boolean).join(", ") || "from the uploaded logo"}.`
    : `Use brand colors when relevant: ${[primary, secondary, accent].filter(Boolean).join(", ") || "premium restaurant palette"}.`;
  const promptParts = [
    `Modern ${cuisineType} restaurant hero image for ${businessName}.`,
    offerings ? `Concept and menu cues: ${offerings}.` : "",
    description ? `Restaurant description: ${description}.` : "",
    `${mood} atmosphere, warm cinematic lighting, premium realistic food photography, Nordic restaurant marketing banner composition.`,
    brandLine,
    "Landscape 16:9 hero banner, appetizing food in foreground, tasteful restaurant ambience, no empty background, no stock-photo watermark, no readable text overlays."
  ].filter(Boolean);
  return promptParts.join(" ");
}

async function uploadRestaurantHeroToCloudinary({ file, companyId, locationId, config }) {
  const cloudName = config?.cloudinary?.cloud_name || process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = config?.cloudinary?.api_key || process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = config?.cloudinary?.api_secret || process.env.CLOUDINARY_API_SECRET || "";

  if (!cloudName || !apiKey || !apiSecret) {
    throw new HttpsError("failed-precondition", "Cloudinary er ikke konfigureret.");
  }

  const crypto = require("crypto");
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `madkontrol/${toAsciiSlug(companyId, 60)}/${toAsciiSlug(locationId, 60)}/seo_hero`;
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash("sha1").update(paramsToSign + apiSecret).digest("hex");
  const uploadParams = new URLSearchParams();
  uploadParams.append("file", file);
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
    throw new Error(`Cloudinary upload: ${uploadResp.status} - ${errText.slice(0, 200)}`);
  }

  const uploadResult = await uploadResp.json();
  return {
    cloudName,
    publicId: uploadResult.public_id || "",
    url: uploadResult.secure_url || ""
  };
}

exports.generateRestaurantHeroImage = onCall(
  { secrets: [OPENAI_API_KEY, "FUNCTIONS_CONFIG_EXPORT"], region: "us-central1", timeoutSeconds: 180 },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Log ind for at generere billede.");
    }

    const data = request.data || {};
    const companyId = sanitizeString(data?.companyId || "", 120);
    const locationId = sanitizeString(data?.locationId || "", 120);
    const style = sanitizeString(data?.style || "warm", 40);
    const category = sanitizeString(data?.category || "", 80);

    if (!companyId || !locationId) {
      throw new HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
    }

    let config = {};
    try { config = JSON.parse(process.env.FUNCTIONS_CONFIG_EXPORT || "{}"); } catch (_) {}
    const apiKey = OPENAI_API_KEY.value() || process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "OpenAI API-noegle mangler. Saet OPENAI_API_KEY som function secret.");
    }

    const prompt = sanitizeString(data?.prompt || buildRestaurantHeroImagePrompt(data), 1800);
    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: "1536x1024",
        quality: "medium",
        output_format: "jpeg",
        output_compression: 85
      })
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new HttpsError("internal", `AI image generation fejlede: ${resp.status}. ${errText.slice(0, 200)}`);
    }

    const imageData = await resp.json();
    const first = imageData?.data?.[0] || {};
    const generatedFile = first.b64_json
      ? `data:image/jpeg;base64,${first.b64_json}`
      : sanitizeString(first.url || "", 2000);

    if (!generatedFile) {
      throw new HttpsError("internal", "AI image generation returnerede ikke et billede.");
    }

    const uploaded = await uploadRestaurantHeroToCloudinary({ file: generatedFile, companyId, locationId, config });
    const docId = `${companyId}__${locationId}__hero_${Date.now()}`;
    await db.collection("seo_hero_images").doc(docId).set({
      companyId,
      locationId,
      url: uploaded.url,
      thumbUrl: uploaded.url,
      enhancedUrl: uploaded.url,
      category,
      style,
      source: "openai",
      sourceUrl: "",
      photographer: "OpenAI",
      photographerUrl: "",
      alt: sanitizeString(data?.alt || `${data?.businessName || "Restaurant"} hero image`, 200),
      prompt,
      publicId: uploaded.publicId,
      cloudName: uploaded.cloudName,
      enhanced: true,
      createdBy: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      isActive: true
    });

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
            heroImageUrl: uploaded.url,
            heroThumbUrl: uploaded.url,
            heroImageStyle: style,
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
        });
        await siteBatch.commit();
      }
    } catch (siteErr) {
      console.warn("[generateRestaurantHeroImage] Kunne ikke opdatere websites:", siteErr.message);
    }

    return { ok: true, docId, url: uploaded.url, enhancedUrl: uploaded.url, source: "openai", prompt };
  }
);

exports.searchRestaurantImages = onCall(
  { secrets: [PEXELS_API_KEY, "FUNCTIONS_CONFIG_EXPORT"], region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Log ind for at søge billeder.");
    }

    const data = request.data;
    const query = sanitizeString(data?.query || "", 200);
    const perPage = Math.min(Math.max(1, Number(data?.perPage) || 15), 24);

    if (!query) {
      throw new HttpsError("invalid-argument", "Søgeord mangler.");
    }

    let config = {};
    try { config = JSON.parse(process.env.FUNCTIONS_CONFIG_EXPORT || "{}"); } catch (_) {}
    const pexelsKey = config?.pexels?.api_key || PEXELS_API_KEY.value() || process.env.PEXELS_API_KEY || "";
    const cloudName = config?.cloudinary?.cloud_name || process.env.CLOUDINARY_CLOUD_NAME || "";

    if (!pexelsKey) {
      throw new HttpsError(
        "failed-precondition",
        "Pexels API nøgle ikke konfigureret. Kør: firebase functions:config:set pexels.api_key=\"DIN_NØGLE\" og redeploy."
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
      throw new HttpsError("invalid-argument", "companyId, locationId og url er påkrævet.");
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
      throw new HttpsError("invalid-argument", "url, companyId og locationId er påkrævet.");
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
        throw new Error(`Cloudinary upload: ${uploadResp.status} — ${errText.slice(0, 200)}`);
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
      throw new HttpsError("invalid-argument", "Mindst restaurantnavn eller køkkentype skal angives.");
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
        "OpenAI API-nøgle mangler. Sæt OPENAI_API_KEY som function secret."
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
                  "Du er en dansk SEO-ekspert specialiseret i lokal restaurant-SEO. Du returnerer ALTID valid JSON uden ekstra tekst. Hvis du er i tvivl, returnér {}."
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

    // 🔥 STABIL PARSING (det her var dit problem)
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

    // 🔥 FALLBACK (sikrer aldrig "no result")
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
    keyword ? `Nuværende søgeord: ${keyword}` : "",
    websiteContent ? `Website-indhold: ${websiteContent}` : ""
  ].filter(Boolean).join("\n");

  return `${parts}

Returner JSON med følgende struktur:
{
  "primaryKeyword": "primært lokalt søgeord (fx 'thai restaurant hvidovre')",
  "secondaryKeywords": ["sekundært søgeord 1", "sekundært søgeord 2", "sekundært søgeord 3"],
  "shortDescription": "kort beskrivelse 1-2 sætninger på dansk",
  "seoTitle": "SEO title tag inkl. restaurantnavn og by",
  "metaDescription": "meta description 150-160 tegn på dansk",
  "extractedWebsiteSummary": "kort opsummering af hvad du fandt på hjemmesiden (eller tom hvis ingen website)"
}

Fokuser på lokal SEO. Brug faktiske oplysninger. Skriv på dansk. Hvis website-indhold er tilgængeligt, brug det til at gøre forslagene mere præcise.`;
}

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
exports.createEgenkontrolProgramForLocation =
  egenkontrol.createEgenkontrolProgramForLocation({
    db,
    sanitizeString,
    getUserAccessProfile,
    assertSeoGeneratorAccess,
    sanitizeOnboardingProfile,
    sanitizeRiskModelInput
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
exports.closeDailyRun = closeDailyRun;

exports.cleanupTaskTemplates = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind.");
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
  }

  try {
    const templatesRef = db.collection("task_templates");
    const snapshot = await templatesRef
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .get();

    if (snapshot.empty) {
      return { deleted: 0, message: "Ingen templates fundet." };
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return {
      deleted: snapshot.size,
      message: `Slettet ${snapshot.size} task templates.`
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
      "CVR skal være 8 cifre."
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
  console.log("🔥 manualGenerateRiskAnalysis START");

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
        "companyId og locationId er påkrævet."
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

    console.log("📦 Loading buildStructuredHaccpData...");
    const { buildStructuredHaccpData } = require("./provisioning");

    if (!buildStructuredHaccpData) {
      throw new Error("buildStructuredHaccpData not found in provisioning module");
    }

    const controlPoints = buildStructuredHaccpData(profile);
    console.log(`📊 Generated ${controlPoints.length} control points`);

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

    console.log(`✅ Risk analysis saved: ${controlPoints.length} control points`);

    return {
      ok: true,
      companyId,
      locationId,
      totalControlPoints: controlPoints.length
    };
  } catch (error) {
    console.error("❌ manualGenerateRiskAnalysis FAILED:", error?.message);
    console.error("❌ stack:", error?.stack || null);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      "internal",
      error?.message || "manualGenerateRiskAnalysis crashed"
    );
  }
});

// ─── REGENERATE TASK TEMPLATES FOR LOCATION ───────────────────────────────
exports.regenerateTaskTemplatesForLocation = functions.https.onCall(async (request, context) => {
  try {
    const data = request.data || request;
    const authUid = context.auth?.uid;
    
    if (!authUid) {
      throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind.");
    }

    const companyId = sanitizeString(data?.companyId || "", 120);
    const locationId = sanitizeString(data?.locationId || "", 120);

    if (!companyId || !locationId) {
      throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
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

// ─── WATER MODULE ──────────────────────────────────────────────────────────
Object.assign(exports, require("./water-module"));

// ─── AUDIT TOOLS ───────────────────────────────────────────────────────────
const { auditCompanyLocationIntegrity } = require("./auditCompanyLocation");
exports.auditCompanyLocationIntegrity = auditCompanyLocationIntegrity;

// ─── ONBOARDING FIX ────────────────────────────────────────────────────────
const { fixOnboardingStructure } = require("./fixOnboardingStructure");
exports.fixOnboardingStructure = fixOnboardingStructure;

// ─── CANONICAL TASK ENGINE ─────────────────────────────────────────────────
const {
  generateCanonicalTaskTemplates,
  ensureSingleTaskInstance,
  startDayForLocationCanonical
} = require("./canonicalTaskEngine");

exports.generateCanonicalTaskTemplates = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind.");
  }
  
  const companyId = sanitizeString(data?.companyId, 120);
  const locationId = sanitizeString(data?.locationId, 120);
  
  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
  }
  
  const result = await generateCanonicalTaskTemplates({ db, companyId, locationId });
  
  return {
    ok: true,
    ...result
  };
});

// ─── CREATE DEMO ENVIRONMENT ───────────────────────────────────────────────
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
    
    await companyRef.set({
      id: companyId,
      companyId,
      organizationId: companyId,
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
    
    await locationRef.set({
      id: locationId,
      locationId,
      companyId,
      organizationId: companyId,
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
    });
    
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
      status: "active",
      isDemo: true,
      demoMode: true,
      demoExpiresAt: expiresAt,
      createdAt: nowTs,
      updatedAt: nowTs
    });
    
    // Create demo equipment units
    const equipmentUnits = [
      { id: "demo_fridge_1", name: "Køleskab 1", type: "fridge" },
      { id: "demo_freezer_1", name: "Fryser 1", type: "freezer" },
      { id: "demo_dishwasher_1", name: "Opvaskemaskine 1", type: "dishwasher" },
      { id: "demo_fryer_1", name: "Friture 1", type: "fryer" },
      { id: "demo_slicer_1", name: "Pålægsmaskine 1", type: "slicer" },
      { id: "demo_softice_1", name: "Softicemaskine 1", type: "softice_machine" },
      { id: "demo_walkin_cooler_1", name: "Walk-in køler", type: "walkin_cooler" },
      { id: "demo_walkin_freezer_1", name: "Walk-in fryser", type: "walkin_freezer" }
    ];
    
    for (const unit of equipmentUnits) {
      await db.collection("equipment").doc(unit.id).set({
        id: unit.id,
        equipmentId: unit.id,
        companyId,
        organizationId: companyId,
        locationId,
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
      locationId
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
      createdBy: userId
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

// ─── ADD MISSING PROCESSES TO ONBOARDING ────────────────────────────────────
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

// ─── CVR ENRICHMENT ──────────────────────────────────────────────────────────

exports.enrichNextCvrBatch = functions.https.onCall(async (request, context) => {
  const data = request.data || request;
  const auth = context.auth;

  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at berige CVR data");
  }

  const jobId = sanitizeString(data?.jobId || "", 120);
  const batchSize = Math.min(Math.max(parseInt(data?.batchSize) || 50, 1), 100);

  if (!jobId) {
    throw new functions.https.HttpsError("invalid-argument", "jobId er påkrævet");
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
      reject(new Error(`Netværksfejl: ${error.message}`));
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("CVR API timeout"));
    });

    req.end();
  });
}
