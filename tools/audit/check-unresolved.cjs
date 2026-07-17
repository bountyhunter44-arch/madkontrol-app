/**
 * Static scope checker: finds identifiers a module references but never declares,
 * imports, injects, or receives as a parameter. This is the check that catches
 * "forgot to inject a shared helper" — node --check cannot see it.
 */
const fs = require("fs");
const path = require("path");
const SP = __dirname;
const acorn = require(path.join(SP, "node_modules/acorn"));
const walk = require(path.join(SP, "node_modules/acorn-walk"));

const GLOBALS = new Set([
  "console","require","module","exports","process","Buffer","__dirname","__filename",
  "JSON","Math","Date","Object","Array","String","Number","Boolean","Promise","Error","RegExp",
  "Map","Set","WeakMap","WeakSet","Symbol","BigInt","parseInt","parseFloat","isNaN","isFinite",
  "encodeURIComponent","decodeURIComponent","encodeURI","decodeURI","setTimeout","clearTimeout",
  "setInterval","clearInterval","setImmediate","globalThis","undefined","NaN","Infinity","fetch",
  "Intl","URL","URLSearchParams","TextEncoder","TextDecoder","AbortController","structuredClone","crypto"
]);

let totalUnresolved = 0;

for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, "utf8");
  const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: "script", locations: true });

  // Collect every binding introduced anywhere in the file (flat, conservative:
  // we only care about "is this name bound SOMEWHERE", not exact scoping).
  const bound = new Set();
  const bind = (id) => {
    if (!id) return;
    if (id.type === "Identifier") bound.add(id.name);
    else if (id.type === "ObjectPattern") id.properties.forEach((p) => bind(p.value || p.argument));
    else if (id.type === "ArrayPattern") id.elements.forEach(bind);
    else if (id.type === "AssignmentPattern") bind(id.left);
    else if (id.type === "RestElement") bind(id.argument);
  };

  walk.full(ast, (n) => {
    if (n.type === "VariableDeclarator") bind(n.id);
    else if (n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression") {
      if (n.id) bound.add(n.id.name);
      n.params.forEach(bind);
    } else if (n.type === "ClassDeclaration") { if (n.id) bound.add(n.id.name); }
    else if (n.type === "CatchClause") bind(n.param);
    else if (n.type === "ImportDeclaration") n.specifiers.forEach((s) => bound.add(s.local.name));
  });

  // Find referenced identifiers that are neither bound nor global.
  const unresolved = new Map();
  walk.ancestor(ast, {
    Identifier(node, _state, ancestors) {
      const parent = ancestors[ancestors.length - 2];
      if (!parent) return;
      // skip property keys / non-computed member props / declarations
      if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) return;
      if (parent.type === "Property" && parent.key === node && !parent.computed) return;
      if (parent.type === "MethodDefinition" && parent.key === node) return;
      const n = node.name;
      if (bound.has(n) || GLOBALS.has(n)) return;
      if (!unresolved.has(n)) unresolved.set(n, node.loc.start.line);
    }
  });

  const rel = file.split(/[\\/]/).slice(-3).join("/");
  if (unresolved.size) {
    totalUnresolved += unresolved.size;
    console.log("\n!! " + rel + " — " + unresolved.size + " ULØSTE reference(r):");
    for (const [n, line] of unresolved) console.log("     L" + line + "  " + n);
  } else {
    console.log("OK  " + rel + " — ingen uløste referencer");
  }
}

console.log("\n" + (totalUnresolved ? "FEJL: " + totalUnresolved + " uløste" : "ALLE MODULER SELVBÆRENDE"));
process.exit(totalUnresolved ? 1 : 0);
