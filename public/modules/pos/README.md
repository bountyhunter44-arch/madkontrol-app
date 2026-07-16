# Madkontrollen POS

Madkontrollen POS er et selvstændigt frontend-modul til simpel kassebetjening, bon-print, moms, kreditnota og kasseafstemning.

## Sider

- `/index.html` - kasse, kurv, rabat, betalingsvalg og bon-print på POS-subdomænet.
- `/create-product.html` - opret produkter med pris inkl. moms, kategori og billede-URL.
- `/edit-product.html` - ret varenavn, pris inkl. moms, kategori og billede-URL.
- `/delete-product.html` - slet/inaktiver produkter i Firestore.
- `/sales-report.html` - dagens salg, moms, kasseafstemning, betalingsafstemning og revisorpakke.

## Betalingsudbyder-neutral v1

POS v1 registrerer salget og dokumentationen. Selve betalingen håndteres uden for POS af den valgte betalingsvej.

Understøttede betalingsmetoder:

- Kontant
- MobilePay
- Tap to Pay / kortterminal
- Revolut
- Wise betalingslink
- Stripe
- Zettle / PayPal Reader
- Bankoverførsel
- Andet

Tap to Pay, Revolut, Wise og Stripe er ikke direkte API-integrationer i v1. De gemmes som betalingsmetode, udbyder, reference/transaktions-ID, settlement-konto og afstemningsstatus.

Zettle / PayPal Reader er forberedt som fysisk terminal-flow. Første version bruger manuel reference: sælger tager betalingen på Zettle/PayPal Reader og trykker først `Betaling modtaget`, når terminalen har godkendt betalingen. Derefter bogfører POS salget i Firestore og viser bon. Kortdata håndteres af PayPal/Zettle, ikke af Madkontrollen POS.

Wise første fase er betalingslink og efterfølgende afstemning. Revolut første fase er terminal/link/reference og efterfølgende afstemning. Direkte API-integration kan komme senere.

Reader Connect næste fase kræver Zettle/PayPal developer adgang, OAuth client/scopes, reader linking, WebSocket session og payment request flow. Der er ingen API-nøgler eller secrets i public frontend, og Reader Connect-functions returnerer tydeligt, at integrationen ikke er aktiveret endnu.

`ZETTLE_READER_LINK_ID` er ikke et globalt secret. Når en reader senere er linket til merchant/kontoen, gemmes terminalvalget pr. lokation:

```text
companies/{companyId}/locations/{locationId}/pos_settings/zettle
```

```js
{
  provider: "zettle",
  readerConnectEnabled: true,
  readerLinkId,
  readerLabel,
  updatedAt
}
```

## Payment model

Hvert salg gemmer:

```js
payment: {
  method,
  provider,
  externalTransactionId,
  settlementAccountType,
  settlementAccountLabel,
  reconciliationStatus,
  settledAt,
  note
}
```

Kontant påvirker kontant kasse. Ikke-kontante betalinger påvirker ikke kontant kasse og kan afstemmes senere på salgsrapporten.

## Data

Firestore er sandhedskilde for POS v1, scoped til `companyId` og `locationId` fra quick-onboarding/company-context.

```text
companies/{companyId}/locations/{locationId}/pos_products/{productId}
companies/{companyId}/locations/{locationId}/pos_sales/{saleId}
companies/{companyId}/locations/{locationId}/pos_cash_sessions/{sessionId}
companies/{companyId}/locations/{locationId}/pos_audit_log/{auditId}
companies/{companyId}/locations/{locationId}/pos_receipt_sequences/main
companies/{companyId}/locations/{locationId}/pos_payment_reconciliations/{reconciliationId}
companies/{companyId}/locations/{locationId}/pos_payment_sessions/{paymentSessionId}
companies/{companyId}/locations/{locationId}/pos_settings/main
companies/{companyId}/locations/{locationId}/pos_settings/zettle
```

`localStorage` bruges kun som midlertidig cache/offline draft og til migration fra prototypen:

```text
pos_products
pos_sales
pos_reconciliations
pos_receipt_sequence
pos_cash_sessions
pos_audit_log
pos_localStorage_backup_{timestamp}
```

Hvert salg får fortløbende bonnummer via Firestore transaction, momsberegning, `businessSnapshot`, `vatSummary`, `payment` og auditlog-entry. Salg slettes ikke; korrektion sker via kreditnota med eget bonnummer. Ikke-kontante salg opretter en post til senere betalingsafstemning.

