import { saveGeneratorConfig } from "./draft-publisher.js";

function trimString(value) {
  return String(value ?? "").trim();
}

function toAsciiSlug(value, maxLen = 120) {
  return trimString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
}

function unwrapCallablePayload(payload) {
  return payload?.data && typeof payload.data === "object" ? payload.data : payload;
}

function parsePageCount(value, fallback = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  if (rounded < 1) return 1;
  if (rounded > 300) return 300;
  return rounded;
}

function resolveDomain(config, options = {}) {
  const explicitDomain =
    trimString(config.domain) ||
    trimString(config.baseUrl) ||
    trimString(config.websiteUrl);
  if (explicitDomain) return explicitDomain;

  const baseDomain = trimString(options.baseDomain).replace(/^https?:\/\//i, "").replace(/\/+$/g, "");
  const subdomain = toAsciiSlug(config.subdomain || config.businessName || "");
  if (baseDomain && subdomain) {
    return `https://${subdomain}.${baseDomain}`;
  }

  return "";
}

function mapLandingPages(landingPages) {
  if (!Array.isArray(landingPages)) return [];
  return landingPages.slice(0, 200).map((page) => ({
    canonicalPath: trimString(page?.canonicalPath),
    keyword: trimString(page?.keyword),
    title: trimString(page?.title),
    h1: trimString(page?.h1),
    h2: trimString(page?.h2),
    h3: trimString(page?.h3),
    metaDescription: trimString(page?.metaDescription)
  }));
}

function mapSaveSeoGeneratorConfigPayload(payload, options = {}) {
  const source = unwrapCallablePayload(payload);
  if (!source || typeof source !== "object") {
    throw new TypeError("saveSeoGeneratorConfig payload must be an object.");
  }

  const companyId = trimString(source.companyId);
  const locationId = trimString(source.locationId);
  const config = source.config && typeof source.config === "object" ? source.config : {};
  const subdomain = toAsciiSlug(config.subdomain || config.businessName || "restaurant") || "restaurant";
  const configId = trimString(source.configId) || [companyId, locationId, subdomain].filter(Boolean).join("__");
  const domain = resolveDomain({ ...config, subdomain }, options);

  const missing = [];
  if (!companyId) missing.push("companyId");
  if (!locationId) missing.push("locationId");
  if (!domain) missing.push("domain");
  if (missing.length) {
    throw new Error(`saveSeoGeneratorConfig payload missing required field(s): ${missing.join(", ")}`);
  }

  const landingPages = mapLandingPages(config.landingPages);

  return {
    configId,
    tenantId: companyId,
    productId: locationId,
    domain,
    language: trimString(config.language) || trimString(options.defaultLanguage) || "da",
    country: trimString(config.country) || trimString(options.defaultCountry) || "DK",
    industry: trimString(config.industry || config.cuisineType),
    audience: trimString(config.audience),
    tone: trimString(config.tone),
    topics: landingPages.map((page) => page.keyword).filter(Boolean),
    blockedTopics: Array.isArray(config.blockedTopics) ? config.blockedTopics : [],
    publisher: "firestore-draft",
    requireHumanApproval: Boolean(config.requireHumanApproval),
    billingPlan: trimString(config.billingPlan),
    monthlyPageLimit: parsePageCount(config.pageCount, 50),
    channels: Array.isArray(config.channels) ? config.channels : ["website", "seo"],
    sourcePayloadType: "saveSeoGeneratorConfig",
    companyId,
    organizationId: companyId,
    locationId,
    businessName: trimString(config.businessName),
    subdomain,
    city: trimString(config.city),
    cuisineType: trimString(config.cuisineType),
    offerings: trimString(config.offerings),
    keyword: trimString(config.keyword),
    phone: trimString(config.phone),
    address: trimString(config.address),
    description: trimString(config.description),
    selectedTemplate: trimString(config.selectedTemplate) || "classic",
    pageCount: parsePageCount(config.pageCount, 50),
    logoPosition: trimString(config.logoPosition) || "card",
    logoDataUrl: trimString(config.logoDataUrl),
    seoNarrative: trimString(config.seoNarrative),
    heroImageUrl: trimString(config.heroImageUrl),
    ctaText: trimString(config.ctaText),
    ctaUrl: trimString(config.ctaUrl),
    landingPages
  };
}

async function saveSeoGeneratorConfigDraft(db, payload, options = {}) {
  const mapped = mapSaveSeoGeneratorConfigPayload(payload, options);
  return saveGeneratorConfig(db, mapped);
}

export {
  mapSaveSeoGeneratorConfigPayload,
  saveSeoGeneratorConfigDraft
};
