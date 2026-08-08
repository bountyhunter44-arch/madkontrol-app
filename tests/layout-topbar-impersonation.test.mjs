// Madkontrollen – shared topbar (/core/layout.js) respekterer "Se som kunde" (2026-08-08).
//
// Dashboardets egen header var impersonation-aware; den DELTE topbar (loadLayout →
// populateTopbarFromProfile), som Rutiner + øvrige egenkontrol-sider bruger, ignorerede
// impersonation og viste adminens tomme company ("Virksomhed / Ikke angivet").
// Fixet genbruger de eksisterende helpers i /core/impersonation.js — ingen ny sessionmodel,
// ingen hardkodning. Normal login er uændret (tomme ids → udledes fra brugerens profil).
//
//   node --test tests/layout-topbar-impersonation.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Minimal sessionStorage-mock til de rene impersonation-helpers (browser-API findes ikke i node).
const __store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (__store.has(k) ? __store.get(k) : null),
  setItem: (k, v) => __store.set(k, String(v)),
  removeItem: (k) => __store.delete(k),
  clear: () => __store.clear()
};

const {
  isImpersonating, getEffectiveCompanyId, getEffectiveLocationId,
  getImpersonatedCompanyName, startImpersonation, stopImpersonation
} = await import("../public/core/impersonation.js");

const layout = readFileSync(fileURLToPath(new URL("../public/core/layout.js", import.meta.url)), "utf8");

test("A. NORMAL LOGIN → helpers bruger brugerens egen context", () => {
  __store.clear();
  assert.equal(isImpersonating(), false);
  assert.equal(getEffectiveCompanyId("company_user_A"), "company_user_A");
  assert.equal(getEffectiveLocationId("loc_user_A"), "loc_user_A");
});

test("B. SE SOM KUNDE A → company A (ignorerer adminens eget)", () => {
  __store.clear();
  startImpersonation("company_AROI_D", "Aroi-D");
  sessionStorage.setItem("mkp_impersonate_locationId", "loc_aroi_1");
  assert.equal(isImpersonating(), true);
  assert.equal(getEffectiveCompanyId("company_admin"), "company_AROI_D");
  assert.equal(getEffectiveLocationId("loc_admin"), "loc_aroi_1");
  assert.equal(getImpersonatedCompanyName(), "Aroi-D");
});

test("C. SE SOM KUNDE B → company B (skift mellem kunder)", () => {
  __store.clear();
  startImpersonation("company_B", "Firma B");
  assert.equal(getEffectiveCompanyId("company_admin"), "company_B");
  assert.equal(getImpersonatedCompanyName(), "Firma B");
});

test("D. STOP impersonation → normal admin-context gendannes", () => {
  __store.clear();
  startImpersonation("company_B", "Firma B");
  stopImpersonation();
  assert.equal(isImpersonating(), false);
  assert.equal(getEffectiveCompanyId("company_admin"), "company_admin");
  assert.equal(getEffectiveLocationId("loc_admin"), "loc_admin");
  assert.equal(getImpersonatedCompanyName(), null);
});

test("E. layout.js topbar er impersonation-aware (genbruger impersonation.js)", () => {
  assert.ok(/import \{[^}]*isImpersonating[^}]*\} from "\.\/impersonation\.js"/.test(layout), "importerer impersonation-helpers");
  assert.ok(layout.includes("const impersonating = isImpersonating();"), "beregner impersonating i topbar");
  assert.ok(/companyId: impersonating \? getEffectiveCompanyId\(""\) : ""/.test(layout), "sender effektivt companyId ved impersonation");
  assert.ok(/locationId: impersonating \? getEffectiveLocationId\(""\) : ""/.test(layout), "sender effektivt locationId ved impersonation");
});

test("F. Company-label falder tilbage til det impersonerede firmanavn", () => {
  assert.ok(layout.includes('impersonating ? getImpersonatedCompanyName() : ""'), "firmanavn-fallback ved impersonation");
});

test("G. Normal login UÆNDRET: tomme ids → resolvePrettyCompanyInfo udleder fra profil", () => {
  assert.ok(layout.includes('companyId: impersonating ? getEffectiveCompanyId("") : ""'), "tomt companyId ved normal login");
  assert.ok(layout.includes("resolvePrettyCompanyInfo({"), "bruger stadig resolvePrettyCompanyInfo");
});

test("H. User-label bevidst uændret (adminens navn) — company-context er kundens", () => {
  // Impersonation bærer KUN company-context (ingen kunde-bruger). Banner viser 'ser som: <kunde>'.
  assert.ok(layout.includes("resolveTopbarUserName({ user, profile: userProfile })"), "bruger-label uændret");
});
