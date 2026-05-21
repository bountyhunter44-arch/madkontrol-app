import { createRequire } from "module";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_PORT = Number(process.env.PORT || process.env.SEO_GATEWAY_PORT || 3100);
export const CACHE_TTL_MS = Number(
  process.env.SEO_GATEWAY_CACHE_TTL_MS ||
  Number(process.env.SEO_GATEWAY_CACHE_TTL_SECONDS || 300) * 1000
);
export const ALLOWED_ROOT_DOMAIN = String(process.env.SEO_ALLOWED_ROOT_DOMAIN || "madkontrollen.dk").toLowerCase();
export const SEO_SITES_ROOT = path.resolve(
  process.env.SEO_SITES_ROOT || path.join(__dirname, "..", "public", "sites")
);

const cache = new Map();

function seoGatewayLog(tag, fields = {}) {
  const parts = [];
  Object.entries(fields || {}).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      parts.push(`${key}=${String(value).slice(0, 240)}`);
    }
  });
  console.log("SEO LOG", `${tag}${parts.length ? ` ${parts.join(" ")}` : ""}`);
}

function isAllowedSeoHost(host) {
  const cleanHost = String(host || "").toLowerCase();
  const escapedRootDomain = ALLOWED_ROOT_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^[a-z0-9-]+\\.${escapedRootDomain}$`).test(cleanHost);
}

function getSeoHostFromRequest(req) {
  return String(req.hostname || "")
    .toLowerCase()
    .split(":")[0];
}

function getStaticSeoFileForPath(requestPath = "/") {
  const cleanPath = `/${String(requestPath || "/").split("?")[0].replace(/^\/+/, "").replace(/\/+$/, "")}`;
  if (cleanPath === "/") return "index.html";
  if (cleanPath === "/robots.txt") return "robots.txt";
  if (cleanPath === "/sitemap.xml") return "sitemap.xml";
  return "";
}

function contentTypeForStaticSeoFile(file) {
  if (file === "robots.txt") return "text/plain; charset=utf-8";
  if (file === "sitemap.xml") return "application/xml; charset=utf-8";
  return "text/html; charset=utf-8";
}

export async function resolveStaticSeoFileResponse({ host, path: requestPath }) {
  const cleanHost = String(host || "").toLowerCase().split(":")[0];
  if (!isAllowedSeoHost(cleanHost)) {
    return null;
  }

  const file = getStaticSeoFileForPath(requestPath);
  if (!file) {
    return null;
  }

  const siteDir = path.join(SEO_SITES_ROOT, cleanHost);
  const filePath = path.join(siteDir, file);
  const resolvedPath = path.resolve(filePath);
  const resolvedSiteDir = path.resolve(siteDir);
  if (!resolvedPath.startsWith(`${resolvedSiteDir}${path.sep}`)) {
    return {
      status: 400,
      contentType: "text/html; charset=utf-8",
      body: renderNotFound({ host: cleanHost })
    };
  }

  try {
    const body = await fs.readFile(resolvedPath, "utf8");
    return {
      status: 200,
      contentType: contentTypeForStaticSeoFile(file),
      body,
      file,
      staticFile: resolvedPath
    };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return null;
  }
}

export function slugifySeoPathPart(value, fallback = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/\u00e6/g, "ae")
    .replace(/\u00f8/g, "oe")
    .replace(/\u00e5/g, "aa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

export function buildVirtualOutputPath({ citySlug, businessSlug, file = "index.html" }) {
  const city = slugifySeoPathPart(citySlug);
  const business = slugifySeoPathPart(businessSlug, "restaurant");
  const safeFile = String(file || "index.html").replace(/^\/+/, "");
  return city ? `${city}/${business}/${safeFile}` : `${business}/${safeFile}`;
}

function buildPrimaryCanonicalUrl({ businessSlug, citySlug = "", pathType = "page" }) {
  const business = slugifySeoPathPart(businessSlug, "restaurant");
  const city = slugifySeoPathPart(citySlug);
  const file = pathType === "sitemap" ? "sitemap.xml" : pathType === "robots" ? "robots.txt" : "";
  const path = city ? `/${city}/${file}` : `/${file}`;
  return `https://${business}.${ALLOWED_ROOT_DOMAIN}${path}`;
}

