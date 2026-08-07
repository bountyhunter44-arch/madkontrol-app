// Madkontrollen – dashboard EWCP-modulkatalog (2026-08-08).
//
// Dashboardet viser det fælles EWCP-modulkatalog gennem den EKSISTERENDE generiske renderer.
// Kun verificeret-genoprettede moduler med en reachable destination er aktive katalog-entries:
//   egenkontrol (lokalt i monolitten) · pos (https://pos.madkontrollen.dk) · accounting (https://regnskab.ewcp.dk).
// Ejerskab er entitlement-drevet (activeModules fra subscription.selectedModules), ALDRIG hardkodet.
// "Se mere"/åbn for pos/accounting går til modulets eget domæne — aldrig Madkontrollen quick-onboarding/checkout.
// Quick-onboarding er uændret single-product: selectedModules = ["egenkontrol"].
// Holdte moduler (lagerkontrol, delefragt, koerselskontrol, legacy) er IKKE aktiveret (intet dødt link).
//
// STATISK kildekode-kontrol.
//   node --test tests/dashboard-ewcp-catalog.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const P = (rel) => fileURLToPath(new URL("../public/" + rel, import.meta.url));
const read = (rel) => readFileSync(P(rel), "utf8");

const appReg = read("platform/app-registry.js");
const showcase = read("platform/module-showcase.js");
const dash = read("dashboard.html");
const moduleAccess = read("core/module-access.js");
const onboarding = read("modules/egenkontrol/egenkontrol-onboarding.js");
const quick = read("quick-onboarding.html");

// Isolér en top-level showcase-entry ("  <key>: { ... },") for præcise per-modul-assertions.
function showcaseBlock(key) {
  const start = showcase.indexOf(`\n  ${key}: {`);
  assert.ok(start >= 0, `showcase-entry mangler: ${key}`);
  const end = showcase.indexOf("\n  },", start);
  assert.ok(end > start, `showcase-entry ikke afsluttet: ${key}`);
  return showcase.slice(start, end);
}

test("A. Katalog-data: Egenkontrol + POS + Regnskab findes i begge registre", () => {
  assert.ok(showcase.includes('MODULE_SHOWCASE_ORDER = ["egenkontrol", "pos", "accounting"]'), "showcase-order");
  for (const k of ["egenkontrol", "pos", "accounting"]) {
    assert.ok(showcase.includes(`\n  ${k}: {`), `showcase-entry: ${k}`);
    assert.ok(appReg.includes(`appKey: "${k}"`), `app-registry-entry: ${k}`);
  }
});

