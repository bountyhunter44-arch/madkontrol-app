import { createRequire } from "module";
import { execFile } from "child_process";
import crypto from "crypto";
import fs from "fs/promises";
import http from "http";
import https from "https";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_DOMAIN = String(process.env.SEO_ALLOWED_ROOT_DOMAIN || "madkontrollen.dk").toLowerCase();
const SEO_SITES_ROOT = path.resolve(process.env.SEO_SITES_ROOT || path.join(__dirname, "..", "public", "sites"));
const DATA_DIR = path.resolve(process.env.OPS_DATA_DIR || path.join(__dirname, "..", "data"));
const SNAPSHOT_FILE = path.join(DATA_DIR, "ops-last-snapshot.json");
const EVENTS_FILE = path.join(DATA_DIR, "ops-events.jsonl");
const WATCH_INTERVAL_MS = Math.max(60000, Number(process.env.OPS_WATCH_INTERVAL_MS || 300000));
const ALLOWED_PM2_APPS = csvList(process.env.OPS_ALLOWED_PM2_APPS || "madkontrollen-seo-gateway,madkontrollen-ops-api,madkontrollen-ops-watcher");
const LOG_ERROR_PATTERN = /(error|failed|exception|unauthorized|timeout|rebuild failed|cache invalidation failed|seo-rebuild:error)/i;
const MEMORY_WARN_PERCENT = Number(process.env.OPS_MEMORY_WARN_PERCENT || 85);
const DISK_WARN_PERCENT = Number(process.env.OPS_DISK_WARN_PERCENT || 85);
const CPU_WARN_PERCENT = Number(process.env.OPS_CPU_WARN_PERCENT || 85);
const EXPECT_SEO_HTTPS = String(process.env.OPS_EXPECT_SEO_HTTPS || "false").toLowerCase() === "true";

function csvList(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function log(tag, fields = {}) {
  const safe = {};
  Object.entries(fields || {}).forEach(([key, value]) => {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = String(value).slice(0, 240);
    }
  });
  console.log("OPS WATCH", tag, JSON.stringify(safe));
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

function stripAnsi(value) {
  return String(value || "").replace(/\u001b\[[0-9;]*m/g, "");
}

function execFileAsync(command, args = [], options = {}) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 15000, maxBuffer: 1024 * 1024, ...options }, (error, stdout, stderr) => {
      resolve({ ok: !error, stdout: stdout || "", stderr: stderr || "", error: error ? String(error.message || "exec_failed") : "" });
    });
  });
}

function isAllowedDomain(domain) {
  const clean = String(domain || "").toLowerCase().trim();
  const escapedRoot = ROOT_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^[a-z0-9-]+\\.${escapedRoot}$`).test(clean);
}

async function fileInfo(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return { exists: stat.isFile(), mtimeMs: Math.round(stat.mtimeMs), size: stat.size };
  } catch (_error) {
    return { exists: false, mtimeMs: 0, size: 0 };
  }
}

async function readText(filePath, maxBytes = 200000) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return data.slice(0, maxBytes);
  } catch (_error) {
    return "";
  }
}

function requestUrl(url, method = "GET") {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.request(parsed, { method, timeout: 12000 }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: body.slice(0, 200000) }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (error) => resolve({ ok: false, status: 0, error: String(error?.message || "request_failed") }));
    req.end();
  });
}

function isHealthyStatus(status) {
  return Number(status) >= 200 && Number(status) < 400;
}

async function collectPm2() {
  const result = await execFileAsync("pm2", ["jlist"]);
  if (!result.ok) return { ok: false, apps: {}, error: result.error };
  const list = JSON.parse(result.stdout || "[]");
  const apps = {};
  list.filter((proc) => ALLOWED_PM2_APPS.includes(proc.name)).forEach((proc) => {
    apps[proc.name] = {
      status: proc.pm2_env?.status || "unknown",
      restarts: Number(proc.pm2_env?.restart_time || 0),
      cpu: Number(proc.monit?.cpu || 0),
      memory: Number(proc.monit?.memory || 0),
      pid: Number(proc.pid || 0)
    };
  });
  return { ok: true, apps };
}

async function collectLogs() {
  const logs = {};
  for (const app of ALLOWED_PM2_APPS) {
    const result = await execFileAsync("pm2", ["logs", app, "--lines", "120", "--nostream", "--raw"]);
    const lines = result.stdout
      .split(/\r?\n/)
      .map(stripAnsi)
      .filter((line) => line && !/last \d+ lines:/i.test(line));
    const errorLines = lines.filter((line) => LOG_ERROR_PATTERN.test(line)).slice(-8);
    logs[app] = {
      ok: result.ok,
      errorHash: hash(errorLines.join("\n")),
      errorCount: errorLines.length,
      lastError: errorLines.at(-1) || ""
    };
  }
  return logs;
}

async function collectSites() {
  log("seo_https_mode", { expected: EXPECT_SEO_HTTPS, mode: EXPECT_SEO_HTTPS ? "https_primary" : "http_primary_https_optional" });
  const entries = await fs.readdir(SEO_SITES_ROOT, { withFileTypes: true }).catch(() => []);
  const sites = {};
  for (const entry of entries) {
    if (!entry.isDirectory() || !isAllowedDomain(entry.name)) continue;
    const domain = entry.name.toLowerCase();
    const siteDir = path.join(SEO_SITES_ROOT, domain);
    const index = await fileInfo(path.join(siteDir, "index.html"));
    const robots = await fileInfo(path.join(siteDir, "robots.txt"));
    const sitemap = await fileInfo(path.join(siteDir, "sitemap.xml"));
    const html = index.exists ? await readText(path.join(siteDir, "index.html")) : "";
    const httpLive = await requestUrl(`http://${domain}/`);
    const httpsLive = await requestUrl(`https://${domain}/`);
    const primary = EXPECT_SEO_HTTPS ? httpsLive : httpLive;
    const fallback = EXPECT_SEO_HTTPS ? httpLive : httpsLive;
    sites[domain] = {
      files: { index, robots, sitemap },
      httpStatus: primary.status,
      httpOk: isHealthyStatus(primary.status),
      httpError: primary.error || "",
      httpProtocol: EXPECT_SEO_HTTPS ? "https" : "http",
      httpsExpected: EXPECT_SEO_HTTPS,
      httpsStatus: httpsLive.status,
      httpsOk: isHealthyStatus(httpsLive.status),
      httpsError: httpsLive.error || "",
      httpFallbackStatus: fallback?.status || 0,
      httpFallbackOk: isHealthyStatus(fallback?.status),
      ctaFound: /class=["'][^"']*action[^"']*["'][^>]+href=["'][^"']+["']/i.test(html || primary.body || fallback.body) || /Bestil|Besøg|BesÃ¸g/i.test(html || primary.body || fallback.body),
      canonicalFound: /<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']+["']/i.test(html || primary.body || fallback.body)
    };
  }
  return sites;
}

