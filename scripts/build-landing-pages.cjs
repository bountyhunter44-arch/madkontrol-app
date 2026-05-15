const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// ===== TEMPLATE RENDER =====
function renderTemplate(template, data) {
  // Generate sectionsHtml
  data.sectionsHtml = (data.sections || []).map(section => `
  <div class="section">
    <h2>${section.heading || ""}</h2>
    <p>${section.text || ""}</p>
  </div>
`).join("");

  let html = template;

  // Simple variables
  html = html.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, key) => {
    const keys = key.split('.');
    let value = data;
    for (const k of keys) {
      value = value?.[k];
    }
    return value ?? '';
  });

  return html;
}

// ===== SHARED SEO PUBLISHER WRAPPER =====
async function loadSeoPublisherHelpers() {
  try {
    const sitemapModulePath = pathToFileURL(path.resolve(__dirname, '../tools/seo/publisher/sitemap.js')).href;
    const robotsModulePath = pathToFileURL(path.resolve(__dirname, '../tools/seo/publisher/robots.js')).href;
    const [sitemapModule, robotsModule] = await Promise.all([
      import(sitemapModulePath),
      import(robotsModulePath)
    ]);

    if (
      typeof sitemapModule.generateSitemap !== 'function' ||
      typeof robotsModule.generateRobots !== 'function'
    ) {
      throw new Error('Shared SEO publisher helpers are missing expected exports.');
    }

    return {
      generateSitemap: sitemapModule.generateSitemap,
      generateRobots: robotsModule.generateRobots,
      source: 'shared'
    };
  } catch (error) {
    console.warn(`Shared SEO publisher helpers unavailable, using local fallback: ${error.message}`);
    return {
      generateSitemap: generateSitemapFallback,
      generateRobots: generateRobotsTxtFallback,
      source: 'fallback'
    };
  }
}

function mapPagesForSitemap(pages, lastmod) {
  return (pages || []).map(page => ({
    canonicalPath: `/landing-pages/${page.slug}/`,
    lastmod,
    changefreq: 'weekly',
    priority: 0.8
  }));
}

// ===== SITEMAP FALLBACK =====
function generateSitemapFallback(pages, baseUrl = 'https://madkontrollen.dk') {
  const now = new Date().toISOString().split('T')[0];

  const urls = pages.map(page => `  <url>
    <loc>${baseUrl}/landing-pages/${page.slug}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

// ===== ROBOTS FALLBACK =====
function generateRobotsTxtFallback(baseUrl = 'https://madkontrollen.dk') {
  return `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`;
}

// ===== MAIN BUILD =====
async function build() {
  const baseUrl = 'https://madkontrollen.dk';
  const publisher = await loadSeoPublisherHelpers();
  const config = JSON.parse(fs.readFileSync('./landing-pages-config.json', 'utf8'));
  const template = fs.readFileSync('./landing-page-template.html', 'utf8');

  const publicDir = './public';
  const outputDir = path.join(publicDir, 'landing-pages');

  fs.mkdirSync(outputDir, { recursive: true });

  // ONLY LIVE PAGES
  const livePages = (config.pages || []).filter(p => p.isLive === true);

  // Generate pages
  for (const page of livePages) {
    const html = renderTemplate(template, page);
    const pageDir = path.join(outputDir, page.slug);

    fs.mkdirSync(pageDir, { recursive: true });
    fs.writeFileSync(path.join(pageDir, 'index.html'), html, 'utf8');

    console.log(`✓ Generated: /landing-pages/${page.slug}/`);
  }

  // Generate sitemap
  const lastmod = new Date().toISOString().split('T')[0];
  const sitemap = publisher.source === 'shared'
    ? publisher.generateSitemap({ domain: baseUrl }, mapPagesForSitemap(livePages, lastmod))
    : publisher.generateSitemap(livePages, baseUrl);
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap, 'utf8');
  console.log('✓ Generated: sitemap.xml');

  // Generate robots
  const robotsTxt = publisher.source === 'shared'
    ? publisher.generateRobots({ domain: baseUrl })
    : publisher.generateRobots(baseUrl);
  fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsTxt, 'utf8');
  console.log('✓ Generated: robots.txt');

  console.log(`\n✓ Total: ${livePages.length} live pages`);
}

// Run
build().catch((error) => {
  console.error(error);
  process.exit(1);
});
