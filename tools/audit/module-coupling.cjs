/**
 * Measures how tightly each module is bound to the madkontrollen shell.
 * Shell markers: /core/layout.js (the chrome), /core/auth.js (the auth gate),
 * /platform/* (context provider). A module that imports none of them is
 * standalone-ready; POS is the reference for "done".
 */
const fs = require("fs");
const path = require("path");

const PUB = process.argv[2];
const FUNCS = process.argv[3];

const MODULES = [
  "seo", "menu", "kalkulation", "lagerkontrol", "crm",
  "koerselskontrol", "accounting", "egenkontrol", "pos"
];

const SHELL = [
  ["/core/layout.js", "layout"],
  ["/core/auth.js", "auth"],
  ["/platform/context-provider.js", "platform-ctx"],
  ["/components/sidebar.html", "sidebar"],
  ["/core/module-access.js", "entitlements"]
];

function walk(d, out = []) {
  let e; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return out; }
  for (const x of e) {
    const p = path.join(d, x.name);
    if (x.isDirectory()) walk(p, out);
    else if (/\.(html|js)$/i.test(x.name)) out.push(p);
  }
  return out;
}

// backend: which index.js exports mention the module?
let idx = "";
try { idx = fs.readFileSync(path.join(FUNCS, "index.js"), "utf8"); } catch {}

console.log("MODUL".padEnd(17) + "FILER  KB     SKAL-KOBLING                    STANDALONE?");
console.log("-".repeat(88));

for (const m of MODULES) {
  const dir = path.join(PUB, "modules", m);
  const files = walk(dir);
  if (!files.length) { console.log(m.padEnd(17) + "(ingen filer)"); continue; }

  let bytes = 0;
  const hits = new Set();
  for (const f of files) {
    const s = fs.readFileSync(f, "utf8");
    bytes += s.length;
    for (const [needle, label] of SHELL) if (s.includes(needle)) hits.add(label);
  }

  const standalone = hits.size === 0 ? "JA — klar" :
                     hits.size <= 1 ? "næsten" : "nej";

  console.log(
    m.padEnd(17) +
    String(files.length).padStart(4) + "  " +
    String(Math.round(bytes / 1024)).padStart(5) + "  " +
    ([...hits].join(", ") || "(ingen)").padEnd(32) +
    standalone
  );
}

console.log("\n=== BACKEND: exports i functions/index.js pr. modul ===");
const exp = [...idx.matchAll(/^exports\.([A-Za-z0-9_]+)\s*=/gm)].map((x) => x[1]);
const bulk = [...idx.matchAll(/Object\.assign\(exports,\s*require\("([^"]+)"\)/g)].map((x) => x[1]);
const buckets = {
  seo: /seo/i, crm: /cvr|prospect|lexi|crm/i, cloudinary: /cloudinary|image|photo/i,
  onboarding: /onboarding|quick|checkout|subdomain/i, stripe: /stripe/i,
  demo: /demo/i, egenkontrol: /task|routine|equipment|risk|haccp|cooling|day|template|egenkontrol/i
};
const rest = [];
for (const e of exp) {
  let hit = null;
  for (const [k, re] of Object.entries(buckets)) if (re.test(e)) { hit = k; break; }
  if (!hit) rest.push(e);
  else (buckets[k = hit].list = buckets[hit].list || []).push(e);
}
for (const [k, v] of Object.entries(buckets)) console.log("  " + k.padEnd(13) + (v.list ? v.list.length : 0) + " exports");
console.log("  " + "ukategoriseret".padEnd(13) + rest.length + "  " + rest.slice(0, 8).join(", "));
console.log("\n  bulk re-eksport (= allerede udtrukket):", bulk.join(", ") || "(ingen)");
