import { getAllLagerRoutes } from "../routes/route-registry.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function list(items = [], emptyText = "Ingen") {
  if (!items.length) return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  return `<ul>${items.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join("")}</ul>`;
}

export function getRouteByFile(file) {
  const normalized = String(file || "index.html").split(/[?#]/)[0].split("/").pop() || "index.html";
  return getAllLagerRoutes().find((route) => route.file === normalized) || null;
}

export function renderRouteNavigation(routes, target) {
  if (!target) return;
  const current = getRouteByFile(globalThis?.location?.pathname || "index.html")?.file || "index.html";
  target.innerHTML = `
    <nav class="route-navigation" aria-label="Lagerkontrol staging routes">
      ${routes.map((route) => `
        <a class="${route.file === current ? "is-active" : ""}" href="./${escapeHtml(route.file)}">
          <span>${escapeHtml(route.title)}</span>
          <small>${escapeHtml(route.parityStatus)}</small>
        </a>
      `).join("")}
    </nav>
  `;
}

export function renderRouteShell(route, target) {
  if (!target || !route) return;
  target.innerHTML = `
    <section class="route-hero">
      <p class="eyebrow">Lagerkontrol - staging read-only</p>
      <h1>${escapeHtml(route.title)}</h1>
      <p class="lead">${escapeHtml(route.purpose)}</p>
      <div class="badge-row">
        <span class="badge">Route: ${escapeHtml(route.file)}</span>
        <span class="badge">Parity: ${escapeHtml(route.parityStatus)}</span>
        <span class="badge">Web: ${route.webRelevant ? "ja" : "nej"}</span>
        <span class="badge">APK: ${route.apkRelevant ? "ja" : "nej"}</span>
      </div>
    </section>

    <section class="section warning">
      <h2>Ingen production writes er aktiveret</h2>
      <p>Denne staging-shell viser kun metadata. Firestore writes, Storage uploads og callable writes er slået fra.</p>
    </section>

    <section class="route-grid">
      <article class="route-card">
        <h2>Datasektioner</h2>
        ${list(route.collections, "Ingen collections for denne route")}
      </article>
      <article class="route-card">
        <h2>Read-only handlinger</h2>
        ${list(route.readActions, "Ingen read actions")}
      </article>
      <article class="route-card">
        <h2>Deaktiverede handlinger</h2>
        ${list(route.disabledWriteActions, "Ingen write actions")}
      </article>
    </section>

    <p class="back-link"><a href="./index.html">Tilbage til staging index</a></p>
  `;
}
