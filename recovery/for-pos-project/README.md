# Til madkontrollen-pos — ikke denne repo

Disse filer er reddet fra deployede source-zips, men hører til POS-projektet
(`madkontrollen-pos`), ikke i madkontrollen-monolitten som tømmes for POS.

## zettle-reader-WITH-merchant-onboarding.js (781 linjer, deployet 2026-06-11 10:39)

Indeholder Zettle **merchant-onboarding** — 3 funktioner der IKKE er i den
version, der nu ligger i functions/modules/pos/zettle-reader.js (232 l.):

- startZettleMerchantOnboarding
- handleZettleMerchantCallback   (OAuth-callback, kaldes af Zettle med req.query.code/state)
- getZettleMerchantAuthStatus

**Status ved diskdød:** tilføjet 10:39, den skrumpede version deployet 11:54 samme
dag uden dem. Ingen frontend kalder dem. Enten halvfærdig-og-rullet-tilbage eller
tabt i en AI-værktøjs-omskrivning — uafklaret. Kører stadig live i produktion.

**Betalingsprincip (bruger-note):** Zettle/Viva/MobilePay/Stripe er POS-payment-
providers (tag betaling fra gæst, tap-to-pay), IKKE ewcp-modul-checkout.
Ikke alle providers er klar; tap-to-pay via Viva og Zettle er målet.
