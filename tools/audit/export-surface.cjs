/** Standalone: resolve a functions/index.js public export surface and diff vs baseline. */
const fs = require("fs");
const path = require("path");
const SP = __dirname;
const acorn = require(path.join(SP, "node_modules/acorn"));

function keysOfModule(file) {
  let src;
  try { src = fs.readFileSync(file, "utf8"); } catch { return null; }
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: "script" }); } catch { return null; }
  const names = new Set();
  const scan = (n) => {
    if (!n || typeof n !== "object") return;
    if (n.type === "AssignmentExpression" && n.left.type === "MemberExpression" &&
        n.left.object.type === "Identifier" &&
        (n.left.object.name === "api" || n.left.object.name === "exports") && n.left.property.name)
      names.add(n.left.property.name);
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach(scan);
      else if (v && typeof v.type === "string") scan(v);
    }
  };
  scan(ast);
  for (const node of ast.body) {
    const e = node.expression;
    if (node.type === "ExpressionStatement" && e && e.type === "AssignmentExpression" &&
        e.left.type === "MemberExpression" && e.left.object.name === "module" &&
        e.left.property.name === "exports" && e.right.type === "ObjectExpression") {
      for (const p of e.right.properties) {
        if (p.type === "SpreadElement") {
          const a = p.argument;
          if (a.type === "CallExpression" && a.callee.name === "require" && typeof a.arguments[0]?.value === "string") {
            const base = path.join(path.dirname(file), a.arguments[0].value);
            const sub = keysOfModule(base + ".js") || keysOfModule(path.join(base, "index.js"));
            if (sub) sub.forEach((k) => names.add(k));
          }
          continue;
        }
        if (p.key) names.add(p.key.name || p.key.value);
      }
    }
  }
  return names;
}

const INDEX = process.argv[2];
const baseDir = path.dirname(INDEX);
const ast = acorn.parse(fs.readFileSync(INDEX, "utf8"), { ecmaVersion: 2022, sourceType: "script" });
const names = new Set();
for (const node of ast.body) {
  if (node.type !== "ExpressionStatement") continue;
  const e = node.expression;
  if (e.type === "AssignmentExpression" && e.left.type === "MemberExpression" && e.left.object.name === "exports") {
    names.add(e.left.property.name); continue;
  }
  if (e.type === "CallExpression" && e.callee.type === "MemberExpression" &&
      e.callee.object.name === "Object" && e.callee.property.name === "assign" &&
      e.arguments[0]?.name === "exports") {
    let a = e.arguments[1];
    if (a.type === "CallExpression" && a.callee.type === "CallExpression") a = a.callee;
    const m = a.arguments?.[0];
    if (!m || typeof m.value !== "string") continue;
    const p = path.join(baseDir, m.value);
    const keys = keysOfModule(p + ".js") || keysOfModule(path.join(p, "index.js"));
    if (keys) keys.forEach((k) => names.add(k));
    else console.log("  !! kunne ikke resolve: " + m.value);
  }
}

const raw = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const baseline = new Set(raw.exports || raw);
const missing = [...baseline].filter((n) => !names.has(n));
const extra = [...names].filter((n) => !baseline.has(n));
console.log("baseline : " + baseline.size);
console.log("faktisk  : " + names.size);
console.log("MANGLER  : " + (missing.join(", ") || "(ingen)"));
console.log("EKSTRA   : " + (extra.join(", ") || "(ingen)"));
console.log(missing.length || extra.length ? "\nAFVIGELSE" : "\nEXPORT-FLADE IDENTISK MED BASELINE");
