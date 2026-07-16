# Madkontrollen Platform Contract

## Formål

Madkontrollen er en modulplatform. Platformen skal præsentere, sælge og give adgang til selvstændige moduler, men den skal ikke være permanent runtime-container for alle modulprodukter.

POS er reference for fremtidige selvstændige modulprojekter med egen web-runtime og Android APK.

## Platformens ansvar

- Showroom og hovedforside for Madkontrollen.
- Login og Firebase Auth.
- Company context: `companyId`.
- Location context: `locationId`.
- Module entitlements og adgangsstyring.
- Checkout og onboarding-flow.
- Dashboard og launcher til købte/aktive moduler.
- Links til modulernes web-apps, APK-downloads og præsentationssider.
- Compatibility redirects for gamle `/modules/...` routes, så eksisterende kunder ikke mister adgang under migration.

## Modulernes ansvar

- Egen web-runtime.
- Egen Android/Capacitor APK hvor det giver mening.
- Egne assets, build scripts, tests og dokumentation.
- Egne backend functions hvor modulet har serverlogik.
- Integration til platformen via dokumenterede API-, context-, Firestore- og callable-kontrakter.
- Egen adgangskontrol baseret på platformens auth, `companyId`, `locationId` og entitlements.

## Integrationsregler

Moduler må integrere via:

- Firebase Auth.
- `companyId`.
- `locationId`.
- Entitlements/module access.
- Firestore/API-kontrakter.
- Callable functions.
- Webhooks/events.

Moduler må ikke integrere ved:

- At kræve Egenkontrol som baseprodukt.
- At kopiere runtime-filer tilbage ind i `D:\madkontrol-app\modules` som permanent source of truth.
- At have skjulte runtime-afhængigheder mellem moduler.
- At blande al modulserverlogik direkte i `functions/index.js`.
- At hardcode gamle `/modules/...` runtime-links som eneste adgangsvej.

## Modulvalg

Egenkontrol er ét modul blandt flere.

Ingen moduler må kræve Egenkontrol som base. Kunden skal kunne vælge og købe:

- POS alene.
- Lagerkontrol alene.
- Bogføringsappen alene.
- SEO Automatik alene.
- Menu/QR alene.
- Egenkontrol alene.
- Flere moduler samlet.

Et onboarding- eller checkout-flow skal derfor afvise tomt modulvalg, men må ikke automatisk tilføje Egenkontrol.

## Referenceprojekter

Nuværende reference:

- `D:\madkontrol-pos` - POS web-runtime og Android/Capacitor APK.

Planlagte modulprojekter:

- `D:\madkontrol-lagerkontrol`
- `D:\madkontrol-bogforing`
- `D:\madkontrol-egenkontrol`
- `D:\madkontrol-menu`
- `D:\madkontrol-seo`

