import { createRequire } from "module";
import { execFile } from "child_process";
import crypto from "crypto";
import fs from "fs/promises";
import http from "http";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const express = require("express");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.OPS_API_PORT || process.env.PORT || 3200);
const ROOT_DOMAIN = String(process.env.SEO_ALLOWED_ROOT_DOMAIN || "madkontrollen.dk").toLowerCase();
const SEO_SITES_ROOT = path.resolve(process.env.SEO_SITES_ROOT || path.join(__dirname, "..", "public", "sites"));
const PUBLIC_ADMIN_ROOT = path.resolve(__dirname, "..", "public", "admin");
const OPS_DATA_DIR = path.resolve(process.env.OPS_DATA_DIR || path.join(__dirname, "..", "data"));
const EVENTS_FILE = path.join(OPS_DATA_DIR, "ops-events.jsonl");
const EVENTS_ARCHIVE_FILE = path.join(OPS_DATA_DIR, "ops-events-archive.jsonl");
const SNAPSHOT_FILE = path.join(OPS_DATA_DIR, "ops-last-snapshot.json");
const GATEWAY_PORT = Number(process.env.SEO_GATEWAY_PORT || 3100);
const OPS_TOKEN = String(process.env.OPS_CENTER_TOKEN || process.env.OPS_INTERNAL_TOKEN || process.env.SEO_GATEWAY_INTERNAL_TOKEN || "");
const GATEWAY_TOKEN = String(process.env.SEO_GATEWAY_INTERNAL_TOKEN || "");
const EXPECT_SEO_HTTPS = String(process.env.OPS_EXPECT_SEO_HTTPS || "false").toLowerCase() === "true";

const ALLOWED_PM2_APPS = csvSet(process.env.OPS_ALLOWED_PM2_APPS || "madkontrollen-seo-gateway,madkontrollen-ops-api");
const RESTARTABLE_PM2_APPS = csvSet(process.env.OPS_RESTARTABLE_PM2_APPS || "madkontrollen-seo-gateway");
const MAX_LOG_LINES = 500;
const CHECK_NOW_MIN_INTERVAL_MS = Number(process.env.OPS_CHECK_NOW_MIN_INTERVAL_MS || 60000);
let lastCheckNowAt = 0;

function csvSet(value) {
  return new Set(String(value || "").split(",").map((item) => item.trim()).filter(Boolean));
}

function jsonLog(tag, fields = {}) {
  const safe = {};
  Object.entries(fields || {}).forEach(([key, value]) => {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = String(value).slice(0, 240);
    }
  });
  console.log("OPS LOG", tag, JSON.stringify(safe));
}

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function requireOpsAuth(req, res, next) {
  const authorization = String(req.headers.authorization || "");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!OPS_TOKEN) {
    res.status(503).json({ ok: false, error: "ops_token_not_configured" });
    return;
  }
  if (!timingSafeEqualString(token, OPS_TOKEN)) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  next();
}

