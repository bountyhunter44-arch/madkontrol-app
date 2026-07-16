// generator-core.js

const ROOT_DOMAIN = "madkontrollen.dk";

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

export function buildSeoSiteDomain({ domain, customDomain, subdomain, businessSlug, businessName } = {}) {
  const rawDomain = String(domain || customDomain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  if (rawDomain && /^[a-z0-9.-]+$/.test(rawDomain) && !rawDomain.includes("..")) {
    return rawDomain;
  }

  const safeSubdomain = slugifySeoPathPart(subdomain || businessSlug || businessName, "restaurant")
    .replace(/-madkontrollen-dk$/, "");
  return `${safeSubdomain}.${ROOT_DOMAIN}`;
}

export function buildSeoOutputPath({ domain, customDomain, subdomain, businessSlug, businessName, file = "index.html" }) {
  const safeDomain = buildSeoSiteDomain({ domain, customDomain, subdomain, businessSlug, businessName });
  const safeFile = String(file || "index.html").replace(/^\/+/, "");
  return `sites/${safeDomain}/${safeFile}`;
}

function buildSeoRoute(config) {
  const cityName = String(config?.displayCityName || config?.cityName || config?.city || "").trim();
  const businessName = String(config?.displayBusinessName || config?.businessName || "").trim();
  const citySlug = slugifySeoPathPart(config?.citySlug || cityName, "by");
  const businessSlug = slugifySeoPathPart(config?.subdomain || config?.businessSlug || config?.businessName, "restaurant");
  const domain = buildSeoSiteDomain({ ...config, businessSlug, businessName });
  const routePath = "/";
  const canonicalUrl = `https://${domain}/`;

  return {
    citySlug,
    businessSlug,
    domain,
    cityName,
    displayCityName: cityName,
    businessName,
    displayBusinessName: businessName,
    routePath,
    canonicalUrl,
    outputBasePath: `sites/${domain}`
  };
}

export function generateWebsiteFiles(config) {
  const route = buildSeoRoute(config);
  const indexHtml = generateMainPage(config, route);
  const sitemap = generateSitemap(route);
  const robots = generateRobots(route);

  return {
    pages: {
      [`${route.outputBasePath}/index.html`]: indexHtml,
      [`${route.outputBasePath}/robots.txt`]: robots,
      [`${route.outputBasePath}/sitemap.xml`]: sitemap
    },
    sitemap,
    robots,
    citySlug: route.citySlug,
    businessSlug: route.businessSlug,
    domain: route.domain,
    outputPath: `${route.outputBasePath}/index.html`,
    routePath: route.routePath,
    canonicalUrl: route.canonicalUrl,
    published: false,
    publishMode: "physical-files-preview"
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

Sitemap: ${route.canonicalUrl}sitemap.xml`;
}
