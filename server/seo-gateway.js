import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);

export const DEFAULT_PORT = Number(process.env.PORT || process.env.SEO_GATEWAY_PORT || 3100);
export const CACHE_TTL_MS = Number(
  process.env.SEO_GATEWAY_CACHE_TTL_MS ||
  Number(process.env.SEO_GATEWAY_CACHE_TTL_SECONDS || 300) * 1000
);
export const ALLOWED_ROOT_DOMAIN = String(process.env.SEO_ALLOWED_ROOT_DOMAIN || "madkontrollen.dk").toLowerCase();

const cache = new Map();

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
  return pages.find((page) => page.outputPath === parsed.virtualOutputPath)
    || pages.find((page) => page.canonicalPath === `/${parsed.citySlug}/${parsed.businessSlug}/`)
    || pages.find((page) => page.slug === `${parsed.citySlug}/${parsed.businessSlug}`)
    || pages.find((page) => !parsed.citySlug && page.businessSlug === parsed.businessSlug)
    || pages[0]
    || null;
}

export function buildRobotsResponse(parsed) {
  return `User-agent: *
Allow: /

Sitemap: ${buildPrimaryCanonicalUrl({ businessSlug: parsed.businessSlug, pathType: "sitemap" })}
`;
}

export function buildSitemapResponse(parsed, website = {}) {
  const urls = new Set([
    buildPrimaryCanonicalUrl({ businessSlug: parsed.businessSlug })
  ]);
  const websiteCitySlug = slugifySeoPathPart(website.citySlug || parsed.citySlug);
  if (websiteCitySlug) {
    urls.add(buildPrimaryCanonicalUrl({ businessSlug: parsed.businessSlug, citySlug: websiteCitySlug }));
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

export function renderNotFound(parsed) {
  const title = parsed?.host ? `${parsed.host}${parsed.businessSlug ? `/${parsed.businessSlug}/` : "/"}` : "Siden";
  return `<!DOCTYPE html><html lang="da"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Siden findes ikke</title></head><body style="font-family:Arial,sans-serif;padding:40px;text-align:center"><h1>404</h1><p>${escapeHtml(title)} findes ikke.</p></body></html>`;
}

export async function resolveSeoResponse({ db, host, path, query = {}, logger = console }) {
  let parsed = parseSeoRequest({ host, path });
  const bypassCache = query.preview === "1" || query.nocache === "1";

  logger.info("[seo-gateway] request", {
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

  logger.info("[seo-gateway] lookup", {
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
    logger.info("[seo-gateway] cache hit", { cacheKey });
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
    const response = {
      status: 200,
      contentType: "application/xml; charset=utf-8",
      body: buildSitemapResponse(parsed, website.data)
    };
    setCached(cacheKey, response);
    return { ...response, parsed };
  }

  const pages = await loadSeoPages(db, website.id);
  const page = findPrimaryPage(pages, parsed);
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
    logger.info("[seo-gateway] cache invalidated", {
      citySlug,
      businessSlug,
      invalidated
    });
    res.json({ ok: true, citySlug, businessSlug, invalidated });
  });

  app.get(/.*/, async (req, res) => {
    try {
      const response = await resolveSeoResponse({
        db,
        host: req.headers.host || "",
        path: req.path || "/",
        query: req.query || {},
        logger
      });

      res.status(response.status).type(response.contentType).send(response.body);
    } catch (error) {
      logger.error("[seo-gateway] unhandled error", error);
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
