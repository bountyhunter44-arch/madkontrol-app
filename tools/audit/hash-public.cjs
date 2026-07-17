const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.argv[2];
const PUB = path.join(ROOT, "public");

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules/.test(p)) walk(p, out); continue; }
    if (/\.(html|js)$/i.test(e.name)) out.push(p);
  }
  return out;
}

const map = {};
for (const f of walk(PUB)) {
  let s = fs.readFileSync(f, "utf8");
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); // strip BOM: deployed copies have none
  const rel = "/" + path.relative(PUB, f).split(path.sep).join("/");
  map[rel] = crypto.createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex").slice(0, 16);
}

fs.writeFileSync(process.argv[3], JSON.stringify(map));
console.log("hashed " + Object.keys(map).length + " filer -> " + process.argv[3]);
