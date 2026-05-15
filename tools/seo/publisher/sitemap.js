function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function trimString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeDomain(configOrDomain = "") {
  const raw = typeof configOrDomain === "string"
    ? configOrDomain
    : configOrDomain?.domain || configOrDomain?.baseUrl || configOrDomain?.websiteUrl || "";
  return trimString(raw).replace(/\/+$/g, "");
}

function normalizePagePath(page = {}) {
  if (typeof page === "string") {
    const text = trimString(page, "/");
    if (/^https?:\/\//i.test(text)) return text;
    if (text === "/" || text === "index.html") return "/";
    return text.replace(/^\/+/g, "");
  }

  const raw = trimString(page.canonicalUrl || page.url || page.loc || page.canonicalPath || page.path || page.slug, "/");
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw === "/" || raw === "index.html") return "/";
  return raw.replace(/^\/+/g, "");
}

function buildCanonicalUrl(configOrDomain, page = {}) {
  const pagePath = normalizePagePath(page);
  if (/^https?:\/\//i.test(pagePath)) return pagePath;

  const domain = normalizeDomain(configOrDomain);
  if (!domain) return pagePath === "/" ? "" : pagePath;
  if (pagePath === "/") return `${domain}/`;
  return `${domain}/${pagePath}`;
}

function formatOptionalTag(name, value) {
  const text = trimString(value);
  return text ? `\n    <${name}>${escapeXml(text)}</${name}>` : "";
}

function generateSitemap(config = {}, pages = []) {
  const sourcePages = toArray(pages.length ? pages : config.pages);
  const urls = sourcePages
    .map((page) => {
      const loc = buildCanonicalUrl(config, page);
      if (!loc) return "";
      const lastmod = formatOptionalTag("lastmod", page.lastmod || page.updatedAt || page.publishedAt);
      const changefreq = formatOptionalTag("changefreq", page.changefreq);
      const priority = page.priority === undefined || page.priority === null
        ? ""
        : formatOptionalTag("priority", page.priority);

      return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmod}${changefreq}${priority}\n  </url>`;
    })
    .filter(Boolean)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

export {
  buildCanonicalUrl,
  escapeXml,
  generateSitemap,
  normalizeDomain
};
