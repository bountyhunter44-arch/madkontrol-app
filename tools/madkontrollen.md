# EWCP TOOL — MADKONTROLLEN

Du arbejder KUN med Madkontrollen i dette værktøj.

Canonical workspace:

H:\Recovered-Projects\Canonical\madkontrol-app-recovered

Firebase-projekt:

madkontrollen

Domæne:

madkontrollen.dk

## Projektadskillelse

- Bland aldrig Regnskab-, POS-, DeleFragt-, Byggeassistent- eller andre projektfiler ind i madkontrollen.
- Madkontrollen POS (`madkontrollen-pos`) og EWCP Regnskab (`madkontrollen-accounting`) er **separate repositories og separate Firebase-projekter**. Læs dem kun, når opgaven specifikt kræver en integration.
- Fortæl ikke unødvendigt et projekt om de andre projekter.
- **Døde stier:** `D:\madkontrol-app`, `D:\mk-deploy-focused`, `D:\mk-deploy-clean` findes ikke. `D:` er Google Drive. Ældre registry-filer i `tools/` peger stadig på dem — de er forældede på det punkt.

## Opstartskontrol

Før enhver opgave:

1. Bekræft den aktuelle arbejdsmappe.
2. Kontrollér branch og `git status --short`.
3. Læs de relevante eksisterende filer.
4. Kontrollér de seneste commits.
5. Kontrollér eksisterende tests og `H:\Recovery-Audit\RECOVERY_STATUS_*.md`.
6. Antag ikke at en tidligere session stadig er aktiv.
7. Antag ikke at uncommitted arbejde er tabt, før filerne er kontrolleret.
8. **Antag ikke at koden fortæller sandheden om produktionen.** Mål, hvor det kan lade sig gøre.

## Produktets form

- **Egenkontrol er kernen, ikke et modul.** Kortet siger "Inkluderet"; den står ikke i `activeModules`, og `rutiner.html` tjekker ikke entitlements. Gør den aldrig til et tilkøb.
- **Alle øvrige moduler skal skilles fra madkontrollen.** POS er mønsteret: eget Firebase-projekt, eget subdomæne, ekstern `entryUrl` i `public/platform/app-registry.js`.
- Et modul er udtrukket, når det ikke længere importerer `/core/layout.js`, `/core/auth.js`, `/platform/context-provider.js`, `/components/sidebar.html` eller `/core/module-access.js`.
- Endemålet er ewcp.dk. Den er ikke begyndt.
- `/apps/*` i app-registry er **roadmap uden kode** (13 poster). Behandl dem ikke som moduler.

## Beskyttede identiteter

- Platform-admin `mn@madkontrollen.dk` / uid `oQNTYi5NRdW1r0QHKW7FcwDGks52` — **skal forblive tenant-løs** (ingen `companyId`/`locationId`). Genkendes kun runtime via `public/core/platform-admin.js` `isPlatformAdmin()`.
- Aroi-D canonical: companyId `onboarding_aroi-d_42405000`, location `onboarding_aroi-d_42405000__main`, Supawan uid `HNcGHMrzsUPqbyBcmodsxBuWuJc2`. **Ændres aldrig uden eksplicit godkendelse.**
- Super-admin afgøres af **email-allowlisten i `firestore.rules`**, ikke af custom claims. `mn@aroid.dk` har ingen claims.

## Dataintegritet

Eksisterende registreringer må aldrig:

- slettes
- overskrives lydløst
- tilbagedateres uden revisionsspor

Fejl håndteres gennem soft-archive:

`active:false, isActive:false, archived:true, status:"inactive", archivedReason, archivedAt`

- **`archived:true` og `active:false` er ikke det samme.** `active:false` + `archived:false` = deaktiveret men levende (fx årlige rutiner, holdt ude af dagslisten). Genererings-filteret tjekker kun `templateType === "operational"` — deaktiverede templates fyrer stadig.
- Hard delete i deployable runtime er forbudt. Den eneste nåbare sti (`deleteScopedCollectionDocs` → `resetTaskInstances`) er beskyttet af `guardDangerousOperation`. **Enhver ny destruktiv funktion skal have samme guard, før den aktiveres.**

## Egenkontrolprincipper

- Ingen køle-/fryse-/temperaturrutine uden konkret `equipmentId`/`unitId`/`equipmentName`/`unitName`. Ingen generisk "Fryser temperatur"/"Køleskab temperatur".
- `functions/equipmentRoutineGuard.js` er single source of truth for equipment-reglen.
- **"Udført af"/"Oprettet af" må aldrig være "—".** Manglende aktør → "Ikke registreret".
- En rutines faktiske frekvens = `template.scheduleConfig` **overskrevet af** `companies/{c}/locations/{l}/routine_overrides`. Læs begge.
- `js/canonicalRoutines.js` er **levende** (i boot-grafen, brugt af `canonicalTaskEngine`). `canonicalRoutines.js` uden `js/` er **død kode** med færre aliaser. Brug altid den levende.
- **`shouldRunToday`s `interval_days`-alias er bærende.** 46 af 49 aktive rutiner afhænger af det. Mistes det, returnerer den `false` for 94% af rutinerne **uden fejl** — tavs total-fejl. Rør det aldrig uden test.

