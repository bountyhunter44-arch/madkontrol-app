/**
 * Reports WHICH KINDS of credentials exist and whether they look live.
 * Never prints a secret value — only the key name, a classification, and a
 * short masked fingerprint so two files can be compared without exposure.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "RSA PRIVATE KEY", "KRITISK"],
  [/\bsk_live_[A-Za-z0-9]+/, "Stripe SECRET (LIVE)", "KRITISK"],
  [/\bsk_test_[A-Za-z0-9]+/, "Stripe secret (test)", "lav"],
  [/\brk_live_[A-Za-z0-9]+/, "Stripe restricted (LIVE)", "HØJ"],
  [/\bwhsec_[A-Za-z0-9]+/, "Stripe webhook secret", "HØJ"],
  [/\bpk_live_[A-Za-z0-9]+/, "Stripe publishable (live)", "offentlig"],
  [/\bsk-proj-[A-Za-z0-9_-]{20,}/, "OpenAI key (project)", "KRITISK"],
  [/\bsk-[A-Za-z0-9]{32,}/, "OpenAI key", "KRITISK"],
  [/\bAIza[0-9A-Za-z_-]{35}/, "Google API key", "middel"],
  [/\bghp_[A-Za-z0-9]{36}/, "GitHub token", "HØJ"],
  [/"private_key_id"\s*:/, "Service account private_key_id", "KRITISK"],
  [/"client_email"\s*:\s*"[^"]*gserviceaccount/, "Service account e-mail", "info"]
];

function mask(s) {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 8);
}

for (const f of process.argv.slice(2)) {
  if (!fs.existsSync(f)) { console.log("(mangler) " + f); continue; }
  const raw = fs.readFileSync(f, "utf8");
  console.log("\n=== " + f.split(/[\\/]/).slice(-2).join("/") + " ===");

  const hits = [];
  for (const [re, label, sev] of PATTERNS) {
    const m = raw.match(re);
    if (m) hits.push({ label, sev, fp: mask(m[0]) });
  }
  if (!hits.length) console.log("  ingen kendte hemmeligheds-mønstre");
  for (const h of hits) console.log("  [" + h.sev.padEnd(9) + "] " + h.label + "   fingeraftryk:" + h.fp);

  // env-style key names only (never values)
  const names = [...raw.matchAll(/^([A-Z][A-Z0-9_]{2,})\s*=\s*(.*)$/gm)]
    .map((m) => ({ k: m[1], empty: !m[2] || /^["']?(your|xxx|changeme|<|\.\.\.)/i.test(m[2]) }));
  if (names.length) {
    console.log("  env-nøgler (" + names.length + "):");
    for (const n of names) console.log("     " + n.k + (n.empty ? "  (placeholder/tom)" : "  <- HAR VÆRDI"));
  }
}
