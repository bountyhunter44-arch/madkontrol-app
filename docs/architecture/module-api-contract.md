# Madkontrollen Module API Contract

Status: foreslået kontrakt. Ingen runtime-implementering i denne fase.

## Formål

Alle lukkede Madkontrollen-moduler skal kunne køre som selvstændige web-apps og eventuelt Android APK, men stadig bruge samme platform-login, company/location context og entitlements.

Kontrakten her definerer den smalle integration mellem platformen og modulerne.

## PlatformContext

Platformen skal kunne udlevere denne context til et modul:

```js
{
  uid: "firebase-auth-uid",
  companyId: "company_...",
  locationId: "location_...",
  role: "owner|admin|manager|staff|viewer",
  activeModules: ["pos", "lagerkontrol"],
  entitlements: {
    pos: { active: true, source: "subscription", plan: "pro" },
    lagerkontrol: { active: true, source: "subscription", plan: "pro" }
  },
  subscriptionStatus: "active|trialing|past_due|canceled|none"
}
```

Feltkrav:

- `uid` kommer fra Firebase Auth.
- `companyId` og `locationId` er platformens nuværende arbejdscontext.
- `role` må ikke være UI-only; backend skal stadig validere adgang.
- `activeModules` er en hurtig liste, ikke en sikkerhedsgaranti alene.
- `entitlements` er den primære moduladgangskontrakt.
- `subscriptionStatus` er platformstatus, ikke modulstatus alene.

## Platform API

Moduler må integrere med platformen via disse stabile API'er:

```js
await getCurrentContext()
await requireModuleAccess(moduleId)
await getIdToken()
await callModuleApi(moduleId, action, payload)
await openModule(moduleId, options)
await getModuleRegistry()
```

### `getCurrentContext()`

Returnerer `PlatformContext`. Må gerne bruge cache, men skal kunne refreshes når bruger skifter virksomhed/lokation.

### `requireModuleAccess(moduleId)`

Returnerer adgangsstatus for modulet:

```js
{
  ok: true,
  moduleId: "lagerkontrol",
  companyId: "company_...",
  locationId: "location_...",
  role: "owner"
}
```

Ved manglende adgang returneres eller kastes en kontrolleret fejl med modul, company og location, uden at afsløre andre kunders data.

### `getIdToken()`

Returnerer Firebase ID token for aktiv bruger. Token må aldrig logges eller gemmes i public config.

### `callModuleApi(moduleId, action, payload)`

Tynd wrapper til callable/API-kald. Den skal:

- vedhæfte auth token på en ensartet måde
- sende `companyId` og `locationId`, når handlingen kræver det
- validere at `moduleId` matcher entitlement
- normalisere fejl til samme form

### `openModule(moduleId, options)`

Åbner modul-app eller compatibility route. Må bruge:

- separat hosting target
- subdomæne
- app launcher
- gammel `/modules/...` redirect i migrationsperioden

### `getModuleRegistry()`

Returnerer platformens modulmetadata til showroom/launcher, ikke runtime-konfiguration med secrets.

## Module manifest

Hvert lukket modul skal have et manifest med mindst:

```json
{
  "moduleId": "lagerkontrol",
  "version": "1.0.0",
  "displayName": "Lagerkontrol",
  "requiredEntitlements": ["lagerkontrol"],
  "entry": {
    "web": "/",
    "androidPackage": "dk.madkontrollen.lagerkontrol"
  },
  "firestoreCollections": [
    "companies/{companyId}/inventory_items"
  ],
  "callableFunctions": [
    "lagerProcessSupplierDocument"
  ],
  "eventsPublished": [
    "lagerkontrol.stock.updated"
  ],
  "eventsConsumed": []
}
```

Manifestet må ikke indeholde secrets, private API keys eller miljøspecifikke tokens.

## Backend module API

Backend for et modul skal ligge modulært, fx:

```text
functions/modules/lagerkontrol/
  index.js
  access.js
  supplier-documents.js
  inventory.js
  reports.js
```

Regler:

- `functions/index.js` må kun eksportere eller route til modulet.
- Rolle- og entitlement-check ligger i modulbackend, ikke kun i frontend.
- Backend må acceptere `companyId` og `locationId`, men skal validere at brugeren har adgang.
- Cross-module data må kun læses via dokumenteret kontrakt eller platform-service.

## Firestore contract

Alle moduldata skal være scoped til company/location, medmindre data er globalt katalog/reference:

```text
companies/{companyId}/locations/{locationId}/{module_collection}/{docId}
companies/{companyId}/{module_collection}/{docId}
```

Global collections skal navngives og begrundes i modulets manifest.

## Event contract

Moduler må kommunikere via events i stedet for skjulte imports. Event envelope:

```js
{
  eventId: "evt_...",
  type: "lagerkontrol.stock.updated",
  moduleId: "lagerkontrol",
  companyId: "company_...",
  locationId: "location_...",
  actorUid: "uid_...",
  occurredAt: "2026-06-12T20:00:00.000Z",
  payload: {}
}
```

Eventnavne skal være namespaced med modul-id.

## Forbudte afhængigheder

Et lukket modul må ikke:

- kræve Egenkontrol som baseprodukt
- importere Egenkontrol runtime-filer direkte
- hardcode gamle `/modules/...` runtime-links som eneste adgang
- læse et andet moduls private Firestore paths uden kontrakt
- lægge secrets i public, Android eller manifest
- markere betalinger som gennemført uden verificeret payment-provider callback/SDK completion
- blande ny modulserverlogik direkte ind i `functions/index.js`

## Compatibility under migration

Gamle live routes må holdes i live med redirects eller wrappers, fx:

```text
/modules/lagerkontrol/index.html -> ny Lagerkontrol web-app
```

Compatibility-laget må ikke blive ny source of truth. Det skal kun beskytte eksisterende kunder under flytning.