async function collectSystem() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memoryUsedPercent = Math.round(((totalMem - freeMem) / totalMem) * 1000) / 10;
  const cpuLoadPercent = Math.round((os.loadavg()[0] / Math.max(os.cpus().length, 1)) * 1000) / 10;
  const df = await execFileAsync("df", ["-k", "/"]);
  let diskUsedPercent = 0;
  if (df.ok) {
    const parts = df.stdout.trim().split(/\r?\n/).at(-1)?.split(/\s+/) || [];
    diskUsedPercent = Number(String(parts[4] || "0").replace("%", ""));
  }
  return { memoryUsedPercent, cpuLoadPercent, diskUsedPercent };
}

async function collectNginx() {
  const dirs = ["/etc/nginx/sites-enabled", "/etc/nginx/sites-available"];
  const files = [];
  for (const dir of dirs) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile() && !entry.isSymbolicLink()) continue;
      const filePath = path.join(dir, entry.name);
      const text = await readText(filePath, 120000);
      files.push({ file: filePath, hash: hash(text), mtime: (await fileInfo(filePath)).mtimeMs });
    }
  }
  return { hash: hash(JSON.stringify(files)), files };
}

async function collectDeploySignals() {
  const candidates = ["package.json", "server/seo-gateway.js", "server/ops-api.js", "server/ops-watcher.js"];
  const files = {};
  for (const rel of candidates) {
    files[rel] = await fileInfo(path.resolve(__dirname, "..", rel));
  }
  const gitHead = await readText(path.resolve(__dirname, "..", ".git", "HEAD"), 200);
  return { hash: hash(JSON.stringify(files) + gitHead), files };
}

export async function collectSnapshot() {
  return {
    timestamp: new Date().toISOString(),
    pm2: await collectPm2(),
    logs: await collectLogs(),
    sites: await collectSites(),
    system: await collectSystem(),
    nginx: await collectNginx(),
    deploy: await collectDeploySignals()
  };
}

function event(severity, source, type, title, message, data = {}) {
  const timestamp = new Date().toISOString();
  return { id: hash(`${timestamp}:${source}:${type}:${title}:${message}`), timestamp, severity, source, type, title, message, data };
}

