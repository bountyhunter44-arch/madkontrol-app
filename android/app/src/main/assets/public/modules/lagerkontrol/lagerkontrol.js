import firebaseApp, { auth, db, storage } from "/core/firebase-config.js";
import { createAuditCreateFields, createAuditUpdateFields } from "/core/auditFields.js";
import { normalizeInventoryQuantity } from "/core/inventory-quantity.js";
import { resolvePlatformContext } from "/platform/context-provider.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getDownloadURL,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const appEl = document.getElementById("lagerApp");
const view = document.body?.dataset?.lagerView || "index";
const functions = getFunctions(firebaseApp, "us-central1");
const processSupplierDocument = httpsCallable(functions, "lagerProcessSupplierDocument");
const XLSX_MODULE_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm";

const CATEGORIES = [
  ["colonial", "Kolonial"],
  ["cold", "Køl"],
  ["frozen", "Frost"],
  ["bar", "Bar/alkohol"],
  ["cleaning", "Rengøringsmidler"],
  ["packaging", "Emballage"],
  ["consumables", "Forbrugsvarer"]
];

const UNITS = ["stk", "mg", "g", "kg", "ton", "ml", "cl", "dl", "l", "flasker", "dåser", "pakker", "poser", "kasser", "bakker", "bøtter", "dunke"];
const PACKAGE_UNITS = ["stk", "flasker", "dåser", "pakker", "poser", "kasser", "bakker", "bøtter", "dunke"];
const PACKAGE_SIZE_UNITS = ["g", "kg", "ml", "cl", "dl", "l", "stk"];
const SPILLAGE_TYPES = [
  ["buffet", "Buffetspild"],
  ["production", "Produktionsspild"],
  ["return", "Returvarer"],
  ["expired", "Udløbne varer"],
  ["cleaning", "Rengøringsspild"]
];

const COLLECTIONS = {
  catalog: "global_inventory_catalog",
  supplierProfiles: "supplier_profiles",
  supplierCatalogItems: "supplier_catalog_items",
  supplierCatalogImports: "supplier_catalog_imports",
  items: "inventory_items",
  batches: "inventory_batches",
  counts: "inventory_counts",
  movements: "inventory_movements",
  spillage: "inventory_spillage",
  documents: "supplier_documents",
  receipts: "goods_receipts",
  costProfiles: "menu_cost_profiles",
  indexes: "pricing_indexes",
  reports: "inventory_reports",
  settings: "inventory_settings"
};

const DEFAULT_SUPPLIER_PROFILES = [
  ["dagrofa", "Dagrofa"],
  ["hoerkram", "Hørkram"],
  ["ab-catering", "AB Catering"],
  ["bc-catering", "BC Catering"]
].map(([supplierId, name]) => ({
  supplierId,
  name,
  supplierType: "foodservice_wholesaler",
  contactEmail: "",
  contactPhone: "",
  isActive: true,
  supportsCsv: true,
  supportsExcel: true,
  supportsEdi: false,
  supportsApi: false
}));

const SUPPLIER_IMPORT_FIELDS = [
  ["supplierItemNumber", "Varenummer", true],
  ["ean", "EAN", false],
  ["gtin", "GTIN", false],
  ["sku", "SKU", false],
  ["name", "Produktnavn", true],
  ["brand", "Brand", false],
  ["category", "Kategori", false],
  ["unit", "Enhed", false],
  ["packSize", "Pakningsstørrelse", false],
  ["caseSize", "Kassestørrelse", false],
  ["vatRate", "Moms %", false],
  ["currentPurchasePrice", "Pris", false],
  ["currency", "Valuta", false],
  ["availability", "Tilgængelighed", false]
];

const SUPPLIER_IMPORT_ALIASES = {
  supplierItemNumber: ["varenummer", "vare nr", "vare-nr", "item number", "item no", "product id", "produktnummer", "nummer"],
  ean: ["ean", "ean13", "stregkode", "barcode"],
  gtin: ["gtin"],
  sku: ["sku"],
  name: ["produktnavn", "produkt", "varenavn", "vare", "navn", "description", "beskrivelse"],
  brand: ["brand", "mærke", "maerke", "producent"],
  category: ["kategori", "gruppe", "varegruppe", "category"],
  unit: ["enhed", "unit"],
  packSize: ["pakning", "pakningsstørrelse", "pakningsstoerrelse", "pack size", "packsize"],
  caseSize: ["kasse", "kassestørrelse", "kassestoerrelse", "case size", "casesize"],
  vatRate: ["moms", "vat", "vat rate", "momssats"],
  currentPurchasePrice: ["pris", "indkøbspris", "indkoebspris", "purchase price", "nettopris", "price"],
  currency: ["valuta", "currency"],
  availability: ["lagerstatus", "tilgængelighed", "tilgaengelighed", "availability"]
};

const state = {
  user: null,
  profile: null,
  companyId: "",
  locationId: "",
  catalogItems: [],
  supplierProfiles: [],
  supplierImports: [],
  supplierImportDraft: createEmptySupplierImportDraft(),
  items: [],
  batches: [],
  counts: [],
  movements: [],
  spillage: [],
  documents: [],
  receipts: [],
  reports: [],
  indexes: {
    rawMaterialIndex: 100,
    energyIndex: 100,
    transportIndex: 100,
    fuelIndex: 100,
    laborIndex: 100
  }
};

enforceStandaloneLagerShell();
initLagerkontrolAuth();

function enforceStandaloneLagerShell() {
  document.documentElement.classList.add("lagerkontrol-standalone");
  document.body?.classList.add("lagerkontrol-standalone");

  [
    ...["header", "sidebar"].map((part) => `${part}Mount`),
    "appHeader",
    "appSidebar",
    "layoutHeader",
    "layoutSidebar"
  ].forEach((id) => document.getElementById(id)?.remove());

  document.querySelectorAll(
    ".app-sidebar,.mk-sidebar,.main-sidebar,.layout-sidebar,.global-sidebar,.topbar,.company-bar,.location-bar"
  ).forEach((el) => el.remove());
}

function initLagerkontrolAuth() {
  renderShell(`<div class="lager-empty">Indlæser Lagerkontrol Pro...</div>`);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      state.user = null;
      state.profile = null;
      state.companyId = "";
      state.locationId = "";
      renderShell(`
        <div class="lager-empty">
          <h2>Log ind for at bruge Lagerkontrol Pro</h2>
          <p>Du skal være logget ind for at hente lagerdata.</p>
          <a class="lager-btn primary" href="${escapeHtml(buildLagerLoginUrl())}">Log ind</a>
        </div>
      `);
      return;
    }

    state.user = user;
    state.profile = await loadLagerProfile(user);
    const platformContext = await resolvePlatformContext({ uid: user.uid, sourceApp: "lagerkontrol" }).catch((error) => {
      console.warn("[lagerkontrol] platform context fallback", error);
      return {};
    });
    state.profile = { ...state.profile, ...platformContext };
    state.companyId = getCompanyId(state.profile);
    state.locationId = getLocationId(state.profile);

    if (!state.companyId || !state.locationId) {
      renderShell(`
        <div class="lager-empty">
          <h2>Virksomhedsoplysninger mangler</h2>
          <p>Vælg eller opret virksomhed og lokation via quick-onboarding for at bruge Lagerkontrol Pro.</p>
        </div>
      `);      return;
    }

    await loadData();
    render();
  });
}

async function loadLagerProfile(user) {
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) return snap.data() || {};
  } catch (error) {
    console.warn("[lagerkontrol] profile read failed", error);
  }
  return {
    uid: user.uid,
    email: user.email || "",
    companyId: sessionStorage.getItem("mkp_user_companyId") || "",
    primaryLocationId: sessionStorage.getItem("mkp_selected_locationId") || "",
    role: "employee"
  };
}

function buildLagerLoginUrl() {
  const returnTo = `${window.location.pathname}${window.location.search || ""}${window.location.hash || ""}`;
  const url = new URL("/", window.location.origin);
  url.searchParams.set("login", "1");
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    url.searchParams.set("returnTo", returnTo);
  }
  return `${url.pathname}${url.search}`;
}

function getCompanyId(profile = {}) {
  return String(profile.companyId || profile.organizationId || sessionStorage.getItem("mkp_user_companyId") || "").trim();
}

function getLocationId(profile = {}) {
  const locationIds = Array.isArray(profile.locationIds) ? profile.locationIds : [];
  return String(
    sessionStorage.getItem("mkp_selected_locationId") ||
    profile.primaryLocationId ||
    profile.locationId ||
    locationIds[0] ||
    ""
  ).trim();
}

function companyCollection(name) {
  return collection(db, "companies", state.companyId, name);
}

function companyDoc(name, id) {
  return doc(db, "companies", state.companyId, name, id);
}

function rootCollection(name) {
  return collection(db, name);
}

function rootDoc(name, id) {
  return doc(db, name, id);
}

function catalogCollection() {
  return collection(db, COLLECTIONS.catalog);
}

function baseFields() {
  return {
    companyId: state.companyId,
    locationId: state.locationId,
    createdBy: state.user?.uid || "",
    ...createAuditCreateFields(state.user, state.profile)
  };
}

function updateFields() {
  return {
    updatedAt: serverTimestamp(),
    updatedBy: state.user?.uid || "",
    ...createAuditUpdateFields(state.user, state.profile)
  };
}

async function loadData() {
  const shouldLoadCatalog = view === "varebibliotek";
  const shouldLoadSupplierImport = view === "supplier-import";
  const [catalogItems, supplierProfiles, supplierImports, items, batches, counts, movements, spillage, documents, receipts, reports, indexes] = await Promise.all([
    shouldLoadCatalog ? readCatalog(500) : Promise.resolve(state.catalogItems),
    shouldLoadSupplierImport ? readSupplierProfiles() : Promise.resolve(state.supplierProfiles),
    shouldLoadSupplierImport ? readSupplierImports(25) : Promise.resolve(state.supplierImports),
    readScoped(COLLECTIONS.items, 250),
    readScoped(COLLECTIONS.batches, 250),
    readScoped(COLLECTIONS.counts, 100),
    readScoped(COLLECTIONS.movements, 200),
    readScoped(COLLECTIONS.spillage, 100),
    readScoped(COLLECTIONS.documents, 100),
    readScoped(COLLECTIONS.receipts, 100),
    readScoped(COLLECTIONS.reports, 40),
    readScoped(COLLECTIONS.indexes, 10)
  ]);

  state.catalogItems = catalogItems;
  state.supplierProfiles = supplierProfiles;
  state.supplierImports = supplierImports;
  state.items = items;
  state.batches = batches;
  state.counts = counts;
  state.movements = movements;
  state.spillage = spillage;
  state.documents = documents;
  state.receipts = receipts;
  state.reports = reports;
  state.indexes = { ...state.indexes, ...(indexes[0] || {}) };
}

