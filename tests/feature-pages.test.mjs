// Madkontrollen – funktionssider (hotfix 2026-08-05).
//
// Beskytter de seks forklarende funktionssider, deres kobling til forsidens kort,
// SEO-metadata, Aroi-D-casen og fraværet af mock-/legacy-indhold.
//
// STATISK kildekode-kontrol (læser filer, ingen netværk).
//   node --test tests/feature-pages.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PUB_ROOT = fileURLToPath(new URL("../public/", import.meta.url));
const P = (rel) => fileURLToPath(new URL("../public/" + rel, import.meta.url));
const read = (rel) => readFileSync(P(rel), "utf8");

const ORIGIN = "https://madkontrollen.dk";
const PAGES = [
  { slug: "digital-egenkontrol", name: "Digital egenkontrol" },
  { slug: "risikoanalyse-haccp", name: "Risikoanalyse (HACCP)" },
  { slug: "afvigelsesrapporter", name: "Afvigelsesrapporter" },
  { slug: "dashboard-statistik", name: "Dashboard og statistik" },
  { slug: "onboarding-setup", name: "Onboarding og setup" },
  { slug: "myndighedsrapporter", name: "Rapporter til myndigheder" },
];
const rel = (slug) => `funktioner/${slug}.html`;

const FAKE_NAMES = ["Maria Jensen", "Lars Andersen", "Tina Kvist", "Café København", "Restaurant Vestertoft", "Skolekantine"];
const MOCK_NUMBERS = ["500+", "2M+"];
const LEGACY = ["/modules/seo", "/modules/pos", "/modules/accounting", "/modules/lagerkontrol", "/modules/menu", "/modules/crm", "/modules/business", "/modules/bogfoering", "/modules/drift", "/modules/kalkulation", "/modules/koerselskontrol"];

const idx = read("index.html");
const sitemap = read("sitemap.xml");

function listPublicTextFiles() {
  const exts = [".html", ".htm", ".js", ".mjs", ".xml", ".txt", ".json", ".css", ".webmanifest"];
  const out = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = dir + "/" + ent.name;
      if (ent.isDirectory()) walk(full);
      else if (exts.some((e) => ent.name.toLowerCase().endsWith(e))) out.push(full);
    }
  };
  walk(PUB_ROOT);
  return out;
}

test("1. Alle seks HTML-filer findes", () => {
  for (const p of PAGES) assert.ok(existsSync(P(rel(p.slug))), `mangler: ${rel(p.slug)}`);
});

test("2. Forsiden har præcis seks feature-links", () => {
  const hits = idx.match(/href="\/funktioner\/[a-z-]+\.html"/g) || [];
  assert.equal(hits.length, 6, `forventede 6 feature-links, fandt ${hits.length}`);
});

test("3. Hvert kort peger på den korrekte side", () => {
  for (const p of PAGES) {
    assert.ok(idx.includes(`href="/funktioner/${p.slug}.html"`), `forsiden mangler link til ${p.slug}`);
  }
});

test('4. Funktionssektionen har id="funktioner"', () => {
  assert.ok(idx.includes('id="funktioner"'), 'forsiden skal have id="funktioner"');
});

test("5. Hver side har præcis én H1", () => {
  for (const p of PAGES) {
    const n = (read(rel(p.slug)).match(/<h1[\s>]/g) || []).length;
    assert.equal(n, 1, `${p.slug} skal have præcis én H1 (fandt ${n})`);
  }
});

test("6. Hver side har unik title og meta description", () => {
  const titles = new Set(), descs = new Set();
  for (const p of PAGES) {
    const html = read(rel(p.slug));
    const t = (html.match(/<title>([^<]+)<\/title>/) || [])[1];
    const d = (html.match(/<meta name="description" content="([^"]+)"/) || [])[1];
    assert.ok(t && t.trim().length > 10, `${p.slug} mangler title`);
    assert.ok(d && d.trim().length > 20, `${p.slug} mangler meta description`);
    titles.add(t); descs.add(d);
  }
  assert.equal(titles.size, PAGES.length, "titles skal være unikke");
  assert.equal(descs.size, PAGES.length, "descriptions skal være unikke");
});

test("7. Hver side har korrekt canonical URL", () => {
  for (const p of PAGES) {
    const c = `${ORIGIN}/funktioner/${p.slug}.html`;
    assert.ok(read(rel(p.slug)).includes(`<link rel="canonical" href="${c}">`), `${p.slug} canonical`);
  }
});

