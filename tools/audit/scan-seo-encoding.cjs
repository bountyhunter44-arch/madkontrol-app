const fs = require("fs");
const path = require("path");

function stripCode(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
}

// Only look inside <title> and <meta ... content="...">, i.e. the SEO surface.
function seoStrings(html) {
  const out = [];
  const t = html.match(/<title>([^<]*)<\/title>/gi) || [];
  for (const x of t) out.push(x);
  const m = html.match(/<meta[^>]*(?:name|property)=["'](?:description|og:title|og:description|twitter:title|twitter:description)["'][^>]*>/gi) || [];
  for (const x of m) out.push(x);
  return out;
}

const bad = /[A-Za-zÆØÅæøå]\?[A-Za-zÆØÅæøå,.]/;
const results = [];

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.git/.test(p)) walk(p); continue; }
    if (!/\.html$/i.test(e.name)) continue;
    let s;
    try { s = fs.readFileSync(p, "utf8"); } catch { continue; }
    const tags = seoStrings(stripCode(s));
    const damaged = tags.filter((x) => bad.test(x));
    if (damaged.length) {
      results.push({ file: p.split(path.sep).join("/"), damaged: damaged.length, total: tags.length });
    }
  }
}

walk(process.argv[2] || "public");
results.sort((a, b) => b.damaged - a.damaged);
console.log("HTML-filer med ødelagte SEO-tags:", results.length);
for (const r of results) console.log("  " + String(r.damaged).padStart(2) + "/" + r.total + "  " + r.file);
console.log("TOTAL ødelagte title/meta-tags:", results.reduce((s, r) => s + r.damaged, 0));
