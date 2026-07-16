function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) return "Ukendt tidspunkt";
  if (typeof value?.toDate === "function") return formatDate(value.toDate());
  if (typeof value?.seconds === "number") return formatDate(new Date(value.seconds * 1000));
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Ukendt tidspunkt";
  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function rowTitle(row = {}) {
  return row.productName || row.itemName || row.name || row.title || row.supplierName || row.supplier || row.type || row.id || "Ukendt";
}

function rowTime(row = {}) {
  return row.completedAt || row.receivedAt || row.countedAt || row.createdAt || row.updatedAt || row.date;
}

function renderList(title, rows, emptyText) {
  const items = Array.isArray(rows) ? rows : [];
  return `
    <article class="dashboard-list-card">
      <h3>${escapeHtml(title)}</h3>
      ${items.length ? `
        <ul class="dashboard-list">
          ${items.map((row) => `
            <li>
              <strong>${escapeHtml(rowTitle(row))}</strong>
              <span>${escapeHtml(formatDate(rowTime(row)))}</span>
            </li>
          `).join("")}
        </ul>
      ` : `<p class="muted">${escapeHtml(emptyText)}</p>`}
    </article>
  `;
}

export function renderDashboardWarnings(warnings = [], target) {
  if (!target) return;
  const items = Array.isArray(warnings) ? warnings.filter(Boolean) : [];
  target.innerHTML = items.length
    ? `<section class="dashboard-warnings">${items.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}</section>`
    : "";
}

export function renderDashboardSummary(summary, target) {
  if (!target) return;
  const safe = summary || {};
  target.innerHTML = `
    <section class="section dashboard-summary">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Dashboard read-only</p>
          <h2>Lageroverblik</h2>
        </div>
        <span class="badge">staging-readonly · ${escapeHtml(safe.source || "empty")}</span>
      </div>

      <div class="summary-cards">
        <article>
          <span>Varer</span>
          <strong>${escapeHtml(safe.itemsCount || 0)}</strong>
        </article>
        <article>
          <span>Aktive partier</span>
          <strong>${escapeHtml(safe.activeBatchesCount || 0)}</strong>
        </article>
        <article>
          <span>Production writes</span>
          <strong>0</strong>
        </article>
      </div>

      <div class="dashboard-lists">
        ${renderList("Seneste optællinger", safe.recentCounts, "Ingen optællinger i read-only staging.")}
        ${renderList("Seneste varebevægelser", safe.recentMovements, "Ingen varebevægelser i read-only staging.")}
        ${renderList("Seneste leverandørbilag", safe.recentSupplierDocuments, "Ingen leverandørbilag i read-only staging.")}
        ${renderList("Seneste varemodtagelser", safe.recentGoodsReceipts, "Ingen varemodtagelser i read-only staging.")}
      </div>
    </section>
  `;
}
