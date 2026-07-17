// Mirrors the "node --check an inline HTML script" command from tools/audit-checklist.md
const fs = require("fs");
const cp = require("child_process");
const os = require("os");
const path = require("path");

let fail = 0;
for (const file of process.argv.slice(2)) {
  const h = fs.readFileSync(file, "utf8");
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, i = 0;
  console.log("\n=== " + file + " ===");
  while ((m = re.exec(h))) {
    i++;
    const attrs = m[1] || "";
    if (/\bsrc=/.test(attrs)) continue;
    if (/type\s*=\s*["'](application\/ld\+json|text\/template)/i.test(attrs)) {
      console.log("  SKIP #" + i + " (json-ld/template)");
      continue;
    }
    const code = m[2];
    if (!code.trim()) continue;
    const isModule = /type\s*=\s*["']module/.test(attrs);
    const f = path.join(os.tmpdir(), "chk_" + i + (isModule ? ".mjs" : ".js"));
    fs.writeFileSync(f, code);
    try {
      cp.execSync(JSON.stringify(process.execPath) + " --check " + JSON.stringify(f), { stdio: "pipe" });
      console.log("  OK   #" + i);
    } catch (e) {
      fail++;
      console.log("  FAIL #" + i + "\n" + e.stderr.toString());
    }
    fs.unlinkSync(f);
  }
}
console.log("\n" + (fail ? "FAILURES: " + fail : "ALLE INLINE SCRIPTS OK"));
process.exit(fail ? 1 : 0);
