const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const A = process.argv[2]; // pristine
const B = process.argv[3]; // working copy

function list(root) {
  const out = [];
  (function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (/node_modules|[\\/]\.git$/.test(p)) continue;
        walk(p);
        continue;
      }
      out.push(path.relative(root, p).split(path.sep).join("/"));
    }
  })(root);
  return out;
}

function sha(p) {
  try { return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"); }
  catch { return "UNREADABLE"; }
}

const a = new Set(list(A));
const b = new Set(list(B));
const common = [...a].filter((f) => b.has(f));

const differing = [];
for (const f of common) {
  if (sha(path.join(A, f)) !== sha(path.join(B, f))) differing.push(f);
}

console.log("filer i urørt (" + A + "): " + a.size);
console.log("filer i arbejdskopi (" + B + "): " + b.size);
console.log("fælles: " + common.length);
console.log("\n=== KUN i arbejdskopi ===");
for (const f of [...b].filter((x) => !a.has(x))) console.log("  + " + f);
console.log("\n=== MANGLER i arbejdskopi (kodetab!) ===");
const missing = [...a].filter((x) => !b.has(x));
console.log(missing.length ? missing.map((f) => "  - " + f).join("\n") : "  (ingen)");
console.log("\n=== INDHOLDSFORSKELLE (" + differing.length + ") ===");
for (const f of differing) console.log("  ~ " + f);
