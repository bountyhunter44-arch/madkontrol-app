// Madkontrollen – quick-onboarding UDEN billedupload (2026-08-07).
//
// Billed-/kamera-/uploadfunktionen er fjernet fra quick-onboarding (kræver login; ikke en
// del af onboarding). Datamodellen (state.sections[key].images, PROGRAM_SECTIONS.uploadTargets)
// bevares for bagudkompatibilitet, og backend-funktionen getCloudinarySignature røres ikke.
//
// STATISK kildekode-kontrol.
//   node --test tests/onboarding-no-upload.test.mjs

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
const dashboard = read("dashboard.html");
const rutiner = read("modules/egenkontrol/rutiner.html");

test("A. Onboarding-komponenten har ingen billedupload-kontroller", () => {
  for (const t of ["data-upload-section", "data-upload-check", "upload-box", "renderUploadPreview", "openImagePickerForTarget", "uploadImageToCloudinary", "hiddenImageInput"]) {
    assert.ok(!js.includes(t), `upload-artefakt skal være fjernet: ${t}`);
  }
});

test("B. Ingen file-input i quick-onboarding-shells", () => {
  for (const [name, html] of [["quick", quick], ["module", modulePage]]) {
    assert.ok(!/type="file"/.test(html), `${name}: ingen input[type=file]`);
    assert.ok(!html.includes("hiddenImageInput"), `${name}: ingen hiddenImageInput`);
    assert.ok(!/accept="image/.test(html), `${name}: ingen accept=image`);
    assert.ok(!html.includes('id="uploadCount"'), `${name}: ingen Billeder-tæller`);
  }
});

test("C. Ingen upload-knapper (Kamera/Vælg fil/data-upload) i onboarding", () => {
  // De faktiske uploadknapper var 'Kamera' og 'Vælg fil' med data-upload-* — de er væk.
  // (Spørgsmåls-labels som '(beskriv eller tag billede)' er bevaret, jf. §6, og er ikke kontroller.)
  assert.ok(!/data-upload-/.test(js), "ingen data-upload-knapper i komponenten");
  assert.ok(!/>Vælg fil</.test(js), "ingen 'Vælg fil'-uploadknap i komponenten");
  for (const [name, html] of [["quick", quick], ["module", modulePage]]) {
    assert.ok(!/>Tag billede<|>Upload billede<|>Vælg fil<|>Kamera</i.test(html), `${name}: ingen upload-knap`);
  }
});

test("D. Ingen runtime-path til getCloudinarySignature/Cloudinary fra onboarding", () => {
  for (const t of ["getCloudinarySignature", "getCloudinarySignatureCallable", "analyzeCloudinaryAsset", "api.cloudinary.com", "Cloudinary"]) {
    assert.ok(!js.includes(t), `onboarding-komponenten må ikke referere: ${t}`);
  }
  assert.ok(!/Cloudinary/i.test(quick) && !/Cloudinary/i.test(modulePage), "shells nævner ikke Cloudinary");
});

test("E. De 13 PROGRAM_SECTIONS er uændrede", () => {
  for (const k of ["separation_fridge", "company_description", "cooling_method", "storage_foods", "heating_method", "personal_hygiene", "cleaning_program", "revision_program", "traceability_program", "recall_program", "receiving_control", "delivery_control", "hot_holding_method"]) {
    assert.ok(js.includes(`key: "${k}"`), `program-ID bevaret: ${k}`);
  }
});

test("F. State/answers/choices/approved uændret + images bevaret i datamodel", () => {
  assert.ok(js.includes("approved: false"), "approved-state bevaret");
  assert.ok(js.includes("answers: {}") && js.includes("choices: {}"), "answers/choices bevaret");
  assert.ok((js.match(/images: \[\]/g) || []).length >= 2, "images:[] init bevaret (bagudkompat)");
  assert.ok(js.includes("uploadTargets:"), "PROGRAM_SECTIONS.uploadTargets bevaret i datamodel");
});

test("G. 1→13 ét-punkt-ad-gangen + auto-advance bevaret", () => {
  assert.ok(js.includes("function renderProgramPoint"), "renderProgramPoint");
  assert.ok(js.includes("function firstUnapprovedProgramIndex"), "firstUnapprovedProgramIndex");
  assert.ok(js.includes("data-program-approve"), "Godkend og fortsæt");
  assert.ok(js.includes("state.sections[key].approved = true"), "godkendelse via state");
});

test("H. Gate til checks bevaret (alle punkter godkendt)", () => {
  assert.ok(js.includes("function goToChecksFromProgram"), "checks-overgang");
  assert.ok(js.includes('state.currentStep = STEP_DEFS.findIndex((s) => s.key === "checks")'), "sætter checks-trin");
});

test("I. Checkout-kontrakt uændret", () => {
  assert.ok(js.includes("createOnboardingCheckoutSessionCallable(payload)"), "checkout-kald");
  assert.ok(js.includes('selectedModules: ["egenkontrol"]'), "selectedModules");
  assert.ok(js.includes("${window.location.origin}/tak.html"), "successUrl /tak.html");
  assert.ok(js.includes("PRICE_EX_VAT = 149"), "pris uændret");
  assert.ok(!/modulvælger|module-select/i.test(js), "ingen modulvælger");
});

test("J. Backend/andre sider urørt: getCloudinarySignature findes stadig andetsteds", () => {
  assert.ok(dashboard.includes("getCloudinarySignature"), "dashboard bruger stadig getCloudinarySignature");
  assert.ok(rutiner.includes("getCloudinarySignature"), "rutiner bruger stadig getCloudinarySignature");
});

test("K. Ingen upload-CSS tilbage i onboarding-stylesheet", () => {
  for (const c of [".upload-box", ".upload-thumb", ".upload-list", ".upload-item", ".upload-meta"]) {
    assert.ok(!css.includes(c), `upload-CSS fjernet: ${c}`);
  }
});
