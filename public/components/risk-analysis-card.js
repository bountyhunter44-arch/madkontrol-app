/**
 * Risk Analysis Dashboard Card Component
 * Shows or generates the company's active risk analysis from saved onboarding.
 */

import {
  ensureRiskAnalysisForLocation,
  loadOnboardingFromFirestore,
  loadRiskAnalysisFromFirestore
} from "../modules/egenkontrol/riskAnalysisService.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getControlPointTitle(item) {
  if (typeof item === "string") return item;
  return (
    item?.title ||
    item?.name ||
    item?.label ||
    item?.hazard ||
    item?.controlPoint ||
    item?.category ||
    "Kontrolpunkt"
  );
}

function getControlPointDescription(item) {
  if (!item || typeof item === "string") return "";
  return (
    item.controlRequirement ||
    item.requirement ||
    item.control ||
    item.description ||
    item.action ||
    item.acceptanceCriteria ||
    ""
  );
}

function getRiskAnalysisSourceLabel(riskData) {
  const explicit = riskData?.sourceLabel || riskData?.activeSnapshot?.sourceLabel || "";
  if (explicit) return explicit;

  const source = String(riskData?.source || riskData?.activeSnapshot?.source || "").toLowerCase();
  if (source.includes("haccp")) return "Aktiv HACCP-snapshot";
  return "Aktiv risikoanalyse";
}

function renderControlPointPreview(controlPoints) {
  const visiblePoints = controlPoints.slice(0, 10);

  return `
    <ul class="risk-list">
      ${visiblePoints.map((item) => {
        const title = getControlPointTitle(item);
        const description = getControlPointDescription(item);
        return `
          <li>
            <strong>${escapeHtml(title)}</strong>
            ${description ? `<span>${escapeHtml(description)}</span>` : ""}
          </li>
        `;
      }).join("")}
    </ul>
  `;
}

function renderActiveRiskAnalysis(container, riskData, companyId, locationId, { justGenerated = false } = {}) {
  const controlPoints = Array.isArray(riskData?.controlPoints) ? riskData.controlPoints : [];
  const sourceLabel = justGenerated ? "Ny aktiv risikoanalyse" : getRiskAnalysisSourceLabel(riskData);
  const total = Number(riskData?.totalControlPoints || controlPoints.length || 0);
  const riskUrl = "/modules/egenkontrol/risikoanalyse.html";
  const reportUrl = "/modules/egenkontrol/rapporter.html?mode=authority";
  const savedAnalysisNote = justGenerated
    ? "Analysen er netop genereret og gemt som aktiv risikoanalyse."
    : "Denne analyse er gemt tidligere. Hvis virksomhedens onboarding eller rutiner er ændret, skal risikoanalysen genereres/gemmes igen.";

  container.innerHTML = `
    <div class="risk-card">
      <div class="risk-card-header">
        <div>
          <h3>Virksomhedens aktive risikoanalyse</h3>
          <p>Denne analyse er baseret på virksomhedens onboarding og aktuelle driftsoplysninger.</p>
        </div>
        <span class="risk-source-pill">${escapeHtml(sourceLabel)}</span>
      </div>
      <div class="risk-card-body">
        <div class="risk-summary-row">
          <span class="risk-summary-pill">Kontrolpunkter: <strong>${escapeHtml(total)}</strong></span>
        </div>
        <div class="risk-review-box">
          <strong>Gennemlæs før rapport</strong>
          <p>Kontroller at punkterne passer til virksomhedens drift, udstyr, råvarer og processer.</p>
          ${renderControlPointPreview(controlPoints)}
        </div>
        <p class="risk-note">${escapeHtml(savedAnalysisNote)}</p>
        <p class="risk-note">Inspirationsmodellen er kun vejledende. Den aktive risikoanalyse er virksomhedens dokumentation.</p>
        <div class="risk-actions">
          <a href="${escapeHtml(riskUrl)}" class="btn btn-secondary">Se hele risikoanalysen</a>
          <a href="${escapeHtml(reportUrl)}" class="btn btn-secondary">Åbn myndighedsrapport</a>
        </div>
      </div>
    </div>
  `;
}

function renderMissingRiskAnalysis(container, companyId, locationId, { hasOnboarding }) {
  const reportUrl = "/modules/egenkontrol/rapporter.html?mode=authority";

  container.innerHTML = `
    <div class="risk-card">
      <div class="risk-card-header">
        <div>
          <h3>Ingen aktiv risikoanalyse fundet</h3>
          <p>Der er ikke fundet en gemt risikoanalyse baseret på virksomhedens onboarding og driftsvalg.</p>
        </div>
      </div>
      <div class="risk-card-body">
        <div class="risk-review-box">
          <strong>Aktiv analyse mangler</strong>
          <p>${hasOnboarding
            ? "Der findes en gemt onboardingprofil. Du kan generere en aktiv risikoanalyse her og gennemlæse den før rapporten åbnes."
            : "Generering kræver gemt onboardingprofil."}</p>
        </div>
        <p class="risk-note">Inspirationsmodellen er kun vejledende. Den aktive risikoanalyse er virksomhedens dokumentation.</p>
        <div class="risk-actions">
          <button type="button" class="btn btn-secondary" id="generateActiveRiskAnalysisBtn" ${hasOnboarding ? "" : "disabled"}>
            ${hasOnboarding ? "Generér aktiv risikoanalyse" : "Generering kræver gemt onboardingprofil."}
          </button>
          <a href="${escapeHtml(reportUrl)}" class="btn btn-secondary">Åbn myndighedsrapport</a>
        </div>
      </div>
    </div>
  `;
}

function setRiskCardLoading(container, message) {
  container.innerHTML = `
    <div class="risk-card">
      <div class="risk-card-body">
        <div class="risk-loading">${escapeHtml(message)}</div>
      </div>
    </div>
  `;
}

