// public/admin/cvr-identity.js
// Admin-diagnostik (owner-dashboard): læsbar Firma-ID + CVR-dubletdetektion.
//
// CVR normaliseres med den SAMME kanoniske regel som backend (buildCompanyKey /
// buildCanonicalCompanyId i functions/modules/provisioning/index.js) og onboarding:
// alt ikke-cifret fjernes. Det er IKKE en ny parallel normalisering — samme regel,
// så DK-prefix, mellemrum, bindestreg og string/number-format giver samme CVR.
//
// Ren og read-only: ingen Firestore, ingen netværk, ingen secrets.

// "DK-42 40 50 00" | 42405000 | "42405000" -> "42405000"
export function normalizeCvr(value) {
  return String(value == null ? "" : value).replace(/\D/g, "");
}

// { normalizedCvr: antal } over alle companies med et ikke-tomt normaliseret CVR.
// Tomme/ukendte CVR tælles IKKE (så to firmaer uden CVR aldrig markeres som dublet).
export function computeCvrDuplicateCounts(companies) {
  const counts = Object.create(null);
  const list = Array.isArray(companies) ? companies : [];
  for (const c of list) {
    const cvr = normalizeCvr(c && c.cvr);
    if (!cvr) continue;
    counts[cvr] = (counts[cvr] || 0) + 1;
  }
  return counts;
}

// Hvor mange companies deler dette firmas normaliserede CVR (inkl. firmaet selv).
export function cvrDuplicateCount(company, counts) {
  const cvr = normalizeCvr(company && company.cvr);
  if (!cvr) return 0;
  return (counts && counts[cvr]) || 0;
}

export function isCvrDuplicate(company, counts) {
  return cvrDuplicateCount(company, counts) > 1;
}

// "⚠ Dublet CVR (2)" — kun når mere end ét firma deler CVR. Ellers tom streng.
export function cvrDuplicateLabel(count) {
  const n = Number(count) || 0;
  return n > 1 ? `⚠ Dublet CVR (${n})` : "";
}

// Kort, læsbar visning af det AUTORITATIVE companyId (Firestore document-id).
// Det fulde id vises i tooltip/kopi — dette er kun til den kompakte tabelvisning.
export function shortCompanyId(id, tail = 6) {
  const s = String(id == null ? "" : id);
  if (!s) return "—";
  return s.length <= tail ? s : `…${s.slice(-tail)}`;
}
