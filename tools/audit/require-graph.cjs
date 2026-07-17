/**
 * Resolves the real local require() graph starting from an entry file,
 * so we can answer: "is module X already loaded when index.js boots?"
 * Only follows relative requires (./ and ../) — npm packages are ignored.
 */
const fs = require("fs");
const path = require("path");
const SP = __dirname;
const acorn = require(path.join(SP, "node_modules/acorn"));
const walk = require(path.join(SP, "node_modules/acorn-walk"));

const ENTRY = path.resolve(process.argv[2]);
const TARGET = process.argv[3] ? path.resolve(process.argv[3]) : null;

function resolve(from, spec) {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base, base + ".js", path.join(base, "index.js")]) {
    try { if (fs.statSync(c).isFile()) return c; } catch {}
  }
  return null;
}

function localRequires(file) {
  let src;
  try { src = fs.readFileSync(file, "utf8"); } catch { return []; }
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: "script" }); }
  catch { return []; }
  const out = [];
  walk.simple(ast, {
    CallExpression(n) {
      if (n.callee.name === "require" && n.arguments[0] && typeof n.arguments[0].value === "string") {
        const r = resolve(file, n.arguments[0].value);
        if (r) out.push(r);
      }
    }
  });
  return [...new Set(out)];
}

// BFS from entry, recording the shortest path to each module
const seen = new Map([[ENTRY, [ENTRY]]]);
const queue = [ENTRY];
while (queue.length) {
  const cur = queue.shift();
  for (const dep of localRequires(cur)) {
    if (seen.has(dep)) continue;
    seen.set(dep, [...seen.get(cur), dep]);
    queue.push(dep);
  }
}

const root = path.dirname(ENTRY);
const rel = (p) => path.relative(root, p).split(path.sep).join("/");

console.log("moduler læsset fra " + rel(ENTRY) + ": " + seen.size);

if (TARGET) {
  console.log("\n=== Er " + rel(TARGET) + " i grafen? ===");
  if (seen.has(TARGET)) {
    console.log("JA — allerede læsset. Kæde:");
    seen.get(TARGET).forEach((p, i) => console.log("   " + "  ".repeat(i) + (i ? "-> " : "") + rel(p)));
  } else {
    console.log("NEJ — bliver IKKE læsset i dag. Et require ville være en ny indlæsning.");
  }
}

// Which local files exist but are never loaded from the entry?
const all = [];
(function walkDir(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules/.test(p)) walkDir(p); continue; }
    if (p.endsWith(".js")) all.push(p);
  }
})(root);
const orphans = all.filter((f) => !seen.has(f));
console.log("\n=== .js-filer i functions/ der ALDRIG læsses fra index.js: " + orphans.length + " af " + all.length + " ===");
for (const o of orphans.slice(0, 25)) console.log("   " + rel(o));
if (orphans.length > 25) console.log("   ... +" + (orphans.length - 25) + " flere");