async function readSupplierProfiles() {
  try {
    const q = query(rootCollection(COLLECTIONS.supplierProfiles), orderBy("name"), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((row) => ({ id: row.id, ...row.data() }));
  } catch (error) {
    console.warn("[lagerkontrol] supplier_profiles read failed", error);
    return [];
  }
}

async function readSupplierImports(maxRows = 25) {
  try {
    const q = query(rootCollection(COLLECTIONS.supplierCatalogImports), limit(maxRows));
    const snap = await getDocs(q);
    return snap.docs
      .map((row) => ({ id: row.id, ...row.data() }))
      .sort((a, b) => getTimeValue(b.startedAt || b.createdAt) - getTimeValue(a.startedAt || a.createdAt));
  } catch (error) {
    console.warn("[lagerkontrol] supplier_catalog_imports read failed", error);
    return [];
  }
}

async function readCatalog(maxRows = 250) {
  try {
    const q = query(
      catalogCollection(),
      orderBy("name"),
      limit(maxRows)
    );
    const snap = await getDocs(q);
    return snap.docs.map((row) => ({ id: row.id, ...row.data() }));
  } catch (error) {
    console.warn("[lagerkontrol] global_inventory_catalog read failed", error);
    return [];
  }
}

async function readScoped(name, maxRows = 100) {
  try {
    const q = query(
      companyCollection(name),
      where("locationId", "==", state.locationId),
      limit(maxRows)
    );
    const snap = await getDocs(q);
    return snap.docs.map((row) => ({ id: row.id, ...row.data() }));
  } catch (error) {
    console.warn(`[lagerkontrol] ${name} read failed`, error);
    return [];
  }
}

function render() {
  const body = {
    index: renderDashboard,
    dashboard: renderDashboard,
    varer: renderItems,
    varebibliotek: renderCatalog,
    "supplier-import": renderSupplierImport,
    bilag: renderDocuments,
    optaelling: renderCounting,
    varemodtagelse: renderReceiving,
    svind: renderSpillage,
    rapporter: renderReports,
    settings: renderSettings
  }[view]?.() || renderDashboard();
  renderShell(body);
  bindCommon();
  bindView();
}

function renderShell(content) {
  appEl.innerHTML = `
    <div class="lager-shell">
      <header class="lager-header">
        <a class="lager-brand" href="./dashboard.html" aria-label="Lagerkontrol Pro dashboard">
          <span>Lagerkontrol Pro</span>
        </a>
        <nav class="lager-nav" aria-label="Lagerkontrol navigation">
          ${navLink("dashboard.html", "Dashboard", ["index", "dashboard"])}
          ${navLink("varer.html", "Varer", ["varer"])}
          ${navLink("varebibliotek.html", "Varebibliotek", ["varebibliotek"])}
          ${navLink("supplier-import.html", "Grossistkatalog", ["supplier-import"])}
          ${navLink("bilag.html", "Bilag", ["bilag"])}
          ${navLink("optaelling.html", "Optælling", ["optaelling"])}
          ${navLink("varemodtagelse.html", "Varemodtagelse", ["varemodtagelse"])}
          ${navLink("svind.html", "Svind", ["svind"])}
          ${navLink("rapporter.html", "Rapporter", ["rapporter"])}
          ${navLink("settings.html", "Indstillinger", ["settings"])}
        </nav>
      </header>
      <section class="lager-hero">
        <div>
          <div class="lager-eyebrow">Selvstaendigt lagerdomaene</div>
          <h1>${escapeHtml(getViewTitle())}</h1>
          <p>${escapeHtml(getViewIntro())}</p>
        </div>
      </section>
      ${content}
    </div>
  `;
}

function navLink(href, label, activeViews) {
  return `<a class="${activeViews.includes(view) ? "active" : ""}" href="./${href}">${escapeHtml(label)}</a>`;
}

function getViewTitle() {
  return {
    index: "Lagerkontrol Pro",
    dashboard: "Dashboard",
    varer: "Varer",
    varebibliotek: "Varebibliotek",
    "supplier-import": "Grossistkatalog Import",
    bilag: "Bilag",
    optaelling: "Optælling",
    varemodtagelse: "Varemodtagelse",
    svind: "Svind",
    rapporter: "Rapporter",
    settings: "Indstillinger"
  }[view] || "Lagerkontrol Pro";
}

function getViewIntro() {
  if (view === "supplier-import") {
    return "Importer CSV og Excel fra grossister til supplier_catalog_items uden at blande dem med virksomhedens lager.";
  }
  return {
    index: "Registrér én gang, og genbrug lagerdata i drift, HACCP, økonomi og rapporter.",
    dashboard: "Overblik over avance, vareforbrug, svind og kritiske lagerdifferencer.",
    varer: "Opret råvarer, flasker, emballage og forbrugsvarer med kategori, enhed og par-niveau.",
    varebibliotek: "Vælg standardvarer fra det globale varebibliotek, og kopier dem ind i dit eget lager.",
    bilag: "Upload leverandørbilag til bogføring eller gem dokumentation kun til appen.",
    optaelling: "Periodebaseret optælling: startlager + køb - slutlager - spild = reelt vareforbrug.",
    varemodtagelse: "Tag billede, scan dokumentation og opdater lageret uden ukendt-produkt dead ends.",
    svind: "Registrér buffetspild, produktionsspild, returvarer, udløb og rengøringsspild.",
    rapporter: "Se revisionsspor, periodeforbrug, spildværdi og rapportgrundlag.",
    settings: "Prisindex, kalkulationsnøgler og AI-ready driftsparametre."
  }[view] || "";
}

function renderDashboard() {
  const kpi = calculateKpis();
  return `
    <section class="lager-grid">
      ${kpiCard("Dagens avance", kr(kpi.estimatedMarginToday), "Estimeret fra varemodtagelse og svind")}
      ${kpiCard("Månedsavance", kr(kpi.estimatedMarginMonth), "AI-ready beregning baseret på periodedata")}
      ${kpiCard("Vareforbrug", kr(kpi.periodConsumptionValue), "Start + køb - slut - spild")}
      ${kpiCard("Madspild", kr(kpi.spillageValue), `${kpi.spillageCount} registreringer`)}
      ${kpiCard("Lav lagerbeholdning", kpi.lowStockCount, "Under par-niveau")}
      ${kpiCard("Kritiske differencer", kpi.criticalDiffs, "Optællinger med høj afvigelse")}
      ${kpiCard("Dækningsgrad", `${kpi.coverageRate}%`, "Baseret på kalkulationsstandard")}
      ${kpiCard("Lønprocent", `${kpi.laborPercent}%`, "Settings / index")}
    </section>
    <section class="lager-two">
      <article class="lager-card">
        <h2>Hurtige handlinger</h2>
        <p>Bygget til travle køkkener: store knapper, få felter og tydeligt flow.</p>
        <div class="lager-actions">
          <a class="lager-btn primary" href="./varemodtagelse.html">Ny varemodtagelse</a>
          <a class="lager-btn" href="./optaelling.html">Start optælling</a>
          <a class="lager-btn" href="./svind.html">Registrér svind</a>
        </div>
      </article>
      <article class="lager-card">
        <h2>Lav lagerbeholdning</h2>
        ${renderItemList(state.items.filter((item) => number(item.currentQuantity) <= number(item.parLevel)).slice(0, 6))}
      </article>
    </section>
    <section class="lager-card">
      <h2>Mest rentable retter</h2>
      <p>Menu-engine v1 beregner anbefalet salgspris ud fra kostpris, spild, løn, energi, emballage, husleje og ønsket avance.</p>
      ${renderMenuCalculator()}
    </section>
  `;
}

function renderItems() {
  return `
    <section class="lager-two">
      <article class="lager-panel">
        <h2>Ny vare</h2>
        <form id="itemForm" class="lager-form" data-inventory-normalize>
          <label>Produktnavn<input name="name" required placeholder="Fx mozzarella, rødvin, servietter"></label>
          <div class="lager-form-row">
            <label>Kategori<select name="category">${options(CATEGORIES)}</select></label>
            <label>Antal<input name="quantity" type="number" step="0.01" value="1"></label>
          </div>
          <div class="lager-form-row">
            <label>Pakkeenhed<select name="packageUnit">${PACKAGE_UNITS.map((u) => `<option>${u}</option>`).join("")}</select></label>
            <label>Stk pr. pakke/kasse<input name="unitsPerPackage" type="number" step="1" min="1" value="1"></label>
          </div>
          <div class="lager-form-row">
            <label>Størrelse pr. enhed<input name="packageSize" type="number" step="0.01" value="0"></label>
            <label>Størrelsesenhed<select name="packageSizeUnit">${PACKAGE_SIZE_UNITS.map((u) => `<option>${u}</option>`).join("")}</select></label>
          </div>
          <div class="lager-total-preview" data-normalized-preview>Samlet: 1 stk</div>
          <div class="lager-form-row">
            <label>Indkøbspris<input name="purchasePrice" type="number" step="0.01" value="0"></label>
            <label>Leverandør<input name="supplier" placeholder="Valgfrit"></label>
          </div>
          <div class="lager-form-row">
            <label>Par-niveau i basisenhed<input name="parLevel" type="number" step="0.01" value="0"></label>
            <label>Basisenhed<input name="baseUnitPreview" readonly placeholder="Beregnes automatisk"></label>
          </div>
          <div class="lager-form-row">
            <label>Flaskestørrelse cl<input name="bottleSizeCl" type="number" step="1" value="70"></label>
            <label>Restindhold cl<input name="currentCl" type="number" step="1" value="0"></label>
          </div>
          <button class="lager-btn primary" type="submit">Gem vare</button>
        </form>
      </article>
      <article class="lager-panel">
        <h2>Varer</h2>
        ${renderItemList(state.items)}
      </article>
    </section>
  `;
}

function renderCatalog() {
  const catalogItems = getFilteredCatalogItems();
  return `
    <section class="lager-panel">
      <div class="lager-section-head">
        <div>
          <h2>Globalt varebibliotek</h2>
          <p>Find standardvarer og kopier dem ind i dit eget lager. Priser, leverandør og beholdning sættes lokalt bagefter.</p>
        </div>
        <button class="lager-btn" type="button" data-refresh>Opdater</button>
      </div>
      <div class="lager-catalog-toolbar">
        <label>Søg
          <input id="catalogSearch" type="search" placeholder="Søg efter vare, kategori eller allergen">
        </label>
        <label>Kategori
          <select id="catalogCategoryFilter">
            <option value="">Alle kategorier</option>
            ${uniqueCatalogValues("category").map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(catalogCategoryLabel(category))}</option>`).join("")}
          </select>
        </label>
        <label>Enhed
          <select id="catalogUnitFilter">
            <option value="">Alle enheder</option>
            ${uniqueCatalogValues("unit").map((unit) => `<option value="${escapeHtml(unit)}">${escapeHtml(unit)}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="lager-catalog-summary">
        <span>${state.catalogItems.length} varer i biblioteket</span>
        <span>${state.items.filter((item) => item.catalogItemId).length} tilføjet fra biblioteket</span>
      </div>
      <div id="catalogList">
        ${renderCatalogList(catalogItems)}
      </div>
    </section>
  `;
}

function renderCatalogList(items) {
  if (!state.catalogItems.length) {
    return `<div class="lager-empty">Varebiblioteket er tomt eller kan ikke læses endnu.</div>`;
  }
  if (!items.length) {
    return `<div class="lager-empty">Ingen varer matcher filtrene.</div>`;
  }
  return `
    <div class="lager-catalog-grid">
      ${items.map((item) => {
        const alreadyAdded = isCatalogItemAdded(item.id);
        const allergens = Array.isArray(item.allergens) ? item.allergens.filter(Boolean) : [];
        return `
          <article class="lager-catalog-card">
            <div>
              <div class="lager-row-title">${escapeHtml(item.name || "Vare")}</div>
              <div class="lager-row-meta">
                <span class="lager-chip">${escapeHtml(catalogCategoryLabel(item.category))}</span>
                <span class="lager-chip">${escapeHtml(item.unit || item.baseUnit || "stk")}</span>
                ${item.defaultVatRate !== undefined ? `<span class="lager-chip">Moms ${escapeHtml(item.defaultVatRate)}%</span>` : ""}
                ${alreadyAdded ? `<span class="lager-chip">Allerede tilføjet</span>` : ""}
              </div>
              <div class="lager-catalog-meta">
                ${item.haccpCategory ? `<span>HACCP: ${escapeHtml(item.haccpCategory)}</span>` : ""}
                ${item.accountingCategory ? `<span>Bogføring: ${escapeHtml(item.accountingCategory)}</span>` : ""}
                ${allergens.length ? `<span>Allergener: ${escapeHtml(allergens.join(", "))}</span>` : ""}
              </div>
            </div>
            <button
              class="lager-btn ${alreadyAdded ? "" : "primary"}"
              type="button"
              data-catalog-add="${escapeHtml(item.id)}"
              ${alreadyAdded ? "disabled" : ""}
            >${alreadyAdded ? "Tilføjet" : "Tilføj til mit lager"}</button>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderSupplierImport() {
  const draft = state.supplierImportDraft;
  const suppliers = getSupplierProfilesForSelect();
  const selectedSupplierId = draft.supplierId || suppliers[0]?.supplierId || "";
  draft.supplierId = selectedSupplierId;
  const selectedSupplier = getSupplierProfile(selectedSupplierId);

  return `
    <section class="lager-two supplier-import-layout">
      <article class="lager-panel">
        <div class="lager-section-head">
          <div>
            <h2>1. Vælg grossist</h2>
            <p>Importen gemmes kun i supplier_catalog_items. Varerne kopieres ikke til virksomhedens lager endnu.</p>
          </div>
        </div>
        <form id="supplierImportForm" class="lager-form">
          <label>Grossist
            <select name="supplierId" id="supplierImportSupplier">
              ${suppliers.map((supplier) => `
                <option value="${escapeHtml(supplier.supplierId)}" ${supplier.supplierId === selectedSupplierId ? "selected" : ""}>
                  ${escapeHtml(supplier.name)}
                </option>
              `).join("")}
            </select>
          </label>
          <div class="lager-form-row">
            <label>Kontakt e-mail<input name="contactEmail" value="${escapeHtml(selectedSupplier?.contactEmail || "")}" placeholder="Valgfrit"></label>
            <label>Kontakt telefon<input name="contactPhone" value="${escapeHtml(selectedSupplier?.contactPhone || "")}" placeholder="Valgfrit"></label>
          </div>
          <div class="lager-row-meta">
            <span class="lager-chip">CSV</span>
            <span class="lager-chip">Excel</span>
            <span class="lager-chip">EDI-ready</span>
            <span class="lager-chip">API-ready</span>
          </div>
          <hr class="lager-divider">
          <h2>2. Upload fil</h2>
          <label>CSV eller Excel
            <input id="supplierImportFile" name="supplierFile" type="file" accept=".csv,text/csv,.tsv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel">
          </label>
          <div class="lager-import-note">
            ${draft.sourceFileName ? `
              <strong>${escapeHtml(draft.sourceFileName)}</strong>
              <span>${escapeHtml(draft.sourceFileType.toUpperCase())} · ${draft.rows.length} rækker læst</span>
            ` : "Vælg en fil for at se preview og kolonnemapping."}
          </div>
        </form>
      </article>

      <article class="lager-panel">
        <h2>6. Import status</h2>
        ${renderSupplierImportStatus(draft)}
        <h3>Seneste imports</h3>
        ${renderSupplierImportHistory()}
      </article>
    </section>

    <section class="lager-panel">
      <div class="lager-section-head">
        <div>
          <h2>3. Preview af første 20 rækker</h2>
          <p>Kontrollér at kolonnerne bliver læst korrekt, før mapping og import.</p>
        </div>
      </div>
      ${renderSupplierImportPreview(draft)}
    </section>

    <section class="lager-two supplier-import-layout">
      <article class="lager-panel">
        <h2>4. Kolonne mapping</h2>
        ${renderSupplierImportMapping(draft)}
      </article>
      <article class="lager-panel">
        <h2>5. Importér varer</h2>
        <p>Normalized key dannes ud fra varenummer, ellers EAN/GTIN/SKU, ellers produktnavn. Samme key opdaterer samme grossistvare ved næste import.</p>
        <button
          id="supplierImportButton"
          class="lager-btn primary"
          type="button"
          ${draft.rows.length ? "" : "disabled"}
        >Importér varer</button>
        <div class="lager-import-guard">
          <strong>Adskilt source-of-truth</strong>
          <span>Der skrives ikke til global_inventory_catalog eller companies/${escapeHtml(state.companyId)}/inventory_items.</span>
        </div>
      </article>
    </section>
  `;
}

function renderSupplierImportStatus(draft) {
  return `
    <div class="lager-grid compact supplier-import-status">
      ${kpiCard("Læst", draft.status.rowsRead, "Rækker i filen")}
      ${kpiCard("Importeret", draft.status.rowsImported, "Nye varer")}
      ${kpiCard("Opdateret", draft.status.rowsUpdated, "Eksisterende varer")}
      ${kpiCard("Fejlet", draft.status.rowsFailed, "Sprunget over")}
    </div>
    <div class="lager-import-note ${draft.status.messageType || ""}">
      ${escapeHtml(draft.status.message || "Klar til import.")}
    </div>
  `;
}

function renderSupplierImportHistory() {
  if (!state.supplierImports.length) {
    return `<div class="lager-empty">Ingen imports registreret endnu.</div>`;
  }
  return `<div class="lager-list">${state.supplierImports.slice(0, 8).map((row) => `
    <div class="lager-row">
      <div>
        <div class="lager-row-title">${escapeHtml(row.sourceFileName || "Import")}</div>
        <div class="lager-row-meta">
          <span class="lager-chip">${escapeHtml(row.supplierName || row.supplierId || "Grossist")}</span>
          <span class="lager-chip">${escapeHtml(row.status || "ukendt")}</span>
          <span class="lager-chip">Læst ${escapeHtml(row.rowsRead || 0)}</span>
          <span class="lager-chip">Importeret ${escapeHtml(row.rowsImported || 0)}</span>
          <span class="lager-chip">Opdateret ${escapeHtml(row.rowsUpdated || 0)}</span>
          <span class="lager-chip ${number(row.rowsFailed) ? "bad" : ""}">Fejlet ${escapeHtml(row.rowsFailed || 0)}</span>
        </div>
      </div>
    </div>
  `).join("")}</div>`;
}

function renderSupplierImportPreview(draft) {
  if (!draft.rows.length || !draft.headers.length) {
    return `<div class="lager-empty">Upload en CSV- eller Excel-fil for at se de første 20 rækker.</div>`;
  }
  const previewRows = draft.rows.slice(0, 20);
  return `
    <div class="lager-table-wrap">
      <table class="lager-table supplier-preview-table">
        <thead><tr>${draft.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>
          ${previewRows.map((row) => `
            <tr>${draft.headers.map((header) => `<td>${escapeHtml(row[header] || "")}</td>`).join("")}</tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSupplierImportMapping(draft) {
  if (!draft.headers.length) {
    return `<div class="lager-empty">Upload en fil før kolonner kan mappes.</div>`;
  }
  return `
    <div class="supplier-mapping-grid">
      ${SUPPLIER_IMPORT_FIELDS.map(([field, label, required]) => `
        <label>${escapeHtml(label)}${required ? " *" : ""}
          <select data-supplier-map="${escapeHtml(field)}">
            <option value="">Ignorer</option>
            ${draft.headers.map((header) => `
              <option value="${escapeHtml(header)}" ${draft.mapping[field] === header ? "selected" : ""}>${escapeHtml(header)}</option>
            `).join("")}
          </select>
        </label>
      `).join("")}
    </div>
  `;
}

function renderDocuments() {
  const needsBooking = state.documents.filter((document) => document.bookingStatus === "needs_booking");
  const booked = state.documents.filter((document) => document.bookingStatus === "booked");
  return `
    <section class="lager-two">
      <article class="lager-panel">
        <h2>Upload bilag</h2>
        <p>Vælg om bilaget skal videre til bogføring nu, eller om det kun skal gemmes i Lagerkontrol Pro.</p>
        <div class="lager-bilag-actions">
          <form class="lager-form lager-bilag-upload" data-bilag-upload="accounting">
            <h3>Upload til bogføring nu</h3>
            <p>Bruges til leverandørfakturaer og bilag, som bogfører skal kunne se.</p>
            <label>Bilag
              <input name="documentFile" type="file" accept="image/*,.pdf" capture="environment" required>
            </label>
            <button class="lager-btn primary" type="submit">Upload til bogføring nu</button>
          </form>
          <form class="lager-form lager-bilag-upload" data-bilag-upload="inventory_only">
            <h3>Upload kun til appen</h3>
            <p>Bruges til lagerdokumentation, fotos og interne bilag uden bogføringsbehov.</p>
            <label>Dokument
              <input name="documentFile" type="file" accept="image/*,.pdf" capture="environment" required>
            </label>
            <button class="lager-btn" type="submit">Upload kun til appen</button>
          </form>
        </div>
      </article>
      <article class="lager-panel">
        <h2>Bogføringsstatus</h2>
        <div class="lager-grid compact">
          ${kpiCard("Mangler bogføring", needsBooking.length, "Bilag klar til bogfører")}
          ${kpiCard("Bogført", booked.length, "Markeret som færdig")}
        </div>
      </article>
    </section>
    <section class="lager-two">
      <article class="lager-panel">
        <h2>Mangler bogføring</h2>
        ${renderAccountingDocuments(needsBooking, { allowMarkBooked: true })}
      </article>
      <article class="lager-panel">
        <h2>Bogført</h2>
        ${renderAccountingDocuments(booked, { allowMarkBooked: false })}
      </article>
    </section>
  `;
}

function renderAccountingDocuments(documents, options = {}) {
  if (!documents.length) return `<div class="lager-empty">Ingen bilag i denne visning.</div>`;
  return `<div class="lager-list">${documents.map((document) => {
    const fileUrl = document.fileUrl || document.photoUrl || document.documentUrl || "";
    const title = document.originalFileName || document.fileName || document.productName || document.supplier || "Bilag";
    return `
      <div class="lager-row">
        <div>
          <div class="lager-row-title">${escapeHtml(title)}</div>
          <div class="lager-row-meta">
            <span class="lager-chip">${escapeHtml(documentTypeLabel(document.documentType))}</span>
            <span class="lager-chip">${escapeHtml(bookingStatusLabel(document.bookingStatus))}</span>
            <span class="lager-chip">${document.accountantAccess ? "Bogfører-adgang" : "Kun appen"}</span>
            ${document.ocrStatus ? `<span class="lager-chip">OCR: ${escapeHtml(document.ocrStatus)}</span>` : ""}
            ${fileUrl ? `<a class="lager-chip" href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer">Åbn fil</a>` : ""}
          </div>
        </div>
        ${options.allowMarkBooked ? `
          <button
            class="lager-btn"
            type="button"
            data-mark-booked="${escapeHtml(document.id)}"
          >Markér som bogført</button>
        ` : ""}
      </div>
    `;
  }).join("")}</div>`;
}

function renderCounting() {
  return `
    <section class="lager-two">
      <article class="lager-panel">
        <h2>Ny optælling</h2>
        <form id="countForm" class="lager-form">
          <label>Vare<select name="itemId" required>${itemOptions()}</select></label>
          <div class="lager-form-row">
            <label>Optalt mængde<input name="countedQuantity" type="number" step="0.01" required></label>
            <label>Periode<select name="periodType"><option value="daily">Dag</option><option value="monthly">Måned</option><option value="vat_period">Momsperiode</option></select></label>
          </div>
          <label>Note<textarea name="note" placeholder="Fx månedslukning, status før service, baroptælling"></textarea></label>
          <button class="lager-btn primary" type="submit">Gem optælling</button>
        </form>
      </article>
      <article class="lager-panel">
        <h2>Seneste optællinger</h2>
        ${renderTable(state.counts.slice(0, 12), ["Vare", "Optalt", "Periode"], (row) => [
          itemName(row.itemId),
          `${formatNumber(row.countedQuantity)} ${row.unit || ""}`,
          row.periodType || "-"
        ])}
      </article>
    </section>
  `;
}

function renderReceiving() {
  return `
    <section class="lager-two">
      <article class="lager-panel">
        <h2>Ny varemodtagelse</h2>
        <form id="receiptForm" class="lager-form" data-inventory-normalize>
          <label>Produktnavn<input name="productName" required placeholder="AI/OCR forslag kan rettes her"></label>
          <div class="lager-form-row">
            <label>Leverandør<input name="supplier" placeholder="Leverandør"></label>
            <label>Eksisterende vare<select name="itemId"><option value="">Opret/foreslå ny vare</option>${itemOptions(false)}</select></label>
          </div>
          <div class="lager-form-row">
            <label>Antal<input name="quantity" type="number" step="0.01" required></label>
            <label>Pakkeenhed<select name="packageUnit">${PACKAGE_UNITS.map((u) => `<option>${u}</option>`).join("")}</select></label>
          </div>
          <div class="lager-form-row">
            <label>Stk pr. pakke/kasse<input name="unitsPerPackage" type="number" step="1" min="1" value="1"></label>
            <label>Størrelse pr. enhed<input name="packageSize" type="number" step="0.01" value="0"></label>
          </div>
          <div class="lager-form-row">
            <label>Størrelsesenhed<select name="packageSizeUnit">${PACKAGE_SIZE_UNITS.map((u) => `<option>${u}</option>`).join("")}</select></label>
            <label>Basisenhed<input name="baseUnitPreview" readonly placeholder="Beregnes automatisk"></label>
          </div>
          <div class="lager-total-preview" data-normalized-preview>Samlet: 0 stk</div>
          <div class="lager-form-row">
            <label>Pris<input name="price" type="number" step="0.01" value="0"></label>
            <label>Batch<input name="batch" placeholder="Batch/lot"></label>
          </div>
          <div class="lager-form-row">
            <label>Modtaget temperatur<input name="temperature" type="number" step="0.1" placeholder="°C"></label>
            <label>Dato<input name="receivedDate" type="date" value="${today()}"></label>
          </div>
          <label>Foto af vare<input name="productPhoto" type="file" accept="image/*" capture="environment"></label>
          <label>Fragtbrev/faktura<input name="supplierDocument" type="file" accept="image/*,.pdf" capture="environment"></label>
          <label><span><input name="approveSuggestion" type="checkbox" checked> Godkend og opret produktforslag hvis varen ikke findes</span></label>
          <button class="lager-btn primary" type="submit">Gem modtagelse</button>
        </form>
      </article>
      <article class="lager-panel">
        <h2>Seneste varemodtagelser</h2>
        <h3>Leverandørdokumenter</h3>
        ${renderSupplierDocuments(state.documents.slice(0, 12))}
        <h3>Modtagelser</h3>
        ${renderTable(state.receipts.slice(0, 12), ["Produkt", "Leverandør", "Mængde"], (row) => [
          row.productName || "-",
          row.supplier || "-",
          formatReceiptQuantity(row)
        ])}
      </article>
    </section>
  `;
}

function renderSupplierDocuments(documents) {
  if (!documents.length) return `<div class="lager-empty">Ingen leverandørdokumenter endnu.</div>`;
  return `<div class="lager-list">${documents.map((document) => {
    const status = document.status || document.ocrStatus || "uploaded";
    const extracted = document.extractedFields || document.ocrExtracted || {};
    const fileUrl = document.fileUrl || document.photoUrl || document.documentUrl || "";
    return `
      <div class="lager-row">
        <div>
          <div class="lager-row-title">${escapeHtml(document.productName || extracted.productName || document.supplier || "Leverandørdokument")}</div>
          <div class="lager-row-meta">
            <span class="lager-chip">${escapeHtml(status)}</span>
            ${document.goodsReceiptId ? `<span class="lager-chip">Kladde oprettet</span>` : ""}
            ${fileUrl ? `<a class="lager-chip" href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer">Åbn fil</a>` : ""}
          </div>
          ${renderExtractedFields(extracted)}
        </div>
        <button
          class="lager-btn"
          type="button"
          data-process-supplier-document="${escapeHtml(document.id)}"
          ${status === "processing" ? "disabled" : ""}
        >${status === "processing" ? "Behandler..." : "Behandl med AI"}</button>
      </div>
    `;
  }).join("")}</div>`;
}

function renderExtractedFields(extracted = {}) {
  const fields = [
    ["Leverandør", extracted.supplier],
    ["Faktura", extracted.invoiceNumber],
    ["Følgeseddel", extracted.deliveryNoteNumber],
    ["Produkt", extracted.productName],
    ["Antal", extracted.quantity],
    ["Pakkeenhed", extracted.packageUnit],
    ["Størrelse", extracted.packageSize ? `${extracted.packageSize} ${extracted.packageSizeUnit || ""}` : ""],
    ["Pris", extracted.price],
    ["Moms", extracted.vatRate],
    ["Batch", extracted.batchNumber],
    ["Udløb", extracted.expiryDate],
    ["Stregkode/SKU", extracted.barcode || extracted.sku]
  ].filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "");

  if (!fields.length) return "";
  return `<dl class="lager-extracted-fields">${fields.map(([label, value]) => `
    <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>
  `).join("")}</dl>`;
}

function renderSpillage() {
  return `
    <section class="lager-two">
      <article class="lager-panel">
        <h2>Registrér svind</h2>
        <form id="spillageForm" class="lager-form">
          <label>Vare<select name="itemId" required>${itemOptions()}</select></label>
          <div class="lager-form-row">
            <label>Type<select name="type">${options(SPILLAGE_TYPES)}</select></label>
            <label>Mængde<input name="quantity" type="number" step="0.01" required></label>
          </div>
          <label>Årsag<textarea name="reason" placeholder="Fx buffetrest, fejlproduktion, udløb"></textarea></label>
          <button class="lager-btn primary" type="submit">Gem svind</button>
        </form>
      </article>
      <article class="lager-panel">
        <h2>Svindlog</h2>
        ${renderTable(state.spillage.slice(0, 12), ["Vare", "Type", "Værdi"], (row) => [
          itemName(row.itemId),
          row.type || "-",
          kr(row.value)
        ])}
      </article>
    </section>
  `;
}

function renderReports() {
  const kpi = calculateKpis();
  return `
    <section class="lager-grid">
      ${kpiCard("Reelt vareforbrug", kr(kpi.periodConsumptionValue), "Startlager + køb - slutlager - spild")}
      ${kpiCard("Spildværdi", kr(kpi.spillageValue), "Økonomisk værdi af registreret svind")}
      ${kpiCard("Varekøb", kr(kpi.receiptValue), "Modtagelser i perioden")}
      ${kpiCard("Differencer", kpi.criticalDiffs, "Kritiske optællingsafvigelser")}
    </section>
    <section class="lager-card">
      <h2>Revisionsspor</h2>
      ${renderTable(state.movements.slice(0, 25), ["Type", "Vare", "Mængde"], (row) => [
        row.type || "-",
        itemName(row.itemId),
        `${formatNumber(row.quantity)} ${row.unit || ""}`
      ])}
    </section>
  `;
}

function renderSettings() {
  return `
    <section class="lager-two">
      <article class="lager-panel">
        <h2>Prisindex sliders</h2>
        <form id="indexForm" class="lager-form">
          ${slider("rawMaterialIndex", "Råvareindex")}
          ${slider("energyIndex", "Energiindex")}
          ${slider("transportIndex", "Transportindex")}
          ${slider("fuelIndex", "Olie/brændstofindex")}
          ${slider("laborIndex", "Lønindex")}
          <button class="lager-btn primary" type="submit">Gem index</button>
        </form>
      </article>
      <article class="lager-panel">
        <h2>AI-pipeline status</h2>
        <p>V1 gemmer dokumenter og strukturerede data. Næste fase kan koble Cloud Functions/OCR på samme supplier_documents og goods_receipts.</p>
        <div class="lager-row-meta">
          <span class="lager-chip">OCR-ready</span>
          <span class="lager-chip">Kamera-ready</span>
          <span class="lager-chip">Offline queue-ready</span>
          <span class="lager-chip">HACCP bridge</span>
        </div>
      </article>
    </section>
  `;
}

function renderMenuCalculator() {
  const idx = state.indexes;
  const raw = 45 * idx.rawMaterialIndex / 100;
  const energy = 4 * idx.energyIndex / 100;
  const labor = 18 * idx.laborIndex / 100;
  const transport = 3 * idx.transportIndex / 100;
  const packaging = 5;
  const rent = 8;
  const waste = raw * 0.06;
  const targetMargin = 0.68;
  const totalCost = raw + energy + labor + transport + packaging + rent + waste;
  const suggested = totalCost / (1 - targetMargin);
  return `
    <div class="lager-table-wrap">
      <table class="lager-table">
        <thead><tr><th>Komponent</th><th>Beløb</th><th>Index</th></tr></thead>
        <tbody>
          <tr><td>Råvarer</td><td>${kr(raw)}</td><td>${idx.rawMaterialIndex}</td></tr>
          <tr><td>Spildandel</td><td>${kr(waste)}</td><td>6%</td></tr>
          <tr><td>Lønandel</td><td>${kr(labor)}</td><td>${idx.laborIndex}</td></tr>
          <tr><td>Energi</td><td>${kr(energy)}</td><td>${idx.energyIndex}</td></tr>
          <tr><td>Transport</td><td>${kr(transport)}</td><td>${idx.transportIndex}</td></tr>
          <tr><td>Emballage + husleje</td><td>${kr(packaging + rent)}</td><td>Fast</td></tr>
        </tbody>
        <tfoot><tr><td>Anbefalet salgspris</td><td>${kr(suggested)}</td><td>Dækningsgrad ${(targetMargin * 100).toFixed(0)}%</td></tr></tfoot>
      </table>
    </div>
  `;
}

function bindCommon() {
  document.querySelectorAll("[data-refresh]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await loadData();
      render();
    });
  });
}

