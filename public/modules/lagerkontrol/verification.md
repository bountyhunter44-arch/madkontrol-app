# Lagerkontrol Pro verification

## Syntax

```bash
node --check public/modules/lagerkontrol/lagerkontrol.js
node --check public/core/inventory-quantity.js
```

## Manual smoke-test

1. Aabn `/modules/lagerkontrol/index.html`.
2. Bekraeft at siden kun viser Lagerkontrol Pro shell og ikke Madkontrollen topbar/sidebar.
3. Opret en vare paa `/modules/lagerkontrol/varer.html`.
   - Test: `10 flasker x 800 g` viser `8000 g (8 kg)`.
   - Test: `4 kasser x 24 stk x 33 cl` viser samlet liter/cl.
4. Lav en varemodtagelse paa `/modules/lagerkontrol/varemodtagelse.html`.
5. Bekraeft at varen opdaterer beholdning.
6. Lav en optaelling paa `/modules/lagerkontrol/optaelling.html`.
7. Registrer svind paa `/modules/lagerkontrol/svind.html`.
8. Se dashboard og rapporter.

## Firestore smoke-test

Kontroller at dokumenter oprettes under:

```text
companies/{companyId}/inventory_items
companies/{companyId}/goods_receipts
companies/{companyId}/inventory_counts
companies/{companyId}/inventory_spillage
companies/{companyId}/inventory_movements
```

## Rules note

V1 kraever, at eksisterende company-scoped rules tillader authenticated users med adgang til `companyId` at laese/skrive disse subcollections.
