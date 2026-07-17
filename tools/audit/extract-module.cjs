/**
 * Deterministic domain extractor for functions/index.js.
 *
 * Moves export bodies + their PRIVATE helpers verbatim into a domain module that
 * follows the pattern already established in functions/egenkontrol/:
 *
 *   module.exports = ({ db, sanitizeString, ... }) => { ...; return api; }
 *
 * Only transformation applied to moved code: leading `exports.` -> `api.`.
 * Everything else is byte-identical to the source.
 */
const fs = require("fs");
const path = require("path");
const SP = __dirname;
const acorn = require(path.join(SP, "node_modules/acorn"));
const walk = require(path.join(SP, "node_modules/acorn-walk"));

const INDEX = process.argv[2];
const DOMAIN = process.argv[3];
const NAMES = process.argv[4].split(",").map((s) => s.trim()).filter(Boolean);

const src = fs.readFileSync(INDEX, "utf8");
const lines = src.split("\n");
const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: "script", locations: true, ranges: true });

// ---- inventory ----------------------------------------------------------
const exportsMap = new Map();
const funcs = new Map();
const requires = [];
const vars = new Map();

for (const node of ast.body) {
  if (
    node.type === "ExpressionStatement" &&
    node.expression.type === "AssignmentExpression" &&
    node.expression.left.type === "MemberExpression" &&
    node.expression.left.object.name === "exports"
  ) {
    exportsMap.set(node.expression.left.property.name, node);
  } else if (node.type === "FunctionDeclaration") {
    funcs.set(node.id.name, node);
  } else if (node.type === "VariableDeclaration") {
    for (const d of node.declarations) {
      const isReq = d.init && d.init.type === "CallExpression" && d.init.callee.name === "require";
      const isReqMember =
        d.init && d.init.type === "MemberExpression" && d.init.object.type === "CallExpression" &&
        d.init.object.callee.name === "require";
      const names = [];
      (function collect(id) {
        if (!id) return;
        if (id.type === "Identifier") names.push(id.name);
        else if (id.type === "ObjectPattern") id.properties.forEach((p) => collect(p.value || p.argument));
        else if (id.type === "ArrayPattern") id.elements.forEach((x) => collect(x));
      })(d.id);
      if (isReq || isReqMember) requires.push({ names, text: src.slice(node.range[0], node.range[1]) });
      else names.forEach((n) => vars.set(n, node));
    }
  }
}

const allLocal = new Set([...funcs.keys(), ...vars.keys(), ...requires.flatMap((r) => r.names)]);

function refsOf(node) {
  const found = new Set();
  walk.simple(node, { Identifier(n) { if (allLocal.has(n.name)) found.add(n.name); } });
  return found;
}

// helper -> which exports use it (transitively)
const funcRefs = {};
for (const [n, node] of funcs) funcRefs[n] = [...refsOf(node)].filter((x) => x !== n);

function closureOf(seed) {
  const seen = new Set();
  const stack = [...seed];
  while (stack.length) {
    const n = stack.pop();
    if (seen.has(n)) continue;
    seen.add(n);
    (funcRefs[n] || []).forEach((d) => stack.push(d));
  }
  return seen;
}

const usage = {};
for (const [name, node] of exportsMap) {
  for (const h of [...closureOf(refsOf(node))].filter((x) => funcs.has(x))) {
    (usage[h] = usage[h] || []).push(name);
  }
}

// ---- select this domain -------------------------------------------------
const missing = NAMES.filter((n) => !exportsMap.has(n));
if (missing.length) { console.error("UKENDTE EXPORTS: " + missing.join(", ")); process.exit(1); }

const domainSet = new Set(NAMES);
const needed = new Set();
for (const n of NAMES) closureOf(refsOf(exportsMap.get(n))).forEach((h) => needed.add(h));

const privateHelpers = [...needed].filter((h) => funcs.has(h) && (usage[h] || []).every((u) => domainSet.has(u)));
const sharedHelpers = [...needed].filter((h) => funcs.has(h) && !privateHelpers.includes(h));

// what the moved code references overall
const movedNodes = [...NAMES.map((n) => exportsMap.get(n)), ...privateHelpers.map((h) => funcs.get(h))];
const allRefs = new Set();
for (const n of movedNodes) refsOf(n).forEach((r) => allRefs.add(r));

const neededVars = [...allRefs].filter((r) => vars.has(r));
const neededRequires = requires.filter((r) => r.names.some((n) => allRefs.has(n)));
const injected = [...new Set([...neededVars, ...sharedHelpers])].sort();

// ---- emit ---------------------------------------------------------------
const text = (node) => src.slice(node.range[0], node.range[1]);

let out = "";
out += "// " + DOMAIN + " — udtrukket fra functions/index.js.\n";
out += "// Følger DI-factory-mønsteret fra functions/egenkontrol/.\n";
out += "// Kode flyttet ORDRET; eneste ændring er `exports.` -> `api.`.\n\n";
for (const r of neededRequires) out += r.text + "\n";
out += "\nmodule.exports = ({\n";
out += injected.map((d) => "  " + d).join(",\n") + "\n";
out += "}) => {\n  const api = {};\n\n";

for (const h of privateHelpers) out += text(funcs.get(h)) + "\n\n";
for (const n of NAMES) {
  const t = text(exportsMap.get(n));
  out += t.replace(/^exports\./, "api.") + "\n\n";
}
out += "  return api;\n};\n";

const dir = path.join(path.dirname(INDEX), "modules", DOMAIN);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "index.js"), out, "utf8");

// report + the wiring line for index.js
const removeRanges = movedNodes
  .map((n) => ({ from: n.loc.start.line, to: n.loc.end.line }))
  .sort((a, b) => a.from - b.from);

console.log("=== " + DOMAIN + " ===");
console.log("exports flyttet   : " + NAMES.length);
console.log("private helpers   : " + privateHelpers.length + (privateHelpers.length ? " (" + privateHelpers.join(", ") + ")" : ""));
console.log("injiceret (delt)  : " + injected.length + " -> " + injected.join(", "));
console.log("requires kopieret : " + neededRequires.length);
console.log("linjer i modul    : " + out.split("\n").length);
console.log("\n-- wiring til index.js --");
console.log('Object.assign(exports, require("./modules/' + DOMAIN + '")({ ' + injected.join(", ") + " }));");
console.log("\n-- linjeintervaller der skal fjernes fra index.js --");
console.log(JSON.stringify(removeRanges));
fs.writeFileSync(path.join(SP, DOMAIN + "-plan.json"), JSON.stringify({ domain: DOMAIN, names: NAMES, injected, privateHelpers, removeRanges }, null, 1));
