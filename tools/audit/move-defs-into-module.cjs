/**
 * Moves named top-level const/function declarations from index.js INTO an existing
 * factory module (at top, before `module.exports = ({...}) => {`), and removes those
 * names from BOTH the factory's destructured param list AND the wiring call in index.js.
 * Use for defs that are only used by that one module (verify first).
 *
 * node move-defs-into-module.cjs <index.js> <module/index.js> <wireRequirePath> name1 name2 ...
 * APPLY=1 to write.
 */
const fs = require("fs");
const path = require("path");
const acorn = require(path.join(__dirname, "node_modules/acorn"));

const INDEX = process.argv[2];
const MODULE = process.argv[3];
const WIRE = process.argv[4]; // e.g. ./modules/provisioning
const NAMES = process.argv.slice(5);
const APPLY = process.env.APPLY === "1";

const src = fs.readFileSync(INDEX, "utf8");
const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: "script", locations: true, ranges: true });

// Collect ranges of the named top-level decls
const found = new Map();
for (const node of ast.body) {
  if (node.type === "FunctionDeclaration" && node.id && NAMES.includes(node.id.name)) found.set(node.id.name, node);
  else if (node.type === "VariableDeclaration") {
    const d = node.declarations[0];
    if (d && d.id.type === "Identifier" && NAMES.includes(d.id.name)) found.set(d.id.name, node);
  }
}
const missing = NAMES.filter((n) => !found.has(n));
if (missing.length) { console.error("IKKE fundet som top-level: " + missing.join(", ")); process.exit(1); }

const inOrder = NAMES.map((n) => found.get(n)).sort((a, b) => a.range[0] - b.range[0]);
const block = inOrder.map((n) => src.slice(n.range[0], n.range[1])).join("\n\n");

// Remove from index.js (descending)
let idx = src;
for (const n of [...inOrder].sort((a, b) => b.range[0] - a.range[0])) {
  let s = n.range[0], e = n.range[1];
  while (e < idx.length && (idx[e] === "\n" || idx[e] === "\r")) e++;
  idx = idx.slice(0, s) + idx.slice(e);
}

// Remove NAMES from the wiring call in index.js: require("WIRE")({ a, b, ... })
const wireRe = new RegExp("(require\\(\"" + WIRE.replace(/[.\/]/g, "\\$&") + "\"\\)\\(\\{)([^}]*)(\\}\\))");
idx = idx.replace(wireRe, (m, pre, inside, post) => {
  const kept = inside.split(",").map((s) => s.trim()).filter((s) => s && !NAMES.includes(s));
  return pre + " " + kept.join(", ") + " " + post;
});

// ---- module file ----
let mod = fs.readFileSync(MODULE, "utf8");
// Remove NAMES from factory param: module.exports = ({ a, b, ... }) => {
const paramRe = /(module\.exports = \(\{)([\s\S]*?)(\}\) => \{)/;
mod = mod.replace(paramRe, (m, pre, inside, post) => {
  const kept = inside.split(",").map((s) => s.trim()).filter((s) => s && !NAMES.includes(s));
  return pre + "\n  " + kept.join(",\n  ") + "\n" + post;
});
// Insert the moved block right after the factory opening `}) => {`
mod = mod.replace(/(\}\) => \{\n)/, "$1\n  // Flyttet fra index.js — provisioning-only definitioner.\n" + block.replace(/^/gm, "  ") + "\n\n");

console.log("flyttet   : " + NAMES.length + " definitioner");
console.log("index.js  : " + src.split("\n").length + " → " + idx.split("\n").length);
console.log("modul     : " + fs.readFileSync(MODULE, "utf8").split("\n").length + " → " + mod.split("\n").length);

if (APPLY) {
  fs.writeFileSync(INDEX, idx, "utf8");
  fs.writeFileSync(MODULE, mod, "utf8");
  console.log("APPLIED");
} else console.log("DRY-RUN");
