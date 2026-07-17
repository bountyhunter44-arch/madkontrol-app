/**
 * Extracts named top-level helpers from index.js into a lib FACTORY module:
 *   module.exports = ({ <injected> }) => { <bodies verbatim>; return { <names> }; };
 * Removes the definitions from index.js and inserts, right after a named anchor
 * (e.g. the `const db = ...` line), a destructuring require of the factory.
 *
 * node extract-lib-factory.cjs <index.js> <lib/out.js> <requirePath> <anchorRegex> \
 *   --inject db,FieldValue --require "firebase-functions:functions,firebase-admin:admin" \
 *   --from-util sanitizeString,toArray  name1 name2 ...
 *
 * --inject   : names passed in via the factory arg { }
 * --require   : npm/local requires to add at top of lib file  (spec: path:localName, or path for destructure via :{a,b})
 * --from-util : names to import from ./util at top of lib file
 * APPLY=1 to write.
 */
const fs = require("fs");
const path = require("path");
const acorn = require(path.join(__dirname, "node_modules/acorn"));

const args = process.argv.slice(2);
const INDEX = args[0], OUT = args[1], REQ_PATH = args[2], ANCHOR = new RegExp(args[3]);
function opt(flag) { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : ""; }
const inject = opt("--inject").split(",").filter(Boolean);
const requires = opt("--require").split(",").filter(Boolean);
const fromUtil = opt("--from-util").split(",").filter(Boolean);
const NAMES = args.filter((a, i) => i >= 4 && !a.startsWith("--") && args[i - 1] !== "--inject" && args[i - 1] !== "--require" && args[i - 1] !== "--from-util");
const APPLY = process.env.APPLY === "1";

const src = fs.readFileSync(INDEX, "utf8");
const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: "script", locations: true, ranges: true });
const decls = new Map();
for (const node of ast.body) if (node.type === "FunctionDeclaration" && node.id) decls.set(node.id.name, node);

const missing = NAMES.filter((n) => !decls.has(n));
if (missing.length) { console.error("IKKE top-level function: " + missing.join(", ")); process.exit(1); }

const inOrder = NAMES.map((n) => decls.get(n)).sort((a, b) => a.range[0] - b.range[0]);
const descending = [...inOrder].sort((a, b) => b.range[0] - a.range[0]);

// Build lib factory
let lib = '"use strict";\n\n';
for (const r of requires) {
  const [p, local] = r.split(":");
  lib += `const ${local} = require("${p}");\n`;
}
if (fromUtil.length) lib += `const { ${fromUtil.join(", ")} } = require("./util");\n`;
lib += "\n// Udtrukket ORDRET fra index.js. Delte helpers; db injiceres.\n\n";
lib += `module.exports = ({ ${inject.join(", ")} }) => {\n\n`;
for (const node of inOrder) lib += src.slice(node.range[0], node.range[1]).replace(/^/gm, "  ") + "\n\n";
lib += "  return {\n" + NAMES.map((n) => "    " + n).join(",\n") + "\n  };\n};\n";

// Remove from index.js (descending)
let out = src;
for (const node of descending) {
  let s = node.range[0], e = node.range[1];
  while (e < out.length && (out[e] === "\n" || out[e] === "\r")) e++;
  out = out.slice(0, s) + out.slice(e);
}

// Insert require after anchor line
const lines = out.split("\n");
let anchorIdx = -1;
for (let i = 0; i < lines.length; i++) if (ANCHOR.test(lines[i])) { anchorIdx = i; break; }
if (anchorIdx < 0) { console.error("Anchor ikke fundet: " + ANCHOR); process.exit(1); }
const reqLine = `const { ${NAMES.join(", ")} } = require("${REQ_PATH}")({ ${inject.join(", ")} });`;
lines.splice(anchorIdx + 1, 0, reqLine);
out = lines.join("\n");

console.log("udtrukket : " + NAMES.length + " helpers");
console.log("injiceret : " + inject.join(", "));
console.log("anchor    : linje " + (anchorIdx + 1) + "  «" + lines[anchorIdx].trim().slice(0, 50) + "»");
console.log("index.js  : " + src.split("\n").length + " → " + out.split("\n").length);

if (APPLY) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lib, "utf8");
  fs.writeFileSync(INDEX, out, "utf8");
  console.log("APPLIED");
} else console.log("DRY-RUN");
