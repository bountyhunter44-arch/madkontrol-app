// Madkontrollen – onboarding 4-fase-omgruppering (2026-08-07).
//
// Den delte egenkontrol-onboarding-komponent præsenterer de 6 INTERNE trin som 4 UI-faser.
// Denne test beskytter BÅDE den nye 4-fase-visning OG at payload/checkout/backend-kontrakt
// og den interne 6-trins state-maskine er uændret.
//
// STATISK kildekode-kontrol (læser filer, ingen runtime).
//   node --test tests/onboarding-4-phase.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const P = (rel) => fileURLToPath(new URL("../public/" + rel, import.meta.url));
const read = (rel) => readFileSync(P(rel), "utf8");

const js = read("modules/egenkontrol/egenkontrol-onboarding.js");
const css = read("modules/egenkontrol/egenkontrol-onboarding.css");
const quick = read("quick-onboarding.html");
const modulePage = read("modules/egenkontrol/onboarding.html");

test("1. De 6 interne STEP_DEFS-trin er bevaret", () => {
  for (const key of ["company", "production", "equipment", "program", "checks", "summary"]) {
    assert.ok(js.includes(`key: "${key}"`), `internt trin bevaret: ${key}`);
  }
});

test("2. PHASE_DEFS definerer præcis 4 UI-faser", () => {
  const titles = ["Virksomhed", "Enheder og aktiviteter", "Risikoprofil", "Gennemse og betal"];
  for (const t of titles) assert.ok(js.includes(`title: "${t}"`), `fase-titel: ${t}`);
});

test("3. Faserne dækker alle 6 interne trin i korrekt gruppering", () => {
  assert.ok(js.includes('steps: ["company"]'), "fase 1 = company");
  assert.ok(js.includes('steps: ["production", "equipment"]'), "fase 2 = production+equipment");
  assert.ok(js.includes('steps: ["program", "checks"]'), "fase 3 = program+checks");
  assert.ok(js.includes('steps: ["summary"]'), "fase 4 = summary");
});

test("4. Progress viser fase 'Trin X af 4' (ikke internt x/6)", () => {
  assert.ok(js.includes("af ${PHASE_DEFS.length}"), "progress bruger PHASE_DEFS.length");
  assert.ok(js.includes("Trin ${phaseIdx + 1} af"), "progress viser fase-nummer");
  assert.ok(!/progressValueEl\.textContent = `\$\{human\} \/ \$\{STEP_DEFS\.length\}`/.test(js), "gammelt x/6-format er væk");
});

test("5. Trin-nav rendrer 4 faser (data-phase-index), ikke 6 trin", () => {
  assert.ok(js.includes("data-phase-index"), "nav bruger data-phase-index");
  assert.ok(!js.includes("data-step-index"), "gammelt data-step-index er væk");
});

test("6. Begge shells viser fase-default 'Trin 1 af 4' og ikke '1 / 6'", () => {
  for (const [name, html] of [["quick-onboarding", quick], ["module onboarding", modulePage]]) {
    assert.ok(html.includes('id="progressValue">Trin 1 af 4<'), `${name} progress-default`);
    assert.ok(!html.includes("1 / 6"), `${name} intet 1/6`);
  }
});

test("7. Checkout-kontrakten er uændret (payload + createOnboardingCheckoutSession)", () => {
  assert.ok(js.includes("createOnboardingCheckoutSessionCallable(payload)"), "checkout-kald bevaret");
  assert.ok(js.includes('selectedModules: ["egenkontrol"]'), "selectedModules bevaret");
  assert.ok(js.includes("billingPlan: billingPlan"), "billingPlan bevaret");
  for (const f of ["company:", "profile:", "business:", "equipment:", "sections:", "checks:"]) {
    assert.ok(js.includes(f), `payload-felt bevaret: ${f}`);
  }
});

test("8. Success-route er uændret (/tak.html)", () => {
  assert.ok(js.includes("${window.location.origin}/tak.html"), "successUrl = /tak.html");
});

test("9. Ingen ny hardkodet pris — eksisterende PRICE_EX_VAT er source", () => {
  assert.ok(js.includes("PRICE_EX_VAT = 149"), "PRICE_EX_VAT bevaret");
  assert.ok(js.includes("VAT_RATE = 0.25"), "VAT_RATE bevaret");
});

test("10. Begge sider bruger fortsat den delte komponent", () => {
  assert.ok(quick.includes("/modules/egenkontrol/egenkontrol-onboarding.js"), "quick loader delt komponent");
  assert.ok(modulePage.includes("./egenkontrol-onboarding.js"), "modulside loader delt komponent");
});

test("11. quick-onboarding er fortsat noindex", () => {
  assert.ok(/<meta name="robots" content="noindex/.test(quick), "quick noindex");
});

test("12. a11y: fokus-flyt til overskrift + synligt :focus-visible", () => {
  assert.ok(js.includes("function focusStepHeading"), "focusStepHeading findes");
  assert.ok((js.match(/focusStepHeading\(\)/g) || []).length >= 3, "kaldes ved trinskift");
  assert.ok(css.includes(":focus-visible"), ":focus-visible i CSS");
});

test("13. Ingen modulvælger indført i quick onboarding", () => {
  assert.ok(!/vælg modul|module-select|modulvælger|selectModule/i.test(quick), "ingen modulvælger");
});
