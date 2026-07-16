function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

export function formatReceiptDate(value) {
  if (!value) return "Ukendt dato";
  if (typeof value?.toDate === "function") return formatReceiptDate(value.toDate());
  if (typeof value?.seconds === "number") return formatReceiptDate(new Date(value.seconds * 1000));
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
    received: "Modtaget",
    draft: "Kladde",
    pending: "Afventer",
    cancelled: "Annulleret",
    unknown: "Ukendt"
  };
  return labels[key] || value || "Ukendt";
}

function receiptLine(line = {}) {
  const code = [line.itemNumber, line.ean].filter(Boolean).join(" / ");
  return `
    <li class="receipt-line">
      <div>
        <strong>${escapeHtml(line.itemName || "Ukendt vare")}</strong>
        <span>${escapeHtml(code || "Ingen varenummer/EAN")}</span>
      </div>
      <dl>
        <div><dt>Antal</dt><dd>${escapeHtml(formatQuantity(line.quantity, line.unit))}</dd></div>
        <div><dt>Kostpris</dt><dd>${escapeHtml(formatCurrencyDkk(line.costPrice))}</dd></div>
        <div><dt>Batch/lot</dt><dd>${escapeHtml(line.batch || "Ikke angivet")}</dd></div>
        <div><dt>Udløb</dt><dd>${escapeHtml(formatReceiptDate(line.expiryDate))}</dd></div>
      </dl>
    </li>
  `;
}

function receiptCard(receipt = {}) {
  const lines = Array.isArray(receipt.lines) ? receipt.lines : [];
  return `
    <article class="receipt-card">
      <div class="item-card-head">
        <div>
          <h3>${escapeHtml(receipt.reference || "Varemodtagelse")}</h3>
          <p>${escapeHtml(receipt.supplier || "Ukendt leverandør")}</p>
        </div>
        <span class="badge">${escapeHtml(statusLabel(receipt.status))}</span>
      </div>
      <dl class="item-facts">
        <div><dt>Dato</dt><dd>${escapeHtml(formatReceiptDate(receipt.date || receipt.createdAt))}</dd></div>
        <div><dt>Linjer</dt><dd>${escapeHtml(receipt.lineCount ?? lines.length)}</dd></div>
        <div><dt>Antal varer</dt><dd>${escapeHtml(formatQuantity(receipt.totalQuantity))}</dd></div>
        <div><dt>Total</dt><dd>${escapeHtml(formatCurrencyDkk(receipt.totalAmount))}</dd></div>
        <div><dt>Kilde</dt><dd>${escapeHtml(receipt.source || "Ikke angivet")}</dd></div>
        <div><dt>Tilknyttet bilag</dt><dd>${escapeHtml(receipt.supplierDocumentId || "Ikke angivet")}</dd></div>
        <div><dt>Oprettet</dt><dd>${escapeHtml(formatReceiptDate(receipt.createdAt))}</dd></div>
        <div><dt>Tilstand</dt><dd>Read-only staging</dd></div>
      </dl>
      ${lines.length
        ? `<ul class="receipt-lines">${lines.map(receiptLine).join("")}</ul>`
        : `<div class="empty-state">Ingen linjer fundet på varemodtagelsen.</div>`}
      <div class="disabled-action-row">
        <button class="disabled-action" type="button" disabled>Ny varemodtagelse kommer senere</button>
        <button class="disabled-action" type="button" disabled>Modtag varer kommer senere</button>
        <button class="disabled-action" type="button" disabled>Gem kommer senere</button>
        <button class="disabled-action" type="button" disabled>Opret batch kommer senere</button>
        <button class="disabled-action" type="button" disabled>Bogfør kommer senere</button>
        <button class="disabled-action" type="button" disabled>Upload bilag kommer senere</button>
        <button class="disabled-action" type="button" disabled>Scan bilag kommer senere</button>
      </div>
    </article>
  `;
}

export function renderGoodsReceiptsWarnings(warnings = [], target) {
  if (!target) return;
  const items = Array.isArray(warnings) ? warnings.filter(Boolean) : [];
  target.innerHTML = items.length
    ? `<section class="dashboard-warnings">${items.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}</section>`
    : "";
}

export function renderGoodsReceiptsList(result, target) {
  if (!target) return;
  const safe = result || {};
  const receipts = Array.isArray(safe.receipts) ? safe.receipts : [];
  target.innerHTML = `
    <section class="section receipts-readonly">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Varemodtagelse read-only</p>
          <h2>Eksisterende varemodtagelser</h2>
        </div>
        <span class="badge">staging-readonly · ${escapeHtml(safe.source || "empty")}</span>
      </div>
      <p class="muted">Ingen production writes er aktiveret. Modtagelse, batch-oprettelse, bogføring, upload og scanning er slået fra.</p>
      ${receipts.length
        ? `<div class="receipts-grid">${receipts.map(receiptCard).join("")}</div>`
        : `<div class="empty-state">Ingen varemodtagelser fundet i staging read-only.</div>`}
    </section>
  `;
}
