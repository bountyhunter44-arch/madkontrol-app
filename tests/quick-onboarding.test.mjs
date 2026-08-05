// Madkontrollen canonical Quick onboarding — invariants (2026-08-03).
//
// /quick-onboarding.html er den offentlige canonical onboardingformular. Den viser
// den FAKTISKE formular via den DELTE komponent (public/modules/egenkontrol/
// egenkontrol-onboarding.js), som også bruges af /modules/egenkontrol/onboarding.html.
// Ingen modulvalg. Ingen gratis createQuickOnboardingAccount. Ingen meta-refresh/redirect.
// Genbruger den eksisterende Stripe Checkout (createOnboardingCheckoutSession) → tak.html
// → risikoanalyse.
//
// STATISK kildekode-kontrol (ikke en Stripe-E2E-test).
//   node --test tests/quick-onboarding.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const P = (rel) => fileURLToPath(new URL("../public/" + rel, import.meta.url));
const read = (rel) => readFileSync(P(rel), "utf8");

const QUICK = "quick-onboarding.html";
const MODULES = "modules/egenkontrol/onboarding.html";
const SHARED_JS = "modules/egenkontrol/egenkontrol-onboarding.js";
const SHARED_CSS = "modules/egenkontrol/egenkontrol-onboarding.css";
const ROOT_OB = "onboarding.html";

const quick = read(QUICK);
const shared = read(SHARED_JS);
const modules = read(MODULES);
const rootOb = read(ROOT_OB);
const tak = read("tak.html");
const idx = read("index.html");

test("1. Quick onboarding er en REEL formular (ikke en redirect)", () => {
  for (const id of ['id="stepContent"', 'id="stepNav"', 'id="submitBtn"', 'id="nextStepBtn"', 'id="prevStepBtn"']) {
    assert.ok(quick.includes(id), `quick-onboarding.html skal have ${id}`);
  }
  assert.ok(quick.includes('src="/modules/egenkontrol/egenkontrol-onboarding.js"'), "loader den delte komponent");
});

