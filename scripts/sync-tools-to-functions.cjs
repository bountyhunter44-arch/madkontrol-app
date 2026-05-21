const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "tools", "seo", "seo.registry.json");
const targets = [
  path.join(root, "public", "modules", "seo", "seo.registry.json"),
  path.join(root, "functions", "shared-tools", "seo.registry.json"),
  path.join(root, "functions", "public", "modules", "seo", "seo.registry.json")
];

if (!fs.existsSync(source)) {
  throw new Error(`Missing SEO registry source: ${path.relative(root, source)}`);
}

const parsed = JSON.parse(fs.readFileSync(source, "utf8"));
if (!parsed.callables?.publish || !parsed.output?.rootPattern) {
  throw new Error("SEO registry is missing required callables.publish or output.rootPattern.");
}

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  console.log(`[sync-tools] copied ${path.relative(root, source)} -> ${path.relative(root, target)}`);
}
