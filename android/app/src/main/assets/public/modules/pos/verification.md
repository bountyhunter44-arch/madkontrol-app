# POS verification

## Syntax

Kør script-check på de inline scripts i POS-siderne:

```bash
node -e "const fs=require('fs'); for (const f of ['public/modules/pos/index.html','public/modules/pos/create-product.html','public/modules/pos/edit-product.html','public/modules/pos/delete-product.html','public/modules/pos/sales-report.html']) { const html=fs.readFileSync(f,'utf8'); for (const s of html.matchAll(/<script(?![^>]*type=\"module\")[^>]*>([\\s\\S]*?)<\\/script>/g)) new Function(s[1]); if(!html.trim().endsWith('</html>')) throw new Error(f+' missing closing html'); console.log(f+' OK'); }"
```

## Manual smoke test

1. Åbn `/modules/pos/create-product.html`.
2. Opret en vare med navn og pris.
3. Åbn `/modules/pos/edit-product.html`.
4. Ret varenavn eller pris og gem.
5. Åbn `/modules/pos/index.html`.
6. Bekræft at varen vises som produktkort.
7. Tilføj varen til kurven.
8. Gennemfør salg med hver betalingsmetode:
   - Zettle / PayPal Reader
   - Tap to Pay / Kortterminal
   - Kontant
   - MobilePay
   - Kortterminal
   - Revolut
   - Wise betalingslink
   - Stripe
   - Bankoverførsel
9. For ikke-kontant betaling: udfyld “Reference / transaktions-ID”.
10. Bekræft at bonen viser bonnummer, virksomhedsdata, moms, total uden moms, total med moms og betalingsmetode.
11. Ved Zettle / PayPal Reader: bekræft at bon først vises efter `Betaling modtaget`.
12. Bekræft at salget ligger i `companies/{companyId}/locations/{locationId}/pos_sales`.
13. Bekræft at `pos_receipt_sequences/main.lastNumber` stiger via transaction.
14. Bekræft at `pos_audit_log` får `sale_created`.
15. Åbn `/modules/pos/sales-report.html`.
16. Bekræft dagens salg, moms, salg uden moms og betalingssummer.
17. Bekræft at de gamle tekniske eksportknapper ikke vises.
18. Bekræft at der ikke vises rå rapportdata, kodeboks eller teknisk eksportfelt.
19. Klik `Eksportér til revisor`.
20. Bekræft at modal åbner med `Fra dato`, `Til dato` og materialetyperne `Dagsrapporter`, `Kasseafstemninger`, `Salgsrapporter`, `Boner/bilag`, `Kreditnotaer` og `Betalingsafstemning`.
21. Klik `Hent revisorpakke`.
22. Bekræft at der åbner en almindelig printbar rapportside, som kan printes eller gemmes som PDF fra browseren.
23. Bekræft at revisorpakken viser CVR, eller tydeligt skriver `CVR mangler`.
24. Hvis CVR mangler, bekræft at salgsrapporten viser handlingen `Tilføj CVR`.
25. Klik `Print rapport` og bekræft at dagsrapporten kan printes.
26. Bekræft at kun kontant salg indgår i forventet kontant kasse.
27. Bekræft at ikke-kontante salg vises under “Betalingsafstemning” med status.
28. Brug handlingerne `Markér som afstemt`, `Tilføj reference` og `Tilføj note`.
29. Bekræft at betalingsafstemning opdaterer `payment.reconciliationStatus`, `externalTransactionId`, `note`, `pos_payment_reconciliations` og auditlog.
30. Opret kreditnota fra et salg og bekræft at oprindeligt salg bevares, og at kreditnotaen får eget bonnummer.
31. Gem kasseafstemning og bekræft `pos_cash_sessions`.
32. Bekræft at `vatRate` ikke ligger i rapportens `business`, men i `vatSummary`.
33. Hvis gamle localStorage-data findes, bekræft at migrationen tilbyder backup og skriver data til Firestore.
34. Åbn POS uden company/location context og bekræft at siden ikke crasher, men at checkout stopper med besked.
35. Forsøg `Send til terminal` hvis Reader Connect ikke er aktiv og bekræft tydelig besked uden crash.
36. Bekræft at `payment.cardDataHandledByProvider = true` for Zettle-salg, og at der ikke gemmes kortnummer, PAN, CVC, udløbsdato eller rå NFC-data.
37. Åbn POS-indstillinger og klik `Forbind Zettle Reader`.
38. Klik `Hent tilgængelige readers`.
39. Hvis Reader Connect/OAuth ikke er færdig, bekræft tydelig besked og at manuel Zettle-reference stadig virker.
40. Hvis ingen readers findes, bekræft teksten `Der er ingen Zettle/PayPal Reader forbundet endnu. Forbind terminalen i Zettle/PayPal først.`
41. Når en reader senere kan vælges, bekræft at valget gemmes i `companies/{companyId}/locations/{locationId}/pos_settings/zettle`.

