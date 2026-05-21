const fs = require("fs");
const path = require("path");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
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

function sanitizeDomain(value, fallbackSlug) {
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

function buildIndexHtml({ domain, businessName, description }) {
  const canonical = `https://${domain}/`;
  const title = `${businessName} | Madkontrollen`;
  const metaDescription = description || `${businessName}. Bestil online eller læs mere.`;

  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(canonical)}">
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(businessName)}</h1>
      <p>${escapeHtml(metaDescription)}</p>
    </header>
    <section>
      <h2>Velkommen til ${escapeHtml(businessName)}</h2>
      <p>${escapeHtml(metaDescription)}</p>
    </section>
  </main>
</body>
</html>
`;
}

function buildRobotsTxt(domain) {
  return `User-agent: *
Allow: /

Sitemap: https://${domain}/sitemap.xml
`;
}

function buildSitemapXml(domain) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(`https://${domain}/`)}</loc>
  </url>
</urlset>
`;
}

function main() {
  const businessName = argValue("businessName", "Det Gyldne Krus");
  const businessSlug = slugify(argValue("businessSlug", businessName));
  const domain = sanitizeDomain(argValue("domain", ""), businessSlug);
  const description = argValue("description", `${businessName}. Bestil online eller læs mere.`);
  const outputDir = path.resolve(__dirname, "..", "public", "sites", domain);

  console.log("[seo-files:output-dir]", outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  console.log("[seo-files:mkdir]", outputDir);

  const indexPath = path.join(outputDir, "index.html");
  const robotsPath = path.join(outputDir, "robots.txt");
  const sitemapPath = path.join(outputDir, "sitemap.xml");

  fs.writeFileSync(indexPath, buildIndexHtml({ domain, businessName, description }), "utf8");
  console.log("[seo-files:index-written]", indexPath);

  fs.writeFileSync(robotsPath, buildRobotsTxt(domain), "utf8");
  console.log("[seo-files:robots-written]", robotsPath);

  fs.writeFileSync(sitemapPath, buildSitemapXml(domain), "utf8");
  console.log("[seo-files:sitemap-written]", sitemapPath);

  const result = {
    outputDir,
    indexExists: fs.existsSync(indexPath),
    robotsExists: fs.existsSync(robotsPath),
    sitemapExists: fs.existsSync(sitemapPath)
  };
  console.log("[seo-files:done]", JSON.stringify(result));
}

main();
