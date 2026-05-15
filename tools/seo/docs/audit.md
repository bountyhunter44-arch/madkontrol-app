# SEO Extraction Audit

Date: 2026-05-15

## Generic SEO Core Candidates

- `public/modules/seo/generator/generator-core.js`
  - Generates pages, sitemap, and robots from a config.
  - Browser/Firebase independent, but currently hardcodes `madkontrollen.dk` subdomains and Danish defaults.
- `scripts/build-landing-pages.cjs`
  - Static renderer for landing page template, sitemap, and robots.
  - Node runtime; writes to `public`.
- `public/landing-pages/template-renderer.js`
  - Browser runtime placeholder renderer.

## Madkontrollen-Specific

- `public/modules/seo/generator.html`
  - Combined UI, preview renderer, onboarding/profile prefill, Firebase callable usage, restaurant-specific copy, themes, image search, and checkout finalization.
- `landing-page-template.html`
  - Madkontrollen-branded landing page template.
- `landing-pages-config.json`
  - App-specific seed config.
- `public/landing.html`
  - App landing surface.
- `public/landing-pages/aroi-d/index.html`
  - Generated tenant/site page.

## Firebase/Firestore Adapter

- `functions/index.js::persistSeoGeneratorConfig`
  - Writes `seo_generator_configs`.
- `functions/index.js::finalizeSeoCheckoutProvisioning`
  - Verifies checkout and activates SEO module.
- `functions/index.js::adminActivateSeoSite`
  - Admin activation path.
- `functions/index.js::upsertWebsiteAndSeoPages`
  - Writes `websites` and `seo_pages`.
- `functions/index.js::saveRestaurantHeroImage`
  - Writes `seo_hero_images`.
- `functions/index.js::enhanceAndUploadRestaurantImage`
  - Uploads to Cloudinary, writes `seo_hero_images`, updates `websites`.
- `scripts/publishLandingSite.js`
  - Node Firestore publisher for website and SEO pages.

## Browser/UI

- `public/modules/seo/generator.html`
  - Main generator UI and preview.
- `public/modules/seo/generator/generator-runner.js`
  - Browser runner/logger around core generation.
- `public/modules/seo/generator/generator-awning-functions.js`
  - Browser DOM/SVG awning helper.
- `functions/public/modules/seo/*`
  - Deployed/static mirror of public SEO files.

## Backend/Functions

- `functions/index.js::buildSeoLandingPages`
- `functions/index.js::upsertWebsiteAndSeoPages`
- `functions/index.js::persistSeoGeneratorConfig`
- `functions/index.js::finalizeSeoCheckoutProvisioning`
- `functions/index.js::adminActivateSeoSite`
- `functions/index.js::seoSiteRenderer`
- `functions/index.js::searchRestaurantImages`
- `functions/index.js::saveRestaurantHeroImage`
- `functions/index.js::enhanceAndUploadRestaurantImage`
- `functions/index.js::generateSeoAiSuggestions`
- `functions/index.js::extractSeoRelevantText`
- `functions/index.js::buildSeoAiPrompt`

## Publisher/Rendering

- `functions/index.js::seoSiteRenderer`
  - HTTP renderer for published subdomain pages.
- `scripts/build-landing-pages.cjs`
  - Static file publisher.
- `scripts/publishLandingSite.js`
  - Firestore publisher.

## Phase 3 Sitemap/Robots Classification

### Pure Shared Logic

- `tools/seo/publisher/sitemap.js::generateSitemap`
  - Pure ESM helper.
  - Takes config/domain and page list as input.
  - Returns XML string.
  - No Firebase dependency.
- `tools/seo/publisher/robots.js::generateRobots`
  - Pure ESM helper.
  - Takes domain/config as input.
  - Returns robots.txt string.
  - No Firebase dependency.

### App-Specific Logic

- `public/modules/seo/generator/generator-core.js::generateSitemap`
  - Still hardcodes `https://${config.subdomain}.madkontrollen.dk`.
- `public/modules/seo/generator/generator-core.js::generateRobots`
  - Still hardcodes Madkontrollen subdomain sitemap URL.
- `scripts/build-landing-pages.cjs::generateSitemap`
  - Uses `https://madkontrollen.dk` and `/landing-pages/${slug}/`.
- `scripts/build-landing-pages.cjs::generateRobotsTxt`
  - Uses `https://madkontrollen.dk/sitemap.xml`.

### Firebase Adapter Logic

- `scripts/publishLandingSite.js`
  - Initializes Firebase Admin.
  - Writes `websites` and `seo_pages`.
  - Not moved in phase 3.

### Publish/Runtime Logic

- `scripts/build-landing-pages.cjs`
  - Writes `public/sitemap.xml` and `public/robots.txt`.
- `public/sitemap.xml`
  - Generated static runtime artifact.
- `public/robots.txt`
  - Generated static runtime artifact.

## Not Moved In Phase 1

- No existing imports changed.
- No Firebase functions moved.
- No UI code moved.
- No generated public pages deleted.
- No deployment or hosting config changed.