function bindView() {
  document.getElementById("itemForm")?.addEventListener("submit", saveItem);
  document.getElementById("countForm")?.addEventListener("submit", saveCount);
  document.getElementById("receiptForm")?.addEventListener("submit", saveReceipt);
  document.getElementById("spillageForm")?.addEventListener("submit", saveSpillage);
  document.getElementById("indexForm")?.addEventListener("input", updateSliderLabels);
  document.getElementById("indexForm")?.addEventListener("submit", saveIndexes);
  document.querySelectorAll("[data-bilag-upload]").forEach((form) => {
    form.addEventListener("submit", uploadBilag);
  });
  document.querySelectorAll("[data-mark-booked]").forEach((button) => {
    button.addEventListener("click", markDocumentAsBooked);
  });
  document.querySelectorAll("[data-process-supplier-document]").forEach((button) => {
    button.addEventListener("click", processSupplierDocumentWithAi);
  });
  bindSupplierImportView();
  bindCatalogView();
  bindInventoryNormalizeForms();
  updateSliderLabels();
}

function bindSupplierImportView() {
  document.getElementById("supplierImportSupplier")?.addEventListener("change", (event) => {
    state.supplierImportDraft.supplierId = event.currentTarget.value;
    render();
  });
  document.getElementById("supplierImportFile")?.addEventListener("change", handleSupplierImportFile);
  document.querySelectorAll("[data-supplier-map]").forEach((select) => {
    select.addEventListener("change", (event) => {
      state.supplierImportDraft.mapping[event.currentTarget.dataset.supplierMap] = event.currentTarget.value;
    });
  });
  document.getElementById("supplierImportButton")?.addEventListener("click", importSupplierCatalogItems);
}