## Dashboard og produktbilleder

1. Åbn `/modules/pos/index.html`.
2. Bekræft at `Omsætning i dag`, `Omsætning de sidste 7 dage` og `Salg fordelt på kategorier` vises.
3. Bekræft at der ikke vises teknisk eksport, rå rapportdata eller kodefelter på kassesiden.
4. Opret eller rediger et produkt med kategori og billede-URL.
5. Bekræft at produktkortet viser billede eller placeholder, navn, kategori og pris inkl. moms.
6. Brug kategorifilteret `Alle`, `Mad`, `Drikke`, `Tilbehør`, `Dessert` og `Andet`.
7. Tilføj produktet til kurven.
8. Bekræft at kurvlinjen viser thumbnail, navn, antal, stykpris, linjetotal og plus/minus.
9. Vælg `MobilePay` i betalingsknapperne og bekræft at betalingsmodalen åbner med MobilePay forvalgt.
10. Vælg `Zettle / Kort` og bekræft at salget ikke påvirker kontant kasse.
11. Vælg `Tap to Pay` og bekræft at salget gemmes som ikke-kontant betaling med afstemningsstatus.
11. Gennemfør et salg og bekræft at omsætning, 7-dages graf og kategorifordeling opdateres.
12. Bekræft at salgslinjer gemmer `category`, `image`, `imageUrl`, `imageStoragePath` og `imageAlt`.

## Cloudinary produktbilleder

1. Opret produktet `Fish & Chips`.
2. Klik `Generér billede`.
3. Bekræft at `generatePosProductImage` kaldes.
4. Bekræft at prompten bruger produktnavn, kategori og company context.
5. Bekræft at produktet får `image.provider = "cloudinary"`, `image.cloudinaryPublicId`, `image.secureUrl` og `image.thumbnailUrl`.
6. Klik `Upload billede` og bekræft at eksisterende Cloudinary-signaturflow bruges uden secrets i frontend.
7. Klik `Vælg eksisterende` og bekræft at kun Cloudinary URL fra `res.cloudinary.com` accepteres.
8. Hvis company context mangler, bekræft at siden viser `Virksomhedsoplysninger mangler. Gå til onboarding for bedre billeder.` uden crash.
9. Opret salg med produktbillede og bekræft at salgslinjen snapshotter `image.provider`, `image.cloudinaryPublicId`, `image.secureUrl`, `image.thumbnailUrl` og `image.alt`.

## Forventet resultat

- Alle salg gemmes.
- Bonnummer stiger via Firestore transaction og genbruges ikke.
- Moms beregnes.
- `businessSnapshot` gemmes.
- `businessSnapshot` indeholder CVR, hvis CVR findes i company context, Firestore company profile eller `pos_business_profile`.
- Rapporten har `vatSummary`, og business-blokken indeholder ikke `vatRate`.
- Revisorpakken er almindeligt regnskabsmateriale med dagsrapporter, salgsrapporter, boner/bilag, kreditnotaer, betalingsafstemning og kasseafstemninger.
- Auditlog oprettes.
- Kun kontant påvirker cash drawer.
- Ikke-kontante salg får `reconciliationStatus`.
- Zettle / PayPal Reader påvirker ikke kontant kasse.
- POS bogfører først Zettle-salg efter godkendt/markeret modtaget betaling.
- Zettle Reader Connect bruger kun server-side Functions secrets.
- Zettle readerLinkId gemmes pr. lokation i `pos_settings/zettle` og er ikke et globalt secret.
- Salg slettes ikke; korrektion sker via kreditnota.
- `localStorage` bruges kun som cache/offline draft og migrationsbackup.
- Ældre lokale salg normaliseres og markeres diskret som legacy.

## Deploy note

Revisor-eksporten er en Hosting/UI-rettelse. Den kræver ikke deploy af `functions`.

```bash
firebase deploy --only hosting:madkontrollen
```
