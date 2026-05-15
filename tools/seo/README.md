# MadCore SEO Toolbox

Phase 1 extracts the Madkontrollen SEO engine into a shared toolbox foundation without changing current runtime imports.

## Rules

- Core code must be tenant-aware.
- Core code must not depend on Madkontrollen UI.
- Firebase and Firestore belong in adapters, not core.
- Publisher targets are adapter contracts: `firestore-draft`, `firebase-hosting`, `vps-static`, `wordpress`, `future-social`.
- Existing app files remain the active runtime until a later migration switches imports.

## Structure

- `generator/` - shared generation primitives with no browser or Firebase dependency.
- `publisher/` - publisher adapter contracts and target docs.
- `adapters/` - app/platform adapters such as Firestore drafts.
- `schema/` - shared tenant/page contract schemas.
- `templates/` - HTML/template assets for future extraction.
- `themes/` - tenant-neutral theme presets for future extraction.
- `prompts/` - SEO prompt contracts for future extraction.
- `docs/` - audit, migration, and classification notes.

## Contracts

Tenant SEO config and SEO page objects are documented in `schema/tenant-seo-config.schema.json` and `schema/seo-page.schema.json`.

## Current Runtime

The active Madkontrollen implementation still lives in:

- `public/modules/seo/generator.html`
- `public/modules/seo/generator/generator-core.js`
- `public/modules/seo/generator/generator-runner.js`
- `functions/index.js`
- `scripts/build-landing-pages.cjs`
- `scripts/publishLandingSite.js`

This toolbox is intentionally additive in phase 1.