export function parseSeoRequest({ host = "", path = "/" }) {
  const cleanHost = String(host || "").toLowerCase().split(":")[0];
  const escapedRootDomain = ALLOWED_ROOT_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cleanHost.match(new RegExp(`^([a-z0-9-]+)\\.${escapedRootDomain}$`));

  if (!match) {
    return { ok: false, reason: "unknown_domain", host: cleanHost };
  }

  const hostSlug = slugifySeoPathPart(match[1]);
  const cleanPath = `/${String(path || "/").split("?")[0].replace(/^\/+/, "").replace(/\/+$/, "")}`;
  const rawParts = cleanPath.split("/").filter(Boolean);
  const rawFirstPart = String(rawParts[0] || "").toLowerCase();
  const parts = rawParts.map((part, index) => index === 0 ? slugifySeoPathPart(part) : String(part || "").toLowerCase());

  if (!hostSlug || hostSlug === "www") {
    return { ok: false, reason: "unknown_subdomain", host: cleanHost, citySlug: "", businessSlug: hostSlug };
  }

  if (parts.length === 0) {
    return {
      ok: true,
      host: cleanHost,
      routeModel: "business",
      citySlug: "",
      businessSlug: hostSlug,
      pathType: "page",
      virtualOutputPath: buildVirtualOutputPath({ businessSlug: hostSlug }),
      canonicalUrl: buildPrimaryCanonicalUrl({ businessSlug: hostSlug })
    };
  }

  let citySlug = parts[0];
  const businessSlug = hostSlug;
  const tail = parts.slice(1).join("/");
  let pathType = "page";
  let file = "index.html";

  if (parts.length === 1 && rawFirstPart === "sitemap.xml") {
    citySlug = "";
    pathType = "sitemap";
    file = "sitemap.xml";
  } else if (parts.length === 1 && rawFirstPart === "robots.txt") {
    citySlug = "";
    pathType = "robots";
    file = "robots.txt";
  } else if (tail) {
    return {
      ok: false,
      reason: "unsupported_path",
      host: cleanHost,
      citySlug,
      businessSlug,
      pathType: "unsupported",
      virtualOutputPath: buildVirtualOutputPath({ citySlug, businessSlug, file: tail }),
      legacyCandidate: {
        citySlug: hostSlug,
        businessSlug: parts[0] || "",
        pathType,
        virtualOutputPath: buildVirtualOutputPath({ citySlug: hostSlug, businessSlug: parts[0] || "" })
      }
    };
  }

  const legacyCandidate = parts.length === 1 && pathType === "page"
    ? {
      routeModel: "legacy-city-business",
      citySlug: hostSlug,
      businessSlug: parts[0],
      pathType: "page",
      virtualOutputPath: buildVirtualOutputPath({ citySlug: hostSlug, businessSlug: parts[0] }),
      canonicalUrl: buildPrimaryCanonicalUrl({ businessSlug: parts[0], citySlug: hostSlug })
    }
    : null;

  return {
    ok: true,
    host: cleanHost,
    routeModel: "business",
    citySlug,
    businessSlug,
    pathType,
    virtualOutputPath: buildVirtualOutputPath({ citySlug, businessSlug, file }),
    canonicalUrl: buildPrimaryCanonicalUrl({ businessSlug, citySlug, pathType }),
    legacyCandidate
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value || {})
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeFaqItems(...sources) {
  for (const source of sources) {
    let items = [];
    if (Array.isArray(source)) {
      items = source;
    } else if (isPlainObject(source) && Array.isArray(source.items)) {
      items = source.items;
    } else if (isPlainObject(source)) {
      items = Object.values(source);
    }
    const normalized = items
      .map((item) => ({
        question: String(item?.question || item?.q || item?.title || "").trim(),
        answer: String(item?.answer || item?.a || item?.text || item?.body || "").trim()
      }))
      .filter((item) => item.question && item.answer);
    if (normalized.length) return normalized;
  }
  return [];
}

function normalizeCta({ cta, fallbackText = "Kontakt os", phone = "" } = {}) {
  const rawText = String(isPlainObject(cta) ? (cta.text || cta.label || cta.title || "") : "").trim() || fallbackText;
  const rawValue = String(isPlainObject(cta) ? (cta.url || cta.href || cta.value || cta.phone || "") : (cta || "")).trim();
  const phoneCandidate = rawValue || phone;
  const compactPhone = String(phoneCandidate || "").replace(/[\s().-]/g, "");
  let href = "";
  if (/^https?:\/\//i.test(rawValue) || /^mailto:/i.test(rawValue) || /^tel:/i.test(rawValue)) {
    href = rawValue;
  } else if (/^\+?\d{6,15}$/.test(compactPhone)) {
    href = `tel:${compactPhone}`;
  } else if (rawValue && /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(rawValue)) {
    href = `https://${rawValue}`;
  }
  return { text: rawText, href, rawValue };
}

function buildSchemaOrg({ data, site, domain, heroImage }) {
  const provided = data.schemaOrg || site.schemaOrg || {};
  if (isPlainObject(provided) && Object.keys(provided).length) {
    return provided;
  }
  const name = data.businessName || data.displayBusinessName || site.businessName || site.displayBusinessName || site.heroTitle || domain;
  const description = data.metaDescription || data.heroSubtitle || data.heroText || site.metaDescription || site.heroText || "";
  const phone = data.phone || site.phone || "";
  const addressValue = data.address || site.address || "";
  const schema = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name,
    url: `https://${domain}/`,
    description
  };
  if (heroImage?.ogImageUrl || heroImage?.optimizedUrl || heroImage?.url || site.heroImageUrl) schema.image = heroImage?.ogImageUrl || heroImage?.optimizedUrl || heroImage?.url || site.heroImageUrl;
  if (phone) schema.telephone = phone;
  if (addressValue) {
    schema.address = {
      "@type": "PostalAddress",
      streetAddress: addressValue,
      addressLocality: data.cityName || data.city || site.cityName || site.city || "",
      addressCountry: "DK"
    };
  }
  if (data.cuisineType || site.cuisineType) schema.servesCuisine = data.cuisineType || site.cuisineType;
  return schema;
}

