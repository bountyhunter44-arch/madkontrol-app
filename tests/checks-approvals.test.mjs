// Madkontrollen – "Diverse, vedligeholdelse og årlig kontrol": 6 UI-trin over 16 items (2026-08-07).
//
// CHECK_UI_STEPS er KUN en præsentationsgruppering: de 3 CHECK_SECTIONS, deres 16 items,
// keys, state-paths og generator-payload er uændrede. UX-progress er runtime.
//
// STATISK kildekode-kontrol.
//   node --test tests/checks-approvals.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const P = (rel) => fileURLToPath(new URL("../public/" + rel, import.meta.url));
const js = readFileSync(P("modules/egenkontrol/egenkontrol-onboarding.js"), "utf8");

// Forventet faktisk datakilde (accepteret audit)
const EXPECTED = { apv_update: 1, maintenance_pest: 6, annual_review: 9 }; // items pr. sektion

function checkUiBlock() {
  const s = js.indexOf("const CHECK_UI_STEPS = [");
  const e = js.indexOf("];", s);
  assert.ok(s >= 0 && e > s, "CHECK_UI_STEPS findes");
  return js.slice(s, e);
}
function uiPairs() {
  const block = checkUiBlock();
  const pairs = [];
  const re = /\["(\w+)",\s*(\d+)\]/g;
  let m;
  while ((m = re.exec(block)) !== null) pairs.push([m[1], Number(m[2])]);
  return pairs;
}

test("1. Der er præcis 6 UI-trin", () => {
  const titles = (checkUiBlock().match(/title:\s*"/g) || []).length;
  assert.equal(titles, 6, "6 CHECK_UI_STEPS");
});

test("2. Alle 16 items er repræsenteret præcis én gang (ingen dubletter/manglende)", () => {
  const pairs = uiPairs();
  assert.equal(pairs.length, 16, `forventede 16 item-referencer, fandt ${pairs.length}`);
  const seen = new Set();
  for (const [k, i] of pairs) {
    const id = `${k}#${i}`;
    assert.ok(!seen.has(id), `dublet: ${id}`);
    seen.add(id);
  }
  // dækning == præcis de eksisterende items
  const cover = {};
  for (const [k, i] of pairs) (cover[k] = cover[k] || new Set()).add(i);
  for (const [key, count] of Object.entries(EXPECTED)) {
    const set = cover[key] || new Set();
    assert.equal(set.size, count, `${key}: forventede ${count} items, fandt ${set.size}`);
    for (let i = 0; i < count; i++) assert.ok(set.has(i), `${key}[${i}] mangler i UI-trin`);
  }
});

test("3. Referencer peger kun på gyldige CHECK_SECTION-keys + index i range", () => {
  for (const [k, i] of uiPairs()) {
    assert.ok(Object.prototype.hasOwnProperty.call(EXPECTED, k), `ugyldig section-key: ${k}`);
    assert.ok(i >= 0 && i < EXPECTED[k], `${k}[${i}] uden for range (0..${EXPECTED[k] - 1})`);
  }
});

test("4. Total udledes dynamisk (CHECK_UI_STEPS.length), ingen hardkodet 6 i checks-logik", () => {
  assert.ok(js.includes("new Array(CHECK_UI_STEPS.length)"), "checksUiDone = CHECK_UI_STEPS.length");
  assert.ok(js.includes("const total = CHECK_UI_STEPS.length"), "total = CHECK_UI_STEPS.length");
});

test("5. Svar skrives til EKSISTERENDE state-paths (uændret answers-model)", () => {
  assert.ok(js.includes('data-check-section="${escapeHtml(sectionKey)}"'), "renderCheckItem bruger data-check-section");
  assert.ok(js.includes("state.checks[sectionKey].answers[index].value = btn.dataset.checkValue"), "value-path uændret");
  assert.ok(js.includes("state.checks[sectionKey].answers[index].comment = textarea.value"), "comment-path uændret");
});

test("6. Ét UI-trin ad gangen + auto-advance", () => {
  assert.ok(js.includes("function renderCheckUiStep"), "renderCheckUiStep");
  assert.ok(js.includes("function firstIncompleteCheckUiStep"), "firstIncompleteCheckUiStep");
  assert.ok(/const nextInc = firstIncompleteCheckUiStep\(\);[\s\S]*checksCursor = nextInc;[\s\S]*renderCheckUiStep\(\)/.test(js), "auto-advance til næste ufuldstændige");
  assert.ok(js.includes("data-checkui-approve"), "Godkend og fortsæt");
});

test("7. Fremtidige trin kan ikke springes til", () => {
  assert.ok(js.includes("const reachable = done || i <= frontier"), "kun done/frontier klikbare");
  assert.ok(/data-checkui-goto[\s\S]*hasAttribute\("disabled"\)/.test(js), "disabled goto ignoreres");
});

test("8. Tilbage + Ret/edit", () => {
  assert.ok(js.includes("data-checkui-back"), "tilbage");
  assert.ok(js.includes("data-checkui-edit"), "Ret");
  assert.ok(js.includes("function renderChecksDone"), "done-view");
  assert.ok(js.includes("checksEditFromDone"), "edit-tilstand");
});

test("9. Efter 6/6 → eksisterende summary-step (verificeret via section approvals)", () => {
  assert.ok(js.includes("function goToSummaryFromChecks"), "goToSummaryFromChecks");
  assert.ok(/goToSummaryFromChecks\(\)\s*\{[\s\S]*if \(!allChecksApproved\(\)\)/.test(js), "gate: alle sektioner godkendt");
  assert.ok(js.includes('state.currentStep = STEP_DEFS.findIndex((s) => s.key === "summary")'), "sætter summary-trin");
});

test("10. De 3 eksisterende CHECK_SECTIONS + section.approved bevaret", () => {
  for (const k of ["apv_update", "maintenance_pest", "annual_review"]) {
    assert.ok(js.includes(`key: "${k}"`), `sektion bevaret: ${k}`);
  }
  assert.ok(js.includes("state.checks[section.key].approved = true"), "eksisterende approved-flag sættes");
  assert.ok(!/checkStep\d+Approved|checkUiApproved/.test(js), "ingen nye persistente approval-felter");
});

test("11. Generator-input/checkout-payload uændret", () => {
  assert.ok(js.includes("checks: state.checks"), "payload bruger state.checks direkte");
  assert.ok(js.includes("createOnboardingCheckoutSessionCallable(payload)"), "checkout-kald");
  assert.ok(js.includes("PRICE_EX_VAT = 149"), "pris uændret");
});

test("12. No-upload bevaret + 13-punkts program uændret", () => {
  assert.ok(!/data-upload|getCloudinarySignature/.test(js), "ingen upload/Cloudinary");
  assert.ok(js.includes("function renderProgramPoint"), "program ét-punkt-flow intakt");
  for (const k of ["separation_fridge", "hot_holding_method"]) assert.ok(js.includes(`key: "${k}"`), `program-key: ${k}`);
});
