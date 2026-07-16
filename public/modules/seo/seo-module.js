import { setSeoHead } from "/core/seo-head.js";
import app from "/core/firebase-config.js";
import { buildSeoSiteDomain, slugifySeoPathPart } from "/modules/seo/generator/generator-core.js";
import { getBusinessSnapshotFromContext, resolvePlatformContext } from "/platform/context-provider.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const functionsClient = getFunctions(app, "us-central1");
const lookupCvrCallable = httpsCallable(functionsClient, "lookupCvr");
const saveSeoSiteDraftCallable = httpsCallable(functionsClient, "saveSeoSiteDraft");

const COLLECTIONS = Object.freeze({
  clients: "seo_clients",
  sites: "seo_sites",
  pages: "seo_pages",
  entities: "seo_entities",
  templates: "seo_templates",
  keywords: "seo_keywords",
  renderCache: "seo_render_cache",
  events: "seo_events",
  reports: "seo_reports",
  score: "seo_score",
  scoreChecks: "seo_score_checks",
  recommendations: "seo_recommendations",
  searchConsoleConnections: "search_console_connections",
  searchConsoleReports: "search_console_reports",
  searchConsoleSitemaps: "search_console_sitemaps",
  knownIssues: "known_issues",
  opsSignals: "ops_signals",
  aiAlerts: "ai_alerts",
  knowledgeGaps: "knowledge_gaps"
});

const NAV_ITEMS = [
  ["dashboard", "Dashboard", "/modules/seo/dashboard.html"],
  ["clients", "Kunder", "/modules/seo/clients.html"],
  ["site-builder", "Site-builder", "/modules/seo/site-builder.html"],
  ["generator", "Generator", "/modules/seo/generator.html"],
  ["pages", "Sider", "/modules/seo/pages.html"],
  ["search-console", "Search Console", "/modules/seo/search-console.html"],
  ["reports", "Rapporter", "/modules/seo/reports.html"],
  ["operations", "Operations", "/modules/seo/operations.html"]
];

const PAGE_META = {
  index: {
    title: "SEO Automatik – SEO uden 100.000 forslag",
    description: "SEO Automatik analyserer din hjemmeside, konkurrenter og lokale søgemuligheder og viser de vigtigste SEO-handlinger først."
  },
  dashboard: {
    title: "SEO Automatik dashboard - Madkontrollen Pro",
    description: "Overblik over SEO-kunder, sites, planlagte sider og publiceringsstatus."
  },
  clients: {
    title: "SEO kunder - Madkontrollen Pro",
    description: "Kundeliste til SEO Automatik med seo_only og Madkontrollen bundle kunder."
  },
  "site-builder": {
    title: "SEO site-builder - Madkontrollen Pro",
    description: "Klargør lokale SEO-sites med firmanavn, branche, by, ydelser, søgeord og subdomæne."
  },
  pages: {
    title: "Planlagte SEO sider - Madkontrollen Pro",
    description: "Plan for forside, ydelsesside, by-side, FAQ-side og kampagneside."
  },
  reports: {
    title: "SEO rapporter - Madkontrollen Pro",
    description: "Rapportplaceholder for publicerede sider, CTA klik, besøg, søgeord, sitemap, robots og schema."
  },
  "search-console": {
    title: "Search Console Center - SEO Automatik",
    description: "Tilslutningsstatus, sitemap og setup-guide til Google Search Console for SEO Automatik."
  },
  operations: {
    title: "SEO Operations Center - Madkontrollen Pro",
    description: "Platform health, kendte problemer, trending signals og AI alerts til SEO Automatik."
  }
};

// TODO Firestore v2: replace mock arrays with collection-backed adapters for
// known_issues, ops_signals, ai_alerts and knowledge_gaps.
const OPERATIONS_MOCK = Object.freeze({
  health: [
    { label: "SEO Platform", status: "OK", tone: "ok", detail: "Kontrolpanel og generator er tilgængelige." },
    { label: "Publishing", status: "OK", tone: "ok", detail: "Eksisterende VPS/ZIP publish-flow er aktivt." },
    { label: "Sitemap", status: "OK", tone: "ok", detail: "Sitemap genereres ved package build." },
    { label: "Search Console", status: "Kræver opsætning", tone: "warning", detail: "DNS-verificering mangler for flere kunder." },
    { label: "AI Advisor", status: "Planlagt", tone: "planned", detail: "AI opsummering kobles på signaler senere." }
  ],
  knownIssues: [
    {
      title: "Search Console DNS-verificering",
      status: "Under behandling",
      affectedCustomers: 27,
      priority: "Høj",
      workaround: "Følg DNS-guiden"
    },
    {
      title: "Sitemap ikke fundet",
      status: "Overvåges",
      affectedCustomers: 8,
      priority: "Medium",
      workaround: "Kør publish igen eller kontroller robots/sitemap path"
    }
  ],
  signals: [
    { label: "Search Console", count: 41 },
    { label: "DNS", count: 27 },
    { label: "Sitemap", count: 12 },
    { label: "CTA mangler", count: 9 }
  ],
  aiAlerts: [
    { title: "Nyt mønster fundet", text: "27 kunder har samme DNS-udfordring." },
    { title: "Knowledge gap", text: "Cloudflare guide bør forbedres." },
    { title: "Automation mulig", text: "Sitemap check kan automatiseres." }
  ]
});

// TODO Firestore v2: replace this mock with adapters for
// search_console_connections, search_console_reports and search_console_sitemaps.
const SEARCH_CONSOLE_MOCK = Object.freeze({
  connection: {
    status: "Afventer",
    domain: "cafe-victoria.madkontrollen.dk",
    verifiedAt: "",
    ownerEmail: ""
  },
  sitemap: {
    url: "https://cafe-victoria.madkontrollen.dk/sitemap.xml",
    status: "Klar til indsendelse",
    submittedAt: ""
  },
  setupSteps: [
    { title: "Opret Search Console", text: "Opret en property i Google Search Console for kundens domæne.", status: "Ikke startet" },
    { title: "Bekræft domæne", text: "Bekræft DNS eller URL-prefix efter kundens setup.", status: "Afventer" },
    { title: "Send sitemap", text: "Indsend sitemap.xml når domænet er verificeret.", status: "Afventer" },
    { title: "Aktivér overvågning", text: "Kobl rapporter og tekniske signaler på SEO Automatik.", status: "Planlagt" }
  ],
  metrics: [
    { label: "Indekserede sider", value: "Afventer" },
    { label: "Klik", value: "Afventer" },
    { label: "CTR", value: "Afventer" },
    { label: "Positioner", value: "Afventer" }
  ]
});

// TODO Firestore v2: replace this mock with adapters for
// seo_score, seo_score_checks and seo_recommendations.
const SEO_SCORE_CHECKS = Object.freeze([
  { key: "sitemap", label: "Sitemap", points: 10, ok: true, missingText: "Sitemap mangler" },
  { key: "robots", label: "Robots.txt", points: 10, ok: true, missingText: "Robots.txt mangler" },
  { key: "schema", label: "Schema.org", points: 10, ok: true, missingText: "Schema.org mangler" },
  { key: "contactInfo", label: "Kontaktinfo", points: 10, ok: true, missingText: "Kontaktinfo mangler" },
  { key: "cta", label: "CTA", points: 10, ok: true, missingText: "CTA mangler" },
  { key: "faqPage", label: "FAQ-side", points: 10, ok: false, missingText: "FAQ-side mangler" },
  { key: "servicePage", label: "Ydelsesside", points: 10, ok: true, missingText: "Ydelsesside mangler" },
  { key: "cityPage", label: "By-side", points: 10, ok: true, missingText: "By-side mangler" },
  { key: "searchConsole", label: "Search Console", points: 10, ok: false, missingText: "Search Console ikke tilsluttet" },
  { key: "reviews", label: "Anmeldelser/social proof", points: 10, ok: false, missingText: "Anmeldelser mangler" }
]);

