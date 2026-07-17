const fs = require("fs");
const path = require("path");

const APPLY = process.argv.includes("--apply");

// Longest-first is safe here: "bogf?ring" -> "bogføring" also repairs
// "bogf?ringsforslag" correctly, since the damage is in the shared prefix.
const MAP = [
  ["Bogf?ringsappen", "Bogføringsappen"],
  ["bogf?ringsforslag", "bogføringsforslag"],
  ["selvst?ndige", "selvstændige"],
  ["Bogf?ring", "Bogføring"],
  ["bogf?ring", "bogføring"],
  ["opt?lling", "optælling"],
  ["k?kkener", "køkkener"],
  ["?rnh?j", "Ørnhøj"],
  ["r?varer", "råvarer"],
  ["caf?er", "caféer"],
  ["Vilk?r", "Vilkår"],
  ["vilk?r", "vilkår"],
  ["S?dan", "Sådan"],
  ["V?lg", "Vælg"],
  ["hj?lp", "hjælp"],
  ["caf?", "café"],
  ["L?s", "Læs"],
  ["l?s", "læs"]
];

// ONLY touch <title> and the SEO <meta> tags. Never the whole file:
// "l?s" would also match inside minified JS ternaries (e.g. `null?s...`).
const TAG_RE = /<title>[^<]*<\/title>|<meta[^>]*(?:name|property)=["'](?:description|og:title|og:description|twitter:title|twitter:description)["'][^>]*>/gi;

function repairTag(tag) {
  let out = tag;
  for (const [from, to] of MAP) out = out.split(from).join(to);
  return out;
}

const bad = /[A-Za-zÆØÅæøå]\?[A-Za-zÆØÅæøå,.]/;
let filesChanged = 0;
let tagsChanged = 0;
const leftovers = [];

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.git/.test(p)) walk(p); continue; }
    if (!/\.html$/i.test(e.name)) continue;

    const original = fs.readFileSync(p, "utf8");
    let fileTagsChanged = 0;
    const updated = original.replace(TAG_RE, (tag) => {
      const fixed = repairTag(tag);
      if (fixed !== tag) {
        fileTagsChanged++;
        console.log("  - " + tag.replace(/\s+/g, " ").trim());
        console.log("  + " + fixed.replace(/\s+/g, " ").trim());
        if (bad.test(fixed)) leftovers.push({ file: p, tag: fixed });
      }
      return fixed;
    });

    if (fileTagsChanged) {
      console.log("\n### " + p.split(path.sep).join("/") + " — " + fileTagsChanged + " tags\n");
      filesChanged++;
      tagsChanged += fileTagsChanged;
      if (APPLY) fs.writeFileSync(p, updated, "utf8");
    }
  }
}

walk("public");
console.log("=".repeat(60));
console.log(APPLY ? "APPLIED" : "DRY-RUN (ingen filer skrevet)");
console.log("filer:", filesChanged, "| tags rettet:", tagsChanged);
console.log("rest-skader efter fix:", leftovers.length);
for (const l of leftovers) console.log("  !! " + l.file + " :: " + l.tag);
