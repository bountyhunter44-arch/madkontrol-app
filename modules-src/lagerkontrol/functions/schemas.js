export const LAGERKONTROL_API_ACTIONS = Object.freeze([
  "lagerProcessSupplierDocument",
  "receiveGoods",
  "adjustStock",
  "countInventory",
  "registerWaste",
  "getStockStatus",
  "getCostPrice",
  "exportToAccounting"
]);

export const LAGERKONTROL_COLLECTIONS = Object.freeze([
  "global_inventory_catalog",
  "supplier_profiles",
  "supplier_catalog_items",
  "supplier_catalog_imports",
  "companies/{companyId}/inventory_items",
  "companies/{companyId}/inventory_batches",
  "companies/{companyId}/inventory_counts",
  "companies/{companyId}/inventory_movements",
  "companies/{companyId}/inventory_spillage",
  "companies/{companyId}/supplier_documents",
  "companies/{companyId}/goods_receipts",
  "companies/{companyId}/inventory_reports",
  "companies/{companyId}/inventory_settings",
  "companies/{companyId}/menu_cost_profiles",
  "companies/{companyId}/pricing_indexes"
]);
