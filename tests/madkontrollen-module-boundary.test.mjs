// Madkontrollen module-boundary regression (2026-08-03, forstærket 2026-08-05).
// Madkontrollen-web er ét single-product-projekt: Egenkontrol.
// public/modules/ må kun indeholde egenkontrol; ingen aktiv kode må referere de
// 12 fjernede legacy-produktmoduler. Ingen netværk, ingen secrets.
//   node --test tests/madkontrollen-module-boundary.test.mjs
//
// Scanner KUN live top-level public/ (denne fil ligger i tests/, så ../public/).
// functions/public/ er en forældet mirror og betragtes IKKE som live frontend —
// den ligger uden for public/ og bliver derfor aldrig gået igennem her.
//
// Tilladt og fanges IKKE som legacy-reference:
//   - public/modules/egenkontrol/**   (det eneste tilbageværende produktmodul)
//   - /core/**                        (flyttet fælles core, fx /core/billed-arkiv.html)
//   - /i18n/**                        (flyttet fælles i18n)
//   - dokumentation i .md             (rule 17: docs er ikke aktiv runtime-reference)

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));
const REMOVED = ["accounting", "bogfoering", "business", "core", "crm", "drift", "kalkulation", "koerselskontrol", "lagerkontrol", "menu", "pos", "seo"];

// Fanger en reference til en fjernet modulmappe i ALLE forekommende former:
//   /modules/<m>/ · modules/<m>/ · ./modules/<m>/ · "modules/<m>" · 'modules/<m>'
//   modules/<m>?query · modules/<m> ved linjeafslutning
// Præfiks: start-af-linje eller et ikke-identifikator-tegn (så "submodules/" IKKE matcher).
// Suffiks: et ikke-(bogstav/tal/_/-)-tegn eller linjeafslutning (så "menu/" matcher, men
// "menukort" ikke matcher, og /core/ uden "modules/" foran ALDRIG matcher).
const REMOVED_RE = new RegExp('(^|[^A-Za-z0-9_])modules/(' + REMOVED.join("|") + ')(?![A-Za-z0-9_-])');

// Walk public/, kun tekst-filtyper (nu inkl. .txt for robots.txt/llms.txt); spring
// node_modules/.git over. Dokumentation (.md) tælles IKKE som aktiv runtime-reference (rule 17).
function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".git") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(html|js|mjs|json|xml|css|txt)$/i.test(e)) acc.push(p);
  }
  return acc;
}

test("public/modules/ indeholder KUN egenkontrol", () => {
  const dirs = readdirSync(join(PUBLIC, "modules"))
    .filter((d) => statSync(join(PUBLIC, "modules", d)).isDirectory())
    .sort();
  assert.deepEqual(dirs, ["egenkontrol"], "ulovlige modulmapper: " + dirs.filter((d) => d !== "egenkontrol").join(", "));
});

test("ingen aktiv kode refererer til de 12 fjernede legacy-moduler (alle sti-former)", () => {
  const hits = [];
  for (const f of walk(PUBLIC)) {
    const lines = readFileSync(f, "latin1").split(/\r?\n/);
    lines.forEach((line, i) => { if (REMOVED_RE.test(line)) hits.push(`${f.replace(PUBLIC, "")}:${i + 1}: ${line.trim().slice(0, 90)}`); });
  }
  assert.deepEqual(hits, [], "aktive legacy-modul-referencer fundet:\n" + hits.join("\n"));
});

test("forside + app-shell genintroducerer ikke legacy-produktlinks (også relative)", () => {
  for (const f of ["index.html", "dashboard.html", "core/layout.js", "components/sidebar.html", "components/header.html"]) {
    const s = readFileSync(join(PUBLIC, f), "latin1");
    s.split(/\r?\n/).forEach((line, i) => {
      assert.ok(!REMOVED_RE.test(line), `${f}:${i + 1} må ikke linke til et fjernet modul: ${line.trim().slice(0, 90)}`);
    });
  }
});

test("regression: dashboard.html billedarkiv-link peger på /core/ (ikke gammel modules/core/)", () => {
  // Ville have fanget de to relative links `href="modules/core/billed-arkiv.html"`
  // i public/dashboard.html (linje 289 + 458) som den absolutte regex tidligere missede.
  const dash = readFileSync(join(PUBLIC, "dashboard.html"), "latin1");
  assert.ok(!/(^|[^A-Za-z0-9_])\.?\/?modules\/core\/billed-arkiv\.html/m.test(dash),
    "dashboard.html må ikke linke til den gamle modules/core/billed-arkiv.html");
  assert.ok(dash.includes("/core/billed-arkiv.html"),
    "dashboard.html skal linke til den flyttede /core/billed-arkiv.html");
});

test("platform-registre er egenkontrol-only", () => {
  const showcaseEntries = (readFileSync(join(PUBLIC, "platform/module-showcase.js"), "latin1").match(/^ {2}[a-zA-Z]+: \{/gm) || []).map((x) => x.trim());
  assert.deepEqual(showcaseEntries, ["egenkontrol: {"], "module-showcase entries: " + showcaseEntries.join(", "));
  const appKeys = readFileSync(join(PUBLIC, "platform/app-registry.js"), "latin1").match(/appKey: "([^"]+)"/g) || [];
  assert.deepEqual(appKeys, ['appKey: "madkontrollen-core"', 'appKey: "egenkontrol"'], "app-registry keys: " + appKeys.join(", "));
});

test("Quick onboarding genintroducerer ikke modulvælger (regression)", () => {
  const q = readFileSync(join(PUBLIC, "quick-onboarding.html"), "latin1");
  for (const f of ["data-module-slug", 'name="selectedModules"', "moduleEntryUrl", "firstModule", "createQuickOnboardingAccount"]) {
    assert.ok(!q.includes(f), `quick-onboarding må ikke indeholde ${f}`);
  }
});