test("B. POS + Regnskab renderes gennem den SAMME generiske renderer (ingen særlogik)", () => {
  // Den generiske renderer er intakt.
  for (const fn of ["function renderActiveModules", "function renderModuleCatalog", "function getRegistryAppForModule", "getModuleShowcases()"]) {
    assert.ok(dash.includes(fn), `generisk renderer bevaret: ${fn}`);
  }
  // Ingen modul-specifik særlogik/URL i dashboardet — destinationer kommer fra registry.
  assert.ok(!dash.includes("pos.madkontrollen.dk"), "POS-URL må ikke hardkodes i dashboard.html");
  assert.ok(!dash.includes("regnskab.ewcp.dk"), "Regnskab-URL må ikke hardkodes i dashboard.html");
  assert.ok(!/===\s*["'](pos|accounting)["']/.test(dash), "ingen === \"pos\"/\"accounting\" særlogik i renderer");
  assert.ok(!/pos-card|accounting-card|renderPosCard|renderAccountingCard/i.test(dash), "ingen særskilt POS/accounting-kortkode");
});

test("C. Ejerskab er entitlement-drevet (ikke hardkodet)", () => {
  // Kilden til aktive moduler er stadig subscription.selectedModules (normaliseret).
  assert.ok(moduleAccess.includes("normalizeModuleKeys(subscription.selectedModules)"), "entitlement-kilde uændret");
  assert.ok(showcase.includes("export function moduleIsActive"), "generisk ejerskabsafgørelse");
  // accounting matcher det normaliserede entitlement 'bogforing' (ingen ny parallel key).
  assert.ok(showcaseBlock("accounting").includes('activeKeys: ["accounting", "bogforing"]'), "accounting activeKeys ⊇ bogforing");
  // Intet hardkodet ejerskab i registerdata.
  assert.ok(!/\bowned:\s*true|isOwned:\s*true|status:\s*["']owned["']/.test(appReg + showcase), "ingen hardkodet ejet-status");
});

test("D. Ikke-ejede POS/Regnskab starter IKKE Madkontrollen checkout", () => {
  // getModulePurchaseUrl returnerer landingPage FØR quick-onboarding-grenen.
  assert.ok(showcase.includes("if (showcase?.landingPage) return showcase.landingPage"), "landingPage har forrang");
  for (const [k, url] of [["pos", "https://pos.madkontrollen.dk"], ["accounting", "https://regnskab.ewcp.dk"]]) {
    const b = showcaseBlock(k);
    assert.ok(b.includes(`landingPage: "${url}"`), `${k}: landingPage = verificeret domæne`);
    assert.ok(b.includes(`entryUrl: "${url}"`), `${k}: entryUrl = verificeret domæne`);
    assert.ok(!b.includes("checkoutModuleKey"), `${k}: BEVIDST ingen checkoutModuleKey`);
    assert.ok(!b.includes("quick-onboarding"), `${k}: ingen quick-onboarding-destination`);
  }
});

test("E. Quick-onboarding uændret: single-product egenkontrol", () => {
  assert.ok(onboarding.includes('selectedModules: ["egenkontrol"]'), "selectedModules = [egenkontrol]");
  assert.ok(!/modulvælger|module-select/i.test(onboarding), "ingen modulvælger");
  assert.ok(!onboarding.includes("pos.madkontrollen.dk") && !onboarding.includes("regnskab.ewcp.dk"), "ingen modul-URLs i onboarding");
  assert.ok(!/selectedModules:\s*\[[^\]]*(pos|accounting|bogforing)/.test(onboarding), "ingen pos/accounting i onboarding-payload");
  assert.ok(onboarding.includes("PRICE_EX_VAT = 149"), "pris uændret (kun Madkontrollen Pro)");
  for (const f of ['name="selectedModules"', "data-module-slug"]) {
    assert.ok(!quick.includes(f), `quick-onboarding uden modulvælger-felt: ${f}`);
  }
});

test("F. Holdte moduler er IKKE aktiveret (PARTIAL/standalone/legacy)", () => {
  for (const k of ["lagerkontrol", "delefragt", "koerselskontrol", "seo", "menu", "recipes", "calculation", "crm"]) {
    assert.ok(!appReg.includes(`appKey: "${k}"`), `app-registry må ikke aktivere holdt modul: ${k}`);
    assert.ok(!showcase.includes(`\n  ${k}: {`), `showcase må ikke aktivere holdt modul: ${k}`);
  }
});

test("G. Genoprettede entryUrls er verificerede eksterne https (ingen død lokal sti)", () => {
  assert.ok(appReg.includes('entryUrl: "https://pos.madkontrollen.dk"'), "pos entryUrl");
  assert.ok(appReg.includes('entryUrl: "https://regnskab.ewcp.dk"'), "accounting entryUrl");
  assert.ok(!/entryUrl:\s*"\/modules\/(pos|accounting)\//.test(appReg), "ingen død lokal /modules/-sti");
});

test("H. Program/checks/no-upload uændret (sanity)", () => {
  assert.ok(onboarding.includes("function renderProgramPoint") && onboarding.includes("PROGRAM_SECTIONS"), "13-program intakt");
  assert.ok(onboarding.includes("CHECK_UI_STEPS"), "checks 6-trins intakt");
  assert.ok(!/data-upload|getCloudinarySignature/.test(onboarding), "no-upload bevaret");
});
