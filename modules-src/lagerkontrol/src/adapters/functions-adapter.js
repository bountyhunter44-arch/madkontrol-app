const READ_ONLY_ACTIONS = Object.freeze([
  "getStockStatus",
  "getCostPrice",
  "listSupplierDocuments"
]);

const WRITE_ACTIONS = Object.freeze([
  "lagerProcessSupplierDocument",
  "processSupplierDocument",
  "receiveGoods",
  "adjustStock",
  "countInventory",
  "registerWaste",
  "exportToAccounting"
]);

export const LAGER_CALLABLES = Object.freeze({
  processSupplierDocument: "lagerProcessSupplierDocument"
});

export function listAvailableActions() {
  return [...READ_ONLY_ACTIONS];
}

export function assertReadOnlyAction(action) {
  const normalized = String(action || "").trim();
  if (!normalized || WRITE_ACTIONS.includes(normalized) || !READ_ONLY_ACTIONS.includes(normalized)) {
    throw new Error("Denne handling er slået fra i staging read-only.");
  }
  return normalized;
}

export async function callLagerApi(action, payload = {}, options = {}) {
  const safeAction = assertReadOnlyAction(action);
  const reader = options.readOnlyApi || globalThis?.MadkontrollenLagerReadOnlyApi || null;
  if (!reader || typeof reader.call !== "function") {
    return {
      ok: false,
      status: "not_connected",
      action: safeAction,
      payload,
      readOnly: true,
      message: "Functions read-only adapter er ikke forbundet i staging."
    };
  }
  const data = await reader.call(safeAction, payload, { readOnly: true });
  return {
    ok: true,
    status: "ok",
    action: safeAction,
    readOnly: true,
    data
  };
}