function bindCatalogView() {
  document.getElementById("catalogSearch")?.addEventListener("input", refreshCatalogList);
  document.getElementById("catalogCategoryFilter")?.addEventListener("change", refreshCatalogList);
  document.getElementById("catalogUnitFilter")?.addEventListener("change", refreshCatalogList);
  document.querySelectorAll("[data-catalog-add]").forEach((button) => {
    button.addEventListener("click", copyCatalogItemToInventory);
  });
}

function refreshCatalogList() {
  const list = document.getElementById("catalogList");
  if (!list) return;
  list.innerHTML = renderCatalogList(getFilteredCatalogItems());
  document.querySelectorAll("[data-catalog-add]").forEach((button) => {
    button.addEventListener("click", copyCatalogItemToInventory);
  });
}

function bindInventoryNormalizeForms() {
  document.querySelectorAll("[data-inventory-normalize]").forEach((form) => {
    form.addEventListener("input", () => updateInventoryNormalizePreview(form));
    updateInventoryNormalizePreview(form);
  });
}

function updateInventoryNormalizePreview(form) {
  const normalized = getNormalizedQuantityFromForm(form);
  const preview = form.querySelector("[data-normalized-preview]");
  const baseUnitPreview = form.elements.baseUnitPreview;
  if (baseUnitPreview) baseUnitPreview.value = normalized.normalizedUnit;
  if (!preview) return;
  const secondary = normalized.displaySecondary ? ` (${normalized.displaySecondary})` : "";
  const bottleText = normalized.calculatedBottles > 0
    ? ` · ${formatNumber(normalized.calculatedBottles)} flasker`
    : "";
  preview.textContent = `Samlet: ${normalized.displayQuantity}${secondary}${bottleText}`;
}

