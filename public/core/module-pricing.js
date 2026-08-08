// /core/module-pricing.js
// Canonical EWCP-modulprismodel.
//
// Prisen afhænger UDELUKKENDE af antallet af BETALTE moduler — ALDRIG af moduleKey:
//   - Første betalte modul (base-slot): 149 kr. ekskl. moms / md.
//   - Hvert yderligere betalte modul (addon-slot): 49 kr. ekskl. moms / md.
//   - Total for N betalte moduler: 149 + 49 × (N − 1)   (N ≥ 1)
//
// Modulnavnet bestemmer entitlement + destination, IKKE prisniveauet (jf. krav §10).
// "Betalt" = kilde 'paid_subscription' i moduleSources (getEffectiveActiveModules).
// trial / admin_override / demo / internal tæller IKKE som betalte slots (§16).
//
// Ren og read-only: ingen Firestore, ingen Stripe, ingen netværk. Backend er stadig
// den autoritative prisberegner ved checkout (§14) — denne helper er den fælles regel.

export const BASE_PRICE_ORE = 14900;   // 149,00 kr. ekskl. moms
export const ADDON_PRICE_ORE = 4900;   //  49,00 kr. ekskl. moms
export const VAT_RATE = 0.25;
export const PRICE_CURRENCY = "dkk";

const PAID_SOURCE = "paid_subscription";

// Tæller en kildeliste som et BETALT modul-slot?
export function isPaidSource(sources) {
  const list = Array.isArray(sources) ? sources : (sources ? [sources] : []);
  return list.map(String).includes(PAID_SOURCE);
}

// Autoritativt antal BETALTE moduler ud fra moduleSources-map { moduleKey: [sources] }.
export function countPaidModules(moduleSources = {}) {
  const map = moduleSources && typeof moduleSources === "object" ? moduleSources : {};
  let n = 0;
  for (const key of Object.keys(map)) {
    if (isPaidSource(map[key])) n += 1;
  }
  return n;
}

// Pris (øre, ekskl. moms) for det NÆSTE betalte modul, givet hvor mange betalte moduler
// company allerede har. 0 betalte → base (149). ≥1 betalt → addon (49).
export function priceForNextModuleOre(paidModuleCount = 0) {
  return (Number(paidModuleCount) || 0) <= 0 ? BASE_PRICE_ORE : ADDON_PRICE_ORE;
}

// Total (øre, ekskl. moms) for N betalte moduler: 149 + 49×(N−1); 0 for N = 0.
// Uafhængig af rækkefølge og af hvilke moduler (§8, §K).
export function totalForPaidCountOre(n = 0) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  if (count === 0) return 0;
  return BASE_PRICE_ORE + ADDON_PRICE_ORE * (count - 1);
}

// Stripe-prisslots (øre) for et samlet portefølje-abonnement på N betalte moduler:
//   [14900, 4900, 4900, ...]  (1 × base + (N−1) × addon)
// Entitlement (hvilke keys) er en SEPARAT concern (§11).
export function buildPriceSlotsOre(paidModuleCount = 0) {
  const count = Math.max(0, Math.floor(Number(paidModuleCount) || 0));
  const slots = [];
  for (let i = 0; i < count; i += 1) slots.push(i === 0 ? BASE_PRICE_ORE : ADDON_PRICE_ORE);
  return slots;
}

// Repricing ved opsigelse (§9): efter at et modul fjernes, koster de tilbageværende K
// moduler igen 149 + 49×(K−1) — ét tilbageværende modul bliver automatisk base-modulet.
export function repricedTotalAfterRemovalOre(remainingPaidCount = 0) {
  return totalForPaidCountOre(remainingPaidCount);
}

// Allerede ejet? (må ikke dobbeltkøbes, §15/§L)
export function isModuleOwned(ownedKeys, moduleKey) {
  const owned = new Set((Array.isArray(ownedKeys) ? ownedKeys : []).map((k) => String(k)));
  return owned.has(String(moduleKey));
}

// Additiv tilføjelse (§13/§O): bevar eksisterende, tilføj det nye, ingen dubletter.
export function addModuleAdditive(ownedKeys, moduleKey) {
  const set = new Set((Array.isArray(ownedKeys) ? ownedKeys : []).map((k) => String(k)));
  set.add(String(moduleKey));
  return [...set];
}

// ---- moms + visning ----
export function withVatOre(ore, rate = VAT_RATE) {
  return Math.round((Number(ore) || 0) * (1 + (Number(rate) || 0)));
}
export function oreToKr(ore) {
  return (Number(ore) || 0) / 100;
}
// Dashboard-label for et IKKE-ejet modul (§17): "149 kr. + moms/md." eller "49 kr. + moms/md.".
export function nextModulePriceLabelExVat(paidModuleCount = 0) {
  const kr = oreToKr(priceForNextModuleOre(paidModuleCount));
  return `${kr} kr. + moms/md.`;
}
