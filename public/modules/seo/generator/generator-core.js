// generator-core.js

const SITE_ORIGIN = "https://madkontrollen.dk";

export function slugifySeoPathPart(value, fallback = "restaurant") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\u00e6/g, "ae")
    .replace(/\u00f8/g, "oe")
    .replace(/\u00e5/g, "aa")
    .replace(/Ã¦/g, "ae")
    .replace(/Ã¸/g, "oe")
    .replace(/Ã¥/g, "aa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

export function buildSeoOutputPath({ citySlug, businessSlug, file = "index.html" }) {
  const safeCitySlug = slugifySeoPathPart(citySlug, "by");
  const safeBusinessSlug = slugifySeoPathPart(businessSlug, "restaurant");
  const safeFile = String(file || "index.html").replace(/^\/+/, "");
  return `${safeCitySlug}/${safeBusinessSlug}/${safeFile}`;
}

function buildSeoRoute(config) {
  const cityName = String(config?.displayCityName || config?.cityName || config?.city || "").trim();
  const businessName = String(config?.displayBusinessName || config?.businessName || "").trim();
  const citySlug = slugifySeoPathPart(config?.citySlug || cityName, "by");
  const businessSlug = slugifySeoPathPart(config?.subdomain || config?.businessSlug || config?.businessName, "restaurant");
  const routePath = `/${citySlug}/${businessSlug}/`;
  const canonicalUrl = `${SITE_ORIGIN}${routePath}`;

  return {
    citySlug,
    businessSlug,
    cityName,
    displayCityName: cityName,
    businessName,
    displayBusinessName: businessName,
    routePath,
    canonicalUrl,
    outputBasePath: `${citySlug}/${businessSlug}`
  };
}

export function generateWebsiteFiles(config) {
  const route = buildSeoRoute(config);
  const indexHtml = generateMainPage(config, route);
  const sitemap = generateSitemap(route);
  const robots = generateRobots(route);

  return {
    pages: {
      [buildSeoOutputPath({ ...route, file: "index.html" })]: indexHtml,
      [buildSeoOutputPath({ ...route, file: "robots.txt" })]: robots,
      [buildSeoOutputPath({ ...route, file: "sitemap.xml" })]: sitemap
    },
    sitemap,
    robots,
    citySlug: route.citySlug,
    businessSlug: route.businessSlug,
    routePath: route.routePath,
    canonicalUrl: route.canonicalUrl,
    published: false,
    publishMode: "preview-in-memory"
  };
}

function generateMainPage(config, route) {
  const city = route.displayCityName || config.displayCityName || config.cityName || config.city || "";
  const businessName = route.displayBusinessName || config.displayBusinessName || config.businessName || "";
  const cuisineType = config.cuisineType || "Restaurant";
  const description = config.description || "";
  const seoNarrative = config.seoNarrative || description;
  const title = config.title || `${businessName} | ${cuisineType} i ${city}`;
  const h1 = config.h1 || `${cuisineType} i ${city}`;

  return `
<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<meta name="description" content="${seoNarrative}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${route.canonicalUrl}">
</head>
<body>
<h1>${h1}</h1>
<p>${description}</p>
</body>
</html>
`;
}

function generateSitemap(route) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${route.canonicalUrl}</loc></url>
</urlset>`;
}

function generateRobots(route) {
  return `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}${route.routePath}sitemap.xml`;
}