function getNormalizedQuantityFromForm(form) {
  return normalizeInventoryQuantity(formData(form));
}

async function handleSupplierImportFile(event) {
  const file = event.currentTarget.files?.[0];
  if (!file) return;

  setSupplierDraftStatus({
    message: "Læser fil...",
    messageType: "",
    rowsRead: 0,
    rowsImported: 0,
    rowsUpdated: 0,
    rowsFailed: 0
  });

  try {
    const sourceFileType = getSupplierSourceFileType(file);
    const rows = sourceFileType === "excel"
      ? await parseExcelSupplierFile(file)
      : await parseCsvSupplierFile(file);
    const headers = getHeadersFromRows(rows);
    state.supplierImportDraft = {
      ...state.supplierImportDraft,
      sourceFileName: file.name || "",
      sourceFileType,
      rows,
      headers,
      mapping: guessSupplierImportMapping(headers),
      status: {
        rowsRead: rows.length,
        rowsImported: 0,
        rowsUpdated: 0,
        rowsFailed: 0,
        message: rows.length ? "Fil læst. Kontrollér preview og mapping." : "Filen indeholder ingen varer.",
        messageType: rows.length ? "success" : "error"
      }
    };
    render();
  } catch (error) {
    console.error("[lagerkontrol] supplier import parse failed", error);
    setSupplierDraftStatus({
      message: `Kunne ikke læse filen: ${error?.message || error}`,
      messageType: "error"
    });
    render();
  }
}

async function importSupplierCatalogItems() {
  const draft = state.supplierImportDraft;
  const form = document.getElementById("supplierImportForm");
  syncSupplierMappingFromDom();

  if (!draft.rows.length) {
    toast("Upload en fil først");
    return;
  }
  if (!draft.mapping.name) {
    toast("Produktnavn skal mappes");
    return;
  }

  const supplier = getSupplierProfile(draft.supplierId);
  if (!supplier) {
    toast("Vælg en grossist");
    return;
  }

  const button = document.getElementById("supplierImportButton");
  if (button) {
    button.disabled = true;
    button.textContent = "Importerer...";
  }

  const importRef = doc(rootCollection(COLLECTIONS.supplierCatalogImports));
  const importBase = {
    supplierId: supplier.supplierId,
    supplierName: supplier.name,
    sourceFileName: draft.sourceFileName,
    sourceFileType: draft.sourceFileType,
    status: "processing",
    rowsRead: draft.rows.length,
    rowsImported: 0,
    rowsUpdated: 0,
    rowsFailed: 0,
    startedAt: serverTimestamp(),
    completedAt: null,
    createdBy: state.user?.uid || "",
    ...createAuditCreateFields(state.user, state.profile)
  };

  try {
    const supplierProfileRef = rootDoc(COLLECTIONS.supplierProfiles, supplier.supplierId);
    const supplierProfileExists = (await getDoc(supplierProfileRef)).exists();
    await setDoc(supplierProfileRef, {
      ...supplier,
      contactEmail: form?.contactEmail?.value?.trim() || supplier.contactEmail || "",
      contactPhone: form?.contactPhone?.value?.trim() || supplier.contactPhone || "",
      isActive: true,
      supportsCsv: true,
      supportsExcel: true,
      supportsEdi: Boolean(supplier.supportsEdi),
      supportsApi: Boolean(supplier.supportsApi),
      ...(supplierProfileExists
        ? createAuditUpdateFields(state.user, state.profile)
        : createAuditCreateFields(state.user, state.profile))
    }, { merge: true });

    await setDoc(importRef, importBase);
    const stats = await writeSupplierCatalogRows(draft, supplier);

    await updateDoc(importRef, {
      status: stats.rowsFailed ? "completed_with_errors" : "completed",
      rowsImported: stats.rowsImported,
      rowsUpdated: stats.rowsUpdated,
      rowsFailed: stats.rowsFailed,
      completedAt: serverTimestamp(),
      ...createAuditUpdateFields(state.user, state.profile)
    });

    state.supplierImportDraft.status = {
      rowsRead: draft.rows.length,
      rowsImported: stats.rowsImported,
      rowsUpdated: stats.rowsUpdated,
      rowsFailed: stats.rowsFailed,
      message: "Import færdig. Grossistdata ligger nu i supplier_catalog_items.",
      messageType: stats.rowsFailed ? "error" : "success"
    };
    toast("Grossistkatalog importeret");
    await loadData();
    render();
  } catch (error) {
    console.error("[lagerkontrol] supplier import failed", error);
    await updateDoc(importRef, {
      status: "failed",
      rowsFailed: draft.rows.length,
      completedAt: serverTimestamp(),
      errorMessage: String(error?.message || error).slice(0, 500),
      ...createAuditUpdateFields(state.user, state.profile)
    }).catch(() => {});
    setSupplierDraftStatus({
      rowsRead: draft.rows.length,
      rowsFailed: draft.rows.length,
      message: `Import fejlede: ${error?.message || error}`,
      messageType: "error"
    });
    render();
  }
}

