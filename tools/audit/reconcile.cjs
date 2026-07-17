/**
 * Reconciles the recovered deploy trees against the backup's functions/ tree.
 * Answers: what does a canonical functions/ need to contain?
 *
 * For each file, across all sources:
 *   IDENTICAL  - same content everywhere it appears
 *   ONLY_IN_DEPLOY  - exists in a deploy tree, missing from backup  (= would be lost)
 *   ONLY_IN_BACKUP  - exists in backup, never deployed              (= newer work)
 *   CONFLICT   - differs between sources
 *
 * Read-only. Writes CSV reports next to the snapshots.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SNAPSHOTS = process.argv[2];
const BACKUP_FUNCS = process.argv[3];
const OUT = process.argv[4];

const SKIP = /node_modules|[\\/]\.git[\\/]|\.env$|\.secret/;

function walk(root, out = new Map()) {
  if (!fs.existsSync(root)) return out;
  (function rec(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (SKIP.test(p)) continue;
      if (e.isDirectory()) { rec(p); continue; }
      const rel = path.relative(root, p).split(path.sep).join("/");
      out.set(rel, crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex").slice(0, 16));
    }
  })(root);
  return out;
}

// Deploy trees, newest last
const trees = fs.readdirSync(SNAPSHOTS, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const treeFiles = new Map(); // treeName -> Map(rel -> hash)
for (const t of trees) treeFiles.set(t, walk(path.join(SNAPSHOTS, t)));

const backup = walk(BACKUP_FUNCS);

// Union of every path seen anywhere
const all = new Set([...backup.keys()]);
for (const m of treeFiles.values()) for (const k of m.keys()) all.add(k);

const rows = [];
for (const rel of [...all].sort()) {
  const inBackup = backup.get(rel);
  const variants = new Set();
  const seenIn = [];
  for (const [t, m] of treeFiles) {
    const h = m.get(rel);
    if (h) { variants.add(h); seenIn.push(t); }
  }
  if (inBackup) variants.add(inBackup);

  let status;
  if (!inBackup && seenIn.length) status = "ONLY_IN_DEPLOY";
  else if (inBackup && !seenIn.length) status = "ONLY_IN_BACKUP";
  else if (variants.size === 1) status = "IDENTICAL";
  else status = "CONFLICT";

  rows.push({ rel, status, variants: variants.size, deploys: seenIn.length, newestDeploy: seenIn[seenIn.length - 1] || "" });
}

const by = (s) => rows.filter((r) => r.status === s);

console.log("=== KILDER ===");
console.log("  deploy-traeer : " + trees.length);
console.log("  backup filer  : " + backup.size);
console.log("  unikke stier  : " + all.size);
console.log("");
console.log("=== RESULTAT ===");
for (const s of ["IDENTICAL", "ONLY_IN_DEPLOY", "ONLY_IN_BACKUP", "CONFLICT"]) {
  console.log("  " + s.padEnd(16) + String(by(s).length).padStart(5));
}

console.log("\n=== ONLY_IN_DEPLOY — findes ikke i backup'en (ville vaere tabt) ===");
for (const r of by("ONLY_IN_DEPLOY").slice(0, 30)) console.log("  " + r.rel);
if (by("ONLY_IN_DEPLOY").length > 30) console.log("  ... +" + (by("ONLY_IN_DEPLOY").length - 30) + " flere");

console.log("\n=== CONFLICT — afviger mellem kilder (kraever beslutning) ===");
for (const r of by("CONFLICT").slice(0, 20)) console.log("  " + String(r.variants) + " varianter  " + r.rel);
if (by("CONFLICT").length > 20) console.log("  ... +" + (by("CONFLICT").length - 20) + " flere");

const csv = "RelativePath,Status,Variants,DeployTrees,NewestDeploy\n" +
  rows.map((r) => [r.rel, r.status, r.variants, r.deploys, r.newestDeploy].join(",")).join("\n");
fs.writeFileSync(OUT, csv);
console.log("\n-> " + OUT);
