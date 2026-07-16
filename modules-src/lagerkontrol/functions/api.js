function notImplemented(action) {
  throw new Error(`${action} is not implemented in Lagerkontrol staging`);
}

export function createLagerApi() {
  return {
    processSupplierDocument,
    receiveGoods,
    adjustStock,
    countInventory,
    registerWaste,
    getStockStatus,
    getCostPrice,
    exportToAccounting
  };
}

export async function processSupplierDocument() {
  notImplemented("processSupplierDocument");
}

export async function receiveGoods() {
  notImplemented("receiveGoods");
}

export async function adjustStock() {
  notImplemented("adjustStock");
}

export async function countInventory() {
  notImplemented("countInventory");
}

export async function registerWaste() {
  notImplemented("registerWaste");
}

export async function getStockStatus() {
  notImplemented("getStockStatus");
}

export async function getCostPrice() {
  notImplemented("getCostPrice");
}

export async function exportToAccounting() {
  notImplemented("exportToAccounting");
}