async function writeSupplierCatalogRows(draft, supplier) {
  let rowsImported = 0;
  let rowsUpdated = 0;
  let rowsFailed = 0;
  let batch = writeBatch(db);
  let batchSize = 0;

  for (const row of draft.rows) {
    const item = mapSupplierCatalogRow(row, draft.mapping, supplier, draft);
    if (!item.normalizedKey || !item.name) {
      rowsFailed += 1;
      continue;
    }

    const itemRef = rootDoc(COLLECTIONS.supplierCatalogItems, makeSupplierCatalogDocId(supplier.supplierId, item.normalizedKey));
    const existing = await getDoc(itemRef);
    const auditFields = existing.exists()
      ? createAuditUpdateFields(state.user, state.profile)
      : createAuditCreateFields(state.user, state.profile);

    batch.set(itemRef, {
      ...item,
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
      ...auditFields
    }, { merge: true });
    batchSize += 1;

    if (existing.exists()) {
      rowsUpdated += 1;
    } else {
      rowsImported += 1;
    }

    if (batchSize >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      batchSize = 0;
    }
  }

  if (batchSize) {
    await batch.commit();
  }

  return { rowsImported, rowsUpdated, rowsFailed };
}

function mapSupplierCatalogRow(row, mapping, supplier, draft) {
  const value = (field) => cleanCell(row[mapping[field]]);
  const supplierItemNumber = value("supplierItemNumber");
  const ean = value("ean");
  const gtin = value("gtin");
  const sku = value("sku");
  const name = value("name");
  const normalizedKey = makeNormalizedSupplierKey(supplierItemNumber || ean || gtin || sku || name);
  const price = parseDanishNumber(value("currentPurchasePrice"));
  const vatRate = parseDanishNumber(value("vatRate"));

  return {
    supplierId: supplier.supplierId,
    supplierName: supplier.name,
    supplierItemNumber,
    ean,
    gtin,
    sku,
    name,
    brand: value("brand"),
    category: value("category"),
    unit: value("unit"),
    packSize: value("packSize"),
    caseSize: value("caseSize"),
    vatRate: vatRate || null,
    currentPurchasePrice: price || 0,
    currency: value("currency") || "DKK",
    availability: value("availability") || "unknown",
    priceUpdatedAt: price > 0 ? serverTimestamp() : null,
    lastSeenAt: serverTimestamp(),
    sourceType: draft.sourceFileType,
    sourceFileName: draft.sourceFileName,
    normalizedKey,
    isActive: true,
    demoData: false,
    updatedAt: serverTimestamp()
  };
}

async function saveItem(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = formData(form);
  const normalized = getNormalizedQuantityFromForm(form);
  const payload = {
    ...baseFields(),
    name: data.name,
    productName: data.name,
    category: data.category,
    unitType: normalized.unitType,
    baseUnit: normalized.baseUnit,
    packageUnit: normalized.packageUnit,
    packageSize: normalized.packageSize,
    packageSizeUnit: normalized.packageSizeUnit,
    unitsPerPackage: normalized.unitsPerPackage,
    quantity: normalized.quantity,
    originalQuantity: normalized.originalQuantity,
    originalUnit: normalized.originalUnit,
    normalizedQuantity: normalized.normalizedQuantity,
    normalizedUnit: normalized.normalizedUnit,
    currentQuantity: normalized.normalizedQuantity,
    unit: normalized.normalizedUnit,
    parLevel: number(data.parLevel),
    purchasePrice: number(data.purchasePrice),
    pricePerNormalizedUnit: normalized.normalizedQuantity > 0 ? number(data.purchasePrice) / normalized.normalizedQuantity : 0,
    supplier: data.supplier,
    bottleSizeCl: number(data.bottleSizeCl),
    currentCl: number(data.currentCl),
    active: true
  };
  await addDoc(companyCollection(COLLECTIONS.items), payload);
  toast("Vare gemt");
  await reloadAndRender();
}

async function copyCatalogItemToInventory(event) {
  const button = event.currentTarget;
  const catalogItemId = button?.dataset?.catalogAdd || "";
  const item = findCatalogItem(catalogItemId);
  if (!item) {
    toast("Varen blev ikke fundet i biblioteket");
    return;
  }
  if (isCatalogItemAdded(catalogItemId)) {
    toast("Varen er allerede tilføjet");
    return;
  }

  button.disabled = true;
  button.textContent = "Tilføjer...";

  try {
    const unit = item.unit || item.baseUnit || "stk";
    await addDoc(companyCollection(COLLECTIONS.items), {
      ...baseFields(),
      updatedAt: serverTimestamp(),
      updatedBy: state.user?.uid || "",
      catalogItemId,
      name: item.name || item.productName || "",
      productName: item.name || item.productName || "",
      category: item.category || "",
      unit,
      defaultVatRate: number(item.defaultVatRate ?? item.vatRate ?? 25),
      accountingCategory: item.accountingCategory || "",
      allergens: Array.isArray(item.allergens) ? item.allergens.filter(Boolean) : [],
      haccpCategory: item.haccpCategory || "",
      supplierName: "",
      supplier: "",
      purchasePrice: 0,
      stockQty: 0,
      parLevel: 0,
      isActive: true,
      active: true,
      currentQuantity: 0,
      quantity: 0,
      normalizedQuantity: 0,
      normalizedUnit: item.normalizedUnit || item.baseUnit || unit,
      baseUnit: item.baseUnit || unit,
      unitType: item.unitType || inferCatalogUnitType(unit),
      source: COLLECTIONS.catalog
    });

    toast("Vare tilføjet til lager");
    await reloadAndRender();
  } catch (error) {
    console.error("[lagerkontrol] catalog copy failed", error);
    button.disabled = false;
    button.textContent = "Tilføj til mit lager";
    toast("Kunne ikke tilføje varen");
  }
}

async function uploadBilag(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const mode = form.dataset.bilagUpload;
  const file = form.documentFile?.files?.[0];
  if (!file) {
    toast("Vælg et bilag først");
    return;
  }

  const submitButton = form.querySelector("button[type='submit']");
  const previousText = submitButton?.textContent || "";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Uploader...";
  }

  try {
    const fileUrl = await uploadOptional(file, mode === "accounting" ? "accounting-document" : "app-document");
    const isAccounting = mode === "accounting";
    await addDoc(companyCollection(COLLECTIONS.documents), {
      ...baseFields(),
      documentType: isAccounting ? "supplier_invoice" : "supplier_document",
      bookingStatus: isAccounting ? "needs_booking" : "not_required",
      appUploadPurpose: isAccounting ? "accounting" : "inventory_only",
      ocrStatus: "pending",
      status: "uploaded",
      accountantAccess: isAccounting,
      accountantUserIds: [],
      fileUrl,
      originalFileName: file.name || "",
      contentType: file.type || "",
      fileSize: file.size || 0
    });

    toast(isAccounting ? "Bilag uploadet til bogføring" : "Bilag uploadet til appen");
    form.reset();
    await reloadAndRender();
  } catch (error) {
    console.error("[lagerkontrol] bilag upload failed", error);
    toast("Kunne ikke uploade bilaget");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = previousText;
    }
  }
}

async function markDocumentAsBooked(event) {
  const button = event.currentTarget;
  const documentId = button.dataset.markBooked;
  if (!documentId) return;

  button.disabled = true;
  button.textContent = "Gemmer...";

  try {
    await updateDoc(companyDoc(COLLECTIONS.documents, documentId), {
      bookingStatus: "booked",
      bookedAt: serverTimestamp(),
      bookedBy: state.user?.uid || "",
      ...updateFields()
    });
    toast("Bilag markeret som bogført");
    await reloadAndRender();
  } catch (error) {
    console.error("[lagerkontrol] mark booked failed", error);
    button.disabled = false;
    button.textContent = "Markér som bogført";
    toast("Kunne ikke markere bilaget");
  }
}

async function saveCount(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const item = findItem(data.itemId);
  const counted = number(data.countedQuantity);
  const previous = number(item?.currentQuantity);
  const diff = counted - previous;
  const normalizedCount = normalizeInventoryQuantity({ quantity: counted, unit: item?.normalizedUnit || item?.unit || item?.baseUnit || "stk" });
  const normalizedDiff = normalizeInventoryQuantity({ quantity: diff, unit: item?.normalizedUnit || item?.unit || item?.baseUnit || "stk" });

  await addDoc(companyCollection(COLLECTIONS.counts), {
    ...baseFields(),
    itemId: data.itemId,
    itemName: item?.name || item?.productName || "",
    countedQuantity: counted,
    normalizedQuantity: normalizedCount.normalizedQuantity,
    normalizedUnit: normalizedCount.normalizedUnit,
    previousQuantity: previous,
    difference: diff,
    normalizedDifference: normalizedDiff.normalizedQuantity,
    unit: item?.unit || "",
    periodType: data.periodType,
    note: data.note
  });

  await addMovement({
    type: "count_adjustment",
    itemId: data.itemId,
    quantity: diff,
    normalizedQuantity: normalizedDiff.normalizedQuantity,
    normalizedUnit: normalizedDiff.normalizedUnit,
    unit: normalizedDiff.normalizedUnit,
    value: normalizedDiff.normalizedQuantity * getItemUnitCost(item)
  });

  if (item?.id) {
    await updateDoc(companyDoc(COLLECTIONS.items, item.id), {
      currentQuantity: counted,
      normalizedQuantity: normalizedCount.normalizedQuantity,
      normalizedUnit: normalizedCount.normalizedUnit,
      ...updateFields()
    });
  }

  toast("Optælling gemt");
  await reloadAndRender();
}