function execFileAsync(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 15000, maxBuffer: 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function isAllowedPm2App(appName, allowedSet = ALLOWED_PM2_APPS) {
  return allowedSet.has(String(appName || "").trim());
}

function isAllowedDomain(domain) {
  const clean = String(domain || "").toLowerCase().trim();
  const escapedRoot = ROOT_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^[a-z0-9-]+\\.${escapedRoot}$`).test(clean);
}

function safeDomainFromDir(dirname) {
  const clean = String(dirname || "").toLowerCase();
  return isAllowedDomain(clean) ? clean : "";
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch (_error) {
    return false;
  }
}

async function readSnippet(filePath, maxBytes = 200000) {
  try {
    const handle = await fs.open(filePath, "r");
    try {
      const buffer = Buffer.alloc(maxBytes);
      const result = await handle.read(buffer, 0, maxBytes, 0);
      return buffer.subarray(0, result.bytesRead).toString("utf8");
    } finally {
      await handle.close();
    }
  } catch (_error) {
    return "";
  }
}

function requestUrl(url, method = "GET", headers = {}, body = "") {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.request(parsed, {
      method,
      headers,
      timeout: 10000
    }, (res) => {
      let responseBody = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { responseBody += chunk; });
      res.on("end", () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, headers: res.headers, body: responseBody }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (error) => resolve({ ok: false, status: 0, error: String(error?.message || "request_failed") }));
    if (body) req.write(body);
    req.end();
  });
}

function isHealthyStatus(status) {
  return Number(status) >= 200 && Number(status) < 400;
}

async function getPm2Status() {
  const { stdout } = await execFileAsync("pm2", ["jlist"]);
  const list = JSON.parse(stdout || "[]");
  return list
    .filter((proc) => isAllowedPm2App(proc.name))
    .map((proc) => ({
      name: proc.name,
      status: proc.pm2_env?.status || "unknown",
      cpu: Number(proc.monit?.cpu || 0),
      memory: Number(proc.monit?.memory || 0),
      restarts: Number(proc.pm2_env?.restart_time || 0),
      uptimeMs: proc.pm2_env?.pm_uptime ? Date.now() - Number(proc.pm2_env.pm_uptime) : 0,
      pid: Number(proc.pid || 0)
    }));
}

async function listSeoSites() {
  const entries = await fs.readdir(SEO_SITES_ROOT, { withFileTypes: true }).catch(() => []);
  const domains = entries.map((entry) => entry.isDirectory() ? safeDomainFromDir(entry.name) : "").filter(Boolean).sort();
  const results = [];
  for (const domain of domains) {
    const siteDir = path.join(SEO_SITES_ROOT, domain);
    const indexPath = path.join(siteDir, "index.html");
    const robotsPath = path.join(siteDir, "robots.txt");
    const sitemapPath = path.join(siteDir, "sitemap.xml");
    const indexHtml = await readSnippet(indexPath);
    const httpLive = await requestUrl(`http://${domain}/`, "GET");
    const httpsLive = await requestUrl(`https://${domain}/`, "GET");
    const primary = EXPECT_SEO_HTTPS ? httpsLive : httpLive;
    const fallback = EXPECT_SEO_HTTPS ? httpLive : httpsLive;
    results.push({
      domain,
      files: {
        index: await fileExists(indexPath),
        robots: await fileExists(robotsPath),
        sitemap: await fileExists(sitemapPath)
      },
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
      ctaFound: /class=["'][^"']*action[^"']*["'][^>]+href=["'][^"']+["']/i.test(indexHtml || primary.body || fallback.body) || /Bestil|Besøg/i.test(indexHtml || primary.body || fallback.body),
      canonicalFound: /<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']+["']/i.test(indexHtml || primary.body || fallback.body),
      updatedAt: await getFileMtime(indexPath)
    });
  }
  return results;
}

async function getFileMtime(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.mtime.toISOString();
  } catch (_error) {
    return "";
  }
}

async function restartPm2App(appName) {
  if (!isAllowedPm2App(appName, RESTARTABLE_PM2_APPS)) {
    return { ok: false, error: "app_not_restartable" };
  }
  await execFileAsync("pm2", ["restart", appName]);
  jsonLog("pm2_restart", { app: appName });
  return { ok: true, app: appName };
}

async function getPm2Logs(appName, lines) {
  if (!isAllowedPm2App(appName)) {
    return { ok: false, error: "app_not_allowed" };
  }
  const safeLines = Math.max(1, Math.min(Number(lines || 100), MAX_LOG_LINES));
  const { stdout } = await execFileAsync("pm2", ["logs", appName, "--lines", String(safeLines), "--nostream", "--raw"]);
  return { ok: true, app: appName, lines: safeLines, logs: stdout.slice(-20000) };
}

async function rebuildSeoSite(domain) {
  const cleanDomain = String(domain || "").toLowerCase().trim();
  if (!isAllowedDomain(cleanDomain)) {
    return { ok: false, error: "domain_not_allowed" };
  }
  if (!GATEWAY_TOKEN) {
    return { ok: false, error: "gateway_token_not_configured" };
  }
  const body = JSON.stringify({ domain: cleanDomain, reason: "ops_center" });
  const result = await requestUrl(`http://127.0.0.1:${GATEWAY_PORT}/internal/rebuild-site`, "POST", {
    Authorization: `Bearer ${GATEWAY_TOKEN}`,
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  }, body);
  jsonLog("seo_rebuild", { domain: cleanDomain, status: result.status, ok: result.ok });
  let payload = {};
  try {
    payload = JSON.parse(result.body || "{}");
  } catch (_error) {
    payload = {};
  }
  return { ok: result.ok, status: result.status, domain: cleanDomain, result: payload, error: result.error || payload.error || "" };
}

