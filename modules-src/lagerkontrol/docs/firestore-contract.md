# Lagerkontrol Firestore Contract

Status: staging contract. Live runtime is still `public/modules/lagerkontrol`.

## Scope

Most Lagerkontrol documents are company-scoped:

```text
companies/{companyId}/{collection}/{docId}
```

The current live runtime also carries `locationId` inside documents and uses it for filtering/context. A later migration may move high-volume operational data to:

```text
companies/{companyId}/locations/{locationId}/{collection}/{docId}
```

That path change must not happen without a separate migration and compatibility read layer.

## Collections

### `inventory_items`

Company inventory item master data.

Expected fields include product name, category, unit model, normalized quantity, current quantity, purchase price, supplier, par level, active status and audit fields.

### `inventory_batches`

Goods receipt batches with remaining quantity, batch/date metadata, supplier, price and optional photo/document links.

### `inventory_counts`

Inventory count rows with counted quantity, expected quantity, difference and audit fields.

### `inventory_movements`

Append-only movement log for receipts, waste, manual adjustments and future POS consumption events.

### `inventory_spillage`

Waste/spillage records with item, quantity, normalized quantity, value, type and reason.

### `supplier_documents`

Uploaded supplier invoices/documents. Current live runtime stores booking status, OCR status, file URL and optional extracted values.

### `goods_receipts`

Receipt records connected to items and batches. Current runtime may include HACCP metadata for varemodtagelse, but Egenkontrol must only consume that through an API/event contract.

### `inventory_reports`

Report snapshots and future exports for stock, movement, waste and cost status.

### `inventory_settings`

Module settings per company/location.

### `menu_cost_profiles`

Cost profile read model for Menu/Opskrifter and Kalkulation.

### `pricing_indexes`

Price index settings such as raw material, energy, transport, fuel and labor indexes.

## Global supplier/catalog collections

Current runtime uses these root collections:

```text
global_inventory_catalog
supplier_profiles
supplier_catalog_items
supplier_catalog_imports
```

These are shared/reference collections. They must stay read-safe and must not mix customer-private stock with supplier catalog data.

## Storage paths

Current upload path:

```text
companies/{companyId}/lagerkontrol/{locationId}/{kind}/{timestamp}-{fileName}
```

Storage writes must be validated server-side or by rules before production extraction into a separate module.