async function saveReceipt(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = formData(form);
  const normalized = getNormalizedQuantityFromForm(form);
  let item = data.itemId ? findItem(data.itemId) : findItemByName(data.productName);

  const productPhotoUrl = await uploadOptional(form.productPhoto?.files?.[0], "product-photo");
  const supplierDocumentUrl = await uploadOptional(form.supplierDocument?.files?.[0], "supplier-document");

  if (!item && data.approveSuggestion === "on") {
    const itemRef = await addDoc(companyCollection(COLLECTIONS.items), {
      ...baseFields(),
      name: data.productName,
      productName: data.productName,
      supplier: data.supplier,
      category: "colonial",
      unitType: normalized.unitType,
      baseUnit: normalized.baseUnit,
      packageUnit: normalized.packageUnit,
      packageSize: normalized.packageSize,
      packageSizeUnit: normalized.packageSizeUnit,
      unitsPerPackage: normalized.unitsPerPackage,
      quantity: 0,
      normalizedQuantity: 0,
      normalizedUnit: normalized.normalizedUnit,
      unit: normalized.normalizedUnit,
      currentQuantity: 0,
      purchasePrice: number(data.price),
      pricePerNormalizedUnit: normalized.normalizedQuantity > 0 ? number(data.price) / normalized.normalizedQuantity : 0,
      status: "suggested_approved",
      aiSuggested: true,
      active: true
    });
    item = { id: itemRef.id, name: data.productName, productName: data.productName, unit: normalized.normalizedUnit, currentQuantity: 0, purchasePrice: number(data.price) };
  }

  if (!item) {
    toast("Varen findes ikke. Godkend produktforslag for at fortsætte.");
    return;
  }

  const quantity = normalized.normalizedQuantity;
  const price = number(data.price);
  const batchPayload = {
    ...baseFields(),
    itemId: item.id,
    productName: data.productName,
    supplier: data.supplier,
    quantity: normalized.quantity,
    originalQuantity: normalized.originalQuantity,
    originalUnit: normalized.originalUnit,
    packageUnit: normalized.packageUnit,
    packageSize: normalized.packageSize,
    packageSizeUnit: normalized.packageSizeUnit,
    unitsPerPackage: normalized.unitsPerPackage,
    normalizedQuantity: normalized.normalizedQuantity,
    normalizedUnit: normalized.normalizedUnit,
    remainingQuantity: quantity,
    remainingNormalizedQuantity: normalized.normalizedQuantity,
    unitType: normalized.unitType,
    baseUnit: normalized.baseUnit,
    unit: normalized.normalizedUnit,
    price,
    batch: data.batch,
    receivedDate: data.receivedDate,
    temperature: data.temperature === "" ? null : number(data.temperature),
    productPhotoUrl,
    supplierDocumentUrl
  };
  const batchRef = await addDoc(companyCollection(COLLECTIONS.batches), batchPayload);

  if (supplierDocumentUrl) {
    await addDoc(companyCollection(COLLECTIONS.documents), {
      ...baseFields(),
      documentType: "supplier_document",
      status: "uploaded",
      supplier: data.supplier,
      productName: data.productName,
      fileUrl: supplierDocumentUrl,
      ocrStatus: "pending",
      ocrExtracted: {
        productName: data.productName,
        supplier: data.supplier,
        weight: normalized.normalizedQuantity,
        price,
        unit: normalized.normalizedUnit,
        quantity: normalized.quantity,
        packageUnit: normalized.packageUnit,
        packageSize: normalized.packageSize,
        packageSizeUnit: normalized.packageSizeUnit,
        normalizedQuantity: normalized.normalizedQuantity,
        normalizedUnit: normalized.normalizedUnit,
        batch: data.batch,
        date: data.receivedDate
      }
    });
  }

  await addDoc(companyCollection(COLLECTIONS.receipts), {
    ...baseFields(),
    itemId: item.id,
    batchId: batchRef.id,
    productName: data.productName,
    supplier: data.supplier,
    quantity: normalized.quantity,
    originalQuantity: normalized.originalQuantity,
    originalUnit: normalized.originalUnit,
    packageUnit: normalized.packageUnit,
    packageSize: normalized.packageSize,
    packageSizeUnit: normalized.packageSizeUnit,
    unitsPerPackage: normalized.unitsPerPackage,
    normalizedQuantity: normalized.normalizedQuantity,
    normalizedUnit: normalized.normalizedUnit,
    unitType: normalized.unitType,
    baseUnit: normalized.baseUnit,
    unit: normalized.normalizedUnit,
    price,
    batch: data.batch,
    receivedDate: data.receivedDate,
    productPhotoUrl,
    supplierDocumentUrl,
    haccpDocumentation: {
      routineType: "varemodtagelse",
      temperature: data.temperature === "" ? null : number(data.temperature),
      temperatureOk: data.temperature === "" ? null : number(data.temperature) <= 5,
      documentationSource: "lagerkontrol_pro"
    }
  });

  await updateDoc(companyDoc(COLLECTIONS.items, item.id), {
    currentQuantity: number(item.currentQuantity) + quantity,
    normalizedQuantity: number(item.normalizedQuantity || item.currentQuantity) + normalized.normalizedQuantity,
    normalizedUnit: normalized.normalizedUnit,
    unitType: normalized.unitType,
    baseUnit: normalized.baseUnit,
    unit: normalized.normalizedUnit,
    packageUnit: normalized.packageUnit,
    packageSize: normalized.packageSize,
    packageSizeUnit: normalized.packageSizeUnit,
    unitsPerPackage: normalized.unitsPerPackage,
    purchasePrice: price || number(item.purchasePrice),
    pricePerNormalizedUnit: normalized.normalizedQuantity > 0 ? (price || number(item.purchasePrice)) / normalized.normalizedQuantity : number(item.pricePerNormalizedUnit),
    supplier: data.supplier || item.supplier || "",
    ...updateFields()
  });

  await addMovement({
    type: "receipt",
    itemId: item.id,
    quantity,
    normalizedQuantity: normalized.normalizedQuantity,
    normalizedUnit: normalized.normalizedUnit,
    unit: normalized.normalizedUnit,
    value: price
  });

  toast("Varemodtagelse gemt");
  await reloadAndRender();
}

async function processSupplierDocumentWithAi(event) {
  const button = event.currentTarget;
  const supplierDocumentId = button.dataset.processSupplierDocument;
  if (!supplierDocumentId) return;

  button.disabled = true;
  button.textContent = "Behandler...";

  try {
    await updateDoc(companyDoc(COLLECTIONS.documents, supplierDocumentId), {
      status: "processing",
      ...updateFields()
    });
    const response = await processSupplierDocument({
      companyId: state.companyId,
      locationId: state.locationId,
      supplierDocumentId
    });
    const result = response.data || {};
    toast(result.status === "failed" ? "AI-behandling fejlede" : "AI-forslag klar til review");
    await reloadAndRender();
  } catch (error) {
    console.error("[lagerkontrol] AI document processing failed", error);
    await updateDoc(companyDoc(COLLECTIONS.documents, supplierDocumentId), {
      status: "failed",
      processingError: String(error?.message || error).slice(0, 500),
      ...updateFields()
    }).catch(() => {});
    toast("AI-behandling fejlede");
    await reloadAndRender();
  }
}

async function saveSpillage(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const item = findItem(data.itemId);
  const quantity = number(data.quantity);
  const normalized = normalizeInventoryQuantity({ quantity, unit: item?.normalizedUnit || item?.unit || item?.baseUnit || "stk" });
  const value = normalized.normalizedQuantity * getItemUnitCost(item);

  await addDoc(companyCollection(COLLECTIONS.spillage), {
    ...baseFields(),
    itemId: data.itemId,
    itemName: item?.name || item?.productName || "",
    type: data.type,
    quantity,
    normalizedQuantity: normalized.normalizedQuantity,
    normalizedUnit: normalized.normalizedUnit,
    unit: normalized.normalizedUnit,
    value,
    reason: data.reason
  });

  if (item?.id) {
    await updateDoc(companyDoc(COLLECTIONS.items, item.id), {
      currentQuantity: Math.max(0, number(item.currentQuantity) - normalized.normalizedQuantity),
      normalizedQuantity: Math.max(0, number(item.normalizedQuantity || item.currentQuantity) - normalized.normalizedQuantity),
      ...updateFields()
    });
  }

  await addMovement({
    type: "spillage",
    itemId: data.itemId,
    quantity: -normalized.normalizedQuantity,
    normalizedQuantity: -normalized.normalizedQuantity,
    normalizedUnit: normalized.normalizedUnit,
    unit: normalized.normalizedUnit,
    value: -value
  });

  toast("Svind registreret");
  await reloadAndRender();
}

async function saveIndexes(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const payload = {
    ...baseFields(),
    rawMaterialIndex: number(data.rawMaterialIndex),
    energyIndex: number(data.energyIndex),
    transportIndex: number(data.transportIndex),
    fuelIndex: number(data.fuelIndex),
    laborIndex: number(data.laborIndex)
  };
  await setDoc(companyDoc(COLLECTIONS.indexes, state.locationId), payload, { merge: true });
  toast("Prisindex gemt");
  await reloadAndRender();
}

async function addMovement(fields) {
  await addDoc(companyCollection(COLLECTIONS.movements), {
    ...baseFields(),
    ...fields
  });
}

async function uploadOptional(file, kind) {
  if (!file) return "";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const path = `companies/${state.companyId}/lagerkontrol/${state.locationId}/${kind}/${Date.now()}-${safeName}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

async function reloadAndRender() {
  await loadData();
  render();
}

function calculateKpis() {
  const receiptValue = state.receipts.reduce((sum, row) => sum + number(row.price), 0);
  const spillageValue = state.spillage.reduce((sum, row) => sum + number(row.value), 0);
  const stockValue = state.items.reduce((sum, item) => sum + number(item.normalizedQuantity || item.currentQuantity) * getItemUnitCost(item), 0);
  const lowStockCount = state.items.filter((item) => number(item.currentQuantity) <= number(item.parLevel)).length;
  const criticalDiffs = state.counts.filter((row) => Math.abs(number(row.difference)) > Math.max(5, number(row.previousQuantity) * 0.15)).length;
  const periodConsumptionValue = Math.max(0, receiptValue - stockValue - spillageValue);
  return {
    receiptValue,
    spillageValue,
    spillageCount: state.spillage.length,
    stockValue,
    lowStockCount,
    criticalDiffs,
    periodConsumptionValue,
    estimatedMarginToday: Math.max(0, receiptValue * 0.62 - spillageValue),
    estimatedMarginMonth: Math.max(0, receiptValue * 0.68 - spillageValue),
    coverageRate: 68,
    laborPercent: Math.round(state.indexes.laborIndex * 0.22)
  };
}

function getItemUnitCost(item = {}) {
  const explicit = number(item.pricePerNormalizedUnit);
  if (explicit > 0) return explicit;
  const normalizedQuantity = number(item.normalizedQuantity || item.currentQuantity);
  return normalizedQuantity > 0 ? number(item.purchasePrice) / normalizedQuantity : number(item.purchasePrice);
}

function kpiCard(label, value, sub) {
  return `<article class="lager-kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(sub)}</small></article>`;
}

