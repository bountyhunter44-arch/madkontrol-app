# Madkontrollen — canonical Quick onboarding (2026-08-03)

Repo: `G:\EWCP-Projects\madkontrollen-web` (branch `modul-oprydning`, HEAD `79c6ecf`).
Offentlig web: https://madkontrollen.dk / https://madkontrollen.web.app. **Ikke** POS, **ikke** EWCP-modulmarked.

Status: **PARTIAL — STRIPE E2E BLOCKED** (kodeændring udført; Stripe kan ikke E2E-testes sikkert her).
Ingen commit. Ingen deploy. Ingen ændring af Stripe-produkter/priser/webhook/secrets.

---

## 1. Den tidligere gratis modulwizard (forkert)

`public/quick-onboarding.html` var en 4-trins wizard med **modulvalg** (egenkontrol/POS/lagerkontrol/regnskab/SEO/
kørselskontrol/menu/kalkulation) og kaldte `createQuickOnboardingAccount` = **gratis** konto+virksomhed+moduler **uden
Stripe**, derefter `moduleEntryUrl(firstModule)` → gratis direkte moduladgang.

**Hvorfor forkert:** modulvalg og betaling pr. modul hører til EWCP (ewcp.dk), ikke i Madkontrollen. Madkontrollens
onboarding vedrører kun virksomhedens egenkontrol + lovpligtige risikoanalyse. Den gratis vej omgik Stripe helt.

## 2. Den midlertidige redirect-only-løsning (erstattet)

Første korrektion gjorde `quick-onboarding.html` til en meta-refresh/JS-redirect til
`/modules/egenkontrol/onboarding.html`. Det fjernede modulvalget, men en tom redirectside er ikke en canonical
formular. **Erstattet** af den rigtige formular via en delt komponent (denne opgave).

## 3. Canonical Quick onboarding-URL

`/quick-onboarding.html` viser nu den **faktiske onboardingformular** (ingen redirect, ingen meta-refresh).

## 4. Fælles komponent (ingen duplikeret logik)

Den fungerende onboarding-logik + styling er udtrukket VERBATIM fra `/modules/egenkontrol/onboarding.html` til delte
filer:

- `public/modules/egenkontrol/egenkontrol-onboarding.js` (delt module-controller, 1979 linjer — form-render,
  validering, trin-navigation, payloadbygning, betalingsinterval, kald til `createOnboardingCheckoutSession`,
  fejlvisning, kladde/genoptagelse). Kun absolutte imports (`/core/firebase-config.js`, gstatic) → virker fra enhver side.
- `public/modules/egenkontrol/egenkontrol-onboarding.css` (830 linjer delt styling).

Begge HTML-sider er nu **små wrappers** om samme delte komponent (samme shell-markup med `#stepNav`/`#stepContent`/
`#submitBtn` osv.):

- `public/quick-onboarding.html` → `<script src="/modules/egenkontrol/egenkontrol-onboarding.js">` (canonical, offentlig)
- `public/modules/egenkontrol/onboarding.html` → `<script src="./egenkontrol-onboarding.js">` (kompatibilitets-wrapper)

Ingen stor onboardingkode findes længere i to separate sider.

## 5. Virksomheds-, enheds-, aktivitets- og risikovalg (uændret datamodel)

Genereres af den delte komponent (ingen nye felter opfundet):
- **Virksomhed:** `renderCompanyStep` — company_cvr (+ CVR-opslag), company_name, kontakt/leder, email, password,
  adresse/zip/city, telefon, company_type (branche).
- **Enheder/udstyr:** `renderEquipmentStep` (state.equipment).
- **Aktiviteter/produktion:** `renderProductionStep` (state.business/productionTypes/sections).
- **Risiko/kontrolpunkter:** `renderChecksStep` (state.checks).
- **Betalingsinterval:** payMonthlyBtn/payYearlyBtn → `handleSubmit("monthly"|"yearly")`.

Payload til `createOnboardingCheckoutSession` bærer `company`, `business`, `equipment`, `sections`, `checks`,
`profile`, `companyId`, `locationId`, `billingPlan`, `successUrl`, og den faste interne `selectedModules: ["egenkontrol"]`
(IKKE et brugervalg).

## 6. Stripe-kæden (genbrugt, uændret)

