// Madkontrollen — isoleret risikoanalyse-generator-test (2026-08-03).
//
// Beviser at Quick onboarding-oplysningerne kan generere en VIRKSOMHEDSSPECIFIK
// risikoanalyse bundet til companyId/locationId — UDEN Stripe, betaling, session_id,
// produktions-Firestore eller secrets. Ren unit-test af den faktiske eksisterende
// generator functions/riskAnalysisLibrary.js -> generateRiskAnalysisSnapshot
// (samme generator som provisionRiskAnalysisSnapshot/tak.html-kæden kalder).
//
// ALLE testdata er TYDELIGT SYNTETISKE (ingen rigtige CVR/e-mail/adresser).
//   node --test tests/risk-analysis-generator.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const LIB_PATH = fileURLToPath(new URL("../functions/riskAnalysisLibrary.js", import.meta.url));
const lib = require(LIB_PATH);
const { generateRiskAnalysisSnapshot, normalizeIndustry, INDUSTRY_PROFILES } = lib;

// ---- SYNTETISKE testdata (ikke rigtige virksomheder) ----
const COMPANY = "test_company_risk_001";
const LOCATION = "test_location_main_001";

// Onboarding-formen: profile.equipment.units[].type + .selected[] + industry.
function restaurantInput(extra = {}) {
  return {
    companyId: COMPANY,
    locationId: LOCATION,
    industry: "restaurant",
    companyName: "SYNTETISK Testrestaurant (ikke en rigtig virksomhed)",
    profile: {
      // aktiviteter/udstyr fra onboarding: varemodtagelse, køl, frost, varmebehandling,
      // varmholdelse, nedkøling, opvask (dishwasher), walk-in køl:
      equipment: {
        units: [{ type: "fridge" }, { type: "freezer" }, { type: "walk_in_cooler" }, { type: "dishwasher" }],
        selected: []
      }
    },
    ...extra
  };
}
const keysOf = (snap) => snap.controlPoints.map((cp) => cp.key);

test("1. deterministisk: samme input → samme resultat (ekskl. tidsstempler)", () => {
  const strip = (s) => { const { createdAt, updatedAt, ...rest } = s; return rest; };
  assert.deepEqual(strip(generateRiskAnalysisSnapshot(restaurantInput())), strip(generateRiskAnalysisSnapshot(restaurantInput())));
});

test("2. relevante risici for de valgte aktiviteter (restaurant)", () => {
  const snap = generateRiskAnalysisSnapshot(restaurantInput());
  for (const k of ["varemodtagelse", "opvarmning", "nedkoeling", "varmholdelse", "koeleskab_temperatur", "fryser_temperatur", "rengoering", "allergener", "adskillelse", "aarlig_revision"]) {
    assert.ok(keysOf(snap).includes(k), `restaurant skal generere kontrolpunkt "${k}"`);
  }
});

test("3. udstyr styrer risici: valgt udstyr tilføjer, fravalgt udstyr udelader", () => {
  const withEquip = generateRiskAnalysisSnapshot(restaurantInput());
  assert.ok(keysOf(withEquip).includes("opvaskemaskine_skyllevand"), "opvaskemaskine → opvaskemaskine_skyllevand");
  assert.ok(keysOf(withEquip).includes("walkin_koeler_temperatur"), "walk-in køler → walkin_koeler_temperatur");
  // Uden opvasker/walk-in/blæsekøler må de ikke optræde:
  const minimal = generateRiskAnalysisSnapshot({ companyId: COMPANY, locationId: LOCATION, industry: "restaurant", profile: { equipment: { units: [{ type: "fridge" }], selected: [] } } });
  assert.ok(!keysOf(minimal).includes("opvaskemaskine_skyllevand"), "ingen opvasker → intet opvaskemaskine_skyllevand");
  assert.ok(!keysOf(minimal).includes("walkin_koeler_temperatur"), "ingen walk-in → intet walkin_koeler_temperatur");
  assert.ok(!keysOf(minimal).includes("blaesekoeler_temperatur"), "ingen blæsekøler → intet blaesekoeler_temperatur");
});

