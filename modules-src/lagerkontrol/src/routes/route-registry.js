export const LAGER_ROUTE_STATUS = "shell-only";

export const lagerRoutes = Object.freeze([
  {
    id: "index",
    title: "Lagerkontrol oversigt",
    file: "index.html",
    purpose: "Staging entry, modulstatus og navigation til alle route-shells.",
    collections: [
      "inventory_items",
      "inventory_movements",
      "goods_receipts",
      "inventory_spillage",
      "inventory_counts",
      "inventory_reports",
      "pricing_indexes"
    ],
    readActions: ["showAdapterStatus", "showRouteParity"],
    disabledWriteActions: ["allProductionWrites"],
    apkRelevant: true,
    webRelevant: true,
    parityStatus: LAGER_ROUTE_STATUS
  },
  {
    id: "bilag",
    title: "Bilag",
    file: "bilag.html",
    purpose: "Upload og vis leverandørbilag til lagerdokumentation eller fremtidig bogføring.",
    collections: ["companies/{companyId}/supplier_documents"],
    readActions: ["listSupplierDocuments"],
    disabledWriteActions: ["uploadDocument", "markDocumentAsBooked", "processSupplierDocument"],
    apkRelevant: true,
    webRelevant: true,
    parityStatus: "readonly-list"
  },
  {
    id: "dashboard",
    title: "Dashboard",
    file: "dashboard.html",
    purpose: "Overblik over lagerstatus, KPI'er, bevægelser, lav lagerstand og hurtige handlinger.",
    collections: [
      "companies/{companyId}/inventory_items",
      "companies/{companyId}/inventory_movements",
      "companies/{companyId}/goods_receipts",
      "companies/{companyId}/inventory_spillage",
      "companies/{companyId}/inventory_counts",
      "companies/{companyId}/inventory_reports",
      "companies/{companyId}/pricing_indexes"
    ],
    readActions: ["getDashboardSummary", "getStockStatus", "listMovements", "listReports"],
    disabledWriteActions: ["createReceipt", "countInventory", "registerWaste", "saveIndexes"],
    apkRelevant: true,
    webRelevant: true,
    parityStatus: "readonly-summary"
  },
  {
    id: "optaelling",
    title: "Optælling",
    file: "optaelling.html",
    purpose: "Lageroptælling og differencer mod forventet lager.",
    collections: [
      "companies/{companyId}/inventory_counts",
      "companies/{companyId}/inventory_items",
      "companies/{companyId}/inventory_movements"
    ],
    readActions: ["getInventoryCounts", "getInventoryCountsList", "getInventoryItems"],
    disabledWriteActions: [
      "saveInventoryCount",
      "startInventoryCount",
      "finishInventoryCount",
      "adjustStockFromCount",
      "bookDifference",
      "correctStock",
      "createInventoryMovement",
      "updateBatch",
      "scanItems"
    ],
    apkRelevant: true,
    webRelevant: true,
    parityStatus: "readonly-list"
  },
  {
    id: "presentation",
    title: "Præsentation",
    file: "presentation.html",
    purpose: "Produktpræsentation og CTA til platformens onboarding eller launcher.",
    collections: [],
    readActions: ["showProductCopy"],
    disabledWriteActions: ["startCheckoutFromStaging"],
    apkRelevant: false,
    webRelevant: true,
    parityStatus: LAGER_ROUTE_STATUS
  },
  {
    id: "rapporter",
    title: "Rapporter",
    file: "rapporter.html",
    purpose: "Lager- og bevægelsesrapporter uden snapshot writes i staging.",
    collections: [
      "companies/{companyId}/inventory_reports",
      "companies/{companyId}/inventory_movements",
      "companies/{companyId}/inventory_items",
      "companies/{companyId}/inventory_spillage",
      "companies/{companyId}/goods_receipts"
    ],
    readActions: ["listReports", "listMovements", "getStockStatus"],
    disabledWriteActions: ["createReportSnapshot", "exportReport"],
    apkRelevant: false,
    webRelevant: true,
    parityStatus: LAGER_ROUTE_STATUS
  },
  {
    id: "settings",
    title: "Indstillinger",
    file: "settings.html",
    purpose: "Modulindstillinger, lokationsopsætning og prisindex.",
    collections: [
      "companies/{companyId}/inventory_settings",
      "companies/{companyId}/pricing_indexes"
    ],
    readActions: ["getInventorySettings"],
    disabledWriteActions: ["saveSettings", "saveIndexes"],
    apkRelevant: false,
    webRelevant: true,
    parityStatus: LAGER_ROUTE_STATUS
  },
  {
    id: "supplier-import",
    title: "Grossistimport",
    file: "supplier-import.html",
    purpose: "Import af grossistkatalog fra CSV/Excel i live runtime; kun shell i staging.",
    collections: [
      "supplier_profiles",
      "supplier_catalog_items",
      "supplier_catalog_imports"
    ],
    readActions: ["listSupplierProfiles", "listSupplierCatalogImports"],
    disabledWriteActions: ["importSupplierCatalogItems", "saveSupplierProfile"],
    apkRelevant: false,
    webRelevant: true,
    parityStatus: LAGER_ROUTE_STATUS
  },
  {
    id: "svind",
    title: "Svind",
    file: "svind.html",
    purpose: "Registrering og visning af svind.",
    collections: [
      "companies/{companyId}/inventory_spillage",
      "companies/{companyId}/inventory_items",
      "companies/{companyId}/inventory_movements"
    ],
    readActions: ["listWaste", "getInventoryItems"],
    disabledWriteActions: ["registerWaste", "adjustStockFromWaste"],
    apkRelevant: true,
    webRelevant: true,
    parityStatus: LAGER_ROUTE_STATUS
  },
  {
    id: "varebibliotek",
    title: "Varebibliotek",
    file: "varebibliotek.html",
    purpose: "Globalt varebibliotek og senere kopiering til virksomhedens lager.",
    collections: [
      "global_inventory_catalog",
      "companies/{companyId}/inventory_items"
    ],
    readActions: ["getGlobalInventoryCatalog", "getInventoryItems"],
    disabledWriteActions: ["copyCatalogItemToInventory", "saveInventoryItem"],
    apkRelevant: true,
    webRelevant: true,
    parityStatus: LAGER_ROUTE_STATUS
  },
  {
    id: "varemodtagelse",
    title: "Varemodtagelse",
    file: "varemodtagelse.html",
    purpose: "Modtag varer, opret batches, dokumentation og bevægelseslog.",
    collections: [
      "companies/{companyId}/inventory_items",
      "companies/{companyId}/inventory_batches",
      "companies/{companyId}/goods_receipts",
      "companies/{companyId}/supplier_documents",
      "companies/{companyId}/inventory_movements"
    ],
    readActions: ["getInventoryItems", "getGoodsReceipts", "getGoodsReceiptsList", "getSupplierDocuments"],
    disabledWriteActions: [
      "lagerReceiveGoods",
      "receiveGoods",
      "createBatch",
      "bookReceipt",
      "uploadReceiptDocument",
      "scanReceiptDocument",
      "addMovement"
    ],
    apkRelevant: true,
    webRelevant: true,
    parityStatus: "readonly-list"
  },
  {
    id: "varer",
    title: "Varer",
    file: "varer.html",
    purpose: "Vareoprettelse og vedligeholdelse af lageritems.",
    collections: ["companies/{companyId}/inventory_items"],
    readActions: ["getInventoryItems"],
    disabledWriteActions: ["saveInventoryItem", "editInventoryItem", "archiveInventoryItem"],
    apkRelevant: true,
    webRelevant: true,
    parityStatus: "readonly-list"
  }
]);

export function getAllLagerRoutes() {
  return [...lagerRoutes];
}