## Index.js

`functions/index.js` er i dag **11.165 linjer med domænelogik**. Det er projektets største tekniske gæld, og det er dokumenteret dyrt: filen blev for stor til at committe, commits stoppede 2026-05-24, og 33 dages arbejde eksisterede kun på én disk, da den døde.

Målet er:

- imports
- exports
- wiring
- ingen domænelogik
- ingen store handlers direkte i index.js
- **transport-only-testen skal være grøn**

Referencen findes: `madkontrollen-accounting`s `functions-candidate/index.js` er **60 linjer**, 32 exports, håndhævet af `index.transport.test.js` (regex-allowlist, ikke konvention). Kopiér det mønster — hver funktion i sin egen fil, der selv henter fra `lib/`. Ingen dependency injection ved porten.

Indtil testen er grøn: **enhver ændring i `index.js` skal gøre filen mindre, ikke større.**

## Sikkerhed

- Ingen secrets i Git.
- Credentials backend-only eller i Secret Manager.
- `companyId` fra klienten skal verificeres server-side.
- **Modul-adgang er kun en frontend-gate.** `firestore.rules` nævner hverken `isDemo` eller `demoMode`. Brug ikke `activeModules` som sikkerhed.
- Farlige operationer skal bruge `guardDangerousOperation` (blokerer hårdt i produktion, ingen bypass, kun custom claims i dev).
- `.gitignore` dækker `functions_config_export.json` (**underscore**) — ikke bindestreg-varianten. Genskab aldrig `functions-config-export.json` med rigtige værdier.
- Credentials på disk, som ikke må promoveres: `serviceAccountKey.json`, `functions/.env`, `functions_config_export.json` (indeholder en **live Stripe-nøgle**).

## POS

- **Rør ikke `public/modules/pos/`.** Det er ikke død kode — det er dét, hver installeret APK loader (`capacitor.config.json` → `madkontrollen.dk/modules/pos/index.html`).
- Den levende POS er `madkontrollen-pos` (pos.madkontrollen.dk). Regnskabets `posBridge.js` hardkoder `SOURCE_PROJECT = 'madkontrollen-pos'` og afviser alt andet med 403.
- APK'en skal repointes til `pos.madkontrollen.dk` **før** Z-rapporter aktiveres, og den gamle URL skal holdes i live, til alle telefoner er opdaterede.
- APK-byggeprojektet (`android/` + `capacitor.config.json`, 3 × `build.gradle`) findes **kun her**. POS-recovery har kun en dekompileret APK.

## Kodekrav

- Behold vanilla JavaScript og Firebase.
- **Undgå monolitter. Skriv små afgrænsede moduler.**
- Genbrug eksisterende funktioner og kontrakter. Opret ikke parallelle flows.
- Arbejd ikke i deprecerede filer — kryds altid mod `feature-registry.json` og den relevante `*.registry.md`.
- Ingen hardcodede mock-resultater i produktionsflow.
- **Ingen UI-tekst må love mere end koden holder.** Verificerede eksempler på det modsatte: "Fuldført i dag" har intet datofilter; loaderen siger "Klargør rutinekort" mens koden logger `skip startDayForLocation`; "Luk dag og generér rapport" har genereret 0 rapporter.
- Alle migrationer skal være idempotente, dry-run som standard og eksplicit project-gated.

## Test

Efter ændringer:

- `node --check` på hver ændret JS-fil og hvert inline HTML-script
- export-baseline: `audit/functions-index-exports-baseline.json` (**82 navne**) skal fortsat resolve
- uløste referencer: statisk scope-tjek på ændrede filer (`node --check` fanger dem ikke)
- Firestore Rules: brace/paren-balance + read/list ikke nyt-begrænset, write/create/update ikke nyt-udvidet
- index transport-only-test (når den findes)
- secret-scan
- Git diff-check
- TODO/FIXME/mock/stub-scan i ændrede flows

Ingen test må skrive til produktion.

**Kodelæsning alene er utilstrækkelig i dette projekt.** Mål mod produktion, hvor det kan lade sig gøre: hosting-filer kan hash-sammenlignes med `madkontrollen.web.app`; Firestore kan læses read-only gennem en indlogget session. Functions kan **ikke** læses over HTTP — det hul lukkes først af et `functions-candidate`-mønster.

## Git og deploy

Ingen:

- commit
- push
- deploy
- migration mod cloud
- IAM-ændring
- Secret Manager-ændring
- skrivning til Firestore

uden brugerens eksplicitte GO.

Claude må ikke selv skrive "GO til commit" og derefter committe.

**Der findes ingen clean-room længere.** Hosting-deploy skal ske fra en git-styret kilde, ikke fra en recovery-mappe med credentials i.

## Aflevering

Aflever en commit-gate med:

- præcis filliste
- diff-stat
- datamodel
- Firestore-paths
- tests og resultater
- Rules-resultater
- secret-scan
- migrationsstatus
- deploymatrix
- rollback-plan
- Git-status
- PREDEPLOY READY: YES/NO

Vent derefter på brugerens eksplicitte GO.
