# Madkontrollen Module Isolation Plan

Status: arkitekturplan og første modulstruktur. Ingen runtime-kode er ændret i denne fase.

## Mål

Madkontrollen skal være en modulplatform, hvor hvert produkt kan købes, åbnes og drives selvstændigt. Platformen skal håndtere showroom, login, company/location context, entitlements, checkout og launcher. Modulerne skal eje deres egen runtime og integration via en klar API-kontrakt.

POS er reference: selvstændig web-runtime og Android/Capacitor app i `D:\madkontrol-pos`.

## Ikke-mål i denne fase

Denne fase må ikke:

- flytte runtime-filer
- slette gamle routes
- ændre `functions/index.js`
- ændre Egenkontrol rutiner eller rapporter
- ændre myndighedsrapporten
- ændre POS-projektet
- deploye noget
- ændre Stripe/payment-flow

## Lukket modulstandard

Nye modulprojekter eller senere udskilte moduler skal følge denne struktur:

```text
modules-src/<module>/
  module.json
  README.md
  public/
    index.html
    assets/
  src/
    app/
    platform/
    services/
  functions/
    index.js
    access.js
  docs/
    api.md
    firestore.md
    migration.md
  tests/
    smoke/
```

Når et modul bliver til separat projekt, spejles samme struktur i fx:

```text
D:\madkontrol-lagerkontrol
D:\madkontrol-bogforing
D:\madkontrol-egenkontrol
D:\madkontrol-menu
D:\madkontrol-seo
```

## Hvad `module.json` skal eje

Et modulmanifest skal beskrive:

- `moduleId`
- displaynavn
- version
- web entry
- APK package, hvis relevant
- krævede entitlements
- Firestore collections
- callable functions
- events modulet publicerer
- events modulet lytter til
- kompatibilitetsroutes

Manifestet må ikke indeholde secrets.

## Platformens ansvar

`D:\madkontrol-app` skal blive ved med at eje:

- forside/showroom
- module showcase/registry/pricing
- login/auth
- `companyId` og `locationId` context
- entitlements/module access
- checkout/onboarding
- dashboard/launcher
- compatibility redirects for gamle `/modules/...` routes
- fælles public helpers, indtil et separat platform SDK findes

## Modulernes ansvar

Hvert modul skal eje:

- egen web-runtime
- egne assets
- egne tests
- egen dokumentation
- egen Android/Capacitor app, hvis modulet giver mening som APK
- egen backendmappe, hvis modulet har serverlogik
- egen Firestore/API-kontrakt
- egen adgangskontrol baseret på platformcontext og entitlements

## Første modulstruktur: Lagerkontrol

Lagerkontrol er første kandidat efter POS.

Foreslået fremtidig source:

```text
modules-src/lagerkontrol/
  module.json
  README.md
  public/
    index.html
    presentation.html
    lagerkontrol.css
    assets/
  src/
    app/
      lagerkontrol.js
    platform/
      platform-context-adapter.js
    services/
      inventory-store.js
      supplier-documents.js
      reports.js
  functions/
    index.js
    access.js
    supplier-documents.js
  docs/
    api.md
    firestore.md
    migration.md
  tests/
    smoke/
      web-smoke.md
      access-smoke.md
```

Nuværende Lagerkontrol-koblinger der skal håndteres ved udskilning:

- frontend importerer `/core/firebase-config.js`
- frontend importerer `/core/auditFields.js`
- frontend importerer `/core/inventory-quantity.js`
- frontend importerer `/platform/context-provider.js`
- frontend kalder `lagerProcessSupplierDocument`
- frontend bruger company-scopede Firestore paths
- `module.json` findes allerede og kan blive basis for manifestet

Før flytning skal Lagerkontrol have en platform-adapter, så runtime ikke er bundet hårdt til `D:\madkontrol-app/public`.

## Migration i faser

### Fase 0: platformkontrakt

- Fastlæg `PlatformContext`.
- Fastlæg module manifest.
- Fastlæg `requireModuleAccess(moduleId)`.
- Fastlæg gamle route redirects.
- Stop nye skjulte Egenkontrol-afhængigheder.

### Fase 1: POS forbliver reference

- POS bliver i `D:\madkontrol-pos`.
- POS bruges som reference for web + APK.
- Platformen linker til POS web/app/download, ikke ejer runtime som permanent source.

### Fase 2: Lagerkontrol

- Opret separat Lagerkontrol source, først som kopi med read-only parity.
- Udtræk platform-adapter.
- Flyt `lagerProcessSupplierDocument` til en tydelig Lagerkontrol backend-entry.
- Bevar gamle `/modules/lagerkontrol/...` routes som compatibility.
- Byg Android/Capacitor shell efter web parity.

### Fase 3: Bogføringsappen

- Saml `accounting` og `bogfoering` til én produktidentitet.
- Afklar bilag, bank, forslag og rapporter som Firestore/API-kontrakt.
- Opret web-app og APK hvis arbejdsgangen kræver mobil bilagsupload.

### Fase 4: Menu/QR

- Saml `menu` og relevante dele af `drift`.
- Fjern direkte Egenkontrol-links som produktkrav.
- Bevar integration via events, fx menupunkt oprettet, allergen dokumenteret, SEO-side ønskes.

### Fase 5: SEO Automatik

- Udskil SEO generator/site-builder som primært webmodul.
- Bevar Cloudinary/AI/Stripe flows i backendkontrakt.
- APK er kun relevant hvis der er en reel mobil workflow.

### Fase 6: CRM og Kalkulation

- CRM skal afkobles fra Egenkontrol onboarding-links.
- Kalkulation skal have tydelig dataejerskab og eventuelle Menu/Lagerkontrol events.

### Fase 7: Senere moduler

- Akademi/skole
- Sensorer
- Vedligehold
- Water
- Local events
- Kørselskontrol

Disse må ikke flyttes før produktgrænse, ejerskab og kundeimpact er afklaret.

## Kommunikationsmodel

Moduler må tale sammen via:

- Platform API
- callable functions
- Firestore kontrakter
- events/webhooks
- read-only public registries

Moduler må ikke tale sammen ved at importere hinandens runtime-filer.

## Risiko for eksisterende kunder

Største risici:

- gamle `/modules/...` links kan bryde
- Egenkontrol-rutiner og myndighedsrapport må ikke regressere
- checkout/provisioning kan stadig antage bestemte module keys
- `functions/index.js` er stor og følsom
- Firestore rules kan være bundet til nuværende paths
- hosting deploy fra dirty worktree kan tage urelaterede filer med
- dubletter som `lager`/`lagerkontrol` og `accounting`/`bogfoering` kan forvirre launcher og access

Mitigering:

- compatibility routes før flytning
- parity smoke tests pr. modul
- kontrolleret deploy-kilde pr. release
- ingen sletning af gamle runtime paths før live telemetry/brug er kendt
- separat audit før Stripe/payment/provisioning ændres

## Næste sikre trin

1. Beslut at `lagerkontrol` er første modul efter POS.
2. Lav en ren read-only inventory af alle Lagerkontrol routes, Firestore paths og callables.
3. Opret fremtidig Lagerkontrol manifest i docs eller separat branch.
4. Lav platform-adapter uden at ændre live runtime.
5. Lav smoke-checks mod eksisterende live routes.
6. Først derefter oprettes separat `D:\madkontrol-lagerkontrol`.
