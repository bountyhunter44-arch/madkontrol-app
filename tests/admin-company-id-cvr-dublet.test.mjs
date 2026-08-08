// Madkontrollen – admin owner-dashboard: Firma-ID + CVR-dubletdetektion (2026-08-08).
//
// ADMIN-DIAGNOSTIK. companyId (Firestore document-id) er den autoritative identitet; CVR er IKKE.
// CVR normaliseres med den kanoniske regel (strip ikke-cifret), samme som backend buildCompanyKey.
// "Se som kunde" skal binde til det eksakte companyId pr. række — aldrig CVR.
//
//   node --test tests/admin-company-id-cvr-dublet.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  normalizeCvr,
  computeCvrDuplicateCounts,
  cvrDuplicateCount,
  isCvrDuplicate,
  cvrDuplicateLabel,
  shortCompanyId
} from "../public/admin/cvr-identity.js";

const P = (rel) => fileURLToPath(new URL("../public/" + rel, import.meta.url));
const admin = readFileSync(P("admin/owner-dashboard.html"), "utf8");
const helper = readFileSync(P("admin/cvr-identity.js"), "utf8");

test("A. Ét company med CVR → ingen dublet-advarsel", () => {
  const counts = computeCvrDuplicateCounts([{ id: "company_a", cvr: "42405000" }]);
  assert.equal(counts["42405000"], 1);
  const c = { id: "company_a", cvr: "42405000" };
  assert.equal(cvrDuplicateCount(c, counts), 1);
  assert.equal(isCvrDuplicate(c, counts), false);
  assert.equal(cvrDuplicateLabel(cvrDuplicateCount(c, counts)), "");
});

test("B. To companies med samme normaliserede CVR → begge 'Dublet CVR (2)'", () => {
  const companies = [
    { id: "company_1723_A82F91", cvr: "42405000" },
    { id: "onboarding_aroi-d_42405000", cvr: "DK 42405000" } // varianter → samme CVR
  ];
  const counts = computeCvrDuplicateCounts(companies);
  assert.equal(counts["42405000"], 2);
  for (const c of companies) {
    assert.equal(cvrDuplicateCount(c, counts), 2);
    assert.equal(isCvrDuplicate(c, counts), true);
    assert.equal(cvrDuplicateLabel(cvrDuplicateCount(c, counts)), "⚠ Dublet CVR (2)");
  }
});

test("C. Tre companies med samme CVR → alle '(3)'", () => {
  const companies = [
    { id: "a", cvr: "42405000" },
    { id: "b", cvr: "42-40-50-00" },
    { id: "c", cvr: 42405000 }
  ];
  const counts = computeCvrDuplicateCounts(companies);
  assert.equal(counts["42405000"], 3);
  for (const c of companies) assert.equal(cvrDuplicateLabel(cvrDuplicateCount(c, counts)), "⚠ Dublet CVR (3)");
});

test("C2. Tomme/ukendte CVR tælles ALDRIG som dublet", () => {
  const companies = [{ id: "a", cvr: "" }, { id: "b" }, { id: "c", cvr: null }];
  const counts = computeCvrDuplicateCounts(companies);
  assert.deepEqual(Object.keys(counts), []);
  for (const c of companies) assert.equal(isCvrDuplicate(c, counts), false);
});

test("D. companyId er forskelligt og synligt (kort visning + fuldt id bevaret)", () => {
  assert.equal(shortCompanyId("company_1723_A82F91"), "…A82F91");
  assert.notEqual(shortCompanyId("company_1723_A82F91"), shortCompanyId("company_1723_7C19D4"));
  assert.equal(shortCompanyId("abc"), "abc"); // kortere end tail → uændret
  assert.equal(shortCompanyId(""), "—");
  // Admin-siden viser det FULDE id i tooltip + kopiér-knap (ikke kun den korte form).
  assert.ok(admin.includes('title="${company.id}"'), "fuldt companyId i title/tooltip");
  assert.ok(admin.includes("copyCompanyId('${company.id}')"), "kopiér fuldt companyId");
  assert.ok(admin.includes("shortCompanyId(company.id)"), "kort visning fra shortCompanyId");
  assert.ok(admin.includes("<th>Firma-ID</th>"), "Firma-ID kolonne findes");
});

test("E. 'Se som kunde' binder til EKSAKT companyId, aldrig CVR", () => {
  assert.ok(admin.includes("impersonateCompany('${company.id}'"), "impersonate bruger company.id");
  assert.ok(!/impersonateCompany\([^)]*company\.cvr/.test(admin), "impersonate bruger ALDRIG company.cvr");
  assert.ok(admin.includes("sessionStorage.setItem('mkp_impersonate_companyId', companyId)"), "impersonation gemmer eksakt companyId");
});

test("F. CVR-varianter normaliseres til samme kanoniske CVR", () => {
  for (const v of ["42405000", "DK-42405000", "DK 42405000", "42 40 50 00", "42-40-50-00", 42405000, " 42405000 "]) {
    assert.equal(normalizeCvr(v), "42405000", `variant: ${v}`);
  }
  assert.equal(normalizeCvr(null), "");
  assert.equal(normalizeCvr(undefined), "");
});

test("G. Ingen secrets; helper er ren/read-only (ingen imports/DB/netværk)", () => {
  assert.ok(!/sk_live_|sk_test_[0-9A-Za-z]{20}|whsec_[0-9A-Za-z]{20}|-----BEGIN/.test(admin), "ingen secret-mønstre i admin-siden");
  // Struktur-check (ikke kommentar-ord): helper importerer intet og laver ingen DB/netværkskald.
  assert.ok(!/^\s*import\b/m.test(helper), "cvr-identity har ingen imports (ren funktion)");
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|getDocs?\s*\(|\bcollection\s*\(|onSnapshot/.test(helper), "cvr-identity laver ingen DB/netværkskald");
});

test("H. Admin-siden bruger den delte helper (ingen ny parallel CVR-normalisering)", () => {
  assert.ok(admin.includes('from "/admin/cvr-identity.js"'), "importerer delt helper");
  assert.ok(admin.includes("computeCvrDuplicateCounts(companies)"), "dubletoptælling fra helper");
  assert.ok(admin.includes("cvrDuplicateLabel("), "dublet-label fra helper");
  // Kanonisk regel = strip ikke-cifret (samme som backend buildCompanyKey).
  assert.ok(/replace\(\/\\D\/g, ""\)/.test(helper), "normalizeCvr bruger \\D-strip (kanonisk)");
});
