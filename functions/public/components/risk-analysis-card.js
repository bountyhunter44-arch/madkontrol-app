/**
 * Risk Analysis Dashboard Card Component
 * Shows the first 10 risk items from the static library with a link to risikoanalyse.html
 */

import { RISK_ANALYSIS_LIBRARY } from "../modules/egenkontrol/risk-analysis-library.js";

export async function loadRiskAnalysisCard(db, companyId, locationId) {
  const container = document.getElementById('risk-analysis-container');
  if (!container) return;

  const items = RISK_ANALYSIS_LIBRARY.slice(0, 10);

  container.innerHTML = `
    <div class="risk-card">
      <div class="risk-card-header">
        <h3>📋 Risikoanalyse</h3>
      </div>
      <div class="risk-card-body">
        <ul class="risk-list">
          ${items.map(item => `<li>${item.title || item.id}</li>`).join('')}
        </ul>
        <div class="risk-actions">
          <a href="/modules/egenkontrol/risikoanalyse.html" class="btn btn-secondary">
            Se hele risikoanalysen
          </a>
        </div>
      </div>
    </div>
  `;

  injectStyles();
}

function injectStyles() {
  if (document.getElementById('risk-analysis-styles')) return;
  const style = document.createElement('style');
  style.id = 'risk-analysis-styles';
  style.textContent = `
    .risk-card { background:#fff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05); }
    .risk-card-header { padding:20px 24px; background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%); border-bottom:1px solid #e5e7eb; }
    .risk-card-header h3 { margin:0; font-size:18px; color:#111827; }
    .risk-card-body { padding:20px 24px; }
    .risk-list { margin:0 0 0 20px; padding:0; list-style:disc; }
    .risk-list li { margin-bottom:8px; font-size:14px; color:#374151; }
    .risk-actions { margin-top:20px; padding-top:16px; border-top:1px solid #e5e7eb; }
  `;
  document.head.appendChild(style);
}

export default { loadRiskAnalysisCard };