async function generateActiveRiskAnalysis(container, companyId, locationId, onboardingData) {
  setRiskCardLoading(container, "Genererer og gemmer aktiv risikoanalyse fra onboarding...");

  const generated = await ensureRiskAnalysisForLocation({
    companyId,
    locationId,
    onboardingData
  });

  const saved = await loadRiskAnalysisFromFirestore(companyId, locationId);
  const riskData = saved || generated;
  const controlPoints = Array.isArray(riskData?.controlPoints) ? riskData.controlPoints : [];

  console.log("[dashboard risk result]", {
    sourceLabel: "Ny aktiv risikoanalyse",
    controlPointsCount: controlPoints.length,
    hasData: controlPoints.length > 0
  });

  if (!controlPoints.length) {
    throw new Error("Der blev ikke genereret kontrolpunkter fra onboardingprofilen.");
  }

  renderActiveRiskAnalysis(container, riskData, companyId, locationId, { justGenerated: true });
}

export async function loadRiskAnalysisCard(db, companyId, locationId) {
  const container = document.getElementById("risk-analysis-container");
  if (!container) return;

  injectStyles();
  setRiskCardLoading(container, "Henter virksomhedens aktive risikoanalyse...");

  try {
    console.log("[dashboard risk context]", { companyId, locationId });

    let riskData = await loadRiskAnalysisFromFirestore(companyId, locationId);
    let controlPoints = Array.isArray(riskData?.controlPoints) ? riskData.controlPoints : [];
    const sourceLabel = riskData ? getRiskAnalysisSourceLabel(riskData) : "";

    console.log("[dashboard risk result]", {
      sourceLabel,
      controlPointsCount: controlPoints.length,
      hasData: Boolean(riskData && controlPoints.length > 0)
    });

    if (riskData && controlPoints.length > 0) {
      renderActiveRiskAnalysis(container, riskData, companyId, locationId);
      return;
    }

    const onboardingData = await loadOnboardingFromFirestore(companyId, locationId);
    if (onboardingData) {
      await ensureRiskAnalysisForLocation({
        companyId,
        locationId,
        onboardingData
      });

      riskData = await loadRiskAnalysisFromFirestore(companyId, locationId);
      controlPoints = Array.isArray(riskData?.controlPoints) ? riskData.controlPoints : [];

      if (riskData && controlPoints.length > 0) {
        renderActiveRiskAnalysis(container, riskData, companyId, locationId, { justGenerated: true });
        return;
      }
    }

    renderMissingRiskAnalysis(container, companyId, locationId, { hasOnboarding: Boolean(onboardingData) });

    const generateButton = container.querySelector("#generateActiveRiskAnalysisBtn");
    if (generateButton && onboardingData) {
      generateButton.addEventListener("click", async () => {
        generateButton.disabled = true;

        try {
          await generateActiveRiskAnalysis(container, companyId, locationId, onboardingData);
        } catch (error) {
          console.error("[risk-analysis-card] Kunne ikke generere aktiv risikoanalyse:", error);
          renderMissingRiskAnalysis(container, companyId, locationId, { hasOnboarding: true });
          const retryButton = container.querySelector("#generateActiveRiskAnalysisBtn");
          if (retryButton) retryButton.disabled = false;
        }
      });
    }
  } catch (error) {
    console.warn("[risk-analysis-card] Kunne ikke hente aktiv risikoanalyse:", error);
    console.log("[dashboard risk result]", {
      sourceLabel: "",
      controlPointsCount: 0,
      hasData: false
    });
    renderMissingRiskAnalysis(container, companyId, locationId, { hasOnboarding: false });
  }
}

function injectStyles() {
  if (document.getElementById("risk-analysis-styles")) return;
  const style = document.createElement("style");
  style.id = "risk-analysis-styles";
  style.textContent = `
    .risk-card { background:#fff; border:1px solid #d7e5d6; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05); }
    .risk-card-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; padding:20px 24px; background:#f7fbf5; border-bottom:1px solid #d7e5d6; }
    .risk-card-header h3 { margin:0; font-size:18px; color:#111827; }
    .risk-card-header p { margin:6px 0 0; font-size:13px; color:#53645a; line-height:1.5; }
    .risk-card-body { padding:20px 24px; }
    .risk-source-pill,
    .risk-summary-pill { display:inline-flex; align-items:center; min-height:28px; padding:5px 10px; border:1px solid #cfe3cf; border-radius:999px; background:#fff; color:#2f5b34; font-size:12px; font-weight:700; white-space:nowrap; }
    .risk-summary-row { display:flex; gap:8px; margin-bottom:14px; }
    .risk-review-box { border:1px solid #d7e5d6; border-radius:8px; padding:14px 16px; background:#fbfdf9; }
    .risk-review-box > strong { display:block; color:#26332a; font-size:14px; margin-bottom:4px; }
    .risk-review-box > p { margin:0 0 12px; color:#53645a; font-size:13px; line-height:1.5; }
    .risk-list { margin:0 0 0 18px; padding:0; list-style:disc; }
    .risk-list li { margin-bottom:10px; font-size:14px; color:#26332a; line-height:1.45; }
    .risk-list li span { display:block; margin-top:2px; color:#53645a; font-size:13px; }
    .risk-note { margin:16px 0 0; color:#53645a; font-size:13px; line-height:1.5; }
    .risk-loading { color:#53645a; font-size:14px; }
    .risk-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:20px; padding-top:16px; border-top:1px solid #e5e7eb; }
    .risk-actions button[disabled] { opacity:.72; cursor:not-allowed; }
  `;
  document.head.appendChild(style);
}

export default { loadRiskAnalysisCard };