const PAGE_TYPES = [
  {
    type: "Forside",
    title: "Lokal forside",
    intent: "Hovedside med branche, by, kontaktdata og primære CTA'er.",
    status: "Klar"
  },
  {
    type: "Ydelsesside",
    title: "Primær ydelse",
    intent: "Side for vigtigste ydelse eller produktkategori.",
    status: "Planlagt"
  },
  {
    type: "By-side",
    title: "Lokal synlighed",
    intent: "Side målrettet byen og lokale søgefraser.",
    status: "Planlagt"
  },
  {
    type: "FAQ-side",
    title: "Spørgsmål og svar",
    intent: "Kort FAQ til søgninger, schema og kundernes typiske spørgsmål.",
    status: "Planlagt"
  },
  {
    type: "Kampagneside",
    title: "Sæson eller tilbud",
    intent: "Midlertidig eller sæsonbaseret landingsside.",
    status: "Kladde"
  }
];

const DEFAULT_DRAFT = {
  cvr: "",
  businessName: "Cafe Victoria",
  industryCode: "",
  industry: "Restaurant",
  industryText: "Restaurant",
  city: "Ringkøbing",
  postalCode: "",
  country: "Danmark",
  address: "Torvet 12",
  addressSource: "manual",
  lat: "",
  lng: "",
  phone: "+45 31 31 42 59",
  email: "kontakt@cafe-victoria.dk",
  website: "",
  domain: "cafe-victoria.madkontrollen.dk",
  subdomain: "cafe-victoria",
  offerings: "Restaurant, frokost, aftensmad, selskaber",
  primaryKeywords: "restaurant ringkøbing, cafe victoria, frokost ringkøbing",
  customerType: "seo_only"
};

const EMPTY_DRAFT = {
  cvr: "",
  businessName: "",
  industryCode: "",
  industry: "",
  industryText: "",
  city: "",
  postalCode: "",
  country: "Danmark",
  address: "",
  addressSource: "manual",
  lat: "",
  lng: "",
  phone: "",
  email: "",
  website: "",
  domain: "",
  subdomain: "",
  offerings: "",
  primaryKeywords: "",
  customerType: "seo_only"
};

function readDraft() {
  try {
    const stored = JSON.parse(localStorage.getItem("seoAutomatikDraft") || "{}");
    return { ...DEFAULT_DRAFT, ...stored };
  } catch {
    return { ...DEFAULT_DRAFT };
  }
}

