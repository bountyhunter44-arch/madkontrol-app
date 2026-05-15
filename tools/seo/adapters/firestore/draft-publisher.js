const SEO_PAGES_COLLECTION = "seo_pages";
const SEO_GENERATOR_CONFIGS_COLLECTION = "seo_generator_configs";

function requireDb(db) {
  if (!db || typeof db.collection !== "function") {
    throw new TypeError("Firestore draft publisher requires a db with collection(name).");
  }
}

function trimString(value) {
  return String(value ?? "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function assertRequiredFields(value, fields, label) {
  const missing = fields.filter((field) => !trimString(value[field]));
  if (missing.length) {
    throw new Error(`${label} missing required field(s): ${missing.join(", ")}`);
  }
}

function pageRef(db, pageId) {
  return db.collection(SEO_PAGES_COLLECTION).doc(pageId);
}

function configRef(db, configId) {
  return db.collection(SEO_GENERATOR_CONFIGS_COLLECTION).doc(configId);
}

function normalizeDraftSeoPage(page) {
  assertPlainObject(page, "SEO page");
  assertRequiredFields(
    page,
    ["pageId", "tenantId", "slug", "title", "metaDescription", "h1"],
    "SEO page"
  );

  const timestamp = nowIso();
  return {
    ...page,
    pageId: trimString(page.pageId),
    tenantId: trimString(page.tenantId),
    slug: trimString(page.slug).replace(/^\/+|\/+$/g, ""),
    title: trimString(page.title),
    metaDescription: trimString(page.metaDescription),
    h1: trimString(page.h1),
    sections: Array.isArray(page.sections) ? page.sections : [],
    faq: Array.isArray(page.faq) ? page.faq : [],
    schema: Array.isArray(page.schema) ? page.schema : [],
    images: Array.isArray(page.images) ? page.images : [],
    status: trimString(page.status) || "draft",
    createdAt: page.createdAt || timestamp,
    updatedAt: timestamp,
    publishedAt: page.publishedAt || null
  };
}

function resolveGeneratorConfigId(config) {
  return (
    trimString(config.configId) ||
    trimString(config.id) ||
    [config.tenantId, config.productId || "seo", config.domain]
      .map((part) => trimString(part).replace(/[^a-zA-Z0-9_-]+/g, "_"))
      .filter(Boolean)
      .join("__")
  );
}

function normalizeGeneratorConfig(config) {
  assertPlainObject(config, "Generator config");
  assertRequiredFields(config, ["tenantId", "domain", "language", "country"], "Generator config");

  const timestamp = nowIso();
  const configId = resolveGeneratorConfigId(config);
  if (!configId) {
    throw new Error("Generator config missing required field(s): configId");
  }

  return {
    ...config,
    configId,
    tenantId: trimString(config.tenantId),
    productId: trimString(config.productId),
    domain: trimString(config.domain),
    language: trimString(config.language),
    country: trimString(config.country),
    topics: Array.isArray(config.topics) ? config.topics : [],
    blockedTopics: Array.isArray(config.blockedTopics) ? config.blockedTopics : [],
    publisher: trimString(config.publisher) || "firestore-draft",
    requireHumanApproval: Boolean(config.requireHumanApproval),
    channels: Array.isArray(config.channels) ? config.channels : [],
    createdAt: config.createdAt || timestamp,
    updatedAt: timestamp
  };
}

async function saveDraftSeoPage(db, page) {
  requireDb(db);
  const payload = normalizeDraftSeoPage(page);
  await pageRef(db, payload.pageId).set(payload, { merge: true });
  return payload;
}

async function updateDraftSeoPage(db, pageId, patch) {
  requireDb(db);
  const normalizedPageId = trimString(pageId);
  if (!normalizedPageId) {
    throw new Error("SEO page update missing required field(s): pageId");
  }
  assertPlainObject(patch, "SEO page patch");

  const payload = {
    ...patch,
    pageId: normalizedPageId,
    updatedAt: nowIso()
  };
  await pageRef(db, normalizedPageId).set(payload, { merge: true });
  return payload;
}

async function getDraftSeoPage(db, pageId) {
  requireDb(db);
  const normalizedPageId = trimString(pageId);
  if (!normalizedPageId) {
    throw new Error("SEO page fetch missing required field(s): pageId");
  }

  const snap = await pageRef(db, normalizedPageId).get();
  if (!snap || !snap.exists) return null;
  return {
    pageId: normalizedPageId,
    ...(typeof snap.data === "function" ? snap.data() : {})
  };
}

async function saveGeneratorConfig(db, config) {
  requireDb(db);
  const payload = normalizeGeneratorConfig(config);
  await configRef(db, payload.configId).set(payload, { merge: true });
  return payload;
}

export {
  SEO_GENERATOR_CONFIGS_COLLECTION,
  SEO_PAGES_COLLECTION,
  getDraftSeoPage,
  saveDraftSeoPage,
  saveGeneratorConfig,
  updateDraftSeoPage
};
