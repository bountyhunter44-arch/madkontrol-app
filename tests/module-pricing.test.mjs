// Madkontrollen – canonical EWCP-modulprismodel (2026-08-08).
//
// Pris = f(antal BETALTE moduler), ALDRIG f(moduleKey):
//   base-slot 149 kr. ekskl. moms, addon-slot 49 kr. ekskl. moms, total = 149 + 49×(N−1).
// Kun 'paid_subscription' tæller som betalt; trial/admin/demo/internal gør ikke.
//
//   node --test tests/module-pricing.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BASE_PRICE_ORE, ADDON_PRICE_ORE,
  countPaidModules, isPaidSource,
  priceForNextModuleOre, totalForPaidCountOre, buildPriceSlotsOre,
  repricedTotalAfterRemovalOre, isModuleOwned, addModuleAdditive,
  withVatOre, nextModulePriceLabelExVat
} from "../public/core/module-pricing.js";

const dashboard = readFileSync(fileURLToPath(new URL("../public/dashboard.html", import.meta.url)), "utf8");

test("A. 0 betalte moduler → første modul = 149", () => {
  assert.equal(priceForNextModuleOre(0), BASE_PRICE_ORE);
  assert.equal(BASE_PRICE_ORE, 14900);
});

test("B. 1 betalt modul → modul nr. 2 = 49", () => {
  assert.equal(priceForNextModuleOre(1), ADDON_PRICE_ORE);
  assert.equal(ADDON_PRICE_ORE, 4900);
});

test("C. 2 betalte moduler → modul nr. 3 = 49", () => {
  assert.equal(priceForNextModuleOre(2), 4900);
});

test("D. 3 moduler samlet → 149 + 49 + 49", () => {
  assert.equal(totalForPaidCountOre(3), 14900 + 4900 + 4900);
  assert.deepEqual(buildPriceSlotsOre(3), [14900, 4900, 4900]);
});

test("E/F/G. Ét modul alene → 149 uanset hvilket (POS/Egenkontrol/Regnskab)", () => {
  // Prisen er count-based, ikke key-based: første modul = 149 uanset key.
  assert.equal(priceForNextModuleOre(0), 14900);
  assert.equal(totalForPaidCountOre(1), 14900);
});

test("H. Egenkontrol + POS → 198 kr. ekskl. moms", () => {
  assert.equal(totalForPaidCountOre(2), 19800);
});

test("I. Tre moduler → 247 kr. ekskl. moms", () => {
  assert.equal(totalForPaidCountOre(3), 24700);
});

test("J. Fjern basis-modul fra 2-moduls company → tilbageværende reprises til 149", () => {
  // 2 moduler (198) → fjern ét → 1 tilbage → 149 (det tilbageværende bliver base-modul).
  assert.equal(repricedTotalAfterRemovalOre(1), 14900);
  assert.equal(repricedTotalAfterRemovalOre(0), 0);
});

test("K. Købsrækkefølge ændrer ikke totalen", () => {
  // Rækkefølge er irrelevant — kun antal betalte moduler tæller.
  const orderA = ["egenkontrol", "pos", "bogforing"];
  const orderB = ["pos", "bogforing", "egenkontrol"];
  assert.equal(totalForPaidCountOre(orderA.length), totalForPaidCountOre(orderB.length));
  assert.equal(totalForPaidCountOre(3), 24700);
});

test("L. Already-owned modul kan ikke dobbeltkøbes", () => {
  assert.equal(isModuleOwned(["egenkontrol", "pos"], "pos"), true);
  assert.equal(isModuleOwned(["egenkontrol", "pos"], "bogforing"), false);
});

test("O. Additivt køb bevarer eksisterende moduler", () => {
  assert.deepEqual(addModuleAdditive(["egenkontrol", "pos"], "regnskab"), ["egenkontrol", "pos", "regnskab"]);
  assert.deepEqual(addModuleAdditive(["egenkontrol"], "egenkontrol"), ["egenkontrol"]); // ingen dublet
});

test("§16. Kun BETALTE moduler tæller (trial/admin/demo tæller ikke)", () => {
  assert.equal(isPaidSource(["paid_subscription"]), true);
  assert.equal(isPaidSource(["trial"]), false);
  assert.equal(isPaidSource(["admin_override"]), false);
  const sources = {
    egenkontrol: ["paid_subscription"],
    pos: ["trial"],
    seo: ["admin_override"],
    lager: ["demo", "internal"]
  };
  assert.equal(countPaidModules(sources), 1); // kun egenkontrol er betalt
  // → derfor: næste modul-køb for denne company = 49 (den har allerede 1 betalt)
  assert.equal(priceForNextModuleOre(countPaidModules(sources)), 4900);
});

test("Moms (25%): 149→186,25 · 49→61,25 · 198→247,50 · 247→308,75", () => {
  assert.equal(withVatOre(14900), 18625);
  assert.equal(withVatOre(4900), 6125);
  assert.equal(withVatOre(19800), 24750);
  assert.equal(withVatOre(24700), 30875);
});

test("§17. Dashboard-label: 0 betalte → '149 kr.', ≥1 betalt → '49 kr.'", () => {
  assert.equal(nextModulePriceLabelExVat(0), "149 kr. + moms/md.");
  assert.equal(nextModulePriceLabelExVat(1), "49 kr. + moms/md.");
  assert.equal(nextModulePriceLabelExVat(3), "49 kr. + moms/md.");
});

test("§10/§17. Dashboard bruger den fælles pricing-helper (ingen key-bundet pris)", () => {
  assert.ok(dashboard.includes('from "./core/module-pricing.js"'), "importerer module-pricing helper");
  assert.ok(dashboard.includes("countPaidModules(SETTINGS.moduleSources)"), "paidCount fra faktisk moduleSources");
  assert.ok(dashboard.includes("nextModulePriceLabelExVat(paidCount)"), "ikke-ejet pris = dynamisk label");
  assert.ok(!/posPrice\s*=|egenkontrolPrice\s*=|regnskabPrice\s*=|bogforingPrice\s*=/.test(dashboard), "ingen key-bundet pris i dashboard");
});
