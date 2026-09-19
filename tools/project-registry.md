# Madkontrollen Pro — Project Registry

> **Read this first** before any larger code change. **Update it after.** This `tools/` folder is the
> project's durable memory: active architecture, active flows, and known security rules.

## Core facts
- **Project:** Madkontrollen Pro
- **Active Firebase project:** `madkontrollen`
- **Active repo:** `G:\EWCP-Projects\madkontrollen-web`
- **Clean hosting deploy folder:** `D:\mk-deploy-focused`
- **Hosting deploy MUST come from the clean-room (`D:\mk-deploy-focused`), not the dirty repo.**
  The working tree contains many uncommitted/unrelated changes; deploying it ships all of them.
- **Functions/rules deploy requires a separate, explicit GO** (never bundled with a hosting deploy).

## Platform admin
- **email:** `mn@madkontrollen.dk`
- **uid:** `oQNTYi5NRdW1r0QHKW7FcwDGks52`
- **MUST NOT have `companyId`/`locationId`.** Platform-admin is recognized at runtime only
  (`public/core/platform-admin.js` → `isPlatformAdmin()`), never by writing tenant scope on the user doc.
- Recognized via: uid/email allowlist, `role == "super-admin"`, `platformRole == "super_admin"`,
  `isSuperAdmin == true`, `isPlatformAdmin == true`, `crmAccess == true`.
- Frontend allowlists also list this email: `public/admin/owner-dashboard.html` `SUPER_ADMIN_EMAILS`
  and `firestore.rules` `isSuperAdmin()` email allowlist.

## Aroi-D canonical scope — DO NOT change without explicit audit/approval
- **companyId:** `onboarding_aroi-d_42405000`
- **locationId:** `onboarding_aroi-d_42405000__main`
- **Supawan UID:** `HNcGHMrzsUPqbyBcmodsxBuWuJc2`
- **Supawan email:** `supawan@aroid.dk`
- This is the ONE real active customer (egenkontrol). Its canonical masterdata (equipment +
  per-unit templates) was restored deliberately. Never repoint, overwrite, or delete it.

## Registry files
| File | Purpose |
|------|---------|
| `project-registry.md` | This file — core facts, scopes, identities |
| `feature-registry.json` | Per-module active files / functions / collections / no-go rules |
| `egenkontrol.registry.md` | Egenkontrol runtime, engine, equipment/actor rules |
| `onboarding.registry.md` | Active Quick Onboarding flow + provisioning rules |
| `platform-admin-support.registry.md` | Support/"Se som kunde" model + no-go |
| `deploy-registry.md` | Hosting/rules/functions deploy procedure |
| `security-no-go.md` | Hard NO-GO conditions |
| `audit-checklist.md` | Per-change checklist |

## Process rule
1. Read the relevant registry file(s) before changing code.
2. Run the `audit-checklist.md` checks.
3. Update the registry file(s) after the change (active vs deprecated, new no-go, new collection).

## Public module presentation
- `public/modul.html?modul={egenkontrol|pos|accounting}` is the public, login-free presentation page.
- Dashboard "Læs mere" links must open this page. Only owned-module "Åbn" links go directly to an app.
- Egenkontrol/Madkontrollen kan ikke købes uden opsætning: alle "Køb nu"-knapper for `egenkontrol`
  går til den ene aktive `quick-onboarding.html`, også fra demo (`from=demo`). Onboarding gennemfører
  virksomhedsopsætning og starter derefter Stripe-betalingen.
- Andre selvstændige moduler kan fortsat bruge direkte Stripe-køb for en eksisterende, indlogget
  virksomhed via `createDirectModuleCheckoutSession`; `stripeWebhook` aktiverer det købte modul.

## App-shell navigation (drawer) — 2026-09-19
- **Der findes ingen permanent sidebar.** Al app-navigation er ÉN skjult venstre-drawer, åbnet med ☰
  i topbaren. Mønstret er hentet fra EWCP Regnskab (`madkontrollen-accounting/public/core/app-shell.js`:
  hamburger + slide-in sidebar + overlay via body-klasse), men med Madkontrollens menupunkter.
- **Eneste kilde til navigation:** `public/core/layout.js`
  (`getNavItems()`, `isNavItemEnabled()`, `createHeaderMarkup()`, `createDrawerMarkup()`, `initDrawer()`).
  Menupunkter, urls, permissions (`coreEnabled`/`addons`) og aktiv-markering (`is-active` +
  `aria-current="page"`) bevares her. Tilføj/fjern menupunkter KUN her.
- **Sider må ikke bygge deres egen navigation.** `dashboard.html` havde tidligere en hardkodet kopi af
  både topbar og sidebar; den er fjernet og bruger nu `#headerMount` + `#sidebarMount` + `loadLayout()`.
- `#sidebarMount` er tomt og har `display:contents` — det reserverer ingen bredde. `.app-layout`,
  `.control-layout` (kontrol.html) og `.startday-layout` (start-dag.html) er `display:block` i fuld bredde.
- `--sidebar-width` og `--mobile-bottom-nav-height` er 0 px. Bundnavigationen (den gamle sidebar-bjælke
  ≤760 px) findes ikke længere.
- Login/logout ejes fortsat af `public/core/auth.js` (`setupAuthGate`). Drawerens brugerområde viser
  navn/e-mail/virksomhed + Log ind/Log ud og genbruger `signOut(auth)`; `.mkp-logout-btn` er visuelt
  skjult, så den ikke optager permanent topbar-plads.
- Regressionsdækning: `tests/drawer-navigation.test.mjs`.
- `public/components/sidebar.html` og `public/components/header.html` er stadig døde/orphaned (ingen
  aktiv side loader dem) og bruges ikke af draweren.