export function diffSnapshots(previous, current) {
  if (!previous) return [event("info", "watcher", "baseline", "Ops baseline oprettet", "Første snapshot er gemt.")];
  const events = [];
  for (const [name, app] of Object.entries(current.pm2.apps || {})) {
    const before = previous.pm2?.apps?.[name];
    if (!before) events.push(event("info", "pm2", "app_new", `${name} registreret`, "PM2 app blev set for første gang.", { app: name }));
    if (before && before.status !== app.status) events.push(event(app.status === "online" ? "info" : "error", "pm2", "status_change", `${name} status ændret`, `${before.status} -> ${app.status}`, { app: name }));
    if (before && Number(before.restarts) !== Number(app.restarts)) events.push(event("warning", "pm2", "restart_change", `${name} restart count ændret`, `${before.restarts} -> ${app.restarts}`, { app: name }));
  }
  for (const [app, logState] of Object.entries(current.logs || {})) {
    const before = previous.logs?.[app];
    if (logState.errorCount && before?.errorHash !== logState.errorHash) {
      const severity = /rebuild failed|cache invalidation failed|seo-rebuild:error/i.test(logState.lastError) ? "error" : "warning";
      events.push(event(severity, "log", "new_error", `Ny error i ${app}`, logState.lastError.slice(0, 500), { app }));
    }
  }
  for (const [domain, site] of Object.entries(current.sites || {})) {
    const before = previous.sites?.[domain];
    if (!before) events.push(event("info", "site", "site_new", `${domain} registreret`, "SEO-site blev fundet på VPS.", { domain }));
    if (!site.files.index.exists) events.push(event("error", "site", "missing_index", `${domain} mangler index.html`, "Fysisk SEO index.html mangler.", { domain }));
    if (before) {
      for (const file of ["index", "robots", "sitemap"]) {
        if (before.files?.[file]?.mtimeMs !== site.files?.[file]?.mtimeMs || before.files?.[file]?.exists !== site.files?.[file]?.exists) {
          events.push(event("info", "site", "file_changed", `${domain} ${file} ændret`, `${file} status eller mtime er ændret.`, { domain, file }));
        }
      }
      if (before.httpStatus !== site.httpStatus) events.push(event(site.httpOk ? "info" : "error", "http", "status_change", `${domain} HTTP status ændret`, `${before.httpStatus} -> ${site.httpStatus}`, { domain }));
    }
  }
  if (current.system.memoryUsedPercent >= MEMORY_WARN_PERCENT && previous.system?.memoryUsedPercent < MEMORY_WARN_PERCENT) events.push(event("warning", "system", "memory_high", "Memory over grænse", `${current.system.memoryUsedPercent}% brugt`, current.system));
  if (current.system.diskUsedPercent >= DISK_WARN_PERCENT && previous.system?.diskUsedPercent < DISK_WARN_PERCENT) events.push(event("warning", "system", "disk_high", "Disk over grænse", `${current.system.diskUsedPercent}% brugt`, current.system));
  if (current.system.cpuLoadPercent >= CPU_WARN_PERCENT && previous.system?.cpuLoadPercent < CPU_WARN_PERCENT) events.push(event("warning", "system", "cpu_high", "CPU load over grænse", `${current.system.cpuLoadPercent}%`, current.system));
  if (previous.nginx?.hash && previous.nginx.hash !== current.nginx.hash) events.push(event("warning", "nginx", "config_changed", "Nginx config ændret", "Nginx sites config hash er ændret."));
  if (previous.deploy?.hash && previous.deploy.hash !== current.deploy.hash) events.push(event("info", "deploy", "deploy_changed", "Nyt deploy registreret", "App/server filsignatur er ændret."));
  return events;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (_error) {
    return null;
  }
}

async function writeEvents(events) {
  if (!events.length) return;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.appendFile(EVENTS_FILE, events.map((item) => JSON.stringify(item)).join("\n") + "\n", "utf8");
  await writeFirestoreEvents(events);
}

async function writeFirestoreEvents(events) {
  if (process.env.OPS_FIRESTORE_EVENTS === "0") return;
  try {
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const batch = db.batch();
    events.forEach((item) => batch.set(db.collection("ops_events").doc(item.id), { ...item, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }));
    await batch.commit();
  } catch (error) {
    log("firestore_skipped", { error: String(error?.message || "firestore_failed").slice(0, 160) });
  }
}

async function summarizeEvents(events) {
  const baseUrl = String(process.env.OLLAMA_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!baseUrl || !events.length) return events;
  const model = String(process.env.OLLAMA_MODEL || "qwen2.5-coder").trim();
  const body = JSON.stringify({
    model,
    stream: false,
    prompt: `Opsummer disse Madkontrollen drift-events kort på dansk. Kun vurdering, ingen kommandoer.\n${JSON.stringify(events.map(({ severity, source, title, message }) => ({ severity, source, title, message })), null, 2)}`
  });
  const response = await fetch(`${baseUrl}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body }).catch((error) => ({ ok: false, error }));
  if (!response.ok) return events;
  const payload = await response.json().catch(() => ({}));
  const ai = `AI vurdering: ${String(payload.response || "").trim()}`;
  return events.map((item) => ({ ...item, ai }));
}

export async function runOpsCheck() {
  const previous = await readJson(SNAPSHOT_FILE);
  const current = await collectSnapshot();
  let events = diffSnapshots(previous, current);
  events = await summarizeEvents(events);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SNAPSHOT_FILE, JSON.stringify(current, null, 2), "utf8");
  await writeEvents(events);
  log("check_done", { events: events.length });
  return { ok: true, eventCount: events.length, events, timestamp: current.timestamp };
}

async function main() {
  const result = await runOpsCheck();
  if (process.argv.includes("--check-once") || process.env.OPS_WATCHER_NO_INTERVAL === "1") {
    console.log(JSON.stringify(result));
    return;
  }
  setInterval(() => runOpsCheck().catch((error) => log("check_failed", { error: String(error?.message || "failed") })), WATCH_INTERVAL_MS);
  log("watching", { intervalMs: WATCH_INTERVAL_MS });
}

main().catch((error) => {
  console.error("OPS WATCH failed", error);
  process.exitCode = 1;
});
