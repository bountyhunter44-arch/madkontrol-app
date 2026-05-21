const fs = require("fs");
const path = require("path");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

function sanitizeString(value, maxLen = 500) {
  return String(value || "").trim().slice(0, maxLen);
}

function slugify(value, fallback = "restaurant") {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function normalizeDomain(value, fallbackSlug) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  if (raw && /^[a-z0-9.-]+$/.test(raw) && !raw.includes("..")) {
    return raw;
  }

  return `${fallbackSlug}.madkontrollen.dk`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(value) {
  return escapeHtml(value).replace(/'/g, "&apos;");
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
        question: sanitizeString(item?.question || item?.q || item?.title || "", 240),
        answer: sanitizeString(item?.answer || item?.a || item?.text || item?.body || "", 1000)
      }))
      .filter((item) => item.question && item.answer);
    if (normalized.length) return normalized;
  }
  return [];
}

function normalizeCta({ cta, fallbackText = "Kontakt os", phone = "" } = {}) {
  const rawText = sanitizeString(
    isPlainObject(cta) ? (cta.text || cta.label || cta.title || "") : "",
    140
  ) || fallbackText;
  const rawValue = sanitizeString(
    isPlainObject(cta) ? (cta.url || cta.href || cta.value || cta.phone || "") : cta,
    500
  );
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

function buildSchemaOrg({ renderData, config, domain, heroUrl }) {
  const provided = renderData.schemaOrg || config.schemaOrg || {};
  if (isPlainObject(provided) && Object.keys(provided).length) {
    return provided;
  }
  const name = renderData.businessName || renderData.displayBusinessName || config.businessName || titleFromDomain(domain);
  const description = renderData.metaDescription || renderData.heroSubtitle || renderData.heroText || config.description || "";
  const phone = renderData.phone || config.phone || "";
  const addressValue = renderData.address || config.address || "";
  const schema = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name,
    url: `https://${domain}/`,
    description
  };
  if (heroUrl) schema.image = heroUrl;
  if (phone) schema.telephone = phone;
  if (addressValue) {
    schema.address = {
      "@type": "PostalAddress",
      streetAddress: addressValue,
      addressLocality: renderData.cityName || renderData.city || config.cityName || "",
      addressCountry: "DK"
    };
  }
  if (renderData.cuisineType || config.cuisineType) schema.servesCuisine = renderData.cuisineType || config.cuisineType;
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

function buildActionButtons({ renderData, config }) {
  const phone = renderData.phone || config.phone || "";
  const bookingHref = normalizeCta({ cta: renderData.bookingUrl || config.bookingUrl || renderData.cta || config.cta, fallbackText: "Bestil bord", phone }).href;
  const takeawayHref = normalizeCta({ cta: renderData.takeawayUrl || config.takeawayUrl || renderData.websiteUrl || config.websiteUrl, fallbackText: "Bestil takeaway" }).href;
  const phoneHref = normalizeCta({ cta: phone, fallbackText: "Ring op", phone }).href;
  return [
    bookingHref ? { label: "Bestil bord", href: bookingHref, kind: "primary" } : null,
    takeawayHref ? { label: "Bestil takeaway", href: takeawayHref, kind: "secondary" } : null,
    phoneHref ? { label: "Ring op", href: phoneHref, kind: "ghost" } : null
  ].filter(Boolean);
}

function titleFromDomain(domain) {
  const subdomain = String(domain || "").replace(/\.madkontrollen\.dk$/i, "");
  return subdomain
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Restaurant";
}

function getRenderData(config) {
  const seoData = config?.seoData && typeof config.seoData === "object" ? config.seoData : {};
  const renderData = seoData.renderData && typeof seoData.renderData === "object" ? seoData.renderData : {};
  return Object.keys(renderData).length ? renderData : {};
}

async function loadPublishedWebsiteFromFirestore({ domain, companyId, locationId, subdomain }) {
  let admin;
  try {
    admin = require("firebase-admin");
  } catch (error) {
    throw new Error(`firebase-admin kunne ikke indlæses: ${error.message}`);
  }

  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const db = admin.firestore();
  const queries = [];

  if (domain) {
    queries.push(db.collection("websites").where("domain", "==", domain).where("status", "==", "published").limit(1));
  }

  if (companyId && locationId && subdomain) {
    const docId = `${companyId}__${locationId}__${subdomain}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    const snap = await db.collection("websites").doc(docId).get();
    if (snap.exists) return { id: snap.id, ...snap.data() };
  }

  if (subdomain) {
    queries.push(db.collection("websites").where("subdomain", "==", subdomain).where("status", "==", "published").limit(1));
  }

  for (const query of queries) {
    const snap = await query.get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() };
    }
  }

  return null;
}

function readConfigFile(configPath) {
  if (!configPath) return null;
  const absolutePath = path.resolve(process.cwd(), configPath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

async function resolveConfig() {
  const rawFileConfig = readConfigFile(argValue("config"));
  const fileConfig = rawFileConfig?.siteConfig && typeof rawFileConfig.siteConfig === "object"
    ? { ...rawFileConfig.siteConfig, companyId: rawFileConfig.companyId, locationId: rawFileConfig.locationId }
    : rawFileConfig;
  const explicitDomain = normalizeDomain(argValue("domain", fileConfig?.domain || fileConfig?.customDomain || ""), slugify(fileConfig?.subdomain || fileConfig?.businessName));
  const subdomain = slugify(argValue("subdomain", fileConfig?.subdomain || explicitDomain.replace(/\.madkontrollen\.dk$/i, "")));
  const companyId = sanitizeString(argValue("companyId", fileConfig?.companyId || ""), 120);
  const locationId = sanitizeString(argValue("locationId", fileConfig?.locationId || ""), 120);

  let firestoreConfig = null;
  if (!hasArg("no-firestore")) {
    try {
      firestoreConfig = await loadPublishedWebsiteFromFirestore({
        domain: explicitDomain,
        companyId,
        locationId,
        subdomain
      });
    } catch (error) {
      console.warn(`[seo-build:warn] Firestore lookup skipped: ${error.message}`);
    }
  }

  const merged = {
    ...(firestoreConfig || {}),
    ...(fileConfig || {})
  };
  const renderData = getRenderData(merged);
  const businessName = sanitizeString(argValue(
    "businessName",
    renderData.displayBusinessName || renderData.businessName || merged.displayBusinessName || merged.businessName || merged.heroTitle || titleFromDomain(explicitDomain)
  ), 160);
  const description = sanitizeString(argValue(
    "description",
    merged.metaDescription || merged.heroText || merged.description || `${businessName}. Bestil online eller læs mere.`
  ), 320);
  const domain = normalizeDomain(argValue("domain", merged.domain || merged.customDomain || explicitDomain), slugify(merged.subdomain || businessName));

  return {
    ...merged,
    renderData,
    domain,
    businessName,
    description,
    cuisineType: sanitizeString(renderData.cuisineType || merged.cuisineType || "Restaurant", 80),
    cityName: sanitizeString(renderData.displayCityName || renderData.cityName || renderData.city || merged.displayCityName || merged.cityName || merged.city || "", 80),
    h1: sanitizeString(renderData.h1 || renderData.heroTitle || merged.h1 || merged.heroTitle || businessName, 220),
    title: sanitizeString(renderData.title || renderData.metaTitle || merged.title || `${businessName} | Madkontrollen`, 220)
  };
}

function renderIndexHtml(config) {
  const renderData = config.renderData || {};
  const canonical = `https://${config.domain}/`;
  const h2 = [config.cuisineType, config.cityName ? `i ${config.cityName}` : ""].filter(Boolean).join(" ");
  const theme = renderData.colors || renderData.theme || {};
  const primary = sanitizeString(theme.primary || "#1f7a3d", 20);
  const secondary = sanitizeString(theme.secondary || "#f8f4ea", 20);
  const accent = sanitizeString(theme.accent || "#b91c1c", 20);
  const heroImage = normalizeHeroImage(renderData.heroImage || renderData.images?.hero || config.images?.hero || {}, config.heroImageUrl || "");
  const heroUrl = sanitizeString(heroImage.optimizedUrl || heroImage.url || heroImage.originalUrl || config.heroImageUrl || "", 2000);
  const ogImageUrl = sanitizeString(heroImage.ogImageUrl || heroUrl, 2000);
  const sections = Array.isArray(renderData.sections) ? renderData.sections : (Array.isArray(config.sections) ? config.sections : []);
  const services = Array.isArray(renderData.services) ? renderData.services : [];
  const menuItems = Array.isArray(renderData.menuItems) ? renderData.menuItems : (Array.isArray(config.menuItems) ? config.menuItems : []);
  const dailyMenu = Array.isArray(renderData.dailyMenu) ? renderData.dailyMenu : [];
  const menuSource = menuItems.length ? menuItems : dailyMenu;
  const faq = normalizeFaqItems(renderData.faq, renderData.faq?.items, config.faq);
  const ctaButtons = Array.isArray(renderData.ctaButtons) && renderData.ctaButtons.length
    ? renderData.ctaButtons.map((button) => ({ label: button.label || button.text || "", href: normalizeCta({ cta: button.href || button.url || button.value, fallbackText: button.label || button.text || "" }).href, kind: button.kind || "secondary" })).filter((button) => button.label && button.href)
    : buildActionButtons({ renderData, config });
  const schema = buildSchemaOrg({ renderData, config, domain: config.domain, heroUrl });
  console.log("[seo-render:faq-count]", faq.length);
  console.log("[seo-render:schema-present]", Boolean(schema && Object.keys(schema).length), schema?.["@type"] || "");
  console.log("[seo-render:cta-normalized]", ctaButtons.map((button) => ({ label: button.label, href: button.href })));
  const businessName = renderData.businessName || renderData.displayBusinessName || config.businessName;
  const heroTitle = renderData.heroTitle || renderData.h1 || config.h1;
  const heroSubtitle = renderData.heroSubtitle || renderData.heroText || config.description;
  const phone = renderData.phone || config.phone || "";
  const address = renderData.address || config.address || "";
  const city = renderData.cityName || renderData.city || config.cityName || "";
  const category = renderData.cuisineType || config.cuisineType || "";
  const aboutText = renderData.aboutText || config.aboutText || config.description;
  const featureItems = Array.isArray(renderData.features) && renderData.features.length ? renderData.features : services;
  const actionsHtml = ctaButtons.map((button) => `<a class="action action-${escapeHtml(button.kind || "secondary")}" href="${escapeHtml(button.href)}">${escapeHtml(button.label)}</a>`).join("");
  const infoHtml = [
    phone ? { label: "Telefon", value: phone } : null,
    address ? { label: "Adresse", value: address } : null,
    city ? { label: "By", value: city } : null,
    category ? { label: "Køkken", value: category } : null
  ].filter(Boolean).map((item) => `<article class="info-card"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></article>`).join("");
  const featuresHtml = featureItems.length ? `<section id="features" class="band"><div class="cards">${featureItems.slice(0, 6).map((item) => `<article class="feature-card"><h3>${escapeHtml(item.title || item.name || "")}</h3><p>${escapeHtml(item.text || item.description || "")}</p></article>`).join("")}</div></section>` : "";
  const sectionsHtml = sections.map((section) => `<section class="section-block"><h2>${escapeHtml(section.heading || section.title || "")}</h2><p>${escapeHtml(section.text || section.body || "")}</p></section>`).join("");
  const servicesHtml = services.length ? `<section class="section-block"><h2>Services</h2><div class="menu-grid">${services.map((item) => `<article><h3>${escapeHtml(item.title || item.name || "")}</h3><p>${escapeHtml(item.text || item.description || "")}</p></article>`).join("")}</div></section>` : "";
  const menuHtml = menuSource.length ? `<section id="menu" class="section-block"><h2>Menu</h2><div class="menu-grid">${menuSource.slice(0, 12).map((item) => `<article><h3>${escapeHtml(item.name || item.title || "")}</h3><p>${escapeHtml(item.desc || item.description || "")}</p></article>`).join("")}</div></section>` : "";
  const faqHtml = faq.length ? `<section id="faq" class="section-block"><h2>FAQ</h2>${faq.slice(0, 8).map((item) => `<details><summary>${escapeHtml(item.question || "")}</summary><p>${escapeHtml(item.answer || "")}</p></details>`).join("")}</section>` : "";

  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(config.title)}</title>
  <meta name="description" content="${escapeHtml(config.description)}">
  <meta name="robots" content="index, follow">
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <script type="application/ld+json">${JSON.stringify(schema || {}).replace(/</g, "\\u003c")}</script>
  <style>
    body{margin:0;font-family:Inter,Arial,sans-serif;background:#fafaf8;color:#1f2937;line-height:1.6}
    .topbar{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;justify-content:space-between;align-items:center;padding:24px clamp(20px,5vw,72px);color:#fff}
    .brand{font-weight:900;font-size:22px}.nav{display:flex;gap:18px}.nav a{color:#fff;text-decoration:none;font-weight:800}
    .hero{position:relative;min-height:620px;display:grid;place-items:center;color:#fff;padding:104px 20px 78px;background:${escapeHtml(primary)};${heroUrl ? `background-image:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.58)),url('${escapeHtml(heroUrl)}');` : ""}background-size:cover;background-position:center}
    .hero-inner{max-width:850px;text-align:center;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.18);border-radius:28px;padding:42px 30px;backdrop-filter:blur(8px);box-shadow:0 22px 70px rgba(0,0,0,.24)}.hero h1{margin:0 auto 18px;font-size:clamp(34px,6vw,72px);line-height:1.04;font-weight:950}.hero p{max-width:760px;margin:0 auto 28px;font-size:clamp(17px,2vw,24px);line-height:1.45;font-weight:650}
    .actions{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}.action{display:inline-flex;align-items:center;justify-content:center;padding:15px 24px;border-radius:16px;text-decoration:none;font-weight:900}.action-primary{background:${escapeHtml(accent)};color:#fff}.action-secondary{background:#fff;color:${escapeHtml(primary)}}.action-ghost{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.4);color:#fff}
    @media(max-width:760px){.hero{min-height:520px;padding:84px 16px 54px}.hero-inner{padding:30px 20px;border-radius:22px}.actions{flex-direction:column}.action{width:100%}}
    .content{max-width:1120px;margin:0 auto;padding:54px 20px}.info-grid,.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.info-card,.feature-card,.section-block{background:#fff;border-radius:12px;padding:22px;box-shadow:0 8px 26px rgba(0,0,0,.06)}.info-card span{display:block;color:#6b7280;font-size:13px;font-weight:800;text-transform:uppercase}.info-card strong{font-size:18px}.band{margin:28px 0}.about{font-size:19px}
    .menu-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
    .menu-grid article{background:${escapeHtml(secondary)};border-radius:8px;padding:16px}
  </style>
</head>
<body>
  <main>
    <nav class="topbar"><div class="brand">${escapeHtml(businessName)}</div><div class="nav"><a href="#about">Om</a><a href="#menu">Menu</a><a href="#faq">FAQ</a></div></nav>
    <header class="hero">
      <div class="hero-inner">
      <h1>${escapeHtml(heroTitle)}</h1>
      <p>${escapeHtml(heroSubtitle)}</p>
      <div class="actions">${actionsHtml}</div>
      </div>
    </header>
    <section class="content">
      <section class="info-grid">${infoHtml}</section>
      ${featuresHtml}
      <section id="about" class="section-block about"><h2>Om ${escapeHtml(businessName)}</h2><p>${escapeHtml(aboutText)}</p></section>
      ${sectionsHtml}
      ${servicesHtml}
      ${menuHtml}
      ${faqHtml}
      ${sectionsHtml || servicesHtml || menuHtml || faqHtml ? "" : `
      <section class="section-block">
      <h2>${escapeHtml(h2 || config.businessName)}</h2>
      <p>${escapeHtml(config.description)}</p>
      </section>`}
    </section>
  </main>
</body>
</html>
`;
}

function renderRobotsTxt(domain) {
  return `User-agent: *
Allow: /

Sitemap: https://${domain}/sitemap.xml
`;
}

function renderSitemapXml(domain) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(`https://${domain}/`)}</loc>
  </url>
</urlset>
`;
}

async function build() {
  const config = await resolveConfig();
  const outputDir = path.resolve(__dirname, "..", "public", "sites", config.domain);
  const seoData = config.seoData || {};
  const renderData = config.renderData || {};

  console.log("[seo-build:firestore-doc-id]", config.id || config.websiteId || "");
  console.log("[seo-build:has-seoData]", Boolean(Object.keys(seoData).length), Object.keys(seoData));
  console.log("[seo-build:has-renderData]", Boolean(Object.keys(renderData).length), Object.keys(renderData));
  console.log("[seo-build:has-generated-html]", Boolean(renderData.generatedHtml));
  console.log("[seo-build:output-dir]", outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const indexPath = path.join(outputDir, "index.html");
  const robotsPath = path.join(outputDir, "robots.txt");
  const sitemapPath = path.join(outputDir, "sitemap.xml");

  fs.writeFileSync(indexPath, renderIndexHtml(config), "utf8");
  console.log("[seo-build:index-written]", indexPath);

  fs.writeFileSync(robotsPath, renderRobotsTxt(config.domain), "utf8");
  console.log("[seo-build:robots-written]", robotsPath);

  fs.writeFileSync(sitemapPath, renderSitemapXml(config.domain), "utf8");
  console.log("[seo-build:sitemap-written]", sitemapPath);

  console.log("[seo-build:done]", JSON.stringify({
    domain: config.domain,
    outputDir,
    indexExists: fs.existsSync(indexPath),
    robotsExists: fs.existsSync(robotsPath),
    sitemapExists: fs.existsSync(sitemapPath)
  }));
}

build().catch((error) => {
  console.error("[seo-build:error]", error);
  process.exit(1);
});
