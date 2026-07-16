# Lagerkontrol API Contract

Status: staging contract. No new production callable is created in this phase.

## Existing callable

### `lagerProcessSupplierDocument`

Current live caller: `public/modules/lagerkontrol/lagerkontrol.js`.

Input:

```js
{
  companyId,
  locationId,
  supplierDocumentId
}
```

Expected behavior:

- validate Firebase Auth
- validate module access for `lagerkontrol`
- validate company/location access
- read `companies/{companyId}/supplier_documents/{supplierDocumentId}`
- update OCR/AI processing fields
- return a controlled status

## Future APIs

### `receiveGoods`

Registers a goods receipt, creates/updates batch data, updates stock and appends an inventory movement.

### `adjustStock`

Manual stock adjustment with reason, actor and immutable movement record.

### `countInventory`

Stores count rows and calculates differences against expected stock.

### `registerWaste`

Registers spillage/waste, decreases stock and appends movement.

### `getStockStatus`

Read API for current stock, low-stock status and valuation.

### `getCostPrice`

Read API for Menu/Opskrifter, Kalkulation and POS to fetch cost prices without reading private Lagerkontrol internals directly.

### `exportToAccounting`

Creates a controlled export or event for Bogføringsappen. It must not directly write private accounting documents without an accounting contract.

## Response shape

All future APIs should return:

```js
{
  ok: true,
  moduleId: "lagerkontrol",
  action: "receiveGoods",
  companyId,
  locationId,
  data: {}
}
```

Errors should use stable codes:

```js
{
  ok: false,
  code: "LAGER_ACCESS_DENIED",
  message: "Lagerkontrol er ikke aktiv for denne virksomhed eller lokation."
}
```

## Security rules

Every API must validate:

- Firebase Auth
- `companyId`
- `locationId`
- user role
- `lagerkontrol` entitlement
- document ownership/scope

Frontend entitlement checks are UX only; backend checks are required.