function buildCloudinaryTransformUrl(rawUrl, transform) {
  const url = String(rawUrl || "").trim();
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) return url;
  const [prefix, rest] = url.split("/image/upload/");
  const cleanRest = String(rest || "")
    .replace(/^(?:f_auto|q_auto|c_fill|c_fit|c_scale|w_\d+|h_\d+|g_auto|g_[^,/]+|ar_[^,/]+|dpr_[^,/]+),*/g, "")
    .replace(/^\/+/, "");
  return `${prefix}/image/upload/${transform}/${cleanRest}`;
}

function normalizeHeroImage(rawImage = {}, fallbackUrl = "") {
  const originalUrl = rawImage.originalUrl || rawImage.secureUrl || rawImage.url || fallbackUrl || "";
  const optimizedUrl = rawImage.optimizedUrl || buildCloudinaryTransformUrl(originalUrl, "f_auto,q_auto,c_fill,w_1600,h_900,g_auto");
  const ogImageUrl = rawImage.ogImageUrl || buildCloudinaryTransformUrl(originalUrl, "f_auto,q_auto,c_fill,w_1200,h_630,g_auto");
  return {
    ...rawImage,
    originalUrl,
    url: optimizedUrl || originalUrl,
    optimizedUrl: optimizedUrl || originalUrl,
    ogImageUrl: ogImageUrl || optimizedUrl || originalUrl
  };
}

function buildActionButtons({ data, site }) {
  const phone = data.phone || site.phone || "";
  const bookingHref = normalizeCta({ cta: data.bookingUrl || site.bookingUrl || data.cta || site.cta, fallbackText: "Bestil bord", phone }).href;
  const takeawayHref = normalizeCta({ cta: data.takeawayUrl || site.takeawayUrl || data.websiteUrl || site.websiteUrl, fallbackText: "Bestil takeaway" }).href;
  const phoneHref = normalizeCta({ cta: phone, fallbackText: "Ring op", phone }).href;
  return [
    bookingHref ? { label: "Bestil bord", href: bookingHref, kind: "primary" } : null,
    takeawayHref ? { label: "Bestil takeaway", href: takeawayHref, kind: "secondary" } : null,
    phoneHref ? { label: "Ring op", href: phoneHref, kind: "ghost" } : null
  ].filter(Boolean);
}

function displayFallback(...values) {
  return values
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";
}

function getCacheVersion(websiteDoc = {}) {
  const explicitVersion = websiteDoc.publishVersion || websiteDoc.version;
  if (explicitVersion) return slugifySeoPathPart(explicitVersion, "version");

  const updatedAt = websiteDoc.updatedAt || websiteDoc.generatedAt || websiteDoc.publishedAt;
  if (!updatedAt) return "unversioned";
  if (typeof updatedAt.toMillis === "function") return String(updatedAt.toMillis());
  if (typeof updatedAt.seconds === "number") return String(updatedAt.seconds);
  if (typeof updatedAt._seconds === "number") return String(updatedAt._seconds);
  if (typeof updatedAt === "string" || typeof updatedAt === "number") {
    return slugifySeoPathPart(updatedAt, "version");
  }

  return "unversioned";
}

function getCacheKey(parsed, version = "unversioned") {
  return `${parsed.businessSlug}/${parsed.citySlug || "_root"}/${parsed.pathType}/${version}`;
}

function getCachePrefix({ citySlug, businessSlug }) {
  const business = slugifySeoPathPart(businessSlug);
  const city = slugifySeoPathPart(citySlug);
  return `${business}/${city || "_root"}/`;
}

export function invalidateSeoCache({ citySlug, businessSlug }) {
  const business = slugifySeoPathPart(businessSlug);
  const prefixes = [
    getCachePrefix({ citySlug, businessSlug }),
    getCachePrefix({ citySlug: "", businessSlug })
  ].filter((prefix, index, list) => business && prefix && list.indexOf(prefix) === index);

  let removed = 0;
  for (const key of cache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      cache.delete(key);
      removed += 1;
    }
  }
  return removed;
}

