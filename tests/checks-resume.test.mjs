// Madkontrollen – checks 6-trins RESUME/persistence (2026-08-08).
//
// UX-progressen (checksUiDone) persisteres i en SEPARAT UI-only localStorage-nøgle, så et reload
// midt i checks genoptager på det første ikke-gennemførte trin. Nøglen/arrayet indgår IKKE i
// checkout/generator-payload, og de 3 section.approved-flag + de 16 answer-paths er uændrede.
//
// STATISK kildekode-kontrol.
//   node --test tests/checks-resume.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const P = (rel) => fileURLToPath(new URL("../public/" + rel, import.meta.url));
const js = readFileSync(P("modules/egenkontrol/egenkontrol-onboarding.js"), "utf8");

test("A. Separat UI-only localStorage-nøgle findes", () => {
  assert.ok(js.includes('const CHECKS_UI_PROGRESS_KEY = "mkp_checks_ui_progress_v1"'), "CHECKS_UI_PROGRESS_KEY");
});

test("B. checksUiDone genindlæses ved init (ikke fast false)", () => {
  assert.ok(js.includes("function loadChecksUiProgress"), "loadChecksUiProgress");
  assert.ok(js.includes("const checksUiDone = loadChecksUiProgress()"), "checksUiDone = loadChecksUiProgress()");
  assert.ok(!js.includes("const checksUiDone = new Array(CHECK_UI_STEPS.length).fill(false)"), "runtime-only-init er fjernet");
  assert.ok(/loadChecksUiProgress\(\)\s*\{[\s\S]*localStorage\.getItem\(CHECKS_UI_PROGRESS_KEY\)[\s\S]*length === CHECK_UI_STEPS\.length/.test(js), "loader validerer længde");
});

test("C. Progress gemmes når et UX-trin gennemføres", () => {
  assert.ok(js.includes("function saveChecksUiProgress"), "saveChecksUiProgress");
  assert.ok(js.includes("localStorage.setItem(CHECKS_UI_PROGRESS_KEY, JSON.stringify(checksUiDone))"), "gemmer array");
  assert.ok(/checksUiDone\[checksCursor\] = true;[\s\S]*saveChecksUiProgress\(\)/.test(js), "gemmes ved godkendelse");
});

test("D. Genoptagelse afledes af checksUiDone (første ikke-gennemførte trin)", () => {
  assert.ok(/function renderChecksStep\(\)\s*\{[\s\S]*firstIncompleteCheckUiStep\(\)/.test(js), "entry bruger firstIncompleteCheckUiStep");
});

test("E. ISOLATION: nøglen/arrayet indgår IKKE i checkout-payload-objektet", () => {
  // Isolér selve payload-OBJEKTET (const payload = { ... };) lige før checkout-kaldet.
  const callIdx = js.indexOf("createOnboardingCheckoutSessionCallable(payload)");
  const objStart = js.lastIndexOf("const payload = {", callIdx);
  const objEnd = js.indexOf("};", objStart);
  assert.ok(objStart >= 0 && objEnd > objStart && objEnd < callIdx, "payload-objekt findes før checkout-kald");
  const obj = js.slice(objStart, objEnd);
  assert.ok(obj.includes("successUrl") && obj.includes("checks: state.checks"), "korrekt payload-objekt");
  assert.ok(!/checksUiDone|CHECKS_UI_PROGRESS|checksUiProgress/.test(obj), "payload-objekt uden UI-progress");
});

test("F. Ryddes ved testdata-reset og ved submit (før checkout)", () => {
  assert.ok((js.match(/localStorage\.removeItem\(CHECKS_UI_PROGRESS_KEY\)/g) || []).length >= 2, "ryddes 2 steder (reset + submit)");
});

test("G. Ingen ny persistent approval-model; 3 section.approved + answer-paths uændret", () => {
  assert.ok(!/checkStep\d+Approved|checkUiApproved|state\.checksUi/.test(js), "ingen nye approval/state-felter i state");
  assert.ok(js.includes("state.checks[section.key].approved = true"), "eksisterende approved-flag");
  assert.ok(js.includes("state.checks[sectionKey].answers[index].value = btn.dataset.checkValue"), "value-path uændret");
  for (const k of ["apv_update", "maintenance_pest", "annual_review"]) assert.ok(js.includes(`key: "${k}"`), `sektion: ${k}`);
});

test("H. No-upload + 13-program uændret", () => {
  assert.ok(!/data-upload|getCloudinarySignature/.test(js), "ingen upload");
  assert.ok(js.includes("function renderProgramPoint") && js.includes("firstUnapprovedProgramIndex"), "program-flow intakt");
});
