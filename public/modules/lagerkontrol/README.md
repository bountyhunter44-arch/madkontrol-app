# Lagerkontrol Pro

Lagerkontrol Pro er et AI-ready lager- og driftsmodul til Madkontrollen.

Filosofi: **Registrer en gang - genbrug data overalt.**

## V1 indeholder

- Vareregister for kolonial, kol, frost, bar/alkohol, rengoring, emballage og forbrugsvarer.
- Varemodtagelse med foto/fragtbrev/faktura upload og HACCP bridge metadata.
- Intelligent produktforslag ved ukendt produkt.
- Periodebaseret optaelling.
- Svindregistrering med okonomisk vaerdi.
- Prisindex sliders og simpel menu-kalkulation.
- Rapporter og revisionsspor fra inventory_movements.
- Grossistkatalog import fra CSV/Excel til `supplier_catalog_items`.

## Genbrug

- `db` og `storage` fra `/core/firebase-config.js`
- audit helpers fra `/core/auditFields.js`
- `normalizeInventoryQuantity()` fra `/core/inventory-quantity.js`
- Firebase Auth via lokal Lagerkontrol Pro auth guard

## Enhedsmodel

Alle varer gemmer både original input og normaliseret mængde:

```json
{
  "unitType": "weight|volume|count",
  "baseUnit": "g|ml|stk",
  "packageUnit": "flasker",
  "packageSize": 800,
  "packageSizeUnit": "g",
  "quantity": 10,
  "normalizedQuantity": 8000,
  "normalizedUnit": "g"
}
```

Kalkulation, vareforbrug, spild, rapporter og økonomiske beregninger skal bruge `normalizedQuantity` + `normalizedUnit`.

## Firestore contract

Alle dokumenter scopes under:

```text
companies/{companyId}/{collection}/{docId}
```

Alle writes indeholder:

- `companyId`
- `locationId`
- `createdAt`
- `updatedAt`
- `createdBy`
- audit display fields via audit helper

Grossistkatalog import er en bevidst undtagelse fra company-subcollection-mønstret:

```text
supplier_profiles
supplier_catalog_items
supplier_catalog_imports
```

Importen skriver ikke til `global_inventory_catalog` eller `companies/{companyId}/inventory_items`.
Grossistdata ligger i `supplier_catalog_items`, så virksomheder senere kan vælge "Tilføj til mit lager".

## AI/OCR pipeline

V1 gemmer `supplier_documents` med `ocrStatus: "pending"` og et manuelt rettet `ocrExtracted` objekt.
Naeste fase kan tilfoje en Cloud Function, der behandler uploadede dokumenter og opdaterer samme doc.
