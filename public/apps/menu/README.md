# Menu & Retter

Produktionsrettet Menu v1 for Madkontrollen.

Appen kan åbnes på `/apps/menu/index.html` og bruger eksisterende auth/profile/company/location context via platform context, session storage og `users/{uid}` fallback.

## Funktioner

- kategorier i `menu_categories`
- retter i `menu_items`
- tilvalgsgrupper i `menu_addon_groups`
- tilvalg i `menu_addons`
- DeleFragt portaltilmelding i `portal_enrollments`
- scope på `companyId` og `locationId`
- opret, rediger og slet kategorier
- opret, rediger, slet og aktivér/deaktivér retter
- opret, rediger, slet og aktivér/deaktivér add-ons
- knyt add-on grupper til retter
- admin mode på `/apps/menu/index.html`
- order mode på `/apps/menu/index.html?mode=order`
- DeleFragt portalvisning på `/apps/menu/index.html?mode=order&portal=delefragt`
- pris, beskrivelse, billede URL, allergener og tags
- søgning, statusfilter og kategorifilter
- debug vises kun med `?debug=1`

Der oprettes ingen demo-data i live mode.

Public portal read model er forberedt med collections `portal_restaurants` og `portal_menu_items`, men sync/publicering er stadig v1-stub.
