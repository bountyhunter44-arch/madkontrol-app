const state = {
  token: localStorage.getItem("opsCenterToken") || "",
  pm2: [],
  sites: [],
  events: [],
  snapshot: null
};

const $ = (id) => document.getElementById(id);

function toast(message, isError = false) {
  const el = $("toast");
  el.textContent = message;
  el.style.background = isError ? "#b91c1c" : "#102016";
  el.classList.add("active");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("active"), 3600);
}

async function api(path, options = {}) {
  if (!state.token) {
    toast("Token mangler.", true);
    throw new Error("Token mangler.");
  }
  console.debug("[ops-ui] auth request", path);
  const res = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${state.token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    console.debug("[ops-ui] auth failed", path);
    throw new Error("Forkert token");
  }
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value > 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(value / 1024)} KB`;
}

function statusClass(ok) {
  return ok ? "status" : "status bad";
}

function renderHealth(data) {
  $("healthView").innerHTML = [
    ["Service", data.service || "ops-api"],
    ["Uptime", `${data.uptimeSec || 0}s`],
    ["PM2", data.pm2Available ? "OK" : "Fejl"],
    ["SEO HTTPS", data.expectSeoHttps ? "Påkrævet" : "Ikke aktiveret endnu"],
    ["Sites root", data.sitesRoot || ""]
  ].map(([label, value]) => `<div class="metric"><strong>${label}</strong><div class="meta">${escapeHtml(value)}</div></div>`).join("");
}

function renderPm2(apps) {
  $("pm2Grid").innerHTML = apps.map((app) => `
    <article class="card">
      <h3>${escapeHtml(app.name)}</h3>
      <span class="${app.status === "online" ? "status" : "status bad"}">${escapeHtml(app.status)}</span>
      <div class="meta">
        <span>CPU: ${Number(app.cpu || 0).toFixed(1)}%</span>
        <span>Memory: ${formatBytes(app.memory)}</span>
        <span>Restarts: ${app.restarts}</span>
        <span>PID: ${app.pid || "-"}</span>
      </div>
      <div class="actions">
        <button class="secondary" data-log-app="${escapeHtml(app.name)}">View logs</button>
        ${app.name === "madkontrollen-seo-gateway" ? `<button class="danger" data-restart-app="${escapeHtml(app.name)}">Restart</button>` : ""}
      </div>
    </article>
  `).join("") || "<p>Ingen whitelisted PM2 apps fundet.</p>";
}

function renderSites(sites) {
  $("sitesGrid").innerHTML = sites.map((site) => `
    <article class="card">
      <h3>${escapeHtml(site.domain)}</h3>
      <div class="meta">
        <span class="${statusClass(site.httpOk)}">${escapeHtml((site.httpProtocol || "http").toUpperCase())} ${site.httpStatus || 0}</span>
        ${site.httpsExpected === false ? `<span>HTTPS ikke aktiveret endnu</span>` : ""}
        ${site.httpsExpected && site.httpsError ? `<span>HTTPS fejl: ${escapeHtml(site.httpsError)}</span>` : ""}
        ${site.httpFallbackStatus ? `<span>Fallback: ${site.httpFallbackStatus}</span>` : ""}
        <span>index.html: ${site.files?.index ? "ja" : "nej"}</span>
        <span>robots.txt: ${site.files?.robots ? "ja" : "nej"}</span>
        <span>sitemap.xml: ${site.files?.sitemap ? "ja" : "nej"}</span>
        <span>CTA: ${site.ctaFound ? "fundet" : "mangler"}</span>
        <span>Canonical: ${site.canonicalFound ? "fundet" : "mangler"}</span>
        <span>Opdateret: ${site.updatedAt || "-"}</span>
      </div>
      <div class="actions">
        <button data-rebuild-domain="${escapeHtml(site.domain)}">Rebuild site</button>
        <a class="button-link" href="https://${escapeHtml(site.domain)}/" target="_blank" rel="noopener"><button class="secondary" type="button">Open live</button></a>
      </div>
    </article>
  `).join("") || "<p>Ingen SEO sites fundet.</p>";
}

function formatTimestamp(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(date);
}

function eventSeverityClass(severity) {
  if (severity === "error") return "event-severity error";
  if (severity === "warning") return "event-severity warning";
  return "event-severity info";
}

function renderEvents(events) {
  $("eventsView").innerHTML = events.map((event) => `
    <article class="event-card${event.acknowledged ? " acknowledged" : ""}">
      <div class="event-row">
        <span class="${eventSeverityClass(event.severity)}">${escapeHtml(event.severity || "info")}</span>
        <strong>${escapeHtml(event.title || event.type || "Ops event")}</strong>
        ${event.acknowledged ? `<span class="status">Håndteret</span>` : ""}
        <time>${escapeHtml(formatTimestamp(event.timestamp))}</time>
      </div>
      <div class="meta">
        <span>Kilde: ${escapeHtml(event.source || "-")}</span>
        ${event.domain || event.data?.domain ? `<span>Site: ${escapeHtml(event.domain || event.data?.domain)}</span>` : ""}
        ${event.app || event.data?.app ? `<span>App: ${escapeHtml(event.app || event.data?.app)}</span>` : ""}
        ${event.message ? `<span>${escapeHtml(event.message)}</span>` : ""}
      </div>
      ${event.ai ? `<div class="ai-note">${escapeHtml(event.ai)}</div>` : ""}
      <div class="actions">
        <button class="secondary" data-ack-event="${escapeHtml(event.id || "")}" ${event.acknowledged || !event.id ? "disabled" : ""}>Marker som håndteret</button>
      </div>
    </article>
  `).join("") || "<p>Ingen ændringer registreret endnu.</p>";
}

async function refreshAll() {
  const [health, pm2, sites, events, snapshot] = await Promise.all([
    api("/api/ops/health"),
    api("/api/ops/pm2"),
    api("/api/ops/sites"),
    api("/api/ops/events"),
    api("/api/ops/snapshot")
  ]);
  state.pm2 = pm2.apps || [];
  state.sites = sites.sites || [];
  state.events = events.events || [];
  state.snapshot = snapshot.snapshot || null;
  renderHealth(health);
  renderPm2(state.pm2);
  renderSites(state.sites);
  renderEvents(state.events);
}

async function loadLogs(appName) {
  const data = await api(`/api/ops/logs?app=${encodeURIComponent(appName)}&lines=160`);
  $("logsView").textContent = data.logs || "Ingen logs.";
  $("logAppSelect").value = appName;
}

async function restartApp(appName) {
  await api("/api/ops/pm2/restart", {
    method: "POST",
    body: JSON.stringify({ app: appName })
  });
  toast(`${appName} restartet`);
  await refreshAll();
}

async function rebuildSite(domain) {
  const data = await api("/api/ops/seo/rebuild", {
    method: "POST",
    body: JSON.stringify({ domain })
  });
  toast(data.ok ? `${domain} rebuild OK` : `${domain} rebuild fejlede`, !data.ok);
  await refreshAll();
}

async function refreshEvents() {
  const data = await api("/api/ops/events");
  state.events = data.events || [];
  renderEvents(state.events);
}

async function clearEvents() {
  if (!window.confirm("Arkiver alle viste drift-events?")) return;
  const data = await api("/api/ops/events/clear", { method: "POST" });
  toast(`Arkiverede ${data.archived || 0} event(s)`);
  await refreshEvents();
}

async function acknowledgeEvent(id) {
  if (!id) return;
  const data = await api("/api/ops/events/ack", {
    method: "POST",
    body: JSON.stringify({ id })
  });
  toast(`Markerede ${data.acknowledged || 0} event(s) som håndteret`);
  await refreshEvents();
}

async function checkNow() {
  const data = await api("/api/ops/check-now", { method: "POST" });
  const count = data.result?.eventCount ?? data.result?.events?.length ?? 0;
  toast(`Check kørt: ${count} event(s)`);
  await refreshAll();
}

async function summarizeEvents() {
  const data = await api("/api/ops/ai/summarize", {
    method: "POST",
    body: JSON.stringify({ events: state.events.slice(0, 12) })
  });
  if (!data.ai) {
    toast(data.reason === "missing_ollama_config" ? "Ollama er ikke konfigureret" : "Ingen AI vurdering");
    return;
  }
  const synthetic = {
    severity: "info",
    source: "ai",
    title: "AI vurdering",
    timestamp: new Date().toISOString(),
    ai: data.ai
  };
  renderEvents([synthetic, ...state.events]);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

document.addEventListener("click", async (event) => {
  const logApp = event.target?.dataset?.logApp;
  const restartAppName = event.target?.dataset?.restartApp;
  const rebuildDomain = event.target?.dataset?.rebuildDomain;
  const ackEventId = event.target?.dataset?.ackEvent;
  try {
    if (logApp) await loadLogs(logApp);
    if (restartAppName) await restartApp(restartAppName);
    if (rebuildDomain) await rebuildSite(rebuildDomain);
    if (ackEventId) await acknowledgeEvent(ackEventId);
  } catch (error) {
    toast(error.message, true);
  }
});

$("saveTokenBtn").addEventListener("click", async () => {
  state.token = $("tokenInput").value.trim();
  if (!state.token) {
    toast("Token mangler.", true);
    return;
  }
  localStorage.setItem("opsCenterToken", state.token);
  try {
    await refreshAll();
    toast("Token gemt");
  } catch (error) {
    toast(error.message, true);
  }
});

$("refreshBtn").addEventListener("click", () => refreshAll().catch((error) => toast(error.message, true)));
$("refreshEventsBtn").addEventListener("click", () => refreshEvents().catch((error) => toast(error.message, true)));
$("clearEventsBtn").addEventListener("click", () => clearEvents().catch((error) => toast(error.message, true)));
$("checkNowBtn").addEventListener("click", () => checkNow().catch((error) => toast(error.message, true)));
$("summarizeEventsBtn").addEventListener("click", () => summarizeEvents().catch((error) => toast(error.message, true)));
$("restartGatewayBtn").addEventListener("click", () => restartApp("madkontrollen-seo-gateway").catch((error) => toast(error.message, true)));
$("loadLogsBtn").addEventListener("click", () => loadLogs($("logAppSelect").value).catch((error) => toast(error.message, true)));

if (state.token) {
  console.debug("[ops-ui] token loaded");
  $("tokenInput").value = state.token;
  refreshAll().catch((error) => toast(error.message, true));
} else {
  toast("Token mangler.", true);
}
