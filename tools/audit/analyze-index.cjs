const fs = require("fs");
const path = require("path");
const SP = __dirname;
const acorn = require(path.join(SP, "node_modules/acorn"));
const walk = require(path.join(SP, "node_modules/acorn-walk"));

const FILE = process.argv[2];
const src = fs.readFileSync(FILE, "utf8");
const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: "script", locations: true });

const lineOf = (n) => n.loc.start.line;

// --- top-level inventory -------------------------------------------------
const topLevel = { requires: [], exports: [], bulkExports: [], funcs: [], vars: [] };

for (const node of ast.body) {
  // exports.NAME = ...
  if (
    node.type === "ExpressionStatement" &&
    node.expression.type === "AssignmentExpression" &&
    node.expression.left.type === "MemberExpression" &&
    node.expression.left.object.type === "Identifier" &&
    node.expression.left.object.name === "exports"
  ) {
    topLevel.exports.push({
      name: node.expression.left.property.name || node.expression.left.property.value,
      start: lineOf(node),
      end: node.loc.end.line,
      node
    });
    continue;
  }
  // Object.assign(exports, require("..."))
  if (
    node.type === "ExpressionStatement" &&
    node.expression.type === "CallExpression" &&
    node.expression.callee.type === "MemberExpression" &&
    node.expression.callee.object.name === "Object" &&
    node.expression.callee.property.name === "assign" &&
    node.expression.arguments[0] &&
    node.expression.arguments[0].name === "exports"
  ) {
    const arg = node.expression.arguments[1];
    const mod = arg && arg.type === "CallExpression" && arg.arguments[0] ? arg.arguments[0].value : "?";
    topLevel.bulkExports.push({ module: mod, line: lineOf(node) });
    continue;
  }
  // function foo() {}
  if (node.type === "FunctionDeclaration") {
    topLevel.funcs.push({ name: node.id.name, start: lineOf(node), end: node.loc.end.line, node });
    continue;
  }
  // const/let/var
  if (node.type === "VariableDeclaration") {
    for (const d of node.declarations) {
      const isReq =
        d.init &&
        ((d.init.type === "CallExpression" && d.init.callee.name === "require") ||
          (d.init.type === "MemberExpression" &&
            d.init.object.type === "CallExpression" &&
            d.init.object.callee.name === "require"));
      const names = [];
      (function collect(id) {
        if (!id) return;
        if (id.type === "Identifier") names.push(id.name);
        else if (id.type === "ObjectPattern") id.properties.forEach((p) => collect(p.value || p.argument));
        else if (id.type === "ArrayPattern") id.elements.forEach(collect);
      })(d.id);
      const entry = { names, start: lineOf(node), end: node.loc.end.line, isRequire: !!isReq, node: d };
      (isReq ? topLevel.requires : topLevel.vars).push(entry);
    }
  }
}

// --- who references what -------------------------------------------------
const localNames = new Set();
topLevel.funcs.forEach((f) => localNames.add(f.name));
topLevel.vars.forEach((v) => v.names.forEach((n) => localNames.add(n)));
topLevel.requires.forEach((r) => r.names.forEach((n) => localNames.add(n)));

function refsIn(node) {
  const found = new Set();
  walk.simple(node, {
    Identifier(n) { if (localNames.has(n.name)) found.add(n.name); }
  });
  return found;
}

const exportDeps = topLevel.exports.map((e) => ({
  name: e.name,
  lines: e.end - e.start + 1,
  start: e.start,
  refs: [...refsIn(e.node)]
}));
const funcDeps = {};
topLevel.funcs.forEach((f) => { funcDeps[f.name] = [...refsIn(f.node)].filter((n) => n !== f.name); });

// transitive closure of helper usage per export
function closure(seed) {
  const seen = new Set();
  const stack = [...seed];
  while (stack.length) {
    const n = stack.pop();
    if (seen.has(n)) continue;
    seen.add(n);
    (funcDeps[n] || []).forEach((d) => stack.push(d));
  }
  return seen;
}

const helperNames = new Set(topLevel.funcs.map((f) => f.name));
const usage = {}; // helper -> exports using it
for (const e of exportDeps) {
  e.closure = [...closure(e.refs)].filter((n) => helperNames.has(n));
  for (const h of e.closure) (usage[h] = usage[h] || []).push(e.name);
}

// --- report --------------------------------------------------------------
console.log("=== FIL ===");
console.log("linjer:", src.split("\n").length);
console.log("\n=== TOPNIVEAU ===");
console.log("require-erklæringer :", topLevel.requires.length);
console.log("exports.X inline    :", topLevel.exports.length);
console.log("Object.assign bulk  :", topLevel.bulkExports.length, JSON.stringify(topLevel.bulkExports.map((b) => b.module)));
console.log("hjælpefunktioner    :", topLevel.funcs.length);
console.log("top-level const/let :", topLevel.vars.length);

const exportLines = topLevel.exports.reduce((s, e) => s + (e.end - e.start + 1), 0);
const funcLines = topLevel.funcs.reduce((s, f) => s + (f.end - f.start + 1), 0);
console.log("\nlinjer i exports    :", exportLines);
console.log("linjer i hjælpefn.  :", funcLines);

console.log("\n=== 15 STØRSTE EXPORTS ===");
[...exportDeps].sort((a, b) => b.lines - a.lines).slice(0, 15)
  .forEach((e) => console.log(String(e.lines).padStart(5), "L" + String(e.start).padStart(6), e.name));

console.log("\n=== DELTE HJÆLPEFUNKTIONER (brugt af >1 export) ===");
const shared = Object.entries(usage).filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
console.log("antal delte:", shared.length, "af", topLevel.funcs.length);
shared.slice(0, 20).forEach(([h, v]) => console.log("  " + String(v.length).padStart(3) + " exports <- " + h));

console.log("\n=== HJÆLPEFUNKTIONER BRUGT AF PRÆCIS 1 EXPORT (kan følge med) ===");
console.log(Object.entries(usage).filter(([, v]) => v.length === 1).length);

console.log("\n=== EXPORTS UDEN HJÆLPEFN-AFHÆNGIGHED (nemmest at flytte) ===");
console.log(exportDeps.filter((e) => e.closure.length === 0).map((e) => e.name).join(", "));

fs.writeFileSync(path.join(SP, "index-analysis.json"), JSON.stringify({ exportDeps, funcDeps, usage, topLevel: {
  requires: topLevel.requires.map((r) => ({ names: r.names, start: r.start })),
  funcs: topLevel.funcs.map((f) => ({ name: f.name, start: f.start, end: f.end })),
  exports: topLevel.exports.map((e) => ({ name: e.name, start: e.start, end: e.end })),
  vars: topLevel.vars.map((v) => ({ names: v.names, start: v.start, end: v.end })),
  bulkExports: topLevel.bulkExports
} }, null, 1));
console.log("\n-> index-analysis.json skrevet");
