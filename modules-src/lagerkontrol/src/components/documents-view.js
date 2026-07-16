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

export function formatDocumentDate(value) {
  if (!value) return "Ukendt dato";
  if (typeof value?.toDate === "function") return formatDocumentDate(value.toDate());
  if (typeof value?.seconds === "number") return formatDocumentDate(new Date(value.seconds * 1000));
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Ukendt dato";
  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

export function bookingStatusLabel(value) {
  const key = String(value || "").toLowerCase();
  const labels = {
    needs_booking: "Mangler bogføring",
    booked: "Bogført",
    not_required: "Ikke nødvendig",
    unknown: "Ukendt"
  };
  return labels[key] || "Ukendt";
}

function documentTypeLabel(value) {
  const key = String(value || "").toLowerCase();
  const labels = {
    supplier_invoice: "Leverandørfaktura",
    supplier_document: "Leverandørdokument",
    receipt: "Kvittering",
    unknown: "Ukendt dokumenttype"
  };
  return labels[key] || "Ukendt dokumenttype";
}

function documentCard(document = {}) {
  return `
    <article class="document-card">
      <div class="item-card-head">
        <div>
          <h3>${escapeHtml(document.name)}</h3>
          <p>${escapeHtml(document.supplier || "Ukendt leverandør")}</p>
        </div>
        <span class="badge">${escapeHtml(bookingStatusLabel(document.bookingStatus))}</span>
      </div>
      <dl class="item-facts">
        <div><dt>Type</dt><dd>${escapeHtml(documentTypeLabel(document.documentType))}</dd></div>
        <div><dt>Dato</dt><dd>${escapeHtml(formatDocumentDate(document.documentDate || document.createdAt))}</dd></div>
        <div><dt>Total</dt><dd>${escapeHtml(formatCurrencyDkk(document.totalAmount))}</dd></div>
        <div><dt>Moms</dt><dd>${escapeHtml(formatCurrencyDkk(document.vatAmount))}</dd></div>
        <div><dt>Kilde</dt><dd>${escapeHtml(document.source || "Ikke angivet")}</dd></div>
        <div><dt>OCR</dt><dd>${escapeHtml(document.ocrStatus || "Ikke kørt")}</dd></div>
      </dl>
      <div class="disabled-action-row">
        <button class="disabled-action" type="button" disabled>Upload kommer senere</button>
        <button class="disabled-action" type="button" disabled>OCR kommer senere</button>
        <button class="disabled-action" type="button" disabled>Bogfør nu kommer senere</button>
      </div>
    </article>
  `;
}

export function renderSupplierDocumentsWarnings(warnings = [], target) {
  if (!target) return;
  const items = Array.isArray(warnings) ? warnings.filter(Boolean) : [];
  target.innerHTML = items.length
    ? `<section class="dashboard-warnings">${items.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}</section>`
    : "";
}

export function renderSupplierDocumentsList(result, target) {
  if (!target) return;
  const safe = result || {};
  const documents = Array.isArray(safe.documents) ? safe.documents : [];
  target.innerHTML = `
    <section class="section documents-readonly">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Bilag read-only</p>
          <h2>Leverandørbilag</h2>
        </div>
        <span class="badge">staging-readonly · ${escapeHtml(safe.source || "empty")}</span>
      </div>
      <p class="muted">Ingen production writes er aktiveret. Upload, OCR og bogføring er slået fra.</p>
      ${documents.length
        ? `<div class="documents-grid">${documents.map(documentCard).join("")}</div>`
        : `<div class="empty-state">Ingen bilag fundet i staging read-only.</div>`}
    </section>
  `;
}