test("2-5. Den delte komponent har virksomheds-, enheds-, aktivitets- og risikovalg", () => {
  assert.ok(/function renderCompanyStep\(/.test(shared) && /id="company_name"/.test(shared) && /id="company_cvr"/.test(shared) && /id="company_type"/.test(shared), "virksomhedsvalg");
  assert.ok(/function renderEquipmentStep\(/.test(shared), "enheds-/udstyrsvalg");
  assert.ok(/function renderProductionStep\(/.test(shared), "aktivitets-/produktionsvalg");
  assert.ok(/function renderChecksStep\(/.test(shared), "risiko-/kontrolpunktsvalg");
});

test("6. Intet modulvalg (hverken i siden eller i den delte komponent)", () => {
  for (const src of [quick, shared]) {
    for (const forbidden of ['data-module-slug', "Vælg moduler", 'name="selectedModules"', "getSelectedModules", "module-grid"]) {
      assert.ok(!src.includes(forbidden), `må ikke indeholde brugerstyret modulvalg: "${forbidden}"`);
    }
  }
  // Fast intern provisioningværdi er tilladt:
  assert.ok(shared.includes('selectedModules: ["egenkontrol"]'), "fast intern egenkontrol-værdi bevaret");
});

test("7-9. Ingen gratis account-flow / modul-redirect-symboler", () => {
  for (const src of [quick, shared]) {
    for (const forbidden of ["createQuickOnboardingAccount", "firstModule", "moduleEntryUrl"]) {
      assert.ok(!src.includes(forbidden), `må ikke referere "${forbidden}"`);
    }
  }
});

test("10. Den delte komponent genbruges af begge sider (ingen duplikeret logik)", () => {
  assert.ok(quick.includes('/modules/egenkontrol/egenkontrol-onboarding.js'), "quick loader den delte komponent (absolut)");
  assert.ok(modules.includes('./egenkontrol-onboarding.js'), "modul-siden loader den delte komponent (relativ)");
  assert.ok(existsSync(P(SHARED_JS)) && existsSync(P(SHARED_CSS)), "delte filer findes");
  // Modul-siden må ikke længere have sin egen store inline module-logik:
  assert.ok(!/<script type="module">[\s\S]*createOnboardingCheckoutSession/.test(modules), "ingen stor inline onboardinglogik i modul-siden");
  assert.ok(!/<script type="module">[\s\S]*renderCompanyStep/.test(quick), "ingen stor inline onboardinglogik i quick-siden");
});

test("11-12. Genbruger eksisterende Stripe Checkout + tak-success", () => {
  assert.ok(shared.includes('httpsCallable(') && shared.includes('"createOnboardingCheckoutSession"'), "kalder createOnboardingCheckoutSession");
  assert.ok(/successUrl:\s*`\$\{window\.location\.origin\}\/tak\.html`/.test(shared), "success går til /tak.html");
});

test("13-16. tak.html: session_id, provisionering, risikoanalyse bundet til company/location", () => {
  assert.ok(/session_id/.test(tak), "session_id bevares/læses");
  assert.ok(tak.includes("finalizeOnboardingCheckoutProvisioning"), "provisioneringsfunktion i kæden");
  assert.ok(/risikoanalyse/i.test(tak), "risikoanalyse genereres");
  assert.ok(/companyId/.test(tak) && /company\/location|locationId/.test(tak), "bindes til company/location");
  assert.ok(/companyId/.test(shared) && /locationId/.test(shared), "onboarding-payload bærer companyId + locationId");
});

test("17. Forsidens CTA'er peger på /quick-onboarding.html", () => {
  assert.ok(/href="\/quick-onboarding\.html"/.test(idx), "mindst én CTA til /quick-onboarding.html");
  assert.ok(!/href="[^"]*\/modules\/[a-z]+\/index\.html"[^>]*>\s*(Kom i gang|Start onboarding)/i.test(idx), "ingen CTA direkte til et modul");
});

test("18. Root /onboarding.html er ikke længere brudt", () => {
  assert.ok(!rootOb.includes('"./onboardingService.js"'), "ingen brudt ./onboardingService.js-import");
  assert.ok(/name="robots"[^>]*noindex,\s*follow/i.test(rootOb), "noindex,follow");
  assert.ok(rootOb.includes("/quick-onboarding.html"), "linker til den canonical formular");
  assert.ok(!/http-equiv=["']refresh["']/i.test(rootOb), "ingen meta-refresh");
});

test("19. Modul-onboarding-URL findes fortsat (kompatibel, ingen 404)", () => {
  assert.ok(existsSync(P(MODULES)), "modules/egenkontrol/onboarding.html findes");
  assert.ok(modules.includes("egenkontrol-onboarding.js"), "er en wrapper om den delte komponent");
});

test("20. Ingen /login.html-links i onboarding-fladen", () => {
  for (const [name, src] of [["quick", quick], ["root", rootOb], ["modules", modules]]) {
    assert.ok(!src.includes("/login.html"), `${name} må ikke linke til den ikke-eksisterende /login.html`);
  }
  assert.ok(!existsSync(P("login.html")), "der findes ingen /login.html (login via modal)");
});

test("21. Footer-loginmodal findes på forsiden", () => {
  assert.ok(/footerLoginModalBtn/.test(idx), "footer-login-modal-knap");
});

test("22. Ingen POS-links i onboarding", () => {
  for (const src of [quick, shared, modules]) {
    assert.ok(!/madkontrollen-pos|\/pos\//i.test(src), "ingen POS-link i onboarding");
  }
});

test("23-24. Quick onboarding: ingen meta-refresh + noindex,follow", () => {
  assert.ok(!/http-equiv=["']refresh["']/i.test(quick), "ingen meta-refresh");
  assert.ok(!/window\.location\.(replace|href)\s*=/.test(quick.replace(shared, "")), "ingen redirect-only JS i quick-siden");
  assert.ok(/name="robots"[^>]*noindex,\s*follow/i.test(quick), "noindex,follow");
});

test("25. Quick onboarding ligger ikke i sitemap.xml", () => {
  const sm = read("sitemap.xml");
  assert.ok(!sm.includes("quick-onboarding"), "quick-onboarding må ikke være i sitemap");
});
