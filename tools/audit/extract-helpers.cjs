/**
 * Extracts named top-level helper functions from index.js VERBATIM into a lib file,
 * removes their definitions from index.js, and inserts a require() at the top.
 * Uses acorn for exact ranges. Refuses if any name is not a top-level FunctionDeclaration.
 *
 * node extract-helpers.cjs <index.js> <lib/out.js> <requirePath> name1 name2 ...
 */
const fs = require("fs");
const path = require("path");
const SP = __dirname;
const acorn = require(path.join(SP, "node_modules/acorn"));

const INDEX = process.argv[2];
const OUT = process.argv[3];
const REQ_PATH = process.argv[4];
const NAMES = process.argv.slice(5);
const APPLY = process.env.APPLY === "1";

const src = fs.readFileSync(INDEX, "utf8");
const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: "script", locations: true, ranges: true });

const decls = new Map();
for (const node of ast.body) {
  if (node.type === "FunctionDeclaration" && node.id) decls.set(node.id.name, node);
}

const missing = NAMES.filter((n) => !decls.has(n));
if (missing.length) { console.error("IKKE top-level function: " + missing.join(", ")); process.exit(1); }

// Sort by position descending so we can splice without shifting offsets
const picked = NAMES.map((n) => decls.get(n)).sort((a, b) => b.range[0] - a.range[0]);

// Build lib file in source order
const inOrder = [...picked].sort((a, b) => a.range[0] - b.range[0]);
let lib = '"use strict";\n\n';
lib += "// Rene hjælpefunktioner udtrukket fra index.js (ingen eksterne afhængigheder).\n\n";
for (const node of inOrder) lib += src.slice(node.range[0], node.range[1]) + "\n\n";
lib += "module.exports = {\n" + NAMES.map((n) => "  " + n).join(",\n") + "\n};\n";

// Remove definitions from index.js (descending order)
let out = src;
for (const node of picked) {
  let s = node.range[0], e = node.range[1];
  // swallow trailing newline
  while (e < out.length && (out[e] === "\n" || out[e] === "\r")) e++;
  out = out.slice(0, s) + out.slice(e);
}

// Insert require after the last existing top-level require line
const reqLine = "const { " + NAMES.join(", ") + " } = require(\"" + REQ_PATH + "\");\n";
const lines = out.split("\n");
let lastReq = 0;
for (let i = 0; i < Math.min(lines.length, 120); i++) {
  if (/^const\s+.*=\s*require\(/.test(lines[i])) lastReq = i;
}
lines.splice(lastReq + 1, 0, reqLine.trimEnd());
out = lines.join("\n");

console.log("udtrukket: " + NAMES.length + " funktioner");
console.log("lib-fil:   " + lib.split("\n").length + " linjer");
console.log("index.js:  " + src.split("\n").length + " → " + out.split("\n").length + " linjer");

if (APPLY) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lib, "utf8");
  fs.writeFileSync(INDEX, out, "utf8");
  console.log("APPLIED");
} else {
  console.log("DRY-RUN (sæt APPLY=1)");
}