async function readEvents(limit = 80) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 80), 300));
  const events = await readEventRecords();
  return events.slice(-safeLimit).reverse();
}

async function readEventRecords() {
  const raw = await fs.readFile(EVENTS_FILE, "utf8").catch(() => "");
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_error) {
        return null;
      }
    })
    .filter(Boolean);
}

async function writeEventRecords(events) {
  await fs.mkdir(OPS_DATA_DIR, { recursive: true });
  const body = events.length ? `${events.map((item) => JSON.stringify(item)).join("\n")}\n` : "";
  await fs.writeFile(EVENTS_FILE, body, "utf8");
}

async function clearEventsToArchive() {
  const events = await readEventRecords();
  if (!events.length) return { ok: true, archived: 0 };
  const archivedAt = new Date().toISOString();
  await fs.mkdir(OPS_DATA_DIR, { recursive: true });
  await fs.appendFile(EVENTS_ARCHIVE_FILE, events.map((item) => JSON.stringify({ ...item, archivedAt })).join("\n") + "\n", "utf8");
  await writeEventRecords([]);
  jsonLog("events_clear", { archived: events.length });
  return { ok: true, archived: events.length, archiveFile: EVENTS_ARCHIVE_FILE };
}

async function acknowledgeEvents(input) {
  const requested = Array.isArray(input?.ids) ? input.ids : input?.id ? [input.id] : [];
  const ids = new Set(requested.map((id) => String(id || "").trim()).filter(Boolean));
  if (!ids.size) return { ok: false, error: "event_id_required" };
  const events = await readEventRecords();
  const acknowledgedAt = new Date().toISOString();
  let acknowledged = 0;
  const next = events.map((item) => {
    if (!ids.has(String(item.id || ""))) return item;
    acknowledged += item.acknowledged ? 0 : 1;
    return { ...item, acknowledged: true, acknowledgedAt };
  });
  await writeEventRecords(next);
  jsonLog("events_ack", { requested: ids.size, acknowledged });
  return { ok: true, requested: ids.size, acknowledged };
}

async function readSnapshot() {
  try {
    return JSON.parse(await fs.readFile(SNAPSHOT_FILE, "utf8"));
  } catch (_error) {
    return null;
  }
}

async function runCheckNow() {
  const now = Date.now();
  if (now - lastCheckNowAt < CHECK_NOW_MIN_INTERVAL_MS) {
    return { ok: false, error: "rate_limited", retryAfterMs: CHECK_NOW_MIN_INTERVAL_MS - (now - lastCheckNowAt) };
  }
  lastCheckNowAt = now;
  const scriptPath = path.join(__dirname, "ops-watcher.js");
  const { stdout } = await execFileAsync(process.execPath, [scriptPath, "--check-once"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, OPS_WATCHER_NO_INTERVAL: "1" },
    timeout: 60000,
    maxBuffer: 1024 * 1024
  });
  let payload = {};
  try {
    payload = JSON.parse(stdout.trim().split(/\r?\n/).pop() || "{}");
  } catch (_error) {
    payload = { raw: stdout.slice(-4000) };
  }
  return { ok: true, result: payload };
}

async function summarizeWithOllama(events) {
  const baseUrl = String(process.env.OLLAMA_BASE_URL || "").trim().replace(/\/+$/, "");
  const model = String(process.env.OLLAMA_MODEL || "qwen2.5-coder").trim();
  if (!baseUrl) return { ok: false, skipped: true, reason: "ollama_not_configured" };
  const compactEvents = events.slice(0, 20).map((event) => ({
    severity: event.severity,
    source: event.source,
    title: event.title,
    message: event.message,
    timestamp: event.timestamp
  }));
  const body = JSON.stringify({
    model,
    stream: false,
    prompt: `Du er Madkontrollen Ops Center. Opsummer disse drift-events kort på dansk. Du må kun vurdere og opsummere, ikke foreslå shell-kommandoer.\n\n${JSON.stringify(compactEvents, null, 2)}`
  });
  const response = await requestUrl(`${baseUrl}/api/generate`, "POST", {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  }, body);
  if (!response.ok) return { ok: false, error: response.error || `http_${response.status}` };
  let payload = {};
  try {
    payload = JSON.parse(response.body || "{}");
  } catch (_error) {
    payload = {};
  }
  return { ok: true, model, summary: `AI vurdering: ${String(payload.response || "").trim()}` };
}

