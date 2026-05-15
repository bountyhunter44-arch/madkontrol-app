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

## Not Moved In Phase 1

- No existing imports changed.
- No Firebase functions moved.
- No UI code moved.
- No generated public pages deleted.
- No deployment or hosting config changed.
