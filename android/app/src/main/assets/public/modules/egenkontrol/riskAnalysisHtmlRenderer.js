// SLET FRA HER
import { t } from "/modules/i18n/index.js";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderList(items = [], lang = "da") {
  if (!items.length) return `<p class="risk-empty">${t("risk.label.no_data", lang) || "Ingen registrerede oplysninger."}</p>`;
  return `<ul class="risk-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderSection(section, lang = "da") {
  const titleKey = section.titleKey || (section.key ? `risk.${section.key}.title` : null);
  const bodyKey  = section.bodyKey  || (section.key ? `risk.${section.key}.body`  : null);
  const title = (titleKey && t(titleKey, lang)) || section.title;
  const body  = (bodyKey  && t(bodyKey,  lang)) || section.body;
  return `
    <article class="risk-section">
      <div class="risk-section-meta">
        <span class="risk-badge risk-badge-${escapeHtml(section.classification.toLowerCase())}">
          ${escapeHtml(section.classification)}
        </span>
      </div>

      <h3 class="risk-section-title">${escapeHtml(title)}</h3>

      <div class="risk-section-body">
        ${escapeHtml(body).replace(/\n/g, "<br>")}
      </div>

      <div class="risk-grid">
        <div class="risk-card">
          <h4>${t("risk.label.products", lang) || "Produkter"}</h4>
          ${renderList(section.products, lang)}
        </div>

        <div class="risk-card">
          <h4>${t("risk.label.ingredients", lang) || "Ingredienser"}</h4>
          ${renderList(section.ingredients, lang)}
        </div>

        <div class="risk-card risk-card-full">
          <h4>${t("risk.label.controls", lang) || "Kontroller"}</h4>
          ${renderList(section.controls, lang)}
        </div>
      </div>
    </article>
  `;
}

function renderCoverPage(page, lang = "da") {
  const title = t(page.titleKey || "risk.page.cover.title", lang) || page.title;
  const intro = t(page.introKey || "risk.page.cover.intro", lang) || page.intro;
  const locale = ["ar", "fa", "ur"].includes(lang) ? "ar-SA" : lang === "th" ? "th-TH" : "da-DK";
  return `
    <section class="risk-page risk-cover-page" data-page-type="cover">
      <div class="risk-cover-inner">
        <p class="risk-kicker">${t("risk.kicker", lang) || "Madkontrollen Pro"}</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="risk-cover-intro">${escapeHtml(intro)}</p>

        <div class="risk-company-box">
          <div><strong>${t("risk.company.label", lang) || "Virksomhed:"}</strong> ${escapeHtml(page.company.companyName || "-")}</div>
          <div><strong>${t("risk.company.address", lang) || "Adresse:"}</strong> ${escapeHtml(page.company.address || "-")}</div>
          <div><strong>${t("risk.company.type", lang) || "Type:"}</strong> ${escapeHtml(page.company.restaurantType || "-")}</div>
          <div><strong>${t("risk.company.created", lang) || "Oprettet:"}</strong> ${escapeHtml(new Date(page.company.createdAt).toLocaleDateString(locale))}</div>
        </div>
      </div>
    </section>
  `;
}

function renderHazardPage(page, lang = "da") {
  const titleKey = page.titleKey || (page.pageGroup ? `risk.page.${page.pageGroup}.title` : null);
  const title = (titleKey && t(titleKey, lang)) || page.title;
  return `
    <section class="risk-page" data-page-type="${escapeHtml(page.pageType)}" data-page-group="${escapeHtml(page.pageGroup)}">
      <header class="risk-page-header">
        <h2>${escapeHtml(title)}</h2>
      </header>

      <div class="risk-page-body">
        ${page.sections.map((s) => renderSection(s, lang)).join("")}
      </div>
    </section>
  `;
}

function renderSummaryPage(page, lang = "da") {
  const title = t(page.titleKey || "risk.page.summary.title", lang) || page.title;
  return `
    <section class="risk-page" data-page-type="summary">
      <header class="risk-page-header">
        <h2>${escapeHtml(title)}</h2>
      </header>

      <div class="risk-page-body">
        <div class="risk-summary-table">
          ${page.items.map((item) => {
            const itemTitleKey = item.titleKey || (item.key ? `risk.${item.key}.title` : null);
            const itemTitle = (itemTitleKey && t(itemTitleKey, lang)) || item.title;
            return `
            <div class="risk-summary-row">
              <div class="risk-summary-title">
                <strong>${escapeHtml(itemTitle)}</strong>
              </div>
              <div class="risk-summary-classification">
                ${escapeHtml(item.classification)}
              </div>
              <div class="risk-summary-controls">
                ${item.controls.map((control) => `<span class="risk-chip">${escapeHtml(control)}</span>`).join("")}
              </div>
            </div>
          `}).join("")}
        </div>
      </div>
    </section>
  `;
}

export function renderRiskAnalysisHtml(riskAnalysis, lang = "da") {
  if (!riskAnalysis || !Array.isArray(riskAnalysis.pages)) {
    return `<section class="risk-page"><p>${t("risk.label.not_found", lang) || "Ingen risikoanalyse fundet."}</p></section>`;
  }

  return riskAnalysis.pages.map((page) => {
    if (page.pageType === "cover") return renderCoverPage(page, lang);
    if (page.pageType === "summary") return renderSummaryPage(page, lang);
    return renderHazardPage(page, lang);
  }).join("");
}

// TIL HER