function readStoredDraft() {
  try {
    const stored = JSON.parse(localStorage.getItem("seoAutomatikDraft") || "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

function draftFromBusinessContext(context = {}) {
  const business = getBusinessSnapshotFromContext(context);
  if (business.source === "missing") return {};
  return {
    cvr: business.cvr,
    businessName: business.companyName,
    industryCode: business.industryCode,
    industry: business.industryText,
    industryText: business.industryText,
    city: business.city,
    postalCode: business.postalCode,
    address: business.address,
    phone: business.phone,
    email: business.email,
    customerType: business.activeModules?.includes("egenkontrol") ? "madkontrollen_bundle" : "seo_only"
  };
}

function writeDraft(draft) {
  const normalizedDraft = normalizeSeoBuilderDraft(draft);
  localStorage.setItem("seoAutomatikDraft", JSON.stringify(normalizedDraft));
  const scopedKey = getScopedGeneratorDraftKey();
  if (scopedKey) {
    localStorage.setItem(scopedKey, JSON.stringify(toGeneratorDraft(normalizedDraft)));
  }
}

function getSessionContext() {
  let locationId = String(sessionStorage.getItem("mkp_selected_locationId") || "").trim();
  if (!locationId) {
    try {
      const locationIds = JSON.parse(sessionStorage.getItem("mkp_user_locationIds") || "[]");
      locationId = String(Array.isArray(locationIds) ? locationIds[0] || "" : "").trim();
    } catch {
      locationId = "";
    }
  }
  return {
    companyId: String(sessionStorage.getItem("mkp_user_companyId") || "").trim(),
    locationId
  };
}

function getScopedGeneratorDraftKey() {
  const { companyId, locationId } = getSessionContext();
  return companyId && locationId ? `seoGenerator:${companyId}:${locationId}` : "";
}

function normalizeSeoBuilderDraft(draft = {}) {
  const next = { ...DEFAULT_DRAFT, ...draft };
  const domainInput = cleanText(next.domain || "");
  const subdomain = domainInput
    ? normalizeDomainInput(domainInput)
    : toSeoDomainSlug([next.businessName, next.city].filter(Boolean).join(" "), "restaurant");
  const industryText = cleanText(next.industryText || next.industry);
  return {
    ...next,
    industry: cleanText(next.industry || industryText),
    industryText,
    postalCode: cleanText(next.postalCode || next.zip),
    country: cleanText(next.country || "Danmark"),
    addressSource: cleanText(next.addressSource || next.address?.source || "manual"),
    lat: next.lat === 0 || next.lat ? String(next.lat) : "",
    lng: next.lng === 0 || next.lng ? String(next.lng) : "",
    subdomain,
    domain: domainInput || `${subdomain}.madkontrollen.dk`
  };
}

function toGeneratorDraft(draft = {}) {
  const normalized = normalizeSeoBuilderDraft(draft);
  const { companyId, locationId } = getSessionContext();
  const firstKeyword = normalizeLines(normalized.primaryKeywords)[0] || `${normalized.industry} ${normalized.city}`.trim();
  return {
    companyId,
    locationId,
    businessName: normalized.businessName,
    subdomain: normalized.subdomain,
    city: normalized.city,
    cuisineType: normalized.industry,
    offerings: normalized.offerings,
    keyword: firstKeyword,
    phone: normalized.phone,
    address: normalized.address,
    description: `${normalized.businessName} er en lokal ${normalized.industry.toLowerCase()} i ${normalized.city}.`,
    pageCount: "50",
    selectedTemplate: "classic",
    websiteUrl: normalized.website || "",
    cta: {
      enabled: true,
      text: normalized.phone ? "Ring nu" : "Besøg vores hjemmeside",
      url: normalized.phone ? `tel:${normalized.phone.replace(/\s+/g, "")}` : normalized.website || ""
    },
    ctaText: normalized.phone ? "Ring nu" : "Besøg vores hjemmeside",
    ctaUrl: normalized.phone ? `tel:${normalized.phone.replace(/\s+/g, "")}` : normalized.website || "",
    seoAutomatikCustomerType: normalized.customerType,
    savedAt: Date.now()
  };
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeLines(value) {
  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toSeoDomainSlug(value, fallback = "lokal-virksomhed") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function normalizeDomainInput(value) {
  const raw = cleanText(value)
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.madkontrollen\.dk$/i, "");
  return toSeoDomainSlug(raw, "lokal-virksomhed");
}

function buildStructuredAddress(draft = {}) {
  return {
    street: cleanText(draft.address),
    postalCode: cleanText(draft.postalCode || draft.zip),
    city: cleanText(draft.city),
    country: cleanText(draft.country || "Danmark"),
    lat: draft.lat === 0 || draft.lat ? Number(draft.lat) : "",
    lng: draft.lng === 0 || draft.lng ? Number(draft.lng) : "",
    source: cleanText(draft.addressSource || "manual")
  };
}

function buildBuilderSeo(draft = {}, domain = "") {
  const normalized = normalizeSeoBuilderDraft(draft);
  const industry = cleanText(normalized.industryText || normalized.industry || "Virksomhed");
  const city = cleanText(normalized.city);
  const title = [normalized.businessName, [industry, city ? `i ${city}` : ""].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" - ");
  const metaDescription = `${industry}${city ? ` i ${city}` : ""}. Find ${normalized.businessName || "virksomheden"}, adresse, kontakt og lokale ydelser.`;
  return {
    domain: domain || buildSeoSiteDomain({
      domain: normalized.domain,
      subdomain: normalized.domain || normalized.businessName,
      businessName: normalized.businessName
    }),
    slug: normalized.subdomain || toSeoDomainSlug(normalized.businessName, "lokal-virksomhed"),
    title,
    metaDescription,
    primaryKeywords: normalizeLines(normalized.primaryKeywords),
    services: normalizeLines(normalized.offerings)
  };
}

function debounce(fn, delay = 400) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

function firstTruthy(...values) {
  return values.find((value) => cleanText(value)) || "";
}

function pickCompanyValue(raw = {}, aliases = []) {
  const roots = [raw, raw.company, raw.business, raw.result, raw.data]
    .filter((item) => item && typeof item === "object");
  for (const root of roots) {
    for (const alias of aliases) {
      const value = root[alias];
      if (cleanText(value)) return value;
    }
  }
  return "";
}

function normalizeCompanyResult(raw = {}) {
  const companyName = firstTruthy(pickCompanyValue(raw, [
    "companyName",
    "name",
    "navn",
    "virksomhed",
    "legalName"
  ]));
  const industryText = firstTruthy(pickCompanyValue(raw, [
    "industryText",
    "industry",
    "branche",
    "industrydesc",
    "companydesc"
  ]));
  return {
    cvr: cleanText(pickCompanyValue(raw, ["cvr", "cvrNumber", "vat", "vatNumber", "vatnumber"])).replace(/\D/g, ""),
    companyName,
    industryCode: cleanText(pickCompanyValue(raw, ["industryCode", "industrycode", "industry_code", "branchekode"])),
    industryText,
    address: cleanText(pickCompanyValue(raw, ["address", "adresse"])),
    postalCode: cleanText(pickCompanyValue(raw, ["postalCode", "zip", "zipcode", "postnummer"])),
    city: cleanText(pickCompanyValue(raw, ["city", "by"])),
    phone: cleanText(pickCompanyValue(raw, ["phone", "telephone", "telefon", "tlf"])),
    email: cleanText(pickCompanyValue(raw, ["email", "mail"])).toLowerCase(),
    website: cleanText(pickCompanyValue(raw, ["website", "homepage", "domain", "url"]))
  };
}

function normalizeCompanyResults(response = {}) {
  const data = response?.data || response || {};
  const nested = data.company || data.business || data.result || {};
  const list = Array.isArray(data.results)
    ? data.results
    : Array.isArray(data.companies)
      ? data.companies
      : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.matches)
          ? data.matches
          : [{ ...nested, ...data }];
  return list
    .map(normalizeCompanyResult)
    .filter((item) => item.companyName || item.cvr)
    .slice(0, 8);
}

function normalizeCvrSearchInput(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 8);
}

function isCvrOnlySearch(value) {
  const stripped = String(value || "")
    .trim()
    .replace(/cvr\s*(?:nr\.?|nummer)?/gi, "")
    .replace(/^dk\s*/i, "")
    .trim();
  return Boolean(stripped) && /^[\d\s./-]+$/.test(stripped);
}

function getCompanySearchQuery(query) {
  const value = cleanText(query);
  if (value.length < 2) {
    return { canSearch: false, message: "" };
  }

  if (isCvrOnlySearch(value)) {
    const cvr = normalizeCvrSearchInput(value);
    if (/^\d{8}$/.test(cvr) && value.replace(/\D/g, "").length === 8) {
      return { canSearch: true, type: "cvr", value: cvr };
    }
    return { canSearch: false, message: "Indtast 8 cifre for CVR-opslag." };
  }

  return { canSearch: true, type: "name", value };
}

async function searchCompanies(query) {
  const search = query && typeof query === "object" && "canSearch" in query
    ? query
    : getCompanySearchQuery(query);
  if (!search.canSearch) return [];
  const payload = search.type === "cvr"
    ? { cvr: search.value, query: search.value, search: search.value }
    : { query: search.value, search: search.value, companyName: search.value, name: search.value };
  const response = await lookupCvrCallable(payload);
  return normalizeCompanyResults(response);
}

function normalizeDawaSuggestion(raw = {}) {
  const data = raw.data || {};
  const adresse = data.adresse || {};
  const adgangsadresse = adresse.adgangsadresse || {};
  const vejstykke = adgangsadresse.vejstykke || {};
  const husnr = adgangsadresse.husnr || "";
  const street = cleanText([
    vejstykke.navn || data.vejnavn || raw.tekst,
    husnr
  ].filter(Boolean).join(" "));
  const coordinates = adresse?.adgangsadresse?.adgangspunkt?.koordinater || adgangsadresse?.adgangspunkt?.koordinater || [];
  return {
    label: cleanText(raw.tekst || [street, data.postnr, data.postnrnavn].filter(Boolean).join(", ")),
    street: street || cleanText(raw.tekst || "").replace(/,\s*\d{4}.*$/, ""),
    postalCode: cleanText(data.postnr || adgangsadresse.postnummer?.nr),
    city: cleanText(data.postnrnavn || adgangsadresse.postnummer?.navn),
    country: "Danmark",
    lat: Number.isFinite(Number(coordinates[1])) ? Number(coordinates[1]) : "",
    lng: Number.isFinite(Number(coordinates[0])) ? Number(coordinates[0]) : "",
    source: "dawa"
  };
}

async function searchAddresses(query) {
  const value = cleanText(query);
  if (value.length < 3) return [];
  const url = `https://api.dataforsyningen.dk/adresser/autocomplete?q=${encodeURIComponent(value)}&per_side=7`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error("Adresseforslag kunne ikke hentes.");
  }
  const data = await response.json();
  return (Array.isArray(data) ? data : [])
    .map(normalizeDawaSuggestion)
    .filter((item) => item.label || item.street)
    .slice(0, 7);
}

function suggestDomainFromCompany(company = {}) {
  const website = cleanText(company.website);
  if (website) {
    try {
      const parsed = new URL(website.startsWith("http") ? website : `https://${website}`);
      const host = parsed.hostname.replace(/^www\./i, "");
      const firstLabel = host.split(".")[0];
      return `${toSeoDomainSlug(firstLabel || company.companyName, "lokal-virksomhed")}.madkontrollen.dk`;
    } catch {
      return `${toSeoDomainSlug(website, "lokal-virksomhed")}.madkontrollen.dk`;
    }
  }
  const seed = [company.companyName, company.city].filter(Boolean).join(" ");
  return `${toSeoDomainSlug(seed, "lokal-virksomhed")}.madkontrollen.dk`;
}

function suggestKeywords({ companyName, industryText, city } = {}) {
  const industry = cleanText(industryText).toLowerCase();
  const cityValue = cleanText(city).toLowerCase();
  const name = cleanText(companyName).toLowerCase();
  return [
    [industry, cityValue].filter(Boolean).join(" "),
    name,
    cityValue ? `frokost ${cityValue}` : ""
  ].filter(Boolean).join(", ");
}

function sanitizeDraftForSave(draft = {}) {
  const normalized = normalizeSeoBuilderDraft(draft);
  const seo = buildBuilderSeo(normalized);
  return removeEmptyValues({
    status: "draft",
    customerType: normalized.customerType || "seo_only",
    company: {
      cvr: normalized.cvr,
      name: normalized.businessName,
      industryCode: normalized.industryCode,
      industryText: normalized.industryText || normalized.industry,
      phone: normalized.phone,
      email: normalized.email,
      website: normalized.website
    },
    address: buildStructuredAddress(normalized),
    seo,
    generatorDraft: toGeneratorDraft(normalized)
  });
}

function removeEmptyValues(value) {
  if (Array.isArray(value)) {
    return value.map(removeEmptyValues).filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, removeEmptyValues(item)])
        .filter(([, item]) => item !== undefined)
    );
  }
  if (value === undefined || value === "") return undefined;
  return value;
}

