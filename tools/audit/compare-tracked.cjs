/**
 * Accurate comparison: which files tracked in the GitHub repo's HEAD are
 * absent from the backup tree? Uses git ls-files -z so paths with spaces
 * or non-ASCII names are handled correctly.
 */
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const REPO = process.argv[2];
const BACKUP = process.argv[3];

// -z gives NUL-separated, unquoted paths
const raw = cp.execSync("git ls-files -z", { cwd: REPO, maxBuffer: 64 * 1024 * 1024 });
const tracked = raw.toString("utf8").split("\0").filter(Boolean);

const missing = [];
const present = [];
for (const f of tracked) {
  (fs.existsSync(path.join(BACKUP, f)) ? present : missing).push(f);
}

// For the missing ones: is the basename findable elsewhere in the backup?
function indexBackup(dir, map = new Map()) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return map; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    // Exclude the June-12 deploy snapshot: it is a full copy of the tree, so
    // matching basenames inside it would fake a "relocation" for deleted files.
    if (e.isDirectory()) {
      if (!/node_modules|\.git$|\.deploy-module-platform/.test(p)) indexBackup(p, map);
      continue;
    }
    if (!map.has(e.name)) map.set(e.name, []);
    map.get(e.name).push(path.relative(BACKUP, p).split(path.sep).join("/"));
  }
  return map;
}
const byName = indexBackup(BACKUP);

const relocated = [];
const gone = [];
for (const f of missing) {
  const bn = path.basename(f);
  if (byName.has(bn)) relocated.push({ from: f, to: byName.get(bn)[0] });
  else gone.push(f);
}

console.log("tracked i GitHub HEAD : " + tracked.length);
console.log("findes i backup       : " + present.length);
console.log("mangler i backup      : " + missing.length);
console.log("  heraf FLYTTET (samme filnavn findes andetsteds) : " + relocated.length);
console.log("  heraf VÆK (filnavnet findes ingen steder)        : " + gone.length);

console.log("\n=== VÆK — findes ingen steder i backup'en ===");
for (const f of gone.slice(0, 40)) console.log("  " + f);
if (gone.length > 40) console.log("  ... +" + (gone.length - 40) + " flere");

console.log("\n=== Eksempler på FLYTTET ===");
for (const r of relocated.slice(0, 8)) console.log("  " + r.from + "\n      -> " + r.to);
