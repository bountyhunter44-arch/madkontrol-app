import { getAllLagerRoutes } from "../../../src/routes/route-registry.js";
import {
  getRouteByFile,
  renderRouteNavigation,
  renderRouteShell
} from "../../../src/components/route-shell.js";
import { getCurrentContext } from "../../../src/adapters/platform-context-adapter.js";
import { loadDashboardSummary } from "../../../src/services/dashboard-service.js";
import {
  renderDashboardSummary,
  renderDashboardWarnings
} from "../../../src/components/dashboard-view.js";
import { loadInventoryItems } from "../../../src/services/items-service.js";
import {
  renderInventoryItemsList,
  renderInventoryItemsWarnings
} from "../../../src/components/items-view.js";
import { loadSupplierDocuments } from "../../../src/services/documents-service.js";
import {
  renderSupplierDocumentsList,
  renderSupplierDocumentsWarnings
} from "../../../src/components/documents-view.js";
import { loadGoodsReceipts } from "../../../src/services/receipts-service.js";
import {
  renderGoodsReceiptsList,
  renderGoodsReceiptsWarnings
} from "../../../src/components/receipts-view.js";
import { loadInventoryCounts } from "../../../src/services/counts-service.js";
import {
  renderInventoryCountsList,
  renderInventoryCountsWarnings
} from "../../../src/components/counts-view.js";

const status = {
  moduleId: "lagerkontrol",
  entitlementKey: "lagerkontrol",
  status: "staging-readonly",
  productionWrites: false,
  productionCallables: false,
  liveRuntimeChanged: false
};

const routes = getAllLagerRoutes();

function setAdapterStatus(name, text) {
  const el = document.querySelector(`[data-adapter-status="${name}"]`);
  if (el) el.textContent = text;
}

function renderRoutes() {
  const list = document.getElementById("routeList");
  if (!list) return;
  list.innerHTML = routes
    .map((route) => `<li><a href="./${route.file}"><code>${route.file}</code><span>${route.title}</span></a></li>`)
    .join("");
}

function renderCurrentRoute() {
  const target = document.getElementById("routeShell");
  if (!target) return;
  const requested = document.body?.dataset?.routeFile || globalThis.location?.pathname || "index.html";
  const route = getRouteByFile(requested);
  renderRouteShell(route, target);
}

function renderNavigation() {
  renderRouteNavigation(routes, document.getElementById("routeNavigation"));
}

async function initDashboardReadOnly() {
  const summaryTarget = document.getElementById("dashboardSummary");
  if (!summaryTarget || document.body?.dataset?.routeFile !== "dashboard.html") return;

  const warnings = [];
  let context = null;

  try {
    const contextResponse = await getCurrentContext();
    if (contextResponse?.ok) {
      context = contextResponse.context;
    } else if (contextResponse?.error) {
      warnings.push(contextResponse.error);
    }
  } catch (error) {
    warnings.push(error?.message || "Platform context kunne ikke læses i staging read-only.");
  }

  const summary = await loadDashboardSummary(context);
  summary.warnings = [...warnings, ...summary.warnings];
  renderDashboardWarnings(summary.warnings, document.getElementById("dashboardWarnings"));
  renderDashboardSummary(summary, summaryTarget);
}

async function resolveReadOnlyContext(warnings) {
  try {
    const contextResponse = await getCurrentContext();
    if (contextResponse?.ok) {
      return contextResponse.context;
    }
    if (contextResponse?.error) {
      warnings.push(contextResponse.error);
    }
  } catch (error) {
    warnings.push(error?.message || "Platform context kunne ikke læses i staging read-only.");
  }
  return null;
}

async function initItemsReadOnly() {
  const itemsTarget = document.getElementById("itemsList");
  if (!itemsTarget || document.body?.dataset?.routeFile !== "varer.html") return;

  const warnings = [];
  const context = await resolveReadOnlyContext(warnings);
  const result = await loadInventoryItems(context);
  result.warnings = [...warnings, ...result.warnings];
  renderInventoryItemsWarnings(result.warnings, document.getElementById("itemsWarnings"));
  renderInventoryItemsList(result, itemsTarget);
}

async function initDocumentsReadOnly() {
  const documentsTarget = document.getElementById("documentsList");
  if (!documentsTarget || document.body?.dataset?.routeFile !== "bilag.html") return;

  const warnings = [];
  const context = await resolveReadOnlyContext(warnings);
  const result = await loadSupplierDocuments(context);
  result.warnings = [...warnings, ...result.warnings];
  renderSupplierDocumentsWarnings(result.warnings, document.getElementById("documentsWarnings"));
  renderSupplierDocumentsList(result, documentsTarget);
}

async function initReceiptsReadOnly() {
  const receiptsTarget = document.getElementById("receiptsList");
  if (!receiptsTarget || document.body?.dataset?.routeFile !== "varemodtagelse.html") return;

  const warnings = [];
  const context = await resolveReadOnlyContext(warnings);
  const result = await loadGoodsReceipts(context);
  result.warnings = [...warnings, ...result.warnings];
  renderGoodsReceiptsWarnings(result.warnings, document.getElementById("receiptsWarnings"));
  renderGoodsReceiptsList(result, receiptsTarget);
}

async function initCountsReadOnly() {
  const countsTarget = document.getElementById("countsList");
  if (!countsTarget || document.body?.dataset?.routeFile !== "optaelling.html") return;

  const warnings = [];
  const context = await resolveReadOnlyContext(warnings);
  const result = await loadInventoryCounts(context);
  result.warnings = [...warnings, ...result.warnings];
  renderInventoryCountsWarnings(result.warnings, document.getElementById("countsWarnings"));
  renderInventoryCountsList(result, countsTarget);
}

setAdapterStatus("platform", "Read-only stub klar");
setAdapterStatus("firestore", "Read-only stub klar - ikke forbundet");
setAdapterStatus("functions", "Read-only stub klar - write actions afvist");
renderRoutes();
renderNavigation();
renderCurrentRoute();
initDashboardReadOnly();
initItemsReadOnly();
initDocumentsReadOnly();
initReceiptsReadOnly();
initCountsReadOnly();

console.info("[lagerkontrol-staging] loaded", status);
