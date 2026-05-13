import admin from 'firebase-admin';
import { readFileSync } from 'fs';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function sanitizeString(value, maxLen = 500) {
  return String(value || '').trim().slice(0, maxLen);
}

function toAsciiSlug(value, maxLen = 120) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen);
}

function toDocSafeId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function parsePageCount(value, fallback = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  if (rounded < 1) return 1;
  if (rounded > 300) return 300;
  return rounded;
}

function buildSeoLandingPages(config, count) {
  const businessName = sanitizeString(config?.businessName || 'Restaurant', 140) || 'Restaurant';
  const cuisineType = sanitizeString(config?.cuisineType || 'Restaurant', 80) || 'Restaurant';
  const city = sanitizeString(config?.city || 'Kobenhavn', 80) || 'Kobenhavn';
  const keyword = sanitizeString(config?.keyword || `bedste ${String(cuisineType).toLowerCase()} i ${city}`, 120);
  const subdomain = sanitizeString(config?.subdomain || toAsciiSlug(businessName), 120);

  const seeds = [
    keyword,
    `${cuisineType} i ${city}`,
    `Takeaway ${city}`,
    `Restaurant ${city}`,
    `Bedste ${String(cuisineType).toLowerCase()} i ${city}`,
    `Billig ${String(cuisineType).toLowerCase()} i ${city}`,
    `Familie restaurant i ${city}`,
    `Online bestilling ${city}`,
    `${cuisineType} menu i ${city}`,
    `${subdomain}.madkontrollen.dk`
  ];

  const pages = [];
  for (let i = 0; i < count; i += 1) {
    const seed = sanitizeString(seeds[i % seeds.length], 140) || `Landing side ${i + 1}`;
    const variant = Math.floor(i / seeds.length) + 1;
    const pageTitleSeed = `${businessName} - ${seed}${variant > 1 ? ` #${variant}` : ''}`;
    const slugBase = toAsciiSlug(`${seed}${variant > 1 ? `-${variant}` : ''}`, 100) || `landing-side-${i + 1}`;
    const title = sanitizeString(`${businessName} | ${seed}`, 220);
    const metaDescription = sanitizeString(
      `${businessName} i ${city}. ${seed}. Book bord eller bestil online via ${subdomain}.madkontrollen.dk.`,
      320
    );

    pages.push({
      sourceTitle: pageTitleSeed,
      slug: slugBase,
      keyword: seed,
      title,
      metaDescription,
      h1: sanitizeString(`${businessName} - ${seed}`, 220),
      h2: sanitizeString(`Hvorfor vaelge ${businessName} i ${city}?`, 220),
      h3: sanitizeString(`Bestil ${String(cuisineType).toLowerCase()} online i ${city}`, 220),
      canonicalPath: `/${slugBase}`
    });
  }

  return pages;
}

async function upsertWebsiteAndSeoPages({ companyId, locationId, config, activatedByUid }) {
  const subdomain = sanitizeString(config?.subdomain || '', 120);
  const businessName = sanitizeString(config?.businessName || '', 140);
  const description = sanitizeString(config?.description || '', 800);
  const selectedTemplate = sanitizeString(config?.selectedTemplate || 'classic', 60) || 'classic';
  const pageCount = parsePageCount(config?.pageCount, 50);
  const logoDataUrl = sanitizeString(config?.logoDataUrl || '', 500000);

  if (!subdomain) {
    throw new Error('Subdomain mangler i generator-konfigurationen.');
  }

  const websiteId = toDocSafeId(`${companyId}__${locationId}__${subdomain}`);
  const websiteRef = db.collection('websites').doc(websiteId);

  await websiteRef.set({
    organizationId: companyId,
    companyId,
    locationId,
    subdomain,
    template: selectedTemplate,
    brandMode: 'madkontrollen_default',
    logoUrl: logoDataUrl || null,
    heroTitle: businessName || subdomain,
    heroText: description || 'Autogenereret website fra SEO-generator.',
    heroImageUrl: sanitizeString(config?.heroImageUrl || '', 2000) || null,
    ctaText: sanitizeString(config?.ctaText || '', 120) || null,
    ctaUrl: sanitizeString(config?.ctaUrl || '', 500) || null,
    phone: sanitizeString(config?.phone || '', 80) || null,
    address: sanitizeString(config?.address || '', 220) || null,
    themePrimary: sanitizeString(config?.theme?.primary || '', 20) || '#1f7a3d',
    themeSecondary: sanitizeString(config?.theme?.secondary || '', 20) || '#f8f4ea',
    themeAccent: sanitizeString(config?.theme?.accent || '', 20) || '#b91c1c',
    themeText: sanitizeString(config?.theme?.text || '', 20) || '#1f2937',
    status: 'published',
    seoPreviewEnabled: true,
    seoModuleActive: true,
    customDomain: null,
    updatedAt: FieldValue.serverTimestamp(),
    activatedBy: activatedByUid
  }, { merge: true });

  const pages = buildSeoLandingPages(config, pageCount);
  const batch = db.batch();

  pages.forEach((page, index) => {
    const pageId = toDocSafeId(`${websiteId}__${page.slug}`);
    const pageRef = db.collection('seo_pages').doc(pageId);
    batch.set(pageRef, {
      organizationId: companyId,
      companyId,
      locationId,
      websiteId,
      subdomain,
      slug: page.slug,
      url: `https://${subdomain}.madkontrollen.dk/${page.slug}`,
      keyword: page.keyword,
      title: page.title,
      metaDescription: page.metaDescription,
      h1: page.h1,
      h2: page.h2,
      h3: page.h3,
      canonicalPath: page.canonicalPath,
      sourceTitle: page.sourceTitle,
      ordering: index + 1,
      status: 'published',
      generatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      generatedBy: activatedByUid
    }, { merge: true });
  });

  await batch.commit();

  return {
    websiteId,
    generatedPages: pages.length,
    subdomain
  };
}

async function publishLandingSite({ companyId, locationId, siteConfig }) {
  console.log(`🚀 Publishing landing site for ${siteConfig.subdomain}...`);

  try {
    const result = await upsertWebsiteAndSeoPages({
      companyId,
      locationId,
      config: siteConfig,
      activatedByUid: 'script_activation'
    });

    console.log('✅ Landing site published!');
    console.log('📊 Result:', result);
    console.log(`🌐 URL: https://${result.subdomain}.madkontrollen.dk`);
    
    return result;
  } catch (error) {
    console.error('❌ Publish failed:', error);
    throw error;
  }
}

const args = process.argv.slice(2);
const configFile = args[0];

if (!configFile) {
  console.error('Usage: node publishLandingSite.js <config-file.json>');
  process.exit(1);
}

const config = JSON.parse(readFileSync(configFile, 'utf8'));

publishLandingSite(config)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
