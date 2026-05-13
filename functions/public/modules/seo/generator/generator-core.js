// generator-core.js

export function generateWebsiteFiles(config) {
  const pages = generatePages(config);
  const sitemap = generateSitemap(config, pages);
  const robots = generateRobots(config);

  return {
    pages,
    sitemap,
    robots
  };
}

// ======================
// PAGES
// ======================

function generatePages(config) {
  const base = generateMainPage(config);

  const landingPages = (config.landingPages || []).map(p =>
    generateLandingPage(config, p)
  );

  return [
    { path: "index.html", content: base },
    ...landingPages.map(p => ({
      path: p.path,
      content: p.html
    }))
  ];
}

// ======================
// MAIN PAGE
// ======================

function generateMainPage(config) {
  return `
<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="UTF-8">
<title>${config.businessName}</title>
<meta name="description" content="${config.seoNarrative}">
</head>
<body>
<h1>${config.businessName}</h1>
<p>${config.description}</p>
</body>
</html>
`;
}

// ======================
// LANDING PAGE
// ======================

function generateLandingPage(config, page) {
  const pagePath = `landing-pages/${page.slug}.html`;

  const html = `
<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="UTF-8">
<title>${page.title}</title>
<meta name="description" content="${page.metaDescription}">
<link rel="canonical" href="https://${config.subdomain}.madkontrollen.dk/${pagePath}">
</head>
<body>
<h1>${page.h1}</h1>
<h2>${page.h2}</h2>
<p>${page.bodyText}</p>
</body>
</html>
`;

  return {
    slug: page.slug,
    path: pagePath,
    html
  };
}

// ======================
// SITEMAP
// ======================

function generateSitemap(config, pages) {
  const baseUrl = `https://${config.subdomain}.madkontrollen.dk`;

  const urls = pages.map(p => {
    const loc = p.path === "index.html"
      ? `${baseUrl}/`
      : `${baseUrl}/${p.path}`;

    return `<url><loc>${loc}</loc></url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

// ======================
// ROBOTS
// ======================

function generateRobots(config) {
  return `User-agent: *
Allow: /

Sitemap: https://${config.subdomain}.madkontrollen.dk/sitemap.xml`;
}