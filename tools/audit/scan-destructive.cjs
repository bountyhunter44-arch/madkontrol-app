/**
 * Finds destructive operations across functions/, and flags whether each file
 * is currently reachable from index.js (live) or dormant.
 * Soft-archive (the sanctioned pattern) is NOT flagged.
 */
const fs = require("fs");
const path = require("path");
const SP = __dirname;
const acorn = require(path.join(SP, "node_modules/acorn"));
const walk = require(path.join(SP, "node_modules/acorn-walk"));

const ROOT = process.argv[2]; // functions/
const ENTRY = path.join(ROOT, "index.js");

// --- boot graph -----------------------------------------------------------
function resolve(from, spec) {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base, base + ".js", path.join(base, "index.js")]) {
    try { if (fs.statSync(c).isFile()) return c; } catch {}
  }
  return null;
}
function reqs(file) {
  let src; try { src = fs.readFileSync(file, "utf8"); } catch { return []; }
  let ast; try { ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: "script" }); } catch { return []; }
  const out = [];
  walk.simple(ast, { CallExpression(n) {
    if (n.callee.name === "require" && typeof n.arguments[0]?.value === "string") {
      const r = resolve(file, n.arguments[0].value); if (r) out.push(r);
    }
  }});
  return out;
}
const live = new Set([ENTRY]);
const q = [ENTRY];
while (q.length) for (const d of reqs(q.shift())) if (!live.has(d)) { live.add(d); q.push(d); }

// --- destructive scan -----------------------------------------------------
const PATTERNS = [
  [/\.delete\(\)/, "doc.delete()"],
  [/batch\.delete\(/, "batch.delete()"],
  [/\.recursiveDelete\(/, "recursiveDelete()"],
  [/bulkWriter/, "bulkWriter"],
  [/deleteCollection/, "deleteCollection"],
  [/auth\(\)\.deleteUser/, "auth.deleteUser()"],
  [/deleteUser\(/, "deleteUser()"],
  [/\.remove\(\)/, ".remove()"]
];

const all = [];
(function w(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules/.test(p)) w(p); continue; }
    if (p.endsWith(".js")) all.push(p);
  }
})(ROOT);

const hits = [];
for (const f of all) {
  const src = fs.readFileSync(f, "utf8");
  const found = [];
  src.split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return; // skip comments
    for (const [re, label] of PATTERNS) if (re.test(line)) found.push({ line: i + 1, label, code: line.trim().slice(0, 70) });
  });
  if (found.length) hits.push({ file: path.relative(ROOT, f).split(path.sep).join("/"), live: live.has(f), found });
}

const liveHits = hits.filter((h) => h.live);
const dormant = hits.filter((h) => !h.live);

console.log("=== DESTRUKTIVE OPERATIONER I functions/ ===");
console.log("filer scannet: " + all.length + "  |  i boot-grafen: " + live.size);

console.log("\n### LIVE (læsses ved boot) — " + liveHits.length + " filer");
for (const h of liveHits) {
  console.log("\n  " + h.file);
  for (const f of h.found) console.log("     L" + f.line + "  [" + f.label + "]  " + f.code);
}

console.log("\n### DORMANT (ikke i boot-grafen) — " + dormant.length + " filer");
for (const h of dormant) console.log("  " + h.file + "  (" + h.found.map((x) => x.label).join(", ") + ")");