export function createOpsApp() {
  const app = express();
  app.use(express.json({ limit: "32kb" }));

  app.use("/api/ops", requireOpsAuth);

  app.get("/api/ops/health", async (_req, res) => {
    const pm2 = await getPm2Status().catch((error) => ({ error: String(error?.message || "pm2_failed") }));
    res.json({
      ok: true,
      service: "madkontrollen-ops-api",
      uptimeSec: Math.round(process.uptime()),
      sitesRoot: SEO_SITES_ROOT,
      rootDomain: ROOT_DOMAIN,
      expectSeoHttps: EXPECT_SEO_HTTPS,
      pm2Available: Array.isArray(pm2),
      pm2
    });
  });

  app.get("/api/ops/pm2", async (_req, res) => {
    try {
      res.json({ ok: true, apps: await getPm2Status() });
    } catch (error) {
      res.status(500).json({ ok: false, error: String(error?.message || "pm2_failed").slice(0, 180) });
    }
  });

  app.get("/api/ops/sites", async (_req, res) => {
    try {
      res.json({ ok: true, sites: await listSeoSites() });
    } catch (error) {
      res.status(500).json({ ok: false, error: String(error?.message || "sites_failed").slice(0, 180) });
    }
  });

  app.get("/api/ops/logs", async (req, res) => {
    const appName = String(req.query.app || "madkontrollen-seo-gateway").trim();
    const result = await getPm2Logs(appName, req.query.lines).catch((error) => ({ ok: false, error: String(error?.message || "logs_failed").slice(0, 180) }));
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.post("/api/ops/pm2/restart", async (req, res) => {
    const appName = String(req.body?.app || "").trim();
    const result = await restartPm2App(appName).catch((error) => ({ ok: false, error: String(error?.message || "restart_failed").slice(0, 180) }));
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.post("/api/ops/seo/rebuild", async (req, res) => {
    const result = await rebuildSeoSite(req.body?.domain).catch((error) => ({ ok: false, error: String(error?.message || "rebuild_failed").slice(0, 180) }));
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.get("/api/ops/events", async (req, res) => {
    const events = await readEvents(req.query.limit).catch(() => []);
    res.json({ ok: true, events });
  });

  app.post("/api/ops/events/clear", async (_req, res) => {
    const result = await clearEventsToArchive().catch((error) => ({ ok: false, error: String(error?.message || "clear_failed").slice(0, 180) }));
    res.status(result.ok ? 200 : 500).json(result);
  });

  app.post("/api/ops/events/ack", async (req, res) => {
    const result = await acknowledgeEvents(req.body).catch((error) => ({ ok: false, error: String(error?.message || "ack_failed").slice(0, 180) }));
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.get("/api/ops/snapshot", async (_req, res) => {
    res.json({ ok: true, snapshot: await readSnapshot() });
  });

  app.post("/api/ops/check-now", async (_req, res) => {
    const result = await runCheckNow().catch((error) => ({ ok: false, error: String(error?.message || "check_failed").slice(0, 180) }));
    res.status(result.ok ? 200 : result.error === "rate_limited" ? 429 : 500).json(result);
  });

  app.post("/api/ops/ai/summarize", async (req, res) => {
    const events = Array.isArray(req.body?.events) ? req.body.events : await readEvents(20);
    const result = await summarizeWithOllama(events).catch((error) => ({ ok: false, error: String(error?.message || "ai_failed").slice(0, 180) }));
    res.status(result.ok || result.skipped ? 200 : 400).json(result);
  });

  app.use("/admin", express.static(PUBLIC_ADMIN_ROOT, { extensions: ["html"] }));
  app.get("/", (_req, res) => res.redirect("/admin/ops.html"));
  app.use((_req, res) => res.status(404).json({ ok: false, error: "not_found" }));

  return app;
}

if (process.env.OPS_API_NO_LISTEN !== "1") {
  createOpsApp().listen(PORT, "127.0.0.1", () => {
    jsonLog("listening", { port: PORT, sitesRoot: SEO_SITES_ROOT });
  });
}
