const fs = require('fs');
const path = require('path');

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

// ===== SITEMAP =====
function generateSitemap(pages, baseUrl = 'https://madkontrollen.dk') {
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

// ===== ROBOTS =====
function generateRobotsTxt(baseUrl = 'https://madkontrollen.dk') {
  return `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`;
}

// ===== MAIN BUILD =====
function build() {
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
  const sitemap = generateSitemap(livePages);
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap, 'utf8');
  console.log('✓ Generated: sitemap.xml');

  // Generate robots
  const robotsTxt = generateRobotsTxt();
  fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsTxt, 'utf8');
  console.log('✓ Generated: robots.txt');

  console.log(`\n✓ Total: ${livePages.length} live pages`);
}

// Run
build();