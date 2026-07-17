/**
 * 1) Removes the extracted line ranges from index.js and inserts the DI wiring line.
 * 2) Verifies the resulting public export surface still equals the 82-name baseline,
 *    by statically resolving every Object.assign(exports, require(M)) into M's keys.
 */
const fs = require("fs");
const path = require("path");
const SP = __dirname;
const acorn = require(path.join(SP, "node_modules/acorn"));

const INDEX = process.argv[2];
const PLAN = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const BASELINE = process.argv[4];
const APPLY = process.argv.includes("--apply");

// ---------- 1. rewrite index.js ----------
const lines = fs.readFileSync(INDEX, "utf8").split("\n");
const drop = new Set();
for (const r of PLAN.removeRanges) for (let i = r.from; i <= r.to; i++) drop.add(i);

const wiring =
  'Object.assign(exports, require("./modules/' + PLAN.domain + '")({ ' + PLAN.injected.join(", ") + " }));";

const insertAt = Math.min(...PLAN.removeRanges.map((r) => r.from));
const out = [];
for (let i = 1; i <= lines.length; i++) {
  if (i === insertAt) {
    out.push("// === " + PLAN.domain + " — flyttet til ./modules/" + PLAN.domain + " ===");
    out.push(wiring);
    out.push("");
  }
  if (!drop.has(i)) out.push(lines[i - 1]);
}
const rewritten = out.join("\n");

// ---------- 2. resolve the public export surface ----------
function keysOfModule(file) {
  // Returns exported names of a module, resolved statically.
  let src;
  try { src = fs.readFileSync(file, "utf8"); } catch { return null; }
  const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: "script", locations: true });
  const names = new Set();

  // pattern A: api.X = ... inside a factory  |  exports.X = ...
  const scan = (node) => {
    if (!node || typeof node !== "object") return;
    if (
      node.type === "AssignmentExpression" &&
      node.left.type === "MemberExpression" &&
      node.left.object.type === "Identifier" &&
      (node.left.object.name === "api" || node.left.object.name === "exports") &&
      node.left.property.name
    ) names.add(node.left.property.name);
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) v.forEach(scan);
      else if (v && typeof v.type === "string") scan(v);
    }
  };
  scan(ast);

  // pattern B: module.exports = { a, b, ...require("./x") }
  for (const node of ast.body) {
    if (
      node.type === "ExpressionStatement" &&
      node.expression.type === "AssignmentExpression" &&
      node.expression.left.type === "MemberExpression" &&
      node.expression.left.object.name === "module" &&
      node.expression.left.property.name === "exports" &&
      node.expression.right.type === "ObjectExpression"
    ) {
      for (const p of node.expression.right.properties) {
        // ...require("./sub") — follow it recursively
        if (p.type === "SpreadElement") {
          const a = p.argument;
          if (a.type === "CallExpression" && a.callee.name === "require" && typeof a.arguments[0]?.value === "string") {
            const base = path.join(path.dirname(file), a.arguments[0].value);
            const sub = keysOfModule(base + ".js") || keysOfModule(path.join(base, "index.js"));
            if (sub) sub.forEach((k) => names.add(k));
            else console.log("  !! kunne ikke resolve spread: " + a.arguments[0].value);
          }
          continue;
        }
        if (p.key) names.add(p.key.name || p.key.value);
      }
    }
  }
  return names;
}

function surfaceOf(indexSrc, baseDir) {
  const ast = acorn.parse(indexSrc, { ecmaVersion: 2022, sourceType: "script", locations: true });
  const names = new Set();
  for (const node of ast.body) {
    if (node.type !== "ExpressionStatement") continue;
    const e = node.expression;
    if (
      e.type === "AssignmentExpression" &&
      e.left.type === "MemberExpression" &&
      e.left.object.name === "exports"
    ) { names.add(e.left.property.name); continue; }

    if (
      e.type === "CallExpression" &&
      e.callee.type === "MemberExpression" &&
      e.callee.object.name === "Object" &&
      e.callee.property.name === "assign" &&
      e.arguments[0] && e.arguments[0].name === "exports"
    ) {
      // arg1 is require(M)  OR  require(M)(deps)
      let a = e.arguments[1];
      if (a.type === "CallExpression" && a.callee.type === "CallExpression") a = a.callee;
      const modArg = a.arguments && a.arguments[0];
      if (!modArg || typeof modArg.value !== "string") continue;
      let p = path.join(baseDir, modArg.value);
      let keys = keysOfModule(p + ".js") || keysOfModule(path.join(p, "index.js"));
      if (keys) keys.forEach((k) => names.add(k));
      else console.log("  !! kunne ikke resolve modul: " + modArg.value);
    }
  }
  return names;
}

const baseDir = path.dirname(INDEX);
const before = surfaceOf(fs.readFileSync(INDEX, "utf8"), baseDir);
const after = surfaceOf(rewritten, baseDir);
const baseline = new Set(JSON.parse(fs.readFileSync(BASELINE, "utf8")).exports || JSON.parse(fs.readFileSync(BASELINE, "utf8")));

const missing = [...baseline].filter((n) => !after.has(n));
const extra = [...after].filter((n) => !baseline.has(n));

console.log("baseline exports : " + baseline.size);
console.log("før  (index.js)  : " + before.size);
console.log("efter            : " + after.size);
console.log("\nMANGLER vs baseline : " + (missing.length ? missing.join(", ") : "(ingen)"));
console.log("EKSTRA  vs baseline : " + (extra.length ? extra.join(", ") : "(ingen)"));
console.log("\nindex.js linjer: " + lines.length + " -> " + rewritten.split("\n").length);

if (APPLY && !missing.length) {
  fs.writeFileSync(INDEX, rewritten, "utf8");
  console.log("\nAPPLIED -> " + INDEX);
} else if (APPLY) {
  console.log("\nAFVIST: export-tab, skriver ikke.");
  process.exit(1);
} else {
  console.log("\nDRY-RUN (index.js ikke skrevet)");
}
