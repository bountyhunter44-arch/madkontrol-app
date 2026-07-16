function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatCountDate(value) {
  if (!value) return "Ukendt dato";
  if (typeof value?.toDate === "function") return formatCountDate(value.toDate());
  if (typeof value?.seconds === "number") return formatCountDate(new Date(value.seconds * 1000));
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Ukendt dato";
  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatQuantity(value, unit = "") {
  if (value === undefined || value === null || value === "") return "Ikke angivet";
  const number = Number(String(value).replace(",", "."));
  const formatted = Number.isFinite(number)
    ? new Intl.NumberFormat("da-DK", { maximumFractionDigits: 3 }).format(number)
    : String(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function statusLabel(value) {
  const key = String(value || "").toLowerCase();
  const labels = {
    completed: "Afsluttet",
    finished: "Afsluttet",
    draft: "Kladde",
    pending: "Afventer",
    in_progress: "I gang",
    counted: "Optalt",
    adjusted: "Korrigeret",
    cancelled: "Annulleret",
    unknown: "Ukendt"
  };
  return labels[key] || value || "Ukendt";
}

function countLine(line = {}) {
  const code = [line.itemNumber, line.ean].filter(Boolean).join(" / ");
  return `
    <li class="count-line">
      <div>
        <strong>${escapeHtml(line.itemName || "Ukendt vare")}</strong>
        <span>${escapeHtml(code || "Ingen varenummer/EAN")}</span>
      </div>
      <dl>
        <div><dt>Forventet</dt><dd>${escapeHtml(formatQuantity(line.expectedQuantity, line.unit))}</dd></div>
        <div><dt>Optalt</dt><dd>${escapeHtml(formatQuantity(line.countedQuantity, line.unit))}</dd></div>
        <div><dt>Difference</dt><dd>${escapeHtml(formatQuantity(line.difference, line.unit))}</dd></div>
        <div><dt>Batch/lot</dt><dd>${escapeHtml(line.batch || "Ikke angivet")}</dd></div>
        <div><dt>Udløb</dt><dd>${escapeHtml(formatCountDate(line.expiryDate))}</dd></div>
        <div><dt>Note</dt><dd>${escapeHtml(line.note || "Ingen note")}</dd></div>
      </dl>
    </li>
  `;
}

function countCard(count = {}) {
  const lines = Array.isArray(count.lines) ? count.lines : [];
  return `
    <article class="count-card">
      <div class="item-card-head">
        <div>
          <h3>${escapeHtml(count.reference || "Optælling")}</h3>
          <p>${escapeHtml(count.locationName || "Ingen lagerområde angivet")}</p>
        </div>
        <span class="badge">${escapeHtml(statusLabel(count.status))}</span>
      </div>
      <dl class="item-facts">
        <div><dt>Dato</dt><dd>${escapeHtml(formatCountDate(count.date || count.createdAt))}</dd></div>
        <div><dt>Linjer</dt><dd>${escapeHtml(count.lineCount ?? lines.length)}</dd></div>
        <div><dt>Optalte varer</dt><dd>${escapeHtml(count.countedItems ?? "Ikke angivet")}</dd></div>
        <div><dt>Afvigelser</dt><dd>${escapeHtml(count.discrepancies ?? "Ikke angivet")}</dd></div>
        <div><dt>Samlet difference</dt><dd>${escapeHtml(formatQuantity(count.totalDifference))}</dd></div>
        <div><dt>Oprettet af</dt><dd>${escapeHtml(count.createdBy || "Ikke angivet")}</dd></div>
        <div><dt>Oprettet</dt><dd>${escapeHtml(formatCountDate(count.createdAt))}</dd></div>
        <div><dt>Tilstand</dt><dd>Read-only staging</dd></div>
      </dl>
      ${lines.length
        ? `<ul class="count-lines">${lines.map(countLine).join("")}</ul>`
        : `<div class="empty-state">Ingen optællingslinjer fundet på optællingen.</div>`}
      <div class="disabled-action-row">
        <button class="disabled-action" type="button" disabled>Ny optælling kommer senere</button>
        <button class="disabled-action" type="button" disabled>Start optælling kommer senere</button>
        <button class="disabled-action" type="button" disabled>Gem kommer senere</button>
        <button class="disabled-action" type="button" disabled>Afslut optælling kommer senere</button>
        <button class="disabled-action" type="button" disabled>Bogfør difference kommer senere</button>
        <button class="disabled-action" type="button" disabled>Ret beholdning kommer senere</button>
        <button class="disabled-action" type="button" disabled>Opret lagerbevægelse kommer senere</button>
        <button class="disabled-action" type="button" disabled>Scan varer kommer senere</button>
      </div>
    </article>
  `;
}

export function renderInventoryCountsWarnings(warnings = [], target) {
  if (!target) return;
  const items = Array.isArray(warnings) ? warnings.filter(Boolean) : [];
  target.innerHTML = items.length
    ? `<section class="dashboard-warnings">${items.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}</section>`
    : "";
}

export function renderInventoryCountsList(result, target) {
  if (!target) return;
  const safe = result || {};
  const counts = Array.isArray(safe.counts) ? safe.counts : [];
  target.innerHTML = `
    <section class="section counts-readonly">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Optælling read-only</p>
          <h2>Eksisterende lageroptællinger</h2>
        </div>
        <span class="badge">staging-readonly · ${escapeHtml(safe.source || "empty")}</span>
      </div>
      <p class="muted">Ingen production writes er aktiveret. Optælling, beholdningskorrektion, lagerbevægelse, batch-opdatering og scanning er slået fra.</p>
      ${counts.length
        ? `<div class="counts-grid">${counts.map(countCard).join("")}</div>`
        : `<div class="empty-state">Ingen lageroptællinger fundet i staging read-only.</div>`}
    </section>
  `;
}