function renderItemList(items) {
  if (!items.length) return `<div class="lager-empty">Ingen varer endnu.</div>`;
  return `<div class="lager-list">${items.map((item) => {
    const isBar = item.category === "bar";
    const bottleText = isBar && number(item.bottleSizeCl)
      ? `${formatNumber(number(item.currentCl) / number(item.bottleSizeCl))} flasker (${formatNumber(item.currentCl)} cl tilbage)`
      : "";
    const normalizedText = formatNormalizedItemQuantity(item);
    return `
      <div class="lager-row">
        <div>
          <div class="lager-row-title">${escapeHtml(item.name || item.productName || "Vare")}</div>
          <div class="lager-row-meta">
            <span class="lager-chip">${escapeHtml(categoryLabel(item.category))}</span>
            <span class="lager-chip">${escapeHtml(normalizedText)}</span>
            ${number(item.currentQuantity) <= number(item.parLevel) ? `<span class="lager-chip warn">Lav beholdning</span>` : ""}
            ${bottleText ? `<span class="lager-chip">${escapeHtml(bottleText)}</span>` : ""}
          </div>
        </div>
        <strong>${kr(number(item.normalizedQuantity || item.currentQuantity) * getItemUnitCost(item))}</strong>
      </div>
    `;
  }).join("")}</div>`;
}

function formatNormalizedItemQuantity(item = {}) {
  const normalizedQuantity = number(item.normalizedQuantity || item.currentQuantity);
  const normalizedUnit = item.normalizedUnit || item.unit || "";
  const normalized = normalizeInventoryQuantity({ quantity: normalizedQuantity, unit: normalizedUnit });
  const secondary = normalized.displaySecondary ? ` (${normalized.displaySecondary})` : "";
  const original = item.originalQuantity || item.quantity
    ? ` · ${formatNumber(item.originalQuantity || item.quantity)} ${item.packageUnit || item.originalUnit || ""}`.trim()
    : "";
  return `${normalized.displayQuantity}${secondary}${original}`;
}

function formatReceiptQuantity(row = {}) {
  const normalized = normalizeInventoryQuantity({
    quantity: row.normalizedQuantity || row.quantity,
    unit: row.normalizedUnit || row.unit || "stk"
  });
  const secondary = normalized.displaySecondary ? ` (${normalized.displaySecondary})` : "";
  const original = row.originalQuantity || row.quantity
    ? ` · ${formatNumber(row.originalQuantity || row.quantity)} ${row.packageUnit || row.originalUnit || ""}`.trim()
    : "";
  return `${normalized.displayQuantity}${secondary}${original}`;
}

function createEmptySupplierImportDraft() {
  return {
    supplierId: "dagrofa",
    sourceFileName: "",
    sourceFileType: "csv",
    headers: [],
    rows: [],
    mapping: {},
    status: {
      rowsRead: 0,
      rowsImported: 0,
      rowsUpdated: 0,
      rowsFailed: 0,
      message: "Klar til import.",
      messageType: ""
    }
  };
}

function getSupplierProfilesForSelect() {
  const byId = new Map();
  [...DEFAULT_SUPPLIER_PROFILES, ...state.supplierProfiles].forEach((supplier) => {
    const supplierId = String(supplier.supplierId || supplier.id || "").trim();
    if (!supplierId) return;
    byId.set(supplierId, {
      ...supplier,
      supplierId,
      name: supplier.name || supplierId,
      isActive: supplier.isActive !== false
    });
  });
  return [...byId.values()]
    .filter((supplier) => supplier.isActive !== false)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "da"));
}

function getSupplierProfile(supplierId) {
  return getSupplierProfilesForSelect().find((supplier) => supplier.supplierId === supplierId);
}

function setSupplierDraftStatus(partial) {
  state.supplierImportDraft.status = {
    ...state.supplierImportDraft.status,
    ...partial
  };
}

function syncSupplierMappingFromDom() {
  document.querySelectorAll("[data-supplier-map]").forEach((select) => {
    state.supplierImportDraft.mapping[select.dataset.supplierMap] = select.value;
  });
}

function getSupplierSourceFileType(file) {
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "excel";
  return "csv";
}

async function parseCsvSupplierFile(file) {
  const text = await file.text();
  const matrix = parseDelimitedText(text);
  return matrixToObjects(matrix);
}

async function parseExcelSupplierFile(file) {
  const XLSX = await import(XLSX_MODULE_URL);
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
  return matrixToObjects(matrix);
}

function parseDelimitedText(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => cleanCell(value) !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => cleanCell(value) !== "")) rows.push(row);
  return rows;
}

function detectDelimiter(text) {
  const firstLine = String(text || "").split(/\r?\n/).find((line) => line.trim()) || "";
  const candidates = [";", "\t", ","];
  return candidates
    .map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ";";
}

function matrixToObjects(matrix) {
  const rows = (matrix || []).filter((row) => Array.isArray(row) && row.some((value) => cleanCell(value) !== ""));
  const headers = (rows[0] || []).map((value, index) => cleanCell(value) || `Kolonne ${index + 1}`);
  if (!headers.length) return [];
  return rows.slice(1)
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, cleanCell(row[index])])))
    .filter((row) => Object.values(row).some((value) => cleanCell(value) !== ""));
}

function getHeadersFromRows(rows) {
  return rows[0] ? Object.keys(rows[0]) : [];
}

function guessSupplierImportMapping(headers) {
  const normalizedHeaders = headers.map((header) => [header, normalizeHeader(header)]);
  return Object.fromEntries(SUPPLIER_IMPORT_FIELDS.map(([field]) => {
    const aliases = SUPPLIER_IMPORT_ALIASES[field] || [];
    const match = normalizedHeaders.find(([, normalized]) => aliases.some((alias) => normalized === normalizeHeader(alias)))
      || normalizedHeaders.find(([, normalized]) => aliases.some((alias) => normalized.includes(normalizeHeader(alias))));
    return [field, match?.[0] || ""];
  }));
}

function normalizeHeader(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanCell(value) {
  return String(value ?? "").replace(/\uFEFF/g, "").trim();
}

function parseDanishNumber(value) {
  const raw = cleanCell(value);
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  return number(normalized.replace(/[^0-9.-]/g, ""));
}

function makeNormalizedSupplierKey(value) {
  return cleanCell(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function makeSupplierCatalogDocId(supplierId, normalizedKey) {
  const supplierPart = makeNormalizedSupplierKey(supplierId) || "supplier";
  const keyPart = makeNormalizedSupplierKey(normalizedKey) || `item-${Date.now()}`;
  return `${supplierPart}__${keyPart}`.slice(0, 180);
}

function getTimeValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  return new Date(value).getTime() || 0;
}

function renderTable(rows, headers, mapRow) {
  if (!rows.length) return `<div class="lager-empty">Ingen registreringer endnu.</div>`;
  return `
    <div class="lager-table-wrap">
      <table class="lager-table">
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${mapRow(row).map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function itemOptions(includePlaceholder = true) {
  const rows = state.items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name || item.productName || item.id)}</option>`).join("");
  return `${includePlaceholder ? `<option value="">Vælg vare</option>` : ""}${rows}`;
}

function options(pairs) {
  return pairs.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
}

function slider(name, label) {
  const value = number(state.indexes[name] || 100);
  return `
    <label>${escapeHtml(label)}
      <input class="bottle-slider" name="${escapeHtml(name)}" type="range" min="70" max="160" value="${value}">
      <span data-slider-label="${escapeHtml(name)}">${value}</span>
    </label>
  `;
}

function updateSliderLabels() {
  document.querySelectorAll("[data-slider-label]").forEach((el) => {
    const input = document.querySelector(`[name="${el.dataset.sliderLabel}"]`);
    if (input) el.textContent = input.value;
  });
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function findItem(id) {
  return state.items.find((item) => item.id === id);
}

function findItemByName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return state.items.find((item) => String(item.name || item.productName || "").trim().toLowerCase() === normalized);
}

function findCatalogItem(id) {
  return state.catalogItems.find((item) => item.id === id);
}

function isCatalogItemAdded(catalogItemId) {
  return state.items.some((item) => item.catalogItemId === catalogItemId);
}

function uniqueCatalogValues(field) {
  return [...new Set(state.catalogItems.map((item) => String(item[field] || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "da"));
}

function getFilteredCatalogItems() {
  const search = String(document.getElementById("catalogSearch")?.value || "").trim().toLowerCase();
  const category = String(document.getElementById("catalogCategoryFilter")?.value || "").trim();
  const unit = String(document.getElementById("catalogUnitFilter")?.value || "").trim();

  return state.catalogItems.filter((item) => {
    if (item.isActive === false) return false;
    const itemUnit = item.unit || item.baseUnit || "";
    const haystack = [
      item.name,
      item.category,
      catalogCategoryLabel(item.category),
      itemUnit,
      item.haccpCategory,
      item.accountingCategory,
      ...(Array.isArray(item.allergens) ? item.allergens : [])
    ].join(" ").toLowerCase();
    return (!search || haystack.includes(search))
      && (!category || item.category === category)
      && (!unit || itemUnit === unit);
  });
}

function itemName(id) {
  const item = findItem(id);
  return item?.name || item?.productName || id || "-";
}

function categoryLabel(value) {
  return CATEGORIES.find(([key]) => key === value)?.[1] || value || "Ukendt";
}

function documentTypeLabel(value) {
  return {
    supplier_invoice: "Leverandørfaktura",
    supplier_document: "Leverandørdokument"
  }[value] || value || "Dokument";
}

function bookingStatusLabel(value) {
  return {
    needs_booking: "Mangler bogføring",
    booked: "Bogført",
    not_required: "Bogføring ikke påkrævet"
  }[value] || value || "Ukendt status";
}

function catalogCategoryLabel(value) {
  const mapped = categoryLabel(value);
  return mapped === "Ukendt" ? value || "Ukendt" : mapped;
}

function inferCatalogUnitType(unit) {
  const normalized = String(unit || "").toLowerCase();
  if (["mg", "g", "kg", "ton"].includes(normalized)) return "weight";
  if (["ml", "cl", "dl", "l"].includes(normalized)) return "volume";
  return "count";
}

function number(value) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 }).format(number(value));
}

function kr(value) {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(number(value));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "lager-toast";
  el.textContent = message;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 2600);
}



