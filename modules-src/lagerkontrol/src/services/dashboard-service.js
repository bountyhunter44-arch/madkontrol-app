import { getDashboardSummary } from "../adapters/firestore-adapter.js";

const EMPTY_SUMMARY = Object.freeze({
  ok: true,
  source: "empty",
  itemsCount: 0,
  activeBatchesCount: 0,
  recentCounts: [],
  recentMovements: [],
  recentSupplierDocuments: [],
  recentGoodsReceipts: [],
  warnings: []
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function createEmptyDashboardSummary(reason = "Ingen read-only data tilgængelig endnu.") {
  return {
    ...EMPTY_SUMMARY,
    warnings: reason ? [reason] : []
  };
}

export function normalizeDashboardSummary(raw = {}) {
  return {
    ok: raw.ok !== false,
    source: raw.source || "empty",
    itemsCount: Number(raw.itemsCount || 0),
    activeBatchesCount: Number(raw.activeBatchesCount || 0),
    recentCounts: asArray(raw.recentCounts),
    recentMovements: asArray(raw.recentMovements),
    recentSupplierDocuments: asArray(raw.recentSupplierDocuments),
    recentGoodsReceipts: asArray(raw.recentGoodsReceipts),
    warnings: asArray(raw.warnings)
  };
}

export async function loadDashboardSummary(context, options = {}) {
  if (options.mockSummary) {
    return normalizeDashboardSummary({
      ...options.mockSummary,
      source: "mock"
    });
  }

  if (!context?.companyId) {
    return createEmptyDashboardSummary("Dashboard read-only mangler companyId og viser tom staging-status.");
  }

  try {
    const summary = await getDashboardSummary(context);
    return normalizeDashboardSummary(summary);
  } catch (error) {
    return createEmptyDashboardSummary(`Dashboard read-only kunne ikke hente data: ${error?.message || error}`);
  }
}