function getCached(key, bypassCache) {
  if (bypassCache) return null;
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(key, value) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

async function findWebsite(db, parsed) {
  if (!parsed.businessSlug) return null;

  const collection = db
    .collection("websites")
    .where("businessSlug", "==", parsed.businessSlug)
    .where("status", "==", "published");

  const snap = parsed.citySlug
    ? await collection.where("citySlug", "==", parsed.citySlug).limit(1).get()
    : await collection.limit(1).get();

  if (snap.empty) return null;
  return {
    id: snap.docs[0].id,
    data: snap.docs[0].data() || {}
  };
}

async function loadSeoPages(db, websiteId) {
  const snap = await db
    .collection("seo_pages")
    .where("websiteId", "==", websiteId)
    .limit(100)
    .get();

  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((page) => String(page.status || "") === "published")
    .sort((a, b) => Number(a.ordering || 0) - Number(b.ordering || 0))
    .slice(0, 60);
}

function findPrimaryPage(pages, parsed) {
  if (!Array.isArray(pages) || !parsed?.businessSlug) return null;

  if (!parsed.citySlug) {
    return pages.find((page) => page.pageType === "business_root")
      || pages.find((page) => page.routePath === "/" || page.canonicalPath === "/")
      || pages.find((page) => page.outputPath === parsed.virtualOutputPath)
      || null;
  }

  const cityPath = `/${parsed.citySlug}/`;
  return pages.find((page) => page.pageType === "city_landing" && page.citySlug === parsed.citySlug)
    || pages.find((page) => page.routePath === cityPath || page.canonicalPath === cityPath)
    || pages.find((page) => page.outputPath === parsed.virtualOutputPath)
    || null;
}

export function buildRobotsResponse(parsed) {
  return `User-agent: *
Allow: /

Sitemap: ${buildPrimaryCanonicalUrl({ businessSlug: parsed.businessSlug, pathType: "sitemap" })}
`;
}

export function buildSitemapResponse(parsed, website = {}, pages = []) {
  const urls = new Set();
  const publishedPages = Array.isArray(pages) ? pages : [];

  publishedPages.forEach((page) => {
    const routePath = String(page.routePath || page.canonicalPath || "").trim();
    if (!routePath || routePath.includes(".html")) return;
    if (!["business_root", "city_landing", "service_landing", "location_landing"].includes(String(page.pageType || ""))) return;
    urls.add(`https://${parsed.businessSlug}.${ALLOWED_ROOT_DOMAIN}${routePath.startsWith("/") ? routePath : `/${routePath}`}`);
  });

  if (!urls.size) {
    urls.add(buildPrimaryCanonicalUrl({ businessSlug: parsed.businessSlug }));
    const websiteCitySlug = slugifySeoPathPart(website.citySlug || parsed.citySlug);
    if (websiteCitySlug) {
      urls.add(buildPrimaryCanonicalUrl({ businessSlug: parsed.businessSlug, citySlug: websiteCitySlug }));
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...urls].map((url) => `<url><loc>${url}</loc></url>`).join("\n")}
</urlset>`;
}

export function renderSeoHtml({ website, page, parsed }) {
  const websiteDoc = website || {};
  const pageDoc = page || {};
  const displayBusinessName = displayFallback(
    pageDoc.displayBusinessName,
    websiteDoc.displayBusinessName,
    pageDoc.businessName,
    websiteDoc.businessName,
    websiteDoc.heroTitle,
    parsed.businessSlug
  );
  const displayCityName = displayFallback(
    pageDoc.displayCityName,
    websiteDoc.displayCityName,
    pageDoc.cityName,
    websiteDoc.cityName,
    parsed.citySlug
  );
  const title = escapeHtml(pageDoc.title || websiteDoc.heroTitle || displayBusinessName);
  const metaDescription = escapeHtml(pageDoc.metaDescription || websiteDoc.heroText || "");
  const h1 = escapeHtml(pageDoc.h1 || websiteDoc.heroTitle || displayBusinessName);
  const intro = escapeHtml(pageDoc.bodyText || pageDoc.metaDescription || websiteDoc.heroText || "");
  const canonicalUrl = escapeHtml(parsed.canonicalUrl);
  const heroImage = escapeHtml(websiteDoc.heroImageUrl || "");
  const themePrimary = escapeHtml(websiteDoc.themePrimary || "#1f7a3d");
  const themeSecondary = escapeHtml(websiteDoc.themeSecondary || "#f8f4ea");
  const themeAccent = escapeHtml(websiteDoc.themeAccent || "#b91c1c");
  const phone = escapeHtml(websiteDoc.phone || "");
  const address = escapeHtml(websiteDoc.address || "");
  const cityLabel = escapeHtml(displayCityName);
  const h2 = escapeHtml(pageDoc.h2 || (displayCityName ? `Velkommen til ${displayBusinessName} i ${displayCityName}` : "Velkommen"));

  return `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${metaDescription}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonicalUrl}">
<style>
body{margin:0;font-family:Inter,Arial,sans-serif;color:#1f2937;background:#f7f7f4;line-height:1.6}
.hero{min-height:520px;display:grid;place-items:center;text-align:center;color:#fff;padding:64px 20px;background:${themePrimary};background-image:linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.42)),url('${heroImage}');background-size:cover;background-position:center}
.hero h1{font-size:clamp(38px,7vw,82px);line-height:.98;margin:0 0 18px;font-weight:900}
.hero p{max-width:780px;margin:0 auto;font-size:clamp(18px,2vw,28px);font-weight:700}
.content{max-width:980px;margin:0 auto;padding:48px 20px}
.panel{background:#fff;border-top:6px solid ${themeAccent};border-radius:10px;padding:28px;box-shadow:0 8px 28px rgba(0,0,0,.07)}
.meta{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px;color:${themePrimary};font-weight:800}
.pill{background:${themeSecondary};border-radius:999px;padding:8px 12px}
</style>
</head>
<body>
<main>
  <section class="hero">
    <div>
      <h1>${h1}</h1>
      <p>${intro}</p>
    </div>
  </section>
  <section class="content">
    <div class="panel">
      <h2>${h2}</h2>
      <p>${intro}</p>
      <div class="meta">
        ${phone ? `<span class="pill">Telefon: ${phone}</span>` : ""}
        ${address ? `<span class="pill">Adresse: ${address}</span>` : ""}
        ${cityLabel ? `<span class="pill">By: ${cityLabel}</span>` : ""}
      </div>
    </div>
  </section>
</main>
</body>
</html>`;
}

function renderStaticSeoIndex({ website, pages = [], logger = console }) {
  const site = website || {};
  const seo = site.seoData || {};
  const renderData = seo.renderData || {};
  const data = Object.keys(renderData).length ? { ...seo, ...renderData } : seo;
  const domain = site.domain || `${site.businessSlug || site.subdomain}.${ALLOWED_ROOT_DOMAIN}`;
  const title = escapeHtml(data.title || site.metaTitle || site.title || site.heroTitle || site.displayBusinessName || site.businessName || domain);
  const metaDescription = escapeHtml(data.metaDescription || site.metaDescription || site.heroText || "");
  const businessName = escapeHtml(data.displayBusinessName || data.businessName || site.displayBusinessName || site.businessName || site.heroTitle || domain);
  const h1 = escapeHtml(data.h1 || data.heroTitle || site.h1 || site.heroTitle || businessName);
  const heroText = escapeHtml(data.heroSubtitle || data.heroText || site.heroText || metaDescription);
  const theme = data.colors || data.theme || {};
  const primary = escapeHtml(theme.primary || site.themePrimary || "#1f7a3d");
  const secondary = escapeHtml(theme.secondary || site.themeSecondary || "#f8f4ea");
  const accent = escapeHtml(theme.accent || site.themeAccent || "#b91c1c");
  const textColor = escapeHtml(theme.text || site.themeText || "#1f2937");
  const heroImage = normalizeHeroImage(data.heroImage || data.images?.hero || data.cloudinaryImages?.hero || site.images?.hero || {}, site.heroImageUrl || "");
  const heroImageUrl = escapeHtml(heroImage.optimizedUrl || heroImage.url || heroImage.originalUrl || site.heroImageUrl || "");
  const ogImageUrl = escapeHtml(heroImage.ogImageUrl || heroImageUrl);
  const heroAlt = escapeHtml(heroImage.alt || `${businessName} hero`);
  const ctaButtons = Array.isArray(data.ctaButtons) && data.ctaButtons.length
    ? data.ctaButtons.map((button) => ({ label: button.label || button.text || "", href: normalizeCta({ cta: button.href || button.url || button.value, fallbackText: button.label || button.text || "" }).href, kind: button.kind || "secondary" })).filter((button) => button.label && button.href)
    : buildActionButtons({ data, site });
  const sections = Array.isArray(data.sections) ? data.sections : [];
  const services = Array.isArray(data.services) ? data.services : [];
  const menuItems = Array.isArray(data.menuItems) ? data.menuItems : [];
  const dailyMenu = Array.isArray(data.dailyMenu) ? data.dailyMenu : [];
  const menuSource = menuItems.length ? menuItems : dailyMenu;
  const faq = normalizeFaqItems(data.faq, data.faq?.items, site.faq);
  const schema = buildSchemaOrg({ data, site, domain, heroImage });
  seoGatewayLog("[seo-render:faq-count]", { domain, count: faq.length });
  seoGatewayLog("[seo-render:schema-present]", { domain, present: Boolean(schema && Object.keys(schema).length), type: schema?.["@type"] || "" });
  seoGatewayLog("[seo-render:cta-normalized]", { domain, buttonCount: ctaButtons.length });
  const rawBusinessName = data.displayBusinessName || data.businessName || site.displayBusinessName || site.businessName || site.heroTitle || domain;
  const phone = data.phone || site.phone || "";
  const address = data.address || site.address || "";
  const city = data.cityName || data.city || site.cityName || site.city || "";
  const category = data.cuisineType || site.cuisineType || "";
  const aboutText = data.aboutText || site.aboutText || data.heroText || site.heroText || metaDescription;
  const featureItems = Array.isArray(data.features) && data.features.length ? data.features : services;
  const actionsHtml = ctaButtons.map((button) => `<a class="action action-${escapeHtml(button.kind || "secondary")}" href="${escapeHtml(button.href)}">${escapeHtml(button.label)}</a>`).join("");
  const infoHtml = [
    phone ? { label: "Telefon", value: phone } : null,
    address ? { label: "Adresse", value: address } : null,
    city ? { label: "By", value: city } : null,
    category ? { label: "Køkken", value: category } : null
  ].filter(Boolean).map((item) => `<article class="info-card"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></article>`).join("");
  const featuresHtml = featureItems.length ? `
    <section id="features" class="band">
      <div class="cards">
        ${featureItems.slice(0, 6).map((item) => `<article class="feature-card"><h3>${escapeHtml(item.title || item.name || "")}</h3><p>${escapeHtml(item.text || item.description || "")}</p></article>`).join("")}
      </div>
    </section>` : "";

  const sectionsHtml = sections.map((section) => `
    <section id="menu" class="section-block">
      <h2>${escapeHtml(section.heading || section.title || "")}</h2>
      <p>${escapeHtml(section.text || section.body || "")}</p>
    </section>`).join("");

  const servicesHtml = services.length ? `
    <section id="faq" class="section-block">
      <h2>Services</h2>
      <div class="menu-grid">
        ${services.slice(0, 8).map((item) => `<article><h3>${escapeHtml(item.title || item.name || "")}</h3><p>${escapeHtml(item.text || item.description || "")}</p></article>`).join("")}
      </div>
    </section>` : "";

  const menuHtml = menuSource.length ? `
    <section class="section-block">
      <h2>Menu</h2>
      <div class="menu-grid">
        ${menuSource.slice(0, 12).map((item) => `<article><h3>${escapeHtml(item.name || item.title || "")}</h3><p>${escapeHtml(item.desc || item.description || "")}</p></article>`).join("")}
      </div>
    </section>` : "";

  const faqHtml = faq.length ? `
    <section class="section-block">
      <h2>FAQ</h2>
      ${faq.slice(0, 8).map((item) => `<details><summary>${escapeHtml(item.question || "")}</summary><p>${escapeHtml(item.answer || "")}</p></details>`).join("")}
    </section>` : "";

  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${metaDescription}">
  <meta name="robots" content="index, follow">
  <meta property="og:image" content="${ogImageUrl}">
  <link rel="canonical" href="https://${escapeHtml(domain)}/">
  <script type="application/ld+json">${escapeJsonForHtml(schema)}</script>
  <style>
    body{margin:0;font-family:Inter,Arial,sans-serif;background:#fafaf8;color:${textColor};line-height:1.6}
    .topbar{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;justify-content:space-between;align-items:center;padding:24px clamp(20px,5vw,72px);color:#fff}
    .brand{font-weight:900;font-size:22px}.nav{display:flex;gap:18px}.nav a{color:#fff;text-decoration:none;font-weight:800}
    .hero{position:relative;min-height:620px;display:grid;place-items:center;text-align:center;color:#fff;padding:104px 20px 78px;background:${primary};${heroImageUrl ? `background-image:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.58)),url('${heroImageUrl}');` : ""}background-size:cover;background-position:center}
    .hero-inner{max-width:850px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.18);border-radius:28px;padding:42px 30px;backdrop-filter:blur(8px);box-shadow:0 22px 70px rgba(0,0,0,.24)}.hero h1{max-width:850px;margin:0 auto 18px;font-size:clamp(34px,6vw,72px);line-height:1.04;font-weight:950}.hero p{max-width:760px;margin:0 auto 28px;font-size:clamp(17px,2vw,24px);line-height:1.45;font-weight:650}
    .actions{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}.action{display:inline-flex;align-items:center;justify-content:center;padding:15px 24px;border-radius:16px;text-decoration:none;font-weight:900}.action-primary{background:${accent};color:#fff}.action-secondary{background:#fff;color:${primary}}.action-ghost{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.4);color:#fff}
    @media(max-width:760px){.hero{min-height:520px;padding:84px 16px 54px}.hero-inner{padding:30px 20px;border-radius:22px}.actions{flex-direction:column}.action{width:100%}}
    .content{max-width:1120px;margin:0 auto;padding:54px 20px}.info-grid,.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.info-card,.feature-card,.section-block{background:#fff;border-radius:12px;padding:22px;box-shadow:0 8px 26px rgba(0,0,0,.06)}.info-card span{display:block;color:#6b7280;font-size:13px;font-weight:800;text-transform:uppercase}.info-card strong{font-size:18px}.band{margin:28px 0}.about{font-size:19px}
    .section-block h2{margin:0 0 10px}
    .menu-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
    .menu-grid article{background:${secondary};border-radius:8px;padding:16px}
    details{border-top:1px solid #e5e7eb;padding:12px 0}
    summary{cursor:pointer;font-weight:800}
    .visually-hidden{position:absolute;width:1px;height:1px;clip:rect(0 0 0 0);overflow:hidden}
  </style>
</head>
<body>
  <main>
    <nav class="topbar"><div class="brand">${escapeHtml(rawBusinessName)}</div><div class="nav"><a href="#about">Om</a><a href="#menu">Menu</a><a href="#faq">FAQ</a></div></nav>
    <section class="hero">
      <div class="hero-inner">
        ${heroImageUrl ? `<img class="visually-hidden" src="${heroImageUrl}" alt="${heroAlt}">` : ""}
        <h1>${h1}</h1>
        <p>${heroText}</p>
        <div class="actions">${actionsHtml}</div>
      </div>
    </section>
    <section class="content">
      <section class="info-grid">${infoHtml}</section>
      ${featuresHtml}
      <section id="about" class="section-block about"><h2>Om ${escapeHtml(rawBusinessName)}</h2><p>${escapeHtml(aboutText)}</p></section>
      ${sectionsHtml}
      ${servicesHtml}
      ${menuHtml}
      ${faqHtml}
    </section>
  </main>
</body>
</html>`;
}

function renderStaticRobots(domain) {
  return `User-agent: *
Allow: /

Sitemap: https://${domain}/sitemap.xml
`;
}

function renderStaticSitemap(domain, pages = []) {
  const urls = new Set([`https://${domain}/`]);
  pages.forEach((page) => {
    const routePath = String(page.routePath || page.canonicalPath || "").trim();
    if (routePath && !routePath.includes(".html")) {
      urls.add(`https://${domain}${routePath.startsWith("/") ? routePath : `/${routePath}`}`);
    }
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...urls].map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join("\n")}
</urlset>
`;
}

async function findWebsiteByDomain(db, domain) {
  const snap = await db.collection("websites")
    .where("domain", "==", domain)
    .where("status", "==", "published")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, data: snap.docs[0].data() || {} };
}

async function rebuildStaticSeoSite({ db, domain, logger = console }) {
  const cleanDomain = String(domain || "").toLowerCase().trim();
  if (!isAllowedSeoHost(cleanDomain)) {
    return { ok: false, error: "invalid_domain" };
  }
  const website = await findWebsiteByDomain(db, cleanDomain);
  if (!website) {
    return { ok: false, error: "website_not_found" };
  }
  const seoData = website.data?.seoData || {};
  const renderData = seoData.renderData || {};
  seoGatewayLog("[seo-build:firestore-doc-id]", { domain: cleanDomain, websiteId: website.id });
  seoGatewayLog("[seo-build:has-seoData]", { domain: cleanDomain, hasSeoData: Boolean(Object.keys(seoData).length), seoDataKeyCount: Object.keys(seoData).length });
  seoGatewayLog("[seo-build:has-renderData]", { domain: cleanDomain, hasRenderData: Boolean(Object.keys(renderData).length), renderDataKeyCount: Object.keys(renderData).length });
  seoGatewayLog("[seo-build:has-generated-html]", { domain: cleanDomain, hasGeneratedHtml: Boolean(renderData.generatedHtml) });
  const pages = await loadSeoPages(db, website.id);
  const siteDir = path.join(SEO_SITES_ROOT, cleanDomain);
  const resolvedSiteDir = path.resolve(siteDir);
  if (!resolvedSiteDir.startsWith(path.resolve(SEO_SITES_ROOT))) {
    return { ok: false, error: "invalid_output_dir" };
  }

  seoGatewayLog("[seo-build:output-dir]", { domain: cleanDomain, outputDir: resolvedSiteDir });
  await fs.mkdir(resolvedSiteDir, { recursive: true });
  const indexPath = path.join(resolvedSiteDir, "index.html");
  const robotsPath = path.join(resolvedSiteDir, "robots.txt");
  const sitemapPath = path.join(resolvedSiteDir, "sitemap.xml");

  await fs.writeFile(indexPath, renderStaticSeoIndex({ website: website.data, pages, logger }), "utf8");
  seoGatewayLog("[seo-build:index-written]", { domain: cleanDomain, indexPath });
  await fs.writeFile(robotsPath, renderStaticRobots(cleanDomain), "utf8");
  seoGatewayLog("[seo-build:robots-written]", { domain: cleanDomain, robotsPath });
  await fs.writeFile(sitemapPath, renderStaticSitemap(cleanDomain, pages), "utf8");
  seoGatewayLog("[seo-build:sitemap-written]", { domain: cleanDomain, sitemapPath });

  const result = {
    ok: true,
    domain: cleanDomain,
    outputDir: resolvedSiteDir,
    indexPath,
    robotsPath,
    sitemapPath,
    pages: pages.length
  };
  seoGatewayLog("[seo-build:done]", { ok: result.ok, domain: result.domain, outputDir: result.outputDir, pages: result.pages });
  return result;
}

export function renderNotFound(parsed) {
  const title = parsed?.host ? `${parsed.host}${parsed.businessSlug ? `/${parsed.businessSlug}/` : "/"}` : "Siden";
  return `<!DOCTYPE html><html lang="da"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Siden findes ikke</title></head><body style="font-family:Arial,sans-serif;padding:40px;text-align:center"><h1>404</h1><p>${escapeHtml(title)} findes ikke.</p></body></html>`;
}

export async function resolveSeoResponse({ db, host, path, query = {}, logger = console }) {
  let parsed = parseSeoRequest({ host, path });
  const bypassCache = query.preview === "1" || query.nocache === "1";

  seoGatewayLog("[seo-gateway] request", {
    host,
    path,
    citySlug: parsed.citySlug || "",
    businessSlug: parsed.businessSlug || "",
    routeModel: parsed.routeModel || "",
    virtualOutputPath: parsed.virtualOutputPath || "",
    reason: parsed.reason || "",
    bypassCache
  });

  if (!parsed.ok) {
    return {
      status: parsed.reason === "unknown_domain" ? 400 : 404,
      contentType: "text/html; charset=utf-8",
      body: renderNotFound(parsed),
      parsed
    };
  }

  if (parsed.pathType === "city-root") {
    return {
      status: 404,
      contentType: "text/html; charset=utf-8",
      body: renderNotFound(parsed),
      parsed
    };
  }

  let website = await findWebsite(db, parsed);
  if (!website && parsed.legacyCandidate) {
    const legacyWebsite = await findWebsite(db, parsed.legacyCandidate);
    if (legacyWebsite) {
      parsed = {
        ...parsed,
        ...parsed.legacyCandidate,
        host: parsed.host,
        legacyRoute: true
      };
      website = legacyWebsite;
    }
  }

  seoGatewayLog("[seo-gateway] lookup", {
    host: parsed.host,
    path: path || "/",
    citySlug: parsed.citySlug,
    businessSlug: parsed.businessSlug,
    routeModel: parsed.routeModel || "",
    legacyRoute: Boolean(parsed.legacyRoute),
    lookupKey: `${parsed.citySlug}/${parsed.businessSlug}`,
    found: Boolean(website)
  });

  const cacheVersion = website ? getCacheVersion(website.data) : "missing";
  const cacheKey = getCacheKey(parsed, cacheVersion);
  const cached = getCached(cacheKey, bypassCache);
  if (cached) {
    seoGatewayLog("[seo-gateway] cache hit", { cacheKey });
    return { ...cached, parsed, cacheHit: true };
  }

  if (!website) {
    const response = {
      status: 404,
      contentType: "text/html; charset=utf-8",
      body: renderNotFound(parsed)
    };
    setCached(cacheKey, response);
    return { ...response, parsed };
  }

  if (parsed.pathType === "robots") {
    const response = {
      status: 200,
      contentType: "text/plain; charset=utf-8",
      body: buildRobotsResponse(parsed)
    };
    setCached(cacheKey, response);
    return { ...response, parsed };
  }

  if (parsed.pathType === "sitemap") {
    const pages = await loadSeoPages(db, website.id);
    const response = {
      status: 200,
      contentType: "application/xml; charset=utf-8",
      body: buildSitemapResponse(parsed, website.data, pages)
    };
    setCached(cacheKey, response);
    return { ...response, parsed };
  }

  const pages = await loadSeoPages(db, website.id);
  const page = findPrimaryPage(pages, parsed);
  if (!page) {
    const response = {
      status: 404,
      contentType: "text/html; charset=utf-8",
      body: renderNotFound(parsed)
    };
    setCached(cacheKey, response);
    return { ...response, parsed };
  }
  const response = {
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: renderSeoHtml({ website: website.data, page, parsed })
  };
  setCached(cacheKey, response);
  return { ...response, parsed };
}

export async function createSeoGatewayApp({ db, logger = console } = {}) {
  const express = (await import("express")).default;
  const app = express();

  app.use(express.json({ limit: "16kb" }));

  app.post("/__internal/seo-cache/invalidate", (req, res) => {
    const expectedToken = String(process.env.SEO_GATEWAY_INTERNAL_TOKEN || "");
    const authorization = String(req.headers.authorization || "");
    if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const citySlug = slugifySeoPathPart(req.body?.citySlug);
    const businessSlug = slugifySeoPathPart(req.body?.businessSlug);
    if (!citySlug || !businessSlug) {
      res.status(400).json({ ok: false, error: "citySlug and businessSlug are required" });
      return;
    }

    const invalidated = invalidateSeoCache({ citySlug, businessSlug });
    seoGatewayLog("[seo-gateway] cache invalidated", {
      citySlug,
      businessSlug,
      invalidated
    });
    res.json({ ok: true, citySlug, businessSlug, invalidated });
  });

  app.post("/internal/rebuild-site", async (req, res) => {
    const expectedToken = String(process.env.SEO_GATEWAY_INTERNAL_TOKEN || "");
    const authorization = String(req.headers.authorization || "");
    if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const domain = String(req.body?.domain || "").toLowerCase().trim();
    const reason = String(req.body?.reason || "").trim() || "manual";
    seoGatewayLog("[seo-rebuild:request]", { domain, reason });

    try {
      const result = await rebuildStaticSeoSite({ db, domain, logger });
      res.status(result.ok ? 200 : 400).json({ ...result, reason });
    } catch (error) {
      seoGatewayLog("[seo-rebuild:error]", { message: String(error?.message || "rebuild_failed").slice(0, 200) });
      res.status(500).json({ ok: false, error: String(error?.message || "rebuild_failed").slice(0, 200) });
    }
  });

  app.get(/.*/, async (req, res) => {
    try {
      const host = getSeoHostFromRequest(req);
      const staticResponse = await resolveStaticSeoFileResponse({
        host,
        path: req.path || "/"
      });
      if (staticResponse) {
        if (staticResponse.file === "index.html") {
          seoGatewayLog("[seo-vps:static-index-hit]", {
            host,
            indexPath: staticResponse.staticFile
          });
        }
        seoGatewayLog("[seo-gateway:static]", {
          host,
          path: req.path || "/",
          status: staticResponse.status,
          file: staticResponse.staticFile || ""
        });
        res.status(staticResponse.status).type(staticResponse.contentType);
        res.sendFile(staticResponse.staticFile);
        return;
      }

      const response = await resolveSeoResponse({
        db,
        host,
        path: req.path || "/",
        query: req.query || {},
        logger
      });

      res.status(response.status).type(response.contentType).send(response.body);
    } catch (error) {
      seoGatewayLog("[seo-gateway] unhandled error", { message: String(error?.message || "gateway_failed").slice(0, 200) });
      res.status(500).type("text/html; charset=utf-8").send("<!DOCTYPE html><html><body><h1>500</h1><p>SEO gateway fejl.</p></body></html>");
    }
  });

  return app;
}

async function createFirestoreDb() {
  const admin = require("firebase-admin");
  if (!admin.apps.length) {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "../serviceAccountKey.json";
    try {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    } catch (error) {
      admin.initializeApp();
    }
  }
  return admin.firestore();
}

async function start() {
  const db = await createFirestoreDb();
  const app = await createSeoGatewayApp({ db });
  const port = DEFAULT_PORT;
  app.listen(port, "127.0.0.1", () => {
    console.log(`[seo-gateway] listening on http://127.0.0.1:${port}`);
  });
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  start().catch((error) => {
    console.error("[seo-gateway] failed to start", error);
    process.exit(1);
  });
}
