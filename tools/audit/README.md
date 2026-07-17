# tools/audit — måleværktøjer

Statiske analyseværktøjer bygget under recovery-auditten 2026-07-16/17. De findes, fordi
**kodelæsning alene viste sig utilstrækkelig i dette projekt**: ti gange gav koden ét svar
og en måling et andet. Brug dem frem for at gætte.

```bash
cd tools/audit && npm install     # acorn + acorn-walk
```

Alle scripts er read-only med mindre andet står. Ingen skriver til Firestore.

---

## Struktur og afhængigheder

| Script | Formål |
|---|---|
| `require-graph.cjs <entry> [target]` | Løser den **faktiske** require-graf fra `functions/index.js`. Svarer: "læsses modul X ved boot?" Lister også forældreløse filer.<br>**Fandt:** 146 af 200 `.js`-filer i `functions/` læsses aldrig. `canonicalRoutines.js` er død; `js/canonicalRoutines.js` er den levende. |
| `analyze-index.cjs <index.js>` | Parser `index.js` med acorn: exports, hjælpefunktioner, top-level vars, requires + hvem-bruger-hvem (transitiv closure). Skriver `index-analysis.json`.<br>**Fandt:** 64 inline exports, 118 helpers, 63 af dem delte. |
| `module-coupling.cjs <public/> <functions/>` | Måler hvert moduls kobling til skallen (`/core/layout.js`, `/core/auth.js`, `/platform/context-provider.js`, `/components/sidebar.html`, `/core/module-access.js`).<br>**Fandt:** POS har nul koblinger — derfor kunne det udtrækkes. |

## Korrekthed

| Script | Formål |
|---|---|
| `check-unresolved.cjs <fil...>` | **Statisk scope-tjek.** Finder identifiers, der bruges men aldrig deklareres/importeres. `node --check` fanger dem ikke.<br>**Fandt:** `normalizeRoutineEntryKey` — kaldt i `saveRoutineTask`, defineret ingen steder. |
| `check-inline.cjs <fil.html...>` | `node --check` på inline HTML-scripts. Implementerer kommandoen fra `tools/audit-checklist.md`. |
| `export-surface.cjs <index.js> <baseline.json>` | Resolver den **offentlige export-flade** — inkl. `Object.assign(exports, require(M))` og spread-re-eksport — og differ mod `audit/functions-index-exports-baseline.json` (82 navne).<br>Brug efter **enhver** ændring i `index.js`. |

## Refaktorering

| Script | Formål |
|---|---|
| `extract-module.cjs <index.js> <domæne> <export1,export2,...>` | **Deterministisk domæne-ekstraktor.** Flytter exports + deres private helpers ordret ud i `modules/<domæne>/index.js`; eneste ændring er `exports.` → `api.`. Udleder selv hvad der skal injiceres vs. require'es. Skriver `<domæne>-plan.json`. |
| `apply-and-verify.cjs <index.js> <plan.json> <baseline.json> [--apply]` | Fjerner de flyttede linjer, indsætter wiring, og **nægter at skrive** hvis export-fladen ændrer sig. Dry-run som standard. |

> **Bemærk:** ekstraktoren bruger dependency injection (`require("./modules/x")({deps})`).
> `madkontrollen-accounting` bruger et **simplere** mønster — hver funktion i sin egen fil,
> `index.js` = `require` + `exports.x = x`, håndhævet af `index.transport.test.js` (60 linjer, 32 exports).
> **Det mønster er husstandarden og bør foretrækkes.** Se `tools/madkontrollen.md` → Index.js.

## Sikkerhed

| Script | Formål |
|---|---|
| `scan-secrets.cjs <fil...>` | Klassificerer credentials — **rapporterer type og maskeret fingeraftryk, aldrig værdier**. Kender Stripe (live/test/restricted/webhook), OpenAI, Google, GitHub, RSA private keys, service accounts.<br>**Fandt:** live Stripe-nøgle i `functions_config_export.json`. |
| `scan-destructive.cjs <functions/>` | Finder hard-deletes og markerer om filen er i boot-grafen (live) eller dormant. Filtrerer `FieldValue.delete()` (felt-rydning, legitimt) fra.<br>**Fandt:** én nåbar hard-delete-sti, korrekt beskyttet af `guardDangerousOperation`. |

## Sammenligning mod produktion

| Script | Formål |
|---|---|
| `hash-public.cjs <rod> <ud.json>` | Hasher `public/**/*.{html,js}` BOM-normaliseret. Manifestet indsættes i en browser-konsol på det deployede site for at hash-sammenligne.<br>**Fandt:** 169/169 filer byte-identiske med produktionen. |
| `compare-trees.cjs <A> <B>` | SHA-256-sammenligning af to træer: manglende, ekstra, indholdsafvigelser. |
| `compare-tracked.cjs <repo> <tree>` | Hvilke git-tracked filer mangler i et træ — og er de **flyttet** eller **væk**? Bruger `git ls-files -z` (stier med mellemrum/UTF-8 håndteres korrekt).<br>**Fandt:** 210 manglende, 207 flyttet, 3 forklarede. Ingen tab. |

## Øvrigt

| Script | Formål |
|---|---|
| `scan-seo-encoding.cjs <public/>` | Finder tabte danske tegn (`æøå` → `?`) i `<title>`/`<meta>`. Udelukker scripts/styles, så JS-ternærer (`x?y:z`) ikke giver falske positiver.<br>**Fandt:** 30 ødelagte tags i 10 filer — **stadig live i produktion**. |
| `fix-seo.cjs <public/> [--apply]` | Retter dem. Rører **kun** `<title>`/`<meta>` — en global søg-erstat ville korrumpere JS (`l?s` matcher `null?s…`). Dry-run som standard. **Udestående: aldrig anvendt på denne kilde.** |
| `static-server.cjs <rod> [port]` | Minimal statisk server til lokal visuel verifikation. |

---

## Faldgruber lært undervejs

- **Bash-ordsplitning på filstier** gav 336 falske "manglende filer" (reelt 210). Brug `git ls-files -z` og Node, ikke `for f in $(...)`.
- **`[ -f ]` fejler på mapper** → falske "findes ikke". Test typen.
- **Generiske filnavne** (`index.html`, `robots.txt`) narrer basename-matchning. Deploy-snapshottet `.deploy-module-platform-0d-*` er en fuld kopi af træet og skal udelukkes fra sådanne søgninger.
- **`core.autocrlf=true`** giver hash-afvigelse mellem git-objekt og arbejdstræ på præcis antallet af CRLF. Normalisér før sammenligning.
- **Hash-forskel ≠ indholdsforskel.** Strip BOM og normalisér linjeskift først.
