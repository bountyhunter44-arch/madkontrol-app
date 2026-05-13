// SLET FRA HER

export const RISK_ANALYSIS_STYLES = `
.risk-page{
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:24px;
  padding:28px;
  box-shadow:0 10px 30px rgba(15,23,42,.06);
  margin-bottom:24px;
  page-break-after:always;
}

.risk-cover-page{
  min-height:960px;
  display:flex;
  align-items:center;
  justify-content:center;
}

.risk-cover-inner{
  max-width:760px;
  width:100%;
}

.risk-kicker{
  font-size:12px;
  letter-spacing:.12em;
  text-transform:uppercase;
  color:#64748b;
  margin-bottom:10px;
}

.risk-cover-page h1{
  font-size:44px;
  line-height:1.08;
  margin:0 0 16px;
}

.risk-cover-intro{
  color:#475569;
  font-size:16px;
  line-height:1.65;
  margin-bottom:24px;
}

.risk-company-box{
  display:grid;
  gap:10px;
  background:#f8fafc;
  border:1px solid #e2e8f0;
  border-radius:18px;
  padding:18px 20px;
}

.risk-page-header{
  margin-bottom:20px;
}

.risk-page-header h2{
  margin:0;
  font-size:28px;
  line-height:1.2;
}

.risk-section{
  border-top:1px solid #e5e7eb;
  padding-top:20px;
  margin-top:20px;
}

.risk-section:first-child{
  border-top:none;
  padding-top:0;
  margin-top:0;
}

.risk-section-meta{
  margin-bottom:10px;
}

.risk-badge{
  display:inline-flex;
  align-items:center;
  padding:6px 10px;
  border-radius:999px;
  font-size:12px;
  font-weight:700;
  letter-spacing:.02em;
}

.risk-badge-ccp{
  background:#fee2e2;
  color:#991b1b;
}

.risk-badge-gag{
  background:#dcfce7;
  color:#166534;
}

.risk-section-title{
  margin:0 0 10px;
  font-size:20px;
  line-height:1.25;
}

.risk-section-body{
  color:#334155;
  line-height:1.7;
  margin-bottom:18px;
}

.risk-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:14px;
}

.risk-card{
  background:#f8fafc;
  border:1px solid #e2e8f0;
  border-radius:16px;
  padding:14px 16px;
}

.risk-card-full{
  grid-column:1 / -1;
}

.risk-card h4{
  margin:0 0 10px;
  font-size:14px;
}

.risk-list{
  margin:0;
  padding-left:18px;
  color:#334155;
  line-height:1.6;
}

.risk-empty{
  margin:0;
  color:#64748b;
}

.risk-summary-table{
  display:grid;
  gap:12px;
}

.risk-summary-row{
  border:1px solid #e2e8f0;
  background:#fff;
  border-radius:18px;
  padding:14px 16px;
}

.risk-summary-title{
  margin-bottom:8px;
}

.risk-summary-classification{
  font-size:13px;
  font-weight:700;
  color:#475569;
  margin-bottom:10px;
}

.risk-summary-controls{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}

.risk-chip{
  display:inline-flex;
  align-items:center;
  padding:6px 10px;
  border-radius:999px;
  background:#eff6ff;
  border:1px solid #bfdbfe;
  color:#1d4ed8;
  font-size:12px;
  font-weight:600;
}

@media (max-width: 860px){
  .risk-grid{
    grid-template-columns:1fr;
  }

  .risk-card-full{
    grid-column:auto;
  }

  .risk-cover-page h1{
    font-size:34px;
  }

  .risk-page{
    padding:20px;
    border-radius:20px;
  }
}
`;

// TIL HER