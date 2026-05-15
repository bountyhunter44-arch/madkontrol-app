function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function trimString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function joinUrl(baseUrl, path) {
  const base = trimString(baseUrl).replace(/\/+$/g, "");
  const nextPath = trimString(path, "/");
  if (nextPath === "/" || nextPath === "index.html") return `${base}/`;
  return `${base}/${nextPath.replace(/^\/+/g, "")}`;
}

function normalizeTenantSeoConfig(config = {}) {
  const tenantId = trimString(config.tenantId || config.companyId || config.organizationId);
  const domain = trimString(config.domain || config.baseUrl || config.websiteUrl);
  const language = trimString(config.language, "da");
  const country = trimString(config.country, "DK");
  const topics = toArray(config.topics).map((topic) => trimString(topic)).filter(Boolean);
  const blockedTopics = toArray(config.blockedTopics).map((topic) => trimString(topic)).filter(Boolean);

  return {
    ...config,
    tenantId,
    productId: trimString(config.productId),
    domain,
    language,
    country,
    industry: trimString(config.industry),
    audience: trimString(config.audience),
    tone: trimString(config.tone),
    topics,
    blockedTopics,
    publisher: trimString(config.publisher, "firestore-draft"),
    requireHumanApproval: Boolean(config.requireHumanApproval),
    billingPlan: trimString(config.billingPlan),
    monthlyPageLimit: Number.isFinite(Number(config.monthlyPageLimit))
      ? Number(config.monthlyPageLimit)
      : null,
    channels: toArray(config.channels).map((channel) => trimString(channel)).filter(Boolean)
  };
}

function normalizeSeoPage(page = {}, tenantConfig = {}) {
  const slug = trimString(page.slug || page.canonicalPath, "index").replace(/^\/+|\/+$/g, "") || "index";
  const pageId = trimString(page.pageId, `${tenantConfig.tenantId || "tenant"}__${slug}`);
  const now = page.updatedAt || new Date().toISOString();

  return {
    ...page,
    pageId,
    tenantId: trimString(page.tenantId, tenantConfig.tenantId),
    slug,
    title: trimString(page.title, page.h1 || slug),
    metaDescription: trimString(page.metaDescription),
    h1: trimString(page.h1, page.title || slug),
    sections: toArray(page.sections),
    faq: toArray(page.faq),
    schema: toArray(page.schema),
    images: toArray(page.images),
    status: trimString(page.status, "draft"),
    createdAt: page.createdAt || now,
    updatedAt: now,
    publishedAt: page.publishedAt || null
  };
}

function renderSeoPageHtml(page, tenantConfig = {}) {
  const lang = escapeHtml(tenantConfig.language || "da");
  const canonicalUrl = tenantConfig.domain ? joinUrl(tenantConfig.domain, page.slug) : "";
  const sectionsHtml = toArray(page.sections)
    .map((section) => {
      const heading = escapeHtml(section.heading || section.title || "");
      const text = escapeHtml(section.text || section.body || "");
      return `<section><h2>${heading}</h2><p>${text}</p></section>`;
    })
    .join("\n");
  const schemaHtml = toArray(page.schema).length
    ? `<script type="application/ld+json">${JSON.stringify(page.schema)}</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(page.title)}</title>
<meta name="description" content="${escapeHtml(page.metaDescription)}">
<meta name="robots" content="index, follow">
${canonicalUrl ? `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">` : ""}
${schemaHtml}
</head>
<body>
<main>
<h1>${escapeHtml(page.h1)}</h1>
${sectionsHtml}
</main>
</body>
</html>`;
}

function generateSitemap(tenantConfig, pages) {
  const domain = trimString(tenantConfig.domain);
  if (!domain) return "";
  const urls = toArray(pages)
    .filter((page) => page.status === "published" || page.status === "draft")
    .map((page) => `  <url><loc>${escapeHtml(joinUrl(domain, page.slug))}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function generateRobots(tenantConfig) {
  const domain = trimString(tenantConfig.domain);
  return `User-agent: *
Allow: /
${domain ? `\nSitemap: ${joinUrl(domain, "sitemap.xml")}` : ""}`;
}

function generateSeoBundle(config = {}, inputPages = []) {
  const tenantConfig = normalizeTenantSeoConfig(config);
  const pages = toArray(inputPages.length ? inputPages : config.pages).map((page) =>
    normalizeSeoPage(page, tenantConfig)
  );

  return {
    tenantConfig,
    pages: pages.map((page) => ({
      ...page,
      html: renderSeoPageHtml(page, tenantConfig)
    })),
    sitemap: generateSitemap(tenantConfig, pages),
    robots: generateRobots(tenantConfig)
  };
}

export {
  escapeHtml,
  generateRobots,
  generateSeoBundle,
  generateSitemap,
  joinUrl,
  normalizeSeoPage,
  normalizeTenantSeoConfig,
  renderSeoPageHtml
};
