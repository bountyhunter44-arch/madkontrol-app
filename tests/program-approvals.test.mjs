// Madkontrollen – EGENKONTROLPROGRAM: ét punkt ad gangen (2026-08-07).
//
// De 13 programgodkendelser vises nu ét ad gangen i samme faste arbejdsfelt, sekventielt,
// med afledt total, gate til checks og redigering af tidligere punkter. Punkt-ID'er, felter,
// godkendelsesværdier, payload og checkoutkontrakt er UÆNDREDE.
//
// STATISK kildekode-kontrol (læser filer, ingen runtime).
//   node --test tests/program-approvals.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const P = (rel) => fileURLToPath(new URL("../public/" + rel, import.meta.url));
const read = (rel) => readFileSync(P(rel), "utf8");
const js = read("modules/egenkontrol/egenkontrol-onboarding.js");
const css = read("modules/egenkontrol/egenkontrol-onboarding.css");

const PROGRAM_KEYS = [
  "separation_fridge", "company_description", "cooling_method", "storage_foods",
  "heating_method", "personal_hygiene", "cleaning_program", "revision_program",
  "traceability_program", "recall_program", "receiving_control", "delivery_control",
  "hot_holding_method",
];

test("1. Alle 13 eksisterende programpunkter (stabile ID'er) findes stadig", () => {
  for (const k of PROGRAM_KEYS) assert.ok(js.includes(`key: "${k}"`), `program-ID bevaret: ${k}`);
});

test("2. Ét punkt ad gangen: renderProgramPoint viser ét PROGRAM_SECTIONS[cursor]", () => {
  assert.ok(js.includes("function renderProgramPoint"), "renderProgramPoint findes");
  assert.ok(js.includes("const section = PROGRAM_SECTIONS[idx]"), "viser ét punkt via cursor");
  // den gamle 'map alle sektioner ind i kort'-rendering er væk (brugte (section) =>)
  assert.ok(!js.includes("PROGRAM_SECTIONS.map((section)"), "ingen 13-i-én kortliste");
});

test("3. Første ikke-godkendte punkt åbnes ved indgang", () => {
  assert.ok(js.includes("function firstUnapprovedProgramIndex"), "helper findes");
  assert.ok(/renderProgramStep\(\)\s*\{[\s\S]*programCursor = firstUnapprovedProgramIndex\(\)/.test(js), "entry åbner første ikke-godkendte");
});

test("4. 'Godkend og fortsæt' opdaterer det eksisterende statefelt", () => {
  assert.ok(js.includes("state.sections[key].approved = true"), "opdaterer state.sections[key].approved");
  assert.ok(js.includes("data-program-approve"), "godkend-knap findes");
});

test("5. Næste punkt åbnes automatisk (uden ekstra Næste-klik)", () => {
  assert.ok(/const nextUn = firstUnapprovedProgramIndex\(\);[\s\S]*programCursor = nextUn;[\s\S]*renderProgramPoint\(\)/.test(js), "auto-advance til næste ikke-godkendte");
});

test("6. Progress '... af N' udledes af PROGRAM_SECTIONS (ingen hardkodet 13)", () => {
  assert.ok(js.includes("const total = PROGRAM_SECTIONS.length"), "total = PROGRAM_SECTIONS.length");
  assert.ok(js.includes("Egenkontrolprogram – ${idx + 1} af ${total}"), "progresstekst 'X af total'");
  assert.ok(!js.includes("af 13"), "ingen hardkodet 'af 13'");
});

test("7. Kan ikke springe frem til et ikke-godkendt punkt", () => {
  assert.ok(js.includes("const reachable = approved || i <= frontier"), "kun godkendte/frontier er klikbare");
  assert.ok(/data-program-goto[\s\S]*hasAttribute\("disabled"\)/.test(js), "disabled goto-knapper ignoreres");
});

test("8. Et godkendt tidligere punkt kan åbnes og rettes", () => {
  assert.ok(js.includes("data-program-edit"), "Ret-knap i færdig-status");
  assert.ok(js.includes("programEditFromDone"), "edit-tilstand findes");
  assert.ok(js.includes("function renderProgramDone"), "færdig-status med review/ret");
});

test("9. Tilbage-navigation fungerer (punkt + til produktion)", () => {
  assert.ok(js.includes("data-program-back"), "tilbage-knap findes");
  assert.ok(/programCursor -= 1;[\s\S]*renderProgramPoint\(\)/.test(js), "tilbage til forrige punkt");
  assert.ok(js.includes("function goToProductionFromProgram"), "første punkt tilbage til produktion");
});

test("10-11. Hovedflow gated: checks kræver alle punkter godkendt (eksisterende validering)", () => {
  assert.ok(js.includes("function goToChecksFromProgram"), "checks-overgang findes");
  assert.ok(/goToChecksFromProgram\(\)\s*\{[\s\S]*firstUnapprovedProgramIndex\(\) !== -1/.test(js), "gate: alle godkendt før checks");
});

test("12. Efter sidste gyldige godkendelse fortsættes til checks", () => {
  assert.ok(js.includes('state.currentStep = STEP_DEFS.findIndex((s) => s.key === "checks")'), "sætter internt trin til checks");
});

test("13. Payload- og checkoutkontrakt uændret", () => {
  assert.ok(js.includes("createOnboardingCheckoutSessionCallable(payload)"), "checkout-kald");
  assert.ok(js.includes('selectedModules: ["egenkontrol"]'), "selectedModules");
  assert.ok(js.includes("${window.location.origin}/tak.html"), "successUrl /tak.html");
  for (const f of ["company:", "profile:", "business:", "equipment:", "sections:", "checks:"]) {
    assert.ok(js.includes(f), `payload-felt: ${f}`);
  }
});

test("14. Firefasevisning + intern 6-trins state-maskine bevaret", () => {
  assert.ok(js.includes("const PHASE_DEFS"), "PHASE_DEFS (4 faser)");
  for (const k of ["company", "production", "equipment", "program", "checks", "summary"]) {
    assert.ok(js.includes(`key: "${k}"`), `internt trin: ${k}`);
  }
});

test("15. Ingen ny pris; ingen modulvælger", () => {
  assert.ok(js.includes("PRICE_EX_VAT = 149"), "eksisterende pris bevaret");
  assert.ok(!/modulvælger|module-select|vælg modul/i.test(js), "ingen modulvælger");
});

test("16. a11y: fokus til punktets overskrift + statussymboler (ikke kun farve)", () => {
  assert.ok(js.includes("function focusProgramHeading"), "fokus-flyt findes");
  assert.ok(js.includes('data-program-heading'), "overskrift-anker");
  assert.ok(js.includes('approved ? "✓"') && js.includes('"●"') && js.includes('"○"'), "symboler ✓ ● ○");
  assert.ok(css.includes(".pp-dot"), "status-dot styling findes");
});
