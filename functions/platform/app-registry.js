"use strict";

const ACTIVE = "active";
const PLANNED = "planned";

function app(entry) {
  return {
    standalone: true,
    canActAsShell: false,
    requiredRoles: ["owner", "hq_admin", "admin", "manager"],
    providesContracts: [],
    consumesContracts: [],
    relatedApps: [],
    ownsCollections: [],
    ownsFunctions: [],
    demoContentAllowed: true,
    ...entry
  };
}

const PLATFORM_APP_REGISTRY = [
  app({
    appKey: "madkontrollen-core",
    name: "Madkontrollen Core",
    description: "Auth, company/location context and shared shell services.",
    group: "core",
    entryUrl: "/dashboard.html",
    canActAsShell: true,
    status: ACTIVE,
    requiredEntitlement: "core",
    requiredRoles: ["owner", "hq_admin", "admin", "manager", "employee"],
    providesContracts: ["platform.context", "platform.entitlements", "platform.launcher"],
    provides: ["company_profile", "company_context", "active_modules"],
    consumes: [],
    optionalIntegrations: ["seo", "pos", "menu", "recipes", "lagerkontrol", "egenkontrol", "crm"],
    relatedApps: ["seo", "menu", "recipes", "calculation", "ordering", "ops-center"],
    ownsCollections: ["users", "organizations", "companies", "locations"]
  }),
  app({
    appKey: "seo",
    name: "SEO",
    description: "SEO generator and landingpage deploy.",
    group: "growth",
    entryUrl: "/modules/seo/index.html",
    status: ACTIVE,
    requiredEntitlement: "seo",
    requiredRoles: ["owner", "hq_admin", "admin"],
    providesContracts: ["seo.content"],
    consumesContracts: ["platform.context", "menu.catalog", "recipe.catalog"],
    provides: ["seo_sites", "landing_pages"],
    consumes: ["company_profile", "services", "menu_items"],
    optionalIntegrations: ["menu", "recipes", "crm"],
    relatedApps: ["menu", "recipes", "ordering", "crm"],
    ownsCollections: ["seo_generator_configs", "websites", "seo_pages", "seo_hero_images"],
    ownsFunctions: ["saveSeoGeneratorConfig", "adminActivateSeoSite", "searchGooglePlacesForSeo"]
  }),
  app({
    appKey: "menu",
    name: "Menu & Retter",
    description: "Menu items and categories.",
    group: "food",
    entryUrl: "/modules/menu/index.html",
    status: ACTIVE,
    requiredEntitlement: "menu",
    providesContracts: ["menu.catalog"],
    consumesContracts: ["platform.context", "recipe.catalog", "calculation.costing", "seo.content", "ordering.cart"],
    provides: ["menu_items", "menu_categories"],
    consumes: ["company_profile", "recipes", "inventory_items"],
    optionalIntegrations: ["recipes", "calculation", "seo", "lagerkontrol", "ordering"],
    relatedApps: ["recipes", "calculation", "seo", "ordering"],
    ownsCollections: ["menu_items", "menu_categories"]
  }),
  app({ appKey: "recipes", name: "Opskrifter", description: "Recipe structures.", group: "food", entryUrl: "/modules/menu/recipes.html", status: ACTIVE, requiredEntitlement: "recipes", providesContracts: ["recipe.catalog"], consumesContracts: ["platform.context", "menu.catalog", "ingredients.catalog", "calculation.costing", "seo.content"], provides: ["recipes", "menu_items"], consumes: ["company_profile", "inventory_items"], optionalIntegrations: ["menu", "calculation", "seo", "lagerkontrol"], relatedApps: ["menu", "calculation", "seo"], ownsCollections: ["recipes", "recipe_ingredients"], demoContentAllowed: false }),
  app({ appKey: "calculation", name: "Kalkulation", description: "Food cost and margin calculations.", group: "finance", entryUrl: "/apps/calculation/index.html", status: ACTIVE, requiredEntitlement: "calculation", providesContracts: ["calculation.costing"], consumesContracts: ["menu.catalog", "recipe.catalog", "ingredients.catalog"], relatedApps: ["menu", "recipes", "purchasing", "suppliers"], ownsCollections: ["calculation_reports", "calculation_snapshots"], demoContentAllowed: false }),
  app({ appKey: "pos", name: "POS", description: "Kasse, produktstyring og bon-print.", group: "commerce", entryUrl: "/modules/pos/index.html", status: ACTIVE, requiredEntitlement: "pos", requiredRoles: ["owner", "hq_admin", "admin", "manager", "employee"], providesContracts: ["pos.sales", "pos.products"], consumesContracts: ["platform.context", "menu.catalog", "recipe.catalog"], provides: ["sales", "receipts", "cash_sessions"], consumes: ["company_profile", "products", "recipes"], optionalIntegrations: ["menu", "recipes", "receipts", "vat"], relatedApps: ["menu", "recipes", "receipts", "vat"], ownsCollections: [] }),
  app({ appKey: "lagerkontrol", name: "Lagerkontrol", description: "Varer, optælling og lagerbevægelser.", group: "operations", entryUrl: "/modules/lagerkontrol/index.html", status: ACTIVE, requiredEntitlement: "lagerkontrol", requiredRoles: ["owner", "hq_admin", "admin", "manager", "employee"], providesContracts: ["inventory.catalog"], consumesContracts: ["platform.context"], provides: ["inventory_items", "inventory_movements"], consumes: ["company_profile"], optionalIntegrations: ["menu", "recipes", "pos"], relatedApps: ["menu", "recipes", "pos"], ownsCollections: ["companies/{companyId}/inventory_items", "companies/{companyId}/inventory_movements", "companies/{companyId}/goods_receipts"] }),
  app({ appKey: "egenkontrol", name: "Egenkontrol", description: "Rutiner, risikoanalyse og rapporter.", group: "operations", entryUrl: "/modules/egenkontrol/front.html", status: ACTIVE, requiredEntitlement: "egenkontrol", requiredRoles: ["owner", "hq_admin", "admin", "manager", "employee"], providesContracts: ["egenkontrol.program"], consumesContracts: ["platform.context"], provides: ["routines", "risk_analysis", "control_reports"], consumes: ["company_profile"], optionalIntegrations: ["lagerkontrol", "pos"], relatedApps: ["lagerkontrol", "pos"], ownsCollections: ["companies/{companyId}/locations/{locationId}/risk_analysis", "task_instances"], ownsFunctions: ["generateRisksForLocation", "generateTemplatesForLocation"] }),
  app({ appKey: "crm", name: "CRM", description: "Prospects, CVR-berigelse og kundelister.", group: "growth", entryUrl: "/modules/crm/prospects.html", status: ACTIVE, requiredEntitlement: "crm", requiredRoles: ["owner", "hq_admin", "admin"], providesContracts: ["crm.prospects"], consumesContracts: ["platform.context"], provides: ["prospects", "customers"], consumes: ["company_profile", "companyId"], optionalIntegrations: ["seo", "egenkontrol"], relatedApps: ["seo", "egenkontrol"], ownsCollections: ["crm_prospects", "crm_food_businesses"], ownsFunctions: ["enrichNextCvrBatch"] }),
  app({ appKey: "koerselskontrol", name: "Kørekontrol", description: "GPS-kørebog, kilometertæller og rapporter.", group: "finance", entryUrl: "/modules/koerselskontrol/index.html", status: ACTIVE, requiredEntitlement: "koerselskontrol", requiredRoles: ["owner", "hq_admin", "admin", "manager"], providesContracts: ["driving.logbook"], consumesContracts: ["platform.context"], provides: ["driving_logs", "mileage_reports"], consumes: ["company_profile"], optionalIntegrations: ["accounting"], relatedApps: ["accounting"], ownsCollections: ["driving_logs", "mileage_reports"] }),
  app({ appKey: "accounting", name: "Bogføring", description: "Banktransaktioner, leverandører, bilag og bogføringsforslag.", group: "finance", entryUrl: "/modules/accounting/bilag.html", status: ACTIVE, requiredEntitlement: "bogforing", requiredRoles: ["owner", "hq_admin", "admin"], providesContracts: ["accounting.entries"], consumesContracts: ["platform.context", "pos.sales", "receipts.documents"], provides: ["accounting_suggestions", "supplier_bills"], consumes: ["company_profile", "receipts", "pos_sales"], optionalIntegrations: ["pos", "koerselskontrol"], relatedApps: ["pos", "receipts", "koerselskontrol"], ownsCollections: ["accounting_entries", "accounting_suggestions"] }),
  app({ appKey: "ordering", name: "Bestilling", description: "Cart and order drafts.", group: "commerce", entryUrl: "/apps/ordering/index.html", status: PLANNED, requiredEntitlement: "ordering", requiredRoles: ["owner", "hq_admin", "admin", "manager", "employee"], providesContracts: ["ordering.cart"], consumesContracts: ["menu.catalog"], relatedApps: ["menu", "delefragt", "invoices"], ownsCollections: ["orders", "carts"] }),
  app({ appKey: "delefragt", name: "DeleFragt", description: "Delivery orchestration.", group: "logistics", entryUrl: "/apps/delefragt/index.html", status: PLANNED, requiredEntitlement: "delefragt", providesContracts: ["delivery.shipments"], consumesContracts: ["ordering.cart"], relatedApps: ["ordering", "suppliers"], ownsCollections: ["deliveries"] }),
  app({ appKey: "invoices", name: "Faktura/Tilbud", description: "Offers and invoices.", group: "finance", entryUrl: "/apps/invoices/index.html", status: PLANNED, requiredEntitlement: "invoices", requiredRoles: ["owner", "hq_admin", "admin"], providesContracts: ["invoice.billing"], consumesContracts: ["ordering.cart", "events.booking"], relatedApps: ["ordering", "events", "vat", "receipts"], ownsCollections: ["offers", "invoices"] }),
  app({ appKey: "vat", name: "Moms", description: "VAT summaries.", group: "finance", entryUrl: "/apps/vat/index.html", status: PLANNED, requiredEntitlement: "vat", requiredRoles: ["owner", "hq_admin", "admin"], providesContracts: ["vat.reporting"], consumesContracts: ["invoice.billing", "receipts.documents"], relatedApps: ["invoices", "receipts"], ownsCollections: ["vat_periods"], demoContentAllowed: false }),
  app({ appKey: "receipts", name: "Bilag", description: "Receipt documents.", group: "finance", entryUrl: "/apps/receipts/index.html", status: PLANNED, requiredEntitlement: "receipts", providesContracts: ["receipts.documents"], consumesContracts: ["vat.reporting", "purchasing.orders"], relatedApps: ["vat", "purchasing", "suppliers"], ownsCollections: ["receipts"], demoContentAllowed: false }),
  app({ appKey: "purchasing", name: "Indkob", description: "Purchase orders.", group: "procurement", entryUrl: "/apps/purchasing/index.html", status: PLANNED, requiredEntitlement: "purchasing", providesContracts: ["purchasing.orders"], consumesContracts: ["suppliers.catalog", "ingredients.catalog"], relatedApps: ["suppliers", "ingredients", "receipts"], ownsCollections: ["purchase_orders"] }),
  app({ appKey: "suppliers", name: "Leverandorer", description: "Supplier catalog.", group: "procurement", entryUrl: "/apps/suppliers/index.html", status: PLANNED, requiredEntitlement: "suppliers", providesContracts: ["suppliers.catalog"], relatedApps: ["purchasing", "ingredients", "delefragt"], ownsCollections: ["suppliers"] }),
  app({ appKey: "ingredients", name: "Ravarer", description: "Ingredient catalog.", group: "food", entryUrl: "/apps/ingredients/index.html", status: PLANNED, requiredEntitlement: "ingredients", providesContracts: ["ingredients.catalog"], consumesContracts: ["suppliers.catalog"], relatedApps: ["recipes", "calculation", "suppliers"], ownsCollections: ["ingredients"] }),
  app({ appKey: "events", name: "Events", description: "Event and catering planning.", group: "commerce", entryUrl: "/apps/events/index.html", status: PLANNED, requiredEntitlement: "events", providesContracts: ["events.booking"], consumesContracts: ["menu.catalog", "invoice.billing"], relatedApps: ["menu", "invoices", "ordering"], ownsCollections: ["events"] }),
  app({ appKey: "sensors", name: "Sensorer", description: "Sensor telemetry.", group: "operations", entryUrl: "/apps/sensors/index.html", status: PLANNED, requiredEntitlement: "sensors", providesContracts: ["sensors.telemetry"], consumesContracts: ["maintenance.tasks"], relatedApps: ["maintenance"], ownsCollections: ["sensor_readings", "sensors"] }),
  app({ appKey: "maintenance", name: "Vedligehold", description: "Maintenance tasks.", group: "operations", entryUrl: "/apps/maintenance/index.html", status: PLANNED, requiredEntitlement: "maintenance", providesContracts: ["maintenance.tasks"], consumesContracts: ["sensors.telemetry"], relatedApps: ["sensors"], ownsCollections: ["maintenance_tasks"] }),
  app({ appKey: "academy", name: "Academy", description: "Training and guides.", group: "learning", entryUrl: "/apps/academy/index.html", status: PLANNED, requiredEntitlement: "academy", requiredRoles: ["owner", "hq_admin", "admin", "manager", "employee"], providesContracts: ["academy.learning"], ownsCollections: ["academy_lessons", "academy_progress"] }),
  app({ appKey: "ops-center", name: "Ops Center", description: "VPS operations.", group: "operations", entryUrl: "/admin/ops.html", status: ACTIVE, requiredEntitlement: "ops-center", requiredRoles: ["owner", "hq_admin", "admin"], providesContracts: ["ops.events"], relatedApps: ["seo", "madkontrollen-core"], ownsCollections: ["ops_events"], demoContentAllowed: false })
];

function getAppRegistry() {
  return PLATFORM_APP_REGISTRY.map((entry) => ({ ...entry }));
}

function getAppByKey(appKey) {
  return PLATFORM_APP_REGISTRY.find((entry) => entry.appKey === String(appKey || "")) || null;
}

module.exports = {
  PLATFORM_APP_REGISTRY,
  getAppRegistry,
  getAppByKey
};
