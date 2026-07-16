function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatQuantity(value, unit = "") {
  if (value === undefined || value === null || value === "") return "Ikke angivet";
  const number = Number(value);
  const text = Number.isFinite(number)
    ? new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 }).format(number)
    : String(value);
  return `${text}${unit ? ` ${unit}` : ""}`;
}

export function formatCurrencyDkk(value) {
  if (value === undefined || value === null || value === "") return "Ikke angivet";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 2
  }).format(number);
}

function statusBadge(item = {}) {
  return item.active
    ? `<span class="badge is-active">Aktiv</span>`
    : `<span class="badge is-inactive">Inaktiv</span>`;
}

function itemCard(item = {}) {
  return `
    <article class="item-card">
      <div class="item-card-head">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.category || "Ikke angivet")} · ${escapeHtml(item.unit || "Enhed ikke angivet")}</p>
        </div>
        ${statusBadge(item)}
      </div>
      <dl class="item-facts">
        <div><dt>Beholdning</dt><dd>${escapeHtml(formatQuantity(item.quantity, item.unit))}</dd></div>
        <div><dt>Min.</dt><dd>${escapeHtml(formatQuantity(item.minQuantity, item.unit))}</dd></div>
        <div><dt>Kostpris</dt><dd>${escapeHtml(formatCurrencyDkk(item.costPrice))}</dd></div>
        <div><dt>Salgspris</dt><dd>${escapeHtml(formatCurrencyDkk(item.salesPrice))}</dd></div>
      </dl>
      <button class="disabled-action" type="button" disabled>Deaktiveret i staging read-only</button>
    </article>
  `;
}

export function renderInventoryItemsWarnings(warnings = [], target) {
  if (!target) return;
  const items = Array.isArray(warnings) ? warnings.filter(Boolean) : [];
  target.innerHTML = items.length
    ? `<section class="dashboard-warnings">${items.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}</section>`
    : "";
}

export function renderInventoryItemsList(result, target) {
  if (!target) return;
  const safe = result || {};
  const items = Array.isArray(safe.items) ? safe.items : [];
  target.innerHTML = `
    <section class="section items-readonly">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Varer read-only</p>
          <h2>Vareliste</h2>
        </div>
        <span class="badge">staging-readonly · ${escapeHtml(safe.source || "empty")}</span>
      </div>
      <p class="muted">Ingen production writes er aktiveret. Opret, rediger og slet er slået fra.</p>
      ${items.length
        ? `<div class="items-grid">${items.map(itemCard).join("")}</div>`
        : `<div class="empty-state">Ingen varer fundet i staging read-only.</div>`}
    </section>
  `;
}