```
/quick-onboarding.html (formular)  ==  /modules/egenkontrol/onboarding.html (samme komponent)
  → handleSubmit → createOnboardingCheckoutSession (httpsCallable)   [functions/modules/provisioning]
  → Stripe Checkout (mode:"subscription", secrets fra Secret Manager)
  → success: /tak.html?...session_id={CHECKOUT_SESSION_ID}
  → tak.html → finalizeOnboardingCheckoutProvisioning
  → lovpligtig risikoanalyse bundet til companyId/locationId → dashboard
```
Ingen Stripe-pris/produkt/webhook/secret ændret.

## 7. Success / cancel

- **Success:** `successUrl = ${origin}/tak.html` (backend tilføjer `session_id`). Bevaret præcist.
- **Cancel:** onboardingService-varianten bruger `cancelPath: "/modules/egenkontrol/onboarding.html?checkout=cancel"`.
  Modul-URL'en er bevaret som en fungerende wrapper om samme komponent (Mulighed A), så cancel lander på en **fungerende
  formular** uden at ændre betalingslogik. Ingen 404, ingen gratis adgang, ingen risikoanalyse ved cancel.

## 8. Takkesiden og risikoanalysen (uændret)

`public/tak.html` uændret: læser `session_id` → `finalizeOnboardingCheckoutProvisioning` → modtager `companyId` →
opretter/færdiggør virksomhedsdata → genererer virksomhedsspecifik risikoanalyse bundet til company/location → sender
til dashboard. Ingen alternativ takkeside. Ingen risikoanalyse før Stripe-success.

## 9. Legacy-routes

- **`/onboarding.html` (rod):** var brudt (importerede `./onboardingService.js` som ikke findes i roden). Erstattet af
  en lille `noindex,follow` kompatibilitetsside med canonical → `/quick-onboarding.html` og et rigtigt link (ingen
  meta-refresh).
- **`/modules/egenkontrol/onboarding.html`:** bevaret som wrapper om den delte komponent (kompatibel med
  cancel-links/bogmærker), `noindex,follow` + canonical → `/quick-onboarding.html`.

## 10. Login

Forsidens in-page loginmodal (`openLoginModalBtn`, `footerLoginModalBtn`, `landingLoginForm`) er bevaret. Ingen
`/login.html` findes eller linkes (den tidligere brudte reference er fjernet). Ingen ny loginfil oprettet.

## 11. Tests

`node --test tests/quick-onboarding.test.mjs` → **15/15 pass**. Dækker FASE 12's 24 punkter: reel formular (ikke
redirect), virksomheds-/enheds-/aktivitets-/risikovalg i den delte komponent, intet modulvalg, ingen
`createQuickOnboardingAccount`/`firstModule`/`moduleEntryUrl`, delt komponent brugt af begge sider,
`createOnboardingCheckoutSession`, success→tak.html, session_id, `finalizeOnboardingCheckoutProvisioning`,
company/location-binding, forside-CTA, root-onboarding ikke brudt, modul-URL ikke 404, ingen `/login.html`,
footer-loginmodal, ingen POS-links, ingen meta-refresh, `noindex,follow`, ikke i sitemap.
Den delte komponent ESM-syntakstjekket (`node --check`) OK. `git diff --check` rent.

## 12. Stripe E2E-status

**BLOCKED — IKKE TESTET.** Intet sikkert Stripe-testmiljø kan bevises her. Kodeinspektion ≠ bestået E2E. Kræver separat
betalings-GO for en isoleret staging-/testkørsel.

## 13. EWCP-grænsen (uden for denne opgave)

Modulvalg og separat Stripe-betaling pr. EWCP-modul hører til `ewcp.dk` og er **ikke** implementeret her. Madkontrollen
kan senere være et købt EWCP-modul; inde i Madkontrollen handler onboarding kun om egenkontrolopsætning.

## Kendte begrænsninger

- Stripe E2E er BLOCKED (se pkt. 12).
- `createQuickOnboardingAccount` er stadig i backend (ingen offentlig reference nu) — afventer separat oprydning efter
  bekræftelse af, at intet andet aktivt flow bruger den. IKKE slettet.
- `functions/public/*` og `android/app/.../assets/public/*` er build-/bundle-spejle af `public/` (regenereres ved
  deploy/sync) — bevidst ikke redigeret manuelt.
- To små, identiske shell-markup-blokke (wrapper-frames) i quick + modul-siden; al logik/CSS er delt (ikke duplikeret).
- Webhook mangler eksplicit event.id-idempotens (payment-scope, uændret her).