test("4. virksomhedstype påvirker resultatet (café udelader varmebehandling)", () => {
  const cafe = generateRiskAnalysisSnapshot({ companyId: COMPANY, locationId: LOCATION, industry: "cafe", profile: {} });
  for (const k of ["opvarmning", "nedkoeling", "varmholdelse", "tre_timers_regel"]) {
    assert.ok(!keysOf(cafe).includes(k), `café må ikke generere varmebehandlings-kontrolpunkt "${k}"`);
  }
  assert.ok(keysOf(cafe).includes("varemodtagelse"), "café har varemodtagelse");
  const restaurant = generateRiskAnalysisSnapshot(restaurantInput());
  assert.notEqual(keysOf(cafe).length, keysOf(restaurant).length, "café og restaurant giver forskellige kontrolpunkter");
  assert.equal(cafe.industry, "cafe");
  assert.equal(cafe.industryDisplayName, INDUSTRY_PROFILES.cafe.displayName);
});

test("5. resultatet bindes til korrekt companyId/locationId/organizationId", () => {
  const snap = generateRiskAnalysisSnapshot(restaurantInput());
  assert.equal(snap.companyId, COMPANY);
  assert.equal(snap.locationId, LOCATION);
  assert.equal(snap.organizationId, COMPANY, "organizationId defaulter til companyId");
  // Anden location → separat, korrekt bundet resultat.
  const other = generateRiskAnalysisSnapshot(restaurantInput({ locationId: "test_location_annex_002" }));
  assert.equal(other.locationId, "test_location_annex_002");
  assert.notEqual(other.locationId, snap.locationId);
});

test("6. kontrolpunkter, procedurer, frekvenser og korrigerende handlinger genereres", () => {
  const snap = generateRiskAnalysisSnapshot(restaurantInput());
  assert.ok(snap.controlPoints.length > 0, "kontrolpunkter genereres");
  for (const cp of snap.controlPoints) {
    for (const f of ["key", "title", "type", "hazard", "control", "limit", "monitoring", "frequency", "correctiveAction", "routineKey"]) {
      assert.ok(cp[f] != null && String(cp[f]).length > 0, `kontrolpunkt "${cp.key}" mangler "${f}"`);
    }
  }
  assert.equal(snap.monitoring.length, snap.controlPoints.length, "overvågningsprocedurer pr. kontrolpunkt");
  assert.equal(snap.correctiveActions.length, snap.controlPoints.length, "korrigerende handlinger pr. kontrolpunkt");
  assert.equal(snap.routineKeys.length, snap.controlPoints.length, "rutiner pr. kontrolpunkt");
  assert.equal(snap.hazards.length, snap.controlPoints.length, "farer pr. kontrolpunkt");
});

test("7. obligatoriske top-level felter + metadata", () => {
  const snap = generateRiskAnalysisSnapshot(restaurantInput());
  for (const f of ["companyId", "locationId", "organizationId", "industry", "version", "controlPoints", "hazards", "limits", "monitoring", "correctiveActions", "routineKeys", "totalControlPoints", "status", "createdAt", "updatedAt"]) {
    assert.ok(f in snap, `mangler obligatorisk felt "${f}"`);
  }
  assert.equal(snap.status, "active");
  assert.equal(snap.autoGenerated, true);
  assert.equal(snap.totalControlPoints, snap.controlPoints.length);
  assert.match(String(snap.version), /^\d+\.\d+\.\d+$/);
});

test("8. ingen Stripe-/secret-/netværksafhængighed (ren funktion)", () => {
  const src = readFileSync(LIB_PATH, "utf8");
  assert.ok(!/require\(/.test(src), "biblioteket har ingen require() → ingen firebase/stripe/netværk");
  assert.ok(!/stripe|STRIPE|secret|process\.env/i.test(src), "ingen Stripe-/secret-/env-reference i generatoren");
});

test("9. inputobjektet muteres ikke", () => {
  const input = restaurantInput();
  const before = JSON.parse(JSON.stringify(input));
  generateRiskAnalysisSnapshot(input);
  assert.deepEqual(JSON.parse(JSON.stringify(input)), before, "generatoren må ikke mutere input");
});

test("10. mangelfuldt/ugyldigt input håndteres kontrolleret", () => {
  // Mangelfuldt: tomt objekt → graceful defaults (restaurant), ingen throw.
  const empty = generateRiskAnalysisSnapshot({});
  assert.equal(empty.industry, "restaurant", "ukendt/manglende industry → restaurant-default");
  assert.ok(empty.controlPoints.length > 0, "stadig et gyldigt snapshot");
  assert.equal(empty.companyId, undefined, "ingen companyId givet → undefined (ingen falsk binding)");
  // Ukendt branche → kontrolleret fallback.
  assert.equal(normalizeIndustry("ukendt_branche_xyz"), "restaurant");
  // Helt ugyldigt (intet argument) → kontrolleret fejl (destrukturering af undefined).
  assert.throws(() => generateRiskAnalysisSnapshot(), TypeError);
});