function getPageKey() {
  return document.body?.dataset?.seoPage || "index";
}

function setupHead(pageKey) {
  const meta = PAGE_META[pageKey] || PAGE_META.index;
  const canonicalPath = pageKey === "index" ? "/modules/seo/" : `/modules/seo/${pageKey}.html`;
  setSeoHead({
    title: meta.title,
    description: meta.description,
    canonical: canonicalPath
  });
}

function renderShell(pageKey) {
  const shell = document.querySelector("[data-seo-shell]");
  if (!shell) return;
  shell.innerHTML = `
    <header class="seo-topbar">
      <div class="seo-topbar-inner">
        <a class="seo-brand" href="/modules/seo/index.html" aria-label="SEO Automatik">
          <span class="seo-brand-mark">SEO</span>
          <span>
            <strong class="seo-brand-title">SEO Automatik</strong>
            <span class="seo-brand-subtitle">For lokale virksomheder</span>
          </span>
        </a>
        <nav class="seo-nav" aria-label="SEO modul navigation">
          ${NAV_ITEMS.map(([key, label, href]) => `
            <a href="${href}" ${key === pageKey ? 'aria-current="page"' : ""}>${label}</a>
          `).join("")}
        </nav>
      </div>
    </header>
    <main class="seo-main" data-seo-main></main>
  `;
}

function getMockState(platformContext = {}) {
  const storedDraft = readStoredDraft();
  const contextDraft = draftFromBusinessContext(platformContext);
  const draft = Object.keys(storedDraft).length
    ? { ...DEFAULT_DRAFT, ...contextDraft, ...storedDraft }
    : { ...DEFAULT_DRAFT, ...contextDraft };
  const domain = buildSeoSiteDomain({
    domain: draft.domain,
    subdomain: draft.domain || draft.businessName,
    businessName: draft.businessName
  });
  const services = normalizeLines(draft.offerings);
  const keywords = normalizeLines(draft.primaryKeywords);
  const client = {
    id: "local-draft",
    name: draft.businessName,
    industry: draft.industry,
    city: draft.city,
    customerType: draft.customerType,
    status: "Kladde"
  };
  return {
    draft,
    domain,
    services,
    keywords,
    clients: [
      client,
      {
        id: "seo-only-demo",
        name: "Det Gyldne Krus",
        industry: "Cafe",
        city: "Herning",
        customerType: "seo_only",
        status: "Publiceret"
      },
      {
        id: "bundle-demo",
        name: "Aroi-D",
        industry: "Thai restaurant",
        city: "Ørnhøj",
        customerType: "madkontrollen_bundle",
        status: "Under opbygning"
      }
    ],
    pages: PAGE_TYPES.map((page, index) => ({
      ...page,
      slug: index === 0 ? "/" : `/${slugifySeoPathPart(`${page.type} ${draft.city}`, "side")}/`,
      keyword: keywords[index] || `${draft.industry} ${draft.city}`
    })),
    seoScore: buildSeoScoreState(SEO_SCORE_CHECKS),
    searchConsole: SEARCH_CONSOLE_MOCK,
    operations: OPERATIONS_MOCK
  };
}

function buildSeoScoreState(checks = []) {
  const normalizedChecks = checks.map((check) => ({
    ...check,
    points: Number(check.points) || 0,
    ok: check.ok === true
  }));
  const score = normalizedChecks.reduce((total, check) => total + (check.ok ? check.points : 0), 0);
  const ok = normalizedChecks.filter((check) => check.ok);
  const missing = normalizedChecks.filter((check) => !check.ok);
  return {
    score,
    maxScore: 100,
    ok,
    missing,
    recommendations: [
      "Tilslut Search Console og opret FAQ-side for at løfte scoren.",
      "Tilføj anmeldelser eller anden social proof, når kunden har materiale klar."
    ]
  };
}