Produktdata kan indeholde kategori og Cloudinary-billede:

```js
{
  category: "Mad" | "Drikke" | "Tilbehør" | "Dessert" | "Andet",
  priceIncVat,
  vatRate,
  active,
  image: {
    provider: "cloudinary",
    cloudinaryPublicId,
    secureUrl,
    thumbnailUrl,
    width,
    height,
    format,
    alt,
    source: "generated" | "uploaded" | "selected" | "google_places",
    prompt,
    generatedAt,
    updatedAt
  },
  imageUrl,
  imageAlt
}
```

Kassesiden viser `product.image.thumbnailUrl` eller `product.image.secureUrl`, eller en pæn placeholder hvis billede mangler. `imageUrl` er kun bagudkompatibel fallback. Nye salg snapshotter kategori og Cloudinary-billede på hver salgslinje, så gamle bilag ikke ændrer udseende, hvis produktet senere får nyt billede.

Kassesiden har et sælger-dashboard med omsætning i dag, 7-dages omsætningsgraf og salg fordelt på kategorier. Tallene beregnes fra `pos_sales`; kreditnotaer modregnes, og kun aktive/bogførte salg tæller med.

## POS produktbilleder

Produktbilleder håndteres via Cloudinary og samme principper som SEO-billedflowet:

- onboarding/company context bruges til prompten
- Google Places metadata bruges som kontekst, hvis den allerede findes på company/location
- billedet genereres uden tekst, logoer, vandmærker eller tredjeparts-varemærker
- billedet gemmes som Cloudinary asset med `cloudinaryPublicId`, `secureUrl` og `thumbnailUrl`
- samme asset kan senere genbruges i POS, menu/opskrifter og SEO landingpages

Backend-callable:

```text
generatePosProductImage
```

Den ligger i `functions/pos/product-images.js` og bruger:

```text
OPENAI_API_KEY
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
FUNCTIONS_CONFIG_EXPORT
```

Cloudinary secrets bruges kun i Functions. Public frontend bruger enten den nye generator eller den eksisterende `getCloudinarySignature` til sikker upload.

`businessSnapshot` indeholder rene virksomhedsdata som navn, CVR, adresse, postnummer, by, land, telefon og email. Momsprocent og momsbeløb ligger i `vatSummary` og på linjerne, ikke i business-blokken.

Salgsrapporten normaliserer både gamle lokale salg og nye Firestore-salg til samme rapportformat. Ældre lokale salg markeres som legacy. Knappen `Eksportér til revisor` åbner en modal, hvor brugeren vælger periode og materialetyper og derefter henter en printbar revisorpakke.

Revisorpakken er almindeligt bogholdermateriale og kan printes eller gemmes som PDF fra browseren. Den kan indeholde dagsrapporter, salgsrapporter, boner/bilag, kreditnotaer, betalingsafstemning og kasseafstemninger. Hvis CVR mangler, står der `CVR mangler`, og salgsrapporten viser handlingen `Tilføj CVR`.

Zettle payment sessions gemmer kun status, beløb, valuta, provider, reference, readerLinkId og salgsdraft. POS gemmer ikke kortnummer, PAN, CVC, udløbsdato eller rå NFC-data.

## Zettle/PayPal backend payment adapter

POS opretter nu Zettle-salg som Firestore-salg med `status: "draft"` og kalder derefter callable `posCreateZettlePayment`.
Callablen validerer auth, companyId/locationId, POS-adgang og saleId, læser Zettle/PayPal credentials på serveren og opdaterer salget til:

```js
{
  status: "pending_payment",
  paymentProvider: "zettle",
  paymentStatus: "pending" // eller "unavailable", hvis credentials/endpoint mangler
}
```

Adapteren ligger i `functions/pos/payments/` og implementerer en sikker Zettle-stub, indtil Reader Connect endpoint, OAuth scopes og reader-payment payload er bekræftet. Stubben returnerer aldrig `paid` og markerer aldrig automatisk succes.

Manuel fallback går via callable `posMarkSalePaidManually`, er begrænset til superadmin/admin på backend og logger `manualPayment: true` i både salg, `pos_payments` og auditlog.

## Deploy

Modulet ligger under den eksisterende Firebase Hosting public path:

```text
POS hosting root
```

Zettle-forberedelsen og POS produktbillede-generatoren bruger Functions. Produktbillede-UI er Hosting, og billedgenerering kræver Functions deploy.

```bash
firebase deploy --only hosting:madkontrollen,functions,firestore:rules
```