test("8. Hver side har robots index,follow", () => {
  for (const p of PAGES) {
    assert.ok(/<meta name="robots" content="index,follow">/.test(read(rel(p.slug))), `${p.slug} robots`);
  }
});

test("9. Hver side linker tilbage til /#funktioner", () => {
  for (const p of PAGES) assert.ok(read(rel(p.slug)).includes('href="/#funktioner"'), `${p.slug} tilbage-link`);
});

test("10. Hver side har CTA til /quick-onboarding.html", () => {
  for (const p of PAGES) assert.ok(read(rel(p.slug)).includes('href="/quick-onboarding.html"'), `${p.slug} CTA`);
});

test("11. Hver side har mindst ét billede med ikke-tom alt", () => {
  for (const p of PAGES) {
    const imgs = read(rel(p.slug)).match(/<img\b[^>]*>/g) || [];
    const hasAlt = imgs.some((t) => { const m = t.match(/\balt="([^"]*)"/); return m && m[1].trim().length > 0; });
    assert.ok(hasAlt, `${p.slug} skal have et billede med ikke-tom alt`);
  }
});

test("12. Alle refererede lokale billeder og CSS-filer findes", () => {
  const re = /(?:href|src)="(\/[^"]+\.(?:css|svg|png|jpe?g|webp|ico))"/g;
  for (const p of PAGES) {
    const html = read(rel(p.slug));
    let m;
    while ((m = re.exec(html)) !== null) {
      assert.ok(existsSync(P(m[1].replace(/^\//, ""))), `${p.slug} refererer manglende asset: ${m[1]}`);
    }
  }
});

test('13. Hver side har "Hvorfor er det nødvendigt?"', () => {
  for (const p of PAGES) assert.ok(read(rel(p.slug)).includes("Hvorfor er det nødvendigt?"), `${p.slug}`);
});

test('14. Hver side har "Sådan fungerer det"', () => {
  for (const p of PAGES) assert.ok(read(rel(p.slug)).includes("Sådan fungerer det"), `${p.slug}`);
});

test("15. Hver side har Aroi-D-case uden andre kundenavne", () => {
  for (const p of PAGES) {
    const html = read(rel(p.slug));
    assert.ok(html.includes("Sådan bruger vi det hos Aroi-D"), `${p.slug} case-overskrift`);
    assert.ok(html.includes("Aroi-D Ørnhøj Hotel"), `${p.slug} Aroi-D`);
    for (const n of FAKE_NAMES) assert.ok(!html.includes(n), `${p.slug} indeholder fremmed kunde: ${n}`);
  }
});

test("16. Navnet er Supawan Ponguttha", () => {
  for (const p of PAGES) {
    const html = read(rel(p.slug));
    assert.ok(html.includes("Supawan Ponguttha"), `${p.slug} navn`);
    assert.ok(!html.includes("Pong-uttha"), `${p.slug} må ikke bruge bindestreg`);
  }
});

test("17. Ingen side indeholder de tidligere falske kundenavne", () => {
  for (const p of PAGES) for (const n of FAKE_NAMES) assert.ok(!read(rel(p.slug)).includes(n), `${p.slug}: ${n}`);
});

test("18. Ingen side indeholder de fjernede mock-tal", () => {
  for (const p of PAGES) for (const t of MOCK_NUMBERS) assert.ok(!read(rel(p.slug)).includes(t), `${p.slug}: ${t}`);
});

test("19. Ingen side linker til landing.html", () => {
  for (const p of PAGES) assert.ok(!read(rel(p.slug)).includes("landing.html"), `${p.slug}`);
});

test("20. Ingen side linker til fjernede legacy-moduler", () => {
  for (const p of PAGES) for (const l of LEGACY) assert.ok(!read(rel(p.slug)).includes(l), `${p.slug}: ${l}`);
});

test("21. sitemap.xml indeholder alle seks sider", () => {
  for (const p of PAGES) assert.ok(sitemap.includes(`${ORIGIN}/funktioner/${p.slug}.html`), `sitemap mangler ${p.slug}`);
});

test("22. public/landing.html findes fortsat ikke", () => {
  assert.ok(!existsSync(P("landing.html")), "landing.html må ikke genoprettes");
});

test("23. Ingen public-fil linker aktivt til landing.html", () => {
  const offenders = listPublicTextFiles().filter((f) => readFileSync(f, "utf8").includes("landing.html"));
  assert.deepEqual(offenders, [], "public/-filer må ikke referere landing.html: " + offenders.join(", "));
});