function renderIndex(main, state) {
  main.innerHTML = `
    <section class="seo-hero">
      <div class="seo-hero-panel">
        <span class="seo-eyebrow">SEO Automatik</span>
        <h1>SEO uden 100.000 forslag.</h1>
        <p>SEO Automatik analyserer din hjemmeside, dine konkurrenter og dine lokale søgemuligheder — og viser dig præcis, hvad du bør gøre først.</p>
        <div class="seo-hero-lines">
          <span>Ikke flere endeløse lister.</span>
          <span>Ikke flere uklare rapporter.</span>
          <span>Bare konkrete handlinger, prioriteret efter effekt.</span>
        </div>
        <div class="seo-actions">
          <a class="seo-btn primary" href="/modules/seo/site-builder.html">Start gratis SEO-analyse</a>
          <a class="seo-btn ghost" href="#seo-how-it-works">Se hvordan det virker</a>
        </div>
      </div>
      <aside class="seo-card seo-decision-card">
        <h2>Beslutning før dashboard</h2>
        <p>SEO Automatik samler signalerne og gør næste handling tydelig, før du drukner i data.</p>
        <ol class="seo-priority-list" aria-label="Prioriteret SEO beslutningstrappe">
          <li><strong>100.000</strong><span>muligheder</span></li>
          <li><strong>10.000</strong><span>filtrerede forslag</span></li>
          <li><strong>50</strong><span>anbefalinger</span></li>
          <li><strong>12</strong><span>konkrete handlinger</span></li>
        </ol>
        <p class="seo-decision-note">SEO Automatik vælger det vigtigste for dig.</p>
      </aside>
    </section>
    <section class="seo-position-section">
      <article class="seo-card seo-problem-card">
        <span class="seo-eyebrow light">Problemet</span>
        <h2>De fleste SEO-værktøjer giver dig flere tal, flere grafer og flere opgaver.</h2>
        <p>Men en travl virksomhedsejer har ikke brug for 100.000 søgeord. Han har brug for at vide:</p>
        <ul class="seo-question-list">
          <li>Hvad skal jeg rette først?</li>
          <li>Hvilke sider mangler?</li>
          <li>Hvorfor ligger konkurrenten foran mig?</li>
          <li>Hvad kan give kunder hurtigst?</li>
        </ul>
        <p>Det er derfor vi bygger SEO Automatik.</p>
        <p>SEO Automatik læser din hjemmeside, sammenligner med dine konkurrenter og finder de vigtigste handlinger.</p>
        <p>Ikke 10.000 forslag. Ikke en rapport du aldrig får læst. Bare en prioriteret liste over det, der faktisk kan flytte din synlighed.</p>
      </article>
    </section>
    <section class="seo-decision-ladder-section">
      <div class="seo-ladder">
        <div><strong>100.000</strong><span>muligheder</span></div>
        <span class="seo-ladder-arrow">↓</span>
        <div><strong>10.000</strong><span>filtrerede forslag</span></div>
        <span class="seo-ladder-arrow">↓</span>
        <div><strong>50</strong><span>anbefalinger</span></div>
        <span class="seo-ladder-arrow">↓</span>
        <div><strong>12</strong><span>konkrete handlinger</span></div>
      </div>
      <article class="seo-card seo-ladder-copy">
        <span class="seo-eyebrow light">Prioritering</span>
        <h2>SEO Automatik vælger det vigtigste for dig.</h2>
        <p>Du skal ikke sortere alle muligheder selv. Systemet samler tekniske fejl, lokale søgemuligheder, konkurrentdata og sidebehov til en kort, prioriteret handlingsliste.</p>
      </article>
    </section>
    <section class="seo-how-section" id="seo-how-it-works">
      <div class="seo-section-head">
        <span class="seo-eyebrow light">Sådan virker det</span>
        <h2>Fra analyse til konkrete handlinger</h2>
      </div>
      <div class="seo-grid">
        ${renderFeatureCard("Vi læser din hjemmeside", "SEO Automatik gennemgår dine sider, tekster, titler, metadata og lokale signaler.")}
        ${renderFeatureCard("Vi sammenligner med konkurrenterne", "Systemet ser på, hvad konkurrenterne gør bedre — og hvor du kan overhale dem.")}
        ${renderFeatureCard("Vi prioriterer handlingerne", "Du får ikke 10.000 forslag. Du får de vigtigste opgaver først.")}
        ${renderFeatureCard("Du ser scoren flytte sig", "Når fejl bliver rettet og sider bliver forbedret, ændrer SEO-scoren sig automatisk.")}
      </div>
    </section>
    <section class="seo-grid">
      ${renderFeatureCard("SEO-only klar", "Kundetype kan være seo_only, så virksomheden ikke skal igennem HACCP-flowet.")}
      ${renderFeatureCard("Genbruger publish-flow", "ZIP, sitemap, robots og renderer bor fortsat i den eksisterende SEO-pipeline.")}
      ${renderFeatureCard("Lokale sider", "Forside, ydelse, by, FAQ og kampagne er forberedt som planlagte sidetyper.")}
    </section>
    <p class="seo-footer-note">Aktiv draft: ${escapeHtml(state.draft.businessName)} · ${escapeHtml(state.domain)}. Generatoren og publish-flowet bevares i den eksisterende VPS-pipeline.</p>
  `;
}

function renderFeatureCard(title, text) {
  return `
    <article class="seo-card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
    </article>
  `;
}

function renderDashboard(main, state) {
  main.innerHTML = `
    ${renderPageHead("SEO Automatik dashboard", "Overblik over kunder, planlagte sider og publiceringsstatus for lokale SEO-sites.")}
    ${renderSeoScore(state.seoScore)}
    <section class="seo-grid">
      ${renderStatCard("SEO kunder", state.clients.length, "seo_clients")}
      ${renderStatCard("Planlagte sider", state.pages.length, "seo_pages")}
      ${renderStatCard("Publiceret domæne", "1", state.domain)}
    </section>
    <section class="seo-grid two" style="margin-top:16px;">
      ${renderStatusCard("Næste handling", "Klargør site-builder draft og send til eksisterende generator/publish-flow.")}
      ${renderStatusCard("Produktstatus", "Mock/data-adapter v1. Backend kobles på eksisterende collections i næste fase.")}
    </section>
  `;
}

function renderSeoScore(scoreState = buildSeoScoreState(SEO_SCORE_CHECKS)) {
  const okItems = scoreState.ok || [];
  const missingItems = scoreState.missing || [];
  const primaryRecommendation = scoreState.recommendations?.[0] || "Fortsæt med næste tekniske SEO-handling.";
  return `
    <section class="seo-score-card">
      <div class="seo-score-main">
        <span class="seo-eyebrow">SEO Score</span>
        <strong class="seo-score-value">${escapeHtml(scoreState.score)}/${escapeHtml(scoreState.maxScore)}</strong>
        <p>En simpel v1-score baseret på teknisk klargøring, sideindhold og konverteringssignaler.</p>
      </div>
      <div class="seo-score-columns">
        <article>
          <h2>OK</h2>
          <ul class="seo-check-list ok">
            ${okItems.map((item) => `<li><span aria-hidden="true">✓</span>${escapeHtml(item.label)}</li>`).join("")}
          </ul>
        </article>
        <article>
          <h2>Mangler</h2>
          <ul class="seo-check-list missing">
            ${missingItems.map((item) => `<li><span aria-hidden="true">!</span>${escapeHtml(item.missingText || item.label)}</li>`).join("")}
          </ul>
        </article>
        <article>
          <h2>AI-anbefaling</h2>
          <p>${escapeHtml(primaryRecommendation)}</p>
        </article>
      </div>
    </section>
  `;
}

function renderPageHead(title, text) {
  return `
    <section class="seo-page-head">
      <span class="seo-eyebrow">SEO Automatik</span>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(text)}</p>
    </section>
  `;
}

function renderStatCard(label, value, hint) {
  return `
    <article class="seo-card">
      <h2>${escapeHtml(label)}</h2>
      <span class="seo-stat">${escapeHtml(value)}</span>
      <p>${escapeHtml(hint)}</p>
    </article>
  `;
}

function renderStatusCard(title, text, hint = "") {
  return `
    <article class="seo-card">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(text)}</p>
      ${hint ? `<p class="seo-footer-note">${escapeHtml(hint)}</p>` : ""}
    </article>
  `;
}

