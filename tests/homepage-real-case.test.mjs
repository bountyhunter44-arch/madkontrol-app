// Madkontrollen forside — ægte Aroi-D-case, ingen demo-/mock-indhold (hotfix 2026-08-05).
//
// Beskytter forside-hotfixen: opdigtede testimonials, mock-statistik og den forældede
// landing.html er fjernet. Aroi-D Ørnhøj Hotel er den eneste case, og indehaverens navn
// vises som "Supawan Ponguttha" (uden bindestreg).
//
// STATISK kildekode-kontrol (læser filer, ingen runtime).
//   node --test tests/homepage-real-case.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PUB_ROOT = fileURLToPath(new URL("../public/", import.meta.url));
const P = (rel) => fileURLToPath(new URL("../public/" + rel, import.meta.url));
const read = (rel) => readFileSync(P(rel), "utf8");

const idx = read("index.html");

// Rekursiv liste af tekstfiler under public/ (til reference-scanning).
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

test("1. public/landing.html findes ikke", () => {
  assert.ok(!existsSync(P("landing.html")), "public/landing.html skal være slettet");
});

test("2. Ingen aktive filer i public/ linker til landing.html", () => {
  const offenders = listPublicTextFiles().filter((f) => readFileSync(f, "utf8").includes("landing.html"));
  assert.deepEqual(offenders, [], "public/-filer må ikke referere landing.html: " + offenders.join(", "));
});

test('3. Forsiden har præcis én data-home-case="aroi-d"', () => {
  const hits = idx.match(/data-home-case="aroi-d"/g) || [];
  assert.equal(hits.length, 1, 'der skal være præcis én data-home-case="aroi-d"');
  assert.ok(idx.includes('id="case-aroi-d"'), "Aroi-D-sektionen skal have id=case-aroi-d");
});

test("4. Kun Aroi-D Ørnhøj Hotel bruges som case", () => {
  assert.ok(idx.includes("Aroi-D Ørnhøj Hotel"), "Aroi-D Ørnhøj Hotel skal være til stede som case");
  assert.ok(idx.includes("Supawan Ponguttha"), "indehaverens udtalelse/navn skal være bevaret");
});

test("5. De tre tidligere falske kunders navne er væk", () => {
  for (const name of [
    "Maria Jensen",
    "Lars Andersen",
    "Tina Kvist",
    "Café København",
    "Restaurant Vestertoft",
    "Skolekantine Høje Taastrup",
  ]) {
    assert.ok(!idx.includes(name), `falsk kunde skal være fjernet: ${name}`);
  }
});

test("6. Mock-statistik (500+, 2M+, 100%-stat) er væk", () => {
  for (const token of ["500+", "2M+", "Køkkener i brug", "Daglige målinger", "Digital dokumentation samlet ét sted"]) {
    assert.ok(!idx.includes(token), `mock-tal/label skal være fjernet: ${token}`);
  }
  assert.ok(!/class="stats"/.test(idx), "stats-sektionen skal være fjernet");
});

test('7. "Hvad siger vores kunder?" er væk', () => {
  assert.ok(!/hvad siger vores kunder/i.test(idx), "testimonials-overskriften skal være væk");
  assert.ok(!idx.includes('id="testimonials"'), "testimonials-sektionen skal være væk");
  assert.ok(!/class="testimonials"/.test(idx), "testimonials-sektionen skal være væk");
});

test("8. Footerlinket peger på /#case-aroi-d", () => {
  assert.ok(idx.includes('href="/#case-aroi-d"'), "footer skal linke til /#case-aroi-d");
  assert.ok(idx.includes("Sådan bruger vi systemet"), "footer-linktekst skal være 'Sådan bruger vi systemet'");
  assert.ok(!idx.includes('href="#testimonials"'), "det gamle #testimonials-link skal være fjernet");
});

test("9. Navnet vises som Supawan Ponguttha (uden bindestreg)", () => {
  assert.ok(idx.includes("Supawan Ponguttha"), "korrekt navn skal være til stede");
  assert.ok(!idx.includes("Pong-uttha"), "det gamle navn med bindestreg skal være væk");
});