function renderClients(main, state) {
  main.innerHTML = `
    ${renderPageHead("SEO kunder", "Kunder kan være SEO-only eller bundlet med Madkontrollen.")}
    <div class="seo-table-wrap">
      <table class="seo-table">
        <thead>
          <tr>
            <th>Kunde</th>
            <th>Branche</th>
            <th>By</th>
            <th>Kundetype</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${state.clients.map((client) => `
            <tr>
              <td><strong>${escapeHtml(client.name)}</strong></td>
              <td>${escapeHtml(client.industry)}</td>
              <td>${escapeHtml(client.city)}</td>
              <td><span class="seo-badge ${client.customerType === "seo_only" ? "blue" : ""}">${escapeHtml(client.customerType)}</span></td>
              <td>${escapeHtml(client.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSiteBuilder(main, state) {
  const draft = normalizeSeoBuilderDraft(state.draft);
  main.innerHTML = `
    ${renderPageHead("Site-builder", "Klargør SEO-data til lokale virksomheder. Gemmer foreløbigt som frontend draft og matcher den eksisterende generator-model.")}
    <section class="seo-grid two">
      <form class="seo-form-panel" data-seo-builder-form>
        <h2>Virksomhedsdata</h2>
        <div class="seo-form-grid">
          ${renderCompanySearchField()}
          ${renderHiddenField("cvr", draft.cvr)}
          ${renderHiddenField("industryCode", draft.industryCode)}
          ${renderHiddenField("industryText", draft.industryText || draft.industry)}
          ${renderHiddenField("website", draft.website)}
          ${renderHiddenField("country", draft.country || "Danmark")}
          ${renderHiddenField("addressSource", draft.addressSource)}
          ${renderHiddenField("lat", draft.lat)}
          ${renderHiddenField("lng", draft.lng)}
          ${renderField("firmanavn", "Firmanavn", "businessName", draft.businessName)}
          ${renderField("branche", "Branche", "industry", draft.industry)}
          ${renderField("postnummer", "Postnummer", "postalCode", draft.postalCode)}
          ${renderField("by", "By", "city", draft.city)}
          ${renderAddressField(draft.address)}
          ${renderField("telefon", "Telefon", "phone", draft.phone)}
          ${renderField("email", "Email", "email", draft.email, "email")}
          ${renderField("domaene-subdomaene", "Domæne/subdomæne", "domain", draft.domain)}
          <label class="seo-field">
            <span>Kundetype</span>
            <select name="customerType">
              <option value="seo_only" ${draft.customerType === "seo_only" ? "selected" : ""}>seo_only</option>
              <option value="madkontrollen_bundle" ${draft.customerType === "madkontrollen_bundle" ? "selected" : ""}>madkontrollen_bundle</option>
            </select>
          </label>
          ${renderTextarea("Ydelser/produkter", "offerings", draft.offerings)}
          ${renderTextarea("Primære søgeord", "primaryKeywords", draft.primaryKeywords)}
        </div>
        <p class="seo-inline-status" data-seo-builder-status role="status"></p>
        <div class="seo-actions">
          <button class="seo-btn primary" type="submit">Gem draft</button>
          <a class="seo-btn" href="/modules/seo/generator.html" data-generator-link>Åbn VPS-generator</a>
          <button class="seo-btn" type="button" data-clear-builder>Ryd formular</button>
        </div>
      </form>
      <aside class="seo-card seo-preview-box" data-seo-builder-preview>
        ${renderBuilderPreview(state)}
      </aside>
    </section>
  `;

  const form = main.querySelector("[data-seo-builder-form]");
  if (!form) return;

  setupCompanySearch(main, form);
  setupAddressSearch(main, form);
  syncGeneratorLink(main);

  form.addEventListener("input", (event) => {
    if (event.target?.name && event.target.type !== "hidden") {
      event.target.dataset.userEdited = "true";
    }
    if (event.target?.name === "domain") {
      form.dataset.domainTouched = "true";
    }
    if (event.target?.name === "address") {
      setFormValue(form, "addressSource", "manual");
    }
    updateBuilderPreview(main);
    syncGeneratorLink(main);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = main.querySelector("[data-seo-builder-status]");
    const nextDraft = normalizeSeoBuilderDraft(getDraftFromForm(form));
    writeDraft(nextDraft);
    updateBuilderPreview(main, "Gemmer draft...");
    setStatus(status, "Gemmer draft...");
    try {
      const payload = sanitizeDraftForSave(nextDraft);
      const result = await saveSeoSiteDraftCallable(payload);
      const draftId = cleanText(result?.data?.id || result?.data?.siteId);
      if (draftId) {
        localStorage.setItem("seoAutomatikDraftId", draftId);
      }
      updateBuilderPreview(main, draftId ? `Draft gemt: ${draftId}` : "Draft gemt");
      setStatus(status, draftId ? `Draft gemt i seo_sites (${draftId}).` : "Draft gemt i seo_sites.");
      syncGeneratorLink(main, draftId);
    } catch (error) {
      console.error("SEO draft kunne ikke gemmes:", error);
      updateBuilderPreview(main, "Draft gemt lokalt");
      setStatus(status, "Draft er gemt lokalt. Firestore-save fejlede, men formularen kan fortsat bruges.", true);
    }
  });

  main.querySelector("[data-clear-builder]")?.addEventListener("click", () => {
    fillBuilderForm(form, EMPTY_DRAFT, { overwriteDomain: true });
    form.dataset.domainTouched = "";
    updateBuilderPreview(main, "Formular ryddet");
    setStatus(main.querySelector("[data-seo-builder-status]"), "");
  });
}

function renderField(id, label, name, value, type = "text") {
  return `
    <label class="seo-field" for="${id}">
      <span>${escapeHtml(label)}</span>
      <input id="${id}" name="${name}" type="${type}" value="${escapeHtml(value)}">
    </label>
  `;
}

function renderHiddenField(name, value) {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
}

function renderCompanySearchField() {
  return `
    <label class="seo-field full seo-suggest-field" for="cvr-company-search">
      <span>Søg CVR eller firmanavn</span>
      <input id="cvr-company-search" type="search" autocomplete="off" placeholder="Søg fx Café Victoria, Aroi-D eller CVR-nummer" data-company-search>
      <div class="seo-suggestions" data-company-suggestions hidden></div>
    </label>
  `;
}

function renderAddressField(value) {
  return `
    <label class="seo-field seo-suggest-field" for="adresse">
      <span>Adresse</span>
      <input id="adresse" name="address" type="text" autocomplete="street-address" value="${escapeHtml(value)}" data-address-search>
      <div class="seo-suggestions" data-address-suggestions hidden></div>
    </label>
  `;
}

function renderTextarea(label, name, value) {
  return `
    <label class="seo-field full">
      <span>${escapeHtml(label)}</span>
      <textarea name="${name}">${escapeHtml(value)}</textarea>
    </label>
  `;
}

function getDraftFromForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function setFormValue(form, name, value, options = {}) {
  const field = form?.elements?.[name];
  if (!field) return;
  const nextValue = value ?? "";
  if (options.skipEmpty !== false && !cleanText(nextValue) && nextValue !== 0) return;
  if (options.preserveUserEdited && field.dataset.userEdited === "true" && cleanText(field.value)) return;
  field.value = value ?? "";
}

function fillBuilderForm(form, values = {}, options = {}) {
  const overwriteDomain = options.overwriteDomain === true || form.dataset.domainTouched !== "true";
  Object.entries(values).forEach(([name, value]) => {
    if (name === "domain" && !overwriteDomain) return;
    setFormValue(form, name, value, {
      preserveUserEdited: options.preserveUserEdited === true,
      skipEmpty: options.skipEmpty
    });
  });
}

function logCompanySearchError(error, context = {}) {
  console.error("[seo site-builder] CVR-opslag fejlede", {
    originalInput: context.originalInput || "",
    normalizedInput: context.search?.value || "",
    callable: "lookupCvr",
    helper: "searchCompanies",
    errorCode: error?.code || error?.status || "",
    errorMessage: error?.message || "",
    responseStatus: error?.customData?.status || error?.status || "",
    details: error?.details || error?.customData || null
  }, error);
}

function setStatus(element, message, isError = false) {
  if (!element) return;
  element.textContent = message || "";
  element.dataset.tone = isError ? "error" : "";
}

function renderSuggestionState(element, message) {
  if (!element) return;
  element.hidden = false;
  element.innerHTML = `<div class="seo-suggestion-state">${escapeHtml(message)}</div>`;
}

function hideSuggestions(element) {
  if (!element) return;
  element.hidden = true;
  element.innerHTML = "";
}

function setupCompanySearch(main, form) {
  const input = main.querySelector("[data-company-search]");
  const list = main.querySelector("[data-company-suggestions]");
  const status = main.querySelector("[data-seo-builder-status]");
  if (!input || !list) return;

  const runSearch = debounce(async () => {
    const query = cleanText(input.value);
    if (query.length < 2) {
      hideSuggestions(list);
      return;
    }
    const search = getCompanySearchQuery(query);
    if (!search.canSearch) {
      if (search.message) {
        renderSuggestionState(list, search.message);
      } else {
        hideSuggestions(list);
      }
      return;
    }
    renderSuggestionState(list, "Søger...");
    try {
      const companies = await searchCompanies(search);
      if (!companies.length) {
        renderSuggestionState(list, "Ingen virksomheder fundet.");
        return;
      }
      list.hidden = false;
      list.innerHTML = companies.map((company, index) => `
        <button type="button" class="seo-suggestion-item" data-company-index="${index}">
          <strong>${escapeHtml(company.companyName || "Ukendt virksomhed")}</strong>
          <span>${escapeHtml([company.cvr && `CVR ${company.cvr}`, company.address, company.postalCode, company.city].filter(Boolean).join(" · "))}</span>
          ${company.industryText ? `<span>${escapeHtml(company.industryText)}</span>` : ""}
        </button>
      `).join("");
      list.querySelectorAll("[data-company-index]").forEach((button) => {
        button.addEventListener("click", () => {
          const company = companies[Number(button.dataset.companyIndex)] || {};
          applyCompanyToForm(form, company);
          input.value = company.companyName || company.cvr || "";
          hideSuggestions(list);
          setStatus(status, "CVR-data er udfyldt. Du kan stadig rette felterne manuelt.");
          updateBuilderPreview(main);
          syncGeneratorLink(main);
        });
      });
    } catch (error) {
      logCompanySearchError(error, {
        originalInput: query,
        search
      });
      renderSuggestionState(list, "CVR-opslag kunne ikke hentes. Du kan stadig udfylde manuelt.");
    }
  }, 400);

  input.addEventListener("input", runSearch);
}

function setupAddressSearch(main, form) {
  const input = main.querySelector("[data-address-search]");
  const list = main.querySelector("[data-address-suggestions]");
  const status = main.querySelector("[data-seo-builder-status]");
  if (!input || !list) return;

  const runSearch = debounce(async () => {
    const query = cleanText(input.value);
    if (query.length < 3) {
      hideSuggestions(list);
      return;
    }
    renderSuggestionState(list, "Søger...");
    try {
      const addresses = await searchAddresses(query);
      if (!addresses.length) {
        renderSuggestionState(list, "Ingen adresser fundet.");
        return;
      }
      list.hidden = false;
      list.innerHTML = addresses.map((address, index) => `
        <button type="button" class="seo-suggestion-item" data-address-index="${index}">
          <strong>${escapeHtml(address.label || address.street)}</strong>
          <span>${escapeHtml([address.postalCode, address.city, address.country].filter(Boolean).join(" · "))}</span>
        </button>
      `).join("");
      list.querySelectorAll("[data-address-index]").forEach((button) => {
        button.addEventListener("click", () => {
          const address = addresses[Number(button.dataset.addressIndex)] || {};
          applyAddressToForm(form, address);
          hideSuggestions(list);
          setStatus(status, "Adresse er valideret via DAWA.");
          updateBuilderPreview(main);
        });
      });
    } catch (error) {
      console.warn("Adresse autosøgning fejlede:", error);
      renderSuggestionState(list, "Adresseforslag kunne ikke hentes. Du kan stadig udfylde manuelt.");
    }
  }, 400);

  input.addEventListener("input", runSearch);
}

function applyCompanyToForm(form, company) {
  const normalized = normalizeCompanyResult(company);
  const domain = suggestDomainFromCompany(normalized);
  const keywords = suggestKeywords({
    companyName: normalized.companyName,
    industryText: normalized.industryText,
    city: normalized.city
  });
  fillBuilderForm(form, {
    cvr: normalized.cvr,
    businessName: normalized.companyName,
    industryCode: normalized.industryCode,
    industryText: normalized.industryText,
    industry: normalized.industryText,
    address: normalized.address,
    postalCode: normalized.postalCode,
    city: normalized.city,
    country: "Danmark",
    addressSource: normalized.address ? "cvr" : "manual",
    phone: normalized.phone,
    email: normalized.email,
    website: normalized.website,
    domain,
    primaryKeywords: keywords
  }, { preserveUserEdited: true });
}

function applyAddressToForm(form, address) {
  fillBuilderForm(form, {
    address: address.street,
    postalCode: address.postalCode,
    city: address.city,
    country: address.country || "Danmark",
    lat: address.lat,
    lng: address.lng,
    addressSource: "dawa"
  }, { overwriteDomain: false });
}

function updateBuilderPreview(main, message = "") {
  const form = main.querySelector("[data-seo-builder-form]");
  const preview = main.querySelector("[data-seo-builder-preview]");
  if (!form || !preview) return;
  const draft = normalizeSeoBuilderDraft({ ...DEFAULT_DRAFT, ...getDraftFromForm(form) });
  const domain = buildSeoSiteDomain({
    domain: draft.domain,
    subdomain: draft.domain || draft.businessName,
    businessName: draft.businessName
  });
  preview.innerHTML = `${message ? `<span class="seo-badge">${escapeHtml(message)}</span>` : ""}${renderBuilderPreview({ draft, domain })}`;
}

function renderBuilderPreview(state) {
  const draft = normalizeSeoBuilderDraft(state.draft);
  const domain = state.domain || buildSeoSiteDomain({
    domain: draft.domain,
    subdomain: draft.domain || draft.businessName,
    businessName: draft.businessName
  });
  const seo = buildBuilderSeo(draft, domain);
  return `
    <h2>Preview</h2>
    <p class="seo-preview-url">https://${escapeHtml(domain)}/</p>
    <div>
      <strong>Title</strong>
      <p>${escapeHtml(seo.title)}</p>
    </div>
    <div>
      <strong>Meta description</strong>
      <p>${escapeHtml(seo.metaDescription)}</p>
    </div>
    <div>
      <strong>Collections</strong>
      <p>${[COLLECTIONS.clients, COLLECTIONS.sites, COLLECTIONS.pages].map(escapeHtml).join(", ")}</p>
    </div>
    <div>
      <strong>Lokale søgeord</strong>
      <p>${escapeHtml(seo.primaryKeywords.join(", ") || `${draft.industry} ${draft.city}`.trim())}</p>
    </div>
  `;
}

function syncGeneratorLink(main, draftId = localStorage.getItem("seoAutomatikDraftId") || "") {
  const form = main.querySelector("[data-seo-builder-form]");
  const link = main.querySelector("[data-generator-link]");
  if (!form || !link) return;
  const draft = normalizeSeoBuilderDraft(getDraftFromForm(form));
  const params = new URLSearchParams();
  if (draftId) params.set("draftId", draftId);
  if (draft.domain || draft.subdomain) params.set("subdomain", draft.subdomain || normalizeDomainInput(draft.domain));
  link.href = `/modules/seo/generator.html${params.toString() ? `?${params}` : ""}`;
}

function renderPages(main, state) {
  main.innerHTML = `
    ${renderPageHead("Planlagte SEO sider", "Siderne er struktureret til lokal søgning og kan senere sendes gennem den eksisterende ZIP publish-pipeline.")}
    <section class="seo-page-list">
      ${state.pages.map((page) => `
        <article class="seo-page-item">
          <div>
            <strong>${escapeHtml(page.type)} · ${escapeHtml(page.title)}</strong>
            <span>${escapeHtml(page.intent)}</span>
          </div>
          <div>
            <span class="seo-badge">${escapeHtml(page.status)}</span>
            <span class="seo-badge blue">${escapeHtml(page.slug)}</span>
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

function renderReports(main) {
  const rows = [
    ["Sider publiceret", "0", "seo_reports"],
    ["CTA klik", "Afventer tracking", "seo_events"],
    ["Besøg", "Afventer analytics", "seo_reports"],
    ["Søgeord", "Planlagt", "seo_keywords"],
    ["Sitemap", "Klar til validering", "sitemap.xml"],
    ["Robots", "Klar til validering", "robots.txt"],
    ["Schema", "Planlagt", "seo_entities"]
  ];

  main.innerHTML = `
    ${renderPageHead("SEO rapporter", "Placeholder til performance, teknisk status og publiceringsrapportering.")}
    <div class="seo-table-wrap">
      <table class="seo-table">
        <thead>
          <tr>
            <th>Målepunkt</th>
            <th>Status</th>
            <th>Kilde</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(([label, status, source]) => `
            <tr>
              <td><strong>${escapeHtml(label)}</strong></td>
              <td>${escapeHtml(status)}</td>
              <td><span class="seo-badge yellow">${escapeHtml(source)}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSearchConsole(main, state) {
  const searchConsole = state.searchConsole || SEARCH_CONSOLE_MOCK;
  main.innerHTML = `
    ${renderPageHead("Search Console Center", "Tilslut Google Search Console, hold styr på sitemap og forbered rapportering for SEO Automatik-kunder.")}
    <section class="seo-grid three">
      ${renderStatusCard("Tilslutningsstatus", searchConsole.connection.status, `Mulige statusser: Ikke tilsluttet, Tilsluttet, Afventer · ${searchConsole.connection.domain}`)}
      ${renderStatusCard("Sitemap", searchConsole.sitemap.status, searchConsole.sitemap.url)}
      ${renderStatusCard("Data-adapter", "Forberedt", "search_console_connections, search_console_reports, search_console_sitemaps")}
    </section>

    <section class="seo-grid two" style="margin-top:16px;">
      <article class="seo-card">
        <h2>Setup-guide</h2>
        <div class="seo-page-list">
          ${searchConsole.setupSteps.map((step, index) => `
            <article class="seo-page-item">
              <div>
                <strong>Trin ${index + 1}: ${escapeHtml(step.title)}</strong>
                <span>${escapeHtml(step.text)}</span>
              </div>
              <span class="seo-badge ${step.status === "Afventer" ? "yellow" : ""}">${escapeHtml(step.status)}</span>
            </article>
          `).join("")}
        </div>
      </article>

      <article class="seo-card">
        <h2>Fremtidige rapporter</h2>
        <div class="seo-signal-list">
          ${searchConsole.metrics.map((metric) => `
            <div class="seo-signal-row">
              <span>${escapeHtml(metric.label)}</span>
              <strong>${escapeHtml(metric.value)}</strong>
            </div>
          `).join("")}
        </div>
      </article>
    </section>
  `;
}

function renderOperations(main, state) {
  const ops = state.operations || OPERATIONS_MOCK;
  main.innerHTML = `
    ${renderPageHead("SEO Operations Center", "Platform health, kendte problemer, trending signals og AI alerts, så SEO Automatik kan styres via mønstre fremfor enkeltsager.")}
    <section class="seo-grid two" style="margin-bottom:16px;">
      <article class="seo-card">
        <h2>Aktuelt platform-signal</h2>
        <span class="seo-stat">27</span>
        <p>kunder er påvirket af Search Console DNS-verificering. Vi arbejder på løsningen.</p>
      </article>
      <article class="seo-card">
        <h2>Data-adapter v1</h2>
        <p>Frontend bruger mock-signaldata nu. Firestore collections er forberedt til <code>known_issues</code>, <code>ops_signals</code>, <code>ai_alerts</code> og <code>knowledge_gaps</code>.</p>
      </article>
    </section>

    <section class="seo-card" style="margin-bottom:16px;">
      <h2>Platform Health</h2>
      <div class="seo-health-list">
        ${ops.health.map((item) => `
          <article class="seo-health-item ${escapeHtml(item.tone)}">
            <span class="seo-health-dot" aria-hidden="true"></span>
            <div>
              <strong>${escapeHtml(item.label)}</strong>
              <span>${escapeHtml(item.status)}</span>
              <p>${escapeHtml(item.detail)}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="seo-grid two" style="margin-bottom:16px;">
      <article class="seo-card">
        <h2>Kendte problemer</h2>
        <div class="seo-issue-list">
          ${ops.knownIssues.map((issue) => `
            <article class="seo-issue">
              <div>
                <strong>${escapeHtml(issue.title)}</strong>
                <p>Status: ${escapeHtml(issue.status)}</p>
                <p>Midlertidig løsning: ${escapeHtml(issue.workaround)}</p>
              </div>
              <div class="seo-issue-meta">
                <span class="seo-badge ${issue.priority === "Høj" ? "yellow" : "blue"}">${escapeHtml(issue.priority)}</span>
                <span>${escapeHtml(issue.affectedCustomers)} kunder</span>
              </div>
            </article>
          `).join("")}
        </div>
      </article>

      <article class="seo-card" id="search-console">
        <h2>Trending signals</h2>
        <div class="seo-signal-list">
          ${ops.signals.map((signal) => `
            <div class="seo-signal-row">
              <span>${escapeHtml(signal.label)}</span>
              <strong>${escapeHtml(signal.count)}</strong>
            </div>
          `).join("")}
        </div>
      </article>
    </section>

    <section class="seo-card">
      <h2>AI Alerts</h2>
      <div class="seo-alert-list">
        ${ops.aiAlerts.map((alert) => `
          <article class="seo-alert">
            <span class="seo-badge blue">AI</span>
            <div>
              <strong>${escapeHtml(alert.title)}</strong>
              <p>${escapeHtml(alert.text)}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

async function bootSeoModule() {
  try {
    const pageKey = getPageKey();
    setupHead(pageKey);
    renderShell(pageKey);
    const main = document.querySelector("[data-seo-main]");
    if (!main) return;
    const platformContext = await resolvePlatformContext({ sourceApp: "seo" }).catch((error) => {
      console.warn("[seo-module] platform context fallback", error);
      return { source: "missing" };
    });
    const state = getMockState(platformContext);
    const renderers = {
      index: renderIndex,
      dashboard: renderDashboard,
      clients: renderClients,
      "site-builder": renderSiteBuilder,
      pages: renderPages,
      "search-console": renderSearchConsole,
      reports: renderReports,
      operations: renderOperations
    };
    const renderer = renderers[pageKey] || renderIndex;
    renderer(main, state);
  } catch (error) {
    console.error("[seo-module] boot failed", error);
    const shell = document.querySelector("[data-seo-shell]");
    if (shell) {
      shell.innerHTML = `
        <main class="seo-main">
          <section class="seo-card">
            <h1>SEO Automatik</h1>
            <p>Siden kunne ikke indlæses korrekt. Prøv at genindlæse siden.</p>
            <p class="seo-muted">${escapeHtml(error?.message || "Ukendt fejl")}</p>
            <a class="seo-btn primary" href="/modules/seo/dashboard.html">Åbn dashboard</a>
          </section>
        </main>
      `;
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSeoModule, { once: true });
} else {
  bootSeoModule();
}
